/**
 * React Native Mock for Jest Tests
 */

const NativeModules = {
  SceneBridge: {
    ping: jest.fn(() => Promise.resolve({ message: 'mock', timestamp: Date.now() })),
    getCurrentLocation: jest.fn(() => Promise.resolve({ latitude: 0, longitude: 0, accuracy: 100, timestamp: Date.now() })),
    getConnectedWiFi: jest.fn(() => Promise.resolve(null)),
    getMotionState: jest.fn(() => Promise.resolve('STILL')),
    getInstalledApps: jest.fn(() => Promise.resolve([])),
    getForegroundApp: jest.fn(() => Promise.resolve('')),
    getUsageStats: jest.fn(() => Promise.resolve([])),
    setDoNotDisturb: jest.fn((enabled) => Promise.resolve({ enabled, mode: 'unknown' })),
    checkDoNotDisturbPermission: jest.fn(() => Promise.resolve(false)),
    openDoNotDisturbSettings: jest.fn(() => Promise.resolve(false)),
    setBrightness: jest.fn((level) => Promise.resolve({ level, brightness: level })),
    checkWriteSettingsPermission: jest.fn(() => Promise.resolve(false)),
    openWriteSettingsSettings: jest.fn(() => Promise.resolve(false)),
    openAppWithDeepLink: jest.fn(() => Promise.resolve(false)),
    isAppInstalled: jest.fn(() => Promise.resolve(false)),
    validateDeepLink: jest.fn(() => Promise.resolve(false)),
    getUpcomingEvents: jest.fn(() => Promise.resolve([])),
    requestPermission: jest.fn(() => Promise.resolve(false)),
    checkPermission: jest.fn(() => Promise.resolve(false)),
    checkUsageStatsPermission: jest.fn(() => Promise.resolve(false)),
    openUsageStatsSettings: jest.fn(() => Promise.resolve(false)),
    hasLocationPermission: jest.fn(() => Promise.resolve(true)),
    requestLocationPermission: jest.fn(() => Promise.resolve(true)),
    hasActivityRecognitionPermission: jest.fn(() => Promise.resolve(true)),
    requestActivityRecognitionPermission: jest.fn(() => Promise.resolve(true)),
    hasUsageStatsPermission: jest.fn(() => Promise.resolve(true)),
    requestUsageStatsPermission: jest.fn(() => Promise.resolve(true)),
    hasCameraPermission: jest.fn(() => Promise.resolve(true)),
    requestCameraPermission: jest.fn(() => Promise.resolve(true)),
    captureImage: jest.fn(() => Promise.resolve({ 
      base64: '', 
      width: 224, 
      height: 224, 
      format: 'JPEG', 
      timestamp: Date.now() 
    })),
    hasMicrophonePermission: jest.fn(() => Promise.resolve(true)),
    requestMicrophonePermission: jest.fn(() => Promise.resolve(true)),
    recordAudio: jest.fn(() => Promise.resolve({ 
      base64: '', 
      duration: 1000, 
      sampleRate: 16000, 
      format: 'WAV', 
      timestamp: Date.now() 
    })),
  },
};

module.exports = {
  NativeModules,
};