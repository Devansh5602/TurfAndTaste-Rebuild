/**
 * Android-first component tests for the Expo development build.
 *
 * `react-native-razorpay` ships native modules, so checkout is always mocked;
 * these tests assert the screen behaviour around the server payment API.
 */

// Screens read the public API base at render time; component tests replace the
// API-client functions, but the base URL must still resolve to a value.
process.env.EXPO_PUBLIC_API_URL ??= 'http://localhost:4000';

module.exports = {
  preset: 'jest-expo/android',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  // React Navigation, TanStack Query and NativeWind all settle asynchronously
  // on first render; the default 5s budget is too tight on a cold transform.
  testTimeout: 20000,
  moduleNameMapper: {
    // Native-only sheet; not opened by the screens under test.
    '^@gorhom/bottom-sheet$': '<rootDir>/test-support/bottom-sheet-stub.js',
  },
};
