/**
 * React Native Mock for Jest Tests
 */

const listeners = new Map();
const appStateListeners = new Set();

const NativeModules = {
  SceneBridge: {
    ping: jest.fn(() => Promise.resolve({ message: 'mock', timestamp: Date.now() })),
    getCurrentLocation: jest.fn(() => Promise.resolve({ latitude: 0, longitude: 0, accuracy: 100, timestamp: Date.now() })),
    getConnectedWiFi: jest.fn(() => Promise.resolve(null)),
    consumePendingLocationImport: jest.fn(() => Promise.resolve(null)),
    configureBackgroundLocationRecovery: jest.fn(() => Promise.resolve(true)),
    startBackgroundLocationService: jest.fn((intervalMs = 0) => Promise.resolve({
      running: true,
      intervalMs,
      recoveryEnabled: true,
      recoveryIntervalMs: intervalMs,
      executionPolicy: null,
      lastLocation: null,
      telemetry: {
        lastStartReason: 'manual',
        lastStartAt: Date.now(),
        lastStopReason: null,
        lastStopAt: null,
        lastRecoveryReason: null,
        lastRecoveryAt: null,
        lastRecoveryScheduleAt: null,
        nextRecoveryDueAt: null,
        nextRecoveryKind: null,
        immediateWorkerState: null,
        immediateWorkerRunAttemptCount: 0,
        periodicWorkerState: null,
        periodicWorkerRunAttemptCount: 0,
        lastWorkerRunAt: null,
        lastWorkerOutcome: null,
        lastWorkerDetail: null,
        lastFailureReason: null,
        lastFailureAt: null,
        lastPolicyBlockerReason: null,
        lastPolicyBlockerAt: null,
        restartCount: 0,
      },
    })),
    stopBackgroundLocationService: jest.fn(() => Promise.resolve(true)),
    getBackgroundLocationServiceStatus: jest.fn(() => Promise.resolve({
      running: false,
      intervalMs: 0,
      recoveryEnabled: false,
      recoveryIntervalMs: 0,
      executionPolicy: null,
      lastLocation: null,
      telemetry: {
        lastStartReason: null,
        lastStartAt: null,
        lastStopReason: null,
        lastStopAt: null,
        lastRecoveryReason: null,
        lastRecoveryAt: null,
        lastRecoveryScheduleAt: null,
        nextRecoveryDueAt: null,
        nextRecoveryKind: null,
        immediateWorkerState: null,
        immediateWorkerRunAttemptCount: 0,
        periodicWorkerState: null,
        periodicWorkerRunAttemptCount: 0,
        lastWorkerRunAt: null,
        lastWorkerOutcome: null,
        lastWorkerDetail: null,
        lastFailureReason: null,
        lastFailureAt: null,
        lastPolicyBlockerReason: null,
        lastPolicyBlockerAt: null,
        restartCount: 0,
      },
    })),
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
    isIgnoringBatteryOptimizations: jest.fn(() => Promise.resolve(false)),
    openBatteryOptimizationSettings: jest.fn(() => Promise.resolve(true)),
    requestIgnoreBatteryOptimizations: jest.fn(() => Promise.resolve(true)),
    isBackgroundRestricted: jest.fn(() => Promise.resolve(false)),
    isPowerSaveModeEnabled: jest.fn(() => Promise.resolve(false)),
    openBatterySaverSettings: jest.fn(() => Promise.resolve(true)),
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
  SystemSettings: {
    checkDoNotDisturbPermission: jest.fn(() => Promise.resolve(false)),
    openDoNotDisturbSettings: jest.fn(() => Promise.resolve(false)),
    checkWriteSettingsPermission: jest.fn(() => Promise.resolve(false)),
    openWriteSettingsSettings: jest.fn(() => Promise.resolve(false)),
    openNotificationSettings: jest.fn(() => Promise.resolve(false)),
    checkBluetoothPermission: jest.fn(() => Promise.resolve(false)),
    requestBluetoothPermission: jest.fn(() => Promise.resolve(false)),
  },
  OppoPermission: {
    isOppoDevice: jest.fn(() => Promise.resolve(false)),
    openOppoPermissionSettings: jest.fn(() => Promise.resolve(true)),
  },
  SourceCode: {
    scriptURL: 'http://localhost:8081/index.bundle?platform=android',
  },
};

const DeviceEventEmitter = {
  addListener: jest.fn((eventName, handler) => {
    const handlers = listeners.get(eventName) || new Set();
    handlers.add(handler);
    listeners.set(eventName, handlers);

    return {
      remove: jest.fn(() => {
        handlers.delete(handler);
        if (handlers.size === 0) {
          listeners.delete(eventName);
        }
      }),
    };
  }),
  emit: jest.fn((eventName, payload) => {
    const handlers = listeners.get(eventName);
    if (!handlers) {
      return false;
    }

    handlers.forEach(handler => handler(payload));
    return true;
  }),
};

const Platform = {
  OS: 'android',
  Version: 34,
  select: spec => spec.android ?? spec.default,
};

const AppState = {
  currentState: 'active',
  addEventListener: jest.fn((eventName, handler) => {
    if (eventName !== 'change') {
      return {
        remove: jest.fn(),
      };
    }

    appStateListeners.add(handler);

    return {
      remove: jest.fn(() => {
        appStateListeners.delete(handler);
      }),
    };
  }),
  __emitChange: jest.fn((nextState) => {
    AppState.currentState = nextState;
    appStateListeners.forEach(handler => handler(nextState));
  }),
};

const Image = {
  resolveAssetSource: jest.fn(source => {
    if (typeof source === 'number') {
      return { uri: `file:///mock-asset-${source}` };
    }

    if (typeof source === 'string') {
      return { uri: source };
    }

    return source ?? { uri: 'file:///mock-asset' };
  }),
};

const Linking = {
  openSettings: jest.fn(() => Promise.resolve()),
};

const Alert = {
  alert: jest.fn(),
};

const PermissionsAndroid = {
  PERMISSIONS: {
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
    READ_CALENDAR: 'android.permission.READ_CALENDAR',
    WRITE_CALENDAR: 'android.permission.WRITE_CALENDAR',
    POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    CAMERA: 'android.permission.CAMERA',
    READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
    WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    NEVER_ASK_AGAIN: 'never_ask_again',
  },
  check: jest.fn(() => Promise.resolve(true)),
  request: jest.fn(() => Promise.resolve('granted')),
};

module.exports = {
  NativeModules,
  DeviceEventEmitter,
  Platform,
  AppState,
  Image,
  Linking,
  Alert,
  PermissionsAndroid,
};
