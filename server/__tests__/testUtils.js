'use strict';

const API_KEY = 'test-key-should-never-appear-in-responses';

const NORWICH = { name: 'Norwich', lat: 52.6309, lon: 1.2974, formatted: 'Norwich, Norfolk, England, United Kingdom' };
const GREAT_YARMOUTH = {
  name: 'Great Yarmouth',
  lat: 52.6083,
  lon: 1.7339,
  formatted: 'Great Yarmouth, Norfolk, England, United Kingdom',
};

/** `format=json` geocoding shape. */
function geocodeResultsBody(entries) {
  return {
    results: entries.map((entry) => ({
      place_id: entry.placeId || `geo-${entry.lat}-${entry.lon}`,
      formatted: entry.formatted,
      name: entry.name,
      result_type: entry.type || 'city',
      postcode: entry.postcode,
      country: entry.country || 'United Kingdom',
      lat: entry.lat,
      lon: entry.lon,
    })),
  };
}

/** GeoJSON FeatureCollection shape used by the places endpoint. */
function placesBody(features) {
  return {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      type: 'Feature',
      properties: {
        place_id: feature.placeId,
        name: feature.name,
        formatted: feature.formatted,
        categories: feature.categories || ['catering.restaurant'],
        lat: feature.lat,
        lon: feature.lon,
        distance: feature.distance,
      },
      geometry: {
        type: 'Point',
        coordinates:
          feature.geometryCoordinates ||
          (typeof feature.lon === 'number' && typeof feature.lat === 'number'
            ? [feature.lon, feature.lat]
            : [0, 0]),
      },
    })),
  };
}

/** FeatureCollection with exactly the properties supplied (Place Details shape). */
function placeDetailsBody(properties) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties,
        geometry: {
          type: 'Point',
          coordinates: [properties.lon, properties.lat],
        },
      },
    ],
  };
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => {
        const key = String(name).toLowerCase();
        return Object.prototype.hasOwnProperty.call(headers, key) ? headers[key] : null;
      },
    },
    json: async () => body,
  };
}

function malformedResponse(status = 200) {
  return {
    ok: true,
    status,
    headers: { get: () => null },
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
  };
}

/**
 * Builds a fetch double that routes by endpoint. Unmatched calls throw so a
 * test can never silently hit the network.
 */
function createGeoapifyFetch({ geocode, places, placeDetails } = {}) {
  const fn = async (url) => {
    const href = String(url);

    if (href.includes('/v1/geocode/search')) {
      if (geocode === undefined) throw new Error(`Unexpected geocoding call: ${href}`);
      if (typeof geocode === 'function') return geocode(url);
      return geocode;
    }

    // Checked before `/v2/places` so the details endpoint is not shadowed.
    if (href.includes('/v2/place-details')) {
      if (placeDetails === undefined) throw new Error(`Unexpected place-details call: ${href}`);
      if (typeof placeDetails === 'function') return placeDetails(url);
      return placeDetails;
    }

    if (href.includes('/v2/places')) {
      if (places === undefined) throw new Error(`Unexpected places call: ${href}`);
      if (typeof places === 'function') return places(url);
      return places;
    }

    throw new Error(`Unexpected URL: ${href}`);
  };

  return fn;
}

function countCalls(fetchMock, fragment) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(fragment)).length;
}

function abortError() {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}

module.exports = {
  API_KEY,
  NORWICH,
  GREAT_YARMOUTH,
  geocodeResultsBody,
  placesBody,
  placeDetailsBody,
  jsonResponse,
  malformedResponse,
  createGeoapifyFetch,
  countCalls,
  abortError,
};
