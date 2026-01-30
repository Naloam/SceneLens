/**
 * RuleBuilder 单元测试
 * 
 * 测试规则构建器的各项功能：
 * - 条件添加（when/and/or）
 * - 动作添加（then）
 * - 优先级和冷却时间设置
 * - 规则验证
 * - 规则构建
 */

import { RuleBuilder, ConditionInput, ActionInput } from '../../../rules/engine/RuleBuilder';
import type { AutomationRule } from '../../../types/automation';

describe('RuleBuilder', () => {
  let builder: RuleBuilder;

  beforeEach(() => {
    builder = new RuleBuilder();
  });

  describe('基础规则构建', () => {
    it('应该创建一个空规则', () => {
      const rule = builder.build();
      
      expect(rule).toBeDefined();
      expect(rule.id).toBeDefined();
      expect(rule.conditions).toEqual([]);
      expect(rule.actions).toEqual([]);
      expect(rule.enabled).toBe(true);
      expect(rule.conditionLogic).toBe('AND');
    });

    it('应该正确设置规则名称', () => {
      const rule = builder.name('测试规则').build();
      
      expect(rule.name).toBe('测试规则');
    });

    it('应该正确设置规则描述', () => {
      const rule = builder.description('这是一个测试规则').build();
      
      expect(rule.description).toBe('这是一个测试规则');
    });
  });

  describe('条件管理', () => {
    it('应该添加场景条件', () => {
      const condition: ConditionInput = {
        type: 'scene',
        operator: 'equals',
        value: 'OFFICE',
      };
      
      const rule = builder.when(condition).build();
      
      expect(rule.conditions).toHaveLength(1);
      expect(rule.conditions[0].type).toBe('scene');
      expect(rule.conditions[0].operator).toBe('equals');
      expect(rule.conditions[0].value).toBe('OFFICE');
    });

    it('应该添加时间条件', () => {
      const condition: ConditionInput = {
        type: 'time',
        operator: 'between',
        value: ['09:00', '18:00'],
      };
      
      const rule = builder.when(condition).build();
      
      expect(rule.conditions).toHaveLength(1);
      expect(rule.conditions[0].type).toBe('time');
      expect(rule.conditions[0].value).toEqual(['09:00', '18:00']);
    });

    it('应该使用 AND 逻辑连接多个条件', () => {
      const rule = builder
        .when({ type: 'scene', operator: 'equals', value: 'OFFICE' })
        .and({ type: 'time', operator: 'between', value: ['09:00', '18:00'] })
        .build();
      
      expect(rule.conditions).toHaveLength(2);
      expect(rule.conditionLogic).toBe('AND');
    });

    it('应该使用 OR 逻辑切换', () => {
      const rule = builder
        .when({ type: 'scene', operator: 'equals', value: 'OFFICE' })
        .or({ type: 'scene', operator: 'equals', value: 'HOME' })
        .build();
      
      expect(rule.conditions).toHaveLength(2);
      expect(rule.conditionLogic).toBe('OR');
    });
  });

  describe('动作管理', () => {
    it('应该添加系统设置动作', () => {
      const action: ActionInput = {
        type: 'system_setting',
        params: { doNotDisturb: 'priority', volume: { notification: 30 } },
      };
      
      const rule = builder.then(action).build();
      
      expect(rule.actions).toHaveLength(1);
      expect(rule.actions[0].type).toBe('system_setting');
      expect(rule.actions[0].params.doNotDisturb).toBe('priority');
    });

    it('应该添加应用启动动作', () => {
      const action: ActionInput = {
        type: 'app_launch',
        params: { packageName: 'com.tencent.mm' },
        description: '打开微信',
      };
      
      const rule = builder.then(action).build();
      
      expect(rule.actions).toHaveLength(1);
      expect(rule.actions[0].type).toBe('app_launch');
      expect(rule.actions[0].params.packageName).toBe('com.tencent.mm');
    });

    it('应该添加多个动作', () => {
      const rule = builder
        .then({ type: 'system_setting', params: { doNotDisturb: true } })
        .then({ type: 'app_launch', params: { packageName: 'com.example.app' } })
        .build();
      
      expect(rule.actions).toHaveLength(2);
    });
  });

  describe('规则配置', () => {
    it('应该设置优先级', () => {
      const rule = builder.withPriority(10).build();
      
      expect(rule.priority).toBe(10);
    });

    it('应该限制优先级范围 (1-10)', () => {
      const ruleLow = builder.withPriority(0).build();
      const ruleHigh = new RuleBuilder().withPriority(15).build();
      
      expect(ruleLow.priority).toBe(1);
      expect(ruleHigh.priority).toBe(10);
    });

    it('应该设置冷却时间', () => {
      const rule = builder.withCooldown(30).build();
      
      expect(rule.cooldown).toBe(30);
    });

    it('应该设置启用状态', () => {
      const rule = builder.enabled(false).build();
      
      expect(rule.enabled).toBe(false);
    });
  });

  describe('完整规则构建', () => {
    it('应该构建完整的工作模式规则', () => {
      const rule = builder
        .name('工作模式')
        .description('到达办公室后自动开启勿扰模式')
        .when({ type: 'scene', operator: 'equals', value: 'OFFICE' })
        .and({ type: 'time', operator: 'between', value: ['09:00', '18:00'] })
        .then({ type: 'system_setting', params: { doNotDisturb: 'priority' } })
        .then({ type: 'app_launch', params: { packageName: 'com.dingtalk' } })
        .withPriority(8)
        .withCooldown(60)
        .build();
      
      expect(rule.name).toBe('工作模式');
      expect(rule.conditions).toHaveLength(2);
      expect(rule.actions).toHaveLength(2);
      expect(rule.priority).toBe(8);
      expect(rule.cooldown).toBe(60);
      expect(rule.createdAt).toBeDefined();
    });

    it('应该构建睡眠模式规则', () => {
      const rule = builder
        .name('睡眠模式')
        .when({ type: 'scene', operator: 'equals', value: 'HOME' })
        .and({ type: 'time', operator: 'greater', value: '23:00' })
        .then({ 
          type: 'system_setting', 
          params: { doNotDisturb: true, brightness: 10 } 
        })
        .build();
      
      expect(rule.name).toBe('睡眠模式');
      expect(rule.conditions).toHaveLength(2);
      expect(rule.actions[0].params.doNotDisturb).toBe(true);
      expect(rule.actions[0].params.brightness).toBe(10);
    });
  });

  describe('链式调用', () => {
    it('应该支持链式调用', () => {
      const result = builder
        .name('测试')
        .when({ type: 'scene', operator: 'equals', value: 'HOME' })
        .and({ type: 'time', operator: 'equals', value: '08:00' })
        .then({ type: 'notification', params: { message: '早安' } })
        .withPriority(5)
        .withCooldown(10);
      
      expect(result).toBeInstanceOf(RuleBuilder);
    });
  });

  describe('规则重置', () => {
    it('应该重置规则构建器状态', () => {
      builder
        .name('旧规则')
        .when({ type: 'scene', operator: 'equals', value: 'OFFICE' })
        .build();
      
      builder.reset();
      const newRule = builder.name('新规则').build();
      
      expect(newRule.name).toBe('新规则');
      expect(newRule.conditions).toHaveLength(0);
    });
  });
});
