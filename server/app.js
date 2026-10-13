'use strict';

const express = require('express');
const cors = require('cors');

const { AppError, locationNotFound, invalidQuery } = require('./errors');
const {
  geocode,
  searchRestaurants,
  getPlaceDetails,
  toRestaurantModels,
  toRestaurantDetails,
  DEFAULT_RADIUS_M,
} = require('./geoapify');
const {
  parseRestaurantQuery,
  parseGeocodeQuery,
  parsePlaceDetailsQuery,
} = require('./validation');

/** Tags an error with the pipeline stage that failed so logs can distinguish
 *  geocoding failures from Places API failures. The tag is never sent to clients. */
function withStage(error, stage) {
  if (error instanceof AppError && !error.stage) {
    error.stage = stage;
  }
  return error;
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());

  // Request logging. Only the path is logged: the query string can contain user
  // input and the Geoapify request URLs (which carry the API key) are never logged.
  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const startedAt = Date.now();
      res.on('finish', () => {
        console.log(
          `[server] ${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - startedAt}ms)`
        );
      });
      next();
    });
  }

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  /**
   * Resolves a place name / postcode into candidate coordinates so the user can
   * pick the right one when several places match.
   */
  app.get('/api/geocode', async (req, res, next) => {
    try {
      const { text, limit } = parseGeocodeQuery(req.query);

      let candidates;
      try {
        candidates = await geocode(text, { limit });
      } catch (err) {
        throw withStage(err, 'geocoding');
      }

      if (candidates.length === 0) {
        throw locationNotFound(text);
      }

      res.json({ query: text, count: candidates.length, candidates });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Returns nearby restaurants for a location.
   *
   * Either `location` (a place name/postcode, geocoded via Geoapify Forward
   * Geocoding) or an explicit `lat`/`lon` pair (when the user picked a specific
   * candidate) is accepted.
   */
  app.get('/api/restaurants', async (req, res, next) => {
    try {
      const { location, lat, lon, radius, limit, locationLabel } = parseRestaurantQuery(
        req.query
      );

      let origin;
      let candidates = [];
      let ambiguous = false;

      if (location) {
        try {
          candidates = await geocode(location, { limit: 5 });
        } catch (err) {
          throw withStage(err, 'geocoding');
        }

        if (candidates.length === 0) {
          // Unknown location: no Places request is made.
          throw locationNotFound(location);
        }

        origin = candidates[0];
        ambiguous = candidates.length > 1;
      } else {
        origin = {
          placeId: null,
          label: locationLabel,
          name: null,
          type: null,
          postcode: null,
          country: null,
          lat,
          lon,
        };
      }

      let places;
      try {
        places = await searchRestaurants({
          lat: origin.lat,
          lon: origin.lon,
          radius,
          limit,
        });
      } catch (err) {
        throw withStage(err, 'places');
      }

      const restaurants = toRestaurantModels(places);

      res.json({
        origin: {
          placeId: origin.placeId,
          label: origin.label,
          name: origin.name,
          type: origin.type,
          lat: origin.lat,
          lon: origin.lon,
        },
        candidates,
        ambiguous,
        radius,
        limit,
        count: restaurants.length,
        restaurants,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Full record for one restaurant. This is where OpenStreetMap-backed opening
   * hours, website and phone numbers are available (when the place has them).
   */
  app.get('/api/place-details', async (req, res, next) => {
    try {
      const { id } = parsePlaceDetailsQuery(req.query);

      let place;
      try {
        place = await getPlaceDetails(id);
      } catch (err) {
        throw withStage(err, 'place-details');
      }

      if (!place) {
        throw new AppError('PLACE_NOT_FOUND', 'No details were found for that place.', 404);
      }

      res.json({ place: toRestaurantDetails(place) });
    } catch (err) {
      next(err);
    }
  });

  app.use((req, res, next) => {
    next(invalidQuery(`Unknown endpoint: ${req.method} ${req.path}`));
  });

  // Central error handler. Internal failures return a generic message so stack
  // traces and upstream URLs are never exposed to the client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const isAppError = err instanceof AppError;
    const status = isAppError ? err.status : 500;
    const code = isAppError ? err.code : 'INTERNAL_ERROR';
    const message = isAppError && err.expose ? err.message : 'Unexpected server error.';

    if (status >= 500) {
      const stage = isAppError && err.stage ? ` stage=${err.stage}` : '';
      console.error(
        `[server] ${code}${stage} on ${req.method} ${req.path}:`,
        isAppError ? err.message : err && err.name
      );
    }

    const body = { error: { code, message } };
    if (isAppError && err.retryAfter) body.error.retryAfter = err.retryAfter;

    return res.status(status).json(body);
  });

  return app;
}

module.exports = { createApp, DEFAULT_RADIUS_M };
