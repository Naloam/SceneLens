const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: [
    '<rootDir>/src/__tests__/integration/predictive-trigger.test.ts',
    '<rootDir>/src/stores/__tests__/storageManager.test.ts',
    '<rootDir>/src/screens/__tests__/MeetingConfigScreen.test.tsx',
    '<rootDir>/src/core/__tests__/PredictiveTrigger.test.ts',
    '<rootDir>/src/rules/__tests__/RuleEngine.test.ts',
    '<rootDir>/src/stores/__tests__/geoFenceManager.test.ts',
    '<rootDir>/src/core/__tests__/predictive-trigger-feedback-demo.test.ts',
    '<rootDir>/src/screens/__tests__/StatsScreen.test.tsx',
    '<rootDir>/src/core/__tests__/SceneBridge.camera.test.ts',
  ],
};
