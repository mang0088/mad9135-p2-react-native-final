import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { icons } from '../assets/icons';
import { typography } from '../theme';

/**
 * Animation constants.
 *
 * These reproduce the reference implementation's behaviour exactly:
 * a 350ms spring driving the icon from 1x to 1.4x scale and 0 to 8pt of
 * downward travel, while the label fades from fully visible to invisible.
 */
const SPRING_CONFIG = { duration: 350 };
const SCALE_RANGE = [1, 1.4];
const TRAVEL_RANGE = [0, 8];

/**
 * A single tab: the project's existing icon, animated with a shared value so
 * repeated or rapid taps stay smooth and never queue duplicate animations.
 */
function TabBarButton({
  routeName,
  label,
  isFocused,
  color,
  accessibilityLabel,
  onPress,
  onLongPress,
}) {
  // Single driver for the animation. 0 = inactive, 1 = active.
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, SPRING_CONFIG);
  }, [progress, isFocused]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], SCALE_RANGE) },
      // translateY rather than `top`: identical movement, but it stays on the
      // compositor instead of re-running layout on every frame.
      { translateY: interpolate(progress.value, [0, 1], TRAVEL_RANGE) },
    ],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    // The label fades out when the tab is active. It stays mounted so its space
    // is reserved and switching tabs never causes a layout jump.
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
  }));

  const renderIcon = icons[routeName];
  if (!renderIcon) return null;

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isFocused }}
      // Mirrored as an explicit aria attribute: accessibilityState alone is not
      // always reflected onto the DOM node, which left aria-selected="false"
      // on the active tab.
      aria-selected={isFocused}
    >
      <Animated.View style={animatedIconStyle}>
        {renderIcon({ color })}
      </Animated.View>

      <Animated.Text
        numberOfLines={1}
        style={[styles.label, { color }, animatedLabelStyle]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    // A generous vertical hit area without changing the bar's visual height.
    paddingVertical: 2,
  },
  label: {
    fontSize: typography.meta,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
  },
});

export default React.memo(TabBarButton);