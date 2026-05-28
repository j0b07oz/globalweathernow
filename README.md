# Weather Time Machine

Translate another city's weather into a feeling you already know.

Most weather apps tell you it's 79°F and sunny in London. That number means
little until you can map it onto your own lived climate. **Weather Time
Machine** answers a more human question:

> *"The last time my home town felt the way London feels right now was March 23."*

It's built for the moment on a video call when someone in another time zone
says "it's gorgeous here" and you want to *viscerally* understand what that
means — "oh, like an early-April afternoon at home."

## How it works

For any two cities, the app pulls a full year of the **home** city's hourly
history and expresses the **comparison** city's current weather in terms of
your home climate's own distribution (a z-score normalization). It then finds
the closest historical match two ways:

- **Today overall** — compares full-day shape (daily high/low, mean apparent
  temp, mean dew point, dominant sky) to find the last day at home with that
  shape. Robust and satisfying: *"the last day Canton had that shape was
  March 23."*
- **Right now** — compares the comparison city's current hour against your
  home's history *at the same hour-of-day (±2 hours)*, so "an evening in
  London" matches against evenings at home, not noon. Powers the embodied
  *"feels like a Canton November evening"* readout.

Because matching is relative to your home climate, **southern-hemisphere
comparisons naturally surface seasonal inversion** — the match date lands about
half a year away, and the UI calls that out explicitly.

### The similarity model

A weighted Euclidean distance over z-score-normalized features. Each feature's
contribution is clamped to ±6σ so a near-constant feature (e.g. a desert's
zero annual precipitation vs. a rainy city) can't blow up the distance and
swamp the temperature signal.

| Hour-level weights |      | Day-level weights   |      |
| ------------------ | ---- | ------------------- | ---- |
| apparent temp      | 0.40 | apparent temp (mean)| 0.30 |
| dew point          | 0.25 | daily high          | 0.15 |
| relative humidity  | 0.10 | daily low           | 0.15 |
| wind speed         | 0.10 | dew point (mean)    | 0.15 |
| cloud cover        | 0.10 | wind speed (mean)   | 0.08 |
| precipitation      | 0.05 | cloud cover (mean)  | 0.07 |
|                    |      | humidity (mean)     | 0.05 |
|                    |      | precipitation (sum) | 0.05 |

The resulting distance maps to a confidence indicator: **Strong**,
**Approximate**, or **Rough** match.

## Features

- **Side-by-side current conditions** — temperature, feels-like, dew point,
  humidity, wind, sky, sunrise/sunset, each city's local time and a live
  sun-position cue ("sunset in 22 min", "midday sun").
- **Hero Time Machine cards** for both modes, with confidence badges and a
  seasonal-inversion callout when relevant.
- **Secondary insights** (shown only when the data supports them):
  - "This is the *Nth* warmest/coolest day [home] has seen in the past year."
  - "In [comparison], it last felt like [home] does today on [date]."
  - "Based on seasonal averages, [home] won't feel like this again until
    roughly [month]."
- **Year-of-feels-like sparkline** with the matched day highlighted.
- **Geolocation** default for your home city, with a clean
  search-for-your-city fallback if location is denied or unsupported.
- **Persistent** home/comparison/settings via `localStorage`; °F/°C, date
  format, and comparison-mode toggles.
- **Dark mode**, mobile-first responsive, editorial styling.
- No accounts, no tracking — everything stays in your browser.

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) with shadcn-style components
- [date-fns](https://date-fns.org/) / [date-fns-tz](https://github.com/marnusw/date-fns-tz) for timezone-aware math
- [Recharts](https://recharts.org/) for the timeline sparkline
- [Vitest](https://vitest.dev/) for unit tests
- Data from [Open-Meteo](https://open-meteo.com/) — free, no API key

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build
npm run start        # serve the production build
npm run test         # run the unit tests
npm run test:watch   # watch mode
npm run lint         # eslint
```

## Data & caching

All requests use Open-Meteo with `timezone=auto`, so timestamps come back in
each city's local wall-clock time; the IANA timezone string is stored alongside
the data for client-side math.

Weather is stored canonically in **metric** and converted to your preferred
units at render time — so flipping °F/°C is instant and never re-fetches a year
of history. A city's 365-day history is cached in `localStorage` with a 24-hour
TTL (keyed by rounded coordinates + date), and pruned automatically if storage
fills up.

All API calls run client-side from the browser (Open-Meteo supports CORS), so
there is no server component or API key to manage.

## Project structure

```
app/                     Next.js App Router (layout, page, global styles)
components/              UI — panels, Time Machine cards, search, settings
  ui/                    Primitives (card, button, input, badge, segmented…)
lib/
  open-meteo.ts          API client: geocode, forecast, archive
  similarity.ts          Pure z-score matching engine (+ similarity.test.ts)
  insights.ts            Secondary-insight logic (+ insights.test.ts)
  sun.ts                 Sun-position cues
  format.ts              Unit/date/time formatting
  cache.ts               localStorage TTL cache
  use-city-data.ts       Data-loading hook (cache-first history)
  use-local-storage.ts   Persisted state hook
```

## Tests

The matching engine and insight logic are pure and unit-tested (19 tests),
covering exact same-city matches, northern-hemisphere summer matching,
southern-hemisphere seasonal inversion, hour-of-day windowing, and
degenerate-variance edge cases.

```bash
npm run test
```

## Deployment

Deploys to [Vercel](https://vercel.com/) with zero configuration — import the
repository and Vercel auto-detects Next.js. No environment variables are
required.

## Acknowledgements

Weather and geocoding data by [Open-Meteo](https://open-meteo.com/), free for
non-commercial use.
