import * as React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { UserStackNavigation } from './navigation/UserNavigation';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';

import HomeScreen from './screens/HomeScreen';

const homeName = 'Home';

// Icons are keyed by the *actual* tab route name. The Recipes tab was
// previously matched against the string 'List', which never equalled the
// registered route name 'Recipes', so its icon name stayed undefined and
// Ionicons rendered nothing.
const TAB_ICONS = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Recipes: { focused: 'list', unfocused: 'list-outline' },
};
const FALLBACK_ICON = 'ellipse-outline';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <NavigationContainer>
            <Tab.Navigator
              initialRouteName={homeName}
              screenOptions={({ route }) => ({
                tabBarActiveTintColor: 'blue',
                tabBarInactiveTintColor: 'grey',
                tabBarLabelStyle: {
                  fontSize: 12,
                  fontWeight: '800',
                  paddingBottom: 2,
                },
                tabBarStyle: [
                  {
                    display: 'flex',
                  },
                  null,
                ],
                tabBarIcon: ({ focused, color, size }) => {
                  const icons = TAB_ICONS[route.name];
                  const iconName = icons
                    ? focused
                      ? icons.focused
                      : icons.unfocused
                    : FALLBACK_ICON;

                  return <Ionicons name={iconName} size={size} color={color} />;
                },
              })}
            >
              <Tab.Screen name="Home" component={HomeScreen} />
              <Tab.Screen
                name="Recipes"
                component={UserStackNavigation}
                options={{ headerShown: false }}
              />
            </Tab.Navigator>
          </NavigationContainer>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
});
