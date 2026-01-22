/**
 * SilentContextEngine 单元测试
 *
 * 测试静默感知引擎的核心功能
 */

import { SilentContextEngine } from '../SilentContextEngine';
import { SceneType, ContextSignal, MotionState } from '../../types';

// Mock SceneBridge
jest.mock('../../core/SceneBridge', () => ({
  __esModule: true,
  default: {
    getCurrentLocation: jest.fn(),
    getConnectedWiFi: jest.fn(),
    getMotionState: jest.fn(),
    getForegroundApp: jest.fn(),
    hasLocationPermission: jest.fn(),
    hasUsageStatsPermission: jest.fn(),
  },
}));

// Mock GeoFenceManager
jest.mock('../../stores/geoFenceManager', () => ({
  geoFenceManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getAllGeoFences: jest.fn().mockReturnValue([]),
  },
}));

import sceneBridge from '../../core/SceneBridge';
import { geoFenceManager } from '../../stores/geoFenceManager';

describe('SilentContextEngine', () => {
  let engine: SilentContextEngine;

  beforeEach(() => {
    engine = new SilentContextEngine();
    jest.clearAllMocks();
  });

  describe('getContext', () => {
    it('应该返回包含时间信号的场景上下文', async () => {
      // Mock 无权限场景
      (sceneBridge.hasLocationPermission as jest.Mock).mockResolvedValue(false);
      (sceneBridge.hasUsageStatsPermission as jest.Mock).mockResolvedValue(false);
      (sceneBridge.getConnectedWiFi as jest.Mock).mockResolvedValue(null);
      (sceneBridge.getMotionState as jest.Mock).mockResolvedValue('STILL' as MotionState);

      const context = await engine.getContext();

      expect(context).toBeDefined();
      expect(context.timestamp).toBeDefined();
      expect(context.signals).toBeDefined();
      expect(context.signals.length).toBeGreaterThan(0);

      // 应该有 TIME 和 MOTION 信号
      const timeSignal = context.signals.find(s => s.type === 'TIME');
      expect(timeSignal).toBeDefined();

      const motionSignal = context.signals.find(s => s.type === 'MOTION');
      expect(motionSignal).toBeDefined();
    });

    it('应该在早高峰工作日推断为通勤场景', async () => {
      // 设置时间为早高峰时段（8:30）
      const now = new Date();
      now.setHours(8, 30, 0, 0);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const day = now.getDay();
      const isWeekday = day >= 1 && day <= 5;

      // Mock 权限和传感器数据
      (sceneBridge.hasLocationPermission as jest.Mock).mockResolvedValue(true);
      (sceneBridge.getCurrentLocation as jest.Mock).mockResolvedValue({
        latitude: 39.92,
        longitude: 116.42,
        accuracy: 50,
        timestamp: Date.now(),
      });
      (sceneBridge.getMotionState as jest.Mock).mockResolvedValue('WALKING' as MotionState);
      (sceneBridge.getConnectedWiFi as jest.Mock).mockResolvedValue(null);
      (sceneBridge.hasUsageStatsPermission as jest.Mock).mockResolvedValue(false);

      const context = await engine.getContext();

      // 在工作日早高峰 + 步行状态应该倾向于通勤场景
      if (isWeekday) {
        expect(context.context).toBe('COMMUTE');
      }
    });

    it('应该在深夜时段推断为睡眠场景', async () => {
      // 设置时间为深夜（23:30）
      const now = new Date();
      now.setHours(23, 30, 0, 0);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      // Mock 传感器数据
      (sceneBridge.hasLocationPermission as jest.Mock).mockResolvedValue(false);
      (sceneBridge.getMotionState as jest.Mock).mockResolvedValue('STILL' as MotionState);
      (sceneBridge.getConnectedWiFi as jest.Mock).mockResolvedValue(null);
      (sceneBridge.hasUsageStatsPermission as jest.Mock).mockResolvedValue(false);

      const context = await engine.getContext();

      expect(context.context).toBe('SLEEP');
    });

    it('应该在低置信度时返回 UNKNOWN', async () => {
      // 设置时间为周末上午
      const now = new Date();
      now.setDate(now.getDate() + (7 - now.getDay()) % 7 + 1); // 下周日
      now.setHours(10, 0, 0, 0);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      // Mock 所有传感器都返回未知/空值
      (sceneBridge.hasLocationPermission as jest.Mock).mockResolvedValue(false);
      (sceneBridge.getMotionState as jest.Mock).mockResolvedValue('STILL' as MotionState);
      (sceneBridge.getConnectedWiFi as jest.Mock).mockResolvedValue(null);
      (sceneBridge.hasUsageStatsPermission as jest.Mock).mockResolvedValue(false);

      const context = await engine.getContext();

      expect(context.confidence).toBeLessThan(0.5);
    });

    it('应该处理位置权限被拒绝的情况', async () => {
      (sceneBridge.hasLocationPermission as jest.Mock).mockResolvedValue(false);
      (sceneBridge.getMotionState as jest.Mock).mockResolvedValue('STILL' as MotionState);
      (sceneBridge.getConnectedWiFi as jest.Mock).mockResolvedValue(null);
      (sceneBridge.hasUsageStatsPermission as jest.Mock).mockResolvedValue(false);

      const context = await engine.getContext();

      // 不应该包含 LOCATION 信号
      const locationSignal = context.signals.find(s => s.type === 'LOCATION');
      expect(locationSignal).toBeUndefined();
    });

    it('应该正确使用地理位置围栏', async () => {
      // Mock 地理围栏
      (geoFenceManager.getAllGeoFences as jest.Mock).mockReturnValue([
        {
          id: 'home',
          name: '家',
          type: 'HOME',
          latitude: 39.92,
          longitude: 116.42,
          radius: 100,
          wifiSSID: 'HomeWiFi',
        },
      ]);

      // 刷新围栏配置
      await engine.refreshGeoConfiguration();

      // Mock 用户在家
      (sceneBridge.hasLocationPermission as jest.Mock).mockResolvedValue(true);
      (sceneBridge.getCurrentLocation as jest.Mock).mockResolvedValue({
        latitude: 39.92,
        longitude: 116.42,
        accuracy: 20,
        timestamp: Date.now(),
      });
      (sceneBridge.getMotionState as jest.Mock).mockResolvedValue('STILL' as MotionState);
      (sceneBridge.getConnectedWiFi as jest.Mock).mockResolvedValue(null);
      (sceneBridge.hasUsageStatsPermission as jest.Mock).mockResolvedValue(false);

      const context = await engine.getContext();

      // 应该识别为 HOME 场景
      expect(context.context).toBe('HOME');
    });
  });

  describe('getTimeSignal', () => {
    it('应该正确识别早高峰时段', () => {
      const morning = new Date();
      morning.setHours(8, 0, 0, 0);
      jest.spyOn(Date, 'now').mockReturnValue(morning.getTime());

      const signal = engine['getTimeSignal']();

      expect(signal.type).toBe('TIME');
      expect(signal.value).toContain('MORNING_RUSH');
    });

    it('应该正确识别晚高峰时段', () => {
      const evening = new Date();
      evening.setHours(18, 0, 0, 0);
      jest.spyOn(Date, 'now').mockReturnValue(evening.getTime());

      const signal = engine['getTimeSignal']();

      expect(signal.type).toBe('TIME');
      expect(signal.value).toContain('EVENING_RUSH');
    });

    it('应该正确识别深夜时段', () => {
      const lateNight = new Date();
      lateNight.setHours(0, 30, 0, 0);
      jest.spyOn(Date, 'now').mockReturnValue(lateNight.getTime());

      const signal = engine['getTimeSignal']();

      expect(signal.type).toBe('TIME');
      expect(signal.value).toContain('LATE_NIGHT');
    });

    it('应该正确区分工作日和周末', () => {
      const weekday = new Date();
      weekday.setDate(weekday.getDate() - weekday.getDay() + 3); // 周三
      jest.spyOn(Date, 'now').mockReturnValue(weekday.getTime());

      const signal = engine['getTimeSignal']();

      expect(signal.value).toContain('WEEKDAY');
    });
  });

  describe('signalToScenes', () => {
    it('应该将早高峰时间映射到通勤场景', () => {
      const signal: ContextSignal = {
        type: 'TIME',
        value: 'MORNING_RUSH_WEEKDAY',
        weight: 0.85,
        timestamp: Date.now(),
      };

      const mapping = engine['signalToScenes'](signal);

      const commuteScore = mapping.find(([scene]) => scene === 'COMMUTE')?.[1];
      expect(commuteScore).toBeGreaterThan(0.7);
    });

    it('应该将静止状态映射到办公/居家场景', () => {
      const signal: ContextSignal = {
        type: 'MOTION',
        value: 'STILL',
        weight: 0.5,
        timestamp: Date.now(),
      };

      const mapping = engine['signalToScenes'](signal);

      const hasOfficeOrHome = mapping.some(([scene]) =>
        scene === 'OFFICE' || scene === 'HOME'
      );
      expect(hasOfficeOrHome).toBe(true);
    });

    it('应该将步行状态映射到通勤场景', () => {
      const signal: ContextSignal = {
        type: 'MOTION',
        value: 'WALKING',
        weight: 0.5,
        timestamp: Date.now(),
      };

      const mapping = engine['signalToScenes'](signal);

      const commuteScore = mapping.find(([scene]) => scene === 'COMMUTE')?.[1];
      expect(commuteScore).toBeGreaterThan(0.5);
    });
  });

  describe('refreshGeoConfiguration', () => {
    it('应该重新加载地理围栏配置', async () => {
      const mockFence = {
        id: 'test',
        name: '测试围栏',
        type: 'HOME' as const,
        latitude: 39.92,
        longitude: 116.42,
        radius: 100,
      };

      (geoFenceManager.getAllGeoFences as jest.Mock).mockReturnValue([mockFence]);

      await engine.refreshGeoConfiguration();

      expect(geoFenceManager.getAllGeoFences).toHaveBeenCalled();
    });
  });

  describe('clearConfiguration', () => {
    it('应该清除所有配置', () => {
      engine.clearConfiguration();

      // 验证配置已清除（通过检查行为）
      expect(() => engine['getSamplingIntervals']()).not.toThrow();
    });
  });

  describe('getSamplingIntervals', () => {
    it('应该返回正确的采样间隔配置', () => {
      const intervals = engine.getSamplingIntervals();

      expect(intervals.location).toBe(5 * 60 * 1000); // 5分钟
      expect(intervals.motion).toBe(30 * 1000); // 30秒
      expect(intervals.wifi).toBe(2 * 60 * 1000); // 2分钟
      expect(intervals.foregroundApp).toBe(10 * 1000); // 10秒
    });
  });
});
