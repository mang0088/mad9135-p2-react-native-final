import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { palette, spacing, typography } from '../theme';

/**
 * Standard heading block for a Home section: title, one line of supporting
 * copy and an optional trailing action (e.g. a refresh control).
 */
export default function SectionHeader({ title, support, action }) {
  return (
    <View style={styles.container}>
      <View style={styles.text}>
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
        {support ? (
          <Text variant="bodySmall" style={styles.support}>
            {support}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  text: {
    flex: 1,
  },
  title: {
    color: palette.text,
    fontSize: typography.section,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  support: {
    color: palette.textSecondary,
    fontSize: typography.supporting,
    marginTop: 2,
  },
  action: {
    flexShrink: 0,
  },
});