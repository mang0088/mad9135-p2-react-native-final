/* eslint-env jest */

const fs = require('fs');
const path = require('path');

// Expo's CLI injects EXPO_PUBLIC_* variables into the bundle. Jest does not go
// through that layer, so the same values are loaded here from .env before any
// module reads them. Values are assigned silently - never logged.
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#')) continue;

      const separator = line.indexOf('=');
      if (separator === -1) continue;

      const key = line.slice(0, separator).trim();
      if (key === '' || key.startsWith('#')) continue;

      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
} catch (error) {
  // A missing or unreadable .env simply leaves the API unconfigured; the app
  // surfaces that as a clear error state rather than crashing.
}

// react-native-gesture-handler ships a Jest setup that registers the native
// module mocks required when importing GestureHandlerRootView in tests.
require('react-native-gesture-handler/jestSetup');

// Reanimated needs its own test initialisation; without it importing
// react-native-reanimated fails with "loadUnpackers" under Jest.
require('react-native-reanimated').setUpTests();

// SafeAreaProvider renders nothing until it receives native insets, which never
// happens under Jest. The library ships an official mock that renders children
// immediately and returns zero insets. It is a default export.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});