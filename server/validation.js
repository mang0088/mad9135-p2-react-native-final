'use strict';

const { invalidQuery } = require('./errors');
const { DEFAULT_RADIUS_M, DEFAULT_LIMIT, isValidLat, isValidLon } = require('./geoapify');

const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 50000;
const MAX_LIMIT = 50;
const MIN_LOCATION_LENGTH = 2;
const MAX_LOCATION_LENGTH = 120;

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function parseLocationText(raw, field) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw invalidQuery(`"${field}" must be a string.`);

  const text = raw.trim();
  if (text === '') return null;
  if (text.length < MIN_LOCATION_LENGTH) {
    throw invalidQuery(`"${field}" must be at least ${MIN_LOCATION_LENGTH} characters.`);
  }
  if (text.length > MAX_LOCATION_LENGTH) {
    throw invalidQuery(`"${field}" must be at most ${MAX_LOCATION_LENGTH} characters.`);
  }
  return text;
}

/**
 * Validates and normalizes `/api/restaurants` query parameters.
 *
 * Accepts either a free-text `location` (geocoded server-side) or an explicit
 * `lat`+`lon` pair (used when the user picks one of several candidate places).
 */
function parseRestaurantQuery(query = {}) {
  const location = parseLocationText(query.location, 'location');

  const rawLat = parseNumber(query.lat);
  const rawLon = parseNumber(query.lon);

  const hasLat = rawLat !== null;
  const hasLon = rawLon !== null;

  if (hasLat !== hasLon) {
    throw invalidQuery('"lat" and "lon" must be provided together.');
  }

  let lat = null;
  let lon = null;

  if (hasLat && hasLon) {
    if (Number.isNaN(rawLat) || Number.isNaN(rawLon)) {
      throw invalidQuery('"lat" and "lon" must be numbers.');
    }
    if (!isValidLat(rawLat)) throw invalidQuery('"lat" must be between -90 and 90.');
    if (!isValidLon(rawLon)) throw invalidQuery('"lon" must be between -180 and 180.');
    lat = rawLat;
    lon = rawLon;
  }

  if (!location && !hasLat) {
    throw invalidQuery('Provide a "location" place name or postcode (or explicit "lat" and "lon").');
  }

  const rawRadius = parseNumber(query.radius);
  let radius = DEFAULT_RADIUS_M;
  if (rawRadius !== null) {
    if (Number.isNaN(rawRadius)) throw invalidQuery('"radius" must be a number.');
    if (rawRadius < MIN_RADIUS_M || rawRadius > MAX_RADIUS_M) {
      throw invalidQuery(`"radius" must be between ${MIN_RADIUS_M} and ${MAX_RADIUS_M} metres.`);
    }
    radius = Math.round(rawRadius);
  }

  const rawLimit = parseNumber(query.limit);
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    if (Number.isNaN(rawLimit)) throw invalidQuery('"limit" must be a number.');
    if (rawLimit < 1 || rawLimit > MAX_LIMIT) {
      throw invalidQuery(`"limit" must be between 1 and ${MAX_LIMIT}.`);
    }
    limit = Math.round(rawLimit);
  }

  const locationLabel =
    typeof query.locationLabel === 'string' && query.locationLabel.trim() !== ''
      ? query.locationLabel.trim().slice(0, 200)
      : null;

  return { location, lat, lon, radius, limit, locationLabel };
}

function parseGeocodeQuery(query = {}) {
  const text = parseLocationText(query.text, 'text');
  if (!text) throw invalidQuery('Provide a "text" place name or postcode.');

  const rawLimit = parseNumber(query.limit);
  let limit = 5;
  if (rawLimit !== null) {
    if (Number.isNaN(rawLimit)) throw invalidQuery('"limit" must be a number.');
    if (rawLimit < 1 || rawLimit > 10) throw invalidQuery('"limit" must be between 1 and 10.');
    limit = Math.round(rawLimit);
  }

  return { text, limit };
}

/** Validates `/api/place-details` query parameters. */
function parsePlaceDetailsQuery(query = {}) {
  const raw = query.id;
  if (raw === undefined || raw === null) {
    throw invalidQuery('Provide an "id" place identifier.');
  }
  if (typeof raw !== 'string') {
    throw invalidQuery('"id" must be a string.');
  }

  const id = raw.trim();
  if (id === '') throw invalidQuery('Provide an "id" place identifier.');
  if (id.length > MAX_LOCATION_LENGTH * 2) throw invalidQuery('"id" is too long.');

  return { id };
}

module.exports = {
  MIN_RADIUS_M,
  MAX_RADIUS_M,
  MAX_LIMIT,
  MIN_LOCATION_LENGTH,
  MAX_LOCATION_LENGTH,
  parseRestaurantQuery,
  parseGeocodeQuery,
  parsePlaceDetailsQuery,
};
