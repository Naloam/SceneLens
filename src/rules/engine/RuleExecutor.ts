/**
 * RuleExecutor - 规则执行器
 * 
 * 负责评估规则条件并执行相应动作
 * 
 * @module rules/engine
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SceneType, SilentContext } from '../../types';
import type {
  AutomationRule,
  AutomationCondition,
  AutomationAction,
  RuleExecutionResult,
} from '../../types/automation';
import { SystemSettingsController } from '../../automation/SystemSettingsController';
import { AppLaunchController } from '../../automation/AppLaunchController';

// ==================== 存储键 ====================

const STORAGE_KEYS = {
  RULE_TRIGGER_HISTORY: 'rule_trigger_history',
  RULES_STORE: 'automation_rules',
};

// ==================== 类型定义 ====================

/**
 * 规则触发历史
 */
interface RuleTriggerHistory {
  ruleId: string;
  lastTriggered: number;
  triggerCount: number;
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  sceneType: SceneType;
  timestamp: number;
  location?: { latitude: number; longitude: number };
  batteryLevel?: number;
  isCharging?: boolean;
  wifiSSID?: string;
  motionState?: string;
  foregroundApp?: string;
  signals?: Array<{ type: string; value: unknown }>;
}

// ==================== RuleExecutor 类 ====================

export class RuleExecutor {
  private rules: AutomationRule[] = [];
  private triggerHistory: Map<string, RuleTriggerHistory> = new Map();
  private initialized: boolean = false;

  /**
   * 初始化执行器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadRules();
      await this.loadTriggerHistory();
      this.initialized = true;
      console.log('[RuleExecutor] Initialized with', this.rules.length, 'rules');
    } catch (error) {
      console.error('[RuleExecutor] Failed to initialize:', error);
    }
  }

  /**
   * 加载规则
   */
  private async loadRules(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.RULES_STORE);
      if (stored) {
        this.rules = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[RuleExecutor] Failed to load rules:', error);
      this.rules = [];
    }
  }

  /**
   * 保存规则
   */
  private async saveRules(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RULES_STORE, JSON.stringify(this.rules));
    } catch (error) {
      console.error('[RuleExecutor] Failed to save rules:', error);
    }
  }

  /**
   * 加载触发历史
   */
  private async loadTriggerHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.RULE_TRIGGER_HISTORY);
      if (stored) {
        const history: RuleTriggerHistory[] = JSON.parse(stored);
        this.triggerHistory = new Map(history.map(h => [h.ruleId, h]));
      }
    } catch (error) {
      console.error('[RuleExecutor] Failed to load trigger history:', error);
    }
  }

  /**
   * 保存触发历史
   */
  private async saveTriggerHistory(): Promise<void> {
    try {
      const history = Array.from(this.triggerHistory.values());
      await AsyncStorage.setItem(STORAGE_KEYS.RULE_TRIGGER_HISTORY, JSON.stringify(history));
    } catch (error) {
      console.error('[RuleExecutor] Failed to save trigger history:', error);
    }
  }

  // ==================== 规则管理 ====================

  /**
   * 添加规则
   */
  async addRule(rule: AutomationRule): Promise<void> {
    await this.initialize();
    
    // 检查是否已存在
    const index = this.rules.findIndex(r => r.id === rule.id);
    if (index >= 0) {
      this.rules[index] = rule;
    } else {
      this.rules.push(rule);
    }
    
    await this.saveRules();
    console.log('[RuleExecutor] Added rule:', rule.name);
  }

  /**
   * 移除规则
   */
  async removeRule(ruleId: string): Promise<boolean> {
    await this.initialize();
    
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      await this.saveRules();
      console.log('[RuleExecutor] Removed rule:', ruleId);
      return true;
    }
    return false;
  }

  /**
   * 更新规则
   */
  async updateRule(rule: AutomationRule): Promise<boolean> {
    await this.initialize();
    
    const index = this.rules.findIndex(r => r.id === rule.id);
    if (index >= 0) {
      rule.updatedAt = Date.now();
      this.rules[index] = rule;
      await this.saveRules();
      console.log('[RuleExecutor] Updated rule:', rule.name);
      return true;
    }
    return false;
  }

  /**
   * 获取所有规则
   */
  async getRules(): Promise<AutomationRule[]> {
    await this.initialize();
    return [...this.rules];
  }

  /**
   * 根据 ID 获取规则
   */
  async getRule(ruleId: string): Promise<AutomationRule | null> {
    await this.initialize();
    return this.rules.find(r => r.id === ruleId) || null;
  }

  /**
   * 启用/禁用规则
   */
  async setRuleEnabled(ruleId: string, enabled: boolean): Promise<boolean> {
    await this.initialize();
    
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      rule.updatedAt = Date.now();
      await this.saveRules();
      return true;
    }
    return false;
  }

  // ==================== 规则评估 ====================

  /**
   * 评估所有规则
   * @param context 执行上下文
   * @returns 匹配的规则列表（按优先级排序）
   */
  async evaluateRules(context: ExecutionContext): Promise<AutomationRule[]> {
    await this.initialize();

    const now = Date.now();
    const matchedRules: AutomationRule[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // 检查冷却时间
      if (!this.checkCooldown(rule, now)) {
        console.log(`[RuleExecutor] Rule ${rule.name} is in cooldown`);
        continue;
      }

      // 评估条件
      const conditionsMet = this.evaluateConditions(rule, context);
      if (conditionsMet) {
        matchedRules.push(rule);
      }
    }

    // 按优先级排序
    matchedRules.sort((a, b) => b.priority - a.priority);

    console.log(`[RuleExecutor] Evaluated ${this.rules.length} rules, ${matchedRules.length} matched`);
    return matchedRules;
  }

  /**
   * 检查规则冷却时间
   */
  private checkCooldown(rule: AutomationRule, now: number): boolean {
    if (rule.cooldown <= 0) return true;

    const history = this.triggerHistory.get(rule.id);
    if (!history) return true;

    const cooldownMs = rule.cooldown * 60 * 1000;
    return (now - history.lastTriggered) >= cooldownMs;
  }

  /**
   * 评估规则条件
   */
  private evaluateConditions(rule: AutomationRule, context: ExecutionContext): boolean {
    const results = rule.conditions.map(condition => 
      this.evaluateCondition(condition, context)
    );

    if (rule.conditionLogic === 'AND') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  /**
   * 评估单个条件
   */
  private evaluateCondition(condition: AutomationCondition, context: ExecutionContext): boolean {
    try {
      const value = this.getContextValue(condition.type, condition.field, context);
      return this.compareValues(value, condition.operator, condition.value);
    } catch (error) {
      console.warn('[RuleExecutor] Condition evaluation failed:', error);
      return false;
    }
  }

  /**
   * 从上下文获取值
   */
  private getContextValue(
    type: string, 
    field: string | undefined, 
    context: ExecutionContext
  ): unknown {
    switch (type) {
      case 'scene':
        return context.sceneType;
      
      case 'time':
        if (field === 'dayOfWeek') {
          return new Date(context.timestamp).getDay();
        }
        // 返回当前时间的 HH:mm 格式
        const date = new Date(context.timestamp);
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      
      case 'battery':
        if (field === 'isCharging') {
          return context.isCharging;
        }
        return context.batteryLevel;
      
      case 'network':
        if (field === 'wifiSSID') {
          return context.wifiSSID;
        }
        return null;
      
      case 'motion':
        return context.motionState;
      
      case 'app':
        if (field === 'foreground') {
          return context.foregroundApp;
        }
        return null;
      
      case 'location':
        return context.location;
      
      default:
        return null;
    }
  }

  /**
   * 比较值
   */
  private compareValues(actual: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      
      case 'not_equals':
        return actual !== expected;
      
      case 'contains':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.includes(expected);
        }
        return false;
      
      case 'greater':
        if (typeof actual === 'string' && typeof expected === 'string') {
          // 时间比较
          return actual > expected;
        }
        return Number(actual) > Number(expected);
      
      case 'less':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual < expected;
        }
        return Number(actual) < Number(expected);
      
      case 'between':
        if (Array.isArray(expected) && expected.length === 2) {
          const [min, max] = expected;
          if (typeof actual === 'string') {
            return actual >= min && actual <= max;
          }
          return Number(actual) >= Number(min) && Number(actual) <= Number(max);
        }
        return false;
      
      case 'in':
        if (Array.isArray(expected)) {
          return expected.includes(actual);
        }
        return false;
      
      case 'not_in':
        if (Array.isArray(expected)) {
          return !expected.includes(actual);
        }
        return true;
      
      default:
        return false;
    }
  }

  // ==================== 规则执行 ====================

  /**
   * 执行规则
   * @param rule 要执行的规则
   * @param context 执行上下文
   */
  async executeRule(rule: AutomationRule, context: ExecutionContext): Promise<RuleExecutionResult> {
    const startTime = Date.now();
    const result: RuleExecutionResult = {
      ruleId: rule.id,
      success: true,
      executedActions: [],
      timestamp: startTime,
    };

    console.log(`[RuleExecutor] Executing rule: ${rule.name}`);

    for (const action of rule.actions) {
      const actionStart = Date.now();
      try {
        await this.executeAction(action);
        result.executedActions.push({
          action,
          success: true,
          duration: Date.now() - actionStart,
        });
      } catch (error) {
        result.executedActions.push({
          action,
          success: false,
          error: String(error),
          duration: Date.now() - actionStart,
        });
        result.success = false;
        console.error(`[RuleExecutor] Action failed:`, error);
      }
    }

    // 更新触发历史
    this.updateTriggerHistory(rule.id);

    console.log(`[RuleExecutor] Rule execution completed: ${result.success}`);
    return result;
  }

  /**
   * 执行单个动作
   */
  private async executeAction(action: AutomationAction): Promise<void> {
    switch (action.type) {
      case 'system_setting':
        await this.executeSystemSettingAction(action.params);
        break;
      
      case 'app_launch':
        await this.executeAppLaunchAction(action.params);
        break;
      
      case 'notification':
        await this.executeNotificationAction(action.params);
        break;
      
      case 'quick_action':
        await this.executeQuickAction(action.params);
        break;
      
      default:
        console.warn(`[RuleExecutor] Unknown action type: ${action.type}`);
    }
  }

  /**
   * 执行系统设置动作
   */
  private async executeSystemSettingAction(params: Record<string, unknown>): Promise<void> {
    const settingsMap: Record<string, (value: unknown) => Promise<boolean>> = {
      doNotDisturb: async (value) => {
        if (typeof value === 'boolean') {
          return SystemSettingsController.setDoNotDisturb(value);
        } else if (typeof value === 'string') {
          return SystemSettingsController.setDoNotDisturb(true, value as 'priority' | 'alarms' | 'none');
        }
        return false;
      },
      brightness: async (value) => {
        if (typeof value === 'number') {
          return SystemSettingsController.setBrightness(value);
        }
        return false;
      },
      volume: async (value) => {
        if (typeof value === 'object' && value !== null) {
          return SystemSettingsController.setVolumes(value as Record<string, number>);
        }
        return false;
      },
      wifi: async (value) => {
        if (typeof value === 'boolean') {
          const result = await SystemSettingsController.setWiFi(value);
          return result.success;
        }
        return false;
      },
      bluetooth: async (value) => {
        if (typeof value === 'boolean') {
          const result = await SystemSettingsController.setBluetooth(value);
          return result.success;
        }
        return false;
      },
      screenTimeout: async (value) => {
        if (typeof value === 'number') {
          return SystemSettingsController.setScreenTimeout(value);
        }
        return false;
      },
    };

    for (const [key, value] of Object.entries(params)) {
      const handler = settingsMap[key];
      if (handler) {
        const success = await handler(value);
        console.log(`[RuleExecutor] System setting ${key}: ${success ? 'success' : 'failed'}`);
      }
    }
  }

  /**
   * 执行应用启动动作
   */
  private async executeAppLaunchAction(params: Record<string, unknown>): Promise<void> {
    const { packageName, deepLink } = params as { packageName?: string; deepLink?: string };
    
    if (!packageName) {
      throw new Error('Package name is required for app launch action');
    }

    let success: boolean;
    if (deepLink) {
      success = await AppLaunchController.launchAppWithDeepLink(packageName, deepLink);
    } else {
      success = await AppLaunchController.launchApp(packageName);
    }

    if (!success) {
      throw new Error(`Failed to launch app: ${packageName}`);
    }
  }

  /**
   * 执行通知动作
   */
  private async executeNotificationAction(params: Record<string, unknown>): Promise<void> {
    const { title, body } = params as { title?: string; body?: string };
    
    if (!title || !body) {
      throw new Error('Title and body are required for notification action');
    }

    // TODO: 集成 NotificationManager
    console.log(`[RuleExecutor] Would send notification: ${title} - ${body}`);
  }

  /**
   * 执行快捷操作动作
   */
  private async executeQuickAction(params: Record<string, unknown>): Promise<void> {
    const { actionId } = params as { actionId?: string };
    
    if (!actionId) {
      throw new Error('Action ID is required for quick action');
    }

    // TODO: 集成 QuickActionManager
    console.log(`[RuleExecutor] Would execute quick action: ${actionId}`);
  }

  /**
   * 更新触发历史
   */
  private updateTriggerHistory(ruleId: string): void {
    const history = this.triggerHistory.get(ruleId) || {
      ruleId,
      lastTriggered: 0,
      triggerCount: 0,
    };

    history.lastTriggered = Date.now();
    history.triggerCount++;
    
    this.triggerHistory.set(ruleId, history);
    this.saveTriggerHistory();

    // 同时更新规则本身
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.lastTriggered = history.lastTriggered;
      rule.triggerCount = history.triggerCount;
      this.saveRules();
    }
  }

  // ==================== 便捷方法 ====================

  /**
   * 评估并执行所有匹配的规则
   */
  async evaluateAndExecute(context: ExecutionContext): Promise<RuleExecutionResult[]> {
    const matchedRules = await this.evaluateRules(context);
    const results: RuleExecutionResult[] = [];

    for (const rule of matchedRules) {
      const result = await this.executeRule(rule, context);
      results.push(result);
    }

    return results;
  }

  /**
   * 从 SilentContext 创建 ExecutionContext
   */
  static createContextFromSilent(silentContext: SilentContext): ExecutionContext {
    const context: ExecutionContext = {
      sceneType: silentContext.context,
      timestamp: silentContext.timestamp,
    };

    // 从信号中提取更多信息
    for (const signal of silentContext.signals) {
      switch (signal.type) {
        case 'MOTION':
          context.motionState = signal.value;
          break;
        case 'WIFI':
          context.wifiSSID = signal.value;
          break;
        case 'BATTERY':
          // 解析电池信息
          break;
        case 'FOREGROUND_APP':
          context.foregroundApp = signal.value;
          break;
      }
    }

    return context;
  }
}

// ==================== 单例导出 ====================

export const ruleExecutor = new RuleExecutor();

export default ruleExecutor;
