/**
 * GuardPay AI — Jest Configuration
 * UI test suite for payment-flow and risk-response screens.
 * Run: npx jest --ci
 */
module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js)'],
  setupFilesAfterFramework: ['@testing-library/react-native/extend-expect'],
  moduleNameMapper: {
    '^axios$': '<rootDir>/src/__mocks__/axios.ts',
    '^../services/audioStream$': '<rootDir>/src/__mocks__/audioStream.ts',
    '^react-native-tts$': '<rootDir>/src/__mocks__/react-native-tts.ts',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/src/__mocks__/async-storage.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-tts|react-native-audio-record|react-native-permissions|react-native-localize|@react-native-async-storage)/)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
