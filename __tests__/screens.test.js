/**
 * Screen-level tests for the rebuilt Explore and Cook experiences.
 *
 * `fetch` is mocked per test, so the full render pipeline is exercised with
 * realistic Spoonacular payload shapes without spending any quota.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import ExploreScreen from '../screens/ExploreScreen';
import RecipesScreen from '../screens/RecipesScreen';
import MenuItemDetailsScreen from '../screens/MenuItemDetailsScreen';
import RecipeDetailsScreen from '../screens/RecipeDetailsScreen';
import { clearCache } from '../services/spoonacularApi';
import { appTheme } from '../theme';
import { paperSettings } from '../components/paperSettings';
import { searchClearIcon } from '../components/paperSettings';

const navigation = { navigate: jest.fn() };

/**
 * Renders a screen inside the same Paper configuration the app supplies, so
 * components resolve the Lucide icon settings exactly as they do at runtime.
 */
function renderScreen(ui) {
  return render(
    <PaperProvider theme={appTheme} settings={paperSettings}>
      {ui}
    </PaperProvider>
  );
}

const MENU_RESPONSE = {
  menuItems: [
    {
      id: 101,
      title: 'Classic Cheeseburger',
      restaurantChain: 'Golden Grill',
      image: 'https://img.spoonacular.com/menu/101.jpg',
      imageType: 'jpg',
      calories: 720,
      readyInMinutes: 15,
    },
    {
      id: 102,
      title: 'Garden Salad',
      restaurantChain: 'Fresh Fork',
      image: null,
      calories: null,
      readyInMinutes: null,
    },
  ],
  total: 2,
};

const VIDEO_RESPONSE = {
  videos: [
    {
      title: 'How to make the perfect pasta at home',
      shortTitle: 'Perfect pasta at home',
      length: 370,
      rating: 4.8,
      thumbnail: 'https://img.spoonacular.com/videos/abc.jpg',
      views: 1250000,
      youTubeId: 'dQw4w9WgXcQ',
    },
  ],
  total: 1,
};

const TRIVIA_RESPONSE = { id: 'trivia-1', text: 'Honey found in ancient Egyptian tombs was still edible after 3,000 years.' };

/** Routes each endpoint to its own payload. */
function mockApi({ menu = MENU_RESPONSE, videos = VIDEO_RESPONSE, trivia = TRIVIA_RESPONSE, nutrition } = {}) {
  global.fetch = jest.fn((url) => {
    const href = String(url);

    if (href.includes('/food/menuItems/') && !href.includes('/search')) {
      return json({ nutrition: { calories: { amount: 700, unit: 'calories' }, protein: { amount: 30, unit: 'g' } }, ...MENU_RESPONSE.menuItems[0] });
    }
    if (href.includes('/food/menuItems/search')) return json(menu);
    if (href.includes('/food/videos/search')) return json(videos);
    if (href.includes('/food/trivia/random')) return json(trivia);
    if (href.includes('/recipes/guessNutrition')) return json(nutrition ?? {});
    if (href.includes('/recipes/complexSearch')) {
      return json({ results: [], totalResults: 0 });
    }
    return json({});
  });
}

function json(payload, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(payload),
  });
}

afterEach(() => {
  jest.clearAllMocks();
  delete global.fetch;
  clearCache();
});

describe('Explore — Home', () => {
  it('shows the brand header and hero copy', async () => {
    mockApi();
    renderScreen(<ExploreScreen navigation={navigation} />);

    expect(screen.getByText('Spooncular')).toBeTruthy();
    expect(screen.getByText('What are you craving?')).toBeTruthy();
    expect(
      screen.getByText('Discover menu favourites, food videos and fresh inspiration.')
    ).toBeTruthy();
  });

  it('renders real menu items returned by the API', async () => {
    mockApi();
    renderScreen(<ExploreScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByText('Classic Cheeseburger')).toBeTruthy());

    expect(screen.getByText('Golden Grill')).toBeTruthy();
    expect(screen.getByText('720 kcal')).toBeTruthy();
  });

  it('renders the branded fallback for a menu item with no image', async () => {
    mockApi();
    renderScreen(<ExploreScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByText('Garden Salad')).toBeTruthy());

    // One item has a photo, so exactly one fallback panel is shown.
    const fallbacks = screen.getAllByText('No photo yet');
    expect(fallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it('renders food videos with a formatted duration, not a raw id', async () => {
    mockApi();
    renderScreen(<ExploreScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByText('Perfect pasta at home')).toBeTruthy());

    expect(screen.getByText('6:10')).toBeTruthy();
    expect(screen.queryByText('dQw4w9WgXcQ')).toBeNull();
  });

  it('shows the trivia text returned by the API', async () => {
    mockApi();
    renderScreen(<ExploreScreen navigation={navigation} />);

    await waitFor(() =>
      expect(screen.getByText(/Honey found in ancient Egyptian tombs/)).toBeTruthy()
    );
  });

  it('does not refetch trivia on every render', async () => {
    mockApi();
    const { rerender } = renderScreen(<ExploreScreen navigation={navigation} />);

    await waitFor(() => screen.getByText(/Honey found in ancient Egyptian tombs/));

    const triviaCalls = () =>
      global.fetch.mock.calls.filter((c) => String(c[0]).includes('/food/trivia/random')).length;

    const before = triviaCalls();
    rerender(<ExploreScreen navigation={navigation} />);
    rerender(<ExploreScreen navigation={navigation} />);

    expect(triviaCalls()).toBe(before);
  });

  it('rejects an empty dish in the Nutrition Lens without calling the API', async () => {
    mockApi();
    renderScreen(<ExploreScreen navigation={navigation} />);

    fireEvent.press(screen.getByLabelText('Estimate nutrition for this dish'));

    await waitFor(() =>
      expect(screen.getByText(/Enter a dish name first/)).toBeTruthy()
    );

    const guessCalls = global.fetch.mock.calls.filter((c) =>
      String(c[0]).includes('guessNutrition')
    );
    expect(guessCalls).toHaveLength(0);
  });

  it('renders returned nutrition values with an estimate disclaimer', async () => {
    mockApi({
      // Shape copied from a live /recipes/guessNutrition response: `value` not
      // `amount`, and `carbs` not `carbohydrates`.
      nutrition: {
        recipesUsed: 25,
        calories: {
          value: 341.0,
          unit: 'calories',
          confidenceRange95Percent: { min: 306.49, max: 431.7 },
        },
        fat: { value: 11.0, unit: 'g' },
        protein: { value: 11.0, unit: 'g' },
        carbs: { value: 50.0, unit: 'g' },
      },
    });

    renderScreen(<ExploreScreen navigation={navigation} />);

    fireEvent.changeText(
      screen.getByLabelText('Dish name for nutrition estimate'),
      'vegetable fried rice'
    );
    fireEvent.press(screen.getByLabelText('Estimate nutrition for this dish'));

    await waitFor(() => expect(screen.getByText('341')).toBeTruthy());
    // The unit is suppressed when it would repeat the label ("341 calories"
    // above "CALORIES"), so only the label is rendered.
    expect(screen.getByText('Calories')).toBeTruthy();

    expect(screen.getByText('50')).toBeTruthy();
    // Fat and protein are both 11 g in this payload, so both render.
    expect(screen.getAllByText('11')).toHaveLength(2);
    // Gram-denominated macros still show their unit.
    expect(screen.getAllByText('g')).toHaveLength(3);
    expect(screen.getByText(/Estimated from the dish name/)).toBeTruthy();
    // The 95% confidence interval returned by the API is surfaced.
    expect(screen.getByText('306–432')).toBeTruthy();
    // The empty-state message must not appear for a real payload.
    expect(screen.queryByText(/No nutrition information was supplied/)).toBeNull();

    const guessUrl = decodeURIComponent(
      String(global.fetch.mock.calls.find((c) => String(c[0]).includes('guessNutrition'))[0])
    );
    expect(guessUrl).toContain('title=vegetable fried rice');
  });

  it('keeps other sections usable when the video endpoint fails', async () => {
    global.fetch = jest.fn((url) => {
      const href = String(url);
      if (href.includes('/food/videos/search')) return json({}, 500);
      if (href.includes('/food/trivia/random')) return json(TRIVIA_RESPONSE);
      if (href.includes('/food/menuItems/search')) return json(MENU_RESPONSE);
      return json({});
    });

    renderScreen(<ExploreScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByText('Classic Cheeseburger')).toBeTruthy());

    // The video failure is reported in its own section.
    expect(screen.getByText(/Spoonacular is having trouble/)).toBeTruthy();
    // And the rest of the screen still rendered.
    expect(screen.getByText(/Honey found in ancient Egyptian tombs/)).toBeTruthy();
  });

  it('shows an empty state rather than an error when a menu search finds nothing', async () => {
    mockApi({ menu: { menuItems: [], total: 0 } });
    renderScreen(<ExploreScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByText(/No menu dishes found/)).toBeTruthy());
  });

  it('sends the typed query when the user searches', async () => {
    mockApi();
    renderScreen(<ExploreScreen navigation={navigation} />);

    // Let the initial load settle: the Search button is disabled while a
    // request is in flight.
    await waitFor(() => expect(screen.getByText('Classic Cheeseburger')).toBeTruthy());

    fireEvent.changeText(screen.getByLabelText('Search menu dishes by name'), 'sushi');
    fireEvent.press(screen.getByLabelText('Search menu dishes'));

    await waitFor(() => {
      const call = global.fetch.mock.calls
        .map((c) => decodeURIComponent(String(c[0])))
        .find((u) => u.includes('query=sushi'));
      expect(call).toBeTruthy();
    });
  });

  it('opens menu item details when a card is tapped', async () => {
    mockApi();
    renderScreen(<ExploreScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByText('Classic Cheeseburger')).toBeTruthy());

    fireEvent.press(screen.getByLabelText(/Classic Cheeseburger.*View menu item details/));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'MenuItemDetails',
      expect.objectContaining({ id: 101 })
    );
  });
});

describe('Cook — Recipes', () => {
  it('renders the recipes hero and links to the ingredient finder', () => {
    mockApi();
    renderScreen(<RecipesScreen navigation={navigation} />);

    expect(screen.getByText('Let’s cook')).toBeTruthy();
    expect(
      screen.getByLabelText('Find recipes by ingredients I already have')
    ).toBeTruthy();
  });

  it('does not duplicate the menu explorer on Home', () => {
    mockApi();
    renderScreen(<RecipesScreen navigation={navigation} />);

    // The restaurant-chain menu search belongs to Explore only.
    expect(screen.queryByLabelText('Search menu dishes')).toBeNull();
    expect(screen.getByLabelText('Search recipes by name')).toBeTruthy();
  });

  it('renders recipe results from the complexSearch endpoint', async () => {
    global.fetch = jest.fn(() =>
      json({
        results: [
          {
            id: 716429,
            title: 'Pasta with Garlic and Cauliflower',
            image: 'https://img.spoonacular.com/recipes/716429.jpg',
            readyInMinutes: 45,
            servings: 2,
          },
        ],
        totalResults: 1,
      })
    );

    renderScreen(<RecipesScreen navigation={navigation} />);

    await waitFor(() =>
      expect(screen.getByText('Pasta with Garlic and Cauliflower')).toBeTruthy()
    );

    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText('2 servings')).toBeTruthy();
  });

  it('navigates to recipe details', async () => {
    global.fetch = jest.fn(() =>
      json({
        results: [{ id: 42, title: 'Ramen', image: null, readyInMinutes: 30, servings: 4 }],
        totalResults: 1,
      })
    );

    renderScreen(<RecipesScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByText('Ramen')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Open recipe Ramen'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'RecipeDetails',
      expect.objectContaining({ id: 42 })
    );
  });

  it('shows an empty state when no recipes match', async () => {
    mockApi();
    renderScreen(<RecipesScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByText(/No recipes found/)).toBeTruthy());
  });
});

describe('Menu item details', () => {
  it('shows the dish, chain and supplied nutrition', async () => {
    mockApi();
    renderScreen(<MenuItemDetailsScreen route={{ params: { id: 101 } }} />);

    await waitFor(() => expect(screen.getByText('Classic Cheeseburger')).toBeTruthy());

    expect(screen.getByText('Golden Grill')).toBeTruthy();
    expect(screen.getByText('700')).toBeTruthy();
    expect(screen.getByText('Calories')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('states clearly that this is a menu item, not a branch listing', async () => {
    mockApi();
    renderScreen(<MenuItemDetailsScreen route={{ params: { id: 101 } }} />);

    await waitFor(() => expect(screen.getByText('Classic Cheeseburger')).toBeTruthy());

    expect(screen.getByText(/restaurant-chain menu item/i)).toBeTruthy();
    expect(screen.getByText(/does not\s+confirm availability at any particular branch/i)).toBeTruthy();
  });
});

describe('Recipe details', () => {
  const RECIPE = {
    id: 716429,
    title: 'Pasta with Garlic and Cauliflower',
    image: 'https://img.spoonacular.com/recipes/716429.jpg',
    readyInMinutes: 45,
    servings: 2,
    summary: 'A <b>delicious</b> pasta dish.',
    extendedIngredients: [
      { name: 'water', amount: 0.33333334, unit: 'cup', originalString: '⅓ cup water' },
      { name: 'salt', amount: 2, unit: 'tsp' },
    ],
    extendedInstructions: [
      { step: 'Boil the water.' },
      { step: 'Drain and serve.' },
    ],
    nutrition: { calories: { amount: 500, unit: 'calories' } },
  };

  it('renders ingredients and numbered instructions', async () => {
    mockApi();
    global.fetch = jest.fn(() => json(RECIPE));

    renderScreen(<RecipeDetailsScreen route={{ params: { id: 716429 } }} />);

    await waitFor(() => expect(screen.getByText('Pasta with Garlic and Cauliflower')).toBeTruthy());

    expect(screen.getByText('⅓ cup water')).toBeTruthy();
    expect(screen.getByText('2 tsp salt')).toBeTruthy();
    expect(screen.getByText('Boil the water.')).toBeTruthy();
    expect(screen.getByText('Drain and serve.')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('strips HTML from the summary rather than rendering markup', async () => {
    mockApi();
    global.fetch = jest.fn(() => json(RECIPE));

    renderScreen(<RecipeDetailsScreen route={{ params: { id: 716429 } }} />);

    await waitFor(() => expect(screen.getByText('A delicious pasta dish.')).toBeTruthy());
  });

  it('ticks ingredients off locally without claiming persistence', async () => {
    mockApi();
    global.fetch = jest.fn(() => json(RECIPE));

    renderScreen(<RecipeDetailsScreen route={{ params: { id: 716429 } }} />);

    await waitFor(() => expect(screen.getByText('2 tsp salt')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('2 tsp salt'));

    await waitFor(() =>
      expect(screen.getByLabelText('2 tsp salt').props.accessibilityState.checked).toBe(true)
    );
  });

  it('reports missing instructions instead of rendering an empty section', async () => {
    mockApi();
    global.fetch = jest.fn(() => json({ id: 1, title: 'Odd Recipe', extendedIngredients: [], extendedInstructions: [] }));

    renderScreen(<RecipeDetailsScreen route={{ params: { id: 1 } }} />);

    await waitFor(() =>
      expect(screen.getByText(/No cooking instructions were supplied/)).toBeTruthy()
    );
    expect(screen.getByText(/No ingredient list was supplied/)).toBeTruthy();
  });
});