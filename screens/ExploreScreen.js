import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, IconButton, Searchbar, Text } from 'react-native-paper';
import { ArrowRight, Calculator, Search, UtensilsCrossed } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, spacing, typography } from '../theme';
import { searchFoodVideos, searchMenuItems, guessNutrition, getFoodTrivia } from '../services/spoonacularApi';
import { SectionError, SectionEmpty, SectionLoading } from '../components/StateViews';
import SectionHeader from '../components/SectionHeader';
import BrandHeader from '../components/BrandHeader';
import FoodTriviaCard from '../components/FoodTriviaCard';
import FoodVideoCard from '../components/FoodVideoCard';
import MenuItemCard from '../components/MenuItemCard';
import NutritionSummary from '../components/NutritionSummary';
import useAsyncSection from '../hooks/useAsyncSection';
import { searchClearIcon } from '../components/paperSettings';
import { FLOATING_TAB_BAR_SPACE } from '../components/TabBar';
import { youtubeWatchUrl } from '../utils/format';

const CATEGORIES = [
  'Burger',
  'Pizza',
  'Salad',
  'Coffee',
  'Dessert',
  'Chicken',
  'Vegetarian',
];

/**
 * Home — Explore.
 *
 * A single vertical scroll of food-discovery sections. Each section owns its
 * own request and error state, so one failed endpoint never blanks the screen.
 */
export default function ExploreScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  // --- Menu Explorer -----------------------------------------------------
  const [query, setQuery] = useState('');
  const [menuTerm, setMenuTerm] = useState('pizza');
  const [activeCategory, setActiveCategory] = useState(null);

  const menu = useAsyncSection(
    () => searchMenuItems(menuTerm, { number: 8 }),
    { deps: [menuTerm] }
  );

  const runMenuSearch = useCallback((term, category = null) => {
    const cleaned = String(term || '').trim();
    if (cleaned === '') return;
    Keyboard.dismiss();
    setActiveCategory(category);
    setMenuTerm(cleaned);
  }, []);

  const onClearSearch = useCallback(() => {
    setQuery('');
    setActiveCategory(null);
    setMenuTerm('pizza');
  }, []);

  // --- Food videos -------------------------------------------------------
  const videos = useAsyncSection(() => searchFoodVideos('', { number: 6 }), {
    deps: [],
  });

  // --- Food trivia -------------------------------------------------------
  const [trivia, setTrivia] = useState(null);
  const [triviaLoading, setTriviaLoading] = useState(false);
  const [triviaNotice, setTriviaNotice] = useState(null);
  const triviaLoaded = useRef(false);

  const loadTrivia = useCallback(async ({ force = false } = {}) => {
    if (triviaLoading) return; // guard against double taps
    setTriviaLoading(true);
    setTriviaNotice(null);

    try {
      const result = await getFoodTrivia({ force });
      if (result && typeof result.text === 'string' && result.text.trim() !== '') {
        setTrivia(result.text);
        triviaLoaded.current = true;
      } else if (!triviaLoaded.current) {
        setTrivia(null);
      }
    } catch (err) {
      // Keep any previously fetched fact visible rather than blanking the card.
      setTriviaNotice(
        triviaLoaded.current
          ? 'Could not refresh the fact. Showing the previous one.'
          : 'Could not load a food fact right now.'
      );
    } finally {
      setTriviaLoading(false);
    }
  }, [triviaLoading]);

  const ensureTrivia = useCallback(() => {
    if (!triviaLoaded.current) loadTrivia();
  }, [loadTrivia]);

  // Fetch the fact of the day once on mount. The result is cached for the day,
  // so returning to this tab reuses it rather than re-requesting.
  useEffect(() => {
    ensureTrivia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Nutrition Lens ----------------------------------------------------
  const [dishName, setDishName] = useState('');
  const [nutrition, setNutrition] = useState(null);
  const [nutritionBusy, setNutritionBusy] = useState(false);
  const [nutritionError, setNutritionError] = useState(null);

  const onEstimate = useCallback(async () => {
    const term = dishName.trim();
    if (term === '') {
      setNutritionError('Enter a dish name first, e.g. vegetable fried rice.');
      return;
    }
    if (nutritionBusy) return; // no duplicate billable requests

    setNutritionBusy(true);
    setNutritionError(null);
    Keyboard.dismiss();

    try {
      const result = await guessNutrition(term);
      setNutrition(result);
    } catch (err) {
      setNutrition(null);
      setNutritionError(
        err && err.message ? err.message : 'Could not estimate nutrition.'
      );
    } finally {
      setNutritionBusy(false);
    }
  }, [dishName, nutritionBusy]);

  const openVideo = useCallback(async (video) => {
    const url = youtubeWatchUrl(video.youTubeId);
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (err) {
      // The device may have no handler for the YouTube scheme.
    }
  }, []);

  const menuItems = menu.data?.menuItems ?? [];
  const videoItems = videos.data?.videos ?? [];

  const menuContent = useMemo(() => {
    if (menu.loading) return <SectionLoading label="Finding menu dishes…" />;
    if (menu.error) {
      return <SectionError message={menu.error.message} onRetry={menu.reload} />;
    }
    if (menuItems.length === 0) {
      return (
        <SectionEmpty message={`No menu dishes found for “${menuTerm}”. Try another dish or category.`} />
      );
    }
    return null;
  }, [menu.loading, menu.error, menuItems.length, menuTerm]);

  const videoContent = useMemo(() => {
    if (videos.loading) return <SectionLoading label="Finding food videos…" />;
    if (videos.error) {
      return <SectionError message={videos.error.message} onRetry={videos.reload} />;
    }
    if (videoItems.length === 0) {
      return <SectionEmpty message="No food videos available right now." />;
    }
    return null;
  }, [videos.loading, videos.error, videoItems.length]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              menu.reload();
              videos.reload();
            }}
            tintColor={palette.primary}
          />
        }
      >
        <BrandHeader />

        {/* Hero ---------------------------------------------------------- */}
        <View style={styles.hero}>
          <Text variant="headlineMedium" style={styles.heroTitle}>
            What are you craving?
          </Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            Discover menu favourites, food videos and fresh inspiration.
          </Text>

          <View style={styles.searchRow}>
            <Searchbar
              placeholder="Search menu dishes, e.g. burger"
              accessibilityLabel="Search menu dishes by name"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => runMenuSearch(query)}
              returnKeyType="search"
              autoCorrect={false}
              style={styles.searchField}
              inputStyle={styles.searchInput}
              icon={({ size, color }) => <Search size={size} color={color} />}
              clearIcon={searchClearIcon}
            />
            <Button
              mode="contained"
              onPress={() => runMenuSearch(query)}
              disabled={menu.loading}
              accessibilityLabel="Search menu dishes"
              style={styles.searchButton}
              contentStyle={styles.searchButtonContent}
              labelStyle={styles.searchButtonLabel}
            >
              Search
            </Button>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((category) => {
              const selected = activeCategory === category;
              return (
                <Pressable
                  key={category}
                  onPress={() => runMenuSearch(category, category)}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.chipPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Show ${category} menu dishes`}
                >
                  <Text
                    variant="labelMedium"
                    style={selected ? styles.chipTextSelected : styles.chipText}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Menu inspiration ---------------------------------------------- */}
        <SectionHeader
          title="Menu inspiration"
          support="Explore dishes from familiar restaurant chains."
        />

        {menuContent ? (
          <View style={styles.sectionState}>{menuContent}</View>
        ) : (
          <FlatList
            data={menuItems}
            keyExtractor={(item, index) => String(item.id ?? index)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            renderItem={({ item }) => (
              <MenuItemCard
                item={item}
                onPress={() =>
                  navigation.navigate('MenuItemDetails', {
                    id: item.id,
                    title: item.title,
                  })
                }
              />
            )}
          />
        )}

        {/* Food videos ---------------------------------------------------- */}
        <View style={styles.sectionGap} />
        <SectionHeader
          title="Watch & discover"
          support="Get inspired by food creators and cooking demonstrations."
        />

        {videoContent ? (
          <View style={styles.sectionState}>{videoContent}</View>
        ) : (
          <FlatList
            data={videoItems}
            keyExtractor={(item, index) => String(item.youTubeId ?? index)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            renderItem={({ item }) => (
              <FoodVideoCard video={item} onPress={() => openVideo(item)} />
            )}
          />
        )}

        {/* Food fact ------------------------------------------------------ */}
        <View style={styles.sectionGap} />
        <SectionHeader title="Something to chew over" />
        <FoodTriviaCard
          trivia={trivia}
          loading={triviaLoading && trivia === null}
          refreshing={triviaLoading && trivia !== null}
          onRefresh={() => loadTrivia({ force: true })}
          notice={triviaNotice}
        />

        {/* Nutrition Lens ------------------------------------------------ */}
        <View style={styles.sectionGap} />
        <SectionHeader
          title="Nutrition Lens"
          support="Curious about a dish? Get an estimated nutritional breakdown."
        />

        <View style={styles.lensCard}>
          <View style={styles.lensHeadline}>
            <View style={styles.lensIcon}>
              <Calculator size={18} color={palette.primary} strokeWidth={2} />
            </View>
            <Text variant="titleSmall" style={styles.lensTitle}>
              Estimate a dish
            </Text>
          </View>

          <Searchbar
            placeholder="Enter a dish, e.g. vegetable fried rice"
            accessibilityLabel="Dish name for nutrition estimate"
            value={dishName}
            onChangeText={setDishName}
            onSubmitEditing={onEstimate}
            returnKeyType="search"
            autoCorrect={false}
            style={styles.lensInput}
            inputStyle={styles.searchInput}
            icon={({ size, color }) => <UtensilsCrossed size={size} color={color} />}
            clearIcon={searchClearIcon}
          />

          {nutritionError ? (
            <Text variant="bodySmall" style={styles.errorText}>
              {nutritionError}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={onEstimate}
            loading={nutritionBusy}
            disabled={nutritionBusy}
            accessibilityLabel="Estimate nutrition for this dish"
            style={styles.lensButton}
            contentStyle={styles.lensButtonContent}
          >
            Estimate nutrition
          </Button>

          {nutritionBusy ? (
            <View style={styles.lensBusy}>
              <ActivityIndicator size="small" color={palette.primary} />
            </View>
          ) : null}

          {nutrition && !nutritionBusy ? (
            <View style={styles.lensResult}>
              <NutritionSummary nutrition={nutrition} estimate />
            </View>
          ) : null}
        </View>

        <View style={[styles.footer, { paddingBottom: FLOATING_TAB_BAR_SPACE }]}>
          <Text variant="labelSmall" style={styles.footerText}>
            Menu data, videos and nutrition estimates provided by Spoonacular.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    paddingBottom: spacing.xl,
  },

  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  heroTitle: {
    color: palette.text,
    fontSize: typography.hero,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  heroSubtitle: {
    color: palette.textSecondary,
    fontSize: typography.body,
    marginTop: spacing.xs,
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

  chipRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
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

  carousel: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  sectionState: {
    paddingBottom: spacing.md,
  },
  sectionGap: {
    height: spacing.xxxl,
  },

  triviaHost: {
    // Retained for spacing parity with the other sections.
  },

  lensCard: {
    marginHorizontal: spacing.xl,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
  },
  lensHeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  lensIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primaryLight,
  },
  lensTitle: {
    color: palette.text,
    fontSize: typography.card,
    fontWeight: '700',
  },
  lensInput: {
    height: 48,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
  },
  lensButton: {
    marginTop: spacing.md,
    borderRadius: radius.md,
  },
  lensButtonContent: {
    minHeight: 46,
  },
  lensBusy: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  lensResult: {
    marginTop: spacing.lg,
  },
  errorText: {
    color: palette.error,
    fontSize: typography.supporting,
    marginTop: spacing.sm,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  footerText: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    textAlign: 'center',
  },
});