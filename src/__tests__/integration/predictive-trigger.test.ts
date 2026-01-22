/**
 * 预测触发集成测试
 * 
 * 测试需求：
 * - 模拟置信度 0.6-0.75 的场景
 * - 验证停留 2 分钟后弹出建议
 * - 验证冷却机制
 * - 验证用户反馈学习
 * 
 * Requirements: 需求 10.1, 10.2, 10.3
 */

import { PredictiveTrigger } from '../../core/PredictiveTrigger';
import type { SilentContext, SceneType, TriggerDecision } from '../../types';

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  const mockStorage = {
    set: jest.fn(),
    getString: jest.fn(),
    clearAll: jest.fn(),
  };
  
  return {
    MMKV: jest.fn().mockImplementation(() => mockStorage),
  };
});

// Mock notification manager to avoid import issues
jest.mock('../../notifications/NotificationManager', () => ({
  notificationManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    showAutoModeUpgradePrompt: jest.fn().mockResolvedValue('notification-id'),
    showSystemNotification: jest.fn().mockResolvedValue('notification-id'),
  },
}));

// Mock storage manager to avoid import issues
jest.mock('../../stores', () => ({
  storageManager: {
    getUserConfig: jest.fn().mockResolvedValue({
      onboardingCompleted: true,
      permissionsGranted: [],
      enabledScenes: ['COMMUTE', 'HOME', 'OFFICE'],
      autoModeScenes: [],
    }),
    saveUserConfig: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('预测触发集成测试', () => {
  let trigger: PredictiveTrigger;

  beforeEach(() => {
    trigger = new PredictiveTrigger();
    // Reset dwell tracker for each test
    trigger.resetDwellTracker();
    // Clear all history
    trigger.clearAllHistory();
  });

  afterEach(() => {
    trigger.clearAllHistory();
  });

  /**
   * 创建模拟的静默上下文
   */
  const createMockContext = (
    sceneType: SceneType,
    confidence: number,
    timestamp: number = Date.now()
  ): SilentContext => ({
    timestamp,
    context: sceneType,
    confidence,
    signals: [
      {
        type: 'TIME',
        value: 'MORNING_RUSH',
        weight: 0.8,
        timestamp,
      },
      {
        type: 'LOCATION',
        value: 'SUBWAY_STATION',
        weight: 0.9,
        timestamp,
      },
    ],
  });

  /**
   * 模拟时间流逝
   */
  const advanceTime = (milliseconds: number) => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + milliseconds);
  };

  /**
   * 恢复时间模拟
   */
  const restoreTime = () => {
    jest.restoreAllMocks();
  };

  describe('置信度阈值检查 (需求 10.1)', () => {
    it('应该在置信度低于 0.6 时不触发', () => {
      const context = createMockContext('COMMUTE', 0.5);
      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('confidence_out_of_range');
    });

    it('应该在置信度高于 0.75 时不触发', () => {
      const context = createMockContext('COMMUTE', 0.8);
      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('confidence_out_of_range');
    });

    it('应该在置信度为 0.6 时可能触发', () => {
      const context = createMockContext('COMMUTE', 0.6);
      
      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(true);
      expect(decision.sceneType).toBe('COMMUTE');
      expect(decision.confidence).toBe(0.6);

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });

    it('应该在置信度为 0.75 时可能触发', () => {
      const context = createMockContext('HOME', 0.75);
      
      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(true);
      expect(decision.sceneType).toBe('HOME');
      expect(decision.confidence).toBe(0.75);

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });

    it('应该在置信度为 0.65 时可能触发', () => {
      const context = createMockContext('OFFICE', 0.65);
      
      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(true);
      expect(decision.sceneType).toBe('OFFICE');
      expect(decision.confidence).toBe(0.65);

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });
  });

  describe('停留时间检查 (需求 10.1)', () => {
    it('应该在停留时间不足 2 分钟时不触发', () => {
      const context = createMockContext('COMMUTE', 0.7);
      
      // First call to establish scene
      trigger.shouldTrigger(context);
      
      // Immediately check again - should not have enough dwell time
      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('insufficient_dwell_time');
    });

    it('应该在停留时间达到 2 分钟时触发', () => {
      const context = createMockContext('COMMUTE', 0.7);
      
      // Mock the dwell time tracking
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      let dwellTime = 0;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockImplementation(() => {
        dwellTime += 1000; // Increment by 1 second each call
        return dwellTime;
      });

      // First few calls should not trigger
      let decision = trigger.shouldTrigger(context);
      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('insufficient_dwell_time');

      // Continue until we reach 2 minutes
      for (let i = 0; i < 120; i++) { // 120 seconds = 2 minutes
        decision = trigger.shouldTrigger(context);
      }

      // Now should trigger
      expect(decision.suggest).toBe(true);
      expect(decision.sceneType).toBe('COMMUTE');

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });

    it('应该在场景变化时重置停留时间', () => {
      const commuteContext = createMockContext('COMMUTE', 0.7);
      const homeContext = createMockContext('HOME', 0.7);
      
      // Mock sufficient dwell time for first scene
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      // First scene should trigger
      let decision = trigger.shouldTrigger(commuteContext);
      expect(decision.suggest).toBe(true);

      // Restore original method to test reset
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;

      // Switch to different scene - should reset dwell time
      decision = trigger.shouldTrigger(homeContext);
      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('insufficient_dwell_time');
    });

    it('应该正确跟踪同一场景的连续停留时间', () => {
      const context = createMockContext('STUDY', 0.65);
      
      // Track actual dwell time progression
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      
      let callCount = 0;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockImplementation(() => {
        callCount++;
        return callCount * 30 * 1000; // 30 seconds per call
      });

      // Should not trigger for first 3 calls (< 2 minutes)
      for (let i = 0; i < 3; i++) {
        const decision = trigger.shouldTrigger(context);
        expect(decision.suggest).toBe(false);
        expect(decision.reason).toBe('insufficient_dwell_time');
      }

      // Should trigger on 4th call (2 minutes)
      const decision = trigger.shouldTrigger(context);
      expect(decision.suggest).toBe(true);
      expect(decision.sceneType).toBe('STUDY');

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });
  });

  describe('冷却机制 (需求 10.2)', () => {
    it('应该在 1 小时内不重复触发同一场景', () => {
      const context = createMockContext('COMMUTE', 0.7);
      
      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      // First trigger should succeed
      let decision = trigger.shouldTrigger(context);
      expect(decision.suggest).toBe(true);

      // Record feedback to establish trigger time
      trigger.recordFeedback('COMMUTE', 'accept');

      // Immediate retry should be in cooldown
      decision = trigger.shouldTrigger(context);
      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('in_cooldown');

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });

    it('应该在 1 小时后允许重新触发', () => {
      const context = createMockContext('HOME', 0.65);
      
      // Mock sufficient dwell time and no cooldown initially
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      const originalIsInCooldown = (trigger as any).isInCooldown;
      
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes
      (trigger as any).isInCooldown = jest.fn().mockReturnValue(false);

      // Should trigger when not in cooldown
      const decision = trigger.shouldTrigger(context);
      expect(decision.suggest).toBe(true);
      expect(decision.sceneType).toBe('HOME');

      // Restore original methods
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
      (trigger as any).isInCooldown = originalIsInCooldown;
    });

    it('应该正确计算冷却时间', () => {
      // Record a feedback to set last trigger time
      trigger.recordFeedback('OFFICE', 'accept');
      
      const history = trigger.getHistory('OFFICE');
      expect(history.lastTriggerTime).toBeGreaterThan(0);

      // Check if in cooldown immediately after
      const isInCooldown = (trigger as any).isInCooldown(history);
      expect(isInCooldown).toBe(true);

      // Mock time advancement (1 hour + 1 minute)
      const originalNow = Date.now;
      Date.now = jest.fn().mockReturnValue(history.lastTriggerTime + 61 * 60 * 1000);

      // Should not be in cooldown after 1 hour
      const isStillInCooldown = (trigger as any).isInCooldown(history);
      expect(isStillInCooldown).toBe(false);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('应该允许不同场景同时触发', () => {
      const commuteContext = createMockContext('COMMUTE', 0.7);
      const homeContext = createMockContext('HOME', 0.65);
      
      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      // Trigger commute scene
      let decision = trigger.shouldTrigger(commuteContext);
      expect(decision.suggest).toBe(true);
      
      // Record feedback for commute
      trigger.recordFeedback('COMMUTE', 'accept');

      // Home scene should still be able to trigger (different scene)
      decision = trigger.shouldTrigger(homeContext);
      expect(decision.suggest).toBe(true);
      expect(decision.sceneType).toBe('HOME');

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });
  });

  describe('用户反馈学习 (需求 10.3)', () => {
    it('应该在连续 3 次忽略后降低触发频率', () => {
      const context = createMockContext('STUDY', 0.7);
      
      // Record 3 consecutive ignores
      trigger.recordFeedback('STUDY', 'ignore');
      trigger.recordFeedback('STUDY', 'ignore');
      trigger.recordFeedback('STUDY', 'ignore');

      // Mock sufficient dwell time and no cooldown
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      const originalIsInCooldown = (trigger as any).isInCooldown;
      
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes
      (trigger as any).isInCooldown = jest.fn().mockReturnValue(false);

      // Should not trigger due to high ignore rate
      const decision = trigger.shouldTrigger(context);
      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('high_ignore_rate');

      // Restore original methods
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
      (trigger as any).isInCooldown = originalIsInCooldown;
    });

    it('应该正确跟踪连续忽略次数', () => {
      // First ignore
      trigger.recordFeedback('TRAVEL', 'ignore');
      let history = trigger.getHistory('TRAVEL');
      expect(history.consecutiveIgnores).toBe(1);

      // Second consecutive ignore
      trigger.recordFeedback('TRAVEL', 'ignore');
      history = trigger.getHistory('TRAVEL');
      expect(history.consecutiveIgnores).toBe(2);

      // Third consecutive ignore
      trigger.recordFeedback('TRAVEL', 'ignore');
      history = trigger.getHistory('TRAVEL');
      expect(history.consecutiveIgnores).toBe(3);

      // Accept should reset consecutive ignores
      trigger.recordFeedback('TRAVEL', 'accept');
      history = trigger.getHistory('TRAVEL');
      expect(history.consecutiveIgnores).toBe(0);
    });

    it('应该在接受操作后重置连续忽略计数', () => {
      // Build up consecutive ignores
      trigger.recordFeedback('SLEEP', 'ignore');
      trigger.recordFeedback('SLEEP', 'ignore');
      
      let history = trigger.getHistory('SLEEP');
      expect(history.consecutiveIgnores).toBe(2);

      // Accept should reset
      trigger.recordFeedback('SLEEP', 'accept');
      history = trigger.getHistory('SLEEP');
      expect(history.consecutiveIgnores).toBe(0);
      expect(history.lastFeedback).toBe('accept');
    });

    it('应该在取消操作后重置连续忽略计数', () => {
      // Build up consecutive ignores
      trigger.recordFeedback('OFFICE', 'ignore');
      trigger.recordFeedback('OFFICE', 'ignore');
      
      let history = trigger.getHistory('OFFICE');
      expect(history.consecutiveIgnores).toBe(2);

      // Cancel should reset
      trigger.recordFeedback('OFFICE', 'cancel');
      history = trigger.getHistory('OFFICE');
      expect(history.consecutiveIgnores).toBe(0);
      expect(history.lastFeedback).toBe('cancel');
    });

    it('应该计算正确的忽略率', () => {
      // Mixed feedback with high ignore rate
      trigger.recordFeedback('HOME', 'ignore');
      trigger.recordFeedback('HOME', 'ignore');
      trigger.recordFeedback('HOME', 'ignore');
      trigger.recordFeedback('HOME', 'accept');

      const history = trigger.getHistory('HOME');
      const totalFeedback = history.acceptCount + history.ignoreCount + history.cancelCount;
      const ignoreRate = history.ignoreCount / totalFeedback;
      
      expect(totalFeedback).toBe(4);
      expect(ignoreRate).toBe(0.75); // 3/4 = 0.75 > 0.7 threshold
      
      // Should be considered high ignore rate
      const hasHighIgnoreRate = (trigger as any).hasHighIgnoreRate(history);
      expect(hasHighIgnoreRate).toBe(true);
    });

    it('应该在忽略率低时允许触发', () => {
      // Mixed feedback with low ignore rate
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'ignore');

      const history = trigger.getHistory('COMMUTE');
      const totalFeedback = history.acceptCount + history.ignoreCount + history.cancelCount;
      const ignoreRate = history.ignoreCount / totalFeedback;
      
      expect(totalFeedback).toBe(4);
      expect(ignoreRate).toBe(0.25); // 1/4 = 0.25 < 0.7 threshold
      
      // Should not be considered high ignore rate
      const hasHighIgnoreRate = (trigger as any).hasHighIgnoreRate(history);
      expect(hasHighIgnoreRate).toBe(false);
    });

    it('应该正确计算触发频率调整因子', () => {
      // Test default factor for new scene
      let factor = trigger.getTriggerFrequencyFactor('UNKNOWN');
      expect(factor).toBe(1.0);

      // Test with consecutive ignores (should decrease factor)
      trigger.recordFeedback('COMMUTE', 'ignore');
      trigger.recordFeedback('COMMUTE', 'ignore');
      trigger.recordFeedback('COMMUTE', 'ignore');
      
      factor = trigger.getTriggerFrequencyFactor('COMMUTE');
      expect(factor).toBeLessThan(1.0);
      expect(factor).toBeGreaterThanOrEqual(0.1); // Should not go below minimum

      // Test with high accept rate (should increase factor)
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'accept');
      
      factor = trigger.getTriggerFrequencyFactor('HOME');
      expect(factor).toBeGreaterThan(1.0);
      expect(factor).toBeLessThanOrEqual(2.0); // Should not go above maximum
    });
  });

  describe('自动模式升级建议 (需求 10.4, 10.5)', () => {
    it('应该在连续 5 次接受后建议升级为自动模式', async () => {
      // Mock the showAutoModeUpgradePrompt method
      const mockShowPrompt = jest.fn().mockResolvedValue('notification-id');
      (trigger as any).showAutoModeUpgradePrompt = mockShowPrompt;

      // Record 5 consecutive accepts
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'accept');

      // Verify that auto mode upgrade was suggested
      expect(mockShowPrompt).toHaveBeenCalledWith('COMMUTE', expect.objectContaining({
        acceptCount: 5,
        ignoreCount: 0,
        cancelCount: 0,
      }));
    });

    it('应该在有负面反馈时不建议升级', async () => {
      // Mock the showAutoModeUpgradePrompt method
      const mockShowPrompt = jest.fn().mockResolvedValue('notification-id');
      (trigger as any).showAutoModeUpgradePrompt = mockShowPrompt;

      // Record 5 accepts but with 1 ignore
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'ignore');
      trigger.recordFeedback('HOME', 'accept');

      // Should not trigger upgrade suggestion
      expect(mockShowPrompt).not.toHaveBeenCalled();
    });

    it('应该处理自动模式升级接受', async () => {
      // Mock the enableAutoModeForScene method
      const mockEnableAutoMode = jest.fn().mockResolvedValue(undefined);
      (trigger as any).enableAutoModeForScene = mockEnableAutoMode;

      // Handle acceptance
      await trigger.handleAutoModeUpgradeResponse('STUDY', true);

      // Verify that auto mode was enabled
      expect(mockEnableAutoMode).toHaveBeenCalledWith('STUDY');
    });

    it('应该处理自动模式升级拒绝', async () => {
      // Mock the recordAutoModeUpgradeRejection method
      const mockRecordRejection = jest.fn().mockResolvedValue(undefined);
      (trigger as any).recordAutoModeUpgradeRejection = mockRecordRejection;

      // Handle rejection
      await trigger.handleAutoModeUpgradeResponse('SLEEP', false);

      // Verify that rejection was recorded
      expect(mockRecordRejection).toHaveBeenCalledWith('SLEEP');
    });

    it('应该在之前拒绝过升级后不再提示', () => {
      const shouldSuggestAutoMode = (trigger as any).shouldSuggestAutoMode.bind(trigger);

      // Create history with previous rejection
      const history = trigger.getHistory('OFFICE');
      (history as any).autoModeUpgradeRejected = true;
      (history as any).autoModeUpgradeRejectedAt = Date.now() - 1000;

      // Even with 5 accepts, should not suggest due to previous rejection
      history.acceptCount = 5;
      history.ignoreCount = 0;
      history.cancelCount = 0;

      expect(shouldSuggestAutoMode(history)).toBe(false);
    });
  });

  describe('综合场景测试', () => {
    it('应该正确处理完整的触发流程', () => {
      const context = createMockContext('COMMUTE', 0.7);
      
      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      // 1. First trigger should succeed
      let decision = trigger.shouldTrigger(context);
      expect(decision.suggest).toBe(true);
      expect(decision.sceneType).toBe('COMMUTE');
      expect(decision.confidence).toBe(0.7);

      // 2. Record user acceptance
      trigger.recordFeedback('COMMUTE', 'accept');

      // 3. Immediate retry should be in cooldown
      decision = trigger.shouldTrigger(context);
      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('in_cooldown');

      // 4. Check history was updated
      const history = trigger.getHistory('COMMUTE');
      expect(history.acceptCount).toBe(1);
      expect(history.ignoreCount).toBe(0);
      expect(history.consecutiveIgnores).toBe(0);
      expect(history.lastFeedback).toBe('accept');

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });

    it('应该正确处理多场景并发触发', () => {
      const commuteContext = createMockContext('COMMUTE', 0.65);
      const homeContext = createMockContext('HOME', 0.7);
      const officeContext = createMockContext('OFFICE', 0.6);
      
      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      // All scenes should be able to trigger initially
      let decision1 = trigger.shouldTrigger(commuteContext);
      expect(decision1.suggest).toBe(true);
      expect(decision1.sceneType).toBe('COMMUTE');

      let decision2 = trigger.shouldTrigger(homeContext);
      expect(decision2.suggest).toBe(true);
      expect(decision2.sceneType).toBe('HOME');

      let decision3 = trigger.shouldTrigger(officeContext);
      expect(decision3.suggest).toBe(true);
      expect(decision3.sceneType).toBe('OFFICE');

      // Record feedback for each
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('HOME', 'ignore');
      trigger.recordFeedback('OFFICE', 'cancel');

      // Check individual histories
      const commuteHistory = trigger.getHistory('COMMUTE');
      const homeHistory = trigger.getHistory('HOME');
      const officeHistory = trigger.getHistory('OFFICE');

      expect(commuteHistory.acceptCount).toBe(1);
      expect(homeHistory.ignoreCount).toBe(1);
      expect(officeHistory.cancelCount).toBe(1);

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });

    it('应该正确处理边界条件', () => {
      // Test exact boundary values
      const contextMinConfidence = createMockContext('STUDY', 0.6);
      const contextMaxConfidence = createMockContext('TRAVEL', 0.75);
      
      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000); // Exactly 2 minutes

      // Both boundary values should trigger
      let decision1 = trigger.shouldTrigger(contextMinConfidence);
      expect(decision1.suggest).toBe(true);

      let decision2 = trigger.shouldTrigger(contextMaxConfidence);
      expect(decision2.suggest).toBe(true);

      // Test just outside boundaries
      const contextTooLow = createMockContext('SLEEP', 0.59);
      const contextTooHigh = createMockContext('HOME', 0.76);

      let decision3 = trigger.shouldTrigger(contextTooLow);
      expect(decision3.suggest).toBe(false);
      expect(decision3.reason).toBe('confidence_out_of_range');

      let decision4 = trigger.shouldTrigger(contextTooHigh);
      expect(decision4.suggest).toBe(false);
      expect(decision4.reason).toBe('confidence_out_of_range');

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });
  });

  describe('统计信息和数据管理', () => {
    it('应该正确计算统计信息', () => {
      // Add various feedback for different scenes
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'ignore');
      
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'cancel');
      
      trigger.recordFeedback('OFFICE', 'ignore');
      trigger.recordFeedback('OFFICE', 'ignore');
      trigger.recordFeedback('OFFICE', 'ignore');

      const stats = trigger.getStatistics();

      expect(stats.totalScenes).toBe(3);
      expect(stats.totalTriggers).toBe(8);
      expect(stats.totalAccepts).toBe(3);
      expect(stats.totalIgnores).toBe(4);
      expect(stats.totalCancels).toBe(1);
      expect(stats.averageAcceptRate).toBe(3/8); // 0.375
      expect(stats.scenesWithConsecutiveIgnores).toBe(1); // OFFICE has 3 consecutive ignores
      expect(stats.scenesWithHighIgnoreRate).toBe(1); // OFFICE has 100% ignore rate
    });

    it('应该正确清理历史数据', () => {
      // Add some feedback
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('HOME', 'ignore');
      
      // Verify data exists
      expect(trigger.getAllHistory()).toHaveLength(2);
      
      // Clear specific scene
      trigger.clearHistory('COMMUTE');
      expect(trigger.getAllHistory()).toHaveLength(1);
      expect(trigger.getHistory('COMMUTE').acceptCount).toBe(0);
      
      // Clear all
      trigger.clearAllHistory();
      expect(trigger.getAllHistory()).toHaveLength(0);
    });

    it('应该正确重置连续忽略计数', () => {
      // Build up consecutive ignores
      trigger.recordFeedback('STUDY', 'ignore');
      trigger.recordFeedback('STUDY', 'ignore');
      trigger.recordFeedback('STUDY', 'ignore');

      let history = trigger.getHistory('STUDY');
      expect(history.consecutiveIgnores).toBe(3);

      // Reset consecutive ignores
      trigger.resetConsecutiveIgnores('STUDY');
      
      history = trigger.getHistory('STUDY');
      expect(history.consecutiveIgnores).toBe(0);
      // Other counts should remain unchanged
      expect(history.ignoreCount).toBe(3);
    });
  });
});