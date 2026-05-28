import {
  type CurrentConditions,
  type DayPoint,
  type ForecastBundle,
  type GeoLocation,
  type HistoryBundle,
  type HourPoint,
} from "./types";
import { dominantWeatherCode } from "./weather-codes";
import { mean } from "./similarity";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

/**
 * All requests use timezone=auto so Open-Meteo returns timestamps already in
 * each location's local wall-clock time, and wind_speed_unit=ms so wind is
 * stored canonically in metres per second. Everything is metric here; display
 * conversion happens at render time.
 */

const HOURLY_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "dew_point_2m",
  "relative_humidity_2m",
  "wind_speed_10m",
  "cloud_cover",
  "precipitation",
  "weather_code",
].join(",");

const CURRENT_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "dew_point_2m",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "cloud_cover",
  "precipitation",
  "weather_code",
  "is_day",
].join(",");

const DAILY_VARS = ["sunrise", "sunset"].join(",");

interface GeocodeApiResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
}

function assembleLabel(r: GeocodeApiResult): string {
  return [r.name, r.admin1, r.country].filter(Boolean).join(", ");
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed (${res.status})`);
  }
  const json = await res.json();
  if (json?.error) {
    throw new Error(json.reason ?? "Open-Meteo returned an error");
  }
  return json;
}

export async function geocode(
  query: string,
  signal?: AbortSignal,
): Promise<GeoLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const params = new URLSearchParams({
    name: trimmed,
    count: "8",
    language: "en",
    format: "json",
  });
  const json = await fetchJson(`${GEOCODE_URL}?${params}`, signal);
  const results: GeocodeApiResult[] = json.results ?? [];
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    label: assembleLabel(r),
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
    country: r.country,
    countryCode: r.country_code,
    admin1: r.admin1,
  }));
}

/** Builds DayPoint aggregates by grouping hourly rows by their local date. */
export function aggregateDays(hours: HourPoint[]): DayPoint[] {
  const byDate = new Map<string, HourPoint[]>();
  for (const h of hours) {
    const date = h.time.slice(0, 10);
    const arr = byDate.get(date);
    if (arr) arr.push(h);
    else byDate.set(date, [h]);
  }
  const days: DayPoint[] = [];
  for (const [date, rows] of byDate) {
    if (rows.length === 0) continue;
    days.push({
      date,
      tempMax: Math.max(...rows.map((r) => r.temp)),
      tempMin: Math.min(...rows.map((r) => r.temp)),
      apparentTempMean: mean(rows.map((r) => r.apparentTemp)),
      apparentTempMax: Math.max(...rows.map((r) => r.apparentTemp)),
      apparentTempMin: Math.min(...rows.map((r) => r.apparentTemp)),
      dewPointMean: mean(rows.map((r) => r.dewPoint)),
      humidityMean: mean(rows.map((r) => r.humidity)),
      windSpeedMean: mean(rows.map((r) => r.windSpeed)),
      cloudCoverMean: mean(rows.map((r) => r.cloudCover)),
      precipitationSum: rows.reduce((s, r) => s + r.precipitation, 0),
      weatherCode: dominantWeatherCode(rows.map((r) => r.weatherCode)),
    });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

/** Parses an Open-Meteo hourly block (parallel arrays) into HourPoint[]. */
function parseHourly(hourly: any): HourPoint[] {
  if (!hourly?.time) return [];
  const times: string[] = hourly.time;
  const out: HourPoint[] = [];
  for (let i = 0; i < times.length; i++) {
    const temp = hourly.temperature_2m?.[i];
    const apparent = hourly.apparent_temperature?.[i];
    // Skip rows missing the load-bearing fields (archive gaps return null).
    if (temp == null || apparent == null) continue;
    const t = times[i];
    out.push({
      time: t,
      hour: Number(t.slice(11, 13)),
      temp,
      apparentTemp: apparent,
      dewPoint: hourly.dew_point_2m?.[i] ?? apparent,
      humidity: hourly.relative_humidity_2m?.[i] ?? 0,
      windSpeed: hourly.wind_speed_10m?.[i] ?? 0,
      cloudCover: hourly.cloud_cover?.[i] ?? 0,
      precipitation: hourly.precipitation?.[i] ?? 0,
      weatherCode: hourly.weather_code?.[i] ?? 0,
    });
  }
  return out;
}

export async function fetchForecast(
  location: GeoLocation,
  signal?: AbortSignal,
): Promise<ForecastBundle> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: CURRENT_VARS,
    hourly: HOURLY_VARS,
    daily: DAILY_VARS,
    timezone: "auto",
    wind_speed_unit: "ms",
    forecast_days: "1",
  });
  const json = await fetchJson(`${FORECAST_URL}?${params}`, signal);
  const c = json.current;
  const current: CurrentConditions = {
    time: c.time,
    temp: c.temperature_2m,
    apparentTemp: c.apparent_temperature,
    dewPoint: c.dew_point_2m,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    windDirection: c.wind_direction_10m,
    cloudCover: c.cloud_cover,
    precipitation: c.precipitation,
    weatherCode: c.weather_code,
    isDay: c.is_day === 1,
  };

  const hours = parseHourly(json.hourly);
  const todayShape =
    aggregateDays(hours)[0] ??
    ({
      date: current.time.slice(0, 10),
      tempMax: current.temp,
      tempMin: current.temp,
      apparentTempMean: current.apparentTemp,
      apparentTempMax: current.apparentTemp,
      apparentTempMin: current.apparentTemp,
      dewPointMean: current.dewPoint,
      humidityMean: current.humidity,
      windSpeedMean: current.windSpeed,
      cloudCoverMean: current.cloudCover,
      precipitationSum: current.precipitation,
      weatherCode: current.weatherCode,
    } satisfies DayPoint);

  return {
    location: { ...location, timezone: json.timezone ?? location.timezone },
    current,
    today: {
      sunrise: json.daily?.sunrise?.[0] ?? null,
      sunset: json.daily?.sunset?.[0] ?? null,
    },
    todayShape,
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Number of recent days the forecast endpoint backfills to bridge archive lag. */
const RECENT_FILL_DAYS = 14;

/**
 * Merges two hour streams keyed by local timestamp. `primary` (the ERA5 archive)
 * wins on overlap because it is authoritative reanalysis; `fill` (recent hours
 * from the forecast endpoint) only contributes timestamps the archive is missing
 * — the multi-day lag near "now" that the archive hasn't published yet.
 */
export function mergeHours(primary: HourPoint[], fill: HourPoint[]): HourPoint[] {
  const byTime = new Map<string, HourPoint>();
  for (const h of primary) byTime.set(h.time, h);
  for (const h of fill) if (!byTime.has(h.time)) byTime.set(h.time, h);
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Pulls recent past hours from the forecast endpoint to cover the window the
 * ERA5 archive lags behind. Caps at the location's current local time so we
 * never feed *future* forecast hours into the "when did it last feel like this"
 * candidate pool. Returns the local "now" date so the caller can exclude today.
 */
async function fetchRecentHours(
  location: GeoLocation,
  signal?: AbortSignal,
): Promise<{ hours: HourPoint[]; nowLocal: string | null }> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m",
    hourly: HOURLY_VARS,
    timezone: "auto",
    wind_speed_unit: "ms",
    past_days: String(RECENT_FILL_DAYS),
    forecast_days: "1",
  });
  const json = await fetchJson(`${FORECAST_URL}?${params}`, signal);
  const nowLocal: string | null = json.current?.time ?? null;
  let hours = parseHourly(json.hourly);
  if (nowLocal) hours = hours.filter((h) => h.time <= nowLocal);
  return { hours, nowLocal };
}

export async function fetchHistory(
  location: GeoLocation,
  signal?: AbortSignal,
  now: Date = new Date(),
): Promise<HistoryBundle> {
  // The archive (ERA5) lags a few days; end yesterday to stay within coverage.
  const end = new Date(now.getTime() - 1 * 86400000);
  const start = new Date(now.getTime() - 365 * 86400000);
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    start_date: isoDate(start),
    end_date: isoDate(end),
    hourly: HOURLY_VARS,
    timezone: "auto",
    wind_speed_unit: "ms",
  });
  const json = await fetchJson(`${ARCHIVE_URL}?${params}`, signal);
  const archiveHours = parseHourly(json.hourly);

  // Bridge the archive's multi-day publishing lag with recent actuals from the
  // forecast endpoint, so the genuinely-recent comparable days (incl. yesterday)
  // are present as candidates. If this fails, fall back to archive-only.
  let recentHours: HourPoint[] = [];
  let nowLocal: string | null = null;
  try {
    const recent = await fetchRecentHours(location, signal);
    recentHours = recent.hours;
    nowLocal = recent.nowLocal;
  } catch {
    // Archive-only is still usable; the recent week just won't be a candidate.
  }

  const hours = mergeHours(archiveHours, recentHours);
  const today = nowLocal?.slice(0, 10) ?? isoDate(now);

  // Exclude today from the candidate pools: today's day is incomplete and a
  // self-match ("it feels like today") is not the insight we want — "the last
  // time it felt like this" should resolve to yesterday at the earliest.
  const candidateHours = hours.filter((h) => h.time.slice(0, 10) < today);
  const days = aggregateDays(candidateHours);
  return {
    location: { ...location, timezone: json.timezone ?? location.timezone },
    days,
    hours: candidateHours,
  };
}

/** Reduces a CurrentConditions reading to an HourPoint for hour-level matching. */
export function currentToHourPoint(current: CurrentConditions): HourPoint {
  return {
    time: current.time,
    hour: Number(current.time.slice(11, 13)),
    temp: current.temp,
    apparentTemp: current.apparentTemp,
    dewPoint: current.dewPoint,
    humidity: current.humidity,
    windSpeed: current.windSpeed,
    cloudCover: current.cloudCover,
    precipitation: current.precipitation,
    weatherCode: current.weatherCode,
  };
}
