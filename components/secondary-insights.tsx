"use client";

import { CalendarClock, Flame, Snowflake, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Insights } from "@/lib/insights";
import type { DateFormatPref, Units } from "@/lib/types";
import { formatDate, formatTempUnit, ordinal } from "@/lib/format";

interface SecondaryInsightsProps {
  insights: Insights;
  homeName: string;
  comparisonName: string;
  units: Units;
  dateFormat: DateFormatPref;
}

export function SecondaryInsights({
  insights,
  homeName,
  comparisonName,
  units,
  dateFormat,
}: SecondaryInsightsProps) {
  const { warmRank, reverseDayMatch, seasonal } = insights;

  const cards: React.ReactNode[] = [];

  if (warmRank) {
    const warm = warmRank.kind === "warmest";
    cards.push(
      <Card key="rank" className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {warm ? (
            <Flame className="h-4 w-4" />
          ) : (
            <Snowflake className="h-4 w-4" />
          )}
          <p className="text-xs font-semibold uppercase tracking-widest">
            Year in context
          </p>
        </div>
        <p className="mt-3 text-lg font-medium leading-snug">
          This is the{" "}
          <span className="font-semibold text-accent">
            {ordinal(warmRank.rank)} {warm ? "warmest" : "coolest"}
          </span>{" "}
          day {homeName} has seen in the past year.
        </p>
      </Card>,
    );
  }

  if (reverseDayMatch) {
    const d = reverseDayMatch.item;
    cards.push(
      <Card key="reverse" className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-widest">
              The other direction
            </p>
          </div>
          <Badge
            variant={
              reverseDayMatch.confidence === "strong" ? "strong" : "approximate"
            }
          >
            {reverseDayMatch.confidence === "strong"
              ? "Strong"
              : "Approximate"}
          </Badge>
        </div>
        <p className="mt-3 text-lg font-medium leading-snug">
          In {comparisonName}, it last felt like {homeName} does today on{" "}
          <span className="font-semibold text-accent">
            {formatDate(d.date, dateFormat)}
          </span>
          .
        </p>
        <p className="mt-2 text-sm text-muted-foreground tabular-nums">
          High {formatTempUnit(d.tempMax, units)} · Low{" "}
          {formatTempUnit(d.tempMin, units)} · Feels{" "}
          {formatTempUnit(d.apparentTempMean, units)}
        </p>
      </Card>,
    );
  }

  if (seasonal && seasonal.monthsAway >= 2) {
    cards.push(
      <Card key="seasonal" className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-widest">
            Seasonal outlook
          </p>
        </div>
        <p className="mt-3 text-lg font-medium leading-snug">
          Based on seasonal averages, {homeName} won&apos;t feel like this again
          until roughly{" "}
          <span className="font-semibold text-accent">{seasonal.month}</span>.
        </p>
      </Card>,
    );
  }

  if (cards.length === 0) return null;

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards}</section>
  );
}
