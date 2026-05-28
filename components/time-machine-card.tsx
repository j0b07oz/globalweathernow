"use client";

import type { LucideIcon } from "lucide-react";
import { Sparkles, RefreshCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import type { Confidence } from "@/lib/similarity";
import { cn } from "@/lib/utils";

export interface MatchCondition {
  label: string;
  value: string;
}

interface TimeMachineCardProps {
  eyebrow: string;
  sentence: React.ReactNode;
  confidence?: Confidence;
  conditions: MatchCondition[];
  skyLabel?: string;
  SkyIcon?: LucideIcon;
  inversionNote?: string | null;
  hero?: boolean;
}

const CONFIDENCE_COPY: Record<Confidence, string> = {
  strong: "Strong match",
  approximate: "Approximate match",
  loose: "Rough match",
};

const CONFIDENCE_HELP: Record<Confidence, string> = {
  strong: "These days feel nearly identical for your home climate.",
  approximate: "A close fit, but with some noticeable differences.",
  loose: "The nearest day we found — your home rarely feels like this.",
};

export function TimeMachineCard({
  eyebrow,
  sentence,
  confidence,
  conditions,
  skyLabel,
  SkyIcon,
  inversionNote,
  hero,
}: TimeMachineCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-6 sm:p-8 animate-fade-in",
        hero &&
          "border-accent/30 bg-gradient-to-br from-card to-accent/5 shadow-md",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {hero ? (
            <Sparkles className="h-3.5 w-3.5 text-accent" />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" />
          )}
          {eyebrow}
        </p>
        {confidence ? (
          <Tooltip content={CONFIDENCE_HELP[confidence]}>
            <Badge
              variant={confidence === "strong" ? "strong" : "approximate"}
              className="cursor-help"
            >
              {CONFIDENCE_COPY[confidence]}
            </Badge>
          </Tooltip>
        ) : null}
      </div>

      <p
        className={cn(
          "mt-4 font-semibold tracking-tight",
          hero ? "text-2xl sm:text-3xl leading-snug" : "text-xl leading-snug",
        )}
      >
        {sentence}
      </p>

      {inversionNote ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <RefreshCcw className="h-4 w-4 shrink-0" />
          {inversionNote}
        </p>
      ) : null}

      {conditions.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-5">
          {SkyIcon ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <SkyIcon className="h-7 w-7" strokeWidth={1.5} />
              {skyLabel ? (
                <span className="text-sm font-medium text-foreground">
                  {skyLabel}
                </span>
              ) : null}
            </div>
          ) : null}
          {conditions.map((c) => (
            <div key={c.label}>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg font-medium tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
