import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, IconButton, Text } from 'react-native-paper';
import { Lightbulb, RefreshCw } from 'lucide-react-native';
import { palette, radius, spacing, typography } from '../theme';

/**
 * "Food fact of the day".
 *
 * The trivia text is whatever the API returned, rendered as plain text - it is
 * never interpreted as markup. A failed refresh leaves the previously fetched
 * fact on screen instead of blanking the card.
 */
export default function FoodTriviaCard({
  trivia,
  loading = false,
  refreshing = false,
  onRefresh,
  notice,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Lightbulb size={18} color={palette.primary} strokeWidth={2} />
          <Text variant="titleSmall" style={styles.title}>
            Food fact of the day
          </Text>
        </View>

        <View style={styles.headerRight}>
          {loading || refreshing ? (
            <ActivityIndicator size="small" color={palette.primary} style={styles.spinner} />
          ) : null}
          <IconButton
            icon={({ size, color }) => (
              <RefreshCw size={size} color={color} strokeWidth={2} />
            )}
            accessibilityLabel="Fetch a new food fact"
            onPress={onRefresh}
            disabled={loading || refreshing || !onRefresh}
            size={20}
            style={styles.refresh}
          />
        </View>
      </View>

      {trivia ? (
        <Text variant="bodyMedium" style={styles.body}>
          {trivia}
        </Text>
      ) : loading ? null : (
        <Text variant="bodyMedium" style={styles.placeholder}>
          No food fact available right now. Pull to try again.
        </Text>
      )}

      {notice ? (
        <Text variant="labelSmall" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xl,
    backgroundColor: palette.primaryLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#C9E3D2',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginRight: spacing.xs,
  },
  refresh: {
    margin: 0,
  },
  title: {
    color: palette.primaryDark,
    fontSize: typography.card,
    fontWeight: '700',
  },
  body: {
    color: palette.primaryDark,
    fontSize: typography.body,
    lineHeight: 22,
  },
  placeholder: {
    color: palette.textSecondary,
    fontSize: typography.supporting,
    fontStyle: 'italic',
  },
  notice: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    marginTop: spacing.sm,
  },
});