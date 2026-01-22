import { SilentContext, SceneType } from '../types';
import { ruleCache, SceneCacheKeyBuilder } from '../utils/cacheManager';

// 规则引擎专用类型（简化版本，不包含 battery/screen 等扩展类型）
export type RulePriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type RuleMode = 'SUGGEST_ONLY' | 'ONE_TAP' | 'AUTO';
export type ConditionType = 'time' | 'location' | 'motion' | 'wifi' | 'app_usage' | 'calendar';
export type ActionTarget = 'system' | 'app' | 'notification';

export interface Condition {
  type: ConditionType;
  value: string;
  weight: number;
}

export interface Action {
  target: ActionTarget;
  action: string;
  intent?: string;
  deepLink?: string;
  params?: Record<string, any>;
}

export interface Rule {
  id: string;
  priority: RulePriority;
  mode: RuleMode;
  enabled: boolean;
  conditions: Condition[];
  actions: Action[];
}

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

    // 尝试从 YAML 规则文件加载，失败时回退硬编码规则
    const loaded = this.loadBuiltInRulesFromYaml();
    if (loaded.length > 0) {
      this.rules = loaded;
      return;
    }

    this.rules = this.getFallbackRules();
  }

  /**
   * 加载内置规则
   * Metro bundler 不支持动态 require，需要静态导入
   * 使用 .js 文件而不是 .yaml 文件
   */
  private loadBuiltInRulesFromYaml(): Rule[] {
    const allRules: Rule[] = [];

    // 静态导入规则文件（Metro 要求）
    const ruleImports = [
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      () => require('./commute.rule.js'),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      () => require('./meeting.rule.js'),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      () => require('./study.rule.js'),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      () => require('./home.rule.js'),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      () => require('./office.rule.js'),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      () => require('./sleep.rule.js'),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      () => require('./travel.rule.js'),
    ];

    const ruleFileNames = ['commute.rule.js', 'meeting.rule.js', 'study.rule.js', 'home.rule.js', 'office.rule.js', 'sleep.rule.js', 'travel.rule.js'];

    for (let i = 0; i < ruleImports.length; i++) {
      const ruleFile = ruleFileNames[i];
      try {
        const importRule = ruleImports[i];
        const rules = importRule();

        if (Array.isArray(rules)) {
          allRules.push(...rules);
          console.log(`[RuleEngine] Loaded ${ruleFile}: ${rules.length} rule(s)`);
        }
      } catch (error) {
        console.warn(`[RuleEngine] Failed to load ${ruleFile}, skipping`, error);
      }
    }

    return allRules;
  }

  /**
   * 硬编码兜底规则
   */
  private getFallbackRules(): Rule[] {
    return [
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
   * 使用缓存优化性能
   */
  async matchRules(context: SilentContext): Promise<MatchedRule[]> {
    // 生成缓存键
    const contextKey = `${context.context}_${context.confidence.toFixed(2)}_${context.signals.map(s => s.type).sort().join(',')}`;
    const cacheKey = SceneCacheKeyBuilder.buildRulesKey(contextKey);

    // 尝试从缓存获取
    const cached = ruleCache.get<MatchedRule[]>(cacheKey);
    if (cached) {
      console.log('[RuleEngine] Cache hit for matched rules');
      return cached;
    }

    const matched: MatchedRule[] = [];

    // 添加调试日志
    console.log(`[RuleEngine] Matching rules for context: ${context.context}, confidence: ${context.confidence.toFixed(2)}`);
    console.log(`[RuleEngine] Available signals:`, context.signals.map(s => `${s.type}=${s.value}`));

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const score = this.calculateRuleScore(rule, context);

      console.log(`[RuleEngine] Rule ${rule.id} score: ${score.toFixed(2)}`);

      if (score > 0.4) {
        // 降低阈值从 0.5 到 0.4，允许更多部分匹配
        matched.push({
          rule,
          score,
          explanation: this.explainMatch(rule, context),
        });
      }
    }

    console.log(`[RuleEngine] Matched ${matched.length} rule(s)`);

    // 按优先级和得分排序
    const result = matched.sort((a, b) => {
      if (a.rule.priority !== b.rule.priority) {
        return this.priorityValue(b.rule.priority) - this.priorityValue(a.rule.priority);
      }
      return b.score - a.score;
    });

    // 缓存结果
    ruleCache.set(cacheKey, result);

    return result;
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
   * 支持精确匹配和智能模糊匹配
   */
  private checkCondition(condition: Condition, context: SilentContext): boolean {
    // 查找匹配的信号
    const signal = context.signals.find(
      (s) => s.type.toLowerCase() === condition.type.toLowerCase()
    );

    if (!signal) return false;

    // 精确匹配
    if (signal.value === condition.value) {
      return true;
    }

    // 时间信号的特殊处理：支持前缀匹配
    if (condition.type === 'time') {
      const signalPeriod = signal.value.split('_')[0]; // 提取时间段部分
      const conditionPeriod = condition.value.split('_')[0];

      // 如果时间段相同，就认为匹配（不管是否 WEEKDAY/WEEKEND）
      if (signalPeriod === conditionPeriod) {
        console.log(`[RuleEngine] Time prefix match: ${signal.value} matches ${condition.value}`);
        return true;
      }
    }

    // 位置信号的特殊处理：UNKNOWN 位置不影响规则匹配
    if (condition.type === 'location' && signal.value === 'UNKNOWN') {
      console.log(`[RuleEngine] Unknown location, skipping location condition`);
      return false; // 位置条件不满足，但不影响其他条件
    }

    return false;
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

// 导出单例实例
export const ruleEngine = new RuleEngine();

// 默认导出类
export default RuleEngine;
