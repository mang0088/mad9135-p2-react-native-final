/**
 * App-level regression tests.
 *
 * The Home screen now talks to the local backend (`server/`), which proxies
 * Geoapify. The backend payload is mocked here so the render pipeline can be
 * verified without a live API key.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import App from '../App';
import HomeScreen from '../screens/HomeScreen';
import ListScreen from '../screens/ListScreen';
import DetailScreen from '../screens/Detail';
import { buildQueryString, getApiBaseUrl } from '../services/restaurantApi';

const NORWICH_ORIGIN = {
  placeId: 'geo-1',
  label: 'Norwich, Norfolk, England, United Kingdom',
  name: 'Norwich',
  type: 'city',
  postcode: null,
  country: 'United Kingdom',
  lat: 52.6309,
  lon: 1.2974,
};

const RESTAURANTS_RESPONSE = {
  origin: { ...NORWICH_ORIGIN },
  candidates: [{ ...NORWICH_ORIGIN }],
  ambiguous: false,
  radius: 5000,
  limit: 20,
  count: 2,
  restaurants: [
    {
      placeId: 'p1',
      name: 'Cafe One',
      address: '1 High St, Norwich NR1 1AA',
      lat: 52.63,
      lon: 1.29,
      categories: ['catering.restaurant', 'catering.restaurant.british'],
      distance: 250,
      phone: null,
      hours: null,
      photo: null,
      rating: null,
      source: 'geoapify',
    },
    {
      placeId: 'p2',
      name: 'Bistro Two',
      address: '2 High St, Norwich NR1 1AB',
      lat: 52.631,
      lon: 1.291,
      categories: ['catering.restaurant'],
      distance: 1480,
      phone: null,
      hours: null,
      photo: null,
      rating: null,
      source: 'geoapify',
    },
  ],
};

const AMBIGUOUS_RESPONSE = {
  ...RESTAURANTS_RESPONSE,
  ambiguous: true,
  candidates: [
    { ...NORWICH_ORIGIN },
    {
      placeId: 'geo-2',
      label: 'Norwich, Connecticut, United States',
      name: 'Norwich',
      type: 'city',
      lat: 41.5243,
      lon: -72.0759,
    },
  ],
};

const RECIPE_LIST_RESPONSE = {
  results: [
    {
      id: 716429,
      title: 'Pasta with Garlic and Cauliflower',
      image: 'pasta-with-garlic-716429.jpg',
      imageType: 'jpg',
      readyInMinutes: 45,
      servings: 2,
    },
  ],
};

const INGREDIENTS_RESPONSE = {
  ingredients: [
    {
      name: 'butter',
      image: 'butter-sliced.jpg',
      amount: { metric: { value: 1, unit: 'Tbsp' }, us: { value: 1, unit: 'Tbsp' } },
    },
  ],
};

function mockFetchJson(payload) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(payload),
    })
  );
}

function mockFetchError(status, error) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ error }),
    })
  );
}

const DETAILS_RESPONSE = {
  place: {
    placeId: 'p1',
    name: 'The Bicycle Shop',
    address: '2 St Benedicts St, Norwich NR2 4AG, United Kingdom',
    addressLine1: '2 St Benedicts St',
    city: 'Norwich',
    postcode: 'NR2 4AG',
    country: 'United Kingdom',
    lat: 52.6305,
    lon: 1.2923,
    categories: ['catering.restaurant', 'catering.restaurant.british'],
    cuisine: 'british',
    openingHours: 'Mo-Su 09:00-22:00',
    website: 'https://example.com',
    phone: '+44 1603 123456',
    email: 'hi@example.com',
    wheelchair: 'yes',
    capacity: 40,
    distance: 250,
    datasource: { source: 'openstreetmap', attribution: '© OpenStreetMap contributors' },
    photo: null,
    menu: null,
    rating: null,
    reviews: null,
    source: 'geoapify',
  },
};

function searchFor(text) {
  fireEvent.changeText(screen.getByPlaceholderText('City, town or postcode'), text);
  fireEvent.press(screen.getByText('Submit'));
}

/** Routes the search and details requests to different payloads. */
function mockFetchByPath({ restaurants, details, detailsStatus = 200 }) {
  global.fetch = jest.fn((url) => {
    const href = String(url);
    const body = href.includes('/api/place-details') ? details : restaurants;
    const ok = !href.includes('/api/place-details') || detailsStatus === 200;
    return Promise.resolve({
      ok,
      status: ok ? 200 : detailsStatus,
      json: () => Promise.resolve(body),
    });
  });
}

afterEach(() => {
  jest.clearAllMocks();
  delete global.fetch;
});

describe('Home screen - restaurant search', () => {
  it('geocodes a place name and renders the returned restaurants', async () => {
    mockFetchJson(RESTAURANTS_RESPONSE);

    render(<HomeScreen />);
    searchFor('Norwich');

    await waitFor(() => {
      expect(screen.getByText('Cafe One')).toBeTruthy();
    });

    expect(screen.getByText('Bistro Two')).toBeTruthy();
    expect(screen.getByText(/Showing restaurants near Norwich/)).toBeTruthy();

    const requested = String(global.fetch.mock.calls[0][0]);
    expect(requested).toContain('/api/restaurants');
    expect(requested).toContain('location=Norwich');
    expect(requested).toContain('radius=5000');
  });

  it('renders a postcode search', async () => {
    mockFetchJson(RESTAURANTS_RESPONSE);

    render(<HomeScreen />);
    searchFor('NR30 1AB');

    await waitFor(() => {
      expect(screen.getByText('Cafe One')).toBeTruthy();
    });

    expect(String(global.fetch.mock.calls[0][0])).toContain('location=NR30%201AB');
  });

  it('shows distance and category when the provider supplies them', async () => {
    mockFetchJson(RESTAURANTS_RESPONSE);

    render(<HomeScreen />);
    searchFor('Norwich');

    await waitFor(() => {
      expect(screen.getByText(/250 m away/)).toBeTruthy();
    });
    expect(screen.getByText(/British/)).toBeTruthy();
  });

  it('does not crash when optional properties are missing', async () => {
    mockFetchJson({
      ...RESTAURANTS_RESPONSE,
      restaurants: [
        {
          placeId: null,
          name: 'Unnamed place',
          address: 'Address unavailable',
          lat: 52.6,
          lon: 1.7,
          categories: [],
          distance: null,
          phone: null,
          hours: null,
          photo: null,
          rating: null,
          source: 'geoapify',
        },
      ],
    });

    render(<HomeScreen />);
    searchFor('Norwich');

    await waitFor(() => {
      expect(screen.getByText('Unnamed place')).toBeTruthy();
    });
    expect(screen.getByText(/Address unavailable/)).toBeTruthy();
  });

  it('shows an empty state without fabricating data when nothing is nearby', async () => {
    mockFetchJson({ ...RESTAURANTS_RESPONSE, count: 0, restaurants: [] });

    render(<HomeScreen />);
    searchFor('Norwich');

    await waitFor(() => {
      expect(screen.getByText(/No restaurants found nearby/)).toBeTruthy();
    });
  });

  it('validates empty input and does not call the API', () => {
    global.fetch = jest.fn();

    render(<HomeScreen />);
    fireEvent.press(screen.getByText('Submit'));

    expect(screen.getByText(/Enter a place name or postcode/)).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows a server error message and a retry action', async () => {
    mockFetchError(404, {
      code: 'LOCATION_NOT_FOUND',
      message: 'No location matched "Nowhereatall". Try a town, city or postcode.',
    });

    render(<HomeScreen />);
    searchFor('Nowhereatall');

    await waitFor(() => {
      expect(screen.getByText(/No location matched/)).toBeTruthy();
    });
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('reports an unreachable backend clearly', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network request failed')));

    render(<HomeScreen />);
    searchFor('Norwich');

    await waitFor(() => {
      expect(screen.getByText(/Could not reach the restaurant service/)).toBeTruthy();
    });
  });

  it('lets the user pick a different match when several places are plausible', async () => {
    mockFetchJson(AMBIGUOUS_RESPONSE);

    render(<HomeScreen />);
    searchFor('Norwich');

    await waitFor(() => {
      expect(screen.getByText(/Pick another match/)).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Norwich, Connecticut, United States'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    const secondRequest = String(global.fetch.mock.calls[1][0]);
    expect(secondRequest).toContain('lat=41.5243');
    expect(secondRequest).toContain('lon=-72.0759');
    expect(secondRequest).not.toContain('location=');
  });

  it('shows a loading state while the request is in flight', async () => {
    let resolveFetch;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(RESTAURANTS_RESPONSE),
            });
        })
    );

    render(<HomeScreen />);
    searchFor('Norwich');

    expect(screen.getByText(/Searching for restaurants/)).toBeTruthy();

    resolveFetch();

    await waitFor(() => {
      expect(screen.getByText('Cafe One')).toBeTruthy();
    });
  });
});

describe('Home screen - restaurant details fields', () => {
  it('shows the full field list the provider supplies', async () => {
    mockFetchByPath({ restaurants: RESTAURANTS_RESPONSE, details: DETAILS_RESPONSE });

    render(<HomeScreen />);
    searchFor('Norwich');

    await waitFor(() => {
      expect(screen.getByText('Cafe One')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('Details')[0]);

    await waitFor(() => {
      expect(screen.getByText('The Bicycle Shop')).toBeTruthy();
    });

    expect(screen.getByText('Mo-Su 09:00-22:00')).toBeTruthy();
    expect(screen.getByText('+44 1603 123456')).toBeTruthy();
    expect(screen.getByText('https://example.com')).toBeTruthy();
    expect(screen.getByText('british')).toBeTruthy();
    expect(screen.getByText('250 m away')).toBeTruthy();
    expect(screen.getByText(/OpenStreetMap contributors/)).toBeTruthy();

    const detailsUrl = String(global.fetch.mock.calls[1][0]);
    expect(detailsUrl).toContain('/api/place-details');
    expect(detailsUrl).toContain('id=p1');
  });

  it('states that photos and menus are unavailable instead of inventing them', async () => {
    mockFetchByPath({ restaurants: RESTAURANTS_RESPONSE, details: DETAILS_RESPONSE });

    render(<HomeScreen />);
    searchFor('Norwich');

    await waitFor(() => {
      expect(screen.getByText('Cafe One')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('Details')[0]);

    await waitFor(() => {
      expect(screen.getByText('The Bicycle Shop')).toBeTruthy();
    });

    expect(screen.getByText(/Photos and menus are not available/)).toBeTruthy();
    expect(screen.queryByText('Rating')).toBeNull();
    expect(screen.queryByText('Menu')).toBeNull();
  });

  it('reports opening hours as unavailable when the place has no such tag', async () => {
    mockFetchByPath({
      restaurants: RESTAURANTS_RESPONSE,
      details: { place: { ...DETAILS_RESPONSE.place, openingHours: null } },
    });

    render(<HomeScreen />);
    searchFor('Norwich');

    await waitFor(() => {
      expect(screen.getByText('Cafe One')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('Details')[0]);

    await waitFor(() => {
      expect(screen.getByText('Not available for this place')).toBeTruthy();
    });
  });

  it('surfaces a details failure without losing the result list', async () => {
    mockFetchByPath({
      restaurants: RESTAURANTS_RESPONSE,
      details: { error: { code: 'PLACE_NOT_FOUND', message: 'No details were found for that place.' } },
      detailsStatus: 404,
    });

    render(<HomeScreen />);
    searchFor('Norwich');

    await waitFor(() => {
      expect(screen.getByText('Cafe One')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('Details')[0]);

    await waitFor(() => {
      expect(screen.getByText(/No details were found for that place/)).toBeTruthy();
    });

    expect(screen.getByText('Cafe One')).toBeTruthy();
  });
});

describe('Restaurant API client', () => {
  it('encodes query parameters safely', () => {
    expect(buildQueryString({ location: 'NR30 1AB', radius: 5000 })).toBe(
      'location=NR30%201AB&radius=5000'
    );

    expect(buildQueryString({ location: 'Norwich, Norfolk & Broadland' })).toBe(
      'location=Norwich%2C%20Norfolk%20%26%20Broadland'
    );
  });

  it('omits empty parameters', () => {
    expect(buildQueryString({ radius: 5000, locationLabel: '', location: undefined })).toBe(
      'radius=5000'
    );
  });

  it('resolves a backend base URL', () => {
    expect(getApiBaseUrl()).toMatch(/^https?:\/\//);
  });
});

describe('Recipe screens (existing Spoonacular features)', () => {
  it('renders recipes returned by the API', async () => {
    mockFetchJson(RECIPE_LIST_RESPONSE);

    render(<ListScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText('Pasta with Garlic and Cauliflower')).toBeTruthy();
    });
  });

  it('shows an empty state when the API returns no recipes', async () => {
    mockFetchJson({ results: [] });

    render(<ListScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText(/no recipes found/i)).toBeTruthy();
    });
  });

  it('navigates to the detail screen with the recipe id', async () => {
    mockFetchJson(RECIPE_LIST_RESPONSE);
    const navigate = jest.fn();

    render(<ListScreen navigation={{ navigate }} />);

    await waitFor(() => {
      expect(screen.getByText('Pasta with Garlic and Cauliflower')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Pasta with Garlic and Cauliflower'));

    expect(navigate).toHaveBeenCalledWith('Ingredients', { id: 716429 });
  });

  it('renders ingredients returned by the API', async () => {
    mockFetchJson(INGREDIENTS_RESPONSE);

    render(<DetailScreen route={{ params: { id: 716429 } }} />);

    await waitFor(() => {
      expect(screen.getByText('butter')).toBeTruthy();
    });
  });

  it('shows an error state when the request fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network request failed')));

    render(<DetailScreen route={{ params: { id: 716429 } }} />);

    await waitFor(() => {
      expect(screen.getByText(/could not load ingredients/i)).toBeTruthy();
    });
  });
});

describe('Tab bar navigation', () => {
  it('renders an icon with a valid name for every tab', async () => {
    render(<App />);

    const icons = screen.UNSAFE_getAllByType(Ionicons);
    expect(icons.length).toBeGreaterThanOrEqual(2);

    icons.forEach((icon) => {
      expect(icon.props.name).toBeTruthy();
    });
  });

  it('uses a list icon for the Recipes tab', async () => {
    render(<App />);

    const names = screen.UNSAFE_getAllByType(Ionicons).map((icon) => icon.props.name);

    expect(names).toEqual(
      expect.arrayContaining([expect.stringMatching(/^home/), expect.stringMatching(/^list/)])
    );
  });
});
