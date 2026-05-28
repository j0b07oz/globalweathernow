"use client";

import { useEffect, useMemo, useState } from "react";
import { Crosshair, Loader2, MapPin, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LocationSearch } from "@/components/location-search";
import { SettingsBar } from "@/components/settings-bar";
import { CurrentConditionsPanel } from "@/components/current-conditions-panel";
import { TimeMachineCard, type MatchCondition } from "@/components/time-machine-card";
import { SecondaryInsights } from "@/components/secondary-insights";
import { YearTimeline } from "@/components/year-timeline";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useCityData } from "@/lib/use-city-data";
import { buildInsights } from "@/lib/insights";
import { currentToHourPoint } from "@/lib/open-meteo";
import { describeWeatherCode } from "@/lib/weather-codes";
import {
  formatDate,
  formatTempUnit,
  monthName,
} from "@/lib/format";
import type {
  CompareMode,
  DateFormatPref,
  DayPoint,
  GeoLocation,
  Units,
} from "@/lib/types";

interface Settings {
  units: Units;
  dateFormat: DateFormatPref;
  mode: CompareMode;
}

const DEFAULT_SETTINGS: Settings = {
  units: "F",
  dateFormat: "US",
  mode: "both",
};

type GeoState = "idle" | "prompting" | "denied" | "unsupported";

function buildHomeFromCoords(lat: number, lon: number): GeoLocation {
  let timezone = "auto";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // keep "auto"
  }
  return {
    id: -1,
    name: "My location",
    label: "Current location",
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lon.toFixed(4)),
    timezone,
  };
}

function partOfDay(hour: number): string {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const Accent = ({ children }: { children: React.ReactNode }) => (
  <span className="font-semibold text-accent">{children}</span>
);

export function WeatherTimeMachine() {
  const [home, setHome, homeHydrated] = useLocalStorage<GeoLocation | null>(
    "wtm:home",
    null,
  );
  const [comparison, setComparison] = useLocalStorage<GeoLocation | null>(
    "wtm:comparison",
    null,
  );
  const [settings, setSettings] = useLocalStorage<Settings>(
    "wtm:settings",
    DEFAULT_SETTINGS,
  );
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [editingHome, setEditingHome] = useState(false);

  const homeData = useCityData(home);
  const comparisonData = useCityData(comparison);

  const requestGeolocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoState("unsupported");
      return;
    }
    setGeoState("prompting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHome(
          buildHomeFromCoords(pos.coords.latitude, pos.coords.longitude),
        );
        setEditingHome(false);
        setGeoState("idle");
      },
      () => setGeoState("denied"),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };

  // Default to browser geolocation on first visit only.
  useEffect(() => {
    if (!homeHydrated || home || geoState !== "idle") return;
    requestGeolocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeHydrated, home]);

  const insights = useMemo(() => {
    if (!homeData.forecast || !homeData.history || !comparisonData.forecast) {
      return null;
    }
    return buildInsights(
      homeData.forecast,
      homeData.history,
      comparisonData.forecast,
      comparisonData.history,
      currentToHourPoint(comparisonData.forecast.current),
    );
  }, [
    homeData.forecast,
    homeData.history,
    comparisonData.forecast,
    comparisonData.history,
  ]);

  const { units, dateFormat, mode } = settings;
  const homeName = homeData.forecast?.location.name ?? home?.name ?? "home";
  const comparisonName =
    comparisonData.forecast?.location.name ?? comparison?.name ?? "there";

  function selectHome(loc: GeoLocation) {
    setHome(loc);
    setEditingHome(false);
    setGeoState("idle");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Weather Time Machine
        </p>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Translate another city&apos;s weather into a feeling you know.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Find the last time your home town felt the way somewhere else feels
          right now.
        </p>
      </header>

      {!homeHydrated ? (
        <LoadingBlock label="Loading your settings…" />
      ) : !home ? (
        <Onboarding
          geoState={geoState}
          onUseLocation={requestGeolocation}
          onSelect={selectHome}
        />
      ) : (
        <div className="space-y-6">
          {/* Location controls */}
          <Card className="p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Home
                </p>
                {editingHome ? (
                  <div className="space-y-2">
                    <LocationSearch onSelect={selectHome} autoFocus />
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={requestGeolocation}
                      >
                        <Crosshair className="h-4 w-4" /> Use my location
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingHome(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingHome(true)}
                    className="group flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left hover:bg-muted"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">
                        {homeData.forecast?.location.label ?? home.label}
                      </span>
                    </span>
                    <Pencil className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  </button>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Compare with
                </p>
                {comparison ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-accent" />
                      <span className="truncate font-medium">
                        {comparisonData.forecast?.location.label ??
                          comparison.label}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setComparison(null)}
                      aria-label="Clear comparison city"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <LocationSearch
                    onSelect={setComparison}
                    placeholder="e.g. London, Tokyo, Sydney…"
                  />
                )}
              </div>
            </div>
          </Card>

          <SettingsBar
            units={units}
            dateFormat={dateFormat}
            mode={mode}
            onUnits={(u) => setSettings((s) => ({ ...s, units: u }))}
            onDateFormat={(d) => setSettings((s) => ({ ...s, dateFormat: d }))}
            onMode={(m) => setSettings((s) => ({ ...s, mode: m }))}
          />

          {/* Current conditions */}
          <section className="grid gap-4 md:grid-cols-2">
            {homeData.error ? (
              <ErrorCard message={homeData.error} />
            ) : homeData.forecast ? (
              <CurrentConditionsPanel
                roleLabel="Home"
                forecast={homeData.forecast}
                units={units}
              />
            ) : (
              <PanelSkeleton />
            )}

            {!comparison ? (
              <Card className="flex min-h-[280px] flex-col items-center justify-center p-6 text-center">
                <MapPin className="h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">Add a city to compare</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search above for where your call partner is, or anywhere
                  you&apos;re curious about.
                </p>
              </Card>
            ) : comparisonData.error ? (
              <ErrorCard message={comparisonData.error} />
            ) : comparisonData.forecast ? (
              <CurrentConditionsPanel
                roleLabel="Comparison"
                forecast={comparisonData.forecast}
                units={units}
                accent
              />
            ) : (
              <PanelSkeleton />
            )}
          </section>

          {/* Time Machine */}
          {comparison && !comparisonData.error ? (
            insights && comparisonData.forecast ? (
              <TimeMachineSection
                insights={insights}
                mode={mode}
                units={units}
                dateFormat={dateFormat}
                homeName={homeName}
                comparisonName={comparisonName}
                comparisonHour={comparisonData.forecast.current.time}
                homeDays={homeData.history?.days ?? []}
              />
            ) : (
              <LoadingBlock label="Searching a year of your home weather…" />
            )
          ) : null}
        </div>
      )}

      <footer className="mt-12 border-t pt-6 text-center text-xs text-muted-foreground">
        Weather data by{" "}
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Open-Meteo
        </a>
        . Matches compare felt conditions against your home climate. No account,
        no tracking — everything stays in your browser.
      </footer>
    </main>
  );
}

function TimeMachineSection({
  insights,
  mode,
  units,
  dateFormat,
  homeName,
  comparisonName,
  comparisonHour,
  homeDays,
}: {
  insights: NonNullable<ReturnType<typeof buildInsights>>;
  mode: CompareMode;
  units: Units;
  dateFormat: DateFormatPref;
  homeName: string;
  comparisonName: string;
  comparisonHour: string;
  homeDays: DayPoint[];
}) {
  const showDay = mode === "both" || mode === "today";
  const showHour = mode === "both" || mode === "now";

  const dayCard = (() => {
    const m = insights.dayMatch;
    if (!m) return null;
    const d = m.item;
    const sky = describeWeatherCode(d.weatherCode, true);
    const conditions: MatchCondition[] = [
      { label: "High", value: formatTempUnit(d.tempMax, units) },
      { label: "Low", value: formatTempUnit(d.tempMin, units) },
      { label: "Felt like", value: formatTempUnit(d.apparentTempMean, units) },
    ];
    const inversionNote =
      insights.oppositeHemisphere && insights.dayInversion
        ? `Seasonal inversion: it's the opposite season in ${comparisonName}, so the closest match here lands about half a year away.`
        : null;
    return (
      <TimeMachineCard
        key="day"
        hero={mode !== "now"}
        eyebrow="Time Machine · Today overall"
        confidence={m.confidence}
        skyLabel={sky.label}
        SkyIcon={sky.icon}
        conditions={conditions}
        inversionNote={inversionNote}
        sentence={
          <>
            In {homeName}, the last time it felt like {comparisonName} does
            today was <Accent>{formatDate(d.date, dateFormat)}</Accent>.
          </>
        }
      />
    );
  })();

  const hourCard = (() => {
    const m = insights.hourMatch;
    if (!m) return null;
    const h = m.item;
    const sky = describeWeatherCode(h.weatherCode, true);
    const compPart = partOfDay(Number(comparisonHour.slice(11, 13)));
    const matchMonth = monthName(Number(h.time.slice(5, 7)) - 1);
    const matchPart = partOfDay(h.hour);
    const conditions: MatchCondition[] = [
      { label: "Temp", value: formatTempUnit(h.temp, units) },
      { label: "Felt like", value: formatTempUnit(h.apparentTemp, units) },
      { label: "Dew point", value: formatTempUnit(h.dewPoint, units) },
      { label: "Humidity", value: `${Math.round(h.humidity)}%` },
      { label: "Closest day", value: formatDate(h.time.slice(0, 10), dateFormat) },
    ];
    return (
      <TimeMachineCard
        key="hour"
        hero={mode === "now"}
        eyebrow="Time Machine · Right now"
        confidence={m.confidence}
        skyLabel={sky.label}
        SkyIcon={sky.icon}
        conditions={conditions}
        sentence={
          <>
            It&apos;s {compPart} in {comparisonName} right now — about how{" "}
            {homeName} feels on a <Accent>{matchMonth}</Accent> {matchPart}.
          </>
        }
      />
    );
  })();

  const highlightDate =
    mode === "now"
      ? insights.hourMatch?.item.time.slice(0, 10)
      : insights.dayMatch?.item.date;

  return (
    <div className="space-y-5">
      {showDay ? dayCard : null}
      {showHour ? hourCard : null}

      {homeDays.length >= 30 ? (
        <YearTimeline
          days={homeDays}
          matchDate={highlightDate}
          units={units}
          dateFormat={dateFormat}
          homeName={homeName}
        />
      ) : null}

      <SecondaryInsights
        insights={insights}
        homeName={homeName}
        comparisonName={comparisonName}
        units={units}
        dateFormat={dateFormat}
      />
    </div>
  );
}

function Onboarding({
  geoState,
  onUseLocation,
  onSelect,
}: {
  geoState: GeoState;
  onUseLocation: () => void;
  onSelect: (loc: GeoLocation) => void;
}) {
  return (
    <Card className="mx-auto max-w-xl p-6 sm:p-8 animate-fade-in">
      <h2 className="text-xl font-semibold">Set your home city</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This is the climate you&apos;ll measure everywhere else against — the
        weather your body already understands.
      </p>

      <div className="mt-5">
        <LocationSearch onSelect={onSelect} autoFocus />
      </div>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={onUseLocation}
        disabled={geoState === "prompting"}
      >
        {geoState === "prompting" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Crosshair className="h-4 w-4" />
        )}
        Use my current location
      </Button>

      {geoState === "denied" ? (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Location access was denied — no problem, just search for your city
          above.
        </p>
      ) : null}
      {geoState === "unsupported" ? (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Your browser doesn&apos;t support location — search for your city
          above.
        </p>
      ) : null}
    </Card>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border bg-card p-8 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <Card className="min-h-[280px] p-6">
      <div className="shimmer h-4 w-24 rounded" />
      <div className="shimmer mt-3 h-6 w-40 rounded" />
      <div className="shimmer mt-6 h-20 w-32 rounded" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="shimmer h-10 rounded" />
        <div className="shimmer h-10 rounded" />
        <div className="shimmer h-10 rounded" />
        <div className="shimmer h-10 rounded" />
      </div>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="flex min-h-[280px] flex-col items-center justify-center p-6 text-center">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{message}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => window.location.reload()}
      >
        Try again
      </Button>
    </Card>
  );
}
