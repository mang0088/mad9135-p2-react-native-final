import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Flame, Utensils } from 'lucide-react-native';
import MediaImage from './MediaImage';
import { layout, palette, radius, spacing, typography } from '../theme';
import { cleanText, formatMinutes } from '../utils/format';

/**
 * A single restaurant-chain menu dish.
 *
 * Fixed width so the carousel can peek at the next card and read as
 * scrollable. Only fields the API actually returned are rendered.
 */
function MenuItemCard({ item, onPress }) {
  const title = cleanText(item.title);
  const chain = cleanText(item.restaurantChain);
  const id = item.id;

  const calories =
    typeof item.calories === 'number' && Number.isFinite(item.calories)
      ? Math.round(item.calories)
      : null;
  const readyIn = formatMinutes(item.readyInMinutes);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={
        title ? `${title}${chain ? `, ${chain}` : ''}. View menu item details` : 'View menu item details'
      }
    >
      <MediaImage
        uri={item.image}
        aspectRatio={layout.mediaRatio}
        icon="utensils"
        message="No photo yet"
        label={title ? `Photo of ${title}` : undefined}
        radius={0}
      />

      <View style={styles.text}>
        <Text variant="titleSmall" style={styles.title} numberOfLines={2}>
          {title || 'Untitled dish'}
        </Text>

        {chain ? (
          <View style={styles.chainRow}>
            <Utensils size={12} color={palette.textSecondary} strokeWidth={2} />
            <Text variant="labelSmall" style={styles.chain} numberOfLines={1}>
              {chain}
            </Text>
          </View>
        ) : null}

        {/* Nutrition only when the search response actually included it. */}
        {calories !== null || readyIn ? (
          <View style={styles.metaRow}>
            {calories !== null ? (
              <View style={styles.metaChip}>
                <Flame size={12} color={palette.secondary} strokeWidth={2} />
                <Text variant="labelSmall" style={styles.metaText}>
                  {calories} kcal
                </Text>
              </View>
            ) : null}
            {readyIn ? (
              <Text variant="labelSmall" style={styles.readyIn}>
                {readyIn}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default React.memo(MenuItemCard);

const styles = StyleSheet.create({
  card: {
    width: layout.menuCardWidth,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  pressArea: {
    width: '100%',
  },
  pressed: {
    opacity: 0.75,
  },
  text: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    color: palette.text,
    fontSize: typography.card,
    fontWeight: '700',
    lineHeight: 20,
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chain: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  metaText: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    fontWeight: '600',
  },
  readyIn: {
    color: palette.textSecondary,
    fontSize: typography.meta,
  },
});