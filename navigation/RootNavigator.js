import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ExploreScreen from '../screens/ExploreScreen';
import MenuItemDetailsScreen from '../screens/MenuItemDetailsScreen';
import RecipesScreen from '../screens/RecipesScreen';
import IngredientFinderScreen from '../screens/IngredientFinderScreen';
import RecipeDetailsScreen from '../screens/RecipeDetailsScreen';
import TabBar from '../components/TabBar';
import { icons } from '../assets/icons';
import { palette, typography } from '../theme';

const Tab = createBottomTabNavigator();
const ExploreStack = createNativeStackNavigator();
const RecipesStack = createNativeStackNavigator();

/** Shared header styling so detail screens feel part of the same product. */
const headerOptions = {
  headerStyle: { backgroundColor: palette.background },
  headerTintColor: palette.primaryDark,
  headerTitleStyle: { fontWeight: '700', fontSize: typography.card },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: palette.background },
};

function ExploreStackNavigator() {
  return (
    <ExploreStack.Navigator screenOptions={headerOptions}>
      <ExploreStack.Screen
        name="ExploreHome"
        component={ExploreScreen}
        options={{ headerShown: false }}
      />
      <ExploreStack.Screen
        name="MenuItemDetails"
        component={MenuItemDetailsScreen}
        options={({ route }) => ({
          title: 'Menu item',
          // Avoid repeating a very long dish name in the header.
          headerTitle: route.params?.title
            ? String(route.params.title).slice(0, 28)
            : 'Menu item',
        })}
      />
    </ExploreStack.Navigator>
  );
}

function RecipesStackNavigator() {
  return (
    <RecipesStack.Navigator screenOptions={headerOptions}>
      <RecipesStack.Screen
        name="RecipesHome"
        component={RecipesScreen}
        options={{ headerShown: false }}
      />
      <RecipesStack.Screen
        name="IngredientFinder"
        component={IngredientFinderScreen}
        options={{ title: 'Ingredient finder' }}
      />
      <RecipesStack.Screen
        name="RecipeDetails"
        component={RecipeDetailsScreen}
        options={({ route }) => ({
          title: 'Recipe',
          headerTitle: route.params?.title
            ? String(route.params.title).slice(0, 28)
            : 'Recipe',
        })}
      />
    </RecipesStack.Navigator>
  );
}

/**
 * Two primary destinations:
 *   Explore - food discovery (menu dishes, videos, trivia, nutrition)
 *   Cook    - recipe search, ingredient finder, recipes and instructions
 *
 * Detail views live in stacks inside each tab so they keep native back
 * behaviour without adding more bottom tabs.
 */
export default function RootNavigator() {
  return (
    <Tab.Navigator
      // Floating, animated tab bar replacing the stock bar entirely - the two
      // are never rendered at the same time.
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // The bar floats over the content, so the scene must not also reserve a
        // strip for it.
        tabBarStyle: {
          position: 'absolute',
          height: 0,
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Explore"
        component={ExploreStackNavigator}
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          tabBarAccessibilityLabel: 'Explore tab',
          // Single source of truth for the icon; the custom bar reads the same map.
          tabBarIcon: ({ color }) => icons.Explore({ color }),
        }}
      />
      <Tab.Screen
        name="Cook"
        component={RecipesStackNavigator}
        options={{
          title: 'Cook',
          tabBarLabel: 'Cook',
          tabBarAccessibilityLabel: 'Recipes and cooking tab',
          tabBarIcon: ({ color }) => icons.Cook({ color }),
        }}
      />
    </Tab.Navigator>
  );
}