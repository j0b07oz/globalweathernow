import { describe, it, expect } from "vitest";
import {
  isOppositeHemisphere,
  isSeasonalInversionMatch,
  monthDistance,
  warmestRank,
  monthlyApparentMeans,
  seasonalReturn,
} from "./insights";
import type { DayPoint } from "./types";

function day(date: string, tempMax: number, apparentTempMean = tempMax - 4): DayPoint {
  return {
    date,
    tempMax,
    tempMin: tempMax - 8,
    apparentTempMean,
    apparentTempMax: tempMax - 1,
    apparentTempMin: tempMax - 9,
    dewPointMean: apparentTempMean - 5,
    humidityMean: 60,
    windSpeedMean: 3,
    cloudCoverMean: 40,
    precipitationSum: 0,
    weatherCode: 1,
  };
}

describe("hemisphere + season helpers", () => {
  it("detects opposite hemispheres", () => {
    expect(isOppositeHemisphere(40, -33)).toBe(true); // NYC vs Sydney
    expect(isOppositeHemisphere(40, 51)).toBe(false); // NYC vs London
    expect(isOppositeHemisphere(-33, -34)).toBe(false);
  });

  it("computes circular month distance", () => {
    expect(monthDistance(0, 6)).toBe(6);
    expect(monthDistance(11, 0)).toBe(1);
    expect(monthDistance(2, 3)).toBe(1);
  });

  it("flags a half-year-away match as seasonal inversion", () => {
    const january = new Date("2026-01-15T12:00:00Z");
    expect(isSeasonalInversionMatch("2025-07-10", january)).toBe(true);
    expect(isSeasonalInversionMatch("2026-02-01", january)).toBe(false);
  });
});

describe("warmestRank", () => {
  const history = [day("2025-01-01", 5), day("2025-04-01", 18), day("2025-07-01", 32)];

  it("returns null for unremarkable middle days", () => {
    const today = day("2026-04-15", 18);
    expect(warmestRank(history, today, 1)).toBeNull();
  });

  it("ranks a hot day as warmest", () => {
    const today = day("2026-07-15", 35);
    const rank = warmestRank(history, today);
    expect(rank).toEqual({ kind: "warmest", rank: 1, total: 4 });
  });

  it("ranks a cold day as coolest", () => {
    const today = day("2026-01-10", -2);
    const rank = warmestRank(history, today);
    expect(rank).toEqual({ kind: "coldest", rank: 1, total: 4 });
  });
});

describe("seasonalReturn", () => {
  it("points to the future month whose average matches the target", () => {
    // Build a year where July is warmest (~28) and January coldest (~2).
    const history: DayPoint[] = [];
    for (let m = 0; m < 12; m++) {
      const t = 15 + 13 * Math.cos(((m - 6) / 12) * 2 * Math.PI);
      const mm = String(m + 1).padStart(2, "0");
      history.push(day(`2025-${mm}-15`, t + 4, t));
    }
    const means = monthlyApparentMeans(history);
    expect(means[6]).not.toBeNull(); // July populated

    // In February (cold), when will home feel like a warm 27° target again?
    const february = new Date("2026-02-15T12:00:00Z");
    const result = seasonalReturn(history, 27, february)!;
    expect(result.warming).toBe(true);
    // Closest warm month going forward should be around mid-summer.
    expect(["June", "July", "August"]).toContain(result.month);
  });



  it("can return the current month when today already matches the target", () => {
    const history: DayPoint[] = [];
    for (let m = 0; m < 12; m++) {
      const t = m === 4 ? 20 : 5;
      const mm = String(m + 1).padStart(2, "0");
      history.push(day(`2025-${mm}-15`, t + 4, t));
    }

    const may = new Date("2026-05-28T12:00:00Z");
    const result = seasonalReturn(history, 20, may)!;
    expect(result.month).toBe("May");
    expect(result.monthsAway).toBe(0);
  });

  it("returns null when history is empty", () => {
    expect(seasonalReturn([], 20, new Date())).toBeNull();
  });
});
