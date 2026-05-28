"use client";

import {
  Area,
  AreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { DateFormatPref, DayPoint, Units } from "@/lib/types";
import { cToDisplay, formatDate, formatTempUnit } from "@/lib/format";

interface YearTimelineProps {
  days: DayPoint[];
  matchDate?: string;
  units: Units;
  dateFormat: DateFormatPref;
  homeName: string;
}

export function YearTimeline({
  days,
  matchDate,
  units,
  dateFormat,
  homeName,
}: YearTimelineProps) {
  if (days.length < 30) return null;

  const data = days.map((d) => ({
    date: d.date,
    value: Math.round(cToDisplay(d.apparentTempMean, units)),
    month: d.date.slice(5, 7),
  }));

  const matchPoint = matchDate
    ? data.find((d) => d.date === matchDate)
    : undefined;

  // Show roughly one tick per month.
  const seenMonths = new Set<string>();
  const ticks: string[] = [];
  for (const d of data) {
    if (!seenMonths.has(d.month)) {
      seenMonths.add(d.month);
      ticks.push(d.date);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {homeName} · past year of “feels like”
        </p>
        {matchPoint ? (
          <span className="text-xs text-accent">● matched day</span>
        ) : null}
      </div>
      <div className="mt-4 h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="feelsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--accent))"
                  stopOpacity={0.35}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--accent))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={(d: string) => formatDate(d, "US").slice(0, 3)}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              minTickGap={8}
            />
            <RechartsTooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "0.8rem",
                color: "hsl(var(--popover-foreground))",
              }}
              labelFormatter={(d: string) => formatDate(d, dateFormat)}
              formatter={(v: number) => [`${v}°${units}`, "Feels like"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--accent))"
              strokeWidth={1.5}
              fill="url(#feelsGradient)"
            />
            {matchPoint ? (
              <ReferenceDot
                x={matchPoint.date}
                y={matchPoint.value}
                r={5}
                fill="hsl(var(--accent))"
                stroke="hsl(var(--background))"
                strokeWidth={2}
                isFront
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {matchPoint ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Matched day highlighted:{" "}
          <span className="font-medium text-foreground">
            {formatDate(matchPoint.date, dateFormat)}
          </span>{" "}
          at {formatTempUnit(
            days.find((d) => d.date === matchPoint.date)!.apparentTempMean,
            units,
          )}{" "}
          felt-like.
        </p>
      ) : null}
    </Card>
  );
}
