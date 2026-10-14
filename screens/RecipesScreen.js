import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Searchbar, Text } from 'react-native-paper';
import { Carrot, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchRecipes } from '../services/spoonacularApi';
import { SectionEmpty, SectionError, SectionLoading } from '../components/StateViews';
import RecipeCard from '../components/RecipeCard';
import useAsyncSection from '../hooks/useAsyncSection';
import { searchClearIcon } from '../components/paperSettings';
import { FLOATING_TAB_BAR_SPACE } from '../components/TabBar';
import { palette, radius, spacing, typography } from '../theme';

const CUISINES = ['Italian', 'Mexican', 'Asian', 'American', 'French', 'Indian', 'Mediterranean'];
const DIETS = ['vegetarian', 'vegan', 'gluten free', 'dairy free'];
const TIMES = ['20', '30', '45'];

/**
 * Recipes — Cook.
 *
 * The cooking destination: recipe search with cuisine/diet/time filters and an
 * entry point to the ingredient finder. Restaurant-chain menu discovery lives
 * on Home — Explore and is deliberately not duplicated here.
 */
export default function RecipesScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('pasta');
  const [term, setTerm] = useState('pasta');
  const [cuisine, setCuisine] = useState('');
  const [diet, setDiet] = useState('');
  const [maxReadyTime, setMaxReadyTime] = useState('');

  const { data, loading, error, reload } = useAsyncSection(
    () => searchRecipes({ query: term, cuisine, diet, maxReadyTime, number: 20 }),
    { deps: [term, cuisine, diet, maxReadyTime] }
  );

  const submit = useCallback(() => {
    Keyboard.dismiss();
    setTerm(query.trim());
  }, [query]);

  const toggle = useCallback((value, setter) => {
    setter((current) => (current === value ? '' : value));
  }, []);

  const clearFilters = useCallback(() => {
    setCuisine('');
    setDiet('');
    setMaxReadyTime('');
  }, []);

  const hasFilters = Boolean(cuisine || diet || maxReadyTime);

  const recipes = data?.recipes ?? [];

  const body = useMemo(() => {
    if (loading && recipes.length === 0) return <SectionLoading label="Searching recipes…" />;
    if (error) return <SectionError message={error.message} onRetry={reload} />;
    if (recipes.length === 0) {
      return <SectionEmpty message="No recipes found. Try a different dish or clear your filters." />;
    }
    return null;
  }, [loading, error, recipes.length, reload]);

  const filterRow = (label, options, value, onToggle, renderLabel) => (
    <View style={styles.filterGroup}>
      <Text variant="labelSmall" style={styles.filterLabel}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChips}
        keyboardShouldPersistTaps="handled"
      >
        {options.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              onPress={() => onToggle(option)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={
                renderLabel ? renderLabel(option, selected) : `${label}: ${option}`
              }
            >
              <Text
                variant="labelMedium"
                style={selected ? styles.chipTextSelected : styles.chipText}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <Text variant="headlineMedium" style={styles.title}>
        Let’s cook
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Search recipes, or cook from what you already have.
      </Text>

        <View style={styles.searchRow}>
          <Searchbar
            placeholder="Search recipes, e.g. pasta"
            accessibilityLabel="Search recipes by name"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            returnKeyType="search"
            autoCorrect={false}
            style={styles.searchField}
            inputStyle={styles.searchInput}
            icon={({ size, color }) => <Search size={size} color={color} />}
            clearIcon={searchClearIcon}
          />
          <Button
            mode="contained"
            onPress={submit}
            disabled={loading}
            accessibilityLabel="Search recipes"
            style={styles.searchButton}
            contentStyle={styles.searchButtonContent}
            labelStyle={styles.searchButtonLabel}
          >
            Search
          </Button>
        </View>

        <Pressable
          onPress={() => navigation.navigate('IngredientFinder')}
          style={({ pressed }) => [styles.finderCta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Find recipes by ingredients I already have"
        >
          <View style={styles.finderIcon}>
            <Carrot size={18} color={palette.primary} strokeWidth={2} />
          </View>
          <View style={styles.finderText}>
            <Text variant="titleSmall" style={styles.finderTitle}>
              Cook from your ingredients
            </Text>
            <Text variant="bodySmall" style={styles.finderSupport}>
              Enter what you have and find matching recipes
            </Text>
          </View>
        </Pressable>

        <View style={styles.filters}>
          {filterRow('Cuisine', CUISINES, cuisine, (v) => toggle(v, setCuisine))}
          {filterRow('Diet', DIETS, diet, (v) => toggle(v, setDiet))}
          {filterRow(
            'Ready in',
            TIMES,
            maxReadyTime,
            (v) => toggle(v, setMaxReadyTime),
            (option, selected) =>
              selected
                ? `Ready within ${option} minutes, selected`
                : `Ready within ${option} minutes`
          )}
          {hasFilters ? (
            <Pressable
              onPress={clearFilters}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              style={styles.clearFilters}
            >
              <Text variant="labelMedium" style={styles.clearFiltersText}>
                Clear filters
              </Text>
            </Pressable>
          ) : null}
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
          // The hero, search and filters scroll with the results so nothing can
          // overlap the list.
          ListHeaderComponent={header}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: FLOATING_TAB_BAR_SPACE },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    color: palette.text,
    fontSize: typography.title,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: typography.body,
    marginTop: 2,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
    height: 48,
    backgroundColor: palette.surface,
    borderRadius: radius.pill,
  },
  searchInput: {
    fontSize: typography.body,
    minHeight: 48,
  },
  searchButton: {
    borderRadius: radius.pill,
    minWidth: 84,
    justifyContent: 'center',
  },
  searchButtonContent: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  searchButtonLabel: {
    fontWeight: '700',
    fontSize: typography.body,
  },

  finderCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: palette.primaryLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#C9E3D2',
    padding: spacing.lg,
  },
  ctaPressed: {
    opacity: 0.75,
  },
  finderIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  finderText: {
    flex: 1,
  },
  finderTitle: {
    color: palette.primaryDark,
    fontSize: typography.card,
    fontWeight: '700',
  },
  finderSupport: {
    color: palette.primaryDark,
    fontSize: typography.meta,
    opacity: 0.85,
    marginTop: 1,
  },

  filters: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  filterGroup: {
    gap: spacing.xs,
  },
  filterLabel: {
    color: palette.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  filterChips: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  clearFilters: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  clearFiltersText: {
    color: palette.error,
    fontWeight: '600',
  },

  bodyState: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
  },
  listGap: {
    marginBottom: spacing.lg,
  },
});