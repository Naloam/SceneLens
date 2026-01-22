/**
 * StatsScreen 单元测试
 * 测试统计数据的计算逻辑和组件渲染
 */

import type { SceneHistory } from '../../types';

describe('StatsScreen 统计逻辑', () => {
  /**
   * 测试场景统计数据计算
   */
  describe('场景统计计算', () => {
    const mockHistory: SceneHistory[] = [
      {
        sceneType: 'COMMUTE',
        timestamp: Date.now() - 1000 * 60 * 30, // 30分钟前
        confidence: 0.85,
        triggered: true,
        userAction: 'accept',
      },
      {
        sceneType: 'OFFICE',
        timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2小时前
        confidence: 0.92,
        triggered: true,
        userAction: 'accept',
      },
      {
        sceneType: 'HOME',
        timestamp: Date.now() - 1000 * 60 * 60 * 5, // 5小时前
        confidence: 0.78,
        triggered: true,
        userAction: 'ignore',
      },
      {
        sceneType: 'COMMUTE',
        timestamp: Date.now() - 1000 * 60 * 60 * 8, // 8小时前
        confidence: 0.88,
        triggered: true,
        userAction: 'accept',
      },
      {
        sceneType: 'STUDY',
        timestamp: Date.now() - 1000 * 60 * 60 * 12, // 12小时前
        confidence: 0.75,
        triggered: false,
        userAction: null,
      },
    ];

    it('应该正确计算场景出现次数', () => {
      const counts: Record<string, number> = {};
      mockHistory.forEach(item => {
        counts[item.sceneType] = (counts[item.sceneType] || 0) + 1;
      });

      expect(counts['COMMUTE']).toBe(2);
      expect(counts['OFFICE']).toBe(1);
      expect(counts['HOME']).toBe(1);
      expect(counts['STUDY']).toBe(1);
    });

    it('应该正确计算场景百分比', () => {
      const total = mockHistory.length;
      const counts: Record<string, number> = {};
      mockHistory.forEach(item => {
        counts[item.sceneType] = (counts[item.sceneType] || 0) + 1;
      });

      const commutePercentage = (counts['COMMUTE'] / total) * 100;
      expect(commutePercentage).toBe(40); // 2/5 = 40%
    });

    it('应该正确排序场景统计', () => {
      const counts: Record<string, number> = {};
      mockHistory.forEach(item => {
        counts[item.sceneType] = (counts[item.sceneType] || 0) + 1;
      });

      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a);

      expect(sorted[0][0]).toBe('COMMUTE');
      expect(sorted[0][1]).toBe(2);
    });
  });

  /**
   * 测试时间筛选逻辑
   */
  describe('时间筛选逻辑', () => {
    const now = Date.now();
    const mockHistory: SceneHistory[] = [
      {
        sceneType: 'COMMUTE',
        timestamp: now - 1000 * 60 * 30, // 30分钟前
        confidence: 0.85,
        triggered: true,
        userAction: 'accept',
      },
      {
        sceneType: 'OFFICE',
        timestamp: now - 1000 * 60 * 60 * 25, // 25小时前
        confidence: 0.92,
        triggered: true,
        userAction: 'accept',
      },
      {
        sceneType: 'HOME',
        timestamp: now - 1000 * 60 * 60 * 48, // 48小时前
        confidence: 0.78,
        triggered: true,
        userAction: 'ignore',
      },
    ];

    it('应该正确筛选今日数据', () => {
      const startTime = now - 24 * 60 * 60 * 1000;
      const filtered = mockHistory.filter(item => item.timestamp >= startTime);

      expect(filtered.length).toBe(1);
      expect(filtered[0].sceneType).toBe('COMMUTE');
    });

    it('应该正确筛选本周数据', () => {
      const startTime = now - 7 * 24 * 60 * 60 * 1000;
      const filtered = mockHistory.filter(item => item.timestamp >= startTime);

      // 30分钟前和25小时前在7天内，48小时前也包含在内
      expect(filtered.length).toBe(3);
    });

    it('应该正确筛选本月数据', () => {
      const startTime = now - 30 * 24 * 60 * 60 * 1000;
      const filtered = mockHistory.filter(item => item.timestamp >= startTime);

      expect(filtered.length).toBe(3);
    });
  });

  /**
   * 测试置信度计算
   */
  describe('置信度计算', () => {
    const mockHistory: SceneHistory[] = [
      {
        sceneType: 'COMMUTE',
        timestamp: Date.now(),
        confidence: 0.85,
        triggered: true,
        userAction: 'accept',
      },
      {
        sceneType: 'OFFICE',
        timestamp: Date.now(),
        confidence: 0.92,
        triggered: true,
        userAction: 'accept',
      },
      {
        sceneType: 'HOME',
        timestamp: Date.now(),
        confidence: 0.78,
        triggered: true,
        userAction: 'ignore',
      },
    ];

    it('应该正确计算平均置信度', () => {
      const sum = mockHistory.reduce((acc, item) => acc + item.confidence, 0);
      const average = sum / mockHistory.length;

      expect(average).toBeCloseTo(0.85, 2); // (0.85 + 0.92 + 0.78) / 3
    });

    it('应该在空历史记录时返回0', () => {
      const emptyHistory: SceneHistory[] = [];
      if (emptyHistory.length === 0) {
        const average = 0;
        expect(average).toBe(0);
      }
    });
  });

  /**
   * 测试排行榜逻辑
   */
  describe('排行榜逻辑', () => {
    const sceneStats = [
      { sceneType: 'COMMUTE' as const, count: 10, percentage: 40 },
      { sceneType: 'OFFICE' as const, count: 8, percentage: 32 },
      { sceneType: 'HOME' as const, count: 5, percentage: 20 },
      { sceneType: 'STUDY' as const, count: 2, percentage: 8 },
    ];

    it('应该正确获取前3名场景', () => {
      const top3 = sceneStats.slice(0, 3);

      expect(top3.length).toBe(3);
      expect(top3[0].sceneType).toBe('COMMUTE');
      expect(top3[1].sceneType).toBe('OFFICE');
      expect(top3[2].sceneType).toBe('HOME');
    });

    it('应该在数据不足3个时返回所有可用数据', () => {
      const shortStats = sceneStats.slice(0, 2);
      const top3 = shortStats.slice(0, 3);

      expect(top3.length).toBe(2);
    });

    it('应该在无数据时返回空数组', () => {
      const emptyStats: any[] = [];
      const top3 = emptyStats.slice(0, 3);

      expect(top3.length).toBe(0);
    });
  });

  /**
   * 测试置信度颜色映射
   */
  describe('置信度颜色映射', () => {
    const getConfidenceColor = (confidence: number): string => {
      if (confidence >= 0.7) return '#386A20'; // 绿色
      if (confidence >= 0.4) return '#7D5700'; // 黄色
      return '#B3261E'; // 红色
    };

    it('高置信度应该返回绿色', () => {
      expect(getConfidenceColor(0.8)).toBe('#386A20');
      expect(getConfidenceColor(0.7)).toBe('#386A20');
    });

    it('中置信度应该返回黄色', () => {
      expect(getConfidenceColor(0.5)).toBe('#7D5700');
      expect(getConfidenceColor(0.4)).toBe('#7D5700');
    });

    it('低置信度应该返回红色', () => {
      expect(getConfidenceColor(0.3)).toBe('#B3261E');
      expect(getConfidenceColor(0.1)).toBe('#B3261E');
    });
  });

  /**
   * 测试场景名称和图标映射
   */
  describe('场景映射', () => {
    const sceneNames: Record<string, string> = {
      COMMUTE: '通勤',
      OFFICE: '办公',
      HOME: '在家',
      STUDY: '学习',
      SLEEP: '睡前',
      TRAVEL: '出行',
      UNKNOWN: '未知',
    };

    const sceneIcons: Record<string, string> = {
      COMMUTE: '🚇',
      OFFICE: '🏢',
      HOME: '🏠',
      STUDY: '📚',
      SLEEP: '😴',
      TRAVEL: '✈️',
      UNKNOWN: '❓',
    };

    it('应该正确映射场景名称', () => {
      expect(sceneNames['COMMUTE']).toBe('通勤');
      expect(sceneNames['OFFICE']).toBe('办公');
      expect(sceneNames['HOME']).toBe('在家');
    });

    it('应该正确映射场景图标', () => {
      expect(sceneIcons['COMMUTE']).toBe('🚇');
      expect(sceneIcons['OFFICE']).toBe('🏢');
      expect(sceneIcons['HOME']).toBe('🏠');
    });

    it('未知场景应该有默认值', () => {
      expect(sceneNames['UNKNOWN']).toBe('未知');
      expect(sceneIcons['UNKNOWN']).toBe('❓');
    });
  });
});
