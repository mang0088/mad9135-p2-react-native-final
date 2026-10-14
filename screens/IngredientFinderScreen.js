import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';
import { Check, Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { findRecipesByIngredients, normaliseIngredientInput } from '../services/spoonacularApi';
import { SectionEmpty, SectionError, SectionLoading } from '../components/StateViews';
import RecipeCard from '../components/RecipeCard';
import useAsyncSection from '../hooks/useAsyncSection';
import { FLOATING_TAB_BAR_SPACE } from '../components/TabBar';
import { palette, radius, spacing, typography } from '../theme';

const SUGGESTIONS = ['chicken', 'tomato', 'pasta', 'onion', 'garlic', 'egg', 'rice'];

/**
 * Ingredient Finder.
 *
 * Keeps its own draft ingredient list so entries can be reviewed and removed
 * before the (billable) search runs. Normalisation and de-duplication happen
 * before the request is made.
 */
export default function IngredientFinderScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const addIngredient = useCallback((value) => {
    const name = String(value || '').trim().replace(/\s+/g, ' ');
    if (name === '') return;

    setIngredients((current) => {
      const merged = normaliseIngredientInput([...current, name]);
      // Only commit when the ingredient was genuinely new.
      return merged.length === current.length ? current : merged;
    });
    setDraft('');
  }, []);

  const removeIngredient = useCallback((name) => {
    setIngredients((current) => current.filter((item) => item !== name));
  }, []);

  const onSubmit = useCallback(() => {
    // Anything still typed counts as an ingredient.
    const finalList = normaliseIngredientInput([...ingredients, draft]);
    if (finalList.length === 0) return;

    setIngredients(finalList);
    setDraft('');
    Keyboard.dismiss();
    setSubmitted(true);
  }, [ingredients, draft]);

  const clearAll = useCallback(() => {
    setIngredients([]);
    setDraft('');
    setSubmitted(false);
  }, []);

  const { data, loading, error, reload } = useAsyncSection(
    () => findRecipesByIngredients(ingredients),
    { enabled: submitted, deps: [submitted, ingredients.join(',')] }
  );

  const recipes = data?.recipes ?? [];

  const body = useMemo(() => {
    if (!submitted) {
      return (
        <SectionEmpty message="Add the ingredients you have, then search to see what you can cook." />
      );
    }
    if (loading && recipes.length === 0) return <SectionLoading label="Matching recipes…" />;
    if (error) return <SectionError message={error.message} onRetry={reload} />;
    if (recipes.length === 0) {
      return (
        <SectionEmpty message="No recipes matched those ingredients. Try adding a staple like onion or garlic." />
      );
    }
    return null;
  }, [submitted, loading, error, recipes.length, reload]);

  const header = (
    <View style={[styles.header, { paddingTop: spacing.lg }]}>
      <Text variant="titleLarge" style={styles.title}>
        Cook from your ingredients
      </Text>
      <Text variant="bodySmall" style={styles.subtitle}>
        Enter ingredients you already have and we’ll find matching recipes.
      </Text>

        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => addIngredient(draft)}
            returnKeyType="done"
            placeholder="Type an ingredient, e.g. chicken"
            placeholderTextColor={palette.fallbackInk}
            accessibilityLabel="Type an ingredient"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Button
            mode="contained"
            onPress={() => addIngredient(draft)}
            disabled={draft.trim() === ''}
            accessibilityLabel="Add ingredient"
            style={styles.addButton}
            contentStyle={styles.addButtonContent}
            labelStyle={styles.addButtonLabel}
          >
            Add
          </Button>
        </View>

        {ingredients.length > 0 ? (
          <View style={styles.chipWrap}>
            <View style={styles.chipRow}>
              {ingredients.map((name) => (
                <Chip
                  key={name}
                  onPress={() => removeIngredient(name)}
                  accessibilityLabel={`Remove ${name}`}
                  icon={({ size, color }) => <X size={size} color={color} />}
                  style={styles.ingredientChip}
                  textStyle={styles.ingredientChipText}
                >
                  {name}
                </Chip>
              ))}
            </View>
            <View style={styles.actions}>
              <Button
                mode="contained"
                onPress={onSubmit}
                loading={loading}
                disabled={loading}
                accessibilityLabel="Find recipes with these ingredients"
                style={styles.findButton}
                contentStyle={styles.findButtonContent}
              >
                Find recipes
              </Button>
              <Pressable
                onPress={clearAll}
                accessibilityRole="button"
                accessibilityLabel="Clear all ingredients"
                style={styles.clearButton}
              >
                <Text variant="labelMedium" style={styles.clearText}>
                  Clear all
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Suggestions stay available while ingredients are already chosen so a
          recipe can be built from several items without retyping each one.
          Ones already added are dimmed and disabled. */}
      <View style={styles.suggestions}>
        <Text variant="labelSmall" style={styles.suggestLabel}>
          Common ingredients
        </Text>
        <View style={styles.chipRow}>
          {SUGGESTIONS.map((name) => {
            const alreadyAdded = ingredients.includes(name);
            return (
              <Pressable
                key={name}
                onPress={() => addIngredient(name)}
                disabled={alreadyAdded}
                style={({ pressed }) => [
                  styles.suggestChip,
                  alreadyAdded && styles.suggestChipAdded,
                  pressed && !alreadyAdded && styles.suggestPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: alreadyAdded }}
                accessibilityLabel={
                  alreadyAdded ? `${name} already added` : `Add ${name}`
                }
              >
                {alreadyAdded ? (
                  <Check size={12} color={palette.primary} strokeWidth={2.6} />
                ) : (
                  <Plus size={12} color={palette.textSecondary} strokeWidth={2.2} />
                )}
                <Text
                  variant="labelMedium"
                  style={[
                    styles.suggestText,
                    alreadyAdded && styles.suggestTextAdded,
                  ]}
                >
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {body ? (
        <>
          {header}
          <View style={styles.bodyState}>{body}</View>
        </>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item, index) => String(item.id ?? index)}
          // The form scrolls with the results so the list cannot overlap it.
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <View style={styles.listGap}>
              <RecipeCard
                recipe={item}
                onPress={() =>
                  navigation.navigate('RecipeDetails', {
                    id: item.id,
                    title: item.title,
                    image: item.image,
                  })
                }
              />
            </View>
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: FLOATING_TAB_BAR_SPACE },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  headerScroll: {
    flexGrow: 0,
  },
  listGap: {
    marginBottom: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    color: palette.text,
    fontSize: typography.section,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: typography.supporting,
    marginTop: 2,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 46,
    fontSize: typography.body,
    color: palette.text,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
  },
  addButton: {
    borderRadius: radius.md,
  },
  addButtonContent: {
    minHeight: 46,
    paddingHorizontal: spacing.lg,
  },
  addButtonLabel: {
    fontWeight: '700',
  },

  chipWrap: {
    marginTop: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  ingredientChip: {
    backgroundColor: palette.primaryLight,
    borderWidth: 1,
    borderColor: '#C9E3D2',
  },
  ingredientChipText: {
    color: palette.primaryDark,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  findButton: {
    borderRadius: radius.md,
    flexGrow: 1,
  },
  findButtonContent: {
    minHeight: 46,
  },
  clearButton: {
    paddingVertical: spacing.sm,
  },
  clearText: {
    color: palette.error,
    fontWeight: '600',
  },

  suggestions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  suggestLabel: {
    color: palette.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestChipAdded: {
    backgroundColor: palette.primaryLight,
    borderColor: '#C9E3D2',
  },
  suggestPressed: {
    opacity: 0.7,
  },
  suggestText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  suggestTextAdded: {
    color: palette.primaryDark,
  },

  bodyState: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
  },
});