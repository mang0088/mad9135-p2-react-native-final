/**
 * Unit tests for the Spoonacular API client.
 *
 * `fetch` is mocked, so no real request is made and no quota is spent.
 * The API key is read from the environment and is never asserted on by value.
 */
import {
  buildUrl,
  redact,
  clearCache,
  normaliseIngredientInput,
  searchMenuItems,
  getFoodTrivia,
  SpoonacularError,
} from '../services/spoonacularApi';

function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key) => headers[key.toLowerCase()] ?? null },
    json: () => Promise.resolve(payload),
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
  // The client cache is module-level, so it would otherwise leak between tests
  // and mask which requests are actually issued.
  clearCache();
});

describe('URL construction', () => {
  it('encodes query values so input cannot break out of the query string', () => {
    const url = buildUrl('/food/menuItems/search', { query: 'chicken & rice=1' });
    expect(url).toContain('query=chicken%20%26%20rice%3D1');
  });

  it('omits empty, null and undefined parameters', () => {
    const url = buildUrl('/x', { a: 1, b: '', c: null, d: undefined });
    expect(url).toBe('https://api.spoonacular.com/x?a=1');
  });

  it('redacts the apiKey so authenticated URLs are safe to log', () => {
    const url = buildUrl('/x', { apiKey: 'SUPERSECRETVALUE123', q: 'a' });
    const safe = redact(url);

    expect(safe).not.toContain('SUPERSECRETVALUE123');
    expect(safe).toContain('apiKey=[redacted]');
    expect(safe).toContain('q=a');
  });
});

describe('Ingredient input normalisation', () => {
  it('trims, de-duplicates case-insensitively and drops blanks', () => {
    expect(normaliseIngredientInput('  Tomato , tomato ,  , garlic ')).toEqual([
      'Tomato',
      'garlic',
    ]);
  });

  it('accepts arrays and newline separated input', () => {
    expect(normaliseIngredientInput(['egg', 'egg\nrice'])).toEqual(['egg', 'rice']);
  });
});

describe('Menu item search', () => {
  it('requests the endpoint and returns normalised items', async () => {
    global.fetch = jest.fn(() =>
      jsonResponse({
        menuItems: [{ id: 1, title: 'Classic Burger', restaurantChain: 'Chain' }],
        total: 1,
      })
    );

    const result = await searchMenuItems('burger');

    const requested = decodeURIComponent(String(global.fetch.mock.calls[0][0]));
    expect(requested).toContain('/food/menuItems/search');
    expect(requested).toContain('query=burger');
    expect(result.menuItems).toHaveLength(1);
    expect(result.menuItems[0].title).toBe('Classic Burger');
  });

  it('clamps `number` to the documented 1-10 range', async () => {
    global.fetch = jest.fn(() => jsonResponse({ menuItems: [] }));

    await searchMenuItems('pizza', { number: 500 });
    expect(decodeURIComponent(String(global.fetch.mock.calls[0][0]))).toContain('number=10');

    await searchMenuItems('pizza', { number: 0 });
    const second = decodeURIComponent(String(global.fetch.mock.calls[1][0]));
    expect(second).toContain('number=1');
  });

  it('rejects an empty query without making a request', async () => {
    global.fetch = jest.fn();

    await expect(searchMenuItems('   ')).rejects.toBeInstanceOf(SpoonacularError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('tolerates a response with no menuItems array', async () => {
    global.fetch = jest.fn(() => jsonResponse({}));

    const result = await searchMenuItems('sushi');
    expect(result.menuItems).toEqual([]);
  });
});

describe('Error mapping', () => {
  const cases = [
    [401, 'INVALID_KEY'],
    [402, 'QUOTA_EXCEEDED'],
    [429, 'RATE_LIMIT'],
    [500, 'SERVER_ERROR'],
  ];

  it.each(cases)('maps HTTP %s to %s', async (status, code) => {
    global.fetch = jest.fn(() => jsonResponse({}, { status }));

    await expect(searchMenuItems('pizza')).rejects.toMatchObject({ code });
  });

  it('marks quota, rate-limit and server errors as retryable', async () => {
    global.fetch = jest.fn(() => jsonResponse({}, { status: 429 }));

    await expect(searchMenuItems('pizza')).rejects.toMatchObject({
      code: 'RATE_LIMIT',
      retryable: true,
    });
  });

  it('does not mark a bad key as retryable', async () => {
    global.fetch = jest.fn(() => jsonResponse({}, { status: 401 }));

    await expect(searchMenuItems('pizza')).rejects.toMatchObject({
      code: 'INVALID_KEY',
      retryable: false,
    });
  });

  it('maps a transport failure to NETWORK', async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(searchMenuItems('pizza')).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('never leaks the key in the error message or stack', async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    const key = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY;
    expect(key).toBeTruthy();

    const err = await searchMenuItems('pizza').catch((caught) => caught);

    expect(err).toBeInstanceOf(SpoonacularError);
    expect(err.message).not.toContain(key);
    expect(String(err.stack)).not.toContain(key);
  });
});

describe('Caching', () => {
  it('serves trivia from cache so the fact of the day is stable', async () => {
    global.fetch = jest.fn(() => jsonResponse({ text: 'Honey never spoils.' }));

    const first = await getFoodTrivia();
    const second = await getFoodTrivia();

    expect(first.text).toBe('Honey never spoils.');
    expect(second.text).toBe('Honey never spoils.');
    // One request served both calls.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache when force is used for an explicit refresh', async () => {
    global.fetch = jest.fn(() => jsonResponse({ text: 'Fact A' }));

    await getFoodTrivia();
    await getFoodTrivia({ force: true });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});