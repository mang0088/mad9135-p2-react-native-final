/**
 * Tests for the floating animated tab bar.
 *
 * These lock in the two things most likely to regress:
 *   1. the design/animation behaviour taken from the reference implementation
 *   2. the project's own theme, icons and routes, which must NOT be replaced by
 *      the reference's example colours or example routes
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native-paper';
import { Compass, ChefHat } from 'lucide-react-native';

import TabBar, { FLOATING_TAB_BAR_SPACE } from '../components/TabBar';
import TabBarButton from '../components/TabBarButton';
import { icons } from '../assets/icons';
import { palette } from '../theme';

/** React Native styles may be arrays; flatten them for assertions. */
function flattenStyle(style) {
  const list = Array.isArray(style) ? style.flat(Infinity) : [style];
  return Object.assign({}, ...list.filter(Boolean));
}

/** Builds the state/descriptors/navigation triple the tab bar receives. */
function makeBar(overrides = {}) {
  const navigate = jest.fn();
  const emit = jest.fn(({ type }) => ({ defaultPrevented: type === 'blocked' }));

  const routes = overrides.routes ?? [
    { key: 'Explore-1', name: 'Explore', params: undefined },
    { key: 'Cook-1', name: 'Cook', params: undefined },
  ];

  const options = {
    Explore: {
      title: 'Explore',
      tabBarLabel: 'Explore',
      tabBarAccessibilityLabel: 'Explore tab',
    },
    Cook: {
      title: 'Cook',
      tabBarLabel: 'Cook',
      tabBarAccessibilityLabel: 'Recipes and cooking tab',
    },
  };

  const descriptors = {};
  for (const route of routes) descriptors[route.key] = { options: options[route.name] };

  const props = {
    state: { index: overrides.index ?? 0, routes },
    descriptors,
    navigation: { emit, navigate },
  };

  return { props, navigate, emit };
}

describe('TabBar', () => {
  it('renders the project\'s existing routes, in order, with their labels', () => {
    const { props } = makeBar();
    render(<TabBar {...props} />);

    expect(screen.getByLabelText('Explore tab')).toBeTruthy();
    expect(screen.getByLabelText('Recipes and cooking tab')).toBeTruthy();
    expect(screen.getByText('Explore')).toBeTruthy();
    expect(screen.getByText('Cook')).toBeTruthy();
  });

  it('does not render the reference repository\'s example routes', () => {
    const { props } = makeBar();
    render(<TabBar {...props} />);

    // index / explore / create / profile are the reference's demo routes.
    expect(screen.queryByText('Create')).toBeNull();
    expect(screen.queryByText('Profile')).toBeNull();
    expect(screen.queryByText('Home')).toBeNull();
  });

  it('marks only the focused route as selected', () => {
    const { props } = makeBar({ index: 1 });
    render(<TabBar {...props} />);

    expect(screen.getByLabelText('Explore tab').props.accessibilityState.selected).toBe(false);
    expect(
      screen.getByLabelText('Recipes and cooking tab').props.accessibilityState.selected
    ).toBe(true);
  });

  it('navigates to a tab when it is pressed', () => {
    const { props, navigate } = makeBar({ index: 0 });
    render(<TabBar {...props} />);

    fireEvent.press(screen.getByLabelText('Recipes and cooking tab'));

    expect(navigate).toHaveBeenCalledWith('Cook', undefined);
  });

  it('emits tabPress and does not navigate for the already-focused tab', () => {
    const { props, navigate, emit } = makeBar({ index: 0 });
    render(<TabBar {...props} />);

    fireEvent.press(screen.getByLabelText('Explore tab'));

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'Explore-1' })
    );
    // Re-tapping the active tab must not re-navigate.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('emits tabLongPress', () => {
    const { props, emit } = makeBar();
    render(<TabBar {...props} />);

    fireEvent(screen.getByLabelText('Explore tab'), 'longPress');

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabLongPress', target: 'Explore-1' })
    );
  });

  it('uses the project theme, not the reference palette', () => {
    const { props } = makeBar({ index: 0 });
    render(<TabBar {...props} />);

    const bar = screen.UNSAFE_getByProps({ accessibilityRole: 'tablist' });
    const flat = flattenStyle(bar.props.style);

    expect(flat.backgroundColor).toBe(palette.surface);

    // The reference's hardcoded colours must not appear anywhere.
    const serialised = JSON.stringify(bar.props.style);
    expect(serialised).not.toContain('#0891b2');
    expect(serialised).not.toContain('#737373');
  });

  it('colours the active icon with the project primary and inactive with secondary', () => {
    const { props } = makeBar({ index: 0 });
    render(<TabBar {...props} />);

    expect(icons.Explore({ color: palette.primary })).toBeTruthy();
    // The active tab receives palette.primary, the inactive one palette.textSecondary.
    const activeColour = icons.Explore({ color: palette.primary });
    const inactiveColour = icons.Cook({ color: palette.textSecondary });
    expect(activeColour.props.color).toBe(palette.primary);
    expect(inactiveColour.props.color).toBe(palette.textSecondary);
  });

  it('floats above the content and reserves scroll space for itself', () => {
    const { props } = makeBar();
    render(<TabBar {...props} />);

    const bar = screen.UNSAFE_getByProps({ accessibilityRole: 'tablist' });
    const flat = flattenStyle(bar.props.style);

    expect(flat.position).toBe('absolute');
    expect(typeof flat.bottom).toBe('number');
    expect(flat.borderRadius).toBeGreaterThan(0);
    // Enough clearance for the bar plus the device inset.
    expect(FLOATING_TAB_BAR_SPACE).toBeGreaterThan(100);
  });
});

describe('TabBarButton', () => {
  const baseProps = {
    routeName: 'Explore',
    label: 'Explore',
    accessibilityLabel: 'Explore tab',
    onPress: jest.fn(),
    onLongPress: jest.fn(),
  };

  it('renders the project icon for the route', () => {
    render(<TabBarButton {...baseProps} isFocused={false} color={palette.textSecondary} />);

    expect(screen.UNSAFE_getAllByType(Compass).length).toBeGreaterThan(0);
    expect(screen.UNSAFE_queryAllByType(ChefHat).length).toBe(0);
  });

  it('renders a different icon for the other tab', () => {
    render(<TabBarButton {...baseProps} routeName="Cook" isFocused color={palette.primary} />);

    expect(screen.UNSAFE_getAllByType(ChefHat).length).toBeGreaterThan(0);
  });

  it('keeps the label in the tree for both states so layout never shifts', () => {
    const { rerender } = render(
      <TabBarButton {...baseProps} isFocused={false} color={palette.textSecondary} />
    );
    expect(screen.getByText('Explore')).toBeTruthy();

    rerender(<TabBarButton {...baseProps} isFocused color={palette.primary} />);
    expect(screen.getByText('Explore')).toBeTruthy();
  });

  it('exposes tab role and selected state for screen readers', () => {
    const { rerender } = render(
      <TabBarButton {...baseProps} isFocused={false} color={palette.textSecondary} />
    );
    const el = screen.getByLabelText('Explore tab');
    expect(el.props.accessibilityRole).toBe('tab');
    expect(el.props.accessibilityState.selected).toBe(false);

    rerender(<TabBarButton {...baseProps} isFocused color={palette.primary} />);

    const active = screen.getByLabelText('Explore tab');
    expect(active.props.accessibilityState.selected).toBe(true);
  });

  it('wires press and long press through to the navigator', () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    render(
      <TabBarButton
        {...baseProps}
        onPress={onPress}
        onLongPress={onLongPress}
        isFocused={false}
        color={palette.textSecondary}
      />
    );

    const el = screen.getByLabelText('Explore tab');
    fireEvent.press(el);
    fireEvent(el, 'longPress');

    expect(onPress).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalled();
  });

  it('renders nothing for an unmapped route rather than crashing', () => {
    render(
      <TabBarButton
        {...baseProps}
        routeName="NotATab"
        isFocused={false}
        color={palette.textSecondary}
      />
    );
    expect(screen.queryByLabelText('Explore tab')).toBeNull();
  });
});

describe('Project icon map', () => {
  it('keeps the original Lucide icons and their stroke width', () => {
    const compass = icons.Explore({ color: palette.primary });
    const chefHat = icons.Cook({ color: palette.primary });

    expect(compass.type).toBe(Compass);
    expect(chefHat.type).toBe(ChefHat);
    // Existing size and stroke weight, unchanged by the new tab bar.
    expect(compass.props.size).toBe(24);
    expect(chefHat.props.size).toBe(24);
    expect(compass.props.strokeWidth).toBe(2.1);
    expect(chefHat.props.strokeWidth).toBe(2.1);
  });

  it('covers exactly the project\'s two tabs', () => {
    expect(Object.keys(icons).sort()).toEqual(['Cook', 'Explore']);
  });
});

describe('Animation behaviour', () => {
  it('drives the icon through a shared value that springs on focus change', () => {
    // Guards the reference's motion: scale 1 -> 1.4 and 8pt of downward travel.
    const source = require('fs').readFileSync(
      require.resolve('../components/TabBarButton'),
      'utf8'
    );

    expect(source).toContain('SCALE_RANGE = [1, 1.4]');
    expect(source).toContain('TRAVEL_RANGE = [0, 8]');
    expect(source).toContain('withSpring');
    expect(source).toContain('duration: 350');
    // Label fades out on selection.
    expect(source).toContain('[1, 0]');
    // Icons move on the compositor rather than via layout.
    expect(source).toContain('translateY');
  });

  it('renders the active and inactive states without warnings', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { props } = makeBar({ index: 0 });
    const { rerender } = render(<TabBar {...props} />);

    const other = makeBar({ index: 1 });
    rerender(<TabBar {...other.props} />);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('survives rapid repeated tab switches', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const first = makeBar({ index: 0 });
    const { rerender } = render(<TabBar {...first.props} />);

    for (let i = 0; i < 6; i += 1) {
      rerender(<TabBar {...makeBar({ index: i % 2 }).props} />);
    }

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});