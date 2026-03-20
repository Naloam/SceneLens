import { BackgroundService } from '../BackgroundService';
import type { SilentContext } from '../../types';
import { useSceneStore } from '../../stores';
import { sceneBridge } from '../../core/SceneBridge';

jest.mock('../../core/SilentContextEngine', () => ({
  silentContextEngine: {
    getContext: jest.fn(),
  },
}));

jest.mock('../../rules/RuleEngine', () => ({
  ruleEngine: {
    matchRules: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../core/PredictiveTrigger', () => ({
  predictiveTrigger: {
    shouldTrigger: jest.fn(() => ({ suggest: false })),
  },
}));

jest.mock('../../notifications/NotificationManager', () => ({
  notificationManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    showSceneSuggestion: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../notifications/ProactiveReminder', () => ({
  proactiveReminder: {
    initialize: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    onSceneChange: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../notifications/SmartNotificationFilter', () => ({
  smartNotificationFilter: {
    initialize: jest.fn().mockResolvedValue(undefined),
    setCurrentScene: jest.fn(),
  },
}));

jest.mock('../../quickactions/QuickActionManager', () => ({
  quickActionManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../learning/PreferenceManager', () => ({
  preferenceManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../learning/AppUsageTracker', () => ({
  appUsageTracker: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../learning/FeedbackProcessor', () => ({
  feedbackProcessor: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../prediction/ContextPredictor', () => ({
  contextPredictor: {
    initialize: jest.fn().mockResolvedValue(undefined),
    onSceneChange: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../core/SceneBridge', () => ({
  sceneBridge: {
    getBatteryStatus: jest.fn().mockResolvedValue({
      isCharging: false,
      isFull: false,
      batteryLevel: 80,
    }),
    configureBackgroundLocationRecovery: jest.fn().mockResolvedValue(true),
    startBackgroundLocationService: jest.fn().mockResolvedValue({
      running: true,
      intervalMs: 15 * 60 * 1000,
      recoveryEnabled: true,
      recoveryIntervalMs: 15 * 60 * 1000,
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
    }),
    stopBackgroundLocationService: jest.fn().mockResolvedValue(true),
    getBackgroundLocationServiceStatus: jest.fn().mockResolvedValue({
      running: false,
      intervalMs: 0,
      recoveryEnabled: false,
      recoveryIntervalMs: 0,
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
    }),
  },
}));

jest.mock('../../stores', () => ({
  useSceneStore: {
    getState: jest.fn(),
  },
}));

const createContext = (overrides: Partial<SilentContext> = {}): SilentContext => ({
  timestamp: Date.now(),
  context: 'UNKNOWN',
  confidence: 0.2,
  signals: [],
  ...overrides,
});

describe('BackgroundService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSceneStore.getState as jest.Mock).mockReturnValue({
      currentContext: null,
      setCurrentContext: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reuses recent store context as a background stability anchor', () => {
    const service = new BackgroundService();
    const storeContext = createContext({
      context: 'HOME',
      confidence: 0.92,
      timestamp: Date.now() - 2 * 60 * 1000,
    });

    (useSceneStore.getState as jest.Mock).mockReturnValue({
      currentContext: storeContext,
      setCurrentContext: jest.fn(),
    });

    (service as any).isInForeground = false;

    const stabilized = (service as any).stabilizeContext(
      createContext({
        context: 'UNKNOWN',
        confidence: 0.18,
        signals: [
          {
            type: 'LOCATION',
            value: 'UNKNOWN',
            weight: 0.2,
            timestamp: Date.now(),
            isFresh: false,
          } as any,
        ],
      })
    );

    expect(stabilized.context).toBe('HOME');
  });

  it('keeps the last stable scene when a background transition is weak and unsupported', () => {
    const service = new BackgroundService();
    const storeContext = createContext({
      context: 'HOME',
      confidence: 0.88,
      timestamp: Date.now() - 2 * 60 * 1000,
    });

    (useSceneStore.getState as jest.Mock).mockReturnValue({
      currentContext: storeContext,
      setCurrentContext: jest.fn(),
    });

    (service as any).isInForeground = false;

    const stabilized = (service as any).stabilizeContext(
      createContext({
        context: 'OFFICE',
        confidence: 0.55,
        signals: [
          {
            type: 'TIME',
            value: 'AFTERNOON_WEEKDAY',
            weight: 0.7,
            timestamp: Date.now(),
          },
          {
            type: 'MOTION',
            value: 'STILL',
            weight: 0.5,
            timestamp: Date.now(),
          },
        ],
      })
    );

    expect(stabilized.context).toBe('HOME');
  });

  it('accepts a background transition when a fresh strong signal exists', () => {
    const service = new BackgroundService();
    const storeContext = createContext({
      context: 'HOME',
      confidence: 0.88,
      timestamp: Date.now() - 2 * 60 * 1000,
    });

    (useSceneStore.getState as jest.Mock).mockReturnValue({
      currentContext: storeContext,
      setCurrentContext: jest.fn(),
    });

    (service as any).isInForeground = false;

    const stabilized = (service as any).stabilizeContext(
      createContext({
        context: 'OFFICE',
        confidence: 0.55,
        signals: [
          {
            type: 'WIFI',
            value: 'OFFICE',
            weight: 0.9,
            timestamp: Date.now(),
            isFresh: true,
          } as any,
        ],
      })
    );

    expect(stabilized.context).toBe('OFFICE');
  });

  it('starts the native foreground location service when background detection is scheduled', async () => {
    jest.useFakeTimers();
    const service = new BackgroundService();

    (service as any).status = 'running';
    (service as any).isInForeground = false;

    await (service as any).scheduleNextDetection();

    expect(sceneBridge.configureBackgroundLocationRecovery).toHaveBeenCalledWith(true, 15 * 60 * 1000);
    expect(sceneBridge.startBackgroundLocationService).toHaveBeenCalledWith(15 * 60 * 1000);
    service.stop();
  });

  it('stops the native foreground location service when background detection stops', async () => {
    const service = new BackgroundService();

    (service as any).nativeForegroundServiceActive = true;
    service.stop();
    await (service as any).syncNativeBackgroundExecution();

    expect(sceneBridge.configureBackgroundLocationRecovery).toHaveBeenCalledWith(false, 5 * 60 * 1000);
    expect(sceneBridge.stopBackgroundLocationService).toHaveBeenCalled();
  });
});
