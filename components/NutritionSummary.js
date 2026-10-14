import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Divider, Text } from 'react-native-paper';
import { Info } from 'lucide-react-native';
import { palette, radius, spacing, typography } from '../theme';
import { formatMacro, humaniseKey, splitNutrition } from '../utils/format';

/**
 * Renders a nutrition payload as prominent macros plus the remaining nutrients.
 *
 * Values and units come straight from the API response - nothing is assumed
 * about the unit, and no nutrient is invented when the source omits it.
 */
export default function NutritionSummary({ nutrition, estimate = false }) {
  const { headline, rest } = splitNutrition(nutrition);

  if (headline.length === 0 && rest.length === 0) {
    return (
      <Text variant="bodySmall" style={styles.empty}>
        No nutrition information was supplied for this item.
      </Text>
    );
  }

  return (
    <View>
      {headline.length > 0 ? (
        <View style={styles.headlineGrid}>
          {headline.map((item) => (
            <View key={item.key} style={styles.headlineCell}>
              {/* Number is set large and the unit small so "341 calories" stays
                  on one line and keeps a 2-up grid. */}
              <View style={styles.valueRow}>
                <Text variant="headlineSmall" style={styles.headlineValue}>
                  {formatMacro(item.amount, '') ?? '—'}
                </Text>
                {/* Skip the unit when it merely repeats the label below
                    (e.g. "341 calories" directly above "CALORIES"). */}
                {item.unit && item.unit.toLowerCase() !== item.label.toLowerCase() ? (
                  <Text variant="labelMedium" style={styles.unitText}>
                    {item.unit}
                  </Text>
                ) : null}
              </View>
              <Text variant="labelSmall" style={styles.headlineLabel}>
                {item.label}
              </Text>
              {/* The 95% interval the API supplies for its estimate. */}
              {item.range ? (
                <Text variant="labelSmall" style={styles.rangeText}>
                  {`${formatMacro(item.range.min, '')}–${formatMacro(item.range.max, '')}`}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {estimate ? (
        <View style={styles.estimateNote}>
          <Info size={13} color={palette.textSecondary} strokeWidth={2} />
          <Text variant="labelSmall" style={styles.estimateText}>
            Estimated from the dish name by Spoonacular. Ranges show the 95%
            confidence interval. This is not a verified restaurant label and not
            dietary or medical advice.
          </Text>
        </View>
      ) : null}

      {rest.length > 0 ? (
        <View style={styles.rest}>
          <Divider style={styles.divider} />
          {rest.map((item) => (
            <View key={item.key} style={styles.restRow}>
              <Text variant="bodySmall" style={styles.restLabel}>
                {humaniseKey(item.key)}
              </Text>
              <Text variant="bodySmall" style={styles.restValue}>
                {formatMacro(item.amount, item.unit) ?? '—'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headlineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  headlineCell: {
    // Two per row on a phone, growing to fill wider screens.
    minWidth: '47%',
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  headlineValue: {
    color: palette.primaryDark,
    fontSize: typography.title,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unitText: {
    color: palette.textSecondary,
    fontWeight: '700',
  },
  headlineLabel: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  estimateNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  estimateText: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    flex: 1,
    lineHeight: 16,
  },
  rangeText: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    opacity: 0.8,
    marginTop: 3,
  },
  rest: {
    marginTop: spacing.sm,
  },
  divider: {
    backgroundColor: palette.border,
    marginBottom: spacing.sm,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 5,
  },
  restLabel: {
    color: palette.textSecondary,
    fontSize: typography.supporting,
    flexShrink: 1,
  },
  restValue: {
    color: palette.text,
    fontSize: typography.supporting,
    fontWeight: '600',
  },
  empty: {
    color: palette.textSecondary,
    fontSize: typography.supporting,
  },
});