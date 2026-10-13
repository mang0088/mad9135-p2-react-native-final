# mad9135-p2-react-native-final

An Expo (React Native) app for finding nearby restaurants and searching recipes.

- **Restaurants** — powered by Geoapify (Forward Geocoding + Places), proxied by a
  small local Node/Express backend so the API key never ships in the app.
- **Recipes** — still powered by Spoonacular (unchanged).

## Architecture

```
┌────────────────────┐        HTTP         ┌─────────────────────┐        HTTPS        ┌──────────────┐
│  Expo app          │  /api/restaurants   │  Node/Express       │  /v1/geocode/search │  Geoapify    │
│  (screens/,        │ ──────────────────► │  backend (server/)  │  /v2/places         │              │
│   services/)       │ ◄────────────────── │  holds the API key  │ ◄────────────────── │              │
└────────────────────┘   normalized JSON   └─────────────────────┘                     └──────────────┘
        │                                            │
        └──────────────► api.spoonacular.com ◄───────┘  (recipes only, unchanged)
```

The mobile app **never** contacts Geoapify and never holds the key. Verified: the
production bundle contains zero occurrences of `GEOAPIFY_API_KEY`,
`api.geoapify.com` or `geoapify`.

## Requirements

| Component | Version |
|-----------|---------|
| Expo SDK | 57.0.x (installed 57.0.28) |
| React Native | 0.86.3 |
| React | 19.2.3 |
| Node.js | 18+ (verified on 26.8.1) |
| Navigation | React Navigation 7.x |
| Backend | Express 5 + Node's built-in `fetch` |

## Setup

```bash
npm install

# 1. Create the server environment file and add your real key
cp .env.example .env
# then edit .env and set:
#   GEOAPIFY_API_KEY=your_actual_key
```

`.env` is gitignored and must never be committed.

### Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `GEOAPIFY_API_KEY` | `server/.env` (server only) | Geoapify credential. **Never** prefix with `EXPO_PUBLIC_`. |
| `PORT` | `.env` | Backend port (default `3001`). |
| `HOST` | `.env` | Bind address (default `0.0.0.0` so a phone can reach it). |
| `EXPO_PUBLIC_API_BASE_URL` | app environment | Optional override for the backend URL (not secret). |

## Running

Start the backend and the app in **two terminals**:

```bash
npm run server    # terminal 1 — backend on http://0.0.0.0:3001
npm start         # terminal 2 — Expo dev server
```

The app resolves the backend automatically:

1. `EXPO_PUBLIC_API_BASE_URL` if set, else
2. the Expo dev server's host with port `3001` (so a physical device on the same
   Wi‑Fi reaches your machine with no configuration), else
3. `http://localhost:3001`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run server` | Start the restaurant backend |
| `npm start` / `npm run android` / `npm run ios` / `npm run web` | Start Expo |
| `npm test` | Run all Jest tests (app + backend) |
| `npm run test:app` | App tests only |
| `npm run test:server` | Backend tests only |
| `npm run typecheck` | `tsc --noEmit` |

## Backend API

| Route | Description |
|-------|-------------|
| `GET /health` | Liveness probe → `{ "ok": true }` |
| `GET /api/geocode?text=…&limit=5` | Candidate matches for a place name/postcode |
| `GET /api/restaurants?location=…&radius=5000&limit=20` | Restaurants near a geocoded place |
| `GET /api/restaurants?lat=…&lon=…&locationLabel=…` | Restaurants near explicit coordinates (skips geocoding) |
| `GET /api/place-details?id=…` | Full record for one place (opening hours, website, phone, …) |

Geoapify endpoints used (server-side only):

- `https://api.geoapify.com/v1/geocode/search` — `text`, `format=json`, `limit`, `apiKey`
- `https://api.geoapify.com/v2/places` — `categories=catering.restaurant`,
  `filter=circle:LON,LAT,RADIUS`, `bias=proximity:LON,LAT`, `limit`, `lang=en`, `apiKey`
- `https://api.geoapify.com/v2/place-details` — `id`, `features=details`, `lang=en`, `apiKey`

**Coordinate order:** Geoapify spatial parameters are **longitude first**. For
Norwich (`lat 52.6309`, `lon 1.2974`) the filter is `circle:1.2974,52.6309,5000`.

### Response mapping — restaurant fields

Geoapify is OpenStreetMap-backed, so a field is only present when a mapper has
tagged it. Every field below exists in the JSON response; the ones without a
Geoapify source are `null` and are hidden by the UI rather than invented.

**`GET /api/restaurants` → `restaurants[]` (list)**

| Field | Geoapify source | Fallback |
|-------|-----------------|----------|
| `placeId` | `properties.place_id` | `null` (dedupe falls back to name+coords) |
| `name` | `properties.name` | `"Unnamed place"` |
| `address` | `properties.formatted` | `"Address unavailable"` |
| `lat` / `lon` | `properties.lat` / `properties.lon` | `geometry.coordinates[1]/[0]` |
| `categories` | `properties.categories` | `[]` (shown as e.g. "British") |
| `distance` | `properties.distance` (m) | `null` (hidden) |
| `phone` | `properties.phone` / `properties.contact.phone` | `null` (hidden) |
| `hours` | `properties.opening_hours` | `null` (hidden) |
| `website` | `properties.website` | `null` (hidden) |
| `cuisine` | `properties.cuisine` | `null` (hidden) |
| `photo` | **not offered by Geoapify** | always `null` — bundled placeholder image |
| `rating` | **not offered by Geoapify** | always `null` — hidden |
| `source` | constant | `"geoapify"` |

**`GET /api/place-details` → `place` (full record)**

| Field | Geoapify source |
|-------|-----------------|
| `placeId`, `name`, `address`, `lat`, `lon`, `categories`, `distance` | as above |
| `openingHours` | `properties.opening_hours` (string or `{ text }`) |
| `website` | `properties.website` |
| `phone` / `email` | `properties.phone` / `properties.contact` |
| `cuisine` | `properties.cuisine` |
| `wheelchair` | `properties.wheelchair` |
| `capacity` | `properties.capacity` |
| `description` | `properties.description` |
| `addressLine1`, `addressLine2`, `street`, `housenumber`, `city`, `state`, `county`, `postcode`, `country` | the matching `properties.*` address parts |
| `datasource` | `properties.datasource` → `{ source, attribution }` (shown in the modal) |
| `photo`, `menu`, `rating`, `reviews` | **not offered by Geoapify** — always `null`, and the modal says so |

Deduplication uses `place_id`, falling back to `name|lat|lon`. Features without
usable coordinates are skipped. Results are sorted by distance when available.
Confirming the shape: Geoapify separates discovery (`/v2/places`) from detail
lookups (`/v2/place-details`), which is why the app issues a second, per-place
request when the user opens a restaurant.

### Errors

Structured, secret-free failures: `INVALID_QUERY` (400),
`LOCATION_NOT_FOUND` (404), `PLACE_NOT_FOUND` (404 for an unknown place id),
`UPSTREAM_AUTH` (502), `UPSTREAM_ERROR` (502), `UPSTREAM_MALFORMED` (502),
`UPSTREAM_TIMEOUT` (504), `UPSTREAM_RATE_LIMIT` (503, includes `retryAfter`),
`CONFIG_MISSING_KEY` (503). Logs tag the failing stage (`geocoding`, `places` or
`place-details`). Request URLs are never logged because they carry the key.
Results are cached in memory (geocoding 10 min, places 5 min, place details
30 min) and are **never retried automatically**.

## Why the restaurant data source changed

The Spoonacular restaurant endpoint (`/food/restaurants/search`) returned
`{ "restaurants": [] }` for every location tested, so the Home screen could never
show results. Restaurant retrieval now uses Geoapify; Spoonacular is kept for
recipes only.

## Tests

```bash
npm test
```

84 tests: 60 backend + 24 app. The suite mocks `fetch`, so the full
request → validate → normalize → render pipeline is exercised without spending
API credits.

Coverage includes: place-name and postcode geocoding, longitude-before-latitude
ordering, radius handling, the `catering.restaurant` category, FeatureCollection
parsing, optional-field extraction (opening hours, website, phone, email,
cuisine, wheelchair, capacity, attribution), `opening_hours` as both a string
and an object, place-details URL/parsing/caching, unknown place ids,
missing-optional-property safety, unknown locations not triggering a Places
request, empty results without fake fallbacks, upstream
timeouts/auth/rate-limits/malformed responses, the details modal showing real
fields and stating that photos/menus are unavailable, and that recipe screens
and tab navigation still work.

## Manual verification

```bash
cp .env.example .env      # add your GEOAPIFY_API_KEY
npm install
npm run server            # terminal 1
npm start                 # terminal 2
```

1. Run `curl http://localhost:3001/health` → `{"ok":true}`.
2. In the app, open the **Home** tab, type `Norwich` (or a postcode such as
   `NR30 1AB`) and tap **Submit**.
3. Confirmed restaurants appear with real names, addresses, distance and
   category. If several places match, a "Pick another match" row lets you choose.
4. Tap **Details** on a card to load the full field list for that place
   (opening hours, website, phone, cuisine, access, capacity, attribution).
5. An unknown place shows a clear message and never queries Places.
6. The **Recipes** tab still searches Spoonacular and opens ingredients.

## Known limitations

- Photos, menus, ratings and reviews are not available from Geoapify
  (OpenStreetMap has no such data), so no image, menu or rating is ever shown —
  the list uses a bundled placeholder image and the details modal states that
  photos and menus are unavailable.
- Opening hours, website and phone exist only when the underlying OpenStreetMap
  place has those tags, so many restaurants show "Not available for this place".
- `EXPO_PUBLIC_API_BASE_URL` may be needed on unusual network setups (e.g. a
  device that cannot reach the Expo host on port 3001).
- The Spoonacular key used by the recipe screens is still hardcoded in
  `screens/ListScreen.js` and `screens/Detail.js` (pre-existing coursework code).
- iOS builds require macOS/Xcode and were not run here.

## License

Private coursework project.
