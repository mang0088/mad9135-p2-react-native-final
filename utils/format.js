/**
 * Display formatting helpers.
 *
 * Every function here is display-only: it tidies a value for reading without
 * changing the underlying quantity, unit or measurement system.
 */

import { palette, typography } from '../theme';

/** `6:10` from 370 seconds. Returns null for missing/invalid input. */
export function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return null;

  const whole = Math.round(total);
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;

  if (minutes === 0) return `0:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** `45 min` / `1 h 20 min` from minutes. */
export function formatMinutes(minutes) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return null;

  const whole = Math.round(total);
  if (whole < 60) return `${whole} min`;

  const hours = Math.floor(whole / 60);
  const mins = whole % 60;
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
}

const FRACTIONS = [
  { glyph: '⅛', value: 1 / 8 },
  { glyph: '¼', value: 1 / 4 },
  { glyph: '⅓', value: 1 / 3 },
  { glyph: '½', value: 1 / 2 },
  { glyph: '⅔', value: 2 / 3 },
  { glyph: '¾', value: 3 / 4 },
];

/**
 * How far a value may sit from an exact fraction and still be shown as one.
 *
 * Deliberately tiny: it only needs to absorb binary-float drift
 * (0.33333334 vs 1/3 differs by ~3e-8). A loose tolerance would render a
 * genuinely different amount such as 0.123 as "⅛", which would misstate the
 * quantity the API supplied.
 */
const FRACTION_TOLERANCE = 1e-4;

/**
 * Coerces to a finite number, rejecting the values that `Number()` would
 * silently turn into 0 (null, undefined, empty string, whitespace).
 */
function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Formats a numeric quantity plus unit for display.
 *
 * Spoonacular returns binary-float artefacts such as 0.33333334 for what is
 * really a third of a cup. Where the value is an accurate match for a common
 * kitchen fraction it is shown as a fraction glyph; otherwise the number is
 * rounded to a readable precision.
 *
 * The unit is echoed exactly as supplied - no unit is invented, pluralised or
 * converted between metric and US.
 */
export function formatQuantity(value, unit) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return null;

  const suffix = typeof unit === 'string' && unit.trim() !== '' ? ` ${unit.trim()}` : '';

  if (numeric === 0) return `0${suffix}`;

  // Whole amounts stay whole: "2 cups", never "2/1 cups".
  if (Math.abs(numeric - Math.round(numeric)) < FRACTION_TOLERANCE) {
    return `${Math.round(numeric)}${suffix}`;
  }

  const whole = Math.floor(numeric);
  const remainder = numeric - whole;

  const match = FRACTIONS.find(
    (f) => Math.abs(remainder - f.value) < FRACTION_TOLERANCE
  );

  if (match) {
    return whole > 0
      ? `${whole} ${match.glyph}${suffix}`
      : `${match.glyph}${suffix}`;
  }

  return `${Number(numeric.toFixed(2))}${suffix}`;
}

/**
 * Formats one ingredient entry from an extended-ingredient payload.
 * Returns null when the ingredient has no usable name.
 */
export function formatIngredient(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (name === '') return null;

  // Spoonacular often supplies a preformatted line; prefer it.
  if (typeof entry.originalString === 'string' && entry.originalString.trim() !== '') {
    return entry.originalString.trim();
  }

  const amount = Number(entry.amount);
  if (Number.isFinite(amount)) {
    const formatted = formatQuantity(amount, entry.unit);
    if (formatted) return `${formatted} ${name}`;
  }

  return name;
}

/**
 * Reads the numeric amount from a nutrient entry.
 *
 * The Spoonacular endpoints are not consistent here: /recipes/guessNutrition
 * returns `{ value, unit, confidenceRange95Percent }` while menu-item and
 * recipe nutrition returns `{ amount, unit }`. Both are accepted, otherwise the
 * estimate panel silently renders nothing.
 */
function readNutrientAmount(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return toFiniteNumber(entry.value) ?? toFiniteNumber(entry.amount);
}

/** Keys that mean the same nutrient across endpoints, with their display label. */
const NUTRIENT_ALIASES = {
  calories: { label: 'Calories' },
  protein: { label: 'Protein' },
  fat: { label: 'Fat' },
  carbohydrates: { label: 'Carbs' },
  carbs: { label: 'Carbs' },
  sugar: { label: 'Sugar' },
  sugars: { label: 'Sugar' },
  sodium: { label: 'Sodium' },
};

/** Default headline macros, accepting either carb key. */
const HEADLINE_KEYS = ['calories', 'protein', 'carbohydrates', 'carbs', 'fat'];

/**
 * Picks the headline macros out of a nutrition payload.
 * Units come from the API and are never assumed.
 */
export function summariseNutrition(nutrition, keys = HEADLINE_KEYS) {
  if (!nutrition || typeof nutrition !== 'object') return [];

  const found = [];
  const consumed = new Set();

  for (const key of keys) {
    const entry = nutrition[key];
    if (entry == null || typeof entry !== 'object') continue;

    const amount = readNutrientAmount(entry);
    if (amount === null) continue;

    consumed.add(key);
    found.push({
      key,
      label: NUTRIENT_ALIASES[key]?.label ?? humaniseKey(key),
      amount,
      unit: typeof entry.unit === 'string' ? entry.unit : '',
      range: readConfidenceRange(entry),
    });
  }

  return found;
}

/** Pulls the 95% confidence interval out of a nutrient, when supplied. */
function readConfidenceRange(entry) {
  const range =
    entry.confidenceRange95Percent || entry.confidenceRange || entry.confidenceRanges;
  if (!range || typeof range !== 'object') return null;

  const min = toFiniteNumber(range.min);
  const max = toFiniteNumber(range.max);
  if (min === null || max === null) return null;

  return { min, max };
}

/**
 * Turns a nutrition response into headline metrics plus the remaining
 * nutrients as a readable list. Used by the guessNutrition tool, menu-item
 * details and recipe details.
 */
export function splitNutrition(nutrition) {
  const headline = summariseNutrition(nutrition);
  const consumed = new Set(headline.map((n) => n.key));

  const rest = [];
  if (nutrition && typeof nutrition === 'object') {
    for (const [key, value] of Object.entries(nutrition)) {
      if (consumed.has(key)) continue;
      if (!value || typeof value !== 'object') continue;

      const amount = readNutrientAmount(value);
      if (amount === null) continue;

      rest.push({
        key,
        label: NUTRIENT_ALIASES[key]?.label ?? humaniseKey(key),
        amount,
        unit: typeof value.unit === 'string' ? value.unit : '',
      });
    }
  }

  return { headline, rest };
}

/** `totalFat` -> `Total fat`, `sugars` -> `Sugars`. */
export function humaniseKey(key) {
  const spaced = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Rounds a macro for display without overstating precision.
 * Values under 10 keep one decimal (e.g. 6.4 g), larger ones stay whole.
 */
export function formatMacro(amount, unit) {
  const numeric = toFiniteNumber(amount);
  if (numeric === null) return null;

  const value =
    numeric < 10 ? Number(numeric.toFixed(1)) : Math.round(numeric);
  const suffix = unit ? ` ${unit}` : '';
  return `${value}${suffix}`;
}

/** Accepts only absolute http(s) URLs; anything else yields null. */
export function normaliseImageUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Named HTML entities that appear in Spoonacular text fields.
 *
 * The API returns values such as "Pepperoni Lover's&reg - Large" with raw
 * entity markup. Rendering that verbatim shows "&reg" to the user, so common
 * entities are decoded before display.
 */
const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  reg: '®',
  copy: '©',
  trade: '™',
  deg: '°',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  ntilde: 'ñ',
  pound: '£',
  euro: '€',
  middot: '·',
  bull: '•',
};

/**
 * Decodes HTML entities and numeric character references in API text.
 *
 * The trailing semicolon is optional because Spoonacular returns values like
 * "Pepperoni Lover's&reg - Large" with no semicolon. A name that is not a known
 * entity is left exactly as it was, so ordinary text such as "Salt & Pepper"
 * or "R&D" is never mangled.
 */
export function decodeEntities(value) {
  if (typeof value !== 'string') return '';

  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]{2,10});?/g, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
      // Reject out-of-range codes rather than emitting an invalid character.
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch (err) {
        return match;
      }
    }

    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/**
 * Normalises a display string from the API into safe plain text:
 * strips any markup, decodes entities and collapses whitespace.
 *
 * The result is still rendered as a React string child, so it can never
 * introduce markup of its own.
 */
export function cleanText(value) {
  if (typeof value !== 'string') return '';
  return decodeEntities(value.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/** Compact view count: 1.2M, 34K. */
export function formatViews(views) {
  const numeric = Number(views);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M views`;
  if (numeric >= 1000) return `${Math.round(numeric / 1000)}K views`;
  return `${Math.round(numeric)} views`;
}

/** Only ever accept a real YouTube id before building a watch URL. */
export function youtubeWatchUrl(youtubeId) {
  if (typeof youtubeId !== 'string') return null;
  const id = youtubeId.trim();
  // YouTube ids are 11 chars of [A-Za-z0-9_-].
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Section heading style shared by Explore sections. */
export const sectionHeadingStyle = {
  color: palette.text,
  fontSize: typography.section,
  fontWeight: '700',
  letterSpacing: -0.2,
};

/** Supporting copy under a section heading. */
export const sectionSupportStyle = {
  color: palette.textSecondary,
  fontSize: typography.supporting,
  marginTop: 2,
};