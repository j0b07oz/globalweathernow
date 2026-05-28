import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Cloudy,
  Sun,
  CloudSun,
  type LucideIcon,
} from "lucide-react";

export interface SkyInfo {
  label: string;
  icon: LucideIcon;
}

/**
 * Maps a WMO weather interpretation code to a human label + icon.
 * https://open-meteo.com/en/docs (WMO Weather interpretation codes WW)
 */
export function describeWeatherCode(code: number, isDay = true): SkyInfo {
  const clearIcon = isDay ? Sun : Cloud;
  switch (code) {
    case 0:
      return { label: "Clear", icon: clearIcon };
    case 1:
      return { label: "Mainly clear", icon: isDay ? CloudSun : Cloud };
    case 2:
      return { label: "Partly cloudy", icon: CloudSun };
    case 3:
      return { label: "Overcast", icon: Cloudy };
    case 45:
    case 48:
      return { label: "Fog", icon: CloudFog };
    case 51:
    case 53:
    case 55:
      return { label: "Drizzle", icon: CloudDrizzle };
    case 56:
    case 57:
      return { label: "Freezing drizzle", icon: CloudDrizzle };
    case 61:
    case 63:
    case 65:
      return { label: "Rain", icon: CloudRain };
    case 66:
    case 67:
      return { label: "Freezing rain", icon: CloudRain };
    case 71:
    case 73:
    case 75:
      return { label: "Snow", icon: CloudSnow };
    case 77:
      return { label: "Snow grains", icon: CloudSnow };
    case 80:
    case 81:
    case 82:
      return { label: "Rain showers", icon: CloudRain };
    case 85:
    case 86:
      return { label: "Snow showers", icon: CloudSnow };
    case 95:
      return { label: "Thunderstorm", icon: CloudLightning };
    case 96:
    case 99:
      return { label: "Thunderstorm w/ hail", icon: CloudLightning };
    default:
      return { label: "Unknown", icon: Cloud };
  }
}

/**
 * Picks the most representative weather code for a day from an array of hourly
 * codes: prefers the most "significant" (highest-severity) code that occurs,
 * since a brief thunderstorm defines a day more than the clear hours around it.
 * Falls back to the modal code when nothing severe occurs.
 */
export function dominantWeatherCode(codes: number[]): number {
  if (codes.length === 0) return 0;
  const severe = codes.filter((c) => c >= 45);
  if (severe.length >= Math.max(2, codes.length * 0.15)) {
    // Return the highest severe code that appears enough to matter.
    return Math.max(...severe);
  }
  // Modal (most frequent) code.
  const counts = new Map<number, number>();
  for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best = codes[0];
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}
