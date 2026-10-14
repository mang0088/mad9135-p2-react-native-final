/**
 * Spoonacular API client.
 *
 * The only module in the app that knows the API key or how an authenticated
 * Spoonacular URL is built. Screens call these helpers and receive plain data.
 *
 * Security note: this is a client-side app, so the key ships inside the JS
 * bundle and is extractable by anyone who inspects it. Expo only exposes
 * environment variables to the client bundle via the EXPO_PUBLIC_ prefix, so
 * there is no way to keep it secret without introducing a backend proxy (which
 * this project deliberately does not). Treat the key as a public client
 * credential and rotate it if it is exposed.
 */

const BASE_URL = 'https://api.spoonacular.com';

/** Read from Expo's public env configuration. Never hard-coded here. */
export function getApiKey() {
  const key = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY;
  return typeof key === 'string' && key.trim() !== '' ? key.trim() : null;
}

export function hasApiKey() {
  return getApiKey() !== null;
}

/** Causes where trying again later is a sensible user action. */
const RETRYABLE_CODES = new Set([
  'RATE_LIMIT',
  'QUOTA_EXCEEDED',
  'SERVER_ERROR',
  'NETWORK',
  'TIMEOUT',
]);

/** Structured failure so screens can branch on cause without parsing strings. */
export class SpoonacularError extends Error {
  constructor(message, { code = 'UNKNOWN', status = 0, retryAfter = null } = {}) {
    super(message);
    this.name = 'SpoonacularError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
    // An own property (not a getter) so it survives serialisation and
    // object-matching in tests.
    this.retryable = RETRYABLE_CODES.has(code);
  }
}

/**
 * Builds an endpoint path with encoded query parameters.
 * Values are encoded individually, so a dish name can never break out of the
 * query string.
 */
export function buildUrl(path, params = {}) {
  const pairs = Object.keys(params)
    .filter((key) => {
      const value = params[key];
      return value !== undefined && value !== null && value !== '';
    })
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`
    );

  const query = pairs.length > 0 ? `?${pairs.join('&')}` : '';
  return `${BASE_URL}${path}${query}`;
}

/**
 * Strips the apiKey from a URL so it is safe to put in an error message or log.
 * Anything logged must go through here.
 */
export function redact(url) {
  return String(url).replace(/([?&]apiKey=)[^&]*/gi, '$1[redacted]');
}

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Performs an authenticated GET and parses the JSON body.
 *
 * Maps transport and HTTP failures onto typed errors:
 *   401/403 -> INVALID_KEY   402 -> QUOTA_EXCEEDED
 *   429     -> RATE_LIMIT    5xx  -> SERVER_ERROR
 *   abort   -> TIMEOUT       offline -> NETWORK
 */
async function request(path, params = {}, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new SpoonacularError(
      'Spoonacular API key is not configured. Set EXPO_PUBLIC_SPOONACULAR_API_KEY in .env.',
      { code: 'NO_API_KEY' }
    );
  }

  const url = buildUrl(path, { ...params, apiKey });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort);
  }

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')) {
      // A caller-driven abort is a cancellation, not a timeout.
      if (signal && signal.aborted) {
        throw new SpoonacularError('Request cancelled.', { code: 'CANCELLED' });
      }
      throw new SpoonacularError('The request timed out. Please try again.', {
        code: 'TIMEOUT',
      });
    }
    throw new SpoonacularError(
      'Could not reach Spoonacular. Check your connection and try again.',
      { code: 'NETWORK' }
    );
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', forwardAbort);
  }

  const status = Number(response && response.status);

  if (status === 401 || status === 403) {
    throw new SpoonacularError(
      'The Spoonacular API key was rejected. Check your key and quota.',
      { code: 'INVALID_KEY', status }
    );
  }
  if (status === 402) {
    throw new SpoonacularError(
      'Your daily Spoonacular quota has been used up. Try again tomorrow.',
      { code: 'QUOTA_EXCEEDED', status }
    );
  }
  if (status === 429) {
    const retryAfter =
      response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('retry-after')
        : null;
    throw new SpoonacularError(
      'Too many requests. Please wait a moment and try again.',
      { code: 'RATE_LIMIT', status, retryAfter }
    );
  }
  if (status >= 500) {
    throw new SpoonacularError(
      'Spoonacular is having trouble right now. Please try again later.',
      { code: 'SERVER_ERROR', status }
    );
  }
  if (!response.ok) {
    throw new SpoonacularError(
      `Spoonacular returned an unexpected response (${status}).`,
      { code: 'HTTP_ERROR', status }
    );
  }

  try {
    return await response.json();
  } catch (err) {
    throw new SpoonacularError('Spoonacular returned malformed data.', {
      code: 'MALFORMED',
      status,
    });
  }
}

/* ------------------------------------------------------------------ */
/* In-memory cache                                                     */
/* ------------------------------------------------------------------ */

const cache = new Map();

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function writeCache(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Runs `loader`, returning a cached value when one is still fresh.
 *
 * `force` bypasses (and refreshes) the cache, which is what explicit user
 * refresh actions use. Deduplicates concurrent calls for the same key so a
 * re-render cannot fire two identical billable requests.
 */
const inFlight = new Map();

export async function cachedRequest(cacheKey, loader, { ttlMs = 0, force = false } = {}) {
  if (!force) {
    const hit = readCache(cacheKey);
    if (hit !== undefined) return hit;
  }

  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const promise = (async () => {
    try {
      const value = await loader();
      if (ttlMs > 0) writeCache(cacheKey, value, ttlMs);
      return value;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}

export function clearCache(prefix = null) {
  if (prefix === null) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

// Menu items are cached for 30 minutes; they change rarely.
const MENU_TTL = 30 * 60 * 1000;
const VIDEO_TTL = 60 * 60 * 1000;
// A "fact of the day" should stay stable across the day.
const TRIVIA_TTL = 12 * 60 * 60 * 1000;
const RECIPE_TTL = 60 * 60 * 1000;
const DETAIL_TTL = 24 * 60 * 60 * 1000;

/** Clamps `number` to the documented 1-10 range for menu-item search. */
function menuNumber(number) {
  const n = Number(number);
  if (!Number.isFinite(n)) return 6;
  return Math.min(10, Math.max(1, Math.round(n)));
}

export async function searchMenuItems(query, { number = 6, signal } = {}) {
  const term = String(query || '').trim();
  if (term === '') {
    throw new SpoonacularError('Enter a dish name to search menu items.', {
      code: 'INVALID_INPUT',
    });
  }

  const cacheKey = `menu:${term.toLowerCase()}:${menuNumber(number)}`;

  return cachedRequest(
    cacheKey,
    () =>
      request(
        '/food/menuItems/search',
        { query: term, number: menuNumber(number) },
        { signal }
      ).then((data) => ({
        menuItems: Array.isArray(data.menuItems) ? data.menuItems : [],
        total: Number.isFinite(data.total) ? data.total : 0,
      })),
    { ttlMs: MENU_TTL }
  );
}

export async function getMenuItemDetails(id, { signal } = {}) {
  if (id === undefined || id === null || id === '') {
    throw new SpoonacularError('Missing menu item id.', { code: 'INVALID_INPUT' });
  }

  const cacheKey = `menuItem:${id}`;

  return cachedRequest(
    cacheKey,
    () => request(`/food/menuItems/${encodeURIComponent(id)}`, {}, { signal }),
    { ttlMs: DETAIL_TTL }
  );
}

export async function searchFoodVideos(query = '', { number = 6, signal } = {}) {
  const term = String(query || '').trim();
  const cacheKey = `videos:${term.toLowerCase()}:${number}`;

  return cachedRequest(
    cacheKey,
    () =>
      request(
        '/food/videos/search',
        { query: term || 'food', number: Math.min(20, Math.max(1, number)) },
        { signal }
      ).then((data) => ({
        videos: Array.isArray(data.videos) ? data.videos : [],
        total: Number.isFinite(data.total) ? data.total : 0,
      })),
    { ttlMs: VIDEO_TTL }
  );
}

/**
 * Random food trivia. The result is cached for the day so the "fact of the
 * day" card does not change on every render or tab switch; `force` powers the
 * explicit refresh action.
 */
export async function getFoodTrivia({ force = false, signal } = {}) {
  return cachedRequest(
    'trivia:daily',
    () =>
      request('/food/trivia/random', {}, { signal }).then((data) =>
        typeof data.text === 'string' && data.text.trim() !== ''
          ? { text: data.text.trim(), id: data.id ?? null }
          : null
      ),
    { ttlMs: TRIVIA_TTL, force }
  );
}

/**
 * Estimated nutrition for a dish name.
 * Explicit user action only - never called automatically while typing.
 */
export async function guessNutrition(title, { signal } = {}) {
  const term = String(title || '').trim();
  if (term === '') {
    throw new SpoonacularError('Enter a dish name to estimate nutrition.', {
      code: 'INVALID_INPUT',
    });
  }

  // Deliberately uncached: each estimate is an explicit, user-initiated action
  // and the value is deterministic for a title.
  return request('/recipes/guessNutrition', { title: term }, { signal });
}

export async function searchRecipes(
  { query = '', cuisine = '', diet = '', maxReadyTime = '', offset = 0, number = 20 } = {},
  { signal } = {}
) {
  const cacheKey = `recipes:${query.trim().toLowerCase()}:${cuisine}:${diet}:${maxReadyTime}:${offset}:${number}`;

  return cachedRequest(
    cacheKey,
    () =>
      request(
        '/recipes/complexSearch',
        {
          query: query.trim(),
          cuisine,
          diet,
          maxReadyTime,
          offset,
          number,
          // Only the fields the cards and detail screen actually read.
          addRecipeInformation: true,
        },
        { signal }
      ).then((data) => ({
        recipes: Array.isArray(data.results) ? data.results : [],
        total: Number.isFinite(data.totalResults) ? data.totalResults : 0,
      })),
    { ttlMs: RECIPE_TTL }
  );
}

/** Recipes that can be made from a set of ingredients the user already has. */
export async function findRecipesByIngredients(
  ingredients,
  { number = 20, signal } = {}
) {
  const list = normaliseIngredientInput(ingredients);
  if (list.length === 0) {
    throw new SpoonacularError('Add at least one ingredient to search.', {
      code: 'INVALID_INPUT',
    });
  }

  const cacheKey = `byIngredients:${list.join(',').toLowerCase()}:${number}`;

  return cachedRequest(
    cacheKey,
    () =>
      request(
        '/recipes/findByIngredients',
        { ingredients: list.join(','), number },
        { signal }
      ).then((data) => ({
        recipes: Array.isArray(data) ? data : [],
      })),
    { ttlMs: RECIPE_TTL }
  );
}

/**
 * Normalises comma/newline separated user input into a clean ingredient list:
 * trimmed, de-duplicated case-insensitively, empties removed.
 */
export function normaliseIngredientInput(value) {
  const source = Array.isArray(value) ? value.join(',') : String(value || '');

  const seen = new Set();
  const result = [];

  for (const part of source.split(/[,\n]/)) {
    const name = part.trim().replace(/\s+/g, ' ');
    if (name === '') continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }

  return result;
}

/**
 * Full detail for one recipe: base recipe, extended ingredients and
 * step-by-step instructions in a single request.
 */
export async function getRecipeDetails(id, { signal } = {}) {
  if (id === undefined || id === null || id === '') {
    throw new SpoonacularError('Missing recipe id.', { code: 'INVALID_INPUT' });
  }

  const cacheKey = `recipe:${id}`;

  return cachedRequest(
    cacheKey,
    () => request(`/recipes/${encodeURIComponent(id)}/information`, {}, { signal }),
    { ttlMs: DETAIL_TTL }
  );
}

export { BASE_URL };