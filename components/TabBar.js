import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TabBarButton from './TabBarButton';
import { palette } from '../theme';

/**
 * The reference design's proportions, kept verbatim:
 * floating pill, marginHorizontal 20, paddingVertical 15, borderRadius 25.
 * Only the colours and the bottom offset are taken from this project.
 */
const BAR_RADIUS = 25;
const BAR_MARGIN_HORIZONTAL = 20;
const BAR_PADDING_VERTICAL = 15;

/**
 * Vertical space the floating bar occupies at the bottom of the screen.
 *
 * Measured from the bar's own metrics: ~82pt of bar height
 * (15pt padding above and below, plus the tallest animated item) plus up to
 * ~44pt of offset above the home indicator. Exported so scrolling screens can
 * reserve room and keep their last row clear of the bar instead of hiding
 * underneath it.
 */
export const FLOATING_TAB_BAR_SPACE = 132;

export default function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  // Sit above the home indicator / system bar, but never hug the screen edge.
  const bottomOffset = Math.max(insets.bottom + 10, 18);

  return (
    <View
      style={[styles.bar, { bottom: bottomOffset }]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];

        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

        const isFocused = state.index === index;

        // Preserves the standard tabPress contract, including preventDefault.
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const accessibilityLabel =
          options.tabBarAccessibilityLabel ?? label;

        return (
          <TabBarButton
            key={route.key}
            routeName={route.name}
            label={label}
            isFocused={isFocused}
            color={isFocused ? palette.primary : palette.textSecondary}
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: BAR_MARGIN_HORIZONTAL,
    right: BAR_MARGIN_HORIZONTAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    paddingVertical: BAR_PADDING_VERTICAL,
    borderRadius: BAR_RADIUS,
    // Soft hairline keeps the white bar legible on the cream background.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    shadowOpacity: 0.12,
    elevation: 8,
  },
});