import React from 'react';
import { ChefHat, Compass } from 'lucide-react-native';

/**
 * Single source of truth for tab icons.
 *
 * These are the icons the app already used (Lucide `Compass` for Explore and
 * Lucide `ChefHat` for Cook), with the same stroke width and the same size the
 * default tab bar rendered them at. They are mapped here by route name so the
 * custom tab bar and the navigator cannot drift apart.
 *
 * Adding a tab means adding one entry here - no second icon library.
 */
export const TAB_ICON_SIZE = 24;
const TAB_ICON_STROKE = 2.1;

export const icons = {
  Explore: ({ color }) => (
    <Compass size={TAB_ICON_SIZE} color={color} strokeWidth={TAB_ICON_STROKE} />
  ),
  Cook: ({ color }) => (
    <ChefHat size={TAB_ICON_SIZE} color={color} strokeWidth={TAB_ICON_STROKE} />
  ),
};

export default icons;