import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider, Text } from 'react-native-paper';
import { UtensilsCrossed } from 'lucide-react-native';

import { getMenuItemDetails } from '../services/spoonacularApi';
import useAsyncSection from '../hooks/useAsyncSection';
import MediaImage from '../components/MediaImage';
import NutritionSummary from '../components/NutritionSummary';
import { ScreenLoading } from '../components/StateViews';
import { FLOATING_TAB_BAR_SPACE } from '../components/TabBar';
import { layout, palette, radius, spacing, typography } from '../theme';
import { formatMinutes, cleanText } from '../utils/format';

/**
 * Full detail for one restaurant-chain menu item.
 *
 * Nutrition is read from the details payload. If the endpoint omits it the
 * section reports that plainly rather than showing placeholder numbers.
 */
export default function MenuItemDetailsScreen({ route }) {
  const id = route?.params?.id;

  const { data, loading, error } = useAsyncSection(
    () => getMenuItemDetails(id),
    { enabled: id !== undefined && id !== null, deps: [id] }
  );

  if (loading) return <ScreenLoading label="Loading menu item…" />;

  if (error) {
    return (
      <View style={styles.errorScreen}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {error.message}
        </Text>
      </View>
    );
  }

  if (!data || typeof data !== 'object') {
    return (
      <View style={styles.errorScreen}>
        <Text variant="bodyMedium" style={styles.errorText}>
          No details are available for this menu item.
        </Text>
      </View>
    );
  }

  const title = cleanText(data.title);
  const chain = cleanText(data.restaurantChain);
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
        icon="utensils"
        message="No photo for this dish"
        label={title ? `Photo of ${title}` : undefined}
        radius={0}
      />

      <View style={styles.body}>
        <Text variant="headlineSmall" style={styles.title}>
          {title || 'Untitled dish'}
        </Text>

        {chain ? (
          <View style={styles.chainRow}>
            <UtensilsCrossed size={14} color={palette.textSecondary} strokeWidth={2} />
            <Text variant="bodySmall" style={styles.chain}>
              {chain}
            </Text>
          </View>
        ) : null}

        {readyIn || servings ? (
          <View style={styles.metaRow}>
            {readyIn ? (
              <View style={styles.metaChip}>
                <Text variant="labelSmall" style={styles.metaText}>
                  Ready in {readyIn}
                </Text>
              </View>
            ) : null}
            {servings ? (
              <View style={styles.metaChip}>
                <Text variant="labelSmall" style={styles.metaText}>
                  Serves {servings}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.originNote}>
          <Text variant="labelSmall" style={styles.originText}>
            This is a restaurant-chain menu item published by Spoonacular. It is
            not a location-specific restaurant listing and Spoonacular does not
            confirm availability at any particular branch.
          </Text>
        </View>

        <Divider style={styles.divider} />

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Nutrition
        </Text>
        <Text variant="bodySmall" style={styles.sectionSupport}>
          Where supplied by the source.
        </Text>

        <View style={styles.nutrition}>
          <NutritionSummary nutrition={data.nutrition} />
        </View>
      </View>
    </ScrollView>
  );
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
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chain: {
    color: palette.textSecondary,
    fontSize: typography.supporting,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaChip: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  metaText: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    fontWeight: '600',
  },
  originNote: {
    marginTop: spacing.lg,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  originText: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    lineHeight: 16,
  },
  divider: {
    backgroundColor: palette.border,
    marginVertical: spacing.xl,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: typography.section,
    fontWeight: '700',
  },
  sectionSupport: {
    color: palette.textSecondary,
    fontSize: typography.supporting,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  nutrition: {
    marginTop: spacing.xs,
  },
  errorScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: palette.background,
  },
  errorText: {
    color: palette.textSecondary,
    textAlign: 'center',
  },
});