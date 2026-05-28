import { matchDay, matchHourOfDay, mean, type MatchResult } from "./similarity";
import { monthName } from "./format";
import type {
  DayPoint,
  ForecastBundle,
  HistoryBundle,
  HourPoint,
} from "./types";

export interface WarmRank {
  kind: "warmest" | "coldest";
  rank: number;
  total: number;
}

export interface SeasonalReturn {
  month: string;
  monthsAway: number;
  warming: boolean;
}

/** True when home and comparison are in opposite hemispheres. */
export function isOppositeHemisphere(homeLat: number, compLat: number): boolean {
  return homeLat >= 0 !== compLat >= 0;
}

/** Circular month distance (0-6) between two month indices. */
export function monthDistance(a: number, b: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, 12 - raw);
}

/**
 * A match is a "seasonal inversion" when it lands roughly half a year away from
 * the current date — i.e. the other place's weather only happens here in the
 * opposite season. Combined with opposite-hemisphere geography this is the
 * "it's their summer, our winter" insight.
 */
export function isSeasonalInversionMatch(
  matchDate: string,
  now: Date = new Date(),
): boolean {
  const matchMonth = Number(matchDate.slice(5, 7)) - 1;
  return monthDistance(matchMonth, now.getMonth()) >= 4;
}

/**
 * Ranks today's home weather against the past year. Returns the notable
 * extreme (top/bottom ~15 by daily high) or null when the day is unremarkable.
 */
export function warmestRank(
  history: DayPoint[],
  todayShape: DayPoint,
  threshold = 15,
): WarmRank | null {
  if (history.length === 0) return null;
  const highs = history.map((d) => d.tempMax);
  const total = history.length + 1;
  const warmRank = highs.filter((h) => h > todayShape.tempMax).length + 1;
  const coldRank = highs.filter((h) => h < todayShape.tempMax).length + 1;
  // Report whichever extreme is more notable; only if it clears the threshold.
  if (Math.min(warmRank, coldRank) > threshold) return null;
  return warmRank <= coldRank
    ? { kind: "warmest", rank: warmRank, total }
    : { kind: "coldest", rank: coldRank, total };
}

/** Mean apparent temp per calendar month (index 0-11) from history. */
export function monthlyApparentMeans(history: DayPoint[]): (number | null)[] {
  const buckets: number[][] = Array.from({ length: 12 }, () => []);
  for (const d of history) {
    const m = Number(d.date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) buckets[m].push(d.apparentTempMean);
  }
  return buckets.map((b) => (b.length ? mean(b) : null));
}

/**
 * Estimates when home will next naturally feel like `targetApparent` based on
 * seasonal averages. Searches forward from next month for the closest monthly
 * mean. Returns null if history is too sparse to be meaningful.
 */
export function seasonalReturn(
  history: DayPoint[],
  targetApparent: number,
  now: Date = new Date(),
): SeasonalReturn | null {
  const means = monthlyApparentMeans(history);
  const present = means[now.getMonth()];
  if (present == null) return null;

  let bestOffset = -1;
  let bestDelta = Infinity;
  for (let offset = 0; offset <= 11; offset++) {
    const m = (now.getMonth() + offset) % 12;
    const val = means[m];
    if (val == null) continue;
    const delta = Math.abs(val - targetApparent);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestOffset = offset;
    }
  }
  if (bestOffset < 0) return null;
  const targetMonth = (now.getMonth() + bestOffset) % 12;
  return {
    month: monthName(targetMonth),
    monthsAway: bestOffset,
    warming: targetApparent > present,
  };
}

export interface Insights {
  /** Primary: home's last day shaped like the comparison city's day. */
  dayMatch: MatchResult<DayPoint> | null;
  dayInversion: boolean;
  /** Right-now: home's last same-hour-of-day like the comparison city now. */
  hourMatch: MatchResult<HourPoint> | null;
  /** Reverse: comparison's last day shaped like home's day today. */
  reverseDayMatch: MatchResult<DayPoint> | null;
  warmRank: WarmRank | null;
  seasonal: SeasonalReturn | null;
  oppositeHemisphere: boolean;
}

export function buildInsights(
  homeForecast: ForecastBundle,
  homeHistory: HistoryBundle,
  comparisonForecast: ForecastBundle,
  comparisonHistory: HistoryBundle | null,
  comparisonHour: HourPoint,
  now: Date = new Date(),
): Insights {
  const dayMatch = matchDay(comparisonForecast.todayShape, homeHistory.days);
  const hourMatch = matchHourOfDay(comparisonHour, homeHistory.hours, 2);
  const reverseDayMatch = comparisonHistory
    ? matchDay(homeForecast.todayShape, comparisonHistory.days)
    : null;

  return {
    dayMatch,
    dayInversion: dayMatch ? isSeasonalInversionMatch(dayMatch.item.date, now) : false,
    hourMatch,
    reverseDayMatch,
    warmRank: warmestRank(homeHistory.days, homeForecast.todayShape),
    seasonal: seasonalReturn(
      homeHistory.days,
      comparisonForecast.todayShape.apparentTempMean,
      now,
    ),
    oppositeHemisphere: isOppositeHemisphere(
      homeForecast.location.latitude,
      comparisonForecast.location.latitude,
    ),
  };
}
