import { describe, it, expect, vi, afterEach } from "vitest";
import { aggregateDays, mergeHours, fetchHistory } from "./open-meteo";
import type { GeoLocation, HourPoint } from "./types";

function hour(time: string, overrides: Partial<HourPoint> = {}): HourPoint {
  return {
    time,
    hour: Number(time.slice(11, 13)),
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

/** Builds an Open-Meteo-style hourly block (parallel arrays) for whole days. */
function hourlyBlock(dates: string[], hours: number[] = range24()) {
  const time: string[] = [];
  for (const d of dates) {
    for (const h of hours) time.push(`${d}T${String(h).padStart(2, "0")}:00`);
  }
  const fill = (v: number) => time.map(() => v);
  return {
    time,
    temperature_2m: fill(15),
    apparent_temperature: fill(14),
    dew_point_2m: fill(8),
    relative_humidity_2m: fill(60),
    wind_speed_10m: fill(3),
    cloud_cover: fill(40),
    precipitation: fill(0),
    weather_code: fill(1),
  };
}

function range24(): number[] {
  return Array.from({ length: 24 }, (_, i) => i);
}

const LOC: GeoLocation = {
  id: 1,
  name: "Testville",
  label: "Testville",
  latitude: 40,
  longitude: -81,
  timezone: "America/New_York",
};

describe("mergeHours", () => {
  it("keeps archive on overlap and adds only the recent gap, sorted", () => {
    const archive = [hour("2026-05-20T00:00", { temp: 10 })];
    const fill = [
      hour("2026-05-20T00:00", { temp: 99 }), // overlaps archive -> ignored
      hour("2026-05-21T00:00", { temp: 12 }), // recent gap -> added
    ];
    const merged = mergeHours(archive, fill);
    expect(merged.map((h) => h.time)).toEqual([
      "2026-05-20T00:00",
      "2026-05-21T00:00",
    ]);
    expect(merged[0].temp).toBe(10); // archive won the overlap
  });
});

describe("aggregateDays", () => {
  it("groups hours into per-day aggregates sorted by date", () => {
    const hours = [
      hour("2026-05-20T06:00", { temp: 5 }),
      hour("2026-05-20T15:00", { temp: 25 }),
      hour("2026-05-21T15:00", { temp: 20 }),
    ];
    const days = aggregateDays(hours);
    expect(days.map((d) => d.date)).toEqual(["2026-05-20", "2026-05-21"]);
    expect(days[0].tempMax).toBe(25);
    expect(days[0].tempMin).toBe(5);
  });
});

describe("fetchHistory recent-gap bridging", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fills the archive lag from the forecast endpoint and excludes today", async () => {
    // Archive lags: it only has data through 2026-05-22, missing 23-27.
    const archive = { hourly: hourlyBlock(["2026-05-21", "2026-05-22"]) };
    // Forecast backfill covers 2026-05-25..28, including FUTURE hours today.
    const forecast = {
      current: { time: "2026-05-28T18:00" },
      hourly: hourlyBlock(["2026-05-25", "2026-05-26", "2026-05-27", "2026-05-28"]),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => (url.includes("/archive") ? archive : forecast),
      })),
    );

    const now = new Date("2026-05-28T22:00:00Z");
    const bundle = await fetchHistory(LOC, undefined, now);
    const dates = bundle.days.map((d) => d.date);

    // Yesterday (filled from forecast) is now a candidate...
    expect(dates).toContain("2026-05-27");
    // ...but today is excluded (incomplete + self-match).
    expect(dates).not.toContain("2026-05-28");
    // The recent gap (23-27) is bridged even though the archive lacked it.
    expect(dates).toEqual([
      "2026-05-21",
      "2026-05-22",
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
    ]);
    // No today hours, and no future hours, leak into the candidate pool.
    expect(bundle.hours.some((h) => h.time.slice(0, 10) === "2026-05-28")).toBe(
      false,
    );
  });

  it("falls back to archive-only when the forecast backfill fails", async () => {
    const archive = { hourly: hourlyBlock(["2026-05-20", "2026-05-21"]) };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/archive")) {
          return { ok: true, json: async () => archive };
        }
        throw new Error("network down");
      }),
    );

    const now = new Date("2026-05-28T22:00:00Z");
    const bundle = await fetchHistory(LOC, undefined, now);
    expect(bundle.days.map((d) => d.date)).toEqual(["2026-05-20", "2026-05-21"]);
  });
});
