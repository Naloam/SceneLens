/**
 * RuleEngine 单元测试
 *
 * 测试规则引擎的核心功能
 */

import { RuleEngine, Rule, MatchedRule } from '../RuleEngine';
import { SilentContext, SceneType } from '../../types';

describe('RuleEngine', () => {
  let engine: RuleEngine;

  beforeEach(() => {
    engine = new RuleEngine();
  });

  describe('loadRules', () => {
    it('应该加载内置规则', async () => {
      await engine.loadRules();

      const rules = engine.getRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('应该从传入的数据加载规则', async () => {
      const customRules: Rule[] = [
        {
          id: 'CUSTOM_RULE',
          priority: 'MEDIUM',
          mode: 'ONE_TAP',
          enabled: true,
          conditions: [
            { type: 'time', value: 'MORNING_RUSH', weight: 0.6 },
          ],
          actions: [
            { target: 'notification', action: 'suggest', params: { title: 'Test' } },
          ],
        },
      ];

      await engine.loadRules(customRules);

      const rules = engine.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('CUSTOM_RULE');
    });

    it('应该在没有规则时使用兜底规则', async () => {
      // 模拟加载失败
      jest.spyOn(engine as any, 'loadBuiltInRulesFromYaml').mockReturnValue([]);

      await engine.loadRules();

      const rules = engine.getRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].id).toBe('RULE_COMMUTE');
    });
  });

  describe('matchRules', () => {
    let testRules: Rule[];

    beforeEach(async () => {
      testRules = [
        {
          id: 'COMMUTE_RULE',
          priority: 'HIGH',
          mode: 'ONE_TAP',
          enabled: true,
          conditions: [
            { type: 'time', value: 'MORNING_RUSH_WEEKDAY', weight: 0.6 },
            { type: 'location', value: 'SUBWAY_STATION', weight: 0.8 },
            { type: 'motion', value: 'WALKING', weight: 0.4 },
          ],
          actions: [
            { target: 'notification', action: 'suggest', params: { title: '通勤模式' } },
          ],
        },
        {
          id: 'HOME_RULE',
          priority: 'MEDIUM',
          mode: 'SUGGEST_ONLY',
          enabled: true,
          conditions: [
            { type: 'location', value: 'HOME', weight: 0.9 },
            { type: 'wifi', value: 'HOME', weight: 0.9 },
          ],
          actions: [
            { target: 'notification', action: 'suggest', params: { title: '到家模式' } },
          ],
        },
        {
          id: 'DISABLED_RULE',
          priority: 'HIGH',
          mode: 'AUTO',
          enabled: false, // 禁用
          conditions: [
            { type: 'time', value: 'NIGHT_WEEKDAY', weight: 0.7 },
          ],
          actions: [],
        },
      ];

      await engine.loadRules(testRules);
    });

    it('应该匹配通勤场景规则', async () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'COMMUTE',
        confidence: 0.85,
        signals: [
          { type: 'TIME', value: 'MORNING_RUSH_WEEKDAY', weight: 0.85, timestamp: Date.now() },
          { type: 'LOCATION', value: 'SUBWAY_STATION', weight: 0.8, timestamp: Date.now() },
          { type: 'MOTION', value: 'WALKING', weight: 0.5, timestamp: Date.now() },
        ],
      };

      const matched = await engine.matchRules(context);

      expect(matched.length).toBeGreaterThan(0);
      expect(matched[0].rule.id).toBe('COMMUTE_RULE');
      expect(matched[0].score).toBeGreaterThan(0.6);
    });

    it('应该匹配家场景规则', async () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'HOME',
        confidence: 0.9,
        signals: [
          { type: 'LOCATION', value: 'HOME', weight: 0.9, timestamp: Date.now() },
          { type: 'WIFI', value: 'HOME', weight: 0.9, timestamp: Date.now() },
          { type: 'TIME', value: 'NIGHT_WEEKDAY', weight: 0.7, timestamp: Date.now() },
        ],
      };

      const matched = await engine.matchRules(context);

      expect(matched.length).toBeGreaterThan(0);
      const homeRule = matched.find(m => m.rule.id === 'HOME_RULE');
      expect(homeRule).toBeDefined();
    });

    it('应该忽略禁用的规则', async () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'UNKNOWN',
        confidence: 0.5,
        signals: [
          { type: 'TIME', value: 'NIGHT_WEEKDAY', weight: 0.7, timestamp: Date.now() },
        ],
      };

      const matched = await engine.matchRules(context);

      // 禁用的规则不应该出现在结果中
      const disabledRule = matched.find(m => m.rule.id === 'DISABLED_RULE');
      expect(disabledRule).toBeUndefined();
    });

    it('应该按优先级和得分排序匹配结果', async () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'COMMUTE',
        confidence: 0.8,
        signals: [
          { type: 'TIME', value: 'MORNING_RUSH_WEEKDAY', weight: 0.85, timestamp: Date.now() },
          { type: 'LOCATION', value: 'SUBWAY_STATION', weight: 0.8, timestamp: Date.now() },
          { type: 'WIFI', value: 'HOME', weight: 0.9, timestamp: Date.now() },
        ],
      };

      const matched = await engine.matchRules(context);

      if (matched.length > 1) {
        // 高优先级规则应该在前面
        for (let i = 0; i < matched.length - 1; i++) {
          const current = matched[i];
          const next = matched[i + 1];

          const currentPriority = engine['priorityValue'](current.rule.priority);
          const nextPriority = engine['priorityValue'](next.rule.priority);

          // 优先级高的在前面，或者优先级相同但得分高的在前面
          if (currentPriority === nextPriority) {
            expect(current.score).toBeGreaterThanOrEqual(next.score);
          } else {
            expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
          }
        }
      }
    });

    it('应该在得分低于阈值时不匹配规则', async () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'UNKNOWN',
        confidence: 0.3,
        signals: [
          { type: 'TIME', value: 'LUNCH_WEEKDAY', weight: 0.5, timestamp: Date.now() },
        ],
      };

      const matched = await engine.matchRules(context);

      // 应该没有匹配的规则（因为得分太低）
      expect(matched.length).toBe(0);
    });
  });

  describe('calculateRuleScore', () => {
    let rule: Rule;

    beforeEach(() => {
      rule = {
        id: 'TEST_RULE',
        priority: 'MEDIUM',
        mode: 'ONE_TAP',
        enabled: true,
        conditions: [
          { type: 'time', value: 'MORNING_RUSH', weight: 0.6 },
          { type: 'location', value: 'SUBWAY_STATION', weight: 0.8 },
          { type: 'motion', value: 'WALKING', weight: 0.4 },
        ],
        actions: [],
      };
    });

    it('应该正确计算全部条件匹配的得分', () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'COMMUTE',
        confidence: 0.8,
        signals: [
          { type: 'TIME', value: 'MORNING_RUSH_WEEKDAY', weight: 0.85, timestamp: Date.now() },
          { type: 'LOCATION', value: 'SUBWAY_STATION', weight: 0.8, timestamp: Date.now() },
          { type: 'MOTION', value: 'WALKING', weight: 0.5, timestamp: Date.now() },
        ],
      };

      const score = engine.calculateRuleScore(rule, context);

      // 全部条件匹配，得分应该接近 1
      expect(score).toBeCloseTo(1.0, 1);
    });

    it('应该正确计算部分条件匹配的得分', () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'UNKNOWN',
        confidence: 0.5,
        signals: [
          { type: 'TIME', value: 'MORNING_RUSH_WEEKDAY', weight: 0.85, timestamp: Date.now() },
          { type: 'LOCATION', value: 'UNKNOWN', weight: 0.3, timestamp: Date.now() },
          { type: 'MOTION', value: 'STILL', weight: 0.5, timestamp: Date.now() },
        ],
      };

      const score = engine.calculateRuleScore(rule, context);

      // 只有时间条件匹配，得分应该较低
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.8);
    });

    it('应该在没有任何条件匹配时返回 0', () => {
      const context: SilentContext = {
        timestamp: Date.now(),
        context: 'UNKNOWN',
        confidence: 0.2,
        signals: [
          { type: 'TIME', value: 'NIGHT_WEEKEND', weight: 0.5, timestamp: Date.now() },
        ],
      };

      const score = engine.calculateRuleScore(rule, context);

      expect(score).toBe(0);
    });
  });

  describe('getRuleById', () => {
    it('应该根据 ID 返回规则', async () => {
      const customRules: Rule[] = [
        {
          id: 'TEST_RULE',
          priority: 'HIGH',
          mode: 'ONE_TAP',
          enabled: true,
          conditions: [],
          actions: [],
        },
      ];

      await engine.loadRules(customRules);

      const rule = engine.getRuleById('TEST_RULE');
      expect(rule).toBeDefined();
      expect(rule?.id).toBe('TEST_RULE');
    });

    it('应该在规则不存在时返回 undefined', async () => {
      await engine.loadRules();

      const rule = engine.getRuleById('NON_EXISTENT_RULE');
      expect(rule).toBeUndefined();
    });
  });

  describe('setRuleEnabled', () => {
    it('应该启用/禁用规则', async () => {
      const customRules: Rule[] = [
        {
          id: 'TEST_RULE',
          priority: 'MEDIUM',
          mode: 'ONE_TAP',
          enabled: true,
          conditions: [],
          actions: [],
        },
      ];

      await engine.loadRules(customRules);

      // 禁用规则
      engine.setRuleEnabled('TEST_RULE', false);
      let rule = engine.getRuleById('TEST_RULE');
      expect(rule?.enabled).toBe(false);

      // 启用规则
      engine.setRuleEnabled('TEST_RULE', true);
      rule = engine.getRuleById('TEST_RULE');
      expect(rule?.enabled).toBe(true);
    });

    it('应该在规则不存在时不做任何事', async () => {
      await engine.loadRules();

      expect(() => {
        engine.setRuleEnabled('NON_EXISTENT_RULE', true);
      }).not.toThrow();
    });
  });

  describe('priorityValue', () => {
    it('应该正确映射优先级到数值', () => {
      const highValue = engine['priorityValue']('HIGH');
      const mediumValue = engine['priorityValue']('MEDIUM');
      const lowValue = engine['priorityValue']('LOW');

      expect(highValue).toBe(3);
      expect(mediumValue).toBe(2);
      expect(lowValue).toBe(1);
    });
  });
});
