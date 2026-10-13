import Constants from 'expo-constants';

/**
 * Client for the local restaurant backend (`server/`).
 *
 * The Geoapify API key lives on the server only, so the app never bundles or
 * transmits it. Only the backend base URL — which is not secret — is
 * configurable here.
 */

const DEFAULT_SERVER_PORT = 3001;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RADIUS_M = 5000;
const DEFAULT_LIMIT = 20;

export class RestaurantApiError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'RestaurantApiError';
    this.code = code || 'UNKNOWN';
    this.status = status;
  }
}

/**
 * Resolves the backend base URL, in order of preference:
 *   1. EXPO_PUBLIC_API_BASE_URL (explicit override)
 *   2. The Expo dev server's host, so a physical device reaches the dev machine
 *      on the same network without manual configuration
 *   3. localhost (simulators and web)
 */
export function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof configured === 'string' && configured.trim() !== '') {
    return configured.trim().replace(/\/+$/, '');
  }

  const hostUri =
    (Constants.expoConfig && Constants.expoConfig.hostUri) ||
    (Constants.expoGoConfig && Constants.expoGoConfig.debuggerHost) ||
    null;

  if (typeof hostUri === 'string' && hostUri !== '') {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:${DEFAULT_SERVER_PORT}`;
    }
  }

  return `http://localhost:${DEFAULT_SERVER_PORT}`;
}

/**
 * Builds an encoded query string without relying on `URLSearchParams`.
 * React Native ships its own implementation of that class (Jest uses Node's),
 * so this keeps the request building identical and verifiable on both.
 */
export function buildQueryString(params) {
  return Object.keys(params)
    .filter((key) => {
      const value = params[key];
      return value !== undefined && value !== null && value !== '';
    })
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&');
}

async function requestJson(path, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = `${getApiBaseUrl()}${path}`;
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
    if (err && err.name === 'AbortError') {
      throw new RestaurantApiError('The search was cancelled.', { code: 'ABORTED' });
    }
    throw new RestaurantApiError(
      'Could not reach the restaurant service. Make sure the backend is running.',
      { code: 'NETWORK' }
    );
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', forwardAbort);
  }

  let body = null;
  try {
    body = await response.json();
  } catch (err) {
    body = null;
  }

  if (!response.ok) {
    const code = (body && body.error && body.error.code) || 'HTTP_ERROR';
    const message =
      (body && body.error && body.error.message) ||
      `The restaurant service returned status ${response.status}.`;
    throw new RestaurantApiError(message, { code, status: response.status });
  }

  if (!body || typeof body !== 'object') {
    throw new RestaurantApiError('The restaurant service returned malformed data.', {
      code: 'MALFORMED',
    });
  }

  return body;
}

/**
 * Fetches nearby restaurants for a place name/postcode, or for explicit
 * coordinates when the user picks one of several candidate locations.
 */
export async function fetchRestaurants({
  location,
  lat,
  lon,
  locationLabel,
  radius = DEFAULT_RADIUS_M,
  limit = DEFAULT_LIMIT,
  signal,
} = {}) {
  const hasCoordinates = typeof lat === 'number' && typeof lon === 'number';

  if (!hasCoordinates && !location) {
    throw new RestaurantApiError('Enter a place name or postcode.', { code: 'INVALID_INPUT' });
  }

  const query = buildQueryString(
    hasCoordinates
      ? { radius, limit, lat, lon, locationLabel }
      : { radius, limit, location }
  );

  const body = await requestJson(`/api/restaurants?${query}`, { signal });

  return {
    restaurants: Array.isArray(body.restaurants) ? body.restaurants : [],
    origin: body.origin || null,
    candidates: Array.isArray(body.candidates) ? body.candidates : [],
    ambiguous: Boolean(body.ambiguous),
    radius: typeof body.radius === 'number' ? body.radius : radius,
  };
}

/**
 * Full record for one restaurant (opening hours, website, phone, ...) when the
 * provider has them. Resolves to null when the provider has no such record.
 */
export async function fetchRestaurantDetails(placeId, { signal } = {}) {
  if (typeof placeId !== 'string' || placeId.trim() === '') {
    throw new RestaurantApiError('Missing place identifier.', { code: 'INVALID_INPUT' });
  }

  const query = buildQueryString({ id: placeId });
  const body = await requestJson(`/api/place-details?${query}`, { signal });

  return body.place || null;
}

export { DEFAULT_RADIUS_M, DEFAULT_LIMIT, DEFAULT_SERVER_PORT };
