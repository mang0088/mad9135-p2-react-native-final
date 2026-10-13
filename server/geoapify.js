'use strict';

const {
  configMissingKey,
  upstreamTimeout,
  upstreamUnreachable,
  upstreamAuth,
  upstreamRateLimited,
  upstreamError,
  upstreamMalformed,
} = require('./errors');
const { createTtlCache } = require('./cache');

const GEOCODE_ENDPOINT = 'https://api.geoapify.com/v1/geocode/search';
const PLACES_ENDPOINT = 'https://api.geoapify.com/v2/places';
const PLACE_DETAILS_ENDPOINT = 'https://api.geoapify.com/v2/place-details';

const RESTAURANT_CATEGORY = 'catering.restaurant';
const DEFAULT_RADIUS_M = 5000;
const DEFAULT_LIMIT = 20;
const DEFAULT_LANG = 'en';
const REQUEST_TIMEOUT_MS = 8000;

// Results are stable for a short while, so caching avoids spending credits on
// identical repeated searches. Never retried automatically.
const geocodeCache = createTtlCache({ ttlMs: 10 * 60 * 1000, maxEntries: 500 });
const placesCache = createTtlCache({ ttlMs: 5 * 60 * 1000, maxEntries: 500 });
const placeDetailsCache = createTtlCache({ ttlMs: 30 * 60 * 1000, maxEntries: 500 });

function getApiKey() {
  const key = process.env.GEOAPIFY_API_KEY;
  if (typeof key !== 'string' || key.trim() === '') {
    throw configMissingKey();
  }
  return key.trim();
}

function isValidLat(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLon(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * Geoapify Places spatial parameters take LONGITUDE first, then latitude.
 * e.g. lat 52.6309 / lon 1.2974 -> circle:1.2974,52.6309,5000
 */
function buildGeocodeUrl({ text, limit = 5, apiKey }) {
  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set('text', text);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('apiKey', apiKey);
  return url;
}

function buildPlacesUrl({
  lon,
  lat,
  radius = DEFAULT_RADIUS_M,
  limit = DEFAULT_LIMIT,
  lang = DEFAULT_LANG,
  apiKey,
}) {
  const url = new URL(PLACES_ENDPOINT);
  url.searchParams.set('categories', RESTAURANT_CATEGORY);
  url.searchParams.set('filter', `circle:${lon},${lat},${radius}`);
  url.searchParams.set('bias', `proximity:${lon},${lat}`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lang', lang);
  url.searchParams.set('apiKey', apiKey);
  return url;
}

/**
 * Place Details lookup by Geoapify place id. This is where OpenStreetMap's
 * richer tags (opening hours, website, phone, cuisine) actually appear.
 */
function buildPlaceDetailsUrl({ placeId, lang = DEFAULT_LANG, apiKey }) {
  const url = new URL(PLACE_DETAILS_ENDPOINT);
  url.searchParams.set('id', placeId);
  url.searchParams.set('features', 'details');
  url.searchParams.set('lang', lang);
  url.searchParams.set('apiKey', apiKey);
  return url;
}

/**
 * Performs a GET request with a hard timeout and maps transport/HTTP failures
 * onto typed AppErrors. The request URL (which contains the API key) is never
 * included in thrown errors or logs.
 */
async function fetchJson(url, { timeoutMs = REQUEST_TIMEOUT_MS, fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await doFetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')) {
      throw upstreamTimeout();
    }
    throw upstreamUnreachable();
  } finally {
    clearTimeout(timer);
  }

  const status = Number(response && response.status);

  if (status === 401 || status === 403) throw upstreamAuth();
  if (status === 429) {
    const retryAfter = response && response.headers && typeof response.headers.get === 'function'
      ? response.headers.get('retry-after')
      : null;
    throw upstreamRateLimited(retryAfter || null);
  }
  if (!response || response.ok === false || !(status >= 200 && status < 300)) {
    throw upstreamError(status || 0);
  }

  try {
    return await response.json();
  } catch (err) {
    throw upstreamMalformed();
  }
}

function toNumber(value) {
  // Guard against null/'' because Number(null) and Number('') are 0, which would
  // silently place a feature at 0,0 instead of being treated as missing.
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Geoapify geocoding returns either a `results` array (format=json) or a
 * GeoJSON FeatureCollection. Both shapes are supported.
 */
function extractGeocodeEntries(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.features)) {
    return payload.features.map((feature) =>
      feature && typeof feature === 'object' ? { ...(feature.properties || {}) } : {}
    );
  }
  return [];
}

function buildLabel(entry) {
  if (typeof entry.formatted === 'string' && entry.formatted.trim() !== '') {
    return entry.formatted.trim();
  }
  const parts = [entry.address_line1, entry.address_line2, entry.city, entry.state, entry.country]
    .filter((part) => typeof part === 'string' && part.trim() !== '')
    .map((part) => part.trim());
  if (parts.length > 0) return parts.join(', ');
  return typeof entry.name === 'string' && entry.name.trim() !== '' ? entry.name.trim() : null;
}

function normalizeGeocodeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const lat = toNumber(entry.lat);
  const lon = toNumber(entry.lon);

  // Coordinates must be present and within valid ranges.
  if (lat === null || lon === null || !isValidLat(lat) || !isValidLon(lon)) return null;

  return {
    placeId: entry.place_id || null,
    label: buildLabel(entry),
    name: entry.name || entry.city || entry.town || entry.village || null,
    type: entry.result_type || null,
    postcode: entry.postcode || null,
    country: entry.country || null,
    lat,
    lon,
  };
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Contact phone number, from `phone` or the nested `contact.phone` field. */
function readPhone(props) {
  const direct = stringOrNull(props.phone);
  if (direct) return direct;
  if (props.contact && typeof props.contact === 'object') {
    return stringOrNull(props.contact.phone);
  }
  return null;
}

function readEmail(props) {
  if (props.contact && typeof props.contact === 'object') {
    return stringOrNull(props.contact.email);
  }
  return stringOrNull(props.email);
}

/**
 * Opening hours come from OpenStreetMap's `opening_hours` tag as a string such
 * as "Mo-Su 09:00-22:00". It is frequently absent, so callers must handle null.
 */
function readOpeningHours(props) {
  const raw = props.opening_hours;
  if (typeof raw === 'string') return stringOrNull(raw);
  if (raw && typeof raw === 'object' && typeof raw.text === 'string') {
    return stringOrNull(raw.text);
  }
  return null;
}

/** Attribution data is required when displaying OpenStreetMap-derived results. */
function readDatasource(props) {
  if (!props.datasource || typeof props.datasource !== 'object') return null;
  const source = stringOrNull(props.datasource.sourcename);
  const attribution = stringOrNull(props.datasource.attribution);
  if (!source && !attribution) return null;
  return { source, attribution };
}

/**
 * Geoapify Places returns a GeoJSON FeatureCollection. Every useful value lives
 * in `feature.properties` (with coordinates also available in `geometry`).
 */
function normalizePlaceFeature(feature) {
  if (!feature || typeof feature !== 'object') return null;

  const props = feature.properties && typeof feature.properties === 'object'
    ? feature.properties
    : {};

  const geometryCoords =
    feature.geometry && Array.isArray(feature.geometry.coordinates)
      ? feature.geometry.coordinates
      : null;

  const lon = toNumber(props.lon) !== null ? toNumber(props.lon) : toNumber(geometryCoords && geometryCoords[0]);
  const lat = toNumber(props.lat) !== null ? toNumber(props.lat) : toNumber(geometryCoords && geometryCoords[1]);

  // A place we cannot place on a map is not usable.
  if (lat === null || lon === null || !isValidLat(lat) || !isValidLon(lon)) return null;

  const name = typeof props.name === 'string' && props.name.trim() !== '' ? props.name.trim() : null;
  const formatted = typeof props.formatted === 'string' && props.formatted.trim() !== ''
    ? props.formatted.trim()
    : null;
  const distance = toNumber(props.distance);

  return {
    placeId: props.place_id || null,
    name,
    address: formatted,
    lat,
    lon,
    categories: Array.isArray(props.categories)
      ? props.categories.filter((category) => typeof category === 'string')
      : [],
    distance: distance === null ? null : Math.round(distance),

    // Optional in OpenStreetMap: present for some places, null for many.
    addressLine1: stringOrNull(props.address_line1),
    addressLine2: stringOrNull(props.address_line2),
    street: stringOrNull(props.street),
    housenumber: stringOrNull(props.housenumber),
    city: stringOrNull(props.city),
    state: stringOrNull(props.state),
    county: stringOrNull(props.county),
    postcode: stringOrNull(props.postcode),
    country: stringOrNull(props.country),
    website: stringOrNull(props.website),
    email: readEmail(props),
    phone: readPhone(props),
    openingHours: readOpeningHours(props),
    cuisine: stringOrNull(props.cuisine),
    wheelchair: stringOrNull(props.wheelchair),
    capacity: toNumber(props.capacity),
    description: stringOrNull(props.description),
    datasource: readDatasource(props),
  };
}

/** Deduplicate by stable place id, falling back to name + coordinates. */
function dedupePlaces(places) {
  const seen = new Set();
  const unique = [];

  for (const place of places) {
    const key = place.placeId || `${place.name || ''}|${place.lat}|${place.lon}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(place);
  }

  return unique;
}

/**
 * Normalizes places into the restaurant model the app renders.
 *
 * Only values actually supplied by Geoapify are populated. Fields the provider
 * does not return (phone, opening hours, photos, rating) are explicitly null so
 * the UI can hide them instead of inventing data.
 */
function toRestaurantModels(places) {
  const withDistance = places.every((place) => place.distance !== null);
  const ordered = withDistance
    ? [...places].sort((a, b) => a.distance - b.distance)
    : places;

  return ordered.map((place) => ({
    placeId: place.placeId,
    name: place.name || 'Unnamed place',
    address: place.address || 'Address unavailable',
    lat: place.lat,
    lon: place.lon,
    categories: place.categories,
    distance: place.distance,

    // Populated only when OpenStreetMap actually carries the value.
    phone: place.phone || null,
    hours: place.openingHours || null,
    website: place.website || null,
    cuisine: place.cuisine || null,

    // Geoapify/OSM provide no photos or ratings — never invented.
    photo: null,
    rating: null,
    source: 'geoapify',
  }));
}

/**
 * Place Details responds with a FeatureCollection like Places, but a single
 * object carrying `properties` is accepted too so a shape change cannot break
 * parsing.
 */
function extractFirstFeature(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload.features)) {
    return payload.features.find((feature) => feature && typeof feature === 'object') || null;
  }
  if (payload.properties && typeof payload.properties === 'object') return payload;
  return null;
}

/**
 * Fetches the full record for a single place. Returns null when the provider
 * has no record so callers can report it honestly instead of inventing data.
 */
async function getPlaceDetails(placeId, { lang = DEFAULT_LANG, fetchImpl } = {}) {
  const cacheKey = `details:${placeId}:${lang}`;
  const cached = placeDetailsCache.get(cacheKey);
  if (cached) return cached;

  const url = buildPlaceDetailsUrl({ placeId, lang, apiKey: getApiKey() });
  const payload = await fetchJson(url, { fetchImpl });

  const feature = extractFirstFeature(payload);
  const details = feature ? normalizePlaceFeature(feature) : null;

  if (details) placeDetailsCache.set(cacheKey, details);
  return details;
}

/**
 * Presentation shape for a single restaurant's full record. Fields Geoapify/
 * OpenStreetMap never supply (photo, rating) are returned as null so the client
 * can hide them rather than invent them.
 */
function toRestaurantDetails(place) {
  if (!place) return null;

  return {
    placeId: place.placeId,
    name: place.name || 'Unnamed place',
    address: place.address || 'Address unavailable',
    addressLine1: place.addressLine1,
    addressLine2: place.addressLine2,
    street: place.street,
    housenumber: place.housenumber,
    city: place.city,
    state: place.state,
    county: place.county,
    postcode: place.postcode,
    country: place.country,
    lat: place.lat,
    lon: place.lon,
    categories: place.categories,
    cuisine: place.cuisine,
    openingHours: place.openingHours,
    website: place.website,
    phone: place.phone,
    email: place.email,
    wheelchair: place.wheelchair,
    capacity: place.capacity,
    description: place.description,
    distance: place.distance,
    datasource: place.datasource,

    // Not provided by Geoapify (OpenStreetMap has no photos, menus or ratings).
    photo: null,
    menu: null,
    rating: null,
    reviews: null,
    source: 'geoapify',
  };
}

async function geocode(text, { limit = 5, fetchImpl } = {}) {
  const cacheKey = `geocode:${text.toLowerCase()}:${limit}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  const url = buildGeocodeUrl({ text, limit, apiKey: getApiKey() });
  const payload = await fetchJson(url, { fetchImpl });

  const candidates = extractGeocodeEntries(payload)
    .map(normalizeGeocodeEntry)
    .filter(Boolean);

  if (candidates.length > 0) geocodeCache.set(cacheKey, candidates);
  return candidates;
}

async function searchRestaurants({
  lat,
  lon,
  radius = DEFAULT_RADIUS_M,
  limit = DEFAULT_LIMIT,
  lang = DEFAULT_LANG,
  fetchImpl,
} = {}) {
  if (!isValidLat(lat) || !isValidLon(lon)) {
    throw new Error('searchRestaurants requires valid lat/lon');
  }

  const cacheKey = `places:${lon},${lat},${radius},${limit},${lang}`;
  const cached = placesCache.get(cacheKey);
  if (cached) return cached;

  const url = buildPlacesUrl({ lon, lat, radius, limit, lang, apiKey: getApiKey() });
  const payload = await fetchJson(url, { fetchImpl });

  const features = payload && Array.isArray(payload.features) ? payload.features : [];
  const places = dedupePlaces(features.map(normalizePlaceFeature).filter(Boolean));

  placesCache.set(cacheKey, places);
  return places;
}

module.exports = {
  GEOCODE_ENDPOINT,
  PLACES_ENDPOINT,
  PLACE_DETAILS_ENDPOINT,
  RESTAURANT_CATEGORY,
  DEFAULT_RADIUS_M,
  DEFAULT_LIMIT,
  DEFAULT_LANG,
  REQUEST_TIMEOUT_MS,
  buildGeocodeUrl,
  buildPlacesUrl,
  buildPlaceDetailsUrl,
  extractGeocodeEntries,
  extractFirstFeature,
  normalizeGeocodeEntry,
  normalizePlaceFeature,
  dedupePlaces,
  toRestaurantModels,
  toRestaurantDetails,
  geocode,
  searchRestaurants,
  getPlaceDetails,
  geocodeCache,
  placesCache,
  placeDetailsCache,
  isValidLat,
  isValidLon,
};
