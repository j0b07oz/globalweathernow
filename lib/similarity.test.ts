import { describe, it, expect } from "vitest";
import {
  matchDay,
  matchHour,
  matchHourOfDay,
  hourOfDayDistance,
  scoreToConfidence,
  computeStats,
  mean,
  std,
  CONFIDENCE_THRESHOLDS,
} from "./similarity";
import type { DayPoint, HourPoint } from "./types";

function makeDay(date: string, overrides: Partial<DayPoint> = {}): DayPoint {
  return {
    date,
    tempMax: 20,
    tempMin: 10,
    apparentTempMean: 15,
    apparentTempMax: 21,
    apparentTempMin: 9,
    dewPointMean: 8,
    humidityMean: 60,
    windSpeedMean: 3,
    cloudCoverMean: 40,
    precipitationSum: 0,
    weatherCode: 1,
    ...overrides,
  };
}

function makeHour(
  hour: number,
  overrides: Partial<HourPoint> = {},
): HourPoint {
  return {
    time: `2026-01-01T${String(hour).padStart(2, "0")}:00`,
    hour,
    temp: 15,
    apparentTemp: 14,
    dewPoint: 8,
    humidity: 60,
    windSpeed: 3,
    cloudCover: 40,
    precipitation: 0,
    weatherCode: 1,
    ...overrides,
  };
}

/**
 * Builds a year of synthetic daily data for a city with a sinusoidal annual
 * temperature cycle. `peakOffsetDays` shifts the warm peak: 0 ≈ northern
 * hemisphere (warm in July), 182 ≈ southern hemisphere (warm in January).
 */
function makeYear(peakOffsetDays: number, baseTemp = 15, amplitude = 12): DayPoint[] {
  const days: DayPoint[] = [];
  const start = new Date(Date.UTC(2025, 0, 1));
  for (let i = 0; i < 365; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const phase = ((i - peakOffsetDays) / 365) * 2 * Math.PI;
    const t = baseTemp + amplitude * Math.cos(phase);
    days.push(
      makeDay(d.toISOString().slice(0, 10), {
        apparentTempMean: t,
        tempMax: t + 5,
        tempMin: t - 5,
        dewPointMean: t - 6,
      }),
    );
  }
  return days;
}

describe("statistics helpers", () => {
  it("computes mean and population std", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(std([2, 4, 6])).toBeCloseTo(Math.sqrt(8 / 3), 6);
  });

  it("returns zero std for a constant column", () => {
    const stats = computeStats(
      [{ a: 5 }, { a: 5 }, { a: 5 }],
      ["a"] as const,
    );
    expect(stats.std.a).toBe(0);
    expect(stats.mean.a).toBe(5);
  });
});

describe("scoreToConfidence", () => {
  it("buckets distances into strong / approximate / loose", () => {
    expect(scoreToConfidence(0)).toBe("strong");
    expect(scoreToConfidence(CONFIDENCE_THRESHOLDS.strong)).toBe("strong");
    expect(scoreToConfidence(CONFIDENCE_THRESHOLDS.strong + 0.01)).toBe(
      "approximate",
    );
    expect(scoreToConfidence(CONFIDENCE_THRESHOLDS.approximate + 0.01)).toBe(
      "loose",
    );
  });
});

describe("matchDay", () => {
  it("returns null for empty history", () => {
    expect(matchDay(makeDay("2026-01-01"), [])).toBeNull();
  });

  it("finds an exact same-city match with zero distance and strong confidence", () => {
    const history = [
      makeDay("2025-01-10", { apparentTempMean: 2, tempMax: 5, tempMin: -1 }),
      makeDay("2025-04-15", { apparentTempMean: 14, tempMax: 19, tempMin: 9 }),
      makeDay("2025-07-20", { apparentTempMean: 27, tempMax: 32, tempMin: 22 }),
    ];
    // Target identical to the April day.
    const target = makeDay("2026-04-15", {
      apparentTempMean: 14,
      tempMax: 19,
      tempMin: 9,
    });
    const result = matchDay(target, history);
    expect(result).not.toBeNull();
    expect(result!.item.date).toBe("2025-04-15");
    expect(result!.distance).toBeCloseTo(0, 6);
    expect(result!.confidence).toBe("strong");
  });

  it("matches a warm target to summer in a northern-hemisphere year", () => {
    const history = makeYear(182); // warm peak mid-July (~day 182)
    const hotTarget = makeDay("2026-07-01", {
      apparentTempMean: 26,
      tempMax: 31,
      tempMin: 21,
      dewPointMean: 20,
    });
    const result = matchDay(hotTarget, history)!;
    const month = Number(result.item.date.slice(5, 7));
    expect(month).toBeGreaterThanOrEqual(6);
    expect(month).toBeLessThanOrEqual(8);
  });

  it("surfaces seasonal inversion: a southern-hemisphere summer target maps to northern winter dates", () => {
    // Home is northern hemisphere (warm in July).
    const northernHome = makeYear(182);
    // Comparison city is southern hemisphere and currently in its summer —
    // hot right now (our January). For the northern home, the last time it was
    // this warm was the previous northern summer (Jun–Aug of the prior year).
    const southernSummerTarget = makeDay("2026-01-15", {
      apparentTempMean: 26,
      tempMax: 31,
      tempMin: 21,
      dewPointMean: 20,
    });
    const result = matchDay(southernSummerTarget, northernHome)!;
    const month = Number(result.item.date.slice(5, 7));
    // Match should land in northern summer, NOT in January.
    expect(month).toBeGreaterThanOrEqual(6);
    expect(month).toBeLessThanOrEqual(8);
  });

  it("ranks a closer day above a farther one", () => {
    const history = [
      makeDay("2025-02-01", { apparentTempMean: 0 }),
      makeDay("2025-05-01", { apparentTempMean: 16 }),
      makeDay("2025-08-01", { apparentTempMean: 30 }),
    ];
    const target = makeDay("2026-05-10", { apparentTempMean: 17 });
    const result = matchDay(target, history)!;
    expect(result.item.date).toBe("2025-05-01");
  });

  it("prefers the most recent of two indistinguishable days (the 'last time' promise)", () => {
    // Reproduces the nearby-city bug report: an old day and yesterday are an
    // identical match; the matcher must return yesterday, not the old day.
    const feel = { apparentTempMean: 20, tempMax: 25, tempMin: 15, dewPointMean: 14 };
    const history = [
      makeDay("2025-06-14", feel),
      makeDay("2025-09-01", { apparentTempMean: 6, tempMax: 10, tempMin: 2, dewPointMean: 0 }),
      makeDay("2026-01-10", { apparentTempMean: -3, tempMax: 1, tempMin: -7, dewPointMean: -8 }),
      makeDay("2026-05-27", feel), // yesterday — identical feel
    ];
    const target = makeDay("2026-05-28", feel);
    const result = matchDay(target, history)!;
    expect(result.item.date).toBe("2026-05-27");
    expect(result.distance).toBeCloseTo(0, 6);
  });

  it("returns the most recent occurrence when the season repeats within the year", () => {
    // A northern year is cold at BOTH ends (the prior January and the recent
    // December). A cold target must resolve to the recent December.
    const home = makeYear(182);
    const coldTarget = makeDay("2026-01-05", {
      apparentTempMean: 3,
      tempMax: 8,
      tempMin: -2,
      dewPointMean: -3,
    });
    const month = Number(matchDay(coldTarget, home)!.item.date.slice(5, 7));
    expect(month).toBeGreaterThanOrEqual(11);
  });

  it("does NOT override a clear winner with a more recent but worse match", () => {
    // A recent day that feels nothing like the target must not win on recency.
    const history = [
      makeDay("2025-07-01", { apparentTempMean: 28, tempMax: 33, tempMin: 23, dewPointMean: 20 }),
      makeDay("2026-01-15", { apparentTempMean: -5, tempMax: 0, tempMin: -10, dewPointMean: -9 }),
    ];
    const hotTarget = makeDay("2026-05-28", {
      apparentTempMean: 27,
      tempMax: 32,
      tempMin: 22,
      dewPointMean: 19,
    });
    expect(matchDay(hotTarget, history)!.item.date).toBe("2025-07-01");
  });
});

describe("hour matching", () => {
  it("computes circular hour-of-day distance", () => {
    expect(hourOfDayDistance(20, 22)).toBe(2);
    expect(hourOfDayDistance(23, 1)).toBe(2);
    expect(hourOfDayDistance(0, 12)).toBe(12);
  });

  it("restricts candidates to the ±window hours-of-day", () => {
    // A full set of hours; target is 20:00 (evening). With a ±2h window the
    // matcher must only consider hours 18-22, never noon.
    const history: HourPoint[] = [];
    for (let day = 0; day < 5; day++) {
      for (let h = 0; h < 24; h++) {
        history.push(
          makeHour(h, {
            time: `2025-03-0${day + 1}T${String(h).padStart(2, "0")}:00`,
            // Make noon very hot and evening mild so a bug that ignores the
            // window would wrongly pick noon for a mild evening target.
            apparentTemp: h === 12 ? 35 : 12,
          }),
        );
      }
    }
    const eveningTarget = makeHour(20, { apparentTemp: 12 });
    const result = matchHourOfDay(eveningTarget, history, 2)!;
    expect(result.item.hour).toBeGreaterThanOrEqual(18);
    expect(result.item.hour).toBeLessThanOrEqual(22);
  });

  it("returns null when no candidate hours fall in the window", () => {
    const history = [makeHour(2), makeHour(3)];
    const noonTarget = makeHour(12);
    expect(matchHourOfDay(noonTarget, history, 1)).toBeNull();
    expect(matchHour(noonTarget, [])).toBeNull();
  });

  it("prefers the most recent indistinguishable hour", () => {
    const ev = { apparentTemp: 16, dewPoint: 10, humidity: 65, windSpeed: 2, cloudCover: 30 };
    const candidates = [
      makeHour(20, { time: "2025-07-15T20:00", ...ev }),
      makeHour(20, { time: "2026-02-01T20:00", apparentTemp: -2, dewPoint: -6 }),
      makeHour(20, { time: "2026-05-27T20:00", ...ev }), // yesterday evening
    ];
    const target = makeHour(20, { time: "2026-05-28T20:00", ...ev });
    expect(matchHour(target, candidates)!.item.time).toBe("2026-05-27T20:00");
  });
});
