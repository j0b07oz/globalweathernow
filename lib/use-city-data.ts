"use client";

import { useEffect, useState } from "react";
import { fetchForecast, fetchHistory } from "./open-meteo";
import { historyCacheKey, readCache, writeCache } from "./cache";
import type { ForecastBundle, GeoLocation, HistoryBundle } from "./types";

export interface CityData {
  forecast: ForecastBundle | null;
  history: HistoryBundle | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: CityData = {
  forecast: null,
  history: null,
  loading: false,
  error: null,
};

/**
 * Loads current conditions (always fresh) and a year of history (cache-first,
 * 24h TTL) for a location. The full year of hourly data is heavy, so it is read
 * from localStorage when available and only re-fetched once per day.
 */
export function useCityData(location: GeoLocation | null): CityData {
  const [data, setData] = useState<CityData>(EMPTY);

  useEffect(() => {
    if (!location) {
      setData(EMPTY);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;

    setData((prev) => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        const key = historyCacheKey(location);
        const cachedHistory = readCache<HistoryBundle>(key);
        const forecastPromise = fetchForecast(location, controller.signal);

        let history = cachedHistory;
        if (!history) {
          history = await fetchHistory(location, controller.signal);
          writeCache(key, history);
        }
        const forecast = await forecastPromise;

        if (!cancelled) {
          setData({ forecast, history, loading: false, error: null });
        }
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        setData({
          forecast: null,
          history: null,
          loading: false,
          error:
            (err as Error).message ||
            "Couldn't load weather data for this city.",
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [location]);

  return data;
}
