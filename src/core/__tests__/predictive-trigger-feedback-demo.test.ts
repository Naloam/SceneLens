/**
 * PredictiveTrigger 核心逻辑测试
 *
 * 验证：
 * - 置信度/停留时间检查
 * - 用户反馈统计与连续忽略计数
 */

import { PredictiveTrigger } from '../PredictiveTrigger';
import type { SilentContext } from '../../types';

describe('PredictiveTrigger', () => {
  let trigger: PredictiveTrigger;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    trigger = new PredictiveTrigger();
  });

  afterEach(() => {
    trigger.clearAllHistory();
    trigger.resetDwellTracker();
    warnSpy.mockRestore();
  });

  it('should reject when confidence is out of range and allow when dwell time satisfied', () => {
    const lowConfidence: SilentContext = {
      timestamp: Date.now(),
      context: 'COMMUTE',
      confidence: 0.4,
      signals: [],
    };

    const decisionLow = trigger.shouldTrigger(lowConfidence);
    expect(decisionLow.suggest).toBe(false);
    expect(decisionLow.reason).toBe('confidence_out_of_range');

    // 模拟已经停留超过 2 分钟的同一场景
    (trigger as any).dwellTracker = {
      sceneType: 'COMMUTE',
      startTime: Date.now() - 3 * 60 * 1000,
      lastUpdateTime: Date.now() - 1000,
    };

    const eligibleContext: SilentContext = {
      timestamp: Date.now(),
      context: 'COMMUTE',
      confidence: 0.7,
      signals: [],
    };

    const decision = trigger.shouldTrigger(eligibleContext);
    expect(decision.suggest).toBe(true);
    expect(decision.sceneType).toBe('COMMUTE');
  });

  it('tracks consecutive ignores and feedback counters', () => {
    trigger.recordFeedback('HOME', 'ignore');
    trigger.recordFeedback('HOME', 'ignore');
    trigger.recordFeedback('HOME', 'ignore');

    const history = trigger.getHistory('HOME');
    expect(history.ignoreCount).toBe(3);
    expect(history.consecutiveIgnores).toBeGreaterThanOrEqual(3);

    trigger.recordFeedback('HOME', 'accept');
    const updated = trigger.getHistory('HOME');
    expect(updated.acceptCount).toBe(1);
    expect(updated.consecutiveIgnores).toBe(0);
    expect(updated.lastFeedback).toBe('accept');
  });
});