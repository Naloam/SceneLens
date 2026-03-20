type LoadedPermissionModule = {
  PermissionManager: typeof import('../PermissionManager').PermissionManager;
  PermissionStatus: typeof import('../PermissionManager').PermissionStatus;
  PermissionType: typeof import('../PermissionManager').PermissionType;
  requiresNotificationRuntimePermission: typeof import('../PermissionManager').requiresNotificationRuntimePermission;
  requiresBackgroundLocationSettingsNavigation: typeof import('../PermissionManager').requiresBackgroundLocationSettingsNavigation;
  sceneBridge: {
    hasUsageStatsPermission: jest.Mock;
    openUsageStatsSettings: jest.Mock;
    isIgnoringBatteryOptimizations: jest.Mock;
    openBatteryOptimizationSettings: jest.Mock;
    requestIgnoreBatteryOptimizations: jest.Mock;
  };
  oppoPermission: {
    isOppoDevice: jest.Mock;
    openOppoPermissionSettings: jest.Mock;
  };
  systemSettings: {
    checkDoNotDisturbPermission: jest.Mock;
    checkWriteSettingsPermission: jest.Mock;
    openDoNotDisturbSettings: jest.Mock;
    openNotificationSettings: jest.Mock;
    openWriteSettingsSettings: jest.Mock;
  };
  asyncStorage: {
    getItem: jest.Mock;
    setItem: jest.Mock;
  };
  linking: {
    openSettings: jest.Mock;
  };
  permissionsAndroid: {
    check: jest.Mock;
    request: jest.Mock;
  };
};

function loadPermissionModule(platformVersion = 34): LoadedPermissionModule {
  jest.resetModules();
  let permissionsAndroidMock: LoadedPermissionModule['permissionsAndroid'] | undefined;
  let oppoPermissionMock: LoadedPermissionModule['oppoPermission'] | undefined;

  jest.doMock('react-native', () => {
    oppoPermissionMock = {
      isOppoDevice: jest.fn(),
      openOppoPermissionSettings: jest.fn(),
    };
    const reactNativeMock = {
      Platform: {
        Version: platformVersion,
        OS: 'android',
        select: (spec: Record<string, unknown>) => spec.android ?? spec.default,
      },
      Linking: {
        openSettings: jest.fn(() => Promise.resolve()),
      },
      Alert: {
        alert: jest.fn(),
      },
      PermissionsAndroid: {
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
      },
      NativeModules: {
        OppoPermission: oppoPermissionMock,
      },
    };
    permissionsAndroidMock = reactNativeMock.PermissionsAndroid;
    return reactNativeMock;
  });

  jest.doMock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
      getItem: jest.fn(),
      setItem: jest.fn(),
    },
  }));

  jest.doMock('../../core/SceneBridge', () => ({
    sceneBridge: {
      hasUsageStatsPermission: jest.fn(),
      openUsageStatsSettings: jest.fn(),
      isIgnoringBatteryOptimizations: jest.fn(),
      openBatteryOptimizationSettings: jest.fn(),
      requestIgnoreBatteryOptimizations: jest.fn(),
    },
  }));

  jest.doMock('../../automation/SystemSettingsController', () => ({
    checkDoNotDisturbPermission: jest.fn(),
    checkWriteSettingsPermission: jest.fn(),
    openDoNotDisturbSettings: jest.fn(),
    openNotificationSettings: jest.fn(),
    openWriteSettingsSettings: jest.fn(),
  }));

  const permissionModule = require('../PermissionManager') as typeof import('../PermissionManager');
  const sceneBridge = require('../../core/SceneBridge').sceneBridge;
  const systemSettings = require('../../automation/SystemSettingsController');
  const asyncStorage = require('@react-native-async-storage/async-storage').default;
  const reactNative = require('react-native');
  const oppoPermission = oppoPermissionMock ?? {
    isOppoDevice: jest.fn(),
    openOppoPermissionSettings: jest.fn(),
  };

  jest.clearAllMocks();

  asyncStorage.getItem.mockResolvedValue(null);
  asyncStorage.setItem.mockResolvedValue(undefined);
  systemSettings.checkWriteSettingsPermission.mockResolvedValue(false);
  systemSettings.checkDoNotDisturbPermission.mockResolvedValue(false);
  systemSettings.openWriteSettingsSettings.mockResolvedValue(false);
  systemSettings.openDoNotDisturbSettings.mockResolvedValue(false);
  systemSettings.openNotificationSettings.mockResolvedValue(false);
  sceneBridge.hasUsageStatsPermission.mockResolvedValue(false);
  sceneBridge.openUsageStatsSettings.mockResolvedValue(false);
  sceneBridge.isIgnoringBatteryOptimizations.mockResolvedValue(false);
  sceneBridge.openBatteryOptimizationSettings.mockResolvedValue(true);
  sceneBridge.requestIgnoreBatteryOptimizations.mockResolvedValue(true);
  oppoPermission.isOppoDevice.mockResolvedValue(false);
  oppoPermission.openOppoPermissionSettings.mockResolvedValue(true);

  return {
    PermissionManager: permissionModule.PermissionManager,
    PermissionStatus: permissionModule.PermissionStatus,
    PermissionType: permissionModule.PermissionType,
    requiresNotificationRuntimePermission: permissionModule.requiresNotificationRuntimePermission,
    requiresBackgroundLocationSettingsNavigation: permissionModule.requiresBackgroundLocationSettingsNavigation,
    sceneBridge,
    oppoPermission,
    systemSettings,
    asyncStorage,
    linking: reactNative.Linking,
    permissionsAndroid: permissionsAndroidMock ?? reactNative.PermissionsAndroid,
  };
}

describe('PermissionManager', () => {
  it('checks write settings through SystemSettingsController', async () => {
    const {
      PermissionManager,
      PermissionStatus,
      PermissionType,
      systemSettings,
    } = loadPermissionModule();
    systemSettings.checkWriteSettingsPermission.mockResolvedValue(true);
    const manager = new PermissionManager();

    const result = await manager.checkPermission(PermissionType.WRITE_SETTINGS);

    expect(systemSettings.checkWriteSettingsPermission).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      permission: PermissionType.WRITE_SETTINGS,
      status: PermissionStatus.GRANTED,
      canRequest: false,
    });
  });

  it('checks usage stats through SceneBridge', async () => {
    const {
      PermissionManager,
      PermissionStatus,
      PermissionType,
      sceneBridge,
    } = loadPermissionModule();
    sceneBridge.hasUsageStatsPermission.mockResolvedValue(true);
    const manager = new PermissionManager();

    const result = await manager.checkPermission(PermissionType.USAGE_STATS);

    expect(sceneBridge.hasUsageStatsPermission).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(PermissionStatus.GRANTED);
  });

  it('checks battery optimization exemption through SceneBridge', async () => {
    const {
      PermissionManager,
      PermissionStatus,
      PermissionType,
      sceneBridge,
    } = loadPermissionModule();
    sceneBridge.isIgnoringBatteryOptimizations.mockResolvedValue(true);
    const manager = new PermissionManager();

    const result = await manager.checkPermission(PermissionType.BATTERY_OPTIMIZATION);

    expect(sceneBridge.isIgnoringBatteryOptimizations).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(PermissionStatus.GRANTED);
  });

  it('requests special permissions through wrappers before falling back to app settings', async () => {
    const {
      PermissionManager,
      PermissionStatus,
      PermissionType,
      sceneBridge,
      systemSettings,
    } = loadPermissionModule();
    systemSettings.openWriteSettingsSettings.mockResolvedValue(true);
    sceneBridge.openUsageStatsSettings.mockResolvedValue(true);
    const manager = new PermissionManager();

    const writeSettingsStatus = await manager.requestPermission(PermissionType.WRITE_SETTINGS);
    const usageStatsStatus = await manager.requestPermission(PermissionType.USAGE_STATS);

    expect(writeSettingsStatus).toBe(PermissionStatus.REQUIRES_SETTINGS);
    expect(systemSettings.openWriteSettingsSettings).toHaveBeenCalledTimes(1);
    expect(usageStatsStatus).toBe(PermissionStatus.REQUIRES_SETTINGS);
    expect(sceneBridge.openUsageStatsSettings).toHaveBeenCalledTimes(1);
  });

  it('requests battery optimization exemption through SceneBridge first', async () => {
    const {
      PermissionManager,
      PermissionStatus,
      PermissionType,
      sceneBridge,
    } = loadPermissionModule();
    sceneBridge.requestIgnoreBatteryOptimizations.mockResolvedValue(true);
    const manager = new PermissionManager();

    const status = await manager.requestPermission(PermissionType.BATTERY_OPTIMIZATION);

    expect(status).toBe(PermissionStatus.REQUIRES_SETTINGS);
    expect(sceneBridge.requestIgnoreBatteryOptimizations).toHaveBeenCalledTimes(1);
  });

  it('opens notification settings through SystemSettingsController first', async () => {
    const {
      PermissionManager,
      PermissionType,
      systemSettings,
    } = loadPermissionModule();
    systemSettings.openNotificationSettings.mockResolvedValue(true);
    const manager = new PermissionManager();

    await manager.openSpecificSettings(PermissionType.NOTIFICATIONS);

    expect(systemSettings.openNotificationSettings).toHaveBeenCalledTimes(1);
  });

  it('opens do-not-disturb settings through SystemSettingsController', async () => {
    const {
      PermissionManager,
      PermissionType,
      systemSettings,
    } = loadPermissionModule();
    systemSettings.openDoNotDisturbSettings.mockResolvedValue(true);
    const manager = new PermissionManager();

    await manager.openSpecificSettings(PermissionType.NOTIFICATION_POLICY);

    expect(systemSettings.openDoNotDisturbSettings).toHaveBeenCalledTimes(1);
  });

  it('opens battery optimization settings through SceneBridge', async () => {
    const {
      PermissionManager,
      PermissionType,
      sceneBridge,
    } = loadPermissionModule();
    sceneBridge.openBatteryOptimizationSettings.mockResolvedValue(true);
    const manager = new PermissionManager();

    await manager.openSpecificSettings(PermissionType.BATTERY_OPTIMIZATION);

    expect(sceneBridge.openBatteryOptimizationSettings).toHaveBeenCalledTimes(1);
  });

  it('routes background location fallback through app settings with precise blocked permissions', async () => {
    const {
      PermissionManager,
      PermissionType,
    } = loadPermissionModule();
    const manager = new PermissionManager();
    const openAppSettingsSpy = jest
      .spyOn(manager, 'openAppSettings')
      .mockResolvedValue(undefined);

    await manager.openSpecificSettings(PermissionType.LOCATION_BACKGROUND);

    expect(openAppSettingsSpy).toHaveBeenCalledWith([
      PermissionType.LOCATION_FINE,
      PermissionType.LOCATION_BACKGROUND,
    ]);
  });

  it('routes write settings permission requests through app settings when direct jump is unavailable', async () => {
    const {
      PermissionManager,
      PermissionStatus,
      PermissionType,
      systemSettings,
    } = loadPermissionModule();
    systemSettings.openWriteSettingsSettings.mockResolvedValue(false);
    const manager = new PermissionManager();
    const openAppSettingsSpy = jest
      .spyOn(manager, 'openAppSettings')
      .mockResolvedValue(undefined);

    const status = await manager.requestPermission(PermissionType.WRITE_SETTINGS);

    expect(systemSettings.openWriteSettingsSettings).toHaveBeenCalledTimes(1);
    expect(openAppSettingsSpy).toHaveBeenCalledWith([PermissionType.WRITE_SETTINGS]);
    expect(status).toBe(PermissionStatus.REQUIRES_SETTINGS);
  });

  it('does not require runtime notification permission below Android 13', () => {
    const {
      requiresNotificationRuntimePermission,
    } = loadPermissionModule();

    expect(requiresNotificationRuntimePermission({ Version: 32 })).toBe(false);
  });

  it('keeps notification permission on the runtime path on Android 13+', () => {
    const {
      requiresNotificationRuntimePermission,
    } = loadPermissionModule();

    expect(requiresNotificationRuntimePermission({ Version: 34 })).toBe(true);
  });

  it('routes background location to settings on Android 11+', async () => {
    const {
      PermissionManager,
      PermissionStatus,
      PermissionType,
      requiresBackgroundLocationSettingsNavigation,
    } = loadPermissionModule(34);
    const manager = new PermissionManager();
    jest.spyOn(manager as any, 'checkAndroidRuntimePermission').mockResolvedValue(false);
    const openSettingsSpy = jest
      .spyOn(manager, 'openSpecificSettings')
      .mockResolvedValue(undefined);

    const result = await manager.checkPermission(PermissionType.LOCATION_BACKGROUND);
    const requestStatus = await manager.requestPermission(PermissionType.LOCATION_BACKGROUND);

    expect(requiresBackgroundLocationSettingsNavigation({ Version: 34 })).toBe(true);
    expect(result).toEqual({
      permission: PermissionType.LOCATION_BACKGROUND,
      status: PermissionStatus.REQUIRES_SETTINGS,
      canRequest: true,
    });
    expect(requestStatus).toBe(PermissionStatus.REQUIRES_SETTINGS);
    expect(openSettingsSpy).toHaveBeenCalledWith(PermissionType.LOCATION_BACKGROUND);
  });

  it('clears stale permanently denied state when Android reports the permission is granted', async () => {
    const {
      PermissionManager,
      PermissionStatus,
      PermissionType,
      asyncStorage,
    } = loadPermissionModule();
    asyncStorage.getItem
      .mockResolvedValueOnce(JSON.stringify([PermissionType.CAMERA]))
      .mockResolvedValueOnce(null);
    const manager = new PermissionManager();
    jest.spyOn(manager as any, 'checkAndroidRuntimePermission').mockResolvedValue(true);

    const result = await manager.checkPermission(PermissionType.CAMERA);

    expect(result.status).toBe(PermissionStatus.GRANTED);
    expect(asyncStorage.setItem).toHaveBeenCalled();
  });
});
