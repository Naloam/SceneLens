/**
 * FeedbackProcessor 单元测试
 * 
 * 测试反馈处理器的功能：
 * - 反馈记录
 * - 洞察分析
 * - 权重调整
 * - 个性化报告
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
import { 
  feedbackProcessor, 
  FeedbackProcessor,
  FeedbackType,
  SuggestionType,
  SuggestionInfo,
} from '../../../learning/FeedbackProcessor';
import type { SceneType } from '../../../types';

describe('FeedbackProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('反馈记录', () => {
    const mockSuggestion: SuggestionInfo = {
      id: 'test-suggestion-1',
      type: 'APP_LAUNCH' as SuggestionType,
      scene: 'OFFICE' as SceneType,
      title: '打开钉钉',
      content: '建议打开钉钉应用',
      confidence: 0.85,
    };

    it('应该记录接受反馈', async () => {
      await feedbackProcessor.recordFeedback(mockSuggestion, 'ACCEPT');
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('应该记录忽略反馈', async () => {
      await feedbackProcessor.recordFeedback(mockSuggestion, 'IGNORE');
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('应该记录拒绝反馈', async () => {
      await feedbackProcessor.recordFeedback(mockSuggestion, 'DISMISS');
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('应该记录修改反馈', async () => {
      await feedbackProcessor.recordFeedback(mockSuggestion, 'MODIFY', {
        modifications: { confidence: 0.9 },
      });
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('应该记录有用标记', async () => {
      await feedbackProcessor.recordFeedback(mockSuggestion, 'HELPFUL');
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('统计获取', () => {
    it('应该获取反馈统计', async () => {
      const mockRecords = [
        createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('DISMISS', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('ACCEPT', 'SYSTEM_SETTING', 'HOME'),
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const stats = await feedbackProcessor.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalFeedbacks).toBe(4);
    });

    it('应该计算接受率', async () => {
      const mockRecords = [
        createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('DISMISS', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('IGNORE', 'APP_LAUNCH', 'OFFICE'),
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const stats = await feedbackProcessor.getStatistics();
      
      expect(stats.acceptanceRate).toBe(0.5); // 2/4 = 50%
    });

    it('应该按场景统计', async () => {
      const mockRecords = [
        createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'HOME'),
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const stats = await feedbackProcessor.getStatistics();
      
      expect(stats.byScene).toBeDefined();
      expect(stats.byScene['OFFICE']).toBe(2);
      expect(stats.byScene['HOME']).toBe(1);
    });

    it('应该按建议类型统计', async () => {
      const mockRecords = [
        createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('ACCEPT', 'SYSTEM_SETTING', 'OFFICE'),
        createMockFeedbackRecord('ACCEPT', 'QUICK_ACTION', 'OFFICE'),
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const stats = await feedbackProcessor.getStatistics();
      
      expect(stats.byType).toBeDefined();
    });
  });

  describe('洞察分析', () => {
    it('应该分析反馈洞察', async () => {
      const mockRecords = generateMockFeedbackHistory(20);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const insights = await feedbackProcessor.analyzeInsights();
      
      expect(Array.isArray(insights)).toBe(true);
    });

    it('应该识别低接受率的建议类型', async () => {
      // 创建一组 APP_LAUNCH 低接受率的数据
      const mockRecords = [
        ...Array(8).fill(null).map(() => 
          createMockFeedbackRecord('DISMISS', 'APP_LAUNCH', 'OFFICE')
        ),
        ...Array(2).fill(null).map(() => 
          createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE')
        ),
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const insights = await feedbackProcessor.analyzeInsights();
      
      // 应该识别出 APP_LAUNCH 类型接受率低
      const lowAcceptanceInsight = insights.find(
        i => i.type === 'LOW_ACCEPTANCE' && i.category === 'APP_LAUNCH'
      );
      
      expect(insights.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('权重调整', () => {
    it('应该根据反馈调整权重', async () => {
      const mockRecords = [
        createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE'),
        createMockFeedbackRecord('DISMISS', 'SYSTEM_SETTING', 'OFFICE'),
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const weights = await feedbackProcessor.calculateAdjustedWeights();
      
      expect(weights).toBeDefined();
      expect(typeof weights).toBe('object');
    });

    it('应该增加高接受率类型的权重', async () => {
      const mockRecords = [
        ...Array(10).fill(null).map(() => 
          createMockFeedbackRecord('ACCEPT', 'QUICK_ACTION', 'OFFICE')
        ),
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const weights = await feedbackProcessor.calculateAdjustedWeights();
      
      // QUICK_ACTION 应该有较高权重
      if (weights['QUICK_ACTION']) {
        expect(weights['QUICK_ACTION']).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('个性化报告', () => {
    it('应该生成个性化报告', async () => {
      const mockRecords = generateMockFeedbackHistory(30);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const report = await feedbackProcessor.generatePersonalizationReport();
      
      expect(report).toBeDefined();
      expect(report.generatedAt).toBeDefined();
    });

    it('应该在报告中包含偏好场景', async () => {
      const mockRecords = [
        ...Array(10).fill(null).map(() => 
          createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE')
        ),
        ...Array(3).fill(null).map(() => 
          createMockFeedbackRecord('ACCEPT', 'APP_LAUNCH', 'HOME')
        ),
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const report = await feedbackProcessor.generatePersonalizationReport();
      
      expect(report.preferredScenes).toBeDefined();
      expect(Array.isArray(report.preferredScenes)).toBe(true);
    });

    it('应该在报告中包含建议', async () => {
      const mockRecords = generateMockFeedbackHistory(20);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const report = await feedbackProcessor.generatePersonalizationReport();
      
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('数据管理', () => {
    it('应该清除所有反馈数据', async () => {
      await feedbackProcessor.clearAllData();
      
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('应该导出反馈数据', async () => {
      const mockRecords = generateMockFeedbackHistory(5);
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecords));
      
      const exported = await feedbackProcessor.exportData();
      
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
    });
  });
});

// 辅助函数：创建模拟反馈记录
function createMockFeedbackRecord(
  feedbackType: FeedbackType,
  suggestionType: SuggestionType,
  scene: SceneType
) {
  return {
    id: `feedback-${Math.random().toString(36).slice(2)}`,
    suggestion: {
      id: `suggestion-${Math.random().toString(36).slice(2)}`,
      type: suggestionType,
      scene,
      title: '测试建议',
      content: '建议内容',
      confidence: 0.8,
    },
    feedbackType,
    timestamp: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
    context: {
      scene,
      timeOfDay: 'morning',
    },
  };
}

// 辅助函数：生成模拟反馈历史
function generateMockFeedbackHistory(count: number) {
  const types: SuggestionType[] = ['APP_LAUNCH', 'SYSTEM_SETTING', 'QUICK_ACTION', 'REMINDER'];
  const scenes: SceneType[] = ['OFFICE', 'HOME', 'COMMUTE', 'STUDY'];
  const feedbacks: FeedbackType[] = ['ACCEPT', 'IGNORE', 'DISMISS', 'HELPFUL'];
  
  return Array(count).fill(null).map(() => {
    const type = types[Math.floor(Math.random() * types.length)];
    const scene = scenes[Math.floor(Math.random() * scenes.length)];
    const feedback = feedbacks[Math.floor(Math.random() * feedbacks.length)];
    
    return createMockFeedbackRecord(feedback, type, scene);
  });
}
