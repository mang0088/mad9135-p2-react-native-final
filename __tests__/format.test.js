/**
 * Unit tests for display formatting.
 *
 * These guard the rules the UI depends on: no invented units, no silent
 * conversions, no raw YouTube ids as titles, and no broken-precision numbers.
 */
import {
  cleanText,
  formatDuration,
  formatIngredient,
  formatMacro,
  formatMinutes,
  formatQuantity,
  humaniseKey,
  normaliseImageUrl,
  splitNutrition,
  youtubeWatchUrl,
} from '../utils/format';

describe('Durations', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(370)).toBe('6:10');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(60)).toBe('1:00');
  });

  it('returns null for missing or nonsensical values', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration('abc')).toBeNull();
  });

  it('formats minutes as minutes or hours', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(80)).toBe('1 h 20 min');
    expect(formatMinutes(0)).toBeNull();
  });
});

describe('Quantity formatting', () => {
  it('converts a float artefact into the fraction it represents', () => {
    // Spoonacular returns binary-float noise for a third of a cup.
    expect(formatQuantity(0.33333334, 'cup')).toBe('⅓ cup');
  });

  it('handles the other common kitchen fractions', () => {
    expect(formatQuantity(0.5, 'cup')).toBe('½ cup');
    expect(formatQuantity(0.25, 'cup')).toBe('¼ cup');
    expect(formatQuantity(0.75, 'cup')).toBe('¾ cup');
    expect(formatQuantity(0.125, 'tsp')).toBe('⅛ tsp');
  });

  it('renders mixed numbers readably', () => {
    expect(formatQuantity(1.5, 'cup')).toBe('1 ½ cup');
    expect(formatQuantity(2.25, 'cup')).toBe('2 ¼ cup');
  });

  it('keeps whole numbers whole', () => {
    expect(formatQuantity(2, 'cups')).toBe('2 cups');
    expect(formatQuantity(1, 'tbsp')).toBe('1 tbsp');
  });

  it('never rewrites the supplied unit', () => {
    // The unit is echoed verbatim - not pluralised, not case-changed.
    expect(formatQuantity(1, 'cup')).toBe('1 cup');
    expect(formatQuantity(0.5, 'Cup')).toBe('½ Cup');
    expect(formatQuantity(3, 'g')).toBe('3 g');
  });

  it('omits the separator when no unit was supplied', () => {
    expect(formatQuantity(2, '')).toBe('2');
    expect(formatQuantity(0.5, null)).toBe('½');
  });

  it('rounds only when the value is not a recognised fraction', () => {
    expect(formatQuantity(0.1234567, 'cup')).toBe('0.12 cup');
    expect(formatQuantity(12.3456, 'g')).toBe('12.35 g');
  });

  it('returns null for unusable input', () => {
    expect(formatQuantity(null, 'cup')).toBeNull();
    expect(formatQuantity('abc', 'cup')).toBeNull();
  });

  it('does not silently convert between measurement systems', () => {
    // A metric value keeps its metric unit; no fl-oz substitution happens.
    expect(formatQuantity(240, 'ml')).toBe('240 ml');
  });
});

describe('Ingredient formatting', () => {
  it('prefers the preformatted string the API supplies', () => {
    expect(
      formatIngredient({ name: 'flour', amount: 2, unit: 'cup', originalString: '2 cups flour' })
    ).toBe('2 cups flour');
  });

  it('builds a readable line when only amount and name exist', () => {
    expect(formatIngredient({ name: 'flour', amount: 1.5, unit: 'cup' })).toBe(
      '1 ½ cup flour'
    );
  });

  it('falls back to the bare name when there is no amount', () => {
    expect(formatIngredient({ name: 'salt' })).toBe('salt');
  });

  it('returns null when there is no usable name', () => {
    expect(formatIngredient({ amount: 1 })).toBeNull();
    expect(formatIngredient(null)).toBeNull();
  });
});

describe('Nutrition', () => {
  /**
   * Verified against the live /recipes/guessNutrition response, which uses
   * `value` (not `amount`), a `carbs` key (not `carbohydrates`) and a
   * confidenceRange95Percent object. Getting this shape wrong made the
   * Nutrition Lens render nothing at all.
   */
  const guessPayload = {
    recipesUsed: 25,
    calories: {
      value: 341.0,
      unit: 'calories',
      confidenceRange95Percent: { min: 306.49, max: 431.7 },
      standardDeviation: 159.71,
    },
    fat: {
      value: 11.0,
      unit: 'g',
      confidenceRange95Percent: { min: 9.05, max: 14.99 },
    },
    protein: {
      value: 11.0,
      unit: 'g',
      confidenceRange95Percent: { min: 9.61, max: 20.66 },
    },
    carbs: {
      value: 50.0,
      unit: 'g',
      confidenceRange95Percent: { min: 43.71, max: 60.03 },
    },
  };

  it('reads the guessNutrition shape, which uses `value` not `amount`', () => {
    const { headline } = splitNutrition(guessPayload);

    // Order follows the headline key list: calories, protein, carbs, fat.
    expect(headline.map((h) => h.key)).toEqual([
      'calories',
      'protein',
      'carbs',
      'fat',
    ]);
    expect(headline.map((h) => h.amount)).toEqual([341, 11, 50, 11]);
    expect(headline.map((h) => h.unit)).toEqual(['calories', 'g', 'g', 'g']);
  });

  it('labels the `carbs` key as carbs', () => {
    const { headline } = splitNutrition(guessPayload);
    const carbs = headline.find((h) => h.key === 'carbs');
    expect(carbs.label).toBe('Carbs');
  });

  it('surfaces the 95% confidence range when supplied', () => {
    const { headline } = splitNutrition(guessPayload);
    const calories = headline.find((h) => h.key === 'calories');
    expect(calories.range).toEqual({ min: 306.49, max: 431.7 });
  });

  it('also accepts the `amount` shape used by recipe/menu nutrition', () => {
    const { headline } = splitNutrition({
      calories: { amount: 650, unit: 'calories' },
      protein: { amount: 25.3, unit: 'g' },
      carbohydrates: { amount: 72.1, unit: 'g' },
      fat: { amount: 28.44, unit: 'g' },
    });

    expect(headline).toHaveLength(4);
    expect(headline.find((h) => h.key === 'calories').amount).toBe(650);
    expect(headline.find((h) => h.key === 'carbohydrates').label).toBe('Carbs');
  });

  it('lists remaining nutrients separately', () => {
    const { rest } = splitNutrition({
      calories: { amount: 650, unit: 'calories' },
      sugar: { amount: 4.2, unit: 'g' },
      sodium: { amount: 1.2, unit: 'g' },
    });
    expect(rest.map((r) => r.key)).toEqual(expect.arrayContaining(['sugar', 'sodium']));
  });

  it('returns nothing when no nutrition was supplied', () => {
    const { headline, rest } = splitNutrition(undefined);
    expect(headline).toEqual([]);
    expect(rest).toEqual([]);
  });

  it('ignores non-numeric metadata keys such as recipesUsed', () => {
    const { headline, rest } = splitNutrition({ ...guessPayload, recipesUsed: 25 });
    expect(rest.map((r) => r.key)).not.toContain('recipesUsed');
    expect(headline).toHaveLength(4);
  });

  it('formats macros without overstating precision', () => {
    expect(formatMacro(650, 'calories')).toBe('650 calories');
    expect(formatMacro(6.44, 'g')).toBe('6.4 g');
    expect(formatMacro(25.3, 'g')).toBe('25 g');
    expect(formatMacro(null)).toBeNull();
  });

  it('humanises API keys for display', () => {
    expect(humaniseKey('totalFat')).toBe('Total fat');
    expect(humaniseKey('sugars')).toBe('Sugars');
    expect(humaniseKey('saturated_fat')).toBe('Saturated fat');
  });
});

describe('HTML entities in API text', () => {
  it('decodes named entities', () => {
    expect(cleanText('Pepperoni Lover\'s&reg - Large')).toBe("Pepperoni Lover's® - Large");
    expect(cleanText('Salt &amp; Pepper')).toBe('Salt & Pepper');
    expect(cleanText('50&#37; off')).toBe('50% off');
  });

  it('leaves unknown entities untouched rather than mangling them', () => {
    expect(cleanText('A &notarealentity; B')).toBe('A &notarealentity; B');
  });

  it('never returns markup', () => {
    expect(cleanText('<b>Bold</b> &amp; tasty')).toBe('Bold & tasty');
  });
});

describe('Image and video URLs', () => {
  it('accepts only absolute http(s) image URLs', () => {
    expect(normaliseImageUrl('https://img.example.com/a.jpg')).toBe(
      'https://img.example.com/a.jpg'
    );
    expect(normaliseImageUrl('  http://img.example.com/a.jpg ')).toBe(
      'http://img.example.com/a.jpg'
    );
    expect(normaliseImageUrl('a.jpg')).toBeNull();
    expect(normaliseImageUrl('/local/a.jpg')).toBeNull();
    expect(normaliseImageUrl('')).toBeNull();
    expect(normaliseImageUrl(null)).toBeNull();
    expect(normaliseImageUrl(undefined)).toBeNull();
  });

  it('builds a watch URL only from a valid 11-character id', () => {
    expect(youtubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(youtubeWatchUrl('short')).toBeNull();
    expect(youtubeWatchUrl('has spaces!!')).toBeNull();
    expect(youtubeWatchUrl(null)).toBeNull();
  });
});