"use client";

import { Segmented } from "@/components/ui/segmented";
import { ThemeToggle } from "@/components/theme-toggle";
import type { CompareMode, DateFormatPref, Units } from "@/lib/types";

interface SettingsBarProps {
  units: Units;
  dateFormat: DateFormatPref;
  mode: CompareMode;
  onUnits: (u: Units) => void;
  onDateFormat: (d: DateFormatPref) => void;
  onMode: (m: CompareMode) => void;
}

export function SettingsBar({
  units,
  dateFormat,
  mode,
  onUnits,
  onDateFormat,
  onMode,
}: SettingsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented<CompareMode>
        ariaLabel="Comparison mode"
        value={mode}
        onChange={onMode}
        options={[
          { value: "both", label: "Both" },
          { value: "now", label: "Right now", title: "Same-moment, hour-level" },
          { value: "today", label: "Today", title: "Whole-day shape" },
        ]}
      />
      <div className="ml-auto flex items-center gap-3">
        <Segmented<Units>
          ariaLabel="Temperature units"
          value={units}
          onChange={onUnits}
          options={[
            { value: "F", label: "°F" },
            { value: "C", label: "°C" },
          ]}
        />
        <Segmented<DateFormatPref>
          ariaLabel="Date format"
          value={dateFormat}
          onChange={onDateFormat}
          options={[
            { value: "US", label: "M/D" },
            { value: "ISO", label: "ISO" },
            { value: "EU", label: "D/M" },
          ]}
        />
        <ThemeToggle />
      </div>
    </div>
  );
}
