module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/demo.ts',
    '!src/**/verify.ts',
    '!src/**/index.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    'react-native-fast-tflite': '<rootDir>/src/__mocks__/react-native-fast-tflite.ts',
    '\\.tflite$': '<rootDir>/src/__mocks__/tflite-mock.js',
    'react-native': '<rootDir>/src/__mocks__/react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo-modules-core|expo-modules-core|expo-constants|expo-keep-awkake|expo-device|expo-notifications|@expo|metro))/',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
