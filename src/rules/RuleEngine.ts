import { SilentContext, SceneType } from '../types';

/**
 * 规则优先级
 */
export type RulePriority = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * 规则模式
 */
export type RuleMode = 'SUGGEST_ONLY' | 'ONE_TAP' | 'AUTO';

/**
 * 条件类型
 */
export type ConditionType = 'time' | 'location' | 'motion' | 'wifi' | 'app_usage' | 'calendar';

/**
 * 动作目标
 */
export type ActionTarget = 'system' | 'app' | 'notification';

/**
 * 规则条件
 */
export interface Condition {
  type: ConditionType;
  value: string;
  weight: number;
}

/**
 * 规则动作
 */
export interface Action {
  target: ActionTarget;
  action: string;
  intent?: string;
  deepLink?: string;
  params?: Record<string, any>;
}

/**
 * 规则定义
 */
export interface Rule {
  id: string;
  priority: RulePriority;
  mode: RuleMode;
  enabled: boolean;
  conditions: Condition[];
  actions: Action[];
}

/**
 * 匹配的规则
 */
export interface MatchedRule {
  rule: Rule;
  score: number;
  explanation: string;
}

/**
 * 规则引擎
 * 负责加载、匹配和评分规则
 */
export class RuleEngine {
  private rules: Rule[] = [];

  /**
   * 加载规则
   * 从 YAML 文件或对象加载规则
   */
  async loadRules(ruleData?: Rule[]): Promise<void> {
    if (ruleData) {
      this.rules = ruleData;
      return;
    }

    // 默认加载内置规则
    // 在实际应用中，这里会从 assets 或远程加载 YAML 文件
    // 目前使用硬编码的规则作为示例
    this.rules = [
      {
        id: 'RULE_COMMUTE',
        priority: 'HIGH',
        mode: 'ONE_TAP',
        enabled: true,
        conditions: [
          { type: 'time', value: 'MORNING_RUSH', weight: 0.6 },
          { type: 'time', value: 'EVENING_RUSH', weight: 0.6 },
          { type: 'location', value: 'SUBWAY_STATION', weight: 0.8 },
          { type: 'motion', value: 'WALKING', weight: 0.4 },
          { type: 'motion', value: 'VEHICLE', weight: 0.5 },
          { type: 'app_usage', value: 'TRANSIT_APP_TOP1', weight: 0.5 },
        ],
        actions: [
          {
            target: 'system',
            action: 'setDoNotDisturb',
            params: {
              enable: true,
              allowCalls: true,
              whitelist: ['emergency_contacts'],
            },
          },
          {
            target: 'app',
            intent: 'TRANSIT_APP_TOP1',
            action: 'open_ticket_qr',
            deepLink: 'alipays://platformapi/startapp?appId=200011235',
          },
          {
            target: 'app',
            intent: 'MUSIC_PLAYER_TOP1',
            action: 'launch_with_playlist',
            params: {
              playlist: 'commute',
            },
          },
          {
            target: 'notification',
            action: 'suggest',
            params: {
              title: '通勤模式已准备',
              body: '一键打开乘车码和音乐',
              mode: 'ONE_TAP',
            },
          },
        ],
      },
    ];
  }

  /**
   * 匹配规则
   * 根据当前场景上下文匹配适用的规则
   */
  async matchRules(context: SilentContext): Promise<MatchedRule[]> {
    const matched: MatchedRule[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const score = this.calculateRuleScore(rule, context);

      if (score > 0.5) {
        // 阈值 - lowered from 0.6 to 0.5 to allow partial matches
        matched.push({
          rule,
          score,
          explanation: this.explainMatch(rule, context),
        });
      }
    }

    // 按优先级和得分排序
    return matched.sort((a, b) => {
      if (a.rule.priority !== b.rule.priority) {
        return this.priorityValue(b.rule.priority) - this.priorityValue(a.rule.priority);
      }
      return b.score - a.score;
    });
  }

  /**
   * 计算规则得分
   * 根据条件匹配情况计算规则的总得分
   */
  calculateRuleScore(rule: Rule, context: SilentContext): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const condition of rule.conditions) {
      const satisfied = this.checkCondition(condition, context);
      if (satisfied) {
        totalScore += condition.weight;
      }
      totalWeight += condition.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * 检查条件是否满足
   */
  private checkCondition(condition: Condition, context: SilentContext): boolean {
    // 查找匹配的信号
    const signal = context.signals.find(
      (s) => s.type.toLowerCase() === condition.type.toLowerCase()
    );

    if (!signal) return false;

    // 检查值是否匹配
    return signal.value === condition.value;
  }

  /**
   * 解释匹配结果
   * 生成人类可读的匹配说明
   */
  private explainMatch(rule: Rule, context: SilentContext): string {
    const matchedConditions: string[] = [];

    for (const condition of rule.conditions) {
      if (this.checkCondition(condition, context)) {
        matchedConditions.push(`${condition.type}=${condition.value}`);
      }
    }

    return `匹配条件: ${matchedConditions.join(', ')}`;
  }

  /**
   * 获取优先级数值
   */
  private priorityValue(priority: RulePriority): number {
    const values = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
    };
    return values[priority];
  }

  /**
   * 获取所有规则
   */
  getRules(): Rule[] {
    return this.rules;
  }

  /**
   * 根据 ID 获取规则
   */
  getRuleById(id: string): Rule | undefined {
    return this.rules.find((r) => r.id === id);
  }

  /**
   * 启用/禁用规则
   */
  setRuleEnabled(id: string, enabled: boolean): void {
    const rule = this.getRuleById(id);
    if (rule) {
      rule.enabled = enabled;
    }
  }
}
