import { fromZonedTime } from "date-fns-tz";

export interface SunCue {
  /** Short human cue, e.g. "sunset in 22 min", "midday sun", "after dark". */
  label: string;
  isDay: boolean;
}

/**
 * Produces a sun-position cue from local sunrise/sunset wall-clock strings and
 * the current instant. The wall-clock strings come from Open-Meteo (timezone
 * already applied), so we convert them back to absolute instants in `timezone`
 * to compare against `now`.
 */
export function getSunCue(
  sunrise: string | null,
  sunset: string | null,
  timezone: string,
  now: Date = new Date(),
): SunCue {
  if (!sunrise || !sunset) {
    return { label: "", isDay: true };
  }
  let sunriseAt: Date;
  let sunsetAt: Date;
  try {
    sunriseAt = fromZonedTime(sunrise, timezone);
    sunsetAt = fromZonedTime(sunset, timezone);
  } catch {
    return { label: "", isDay: true };
  }

  const nowMs = now.getTime();
  const isDay = nowMs >= sunriseAt.getTime() && nowMs < sunsetAt.getTime();
  const minsTo = (t: Date) => Math.round((t.getTime() - nowMs) / 60000);

  const toSunrise = minsTo(sunriseAt);
  const toSunset = minsTo(sunsetAt);
  const solarNoon = new Date((sunriseAt.getTime() + sunsetAt.getTime()) / 2);
  const toNoon = minsTo(solarNoon);

  if (!isDay) {
    if (toSunrise > 0) {
      return { label: `sunrise ${describeDelta(toSunrise)}`, isDay: false };
    }
    return { label: "after dark", isDay: false };
  }

  // Daytime.
  if (toSunset <= 45 && toSunset > 0) {
    return { label: `sunset in ${describeMinutes(toSunset)}`, isDay: true };
  }
  if (toSunrise >= -45 && toSunrise <= 0) {
    return { label: "just after sunrise", isDay: true };
  }
  if (Math.abs(toNoon) <= 60) {
    return { label: "midday sun", isDay: true };
  }
  if (toNoon > 0) {
    return { label: "morning sun", isDay: true };
  }
  return { label: "afternoon sun", isDay: true };
}

function describeMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function describeDelta(mins: number): string {
  return `in ${describeMinutes(mins)}`;
}
