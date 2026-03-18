type LoadedPermissionModule = {
  PermissionManager: typeof import('../PermissionManager').PermissionManager;
  PermissionStatus: typeof import('../PermissionManager').PermissionStatus;
  PermissionType: typeof import('../PermissionManager').PermissionType;
  requiresNotificationRuntimePermission: typeof import('../PermissionManager').requiresNotificationRuntimePermission;
  sceneBridge: {
    hasUsageStatsPermission: jest.Mock;
    openUsageStatsSettings: jest.Mock;
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

  jest.doMock('react-native', () => {
    const reactNativeMock = require('../../__mocks__/react-native.js');
    reactNativeMock.Platform.Version = platformVersion;
    reactNativeMock.Platform.OS = 'android';
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
  const reactNative = require('../../__mocks__/react-native.js');

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

  return {
    PermissionManager: permissionModule.PermissionManager,
    PermissionStatus: permissionModule.PermissionStatus,
    PermissionType: permissionModule.PermissionType,
    requiresNotificationRuntimePermission: permissionModule.requiresNotificationRuntimePermission,
    sceneBridge,
    systemSettings,
    asyncStorage,
    linking: reactNative.Linking,
    permissionsAndroid: reactNative.PermissionsAndroid,
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
});
