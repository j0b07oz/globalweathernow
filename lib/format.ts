import { format, parseISO } from "date-fns";
import type { DateFormatPref, Units } from "./types";

export function cToDisplay(celsius: number, units: Units): number {
  return units === "F" ? celsius * 1.8 + 32 : celsius;
}

export function formatTemp(
  celsius: number,
  units: Units,
  withDegree = true,
): string {
  const v = Math.round(cToDisplay(celsius, units));
  return withDegree ? `${v}°` : `${v}`;
}

export function formatTempUnit(
  celsius: number,
  units: Units,
): string {
  return `${Math.round(cToDisplay(celsius, units))}°${units}`;
}

/** Wind is stored in m/s. Display in mph (imperial) or km/h (metric). */
export function formatWind(metersPerSecond: number, units: Units): string {
  if (units === "F") {
    return `${Math.round(metersPerSecond * 2.236936)} mph`;
  }
  return `${Math.round(metersPerSecond * 3.6)} km/h`;
}

const COMPASS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

export function degToCompass(deg: number): string {
  return COMPASS[Math.round(deg / 22.5) % 16];
}

const DATE_PATTERNS: Record<DateFormatPref, string> = {
  US: "MMM d, yyyy",
  ISO: "yyyy-MM-dd",
  EU: "d MMM yyyy",
};

/** Formats a "YYYY-MM-DD" date string per the user's preference. */
export function formatDate(dateStr: string, pref: DateFormatPref): string {
  try {
    const d = parseISO(dateStr);
    return format(d, DATE_PATTERNS[pref]);
  } catch {
    return dateStr;
  }
}

/**
 * Formats a local wall-clock ISO string (no offset, as returned by Open-Meteo
 * with timezone=auto) to a clock time like "2:14 PM". Only the wall-clock
 * digits matter, so parsing in the runtime's local zone is safe here.
 */
export function formatClock(localIso: string): string {
  try {
    return format(parseISO(localIso), "h:mm a");
  } catch {
    return localIso;
  }
}

export function formatDayContext(localIso: string): string {
  try {
    return format(parseISO(localIso), "EEE, MMM d");
  } catch {
    return localIso;
  }
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(monthIndex: number): string {
  return MONTHS[((monthIndex % 12) + 12) % 12];
}

/** "1st", "2nd", "3rd", "11th"... */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
