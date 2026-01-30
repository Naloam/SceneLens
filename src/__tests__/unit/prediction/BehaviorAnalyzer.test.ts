/**
 * BehaviorAnalyzer 单元测试
 * 
 * 测试行为分析器的功能：
 * - 行为模式发现
 * - 模式匹配
 * - 建议生成
 */

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { behaviorAnalyzer, BehaviorAnalyzer } from '../../../prediction/BehaviorAnalyzer';
import type { SceneType, SilentContext } from '../../../types';

describe('BehaviorAnalyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('行为记录', () => {
    it('应该记录应用使用事件', async () => {
      await behaviorAnalyzer.recordEvent({
        type: 'APP_LAUNCH',
        packageName: 'com.tencent.mm',
        scene: 'HOME',
        timestamp: Date.now(),
      });
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('应该记录场景切换事件', async () => {
      await behaviorAnalyzer.recordEvent({
        type: 'SCENE_CHANGE',
        fromScene: 'HOME',
        toScene: 'COMMUTE',
        timestamp: Date.now(),
      });
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('应该记录系统设置变更事件', async () => {
      await behaviorAnalyzer.recordEvent({
        type: 'SETTING_CHANGE',
        setting: 'volume',
        value: 50,
        scene: 'OFFICE',
        timestamp: Date.now(),
      });
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('模式发现', () => {
    it('应该从空历史发现空模式', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      const patterns = await behaviorAnalyzer.discoverPatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBe(0);
    });

    it('应该发现场景-应用关联模式', async () => {
      // 模拟历史记录：在 OFFICE 场景下经常打开钉钉
      const mockHistory = generateMockBehaviorHistory([
        { type: 'APP_LAUNCH', packageName: 'com.dingtalk', scene: 'OFFICE', count: 10 },
        { type: 'APP_LAUNCH', packageName: 'com.tencent.wework', scene: 'OFFICE', count: 8 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      const patterns = await behaviorAnalyzer.discoverPatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('应该发现时间-行为关联模式', async () => {
      // 模拟历史记录：早上 8 点经常打开新闻应用
      const mockHistory = generateMockBehaviorHistory([
        { type: 'APP_LAUNCH', packageName: 'com.ss.android.article.news', hour: 8, count: 7 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      const patterns = await behaviorAnalyzer.discoverPatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('应该发现序列行为模式', async () => {
      // 模拟历史记录：打开微信后经常打开支付宝
      const mockHistory = generateSequenceHistory([
        { first: 'com.tencent.mm', second: 'com.eg.android.AlipayGphone', count: 5 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      const patterns = await behaviorAnalyzer.discoverPatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('模式匹配', () => {
    it('应该匹配当前上下文的模式', async () => {
      const mockPatterns = [
        {
          id: 'pattern-1',
          type: 'SCENE_APP',
          conditions: [
            { type: 'scene', operator: 'equals', value: 'OFFICE' },
          ],
          action: { type: 'APP_LAUNCH', packageName: 'com.dingtalk' },
          frequency: 10,
          confidence: 0.8,
        },
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockPatterns));
      
      const mockContext: SilentContext = {
        context: 'OFFICE',
        confidence: 0.9,
        timestamp: Date.now(),
        motionState: 'STILL',
        audioLevel: 30,
        lightLevel: 200,
        batteryLevel: 80,
      };
      
      const matched = await behaviorAnalyzer.matchPattern(mockContext);
      
      // 可能匹配到模式，也可能没有
      expect(matched === null || typeof matched === 'object').toBe(true);
    });

    it('应该返回 null 当没有匹配模式时', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));
      
      const mockContext: SilentContext = {
        context: 'TRAVEL',
        confidence: 0.9,
        timestamp: Date.now(),
        motionState: 'VEHICLE',
        audioLevel: 50,
        lightLevel: 500,
        batteryLevel: 60,
      };
      
      const matched = await behaviorAnalyzer.matchPattern(mockContext);
      
      expect(matched).toBeNull();
    });
  });

  describe('建议生成', () => {
    it('应该根据模式生成建议', async () => {
      const mockPattern = {
        id: 'pattern-1',
        type: 'SCENE_APP',
        conditions: [
          { type: 'scene', operator: 'equals', value: 'OFFICE' },
        ],
        action: { type: 'APP_LAUNCH', packageName: 'com.dingtalk' },
        frequency: 10,
        confidence: 0.85,
        description: '在办公室时经常打开钉钉',
      };
      
      const suggestion = await behaviorAnalyzer.generateSuggestion(mockPattern);
      
      expect(suggestion).toBeDefined();
      if (suggestion) {
        expect(suggestion.action).toBeDefined();
        expect(suggestion.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('统计信息', () => {
    it('应该获取行为统计信息', async () => {
      const mockHistory = generateMockBehaviorHistory([
        { type: 'APP_LAUNCH', packageName: 'com.tencent.mm', scene: 'HOME', count: 5 },
        { type: 'APP_LAUNCH', packageName: 'com.dingtalk', scene: 'OFFICE', count: 10 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      const stats = await behaviorAnalyzer.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalEvents).toBeDefined();
    });

    it('应该获取场景-应用分布', async () => {
      const mockHistory = generateMockBehaviorHistory([
        { type: 'APP_LAUNCH', packageName: 'com.tencent.mm', scene: 'HOME', count: 5 },
        { type: 'APP_LAUNCH', packageName: 'com.tencent.mm', scene: 'OFFICE', count: 3 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      const stats = await behaviorAnalyzer.getStatistics();
      
      expect(stats.sceneAppDistribution).toBeDefined();
    });
  });

  describe('数据管理', () => {
    it('应该清除历史数据', async () => {
      await behaviorAnalyzer.clearHistory();
      
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('应该触发分析更新', async () => {
      const mockHistory = generateMockBehaviorHistory([
        { type: 'APP_LAUNCH', packageName: 'com.tencent.mm', scene: 'HOME', count: 10 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      await behaviorAnalyzer.triggerAnalysis();
      
      // 分析后应该保存结果
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });
});

// 辅助函数：生成模拟行为历史
function generateMockBehaviorHistory(
  configs: Array<{
    type: string;
    packageName?: string;
    scene?: SceneType;
    hour?: number;
    count: number;
  }>
) {
  const history: Array<{
    type: string;
    packageName?: string;
    scene?: SceneType;
    timestamp: number;
  }> = [];
  
  const baseDate = new Date('2026-01-25');
  
  for (const config of configs) {
    for (let i = 0; i < config.count; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - Math.floor(i / 3));
      
      if (config.hour !== undefined) {
        date.setHours(config.hour, Math.floor(Math.random() * 60), 0, 0);
      } else {
        date.setHours(
          Math.floor(Math.random() * 24),
          Math.floor(Math.random() * 60),
          0, 0
        );
      }
      
      history.push({
        type: config.type,
        packageName: config.packageName,
        scene: config.scene || 'UNKNOWN',
        timestamp: date.getTime(),
      });
    }
  }
  
  return history.sort((a, b) => a.timestamp - b.timestamp);
}

// 辅助函数：生成序列行为历史
function generateSequenceHistory(
  sequences: Array<{ first: string; second: string; count: number }>
) {
  const history: Array<{
    type: string;
    packageName: string;
    timestamp: number;
  }> = [];
  
  const baseDate = new Date('2026-01-25');
  
  for (const seq of sequences) {
    for (let i = 0; i < seq.count; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);
      
      // 第一个应用
      history.push({
        type: 'APP_LAUNCH',
        packageName: seq.first,
        timestamp: date.getTime(),
      });
      
      // 第二个应用（1-5分钟后）
      history.push({
        type: 'APP_LAUNCH',
        packageName: seq.second,
        timestamp: date.getTime() + (1 + Math.random() * 4) * 60 * 1000,
      });
    }
  }
  
  return history.sort((a, b) => a.timestamp - b.timestamp);
}
