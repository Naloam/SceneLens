import { SceneSuggestionManager } from '../SceneSuggestionManager';
import type { SceneType, SilentContext } from '../../types';

jest.mock('../../config/scene-suggestions.json', () => ({
  version: '1.0.0',
  lastUpdated: '2025-01-22',
  description: 'Scene suggestion config',
  scenes: [
    {
      sceneId: 'COMMUTE',
      displayName: 'Commute',
      icon: 'subway',
      color: '#3B82F6',
      detectionHighlights: ['Rush hour window', 'Near transit station'],
      systemAdjustments: [
        {
          id: 'dnd_emergency',
          label: 'Enable DND',
          description: 'Allow emergency calls',
          action: 'setDoNotDisturb',
          params: {
            enable: true,
            allowCalls: true,
            whitelist: ['emergency_contacts'],
          },
        },
      ],
      appLaunches: [
        {
          id: 'transit_qr',
          label: 'Transit QR',
          description: 'Open transit code',
          intent: 'TRANSIT_APP_TOP1',
          action: 'open_ticket_qr',
          deepLink: 'alipays://platformapi/startapp?appId=200011235',
          fallbackAction: 'Open homepage',
        },
      ],
      oneTapActions: [
        {
          id: 'execute',
          label: 'Start commute',
          description: 'Enable DND and open transit QR',
          type: 'primary',
          action: 'execute_all',
        },
        {
          id: 'skip',
          label: 'Skip',
          description: 'Do nothing',
          type: 'secondary',
          action: 'dismiss',
        },
      ],
      fallbackNotes: [
        {
          condition: 'no_dnd_permission',
          message: 'Open the app only when DND permission is missing',
          action: 'skip_system_settings',
        },
      ],
    },
    {
      sceneId: 'HOME',
      displayName: 'Home',
      icon: 'home',
      color: '#10B981',
      detectionHighlights: ['Home geofence', 'Home Wi-Fi'],
      systemAdjustments: [
        {
          id: 'dnd_disable',
          label: 'Disable DND',
          description: 'Restore normal notifications',
          action: 'setDoNotDisturb',
          params: {
            enable: false,
          },
        },
      ],
      appLaunches: [
        {
          id: 'smart_home',
          label: 'Smart Home',
          description: 'Open smart home app',
          intent: 'SMART_HOME_TOP1',
          action: 'launch',
          params: {
            mode: 'home',
          },
          fallbackAction: 'Open homepage',
        },
      ],
      oneTapActions: [
        {
          id: 'welcome',
          label: 'Welcome home',
          description: 'Disable DND',
          type: 'primary',
          action: 'execute_all',
        },
      ],
      fallbackNotes: [],
    },
  ],
}));

jest.mock('../../core/SceneBridge', () => ({
  __esModule: true,
  default: {
    setDoNotDisturb: jest.fn(() => Promise.resolve({ enabled: true, mode: 'priority' })),
    setBrightness: jest.fn(() => Promise.resolve({ level: 0.7, brightness: 0.7 })),
    setWakeLock: jest.fn(() => Promise.resolve({ enabled: true, timeout: 300000 })),
    checkDoNotDisturbPermission: jest.fn(() => Promise.resolve(true)),
    checkWriteSettingsPermission: jest.fn(() => Promise.resolve(true)),
    checkPermission: jest.fn(() => Promise.resolve(true)),
    hasCalendarPermission: jest.fn(() => Promise.resolve(true)),
    isAppInstalled: jest.fn(() => Promise.resolve(true)),
    openAppWithDeepLink: jest.fn(() => Promise.resolve(true)),
    validateDeepLink: jest.fn(() => Promise.resolve(true)),
  },
}));

jest.mock('../../discovery', () => ({
  appDiscoveryEngine: {
    isInitialized: jest.fn(() => true),
    initialize: jest.fn(() => Promise.resolve()),
    resolveIntent: jest.fn((intent: string) => {
      const map: Record<string, string> = {
        TRANSIT_APP_TOP1: 'com.eg.android.AlipayGphone',
        MUSIC_PLAYER_TOP1: 'com.netease.cloudmusic',
        SMART_HOME_TOP1: 'com.xiaomi.smarthome',
      };
      return map[intent] || null;
    }),
  },
}));

jest.mock('../../executors/SceneExecutor', () => ({
  sceneExecutor: {
    initialize: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../automation/SystemSettingsController', () => ({
  SystemSettingsController: {
    setDoNotDisturb: jest.fn(() => Promise.resolve(true)),
    setBrightness: jest.fn(() => Promise.resolve(true)),
    setVolume: jest.fn(() => Promise.resolve(true)),
  },
}));

jest.mock('../../stores/storageManager', () => ({
  storageManager: {
    getString: jest.fn(() => undefined),
    set: jest.fn(),
    clearAll: jest.fn(),
  },
}));

import sceneBridge from '../../core/SceneBridge';
import { appDiscoveryEngine } from '../../discovery';
import { storageManager } from '../../stores/storageManager';
import { sceneExecutor } from '../../executors/SceneExecutor';
import { dynamicSuggestionService } from '../DynamicSuggestionService';
import { SystemSettingsController } from '../../automation/SystemSettingsController';

describe('SceneSuggestionManager', () => {
  let manager: SceneSuggestionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new SceneSuggestionManager();
    (storageManager.getString as jest.Mock).mockReturnValue(undefined);
    (sceneBridge.setDoNotDisturb as jest.Mock).mockResolvedValue({ enabled: true, mode: 'priority' });
    (sceneBridge.setBrightness as jest.Mock).mockResolvedValue({ level: 0.7, brightness: 0.7 });
    (sceneBridge.setWakeLock as jest.Mock).mockResolvedValue({ enabled: true, timeout: 300000 });
    (SystemSettingsController.setDoNotDisturb as jest.Mock).mockResolvedValue(true);
    (SystemSettingsController.setBrightness as jest.Mock).mockResolvedValue(true);
    (SystemSettingsController.setVolume as jest.Mock).mockResolvedValue(true);
    (sceneBridge.checkDoNotDisturbPermission as jest.Mock).mockResolvedValue(true);
    (sceneBridge.checkWriteSettingsPermission as jest.Mock).mockResolvedValue(true);
    (sceneBridge.checkPermission as jest.Mock).mockResolvedValue(true);
    (sceneBridge.hasCalendarPermission as jest.Mock).mockResolvedValue(true);
    (sceneBridge.isAppInstalled as jest.Mock).mockResolvedValue(true);
    (sceneBridge.openAppWithDeepLink as jest.Mock).mockResolvedValue(true);
    (sceneBridge.validateDeepLink as jest.Mock).mockResolvedValue(true);
  });

  describe('initialize and queries', () => {
    it('initializes idempotently', async () => {
      const dynamicInitializeSpy = jest.spyOn(dynamicSuggestionService, 'initialize');

      await Promise.all([manager.initialize(), manager.initialize()]);

      expect(sceneExecutor.initialize).toHaveBeenCalledTimes(1);
      expect(dynamicInitializeSpy).toHaveBeenCalledTimes(1);
    });

    it('loads and caches config', async () => {
      const first = await manager.loadConfig();
      const second = await manager.loadConfig();

      expect(first.version).toBe('1.0.0');
      expect(second).toBe(first);
      expect(first.scenes).toHaveLength(2);
    });

    it('filters scene content based on options', async () => {
      await manager.initialize();

      const scenes = await manager.getAllScenes({
        includeSystemAdjustments: false,
        includeAppLaunches: false,
        includeFallbackNotes: false,
      });

      expect(scenes[0].systemAdjustments).toEqual([]);
      expect(scenes[0].appLaunches).toEqual([]);
      expect(scenes[0].fallbackNotes).toEqual([]);
    });

    it('returns scene by type and null for unknown scene', async () => {
      await manager.initialize();

      const commute = await manager.getSuggestionBySceneType('COMMUTE');
      const unknown = await manager.getSuggestionBySceneType('UNKNOWN' as SceneType);

      expect(commute?.sceneId).toBe('COMMUTE');
      expect(unknown).toBeNull();
    });

    it('returns a scene by context when confidence passes threshold', async () => {
      await manager.initialize();

      const context: SilentContext = {
        context: 'COMMUTE',
        confidence: 0.9,
        timestamp: Date.now(),
        signals: [],
      };

      const matched = await manager.getSuggestionByContext(context, {
        minConfidence: 0.7,
      });
      const skipped = await manager.getSuggestionByContext(context, {
        minConfidence: 0.95,
      });

      expect(matched?.sceneId).toBe('COMMUTE');
      expect(skipped).toBeNull();
    });

    it('returns highlights, actions, and fallback notes', async () => {
      await manager.initialize();

      const highlights = await manager.getDetectionHighlights('COMMUTE');
      const actions = await manager.getOneTapActions('COMMUTE');
      const fallbackNotes = await manager.getFallbackNotes('COMMUTE');

      expect(highlights).toContain('Rush hour window');
      expect(actions.map(action => action.id)).toEqual(['execute', 'skip']);
      expect(fallbackNotes).toEqual([
        'Open the app only when DND permission is missing',
      ]);
    });
  });

  describe('executeSuggestion', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('executes execute_all successfully', async () => {
      const result = await manager.executeSuggestion('COMMUTE', 'execute', {
        autoFallback: true,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('needs_user_input');
      expect(result.sceneId).toBe('COMMUTE');
      expect(result.executedActions).toHaveLength(2);
      expect(result.summary).toMatchObject({
        automatedCount: 1,
        needsUserInputCount: 1,
        openedAppHomeCount: 0,
        failedCount: 0,
      });
      expect(SystemSettingsController.setDoNotDisturb).toHaveBeenCalledWith(true, 'priority');
      expect(sceneBridge.setDoNotDisturb).not.toHaveBeenCalled();
    });

    it('stops before app launch when system adjustment fails and autoFallback is false', async () => {
      (sceneBridge.checkDoNotDisturbPermission as jest.Mock).mockResolvedValue(false);

      const result = await manager.executeSuggestion('COMMUTE', 'execute', {
        autoFallback: false,
      });

      expect(result.success).toBe(false);
      expect(result.fallbackApplied).toBe(false);
      expect(result.executedActions).toHaveLength(1);
      expect(result.executedActions[0]).toMatchObject({
        type: 'system',
        success: false,
      });
      expect(sceneBridge.openAppWithDeepLink).not.toHaveBeenCalled();
    });

    it('continues to app launch when system adjustment fails and autoFallback is true', async () => {
      (sceneBridge.checkDoNotDisturbPermission as jest.Mock).mockResolvedValue(false);
      (sceneBridge.openAppWithDeepLink as jest.Mock).mockResolvedValue(true);

      const result = await manager.executeSuggestion('COMMUTE', 'execute', {
        autoFallback: true,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('partial');
      expect(result.fallbackApplied).toBe(true);
      expect(result.executedActions).toHaveLength(2);
      expect(result.executedActions[0]).toMatchObject({
        type: 'system',
        success: false,
        completionStatus: 'failed',
      });
      expect(result.executedActions[1]).toMatchObject({
        type: 'app',
        success: true,
        completionStatus: 'needs_user_input',
      });
      expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledTimes(1);
    });

    it('does not try app homepage fallback when autoFallback is false', async () => {
      (sceneBridge.openAppWithDeepLink as jest.Mock).mockResolvedValue(false);

      const result = await manager.executeSuggestion('COMMUTE', 'execute', {
        autoFallback: false,
      });

      expect(result.success).toBe(false);
      expect(result.fallbackApplied).toBe(false);
      expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledTimes(1);
      expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledWith(
        'com.eg.android.AlipayGphone',
        'alipays://platformapi/startapp?appId=200011235'
      );
    });

    it('tries app homepage fallback when autoFallback is true', async () => {
      (sceneBridge.openAppWithDeepLink as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await manager.executeSuggestion('COMMUTE', 'execute', {
        autoFallback: true,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('partial');
      expect(result.fallbackApplied).toBe(true);
      expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledTimes(2);
      expect(result.executedActions[1]).toMatchObject({
        type: 'app',
        success: false,
        completionStatus: 'opened_app_home',
        usedFallback: true,
      });
      expect(result.summary).toMatchObject({
        automatedCount: 1,
        needsUserInputCount: 0,
        openedAppHomeCount: 1,
        failedCount: 0,
      });
      expect(sceneBridge.openAppWithDeepLink).toHaveBeenNthCalledWith(
        1,
        'com.eg.android.AlipayGphone',
        'alipays://platformapi/startapp?appId=200011235'
      );
      expect(sceneBridge.openAppWithDeepLink).toHaveBeenNthCalledWith(
        2,
        'com.eg.android.AlipayGphone'
      );
    });

    it('marks no-deeplink app launches as opened_app_home instead of full success', async () => {
      const result = await manager.executeSuggestion('HOME', 'welcome', {
        autoFallback: true,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('partial');
      expect(result.fallbackApplied).toBe(true);
      expect(result.summary).toMatchObject({
        automatedCount: 1,
        needsUserInputCount: 0,
        openedAppHomeCount: 1,
        failedCount: 0,
      });
      expect(result.executedActions[1]).toMatchObject({
        type: 'app',
        success: false,
        completionStatus: 'opened_app_home',
        usedFallback: true,
      });
      expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledWith('com.xiaomi.smarthome');
    });

    it('handles dismiss and invalid selections', async () => {
      const dismissed = await manager.executeSuggestion('COMMUTE', 'skip');
      const missingAction = await manager.executeSuggestion('COMMUTE', 'missing');
      const missingScene = await manager.executeSuggestion('UNKNOWN' as SceneType, 'execute');

      expect(dismissed.success).toBe(true);
      expect(dismissed.status).toBe('dismissed');
      expect(dismissed.skippedActions).toContain('all');
      expect(missingAction.success).toBe(false);
      expect(missingScene.success).toBe(false);
    });
  });

  describe('recordResponse and version', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('records response history through storageManager', async () => {
      await manager.recordResponse({
        sceneId: 'COMMUTE',
        actionId: 'execute',
        actionType: 'execute_all',
        timestamp: 123,
      });

      expect(storageManager.set).toHaveBeenCalledTimes(1);
      expect(storageManager.set).toHaveBeenCalledWith(
        'scene_suggestion_response_history',
        JSON.stringify([
          {
            sceneId: 'COMMUTE',
            actionId: 'execute',
            actionType: 'execute_all',
            timestamp: 123,
          },
        ])
      );
    });

    it('reports config version before and after initialize', async () => {
      const freshManager = new SceneSuggestionManager();

      expect(freshManager.getConfigVersion()).toBe('unknown');

      await manager.initialize();
      expect(manager.getConfigVersion()).toBe('1.0.0');
    });
  });

  it('uses the discovery engine intent resolver', async () => {
    await manager.initialize();
    await manager.executeSuggestion('COMMUTE', 'execute', {
      autoFallback: true,
    });

    expect(appDiscoveryEngine.resolveIntent).toHaveBeenCalledWith('TRANSIT_APP_TOP1');
  });
});
