/**
 * SceneSuggestionManager 单元测试
 *
 * 测试场景执行建议包管理器的核心功能
 */

import { SceneSuggestionManager } from '../SceneSuggestionManager';
import type {
  SceneType,
  SceneSuggestionPackage,
  SilentContext,
  SuggestionExecutionResult,
} from '../../types';

// Mock 配置文件
jest.mock('../../config/scene-suggestions.json', () => ({
  version: '1.0.0',
  lastUpdated: '2025-01-22',
  description: '场景执行建议包配置',
  scenes: [
    {
      sceneId: 'COMMUTE',
      displayName: '通勤',
      icon: 'subway',
      color: '#3B82F6',
      detectionHighlights: [
        '早晚高峰时段（7-9点/17-19点）',
        '靠近地铁站或处于步行/乘车状态',
      ],
      systemAdjustments: [
        {
          id: 'dnd_emergency',
          label: '开启勿扰模式',
          description: '允许紧急联系人来电',
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
          label: '乘车码应用',
          description: '支付宝乘车码',
          intent: 'TRANSIT_APP_TOP1',
          action: 'open_ticket_qr',
          deepLink: 'alipays://platformapi/startapp?appId=200011235',
          fallbackAction: '打开首页',
        },
      ],
      oneTapActions: [
        {
          id: 'execute',
          label: '开始通勤',
          description: '开启勿扰+乘车码+音乐',
          type: 'primary',
          action: 'execute_all',
        },
        {
          id: 'skip',
          label: '本次跳过',
          description: '不执行任何操作',
          type: 'secondary',
          action: 'dismiss',
        },
      ],
      fallbackNotes: [
        {
          condition: 'no_dnd_permission',
          message: '未授予勿扰权限时仅打开应用',
          action: 'skip_system_settings',
        },
      ],
    },
    {
      sceneId: 'HOME',
      displayName: '到家',
      icon: 'home',
      color: '#10B981',
      detectionHighlights: [
        '位于家庭地理围栏内',
        '连接家庭 Wi-Fi 网络',
      ],
      systemAdjustments: [
        {
          id: 'dnd_disable',
          label: '关闭勿扰模式',
          description: '恢复正常通知',
          action: 'setDoNotDisturb',
          params: {
            enable: false,
          },
        },
      ],
      appLaunches: [],
      oneTapActions: [
        {
          id: 'welcome',
          label: '欢迎回家',
          description: '关闭勿扰+调亮屏幕+智能家居',
          type: 'primary',
          action: 'execute_all',
        },
      ],
      fallbackNotes: [],
    },
  ],
}));

// Mock SceneBridge
jest.mock('../../core/SceneBridge', () => ({
  __esModule: true,
  default: {
    setDoNotDisturb: jest.fn(() => Promise.resolve({ enabled: true, mode: 'priority' })),
    setBrightness: jest.fn(() => Promise.resolve({ level: 0.7, brightness: 0.7 })),
    setWakeLock: jest.fn(() => Promise.resolve({ enabled: true, timeout: 300000 })),
    checkDoNotDisturbPermission: jest.fn(() => Promise.resolve(true)),
    checkWriteSettingsPermission: jest.fn(() => Promise.resolve(true)),
    checkPermission: jest.fn(() => Promise.resolve(true)),
    isAppInstalled: jest.fn(() => Promise.resolve(true)),
    openAppWithDeepLink: jest.fn(() => Promise.resolve(true)),
    validateDeepLink: jest.fn(() => Promise.resolve(true)),
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
      };
      return map[intent] || null;
    }),
  },
}));

// Mock SceneExecutor
jest.mock('../../executors/SceneExecutor', () => ({
  sceneExecutor: {
    initialize: jest.fn(() => Promise.resolve()),
  },
}));

import sceneBridge from '../../core/SceneBridge';
import { appDiscoveryEngine } from '../../discovery/AppDiscoveryEngine';

describe('SceneSuggestionManager', () => {
  let manager: SceneSuggestionManager;

  beforeEach(() => {
    manager = new SceneSuggestionManager();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('应该成功初始化管理器', async () => {
      await manager.initialize();
      expect(manager).toBeDefined();
    });

    it('应该重复初始化而不出错', async () => {
      await manager.initialize();
      await manager.initialize();
      // 不应该抛出错误
    });
  });

  describe('loadConfig', () => {
    it('应该成功加载配置', async () => {
      const config = await manager.loadConfig();
      expect(config).toBeDefined();
      expect(config.version).toBe('1.0.0');
      expect(config.scenes).toHaveLength(2);
    });

    it('应该使用缓存的配置', async () => {
      const config1 = await manager.loadConfig();
      const config2 = await manager.loadConfig();
      expect(config1).toBe(config2);
    });

    it('强制重新加载应该获取新配置', async () => {
      const config1 = await manager.loadConfig();
      const config2 = await manager.loadConfig({ forceReload: true });
      expect(config1.version).toBe(config2.version);
    });
  });

  describe('getAllScenes', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该返回所有场景建议包', async () => {
      const scenes = await manager.getAllScenes();
      expect(scenes).toHaveLength(2);
      expect(scenes[0].sceneId).toBe('COMMUTE');
      expect(scenes[1].sceneId).toBe('HOME');
    });

    it('应该支持过滤系统调整项', async () => {
      const scenes = await manager.getAllScenes({
        includeSystemAdjustments: false,
      });
      expect(scenes[0].systemAdjustments).toHaveLength(0);
    });

    it('应该支持过滤应用启动项', async () => {
      const scenes = await manager.getAllScenes({
        includeAppLaunches: false,
      });
      expect(scenes[0].appLaunches).toHaveLength(0);
    });

    it('应该支持过滤降级说明', async () => {
      const scenes = await manager.getAllScenes({
        includeFallbackNotes: false,
      });
      expect(scenes[0].fallbackNotes).toHaveLength(0);
    });
  });

  describe('getSuggestionBySceneType', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该返回指定场景的建议包', async () => {
      const scene = await manager.getSuggestionBySceneType('COMMUTE');
      expect(scene).toBeDefined();
      expect(scene?.sceneId).toBe('COMMUTE');
      expect(scene?.displayName).toBe('通勤');
    });

    it('应该对不存在的场景返回 null', async () => {
      const scene = await manager.getSuggestionBySceneType('UNKNOWN' as SceneType);
      expect(scene).toBeNull();
    });

    it('应该包含检测要点', async () => {
      const scene = await manager.getSuggestionBySceneType('COMMUTE');
      expect(scene?.detectionHighlights).toHaveLength(2);
      expect(scene?.detectionHighlights[0]).toContain('早晚高峰');
    });
  });

  describe('getSuggestionByContext', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该根据上下文返回建议包', async () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'COMMUTE',
        confidence: 0.8,
        signals: [],
      };
      const scene = await manager.getSuggestionByContext(context);
      expect(scene).toBeDefined();
      expect(scene?.sceneId).toBe('COMMUTE');
    });

    it('置信度低于阈值时应该返回 null', async () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'COMMUTE',
        confidence: 0.2,
        signals: [],
      };
      const scene = await manager.getSuggestionByContext(context, {
        minConfidence: 0.5,
      });
      expect(scene).toBeNull();
    });

    it('置信度高于阈值时应该返回建议包', async () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'COMMUTE',
        confidence: 0.7,
        signals: [],
      };
      const scene = await manager.getSuggestionByContext(context, {
        minConfidence: 0.5,
      });
      expect(scene).toBeDefined();
    });
  });

  describe('getDetectionHighlights', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该返回场景的检测要点', async () => {
      const highlights = await manager.getDetectionHighlights('COMMUTE');
      expect(highlights).toHaveLength(2);
      expect(highlights[0]).toContain('早晚高峰');
    });

    it('不存在的场景应该返回空数组', async () => {
      const highlights = await manager.getDetectionHighlights('UNKNOWN' as SceneType);
      expect(highlights).toEqual([]);
    });
  });

  describe('getOneTapActions', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该返回场景的一键操作列表', async () => {
      const actions = await manager.getOneTapActions('COMMUTE');
      expect(actions).toHaveLength(2);
      expect(actions[0].id).toBe('execute');
      expect(actions[0].type).toBe('primary');
    });

    it('不存在的场景应该返回空数组', async () => {
      const actions = await manager.getOneTapActions('UNKNOWN' as SceneType);
      expect(actions).toEqual([]);
    });
  });

  describe('executeSuggestion', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该成功执行 execute_all 操作', async () => {
      const result = await manager.executeSuggestion('COMMUTE', 'execute', {
        autoFallback: true,
      });

      expect(result.success).toBe(true);
      expect(result.sceneId).toBe('COMMUTE');
      expect(result.executedActions.length).toBeGreaterThan(0);
    });

    it('应该成功执行 dismiss 操作', async () => {
      const result = await manager.executeSuggestion('COMMUTE', 'skip');

      expect(result.success).toBe(true);
      expect(result.skippedActions).toContain('all');
    });

    it('不存在的操作应该返回失败', async () => {
      const result = await manager.executeSuggestion('COMMUTE', 'non_existent');

      expect(result.success).toBe(false);
      expect(result.executedActions).toHaveLength(0);
    });

    it('不存在的场景应该返回失败', async () => {
      const result = await manager.executeSuggestion('UNKNOWN' as SceneType, 'execute');

      expect(result.success).toBe(false);
    });
  });

  describe('getFallbackNotes', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该返回场景的降级说明消息', async () => {
      const notes = await manager.getFallbackNotes('COMMUTE');
      expect(notes).toHaveLength(1);
      expect(notes[0]).toContain('勿扰权限');
    });

    it('没有降级说明的场景应该返回空数组', async () => {
      const notes = await manager.getFallbackNotes('HOME');
      expect(notes).toEqual([]);
    });
  });

  describe('recordResponse', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该记录用户响应', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await manager.recordResponse({
        sceneId: 'COMMUTE',
        actionId: 'execute',
        actionType: 'execute_all',
        timestamp: Date.now(),
      });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getConfigVersion', () => {
    it('未初始化时应该返回 unknown', () => {
      const version = manager.getConfigVersion();
      expect(version).toBe('unknown');
    });

    it('初始化后应该返回配置版本', async () => {
      await manager.initialize();
      const version = manager.getConfigVersion();
      expect(version).toBe('1.0.0');
    });
  });
});
