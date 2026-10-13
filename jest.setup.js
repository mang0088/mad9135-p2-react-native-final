/* eslint-env jest */

// react-native-gesture-handler ships a Jest setup that registers the native
// module mocks required when importing GestureHandlerRootView in tests.
require('react-native-gesture-handler/jestSetup');

// SafeAreaProvider renders nothing until it receives native insets, which never
// happens under Jest. The library ships an official mock that renders children
// immediately and returns zero insets. It is a default export.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});
