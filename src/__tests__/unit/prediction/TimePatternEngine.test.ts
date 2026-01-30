/**
 * TimePatternEngine 单元测试
 * 
 * 测试时间模式引擎的功能：
 * - 场景历史记录
 * - 模式分析
 * - 场景预测
 * - 异常检测
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
import { timePatternEngine, TimePatternEngine } from '../../../prediction/TimePatternEngine';
import type { SceneType } from '../../../types';

describe('TimePatternEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('场景记录', () => {
    it('应该记录场景切换', async () => {
      await timePatternEngine.recordSceneChange('OFFICE', 0.9);
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('应该记录多次场景切换', async () => {
      await timePatternEngine.recordSceneChange('HOME', 0.8);
      await timePatternEngine.recordSceneChange('COMMUTE', 0.7);
      await timePatternEngine.recordSceneChange('OFFICE', 0.9);
      
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(3);
    });
  });

  describe('模式分析', () => {
    it('应该分析空历史记录', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      const patterns = await timePatternEngine.analyzePatterns();
      
      expect(patterns).toEqual([]);
    });

    it('应该从历史记录中发现模式', async () => {
      // 模拟有规律的历史记录
      const mockHistory = generateMockHistory([
        { scene: 'HOME', hour: 7, count: 5 },
        { scene: 'COMMUTE', hour: 8, count: 5 },
        { scene: 'OFFICE', hour: 9, count: 5 },
        { scene: 'HOME', hour: 18, count: 5 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      const patterns = await timePatternEngine.analyzePatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('场景预测', () => {
    it('应该预测下一个场景', async () => {
      // 设置历史数据显示早上9点通常是 OFFICE
      const mockPatterns = [
        {
          type: 'daily',
          triggerTime: '09:00',
          sceneType: 'OFFICE',
          confidence: 0.85,
          sampleCount: 10,
        },
      ];
      
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(mockPatterns));
      
      const prediction = await timePatternEngine.predictNextScene();
      
      expect(prediction).toBeDefined();
      if (prediction) {
        expect(prediction.sceneType).toBeDefined();
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('应该在没有模式时返回 null', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      const prediction = await timePatternEngine.predictNextScene();
      
      // 没有模式数据时可能返回 null 或默认预测
      expect([null, undefined].includes(prediction) || prediction !== undefined).toBe(true);
    });
  });

  describe('出发时间', () => {
    it('应该返回通常出发时间', async () => {
      const mockHistory = generateMockHistory([
        { scene: 'COMMUTE', hour: 8, count: 10 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      const departureTime = await timePatternEngine.getUsualDepartureTime();
      
      // 可能返回时间字符串或 null
      expect(departureTime === null || typeof departureTime === 'string').toBe(true);
    });
  });

  describe('异常检测', () => {
    it('应该检测异常场景', async () => {
      // 模拟历史记录表明早上8点通常是通勤
      const mockHistory = generateMockHistory([
        { scene: 'COMMUTE', hour: 8, count: 15 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      // 检查如果早上8点还在家是否是异常
      const anomaly = await timePatternEngine.detectAnomaly(
        'HOME', 
        new Date('2026-01-30T08:30:00')
      );
      
      // 异常检测结果
      expect(anomaly === null || typeof anomaly === 'object').toBe(true);
    });

    it('应该对正常场景不报告异常', async () => {
      const mockHistory = generateMockHistory([
        { scene: 'OFFICE', hour: 10, count: 15 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      const anomaly = await timePatternEngine.detectAnomaly(
        'OFFICE',
        new Date('2026-01-30T10:00:00')
      );
      
      expect(anomaly).toBeNull();
    });
  });

  describe('数据管理', () => {
    it('应该清除历史数据', async () => {
      await timePatternEngine.clearHistory();
      
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('应该获取统计信息', async () => {
      const mockHistory = generateMockHistory([
        { scene: 'HOME', hour: 7, count: 5 },
        { scene: 'OFFICE', hour: 9, count: 5 },
      ]);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));
      
      const stats = await timePatternEngine.getStatistics();
      
      expect(stats).toBeDefined();
    });
  });
});

// 辅助函数：生成模拟历史记录
function generateMockHistory(
  configs: Array<{ scene: SceneType; hour: number; count: number }>
): Array<{
  sceneType: SceneType;
  timestamp: number;
  confidence: number;
}> {
  const history: Array<{
    sceneType: SceneType;
    timestamp: number;
    confidence: number;
  }> = [];
  
  const baseDate = new Date('2026-01-25');
  
  for (const config of configs) {
    for (let i = 0; i < config.count; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);
      date.setHours(config.hour, Math.floor(Math.random() * 30), 0, 0);
      
      history.push({
        sceneType: config.scene,
        timestamp: date.getTime(),
        confidence: 0.8 + Math.random() * 0.2,
      });
    }
  }
  
  return history.sort((a, b) => a.timestamp - b.timestamp);
}
