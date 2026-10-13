'use strict';

const request = require('supertest');

const { createApp } = require('../app');
const { geocodeCache, placesCache, placeDetailsCache } = require('../geoapify');
const {
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
} = require('./testUtils');

const app = createApp();

beforeEach(() => {
  process.env.GEOAPIFY_API_KEY = API_KEY;
  geocodeCache.clear();
  placesCache.clear();
  placeDetailsCache.clear();
});

afterEach(() => {
  delete global.fetch;
});

describe('GET /health', () => {
  it('reports the service as up', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('GET /api/restaurants - validation', () => {
  it('rejects a request with no location or coordinates', async () => {
    const res = await request(app).get('/api/restaurants');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY');
  });

  it('rejects a too-short location', async () => {
    const res = await request(app).get('/api/restaurants').query({ location: 'N' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY');
  });

  it('rejects out-of-range coordinates', async () => {
    const lat = await request(app).get('/api/restaurants').query({ lat: 91, lon: 0 });
    expect(lat.status).toBe(400);

    const lon = await request(app).get('/api/restaurants').query({ lat: 0, lon: 181 });
    expect(lon.status).toBe(400);
  });

  it('requires lat and lon together', async () => {
    const res = await request(app).get('/api/restaurants').query({ lat: 52.6 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY');
  });

  it('rejects an out-of-range radius', async () => {
    const small = await request(app)
      .get('/api/restaurants')
      .query({ location: 'Norwich', radius: 50 });
    expect(small.status).toBe(400);

    const large = await request(app)
      .get('/api/restaurants')
      .query({ location: 'Norwich', radius: 60000 });
    expect(large.status).toBe(400);
  });
});

describe('GET /api/restaurants - happy path', () => {
  it('geocodes a place name then returns normalized restaurants', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        geocode: jsonResponse(geocodeResultsBody([NORWICH])),
        places: jsonResponse(
          placesBody([
            { placeId: 'p1', name: 'Cafe One', formatted: '1 High St', lat: 52.63, lon: 1.29, distance: 250 },
            { placeId: 'p2', name: 'Bistro Two', formatted: '2 High St', lat: 52.631, lon: 1.291, distance: 480 },
          ])
        ),
      })
    );

    const res = await request(app).get('/api/restaurants').query({ location: 'Norwich' });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.ambiguous).toBe(false);
    expect(res.body.origin).toMatchObject({ lat: 52.6309, lon: 1.2974 });
    expect(res.body.restaurants[0]).toMatchObject({
      placeId: 'p1',
      name: 'Cafe One',
      address: '1 High St',
      lat: 52.63,
      lon: 1.29,
      distance: 250,
      phone: null,
      hours: null,
      source: 'geoapify',
    });
  });

  it('uses the first candidate and reports ambiguity when several places match', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        geocode: jsonResponse(geocodeResultsBody([NORWICH, GREAT_YARMOUTH])),
        places: jsonResponse(placesBody([{ placeId: 'p1', name: 'One', formatted: 'a', lat: 52.6, lon: 1.7 }])),
      })
    );

    const res = await request(app).get('/api/restaurants').query({ location: 'Norwich' });

    expect(res.status).toBe(200);
    expect(res.body.ambiguous).toBe(true);
    expect(res.body.candidates).toHaveLength(2);

    // Places must be searched from the FIRST candidate's coordinates,
    // in longitude,latitude order.
    const placesUrl = decodeURIComponent(String(global.fetch.mock.calls[1][0]));
    expect(placesUrl).toContain('circle:1.2974,52.6309,5000');
  });

  it('accepts explicit coordinates and skips geocoding entirely', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        places: jsonResponse(placesBody([{ placeId: 'p1', name: 'One', formatted: 'a', lat: 52.63, lon: 1.29 }])),
      })
    );

    const res = await request(app)
      .get('/api/restaurants')
      .query({ lat: 52.6309, lon: 1.2974, locationLabel: 'Norwich' });

    expect(res.status).toBe(200);
    expect(countCalls(global.fetch, '/v1/geocode/search')).toBe(0);
    expect(countCalls(global.fetch, '/v2/places')).toBe(1);
    expect(res.body.origin.label).toBe('Norwich');
  });

  it('applies the requested radius', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        geocode: jsonResponse(geocodeResultsBody([NORWICH])),
        places: jsonResponse(placesBody([{ placeId: 'p1', name: 'One', formatted: 'a', lat: 52.6, lon: 1.7 }])),
      })
    );

    const res = await request(app)
      .get('/api/restaurants')
      .query({ location: 'Norwich', radius: 1500 });

    expect(res.status).toBe(200);
    expect(res.body.radius).toBe(1500);
    expect(decodeURIComponent(String(global.fetch.mock.calls[1][0]))).toContain('circle:1.2974,52.6309,1500');
  });

  it('returns an empty list without fabricating data when nothing is nearby', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        geocode: jsonResponse(geocodeResultsBody([NORWICH])),
        places: jsonResponse({ type: 'FeatureCollection', features: [] }),
      })
    );

    const res = await request(app).get('/api/restaurants').query({ location: 'Norwich' });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.restaurants).toEqual([]);
  });
});

describe('GET /api/restaurants - unknown location', () => {
  it('returns 404 and never calls the places endpoint', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({ geocode: jsonResponse({ results: [] }) })
    );

    const res = await request(app)
      .get('/api/restaurants')
      .query({ location: 'Nowhereatall' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('LOCATION_NOT_FOUND');
    expect(countCalls(global.fetch, '/v2/places')).toBe(0);
  });
});

describe('GET /api/geocode', () => {
  it('returns candidate matches for a postcode', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        geocode: jsonResponse(
          geocodeResultsBody([
            { name: 'NR30 1AB', lat: 52.6083, lon: 1.7339, type: 'postcode', formatted: 'NR30 1AB, Great Yarmouth' },
          ])
        ),
      })
    );

    const res = await request(app).get('/api/geocode').query({ text: 'NR30 1AB' });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.candidates[0]).toMatchObject({ lat: 52.6083, lon: 1.7339, type: 'postcode' });
  });

  it('requires a text parameter', async () => {
    const res = await request(app).get('/api/geocode');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY');
  });
});

describe('GET /api/restaurants - upstream failures', () => {
  it('returns 503 when the API key is not configured', async () => {
    delete process.env.GEOAPIFY_API_KEY;

    const res = await request(app).get('/api/restaurants').query({ location: 'Norwich' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('CONFIG_MISSING_KEY');
  });

  it('returns 504 when the provider times out', async () => {
    global.fetch = jest.fn(() => Promise.reject(abortError()));

    const res = await request(app).get('/api/restaurants').query({ location: 'Norwich' });

    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('returns 503 when the provider rate limits the request', async () => {
    // Geocoding succeeds first, then the places call is rate limited.
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call === 1) return Promise.resolve(jsonResponse(geocodeResultsBody([NORWICH])));
      return Promise.resolve(jsonResponse({}, { status: 429, headers: { 'retry-after': '12' } }));
    });

    const res = await request(app).get('/api/restaurants').query({ location: 'Norwich' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UPSTREAM_RATE_LIMIT');
    expect(res.body.error.retryAfter).toBe('12');
  });

  it('returns 502 when the provider rejects the key', async () => {
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, { status: 401 })));

    const res = await request(app).get('/api/restaurants').query({ location: 'Norwich' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_AUTH');
  });

  it('returns 502 when the provider returns malformed data', async () => {
    global.fetch = jest.fn(() => Promise.resolve(malformedResponse()));

    const res = await request(app).get('/api/restaurants').query({ location: 'Norwich' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_MALFORMED');
  });

  it('returns 502 when the provider returns a server error', async () => {
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, { status: 500 })));

    const res = await request(app).get('/api/restaurants').query({ location: 'Norwich' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_ERROR');
  });
});

describe('GET /api/place-details', () => {
  it('returns the full field set for a known place', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        placeDetails: jsonResponse(
          placeDetailsBody({
            place_id: 'abc123',
            name: 'The Bicycle Shop',
            formatted: '2 St Benedicts St, Norwich, NR2 4AQ, United Kingdom',
            lat: 52.6305,
            lon: 1.2923,
            city: 'Norwich',
            postcode: 'NR2 4AQ',
            country: 'United Kingdom',
            opening_hours: 'Mo-Su 09:00-22:00',
            website: 'https://example.com',
            contact: { phone: '+44 1603 123456', email: 'hi@example.com' },
            cuisine: 'british',
            wheelchair: 'yes',
            capacity: 40,
            datasource: { sourcename: 'openstreetmap', attribution: '© OpenStreetMap contributors' },
          })
        ),
      })
    );

    const res = await request(app).get('/api/place-details').query({ id: 'abc123' });

    expect(res.status).toBe(200);
    expect(res.body.place).toMatchObject({
      placeId: 'abc123',
      name: 'The Bicycle Shop',
      openingHours: 'Mo-Su 09:00-22:00',
      website: 'https://example.com',
      phone: '+44 1603 123456',
      email: 'hi@example.com',
      cuisine: 'british',
      postcode: 'NR2 4AQ',
      city: 'Norwich',
    });

    // Fields the provider does not supply are reported as unavailable, not faked.
    expect(res.body.place.photo).toBeNull();
    expect(res.body.place.menu).toBeNull();
    expect(res.body.place.rating).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain(API_KEY);
  });

  it('returns 404 when the provider has no record for the id', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        placeDetails: jsonResponse({ type: 'FeatureCollection', features: [] }),
      })
    );

    const res = await request(app).get('/api/place-details').query({ id: 'missing' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLACE_NOT_FOUND');
    expect(res.body.place).toBeUndefined();
  });

  it('requires an id', async () => {
    const res = await request(app).get('/api/place-details');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY');
  });
});

describe('security', () => {
  it('never returns the API key in responses or error bodies', async () => {
    global.fetch = jest.fn(
      createGeoapifyFetch({
        geocode: jsonResponse(geocodeResultsBody([NORWICH])),
        places: jsonResponse(placesBody([{ placeId: 'p1', name: 'One', formatted: 'a', lat: 52.6, lon: 1.7 }])),
      })
    );

    const ok = await request(app).get('/api/restaurants').query({ location: 'Norwich' });
    expect(JSON.stringify(ok.body)).not.toContain(API_KEY);

    // Clear the caches so the failure path actually reaches the provider.
    geocodeCache.clear();
    placesCache.clear();

    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, { status: 500 })));
    const failure = await request(app).get('/api/restaurants').query({ location: 'Norwich' });
    expect(failure.status).toBe(502);
    expect(JSON.stringify(failure.body)).not.toContain(API_KEY);
    expect(failure.body.error).not.toHaveProperty('stack');
  });
});
