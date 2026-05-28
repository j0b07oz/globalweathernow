"use client";

import { useEffect, useState } from "react";
import { Droplets, Sunrise, Sunset, Wind } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ForecastBundle, Units } from "@/lib/types";
import { describeWeatherCode } from "@/lib/weather-codes";
import { getSunCue } from "@/lib/sun";
import {
  degToCompass,
  formatClock,
  formatTemp,
  formatTempUnit,
  formatWind,
} from "@/lib/format";

interface PanelProps {
  roleLabel: string;
  forecast: ForecastBundle;
  units: Units;
  accent?: boolean;
}

export function CurrentConditionsPanel({
  roleLabel,
  forecast,
  units,
  accent,
}: PanelProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { current, today, location } = forecast;
  const sky = describeWeatherCode(current.weatherCode, current.isDay);
  const SkyIcon = sky.icon;
  const cue = getSunCue(today.sunrise, today.sunset, location.timezone, now);

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {roleLabel}
          </p>
          <h2 className="truncate text-xl font-semibold tracking-tight">
            {location.name}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {location.label}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-medium tabular-nums">
            {formatClock(current.time)}
          </p>
          <p className="text-xs text-muted-foreground">{location.timezone}</p>
          {cue.label ? (
            <Badge variant={accent ? "strong" : "default"} className="mt-1">
              {cue.label}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <span className="temp-numeral text-7xl font-semibold sm:text-8xl">
            {formatTemp(current.temp, units)}
          </span>
          <p className="mt-1 text-sm text-muted-foreground">
            Feels like {formatTempUnit(current.apparentTemp, units)}
          </p>
        </div>
        <div className="flex flex-col items-center text-muted-foreground">
          <SkyIcon className="h-10 w-10" strokeWidth={1.5} />
          <span className="mt-1 text-sm font-medium text-foreground">
            {sky.label}
          </span>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Metric
          icon={<Droplets className="h-4 w-4" />}
          label="Dew point"
          value={formatTempUnit(current.dewPoint, units)}
        />
        <Metric
          icon={<Droplets className="h-4 w-4" />}
          label="Humidity"
          value={`${Math.round(current.humidity)}%`}
        />
        <Metric
          icon={<Wind className="h-4 w-4" />}
          label="Wind"
          value={`${formatWind(current.windSpeed, units)} ${degToCompass(
            current.windDirection,
          )}`}
        />
        <Metric
          icon={<SkyIcon className="h-4 w-4" />}
          label="Cloud cover"
          value={`${Math.round(current.cloudCover)}%`}
        />
      </dl>

      <div className="mt-auto flex items-center gap-4 border-t pt-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sunrise className="h-4 w-4" />
          {today.sunrise ? formatClock(today.sunrise) : "—"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sunset className="h-4 w-4" />
          {today.sunset ? formatClock(today.sunset) : "—"}
        </span>
      </div>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium tabular-nums">{value}</dd>
      </div>
    </div>
  );
}
