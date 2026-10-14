import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Divider, Text } from 'react-native-paper';
import { Check, Clock, UsersRound } from 'lucide-react-native';

import { getRecipeDetails } from '../services/spoonacularApi';
import useAsyncSection from '../hooks/useAsyncSection';
import MediaImage from '../components/MediaImage';
import NutritionSummary from '../components/NutritionSummary';
import { ScreenLoading } from '../components/StateViews';
import { FLOATING_TAB_BAR_SPACE } from '../components/TabBar';
import { layout, palette, radius, spacing, typography } from '../theme';
import { cleanText, formatIngredient, formatMinutes } from '../utils/format';

/**
 * Recipe detail: overview, ingredients and cooking instructions.
 *
 * Ingredients and steps come from the API's `extendedIngredients` and
 * `extendedInstructions` fields - nothing is invented, and a recipe with no
 * instructions renders a clear message instead of an empty section.
 */
export default function RecipeDetailsScreen({ route }) {
  const id = route?.params?.id;

  const { data, loading, error } = useAsyncSection(
    () => getRecipeDetails(id),
    { enabled: id !== undefined && id !== null, deps: [id] }
  );

  // Local, session-only checklist. Not persisted - progress is not saved.
  const [checked, setChecked] = useState(() => new Set());

  const toggleIngredient = (name) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const ingredients = useMemo(() => {
    if (!data || !Array.isArray(data.extendedIngredients)) return [];
    return data.extendedIngredients
      .map(formatIngredient)
      .filter((line) => typeof line === 'string' && line !== '');
  }, [data]);

  const steps = useMemo(() => {
    if (!data || !Array.isArray(data.extendedInstructions)) return [];
    return data.extendedInstructions
      .map((step) => (typeof step?.step === 'string' ? step.step.trim() : ''))
      .filter((line) => line !== '');
  }, [data]);

  if (loading) return <ScreenLoading label="Loading recipe…" />;

  if (error) {
    return (
      <View style={styles.messageScreen}>
        <Text variant="bodyMedium" style={styles.message}>
          {error.message}
        </Text>
      </View>
    );
  }

  if (!data || typeof data !== 'object') {
    return (
      <View style={styles.messageScreen}>
        <Text variant="bodyMedium" style={styles.message}>
          No details are available for this recipe.
        </Text>
      </View>
    );
  }

  const title = cleanText(data.title);
  const summary = typeof data.summary === 'string' ? data.summary.trim() : '';
  const readyIn = formatMinutes(data.readyInMinutes);
  const servings =
    typeof data.servings === 'number' && data.servings > 0 ? data.servings : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_SPACE }}
      showsVerticalScrollIndicator={false}
    >
      <MediaImage
        uri={data.image}
        aspectRatio={layout.mediaRatio}
        icon="pot"
        message="No photo for this recipe"
        label={title ? `Photo of ${title}` : undefined}
        radius={0}
      />

      <View style={styles.body}>
        <Text variant="headlineSmall" style={styles.title}>
          {title || 'Untitled recipe'}
        </Text>

        {readyIn || servings ? (
          <View style={styles.metaRow}>
            {readyIn ? (
              <View style={styles.metaChip}>
                <Clock size={13} color={palette.primary} strokeWidth={2} />
                <Text variant="labelSmall" style={styles.metaText}>
                  {readyIn}
                </Text>
              </View>
            ) : null}
            {servings ? (
              <View style={styles.metaChip}>
                <UsersRound size={13} color={palette.secondary} strokeWidth={2} />
                <Text variant="labelSmall" style={styles.metaText}>
                  {servings} {servings === 1 ? 'serving' : 'servings'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* API summaries contain HTML; strip it rather than rendering markup. */}
        {summary ? (
          <Text variant="bodyMedium" style={styles.summary}>
            {stripHtml(summary)}
          </Text>
        ) : null}

        {/* Ingredients --------------------------------------------------- */}
        <View style={styles.sectionHead}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Ingredients
          </Text>
          {ingredients.length > 0 ? (
            <Text variant="labelSmall" style={styles.sectionNote}>
              Tap to tick off
            </Text>
          ) : null}
        </View>

        {ingredients.length === 0 ? (
          <Text variant="bodySmall" style={styles.message}>
            No ingredient list was supplied for this recipe.
          </Text>
        ) : (
          <View style={styles.ingredientList}>
            {ingredients.map((line, index) => {
              const done = checked.has(line);
              return (
                <Pressable
                  key={`${index}-${line}`}
                  onPress={() => toggleIngredient(line)}
                  style={({ pressed }) => [
                    styles.ingredientRow,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={line}
                >
                  <View style={[styles.tick, done && styles.tickDone]}>
                    {done ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  <Text
                    variant="bodyMedium"
                    style={[styles.ingredientText, done && styles.ingredientDone]}
                  >
                    {line}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Instructions -------------------------------------------------- */}
        <View style={styles.sectionHeadSpaced}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Method
          </Text>
        </View>

        {steps.length === 0 ? (
          <Text variant="bodySmall" style={styles.message}>
            No cooking instructions were supplied for this recipe.
          </Text>
        ) : (
          <View style={styles.stepList}>
            {steps.map((step, index) => (
              <View key={`${index}-${step.slice(0, 12)}`} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text variant="labelMedium" style={styles.stepNumberText}>
                    {index + 1}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.stepText}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Nutrition ------------------------------------------------------ */}
        {data.nutrition ? (
          <>
            <View style={styles.sectionHeadSpaced}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Nutrition
              </Text>
              <Text variant="labelSmall" style={styles.sectionNote}>
                Per serving, as supplied
              </Text>
            </View>
            <View style={styles.nutritionBlock}>
              <NutritionSummary nutrition={data.nutrition} />
            </View>
          </>
        ) : null}

        {data.sourceUrl ? (
          <Text variant="labelSmall" style={styles.source}>
            Recipe source: {hostOf(data.sourceUrl)}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** Removes HTML tags from API-supplied summaries so they render as plain text. */
function stripHtml(value) {
  return cleanText(String(value).replace(/<[^>]*>/g, ''));
}

function hostOf(url) {
  try {
    const match = String(url).match(/^https?:\/\/([^/?#]+)/i);
    return match ? match[1] : 'external site';
  } catch (err) {
    return 'external site';
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  body: {
    padding: spacing.xl,
  },
  title: {
    color: palette.text,
    fontSize: typography.title,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  metaText: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    fontWeight: '600',
  },
  summary: {
    color: palette.textSecondary,
    fontSize: typography.supporting,
    lineHeight: 20,
    marginTop: spacing.lg,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionHeadSpaced: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: typography.section,
    fontWeight: '700',
  },
  sectionNote: {
    color: palette.textSecondary,
    fontSize: typography.meta,
  },

  ingredientList: {
    gap: spacing.xs,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tickDone: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  ingredientText: {
    flex: 1,
    color: palette.text,
    fontSize: typography.body,
    lineHeight: 20,
  },
  ingredientDone: {
    color: palette.textSecondary,
    textDecorationLine: 'line-through',
  },

  stepList: {
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    color: palette.primaryDark,
    fontWeight: '800',
    fontSize: typography.meta,
  },
  stepText: {
    flex: 1,
    color: palette.text,
    fontSize: typography.body,
    lineHeight: 22,
  },

  nutritionBlock: {
    marginTop: spacing.xs,
  },
  source: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    marginTop: spacing.xl,
  },
  message: {
    color: palette.textSecondary,
    fontSize: typography.supporting,
  },
  messageScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: palette.background,
  },
});