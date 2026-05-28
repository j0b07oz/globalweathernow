/**
 * Shared domain types. All weather values are stored in CANONICAL METRIC units
 * (Celsius, m/s wind, mm precipitation) regardless of the user's display
 * preference. Display conversion happens at render time so toggling units never
 * triggers a re-fetch of a full year of history.
 */

export type Units = "F" | "C";

export type DateFormatPref = "US" | "ISO" | "EU";

export type CompareMode = "both" | "now" | "today";

export interface GeoLocation {
  id: number;
  name: string;
  /** "City, Region, Country" assembled for display. */
  label: string;
  latitude: number;
  longitude: number;
  /** IANA timezone, e.g. "Europe/London". */
  timezone: string;
  country?: string;
  countryCode?: string;
  admin1?: string;
}

/** A single hour of weather, metric units. */
export interface HourPoint {
  /** Local ISO timestamp "YYYY-MM-DDTHH:mm" in the location's timezone. */
  time: string;
  /** Hour of day 0-23 in local time. */
  hour: number;
  temp: number;
  apparentTemp: number;
  dewPoint: number;
  humidity: number;
  windSpeed: number;
  cloudCover: number;
  precipitation: number;
  weatherCode: number;
}

/** Aggregated day of weather, metric units. */
export interface DayPoint {
  /** Local date "YYYY-MM-DD". */
  date: string;
  tempMax: number;
  tempMin: number;
  apparentTempMean: number;
  apparentTempMax: number;
  apparentTempMin: number;
  dewPointMean: number;
  humidityMean: number;
  windSpeedMean: number;
  cloudCoverMean: number;
  precipitationSum: number;
  /** Most representative weather code for the day. */
  weatherCode: number;
}

export interface CurrentConditions {
  /** Local ISO timestamp in the location's timezone. */
  time: string;
  temp: number;
  apparentTemp: number;
  dewPoint: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  precipitation: number;
  weatherCode: number;
  isDay: boolean;
}

export interface DaySummary {
  sunrise: string | null;
  sunset: string | null;
}

export interface ForecastBundle {
  location: GeoLocation;
  current: CurrentConditions;
  today: DaySummary;
  /** The current local day aggregate, used for "Today overall" matching. */
  todayShape: DayPoint;
}

export interface HistoryBundle {
  location: GeoLocation;
  days: DayPoint[];
  hours: HourPoint[];
}
