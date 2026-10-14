import React from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Menu,
  Minus,
  Search,
  X,
} from 'lucide-react-native';

/**
 * Maps the Material Community icon names that react-native-paper requests
 * internally (Searchbar, Chip, Menu, IconButton) onto Lucide components.
 *
 * Routing Paper's icon resolver to Lucide keeps lucide-react-native as the one
 * icon library in the app, and avoids pulling in a second icon font.
 *
 * Names are pinned to exports verified present in lucide-react-native 1.57 -
 * `Close`, `Magnify` and `MenuDown` do not exist in this version.
 */
const LUCIDE_FOR_PAPER = {
  magnify: Search,
  search: Search,
  close: X,
  'close-circle': X,
  menu: Menu,
  'menu-down': ChevronDown,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'menu-up': ChevronDown,
  'checkbox-marked': Check,
  'checkbox-marked-outline': Check,
  'checkbox-blank-outline': Minus,
  'checkbox-blank': Minus,
  calendar: Calendar,
};

export const paperSettings = {
  icon: ({ name, color, size }) => {
    const Glyph = LUCIDE_FOR_PAPER[name];
    // Returning null here would make Paper fall back to its bundled
    // MaterialCommunityIcons renderer, defeating the single-library rule, so an
    // unmapped name degrades to a neutral glyph instead.
    if (!Glyph) return <Minus size={size ?? 24} color={color} strokeWidth={2} />;
    return <Glyph size={size ?? 24} color={color} strokeWidth={2} />;
  },
};

/**
 * Searchbar hardcodes its clear button icon and bypasses `settings.icon`, so
 * every Searchbar passes this explicitly to keep Lucide as the only library.
 */
export const searchClearIcon = ({ size, color }) => (
  <X size={size ?? 22} color={color} strokeWidth={2} />
);

export default paperSettings;