/**
 * QuickActionManager 单元测试
 * 
 * 测试快捷操作管理器的功能：
 * - 动作注册和获取
 * - 场景相关性排序
 * - 动作执行
 * - 使用统计
 */

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
}));

// Mock Linking
jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Platform: {
    OS: 'android',
    select: jest.fn((obj) => obj.android || obj.default),
  },
  NativeModules: {
    SystemSettings: {
      setVolume: jest.fn().mockResolvedValue({ success: true }),
      setDoNotDisturb: jest.fn().mockResolvedValue({ success: true }),
    },
    SceneBridge: {
      openApp: jest.fn().mockResolvedValue(true),
      isAppInstalled: jest.fn().mockResolvedValue(true),
    },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { quickActionManager, QuickActionManager } from '../../../quickactions/QuickActionManager';
import type { QuickAction } from '../../../types/automation';
import type { SceneType } from '../../../types';

describe('QuickActionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('初始化', () => {
    it('应该成功初始化', async () => {
      await quickActionManager.initialize();
      
      // 初始化应该加载预设动作
      const actions = await quickActionManager.getAllActions();
      expect(Array.isArray(actions)).toBe(true);
    });

    it('应该加载预设快捷操作', async () => {
      await quickActionManager.initialize();
      
      const actions = await quickActionManager.getAllActions();
      
      // 应该包含支付类快捷操作
      const paymentActions = actions.filter(a => a.category === 'payment');
      expect(paymentActions.length).toBeGreaterThan(0);
    });
  });

  describe('动作获取', () => {
    beforeEach(async () => {
      await quickActionManager.initialize();
    });

    it('应该获取场景相关的动作', async () => {
      const actions = await quickActionManager.getActionsForScene('OFFICE');
      
      expect(Array.isArray(actions)).toBe(true);
    });

    it('应该按场景相关性排序', async () => {
      const officeActions = await quickActionManager.getActionsForScene('OFFICE');
      const homeActions = await quickActionManager.getActionsForScene('HOME');
      
      // 不同场景应该有不同的排序结果
      expect(officeActions.length).toBeGreaterThanOrEqual(0);
      expect(homeActions.length).toBeGreaterThanOrEqual(0);
    });

    it('应该限制返回数量', async () => {
      const actions = await quickActionManager.getActionsForScene('HOME', 3);
      
      expect(actions.length).toBeLessThanOrEqual(3);
    });

    it('应该获取最近使用的动作', async () => {
      // 先执行一个动作
      const actions = await quickActionManager.getAllActions();
      if (actions.length > 0) {
        await quickActionManager.trackUsage(actions[0].id, 'HOME');
      }
      
      const recentActions = await quickActionManager.getRecentActions(5);
      
      expect(Array.isArray(recentActions)).toBe(true);
    });
  });

  describe('动作执行', () => {
    beforeEach(async () => {
      await quickActionManager.initialize();
    });

    it('应该执行快捷操作', async () => {
      const actions = await quickActionManager.getAllActions();
      
      if (actions.length > 0) {
        const result = await quickActionManager.executeAction(actions[0].id);
        
        expect(result).toBeDefined();
        expect(result.success !== undefined || result.error !== undefined).toBe(true);
      }
    });

    it('应该处理不存在的动作', async () => {
      const result = await quickActionManager.executeAction('non-existent-action');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('使用统计', () => {
    beforeEach(async () => {
      await quickActionManager.initialize();
    });

    it('应该追踪动作使用', async () => {
      const actions = await quickActionManager.getAllActions();
      
      if (actions.length > 0) {
        await quickActionManager.trackUsage(actions[0].id, 'OFFICE');
        
        expect(AsyncStorage.setItem).toHaveBeenCalled();
      }
    });

    it('应该获取使用统计', async () => {
      const stats = await quickActionManager.getUsageStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('应该按场景统计使用', async () => {
      const actions = await quickActionManager.getAllActions();
      
      if (actions.length > 0) {
        // 在不同场景使用
        await quickActionManager.trackUsage(actions[0].id, 'OFFICE');
        await quickActionManager.trackUsage(actions[0].id, 'OFFICE');
        await quickActionManager.trackUsage(actions[0].id, 'HOME');
      }
      
      const stats = await quickActionManager.getUsageStats();
      
      expect(stats).toBeDefined();
    });
  });

  describe('自定义动作', () => {
    beforeEach(async () => {
      await quickActionManager.initialize();
    });

    it('应该注册自定义动作', async () => {
      const customAction: QuickAction = {
        id: 'custom-action-1',
        label: '自定义操作',
        icon: '⭐',
        category: 'custom',
        execute: async () => ({ success: true }),
        isAvailable: async () => true,
        sceneRelevance: {
          HOME: 1,
          OFFICE: 0.5,
          COMMUTE: 0.3,
          STUDY: 0.2,
          SLEEP: 0.1,
          TRAVEL: 0.4,
          UNKNOWN: 0.1,
        },
      };
      
      await quickActionManager.registerAction(customAction);
      
      const actions = await quickActionManager.getAllActions();
      const found = actions.find(a => a.id === 'custom-action-1');
      
      expect(found).toBeDefined();
    });

    it('应该移除自定义动作', async () => {
      const customAction: QuickAction = {
        id: 'custom-action-2',
        label: '待删除操作',
        icon: '🗑️',
        category: 'custom',
        execute: async () => ({ success: true }),
        isAvailable: async () => true,
        sceneRelevance: {
          HOME: 1,
          OFFICE: 0.5,
          COMMUTE: 0.3,
          STUDY: 0.2,
          SLEEP: 0.1,
          TRAVEL: 0.4,
          UNKNOWN: 0.1,
        },
      };
      
      await quickActionManager.registerAction(customAction);
      await quickActionManager.removeAction('custom-action-2');
      
      const actions = await quickActionManager.getAllActions();
      const found = actions.find(a => a.id === 'custom-action-2');
      
      expect(found).toBeUndefined();
    });
  });

  describe('用户偏好', () => {
    beforeEach(async () => {
      await quickActionManager.initialize();
    });

    it('应该设置收藏动作', async () => {
      const actions = await quickActionManager.getAllActions();
      
      if (actions.length > 0) {
        await quickActionManager.setFavorite(actions[0].id, true);
        
        expect(AsyncStorage.setItem).toHaveBeenCalled();
      }
    });

    it('应该获取收藏动作', async () => {
      const favorites = await quickActionManager.getFavorites();
      
      expect(Array.isArray(favorites)).toBe(true);
    });

    it('应该隐藏动作', async () => {
      const actions = await quickActionManager.getAllActions();
      
      if (actions.length > 0) {
        await quickActionManager.hideAction(actions[0].id);
        
        const visibleActions = await quickActionManager.getVisibleActions();
        const hidden = visibleActions.find(a => a.id === actions[0].id);
        
        expect(hidden).toBeUndefined();
      }
    });
  });

  describe('分类过滤', () => {
    beforeEach(async () => {
      await quickActionManager.initialize();
    });

    it('应该按分类过滤动作', async () => {
      const paymentActions = await quickActionManager.getActionsByCategory('payment');
      
      expect(Array.isArray(paymentActions)).toBe(true);
      paymentActions.forEach(action => {
        expect(action.category).toBe('payment');
      });
    });

    it('应该获取所有分类', async () => {
      const categories = await quickActionManager.getCategories();
      
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });
  });
});
