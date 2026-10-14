import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Clock, UsersRound } from 'lucide-react-native';
import MediaImage from './MediaImage';
import { layout, palette, radius, spacing, typography } from '../theme';
import { cleanText, formatMinutes } from '../utils/format';

/**
 * A recipe result card.
 *
 * Title is clamped to two lines so one very long recipe name cannot stretch
 * the card and push the metadata out of view.
 */
function RecipeCard({ recipe, onPress }) {
  const title = cleanText(recipe.title);
  const readyIn = formatMinutes(recipe.readyInMinutes);
  const servings =
    typeof recipe.servings === 'number' && recipe.servings > 0 ? recipe.servings : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title ? `Open recipe ${title}` : 'Open recipe'}
    >
      <MediaImage
        uri={recipe.image}
        aspectRatio={layout.mediaRatio}
        icon="pot"
        message="No photo yet"
        label={title ? `Photo of ${title}` : undefined}
        radius={0}
      />

      <View style={styles.body}>
        <Text variant="titleSmall" style={styles.title} numberOfLines={2}>
          {title || 'Untitled recipe'}
        </Text>

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
      </View>
    </Pressable>
  );
}

export default React.memo(RecipeCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.8,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    color: palette.text,
    fontSize: typography.card,
    fontWeight: '700',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  metaText: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    fontWeight: '600',
  },
});