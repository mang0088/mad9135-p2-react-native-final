'use strict';

/**
 * A single error type used across the backend. `expose` controls whether the
 * message is safe to return to the client. Internal failures keep a generic
 * message so stack traces, upstream URLs (which contain the API key) and other
 * internals are never leaked.
 */
class AppError extends Error {
  constructor(code, message, status = 500, options = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.expose = options.expose !== false;
    this.retryAfter = options.retryAfter;
  }
}

const configMissingKey = () =>
  new AppError(
    'CONFIG_MISSING_KEY',
    'Restaurant search is not configured on the server.',
    503
  );

const invalidQuery = (message) => new AppError('INVALID_QUERY', message, 400);

const locationNotFound = (query) =>
  new AppError(
    'LOCATION_NOT_FOUND',
    `No location matched "${query}". Try a town, city or postcode.`,
    404
  );

const upstreamTimeout = () =>
  new AppError('UPSTREAM_TIMEOUT', 'The maps provider timed out.', 504);

const upstreamUnreachable = () =>
  new AppError('UPSTREAM_UNREACHABLE', 'Could not reach the maps provider.', 502);

const upstreamAuth = () =>
  new AppError('UPSTREAM_AUTH', 'The maps provider rejected the request.', 502);

const upstreamRateLimited = (retryAfter) =>
  new AppError(
    'UPSTREAM_RATE_LIMIT',
    'The maps provider rate limit was reached. Please try again shortly.',
    503,
    { retryAfter }
  );

const upstreamError = (status) =>
  new AppError('UPSTREAM_ERROR', `The maps provider returned status ${status}.`, 502);

const upstreamMalformed = () =>
  new AppError('UPSTREAM_MALFORMED', 'The maps provider returned malformed data.', 502);

module.exports = {
  AppError,
  configMissingKey,
  invalidQuery,
  locationNotFound,
  upstreamTimeout,
  upstreamUnreachable,
  upstreamAuth,
  upstreamRateLimited,
  upstreamError,
  upstreamMalformed,
};
