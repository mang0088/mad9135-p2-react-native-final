import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { AlertTriangle, SearchX } from 'lucide-react-native';
import { palette, radius, spacing, typography } from '../theme';

/** Neutral loading state used inside a Home section. */
export function SectionLoading({ label = 'Loading…' }) {
  return (
    <View style={styles.block}>
      <ActivityIndicator size="small" color={palette.primary} />
      <Text variant="bodySmall" style={styles.message}>
        {label}
      </Text>
    </View>
  );
}

/** No results state. Never implies an error. */
export function SectionEmpty({ message, action }) {
  return (
    <View style={styles.block}>
      <SearchX size={24} color={palette.fallbackInk} strokeWidth={1.75} />
      <Text variant="bodySmall" style={styles.message}>
        {message}
      </Text>
      {action}
    </View>
  );
}

/**
 * Section-level error. Each Home section owns its own error so one failed
 * request never takes the rest of the screen down.
 */
export function SectionError({ message, onRetry, retryLabel = 'Try again' }) {
  return (
    <View style={[styles.block, styles.errorBlock]}>
      <AlertTriangle size={22} color={palette.error} strokeWidth={1.9} />
      <Text variant="bodySmall" style={styles.errorMessage}>
        {message}
      </Text>
      {onRetry ? (
        <Button
          mode="text"
          onPress={onRetry}
          compact
          accessibilityLabel={retryLabel}
          style={styles.retry}
        >
          {retryLabel}
        </Button>
      ) : null}
    </View>
  );
}

/** Full-screen loading state for a whole screen. */
export function ScreenLoading({ label = 'Loading…' }) {
  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color={palette.primary} />
      <Text variant="bodyMedium" style={styles.message}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  errorBlock: {
    backgroundColor: palette.surface,
    marginHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: spacing.xl,
  },
  message: {
    color: palette.textSecondary,
    fontSize: typography.supporting,
    textAlign: 'center',
  },
  errorMessage: {
    color: palette.error,
    fontSize: typography.supporting,
    textAlign: 'center',
  },
  retry: {
    marginTop: 0,
  },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: palette.background,
  },
});