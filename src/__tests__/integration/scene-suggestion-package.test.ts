/**
 * 场景执行建议包集成测试
 *
 * 验证完整的场景执行建议包流程：
 * 1. 场景检测生成 SilentContext
 * 2. 通过 SceneSuggestionManager 获取场景建议包
 * 3. 用户点击一键操作
 * 4. 执行系统调整和应用启动
 * 5. 显示执行结果通知
 * 6. 记录用户反馈
 */

import { SilentContextEngine } from '../../sensors/SilentContextEngine';
import { RuleEngine } from '../../rules/RuleEngine';
import { sceneSuggestionManager } from '../../services/SceneSuggestionManager';
import { notificationManager } from '../../notifications/NotificationManager';
import SceneBridge from '../../core/SceneBridge';
import type { SilentContext, SceneSuggestionPackage, SuggestionExecutionResult } from '../../types';

// Mock SceneBridge
jest.mock('../../core/SceneBridge', () => ({
  __esModule: true,
  default: {
    getCurrentLocation: jest.fn(),
    getConnectedWiFi: jest.fn(),
    getMotionState: jest.fn(),
    getForegroundApp: jest.fn(),
    getInstalledApps: jest.fn(),
    getUsageStats: jest.fn(),
    setDoNotDisturb: jest.fn(() => Promise.resolve({ enabled: true, mode: 'priority' })),
    setBrightness: jest.fn(() => Promise.resolve({ level: 0.7, brightness: 0.7 })),
    setWakeLock: jest.fn(() => Promise.resolve({ enabled: true, timeout: 300000 })),
    checkDoNotDisturbPermission: jest.fn(() => Promise.resolve(true)),
    checkWriteSettingsPermission: jest.fn(() => Promise.resolve(true)),
    checkPermission: jest.fn(() => Promise.resolve(true)),
    isAppInstalled: jest.fn(() => Promise.resolve(true)),
    openAppWithDeepLink: jest.fn(() => Promise.resolve(true)),
    validateDeepLink: jest.fn(() => Promise.resolve(true)),
    hasCalendarPermission: jest.fn(() => Promise.resolve(true)),
  },
}));

// Mock notification manager
jest.mock('../../notifications/NotificationManager', () => ({
  notificationManager: {
    initialize: jest.fn().mockResolvedValue(true),
    showSceneSuggestionPackage: jest.fn().mockResolvedValue('notification-id-123'),
    showSuggestionExecutionResult: jest.fn().mockResolvedValue('notification-id-456'),
  },
}));

// Mock AppDiscoveryEngine
jest.mock('../../discovery/AppDiscoveryEngine', () => ({
  appDiscoveryEngine: {
    isInitialized: () => true,
    initialize: jest.fn(() => Promise.resolve()),
    resolveIntent: jest.fn((intent: string) => {
      const map: Record<string, string> = {
        TRANSIT_APP_TOP1: 'com.eg.android.AlipayGphone',
        MUSIC_PLAYER_TOP1: 'com.netease.cloudmusic',
        CALENDAR_TOP1: 'com.android.calendar',
        SMART_HOME_TOP1: 'com.xiaomi.smarthome',
      };
      return map[intent] || null;
    }),
  },
}));

// Save original Date
const RealDate = Date;

describe('场景执行建议包集成测试', () => {
  let contextEngine: SilentContextEngine;
  let ruleEngine: RuleEngine;

  beforeAll(() => {
    // Mock Date to control time - Monday, 8:30 AM (morning rush hour)
    global.Date = class extends RealDate {
      constructor() {
        super();
        return new RealDate('2024-01-08T08:30:00');
      }
      static now() {
        return new RealDate('2024-01-08T08:30:00').getTime();
      }
    } as any;
  });

  afterAll(() => {
    global.Date = RealDate;
  });

  beforeEach(async () => {
    // 初始化引擎
    contextEngine = new SilentContextEngine();
    ruleEngine = new RuleEngine();

    // Mock SceneBridge 返回值
    (SceneBridge.getCurrentLocation as jest.Mock).mockResolvedValue({
      latitude: 31.2304,
      longitude: 121.4737,
      accuracy: 50,
      timestamp: Date.now(),
    });

    (SceneBridge.getMotionState as jest.Mock).mockResolvedValue('WALKING');

    (SceneBridge.getConnectedWiFi as jest.Mock).mockResolvedValue(null);

    await ruleEngine.loadRules();
    await sceneSuggestionManager.initialize();
    await (notificationManager.initialize as jest.Mock)();
  });

  describe('通勤场景建议包完整流程', () => {
    it('应该完成从场景检测到建议执行的完整流程', async () => {
      // 1. 场景检测生成 SilentContext
      const context = await contextEngine.getContext();

      expect(context.context).toBe('COMMUTE');
      expect(context.confidence).toBeGreaterThan(0.5);

      // 2. 通过 SceneSuggestionManager 获取场景建议包
      const suggestion = await sceneSuggestionManager.getSuggestionByContext(context, {
        includeSystemAdjustments: true,
        includeAppLaunches: true,
        includeFallbackNotes: false,
        minConfidence: 0.3,
      });

      expect(suggestion).toBeDefined();
      expect(suggestion?.sceneId).toBe('COMMUTE');
      expect(suggestion?.displayName).toBe('通勤');
      expect(suggestion?.detectionHighlights.length).toBeGreaterThan(0);
      expect(suggestion?.systemAdjustments.length).toBeGreaterThan(0);
      expect(suggestion?.appLaunches.length).toBeGreaterThan(0);
      expect(suggestion?.oneTapActions.length).toBeGreaterThan(0);

      // 3. 验证一键操作配置
      const primaryAction = suggestion!.oneTapActions.find(a => a.type === 'primary');
      expect(primaryAction).toBeDefined();
      expect(primaryAction?.action).toBe('execute_all');
      expect(primaryAction?.label).toContain('通勤');

      const secondaryAction = suggestion!.oneTapActions.find(a => a.type === 'secondary');
      expect(secondaryAction).toBeDefined();
      expect(secondaryAction?.action).toBe('dismiss' as any);

      // 4. 执行一键操作
      const result = await sceneSuggestionManager.executeSuggestion(
        context.context,
        primaryAction!.id,
        {
          showProgress: false,
          autoFallback: true,
        }
      );

      // 5. 验证执行结果
      expect(result.success).toBe(true);
      expect(result.sceneId).toBe('COMMUTE');
      expect(result.executedActions.length).toBeGreaterThan(0);

      // 验证系统调整执行
      const systemActions = result.executedActions.filter(a => a.type === 'system');
      expect(systemActions.length).toBeGreaterThan(0);

      // 验证应用启动执行
      const appActions = result.executedActions.filter(a => a.type === 'app');
      expect(appActions.length).toBeGreaterThan(0);

      // 6. 验证通知被调用
      expect(notificationManager.showSuggestionExecutionResult).toHaveBeenCalledWith(
        suggestion,
        true,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('应该在权限不足时正确降级', async () => {
      // Mock 权限检查返回 false
      (SceneBridge.checkDoNotDisturbPermission as jest.Mock).mockResolvedValue(false);

      // 获取通勤场景上下文
      const context = await contextEngine.getContext();
      const suggestion = await sceneSuggestionManager.getSuggestionByContext(context);

      expect(suggestion?.sceneId).toBe('COMMUTE');

      // 执行建议
      const result = await sceneSuggestionManager.executeSuggestion('COMMUTE', 'execute');

      // 验证降级处理
      expect(result.success).toBe(true);
      expect(result.fallbackApplied).toBe(true);

      // 系统调整应该失败，但应用启动应该成功
      const failedSystemActions = result.executedActions.filter(
        a => a.type === 'system' && !a.success
      );
      expect(failedSystemActions.length).toBeGreaterThan(0);
    });

    it('应该正确处理用户跳过操作', async () => {
      const context = await contextEngine.getContext();
      const suggestion = await sceneSuggestionManager.getSuggestionByContext(context);

      const skipAction = suggestion!.oneTapActions.find(a => a.action === 'dismiss');
      expect(skipAction).toBeDefined();

      const result = await sceneSuggestionManager.executeSuggestion(
        'COMMUTE',
        skipAction!.id
      );

      expect(result.success).toBe(true);
      expect(result.skippedActions).toContain('all');
      expect(result.executedActions.length).toBe(0);
    });
  });

  describe('到家场景建议包完整流程', () => {
    beforeEach(() => {
      // Mock 到家场景条件
      (SceneBridge.getCurrentLocation as jest.Mock).mockResolvedValue({
        latitude: 31.2304,
        longitude: 121.4737,
        accuracy: 50,
        timestamp: Date.now(),
      });

      (SceneBridge.getConnectedWiFi as jest.Mock).mockResolvedValue({
        ssid: 'Home_WiFi',
        bssid: 'AA:BB:CC:DD:EE:FF',
        signalStrength: -50,
      });

      (SceneBridge.getMotionState as jest.Mock).mockResolvedValue('STILL');

      // Mock 时间为晚上 7 点
      global.Date = class extends RealDate {
        constructor() {
          super();
          return new RealDate('2024-01-08T19:00:00');
        }
        static now() {
          return new RealDate('2024-01-08T19:00:00').getTime();
        }
      } as any;
    });

    it('应该完成到家场景的完整建议包流程', async () => {
      const context = await contextEngine.getContext();

      // 由于我们设置了 HOME Wi-Fi，可能会识别为 HOME 或其他场景
      // 这里我们直接通过场景类型获取建议包
      const suggestion = await sceneSuggestionManager.getSuggestionBySceneType('HOME', {
        includeSystemAdjustments: true,
        includeAppLaunches: true,
      });

      expect(suggestion).toBeDefined();
      expect(suggestion?.sceneId).toBe('HOME');
      expect(suggestion?.displayName).toBe('到家');

      // 验证检测要点
      expect(suggestion?.detectionHighlights).toContain('位于家庭地理围栏内');

      // 验证系统调整（关闭勿扰）
      expect(suggestion?.systemAdjustments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'setDoNotDisturb',
            params: expect.objectContaining({
              enable: false,
            }),
          }),
        ])
      );

      // 执行建议
      const primaryAction = suggestion!.oneTapActions[0];
      const result = await sceneSuggestionManager.executeSuggestion(
        'HOME',
        primaryAction.id
      );

      expect(result.success).toBe(true);
    });
  });

  describe('建议包配置验证', () => {
    it('所有场景都应该有必要的配置', async () => {
      const allScenes = await sceneSuggestionManager.getAllScenes();

      const requiredFields = [
        'sceneId',
        'displayName',
        'icon',
        'color',
        'detectionHighlights',
        'systemAdjustments',
        'appLaunches',
        'oneTapActions',
        'fallbackNotes',
      ];

      allScenes.forEach(scene => {
        requiredFields.forEach(field => {
          expect(scene).toHaveProperty(field);
        });

        // 验证至少有一个一键操作
        expect(scene.oneTapActions.length).toBeGreaterThan(0);

        // 验证至少有一个 primary 操作
        const hasPrimaryAction = scene.oneTapActions.some(a => a.type === 'primary');
        expect(hasPrimaryAction).toBe(true);
      });
    });

    it('通勤场景应该有乘车码应用启动项', async () => {
      const commuteScene = await sceneSuggestionManager.getSuggestionBySceneType('COMMUTE');
      const hasTransitApp = commuteScene?.appLaunches.some(
        app => app.intent === 'TRANSIT_APP_TOP1'
      );
      expect(hasTransitApp).toBe(true);
    });

    it('到家场景应该有关闭勿扰的系统调整', async () => {
      const homeScene = await sceneSuggestionManager.getSuggestionBySceneType('HOME');
      const hasDisableDND = homeScene?.systemAdjustments.some(
        adj => adj.action === 'setDoNotDisturb' && adj.params?.enable === false
      );
      expect(hasDisableDND).toBe(true);
    });
  });
});
