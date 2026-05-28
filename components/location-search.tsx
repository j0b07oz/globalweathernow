"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { geocode } from "@/lib/open-meteo";
import type { GeoLocation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LocationSearchProps {
  onSelect: (location: GeoLocation) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function LocationSearch({
  onSelect,
  placeholder = "Search for a city…",
  autoFocus,
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await geocode(trimmed, controller.signal);
        setResults(res);
        setActive(0);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Couldn't reach the location service. Try again.");
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function choose(loc: GeoLocation) {
    onSelect(loc);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = results[active];
      if (sel) choose(sel);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="location-listbox"
          aria-autocomplete="list"
          className="h-11 w-full rounded-md border bg-background pl-9 pr-9 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {showDropdown ? (
        <div
          id="location-listbox"
          role="listbox"
          className="absolute z-40 mt-2 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-lg"
        >
          {error ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              {error}
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No cities found for “{query.trim()}”.
            </div>
          ) : (
            results.map((loc, i) => (
              <button
                key={`${loc.id}-${i}`}
                role="option"
                aria-selected={i === active}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(loc)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[calc(var(--radius)-4px)] px-3 py-2 text-left text-sm",
                  i === active
                    ? "bg-muted text-foreground"
                    : "text-foreground/90",
                )}
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{loc.label}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
