'use strict';

const {
  buildGeocodeUrl,
  buildPlacesUrl,
  normalizeGeocodeEntry,
  normalizePlaceFeature,
  dedupePlaces,
  toRestaurantModels,
  geocode,
  searchRestaurants,
  geocodeCache,
  placesCache,
  RESTAURANT_CATEGORY,
  DEFAULT_RADIUS_M,
} = require('../geoapify');
const {
  API_KEY,
  NORWICH,
  geocodeResultsBody,
  placesBody,
  jsonResponse,
  malformedResponse,
  createGeoapifyFetch,
  countCalls,
  abortError,
} = require('./testUtils');

beforeEach(() => {
  process.env.GEOAPIFY_API_KEY = API_KEY;
  geocodeCache.clear();
  placesCache.clear();
});

afterEach(() => {
  delete global.fetch;
});

describe('URL construction', () => {
  it('sends the place text and JSON format to the geocoding endpoint', () => {
    const url = buildGeocodeUrl({ text: 'Sw1A 1AA', limit: 5, apiKey: API_KEY });

    expect(url.origin + url.pathname).toBe('https://api.geoapify.com/v1/geocode/search');
    expect(url.searchParams.get('text')).toBe('Sw1A 1AA');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('apiKey')).toBe(API_KEY);
  });

  it('safely encodes location text containing spaces and symbols', () => {
    const url = buildGeocodeUrl({ text: 'Norwich, Norfolk & Broadland', limit: 5, apiKey: API_KEY });
    expect(url.search).not.toMatch(/Norwich, Norfolk/);
    expect(url.searchParams.get('text')).toBe('Norwich, Norfolk & Broadland');
  });

  it('uses longitude before latitude for the circle filter and proximity bias', () => {
    // Norwich: lat 52.6309, lon 1.2974 -> filter must be 1.2974,52.6309,5000
    const url = buildPlacesUrl({ lon: NORWICH.lon, lat: NORWICH.lat, radius: 5000, apiKey: API_KEY });

    expect(url.searchParams.get('filter')).toBe('circle:1.2974,52.6309,5000');
    expect(url.searchParams.get('bias')).toBe('proximity:1.2974,52.6309');
  });

  it('requests the restaurant category with a configurable limit and language', () => {
    const url = buildPlacesUrl({ lon: 1.2974, lat: 52.6309, radius: 5000, limit: 20, lang: 'en', apiKey: API_KEY });

    expect(url.searchParams.get('categories')).toBe(RESTAURANT_CATEGORY);
    expect(url.searchParams.get('categories')).toBe('catering.restaurant');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('lang')).toBe('en');
  });

  it('defaults to a 5,000 metre radius', () => {
    expect(DEFAULT_RADIUS_M).toBe(5000);
    const url = buildPlacesUrl({ lon: 1.2974, lat: 52.6309, apiKey: API_KEY });
    expect(url.searchParams.get('filter')).toBe('circle:1.2974,52.6309,5000');
  });
});

describe('geocoding normalization', () => {
  it('keeps valid candidates and drops entries without usable coordinates', () => {
    expect(normalizeGeocodeEntry({ lat: 52.6309, lon: 1.2974, formatted: 'Norwich' })).toMatchObject({
      lat: 52.6309,
      lon: 1.2974,
      label: 'Norwich',
    });

    expect(normalizeGeocodeEntry({ lat: 200, lon: 1 })).toBeNull();
    expect(normalizeGeocodeEntry({ formatted: 'Nowhere' })).toBeNull();
    expect(normalizeGeocodeEntry(null)).toBeNull();
  });
});

describe('places normalization', () => {
  it('maps the GeoJSON feature properties into the restaurant model', () => {
    const place = normalizePlaceFeature({
      type: 'Feature',
      properties: {
        place_id: 'abc123',
        name: 'The Bicycle Shop',
        formatted: '2 St Benedicts St, Norwich NR2 4AG, United Kingdom',
        categories: ['catering.restaurant', 'catering.restaurant.british'],
        lat: 52.6305,
        lon: 1.2923,
        distance: 412,
      },
      geometry: { type: 'Point', coordinates: [1.2923, 52.6305] },
    });

    expect(place).toEqual({
      placeId: 'abc123',
      name: 'The Bicycle Shop',
      address: '2 St Benedicts St, Norwich NR2 4AG, United Kingdom',
      lat: 52.6305,
      lon: 1.2923,
      categories: ['catering.restaurant', 'catering.restaurant.british'],
      distance: 412,
    });
  });

  it('falls back to geometry coordinates when properties omit lat/lon', () => {
    const place = normalizePlaceFeature({
      type: 'Feature',
      properties: { place_id: 'geom-only', name: 'Geo Only' },
      geometry: { type: 'Point', coordinates: [1.7, 52.6] },
    });

    expect(place).toMatchObject({ lat: 52.6, lon: 1.7 });
  });

  it('skips features without coordinates', () => {
    expect(normalizePlaceFeature({ properties: { name: 'No coords' } })).toBeNull();
    expect(normalizePlaceFeature({})).toBeNull();
    expect(normalizePlaceFeature(null)).toBeNull();
  });

  it('deduplicates by place id and falls back to name plus coordinates', () => {
    const places = [
      { placeId: 'a', name: 'One', lat: 1, lon: 2 },
      { placeId: 'a', name: 'One duplicate', lat: 1, lon: 2 },
      { placeId: null, name: 'Two', lat: 3, lon: 4 },
      { placeId: null, name: 'Two', lat: 3, lon: 4 },
    ];

    expect(dedupePlaces(places)).toHaveLength(2);
  });

  it('uses neutral fallbacks and never invents unavailable fields', () => {
    const [model] = toRestaurantModels([
      { placeId: null, name: null, address: null, lat: 52.6, lon: 1.7, categories: [], distance: null },
    ]);

    expect(model.name).toBe('Unnamed place');
    expect(model.address).toBe('Address unavailable');
    expect(model.phone).toBeNull();
    expect(model.hours).toBeNull();
    expect(model.photo).toBeNull();
    expect(model.rating).toBeNull();
    expect(model.source).toBe('geoapify');
  });

  it('sorts restaurants by distance when every result reports one', () => {
    const models = toRestaurantModels([
      { placeId: 'far', name: 'Far', address: 'a', lat: 1, lon: 1, categories: [], distance: 900 },
      { placeId: 'near', name: 'Near', address: 'b', lat: 2, lon: 2, categories: [], distance: 100 },
    ]);

    expect(models.map((model) => model.placeId)).toEqual(['near', 'far']);
  });
});

describe('geocode', () => {
  it('parses the format=json results array', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({ geocode: jsonResponse(geocodeResultsBody([NORWICH])) })
    );

    const candidates = await geocode('Norwich');

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ lat: 52.6309, lon: 1.2974, type: 'city' });
  });

  it('parses a GeoJSON FeatureCollection response', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        geocode: jsonResponse({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { formatted: 'Norwich', lat: 52.6309, lon: 1.2974, result_type: 'city' },
              geometry: { type: 'Point', coordinates: [1.2974, 52.6309] },
            },
          ],
        }),
      })
    );

    const candidates = await geocode('Norwich');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].lat).toBe(52.6309);
  });

  it('reuses cached geocoding results', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({ geocode: jsonResponse(geocodeResultsBody([NORWICH])) })
    );

    await geocode('Norwich');
    await geocode('Norwich');

    expect(countCalls(global.fetch, '/v1/geocode/search')).toBe(1);
  });

  it('maps an authentication failure to UPSTREAM_AUTH', async () => {
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, { status: 401 })));
    await expect(geocode('Norwich')).rejects.toMatchObject({ code: 'UPSTREAM_AUTH', status: 502 });
  });

  it('maps a rate limit to UPSTREAM_RATE_LIMIT with retry-after', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse({}, { status: 429, headers: { 'retry-after': '30' } }))
    );
    await expect(geocode('Norwich')).rejects.toMatchObject({
      code: 'UPSTREAM_RATE_LIMIT',
      status: 503,
      retryAfter: '30',
    });
  });

  it('maps a server error to UPSTREAM_ERROR', async () => {
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, { status: 500 })));
    await expect(geocode('Norwich')).rejects.toMatchObject({ code: 'UPSTREAM_ERROR', status: 502 });
  });

  it('maps malformed JSON to UPSTREAM_MALFORMED', async () => {
    global.fetch = jest.fn(() => Promise.resolve(malformedResponse()));
    await expect(geocode('Norwich')).rejects.toMatchObject({
      code: 'UPSTREAM_MALFORMED',
      status: 502,
    });
  });

  it('maps an aborted request to UPSTREAM_TIMEOUT', async () => {
    global.fetch = jest.fn(() => Promise.reject(abortError()));
    await expect(geocode('Norwich')).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      status: 504,
    });
  });

  it('maps a transport failure to UPSTREAM_UNREACHABLE', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    await expect(geocode('Norwich')).rejects.toMatchObject({
      code: 'UPSTREAM_UNREACHABLE',
      status: 502,
    });
  });
});

describe('searchRestaurants', () => {
  it('requests the longitude-first circle filter and parses the feature collection', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        places: jsonResponse(
          placesBody([
            { placeId: 'p1', name: 'Cafe One', formatted: '1 High St', lat: 52.63, lon: 1.29, distance: 250 },
          ])
        ),
      })
    );

    const places = await searchRestaurants({ lat: NORWICH.lat, lon: NORWICH.lon, radius: 5000 });

    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ placeId: 'p1', name: 'Cafe One', distance: 250 });

    const requested = String(global.fetch.mock.calls[0][0]);
    expect(requested).toContain('categories=catering.restaurant');
    expect(decodeURIComponent(requested)).toContain('filter=circle:1.2974,52.6309,5000');
  });

  it('skips features that cannot be placed on a map', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        places: jsonResponse({
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: { place_id: 'ok', name: 'Valid', lat: 52.6, lon: 1.7 } },
            { type: 'Feature', properties: { place_id: 'bad', name: 'Invalid' } },
          ],
        }),
      })
    );

    const places = await searchRestaurants({ lat: 52.6, lon: 1.7 });
    expect(places.map((place) => place.placeId)).toEqual(['ok']);
  });

  it('returns an empty list when the provider returns no features', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({ places: jsonResponse({ type: 'FeatureCollection', features: [] }) })
    );

    await expect(searchRestaurants({ lat: 52.6, lon: 1.7 })).resolves.toEqual([]);
  });

  it('refuses to run without valid coordinates', async () => {
    await expect(searchRestaurants({ lat: 999, lon: 1 })).rejects.toThrow(/valid lat\/lon/);
  });
});
