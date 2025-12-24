/**
 * PredictiveTrigger 测试
 */

import { PredictiveTrigger } from '../PredictiveTrigger';
import type { SilentContext, SceneType, UserFeedback } from '../../types';

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

describe('PredictiveTrigger', () => {
  let trigger: PredictiveTrigger;

  beforeEach(() => {
    trigger = new PredictiveTrigger();
    // Reset dwell tracker for each test
    trigger.resetDwellTracker();
  });

  afterEach(() => {
    trigger.clearAllHistory();
  });

  describe('shouldTrigger', () => {
    const createMockContext = (
      sceneType: SceneType,
      confidence: number
    ): SilentContext => ({
      timestamp: Date.now(),
      context: sceneType,
      confidence,
      signals: [],
    });

    it('should not trigger when confidence is below threshold', () => {
      const context = createMockContext('COMMUTE', 0.5);
      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('confidence_out_of_range');
    });

    it('should not trigger when confidence is above threshold', () => {
      const context = createMockContext('COMMUTE', 0.8);
      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('confidence_out_of_range');
    });

    it('should not trigger when dwell time is insufficient', () => {
      const context = createMockContext('COMMUTE', 0.7);
      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('insufficient_dwell_time');
    });

    it('should trigger when all conditions are met', () => {
      const context = createMockContext('COMMUTE', 0.7);

      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(true);
      expect(decision.sceneType).toBe('COMMUTE');
      expect(decision.confidence).toBe(0.7);

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });

    it('should not trigger when in cooldown period', () => {
      const context = createMockContext('COMMUTE', 0.7);

      // First call to establish dwell time
      trigger.shouldTrigger(context);

      // Record a recent trigger
      trigger.recordFeedback('COMMUTE', 'accept');

      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('in_cooldown');

      // Restore original method
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
    });

    it('should not trigger when user has high ignore rate', () => {
      const context = createMockContext('COMMUTE', 0.7);

      // Record multiple ignores to create high ignore rate
      trigger.recordFeedback('COMMUTE', 'ignore');
      trigger.recordFeedback('COMMUTE', 'ignore');
      trigger.recordFeedback('COMMUTE', 'ignore');
      trigger.recordFeedback('COMMUTE', 'accept');

      // Mock sufficient dwell time
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000); // 2+ minutes

      // Mock cooldown as passed
      const originalIsInCooldown = (trigger as any).isInCooldown;
      (trigger as any).isInCooldown = jest.fn().mockReturnValue(false);

      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('high_ignore_rate');

      // Restore original methods
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
      (trigger as any).isInCooldown = originalIsInCooldown;
    });
  });

  describe('recordFeedback', () => {
    it('should record accept feedback correctly', () => {
      trigger.recordFeedback('COMMUTE', 'accept');

      const history = trigger.getHistory('COMMUTE');
      expect(history.acceptCount).toBe(1);
      expect(history.ignoreCount).toBe(0);
      expect(history.cancelCount).toBe(0);
      expect(history.consecutiveIgnores).toBe(0);
      expect(history.lastFeedback).toBe('accept');
      expect(history.lastTriggerTime).toBeGreaterThan(0);
    });

    it('should record ignore feedback correctly', () => {
      trigger.recordFeedback('HOME', 'ignore');

      const history = trigger.getHistory('HOME');
      expect(history.acceptCount).toBe(0);
      expect(history.ignoreCount).toBe(1);
      expect(history.cancelCount).toBe(0);
      expect(history.consecutiveIgnores).toBe(1);
      expect(history.lastFeedback).toBe('ignore');
    });

    it('should record cancel feedback correctly', () => {
      trigger.recordFeedback('STUDY', 'cancel');

      const history = trigger.getHistory('STUDY');
      expect(history.acceptCount).toBe(0);
      expect(history.ignoreCount).toBe(0);
      expect(history.cancelCount).toBe(1);
      expect(history.consecutiveIgnores).toBe(0);
      expect(history.lastFeedback).toBe('cancel');
    });

    it('should accumulate multiple feedbacks', () => {
      trigger.recordFeedback('OFFICE', 'accept');
      trigger.recordFeedback('OFFICE', 'accept');
      trigger.recordFeedback('OFFICE', 'ignore');

      const history = trigger.getHistory('OFFICE');
      expect(history.acceptCount).toBe(2);
      expect(history.ignoreCount).toBe(1);
      expect(history.cancelCount).toBe(0);
      expect(history.consecutiveIgnores).toBe(1);
      expect(history.lastFeedback).toBe('ignore');
    });

    it('should track consecutive ignores correctly', () => {
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

    it('should reset consecutive ignores on non-ignore feedback', () => {
      // Build up consecutive ignores
      trigger.recordFeedback('SLEEP', 'ignore');
      trigger.recordFeedback('SLEEP', 'ignore');
      
      let history = trigger.getHistory('SLEEP');
      expect(history.consecutiveIgnores).toBe(2);

      // Cancel should reset
      trigger.recordFeedback('SLEEP', 'cancel');
      history = trigger.getHistory('SLEEP');
      expect(history.consecutiveIgnores).toBe(0);
    });
  });

  describe('getHistory', () => {
    it('should return empty history for new scene', () => {
      const history = trigger.getHistory('SLEEP');

      expect(history.sceneType).toBe('SLEEP');
      expect(history.acceptCount).toBe(0);
      expect(history.ignoreCount).toBe(0);
      expect(history.cancelCount).toBe(0);
      expect(history.consecutiveIgnores).toBe(0);
      expect(history.lastFeedback).toBe(null);
      expect(history.lastTriggerTime).toBe(0);
    });

    it('should return existing history', () => {
      trigger.recordFeedback('TRAVEL', 'accept');
      trigger.recordFeedback('TRAVEL', 'ignore');

      const history = trigger.getHistory('TRAVEL');
      expect(history.acceptCount).toBe(1);
      expect(history.ignoreCount).toBe(1);
      expect(history.consecutiveIgnores).toBe(1);
      expect(history.lastFeedback).toBe('ignore');
    });
  });

  describe('getAllHistory', () => {
    it('should return all scene histories', () => {
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('HOME', 'ignore');
      trigger.recordFeedback('OFFICE', 'cancel');

      const allHistory = trigger.getAllHistory();
      expect(allHistory).toHaveLength(3);

      const sceneTypes = allHistory.map(h => h.sceneType);
      expect(sceneTypes).toContain('COMMUTE');
      expect(sceneTypes).toContain('HOME');
      expect(sceneTypes).toContain('OFFICE');
    });

    it('should return empty array when no history exists', () => {
      const allHistory = trigger.getAllHistory();
      expect(allHistory).toHaveLength(0);
    });
  });

  describe('clearHistory', () => {
    it('should clear history for specific scene', () => {
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('HOME', 'accept');

      trigger.clearHistory('COMMUTE');

      const commuteHistory = trigger.getHistory('COMMUTE');
      const homeHistory = trigger.getHistory('HOME');

      expect(commuteHistory.acceptCount).toBe(0);
      expect(homeHistory.acceptCount).toBe(1);
    });
  });

  describe('clearAllHistory', () => {
    it('should clear all histories', () => {
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('HOME', 'ignore');
      trigger.recordFeedback('OFFICE', 'cancel');

      trigger.clearAllHistory();

      const allHistory = trigger.getAllHistory();
      expect(allHistory).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'accept');
      trigger.recordFeedback('COMMUTE', 'ignore');
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'cancel');

      const stats = trigger.getStatistics();

      expect(stats.totalScenes).toBe(2);
      expect(stats.totalTriggers).toBe(5);
      expect(stats.totalAccepts).toBe(3);
      expect(stats.totalIgnores).toBe(1);
      expect(stats.totalCancels).toBe(1);
      expect(stats.averageAcceptRate).toBe(0.6); // 3/5
      expect(stats.scenesWithConsecutiveIgnores).toBe(0);
      expect(stats.scenesWithHighIgnoreRate).toBe(0);
    });

    it('should return zero statistics when no history exists', () => {
      const stats = trigger.getStatistics();

      expect(stats.totalScenes).toBe(0);
      expect(stats.totalTriggers).toBe(0);
      expect(stats.totalAccepts).toBe(0);
      expect(stats.totalIgnores).toBe(0);
      expect(stats.totalCancels).toBe(0);
      expect(stats.averageAcceptRate).toBe(0);
      expect(stats.scenesWithConsecutiveIgnores).toBe(0);
      expect(stats.scenesWithHighIgnoreRate).toBe(0);
    });

    it('should detect scenes with consecutive ignores', () => {
      // Create a scene with 3 consecutive ignores
      trigger.recordFeedback('OFFICE', 'ignore');
      trigger.recordFeedback('OFFICE', 'ignore');
      trigger.recordFeedback('OFFICE', 'ignore');

      const stats = trigger.getStatistics();
      expect(stats.scenesWithConsecutiveIgnores).toBe(1);
    });

    it('should detect scenes with high ignore rate', () => {
      // Create a scene with high ignore rate (3 ignores out of 4 total)
      trigger.recordFeedback('STUDY', 'ignore');
      trigger.recordFeedback('STUDY', 'ignore');
      trigger.recordFeedback('STUDY', 'ignore');
      trigger.recordFeedback('STUDY', 'accept');

      const stats = trigger.getStatistics();
      expect(stats.scenesWithHighIgnoreRate).toBe(1);
    });
  });

  describe('dwell time tracking', () => {
    it('should reset dwell time when scene changes', () => {
      const commuteContext = createMockContext('COMMUTE', 0.7);
      const homeContext = createMockContext('HOME', 0.7);

      // Start with commute scene
      trigger.shouldTrigger(commuteContext);

      // Switch to home scene - should reset dwell time
      const decision = trigger.shouldTrigger(homeContext);

      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('insufficient_dwell_time');
    });
  });

  describe('consecutive ignores and trigger frequency', () => {
    it('should not trigger when consecutive ignores threshold is reached', () => {
      const context = createMockContext('COMMUTE', 0.7);

      // Record 3 consecutive ignores
      trigger.recordFeedback('COMMUTE', 'ignore');
      trigger.recordFeedback('COMMUTE', 'ignore');
      trigger.recordFeedback('COMMUTE', 'ignore');

      // Mock sufficient dwell time and no cooldown
      const originalUpdateAndGetDwellTime = (trigger as any).updateAndGetDwellTime;
      const originalIsInCooldown = (trigger as any).isInCooldown;
      (trigger as any).updateAndGetDwellTime = jest.fn().mockReturnValue(2 * 60 * 1000 + 1000);
      (trigger as any).isInCooldown = jest.fn().mockReturnValue(false);

      const decision = trigger.shouldTrigger(context);

      expect(decision.suggest).toBe(false);
      expect(decision.reason).toBe('high_ignore_rate');

      // Restore original methods
      (trigger as any).updateAndGetDwellTime = originalUpdateAndGetDwellTime;
      (trigger as any).isInCooldown = originalIsInCooldown;
    });

    it('should calculate trigger frequency factor correctly', () => {
      // Test default factor
      let factor = trigger.getTriggerFrequencyFactor('UNKNOWN');
      expect(factor).toBe(1.0);

      // Test with consecutive ignores
      trigger.recordFeedback('COMMUTE', 'ignore');
      trigger.recordFeedback('COMMUTE', 'ignore');
      trigger.recordFeedback('COMMUTE', 'ignore');
      
      factor = trigger.getTriggerFrequencyFactor('COMMUTE');
      expect(factor).toBeLessThan(1.0);

      // Test with high accept rate
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'accept');
      trigger.recordFeedback('HOME', 'accept');
      
      factor = trigger.getTriggerFrequencyFactor('HOME');
      expect(factor).toBeGreaterThan(1.0);
    });

    it('should reset consecutive ignores', () => {
      // Build up consecutive ignores
      trigger.recordFeedback('OFFICE', 'ignore');
      trigger.recordFeedback('OFFICE', 'ignore');
      trigger.recordFeedback('OFFICE', 'ignore');

      let history = trigger.getHistory('OFFICE');
      expect(history.consecutiveIgnores).toBe(3);

      // Reset
      trigger.resetConsecutiveIgnores('OFFICE');
      
      history = trigger.getHistory('OFFICE');
      expect(history.consecutiveIgnores).toBe(0);
    });
  });

  describe('auto mode upgrade functionality', () => {
    it('should trigger auto mode upgrade suggestion after 5 consecutive accepts', () => {
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

    it('should not trigger auto mode upgrade if user has ignored or cancelled', () => {
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

    it('should not trigger auto mode upgrade if already rejected before', () => {
      // Mock the showAutoModeUpgradePrompt method
      const mockShowPrompt = jest.fn().mockResolvedValue('notification-id');
      (trigger as any).showAutoModeUpgradePrompt = mockShowPrompt;

      // Simulate previous rejection
      const history = trigger.getHistory('OFFICE');
      (history as any).autoModeUpgradeRejected = true;
      (history as any).autoModeUpgradeRejectedAt = Date.now() - 1000;

      // Record 5 consecutive accepts
      trigger.recordFeedback('OFFICE', 'accept');
      trigger.recordFeedback('OFFICE', 'accept');
      trigger.recordFeedback('OFFICE', 'accept');
      trigger.recordFeedback('OFFICE', 'accept');
      trigger.recordFeedback('OFFICE', 'accept');

      // Should not trigger upgrade suggestion
      expect(mockShowPrompt).not.toHaveBeenCalled();
    });

    it('should handle auto mode upgrade acceptance', async () => {
      // Mock the enableAutoModeForScene method
      const mockEnableAutoMode = jest.fn().mockResolvedValue(undefined);
      (trigger as any).enableAutoModeForScene = mockEnableAutoMode;

      // Handle acceptance
      await trigger.handleAutoModeUpgradeResponse('STUDY', true);

      // Verify that auto mode was enabled
      expect(mockEnableAutoMode).toHaveBeenCalledWith('STUDY');
    });

    it('should handle auto mode upgrade rejection', async () => {
      // Mock the recordAutoModeUpgradeRejection method
      const mockRecordRejection = jest.fn().mockResolvedValue(undefined);
      (trigger as any).recordAutoModeUpgradeRejection = mockRecordRejection;

      // Handle rejection
      await trigger.handleAutoModeUpgradeResponse('SLEEP', false);

      // Verify that rejection was recorded
      expect(mockRecordRejection).toHaveBeenCalledWith('SLEEP');
    });

    it('should get correct scene display names', () => {
      const getSceneDisplayName = (trigger as any).getSceneDisplayName.bind(trigger);

      expect(getSceneDisplayName('COMMUTE')).toBe('通勤');
      expect(getSceneDisplayName('HOME')).toBe('到家');
      expect(getSceneDisplayName('OFFICE')).toBe('办公');
      expect(getSceneDisplayName('STUDY')).toBe('学习');
      expect(getSceneDisplayName('SLEEP')).toBe('睡前');
      expect(getSceneDisplayName('TRAVEL')).toBe('出行');
      expect(getSceneDisplayName('UNKNOWN')).toBe('未知');
    });

    it('should record auto mode upgrade rejection correctly', async () => {
      // Call the private method directly for testing
      await (trigger as any).recordAutoModeUpgradeRejection('TRAVEL');

      // Verify that rejection was recorded in history
      const history = trigger.getHistory('TRAVEL');
      expect((history as any).autoModeUpgradeRejected).toBe(true);
      expect((history as any).autoModeUpgradeRejectedAt).toBeGreaterThan(0);
    });

    it('should check shouldSuggestAutoMode correctly', () => {
      const shouldSuggestAutoMode = (trigger as any).shouldSuggestAutoMode.bind(trigger);

      // Test with 5 accepts and no negative feedback
      trigger.recordFeedback('TEST_SCENE' as any, 'accept');
      trigger.recordFeedback('TEST_SCENE' as any, 'accept');
      trigger.recordFeedback('TEST_SCENE' as any, 'accept');
      trigger.recordFeedback('TEST_SCENE' as any, 'accept');
      trigger.recordFeedback('TEST_SCENE' as any, 'accept');

      const history1 = trigger.getHistory('TEST_SCENE' as any);
      expect(shouldSuggestAutoMode(history1)).toBe(true);

      // Test with negative feedback
      trigger.recordFeedback('TEST_SCENE2' as any, 'accept');
      trigger.recordFeedback('TEST_SCENE2' as any, 'accept');
      trigger.recordFeedback('TEST_SCENE2' as any, 'accept');
      trigger.recordFeedback('TEST_SCENE2' as any, 'accept');
      trigger.recordFeedback('TEST_SCENE2' as any, 'ignore');
      trigger.recordFeedback('TEST_SCENE2' as any, 'accept');

      const history2 = trigger.getHistory('TEST_SCENE2' as any);
      expect(shouldSuggestAutoMode(history2)).toBe(false);

      // Test with previous rejection
      const history3 = trigger.getHistory('TEST_SCENE3' as any);
      (history3 as any).autoModeUpgradeRejected = true;
      expect(shouldSuggestAutoMode(history3)).toBe(false);
    });
  });

  // Helper function to create mock context
  const createMockContext = (
    sceneType: SceneType,
    confidence: number
  ): SilentContext => ({
    timestamp: Date.now(),
    context: sceneType,
    confidence,
    signals: [],
  });
});