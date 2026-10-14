# Spooncular

A food-discovery and recipe companion built with Expo (React Native), React Native
Paper (Material Design 3) and `lucide-react-native` icons.

Two destinations:

- **Explore** — restaurant-chain menu dishes, food videos, a daily food fact and a
  nutrition estimator.
- **Cook** — recipe search with filters, an ingredient finder, and full recipes with
  ingredients and cooking instructions.

All data comes from the Spoonacular Food API.

## Requirements

| Component | Version |
|-----------|---------|
| Expo SDK | 57.x |
| React Native | 0.86.3 |
| React | 19.2.3 |
| React Native Paper | 5.15.x |
| lucide-react-native | 1.57.x |

## Setup

```bash
npm install
cp .env.example .env      # then set the key (see below)
npm start
```

### API key

The key lives in `.env` as `EXPO_PUBLIC_SPOONACULAR_API_KEY`.

> **It is not secret.** Expo inlines `EXPO_PUBLIC_*` variables into the JavaScript
> bundle, so anyone who inspects the shipped app can extract the key. Treat it as a
> public client credential and rotate it if it is exposed. Hiding it properly would
> require a backend proxy, which this project deliberately does not add.

`.env` is gitignored. Never commit the key or paste it into source, logs or
screenshots.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Start the Expo dev server |
| `npm run ios` / `npm run android` / `npm run web` | Start on a specific platform |
| `npm test` | Run the Jest suite |
| `npm run typecheck` | `tsc --noEmit` |

## Architecture

```
App.js                     providers (Paper, Navigation, SafeArea)
theme.js                   colours, spacing, radii, typography, layout tokens
navigation/RootNavigator   two tabs, each wrapping its own stack
screens/
  ExploreScreen            menu explorer, videos, trivia, nutrition lens
  MenuItemDetailsScreen    one menu item + its nutrition
  RecipesScreen            recipe search + filters
  IngredientFinderScreen   find recipes from ingredients you have
  RecipeDetailsScreen      recipe, ingredients, method, nutrition
components/                reusable cards, image fallback, section header, states
hooks/useAsyncSection      mount-scoped async section state
services/spoonacularApi.js the only module that knows the key
utils/format.js            display formatting (durations, amounts, entities)
```

### API client

`services/spoonacularApi.js` is the single place that reads the key and builds
authenticated URLs. It provides:

- Query values encoded individually, so input cannot break out of the URL.
- A `redact()` helper so no authenticated URL reaches a log or error message.
- Typed errors: `INVALID_KEY`, `QUOTA_EXCEEDED`, `RATE_LIMIT`, `SERVER_ERROR`,
  `NETWORK`, `TIMEOUT`, `CANCELLED` — each surfaced with its own message.
- Request timeouts and abort support.
- An in-memory TTL cache with in-flight de-duplication, so a re-render or tab switch
  never re-issues a billable request.

### Endpoints used

| Purpose | Endpoint |
|---------|----------|
| Menu dishes | `GET /food/menuItems/search` (`number` clamped to the documented 1–10) |
| Menu item detail | `GET /food/menuItems/{id}` |
| Food videos | `GET /food/videos/search` |
| Food fact | `GET /food/trivia/random` |
| Nutrition estimate | `GET /recipes/guessNutrition` |
| Recipe search | `GET /recipes/complexSearch` |
| Recipes by ingredients | `GET /recipes/findByIngredients` |
| Recipe detail | `GET /recipes/{id}/information` |

### Quota behaviour

Menu items cache for 30 minutes, videos for an hour and the food fact for half a
day. Nutrition estimation is never automatic — it only runs on an explicit tap.
Each Home section owns its request and error state, so one failing endpoint never
blanks the screen. When the daily quota is exhausted (HTTP 402) the affected
section shows a clear message with a retry action and the rest of the app keeps
working.

## Notable behaviours

- **Images.** The API does not guarantee an image on every record, and the CDN can
  fail. `components/MediaImage.js` validates the URL, falls back to a branded
  panel (warm surface + Lucide `CookingPot`/`Utensils` icon) on a missing or failed
  image, and never substitutes a different dish's photo.
- **Amounts.** `formatQuantity()` renders float artefacts such as `0.33333334 cup`
  as `⅓ cup`, but only when the value is genuinely an accurate fraction match. The
  unit is echoed exactly as supplied — nothing is converted or pluralised.
- **Nutrition shapes.** `/recipes/guessNutrition` returns `{ value, unit,
  confidenceRange95Percent }` and a `carbs` key, while recipe/menu nutrition
  returns `{ amount, unit }` and `carbohydrates`. Both are accepted; the 95%
  interval is displayed when present.
- **Text hygiene.** `cleanText()` strips markup and decodes HTML entities
  (including semicolon-less forms such as `&reg`) before rendering.
- **Icons.** Lucide is the only icon library. Paper's internal icon resolver is
  mapped to Lucide in `components/paperSettings.js`, including the Searchbar clear
  button which Paper would otherwise render with its own icon set.

## Navigation

Two bottom tabs — **Explore** and **Cook** — rendered by a custom floating tab bar
(`components/TabBar.jsx` + `components/TabBarButton.jsx`) built with
`react-native-reanimated`.

- The bar floats above the content as a rounded pill, clear of the home indicator.
- On selection the icon springs to 1.4x and travels 8pt downward while its label
  fades out; the reverse happens when the tab is deselected.
- `assets/icons.js` is the single source of truth for the tab icons, so the custom
  bar and the navigator cannot drift apart.
- Screen padding reserves `FLOATING_TAB_BAR_SPACE` so no list item hides behind it.

Screenshots and a live animation trace:

```bash
npx expo export --platform web --output-dir .expo-verify-web
node serve-web.cjs & node capture-tabbar.cjs
```

## Tests

```bash
npm test
```

110 tests. `fetch` is mocked, so no quota is spent. Coverage includes URL encoding
and key redaction, HTTP-to-error mapping, caching and refresh, input
normalisation, quantity/fraction/entity formatting, both real nutrition response
shapes, Lucide export existence (a wrong icon name fails here rather than at
render time), screen behaviour for search, navigation, empty, error and
per-section-failure states, and the tab bar (routes and labels preserved, theme
colours used rather than the reference's, accessibility roles and selected state,
press/long-press wiring, and the animation constants).

### Reanimated under Jest

`react-native-reanimated` needs its native worklets module mocked. `jest.setup.js`
calls `setUpTests()`, and `package.json` maps `react-native-worklets` to the mock
shipped with that package:

```json
"moduleNameMapper": {
  "^react-native-worklets$": "<rootDir>/node_modules/react-native-worklets/lib/module/mock.js"
}
```

## Screenshots

`capture.cjs` drives the exported web build in the installed Chrome at the iPhone 15
viewport (393×852 @3x) and writes to `screenshots/mobile-preview/`:

```bash
npx expo export --platform web --output-dir .expo-verify-web
node serve-web.cjs      # serves the export on :8099
node capture.cjs
```

## Known limitations

- The API key ships inside the bundle (see above).
- The video cards open YouTube in an external player rather than embedding a
  player; this follows the YouTube terms Spoonacular's documentation points to.
- Menu-item search does not establish proximity to a specific branch, and the app
  labels those results as chain menu items rather than local restaurant listings.