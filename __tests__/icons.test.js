/**
 * Guards against silently broken icons.
 *
 * A Lucide name that does not exist is `undefined`, which React only reports as
 * "Element type is invalid" at render time - far from the import that caused
 * it. These tests resolve every icon name the app imports and fail fast
 * instead.
 *
 * Note: lucide-react-native components are React.forwardRef *objects*, not
 * plain functions, so existence is checked with a null check plus
 * isValidElement on the rendered output.
 */
import React from 'react';
import { isValidElement } from 'react';
import * as Lucide from 'lucide-react-native';
import { paperSettings, searchClearIcon } from '../components/paperSettings';

const ICONS_USED = {
  'components/BrandHeader': ['Soup'],
  'components/FoodTriviaCard': ['Lightbulb', 'RefreshCw'],
  'components/FoodVideoCard': ['Play'],
  'components/MediaImage': ['CookingPot', 'Utensils'],
  'components/MenuItemCard': ['Flame', 'Utensils'],
  'components/NutritionSummary': ['Info'],
  'components/RecipeCard': ['Clock', 'UsersRound'],
  'components/paperSettings': [
    'Calendar',
    'Check',
    'ChevronDown',
    'ChevronRight',
    'Menu',
    'Minus',
    'Search',
    'X',
  ],
  'assets/icons': ['ChefHat', 'Compass'],
  'screens/ExploreScreen': ['Calculator', 'Search', 'UtensilsCrossed'],
  'screens/IngredientFinderScreen': ['Carrot', 'Plus', 'X'],
  'screens/RecipesScreen': ['Carrot', 'Search'],
  'screens/RecipeDetailsScreen': ['Check', 'Clock', 'UsersRound'],
  'navigation/RootNavigator': ['ChefHat', 'Compass'],
};

describe('Lucide icon imports', () => {
  it.each(Object.entries(ICONS_USED))(
    '%s only imports icons that exist',
    (_module, names) => {
      const missing = names.filter((name) => Lucide[name] == null);
      expect(missing).toEqual([]);
    }
  );

  it('renders every Paper icon name it maps', () => {
    for (const name of ['magnify', 'close', 'menu', 'checkbox-marked', 'calendar']) {
      const element = paperSettings.icon({ name, color: '#000', size: 24 });
      expect(isValidElement(element)).toBe(true);
    }
  });

  it('falls back to a real glyph for an unmapped Paper icon name', () => {
    const element = paperSettings.icon({
      name: 'some-icon-that-does-not-exist',
      color: '#000',
      size: 24,
    });
    // Must not be null: null would make Paper fall back to its own bundled
    // MaterialCommunityIcons renderer, breaking the single-library rule.
    expect(isValidElement(element)).toBe(true);
  });

  it('provides a Lucide clear icon for Searchbar', () => {
    expect(isValidElement(searchClearIcon({ size: 22, color: '#000' }))).toBe(true);
  });

  it('does not rely on Close/Magnify/MenuDown, which this Lucide version lacks', () => {
    // Regression guard: these were used before and resolved to undefined.
    for (const name of ['Close', 'Magnify', 'MenuDown']) {
      expect(Lucide[name]).toBeUndefined();
    }
  });
});