import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Soup } from 'lucide-react-native';
import { palette, radius, spacing, typography } from '../theme';

/**
 * Compact brand header for the Explore screen.
 *
 * Deliberately short: the Home screen is a long scroll, so the header takes
 * the minimum height needed to establish the brand and tagline.
 */
export default function BrandHeader() {
  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <Soup size={20} color="#FFFFFF" strokeWidth={2.1} />
      </View>
      <View style={styles.text}>
        <Text variant="titleMedium" style={styles.name}>
          Spooncular
        </Text>
        <Text variant="labelSmall" style={styles.tagline}>
          Explore a world of flavour
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  mark: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  text: {
    flex: 1,
  },
  name: {
    color: palette.primaryDark,
    fontSize: typography.section,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tagline: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    marginTop: 1,
  },
});