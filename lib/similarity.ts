import type { DayPoint, HourPoint } from "./types";

/**
 * Weather-similarity engine.
 *
 * The core idea: express the *comparison* city's weather in terms of the *home*
 * city's climate distribution, then find the historical home-city day (or hour)
 * whose normalized feature vector is closest. Normalization is a z-score against
 * the home city's own 365-day distribution, so "warm" means "warm for here".
 *
 * distance = sqrt( Σ weightₖ · ((targetₖ − candidateₖ) / stdₖ)² )
 *
 * Because the mean cancels in the difference, only the per-feature standard
 * deviation matters for ranking — but we keep the full z-score framing because
 * it makes the distance interpretable (it is, roughly, a weighted RMS number of
 * standard deviations of disagreement).
 */

export const DAY_WEIGHTS = {
  apparentTempMean: 0.3,
  tempMax: 0.15,
  tempMin: 0.15,
  dewPointMean: 0.15,
  humidityMean: 0.05,
  windSpeedMean: 0.08,
  cloudCoverMean: 0.07,
  precipitationSum: 0.05,
} as const;

export const HOUR_WEIGHTS = {
  apparentTemp: 0.4,
  dewPoint: 0.25,
  humidity: 0.1,
  windSpeed: 0.1,
  cloudCover: 0.1,
  precipitation: 0.05,
} as const;

export type DayFeatureKey = keyof typeof DAY_WEIGHTS;
export type HourFeatureKey = keyof typeof HOUR_WEIGHTS;

export const CONFIDENCE_THRESHOLDS = {
  strong: 0.6,
  approximate: 1.5,
} as const;

export type Confidence = "strong" | "approximate" | "loose";

export interface MatchResult<T> {
  item: T;
  index: number;
  distance: number;
  confidence: Confidence;
}

/** Smallest std we will divide by, to keep degenerate features finite. */
const MIN_STD = 1e-9;

/**
 * Per-feature z-difference is clamped to ±this many standard deviations. A
 * feature with (near) zero historical variance would otherwise divide a real
 * difference by ~0 and produce an enormous term that swamps every other feature
 * and destroys ranking precision (e.g. a desert with zero annual precipitation
 * compared against a rainy city). Clamping keeps any one feature's influence
 * bounded so the temperature signal still ranks the candidates.
 */
const Z_CLAMP = 6;
const DISTANCE_TIE_EPSILON = 1e-9;

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Population standard deviation. */
export function std(values: number[], precomputedMean?: number): number {
  if (values.length === 0) return 0;
  const m = precomputedMean ?? mean(values);
  let sumSq = 0;
  for (const v of values) sumSq += (v - m) * (v - m);
  return Math.sqrt(sumSq / values.length);
}

export interface NormStats<K extends string> {
  mean: Record<K, number>;
  std: Record<K, number>;
}

export function computeStats<K extends string>(
  vectors: Record<K, number>[],
  keys: readonly K[],
): NormStats<K> {
  const meanRec = {} as Record<K, number>;
  const stdRec = {} as Record<K, number>;
  for (const key of keys) {
    const column = vectors.map((v) => v[key]);
    const m = mean(column);
    meanRec[key] = m;
    stdRec[key] = std(column, m);
  }
  return { mean: meanRec, std: stdRec };
}

function weightedZDistance<K extends string>(
  target: Record<K, number>,
  candidate: Record<K, number>,
  stats: NormStats<K>,
  weights: Record<K, number>,
  keys: readonly K[],
): number {
  let sum = 0;
  for (const key of keys) {
    const s = Math.max(stats.std[key], MIN_STD);
    const raw = (target[key] - candidate[key]) / s;
    const dz = Math.max(-Z_CLAMP, Math.min(Z_CLAMP, raw));
    sum += weights[key] * dz * dz;
  }
  return Math.sqrt(sum);
}

export function scoreToConfidence(distance: number): Confidence {
  if (distance <= CONFIDENCE_THRESHOLDS.strong) return "strong";
  if (distance <= CONFIDENCE_THRESHOLDS.approximate) return "approximate";
  return "loose";
}

/**
 * How close (in weighted-RMS-z distance) a candidate must be to the best match
 * to count as "the same feel." The product promise is "the *last* time it felt
 * like this," so among candidates that are indistinguishably close we prefer the
 * most recent one. Daily weather is noisy enough that the strict global nearest
 * neighbour is often an older day that beats yesterday by a hundredth of a sigma;
 * without this tolerance a nearby city would match a date months ago instead of
 * yesterday. Kept small so a clear winner is never overridden, and so genuinely
 * different (e.g. opposite-season) targets still land in the correct season.
 */
export const RECENCY_TOLERANCE = 0.15;

/**
 * Given per-candidate distances and their (lexicographically sortable, i.e. ISO)
 * timestamps, returns the index of the most recent candidate whose distance is
 * within `tolerance` of the global minimum. Falls back to the strict minimum.
 */
function pickMostRecentWithinTolerance(
  distances: number[],
  times: string[],
  tolerance: number,
): number {
  let min = Infinity;
  for (const d of distances) if (d < min) min = d;
  const cutoff = min + tolerance;
  let chosen = -1;
  for (let i = 0; i < distances.length; i++) {
    if (distances[i] <= cutoff && (chosen < 0 || times[i] > times[chosen])) {
      chosen = i;
    }
  }
  return chosen;
}

export function dayToFeatures(d: DayPoint): Record<DayFeatureKey, number> {
  return {
    apparentTempMean: d.apparentTempMean,
    tempMax: d.tempMax,
    tempMin: d.tempMin,
    dewPointMean: d.dewPointMean,
    humidityMean: d.humidityMean,
    windSpeedMean: d.windSpeedMean,
    cloudCoverMean: d.cloudCoverMean,
    precipitationSum: d.precipitationSum,
  };
}

export function hourToFeatures(h: HourPoint): Record<HourFeatureKey, number> {
  return {
    apparentTemp: h.apparentTemp,
    dewPoint: h.dewPoint,
    humidity: h.humidity,
    windSpeed: h.windSpeed,
    cloudCover: h.cloudCover,
    precipitation: h.precipitation,
  };
}

const DAY_KEYS = Object.keys(DAY_WEIGHTS) as DayFeatureKey[];
const HOUR_KEYS = Object.keys(HOUR_WEIGHTS) as HourFeatureKey[];

/**
 * Finds the historical day whose weather is most like `target`, normalized
 * against the distribution of `history` itself.
 */
export function matchDay(
  target: DayPoint,
  history: DayPoint[],
  tolerance = RECENCY_TOLERANCE,
): MatchResult<DayPoint> | null {
  if (history.length === 0) return null;
  const candidateFeatures = history.map(dayToFeatures);
  const stats = computeStats(candidateFeatures, DAY_KEYS);
  const targetF = dayToFeatures(target);

  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < candidateFeatures.length; i++) {
    const dist = weightedZDistance(
      targetF,
      candidateFeatures[i],
      stats,
      DAY_WEIGHTS,
      DAY_KEYS,
    );
    if (
      dist < bestDistance - DISTANCE_TIE_EPSILON ||
      (Math.abs(dist - bestDistance) <= DISTANCE_TIE_EPSILON &&
        history[i].date > history[bestIndex].date)
    ) {
      bestDistance = dist;
      bestIndex = i;
    }
  }

  return {
    item: history[bestIndex],
    index: bestIndex,
    distance: distances[bestIndex],
    confidence: scoreToConfidence(distances[bestIndex]),
  };
}

/** Circular distance between two hours-of-day (0-23). */
export function hourOfDayDistance(a: number, b: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, 24 - raw);
}

/**
 * Finds the historical hour most like `target` among a pre-filtered candidate
 * list, normalized against that candidate list's distribution.
 */
export function matchHour(
  target: HourPoint,
  candidates: HourPoint[],
  tolerance = RECENCY_TOLERANCE,
): MatchResult<HourPoint> | null {
  if (candidates.length === 0) return null;
  const candidateFeatures = candidates.map(hourToFeatures);
  const stats = computeStats(candidateFeatures, HOUR_KEYS);
  const targetF = hourToFeatures(target);

  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < candidateFeatures.length; i++) {
    const dist = weightedZDistance(
      targetF,
      candidateFeatures[i],
      stats,
      HOUR_WEIGHTS,
      HOUR_KEYS,
    );
    if (
      dist < bestDistance - DISTANCE_TIE_EPSILON ||
      (Math.abs(dist - bestDistance) <= DISTANCE_TIE_EPSILON &&
        candidates[i].time > candidates[bestIndex].time)
    ) {
      bestDistance = dist;
      bestIndex = i;
    }
  }

  return {
    item: candidates[bestIndex],
    index: bestIndex,
    distance: distances[bestIndex],
    confidence: scoreToConfidence(distances[bestIndex]),
  };
}

/**
 * Convenience: restrict the history to hours within `windowHours` of the
 * target's hour-of-day (circularly), then match. This keeps "an evening in
 * London" matched against evenings at home, not noon at home.
 */
export function matchHourOfDay(
  target: HourPoint,
  history: HourPoint[],
  windowHours = 2,
): MatchResult<HourPoint> | null {
  const candidates = history.filter(
    (h) => hourOfDayDistance(h.hour, target.hour) <= windowHours,
  );
  return matchHour(target, candidates);
}
