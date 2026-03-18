type NativeSystemSettingsModule = {
  [key: string]: jest.Mock;
};

function createNativeModule(overrides: Partial<NativeSystemSettingsModule> = {}): NativeSystemSettingsModule {
  return {
    setVolume: jest.fn().mockResolvedValue({
      streamType: 'media',
      level: 50,
      actualVolume: 8,
      maxVolume: 15,
      success: true,
    }),
    getVolume: jest.fn().mockResolvedValue({
      streamType: 'media',
      level: 50,
      currentVolume: 8,
      maxVolume: 15,
    }),
    getAllVolumes: jest.fn().mockResolvedValue({
      media: { level: 50, current: 8, max: 15 },
      ring: { level: 100, current: 15, max: 15 },
      notification: { level: 80, current: 12, max: 15 },
      alarm: { level: 70, current: 10, max: 15 },
      system: { level: 40, current: 6, max: 15 },
    }),
    setBrightness: jest.fn().mockResolvedValue({
      level: 35,
      autoMode: false,
      success: true,
    }),
    getBrightness: jest.fn().mockResolvedValue({
      level: 50,
      rawValue: 128,
      autoMode: false,
    }),
    setDoNotDisturb: jest.fn().mockResolvedValue({
      enabled: true,
      mode: 'none',
      filter: 3,
      success: true,
    }),
    getDoNotDisturbStatus: jest.fn().mockResolvedValue({
      enabled: false,
      mode: 'all',
      filter: 4,
      hasPermission: true,
    }),
    checkDoNotDisturbPermission: jest.fn().mockResolvedValue(true),
    openDoNotDisturbSettings: jest.fn().mockResolvedValue(true),
    setWiFi: jest.fn().mockResolvedValue({
      enabled: true,
      success: true,
    }),
    getWiFiStatus: jest.fn().mockResolvedValue({ enabled: true }),
    openWiFiSettings: jest.fn().mockResolvedValue(true),
    setBluetooth: jest.fn().mockResolvedValue({
      enabled: true,
      success: true,
    }),
    getBluetoothStatus: jest.fn().mockResolvedValue({
      supported: true,
      enabled: true,
    }),
    openBluetoothSettings: jest.fn().mockResolvedValue(true),
    setScreenTimeout: jest.fn().mockResolvedValue({
      seconds: 60,
      milliseconds: 60000,
      success: true,
    }),
    getScreenTimeout: jest.fn().mockResolvedValue({
      seconds: 60,
      milliseconds: 60000,
    }),
    checkWriteSettingsPermission: jest.fn().mockResolvedValue(true),
    openWriteSettingsSettings: jest.fn().mockResolvedValue(true),
    openNotificationSettings: jest.fn().mockResolvedValue(true),
    checkBluetoothPermission: jest.fn().mockResolvedValue(true),
    requestBluetoothPermission: jest.fn().mockResolvedValue(true),
    applySettings: jest.fn().mockResolvedValue({
      results: { brightness: true },
      success: true,
      hasErrors: false,
    }),
    getSystemState: jest.fn().mockResolvedValue({
      volume: { media: 50, ring: 100, notification: 80, alarm: 70, system: 40 },
      brightness: { level: 50, autoMode: false },
      doNotDisturb: { enabled: false, mode: 'all' },
      wifi: { enabled: true },
      bluetooth: { supported: true, enabled: true },
      screenTimeout: 60,
      permissions: {
        writeSettings: true,
        notificationPolicy: true,
        bluetoothConnect: true,
      },
    }),
    ...overrides,
  };
}

function loadController(overrides: Partial<NativeSystemSettingsModule> = {}) {
  jest.resetModules();

  const nativeModule = createNativeModule(overrides);
  jest.doMock('react-native', () => ({
    NativeModules: {
      SystemSettings: nativeModule,
    },
  }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const controller = require('../SystemSettingsController');
  return {
    nativeModule,
    ...controller,
  };
}

describe('SystemSettingsController', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('normalizes fractional brightness before calling the native setter', async () => {
    const { nativeModule, setBrightness } = loadController();

    await expect(setBrightness(0.35)).resolves.toBe(true);

    expect(nativeModule.setBrightness).toHaveBeenCalledWith(35, false);
  });

  it('normalizes scene brightness before batching settings', async () => {
    const { nativeModule, applySceneSettings } = loadController();

    await applySceneSettings('UNKNOWN', { brightness: 0.35 });

    expect(nativeModule.applySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        brightness: 35,
      })
    );
  });

  it('marks the batch unsuccessful when appended wifi changes fail', async () => {
    const { applySceneSettings } = loadController({
      applySettings: jest.fn().mockResolvedValue({
        results: { brightness: true },
        success: true,
        hasErrors: false,
      }),
      setWiFi: jest.fn().mockResolvedValue({
        enabled: true,
        success: false,
        error: 'NOT_SUPPORTED',
        settingsOpened: true,
      }),
    });

    const result = await applySceneSettings('UNKNOWN', { wifi: true });

    expect(result.results.wifi).toBe(false);
    expect(result.hasErrors).toBe(true);
    expect(result.success).toBe(false);
  });

  it('keeps the system stream when reading all volumes', async () => {
    const { getAllVolumes } = loadController();

    await expect(getAllVolumes()).resolves.toEqual({
      media: 50,
      ring: 100,
      notification: 80,
      alarm: 70,
      system: 40,
    });
  });
});
