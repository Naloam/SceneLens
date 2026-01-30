/**
 * RuleBuilder - 自动化规则构建器
 * 
 * 提供流畅的 API 来构建 IF-THEN 规则
 * 
 * @example
 * ```typescript
 * const rule = new RuleBuilder()
 *   .name('工作模式')
 *   .when({ type: 'scene', operator: 'equals', value: 'OFFICE' })
 *   .and({ type: 'time', operator: 'between', value: ['09:00', '18:00'] })
 *   .then({ type: 'system_setting', params: { doNotDisturb: 'priority' } })
 *   .then({ type: 'app_launch', params: { packageName: 'com.dingtalk' } })
 *   .withCooldown(30)
 *   .withPriority(8)
 *   .build();
 * ```
 * 
 * @module rules/engine
 */

import type {
  AutomationRule,
  AutomationCondition,
  AutomationAction,
  AutomationConditionType,
  ConditionOperator,
  AutomationActionType,
} from '../../types/automation';

// ==================== 辅助类型 ====================

/**
 * 条件构建辅助
 */
export interface ConditionInput {
  type: AutomationConditionType;
  operator: ConditionOperator;
  value: unknown;
  field?: string;
}

/**
 * 动作构建辅助
 */
export interface ActionInput {
  type: AutomationActionType;
  params: Record<string, unknown>;
  description?: string;
}

// ==================== RuleBuilder 类 ====================

export class RuleBuilder {
  private rule: Partial<AutomationRule> = {
    enabled: true,
    conditions: [],
    actions: [],
    conditionLogic: 'AND',
    priority: 5,
    cooldown: 0,
  };

  /**
   * 构造函数
   * @param id 可选的规则 ID
   */
  constructor(id?: string) {
    if (id) {
      (this.rule as any).id = id;
    }
  }

  /**
   * 设置规则名称 (别名方法，兼容模板)
   */
  setName(name: string): RuleBuilder {
    this.rule.name = name;
    return this;
  }

  /**
   * 设置规则名称
   */
  name(name: string): RuleBuilder {
    this.rule.name = name;
    return this;
  }

  /**
   * 设置规则描述 (别名方法，兼容模板)
   */
  setDescription(description: string): RuleBuilder {
    this.rule.description = description;
    return this;
  }

  /**
   * 设置规则描述
   */
  description(description: string): RuleBuilder {
    this.rule.description = description;
    return this;
  }

  /**
   * 设置优先级 (别名方法，兼容模板)
   */
  setPriority(priority: number): RuleBuilder {
    this.rule.priority = Math.max(1, Math.min(10, priority));
    return this;
  }

  /**
   * 设置冷却时间 (别名方法，兼容模板)
   */
  setCooldown(minutes: number): RuleBuilder {
    this.rule.cooldown = minutes;
    return this;
  }

  /**
   * 添加条件（第一个条件）
   */
  when(condition: ConditionInput): RuleBuilder {
    this.rule.conditions = [this.normalizeCondition(condition)];
    return this;
  }

  /**
   * 添加 AND 条件
   */
  and(condition: ConditionInput): RuleBuilder {
    this.rule.conditions!.push(this.normalizeCondition(condition));
    this.rule.conditionLogic = 'AND';
    return this;
  }

  /**
   * 添加 OR 条件
   */
  or(condition: ConditionInput): RuleBuilder {
    this.rule.conditions!.push(this.normalizeCondition(condition));
    this.rule.conditionLogic = 'OR';
    return this;
  }

  /**
   * 添加动作
   */
  then(action: ActionInput): RuleBuilder {
    this.rule.actions!.push(this.normalizeAction(action));
    return this;
  }

  /**
   * 设置冷却时间（分钟）
   */
  withCooldown(minutes: number): RuleBuilder {
    this.rule.cooldown = minutes;
    return this;
  }

  /**
   * 设置优先级 (1-10)
   */
  withPriority(priority: number): RuleBuilder {
    this.rule.priority = Math.max(1, Math.min(10, priority));
    return this;
  }

  /**
   * 设置是否启用
   */
  enabled(enabled: boolean): RuleBuilder {
    this.rule.enabled = enabled;
    return this;
  }

  /**
   * 构建规则
   */
  build(): AutomationRule {
    if (!this.rule.name) {
      throw new Error('Rule name is required');
    }
    if (!this.rule.conditions || this.rule.conditions.length === 0) {
      throw new Error('At least one condition is required');
    }
    if (!this.rule.actions || this.rule.actions.length === 0) {
      throw new Error('At least one action is required');
    }

    return {
      id: this.generateId(),
      name: this.rule.name,
      description: this.rule.description,
      enabled: this.rule.enabled!,
      conditions: this.rule.conditions,
      actions: this.rule.actions,
      conditionLogic: this.rule.conditionLogic!,
      priority: this.rule.priority!,
      cooldown: this.rule.cooldown!,
      createdAt: Date.now(),
    };
  }

  /**
   * 从现有规则创建 Builder
   */
  static from(rule: AutomationRule): RuleBuilder {
    const builder = new RuleBuilder();
    builder.rule = { ...rule };
    return builder;
  }

  // ==================== 私有方法 ====================

  private generateId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private normalizeCondition(input: ConditionInput): AutomationCondition {
    return {
      type: input.type,
      operator: input.operator,
      value: input.value,
      field: input.field,
    };
  }

  private normalizeAction(input: ActionInput): AutomationAction {
    return {
      type: input.type,
      params: input.params,
      description: input.description,
    };
  }
}

// ==================== 条件构建辅助函数 ====================

/**
 * 创建场景条件
 */
export function sceneIs(sceneType: string): ConditionInput {
  return {
    type: 'scene',
    operator: 'equals',
    value: sceneType,
  };
}

/**
 * 创建场景不等于条件
 */
export function sceneIsNot(sceneType: string): ConditionInput {
  return {
    type: 'scene',
    operator: 'not_equals',
    value: sceneType,
  };
}

/**
 * 创建时间在范围内条件
 */
export function timeBetween(start: string, end: string): ConditionInput {
  return {
    type: 'time',
    operator: 'between',
    value: [start, end],
  };
}

/**
 * 创建时间大于条件
 */
export function timeAfter(time: string): ConditionInput {
  return {
    type: 'time',
    operator: 'greater',
    value: time,
  };
}

/**
 * 创建时间小于条件
 */
export function timeBefore(time: string): ConditionInput {
  return {
    type: 'time',
    operator: 'less',
    value: time,
  };
}

/**
 * 创建星期条件
 */
export function dayOfWeek(days: number[]): ConditionInput {
  return {
    type: 'time',
    operator: 'in',
    value: days,
    field: 'dayOfWeek',
  };
}

/**
 * 创建电池电量条件
 */
export function batteryBelow(level: number): ConditionInput {
  return {
    type: 'battery',
    operator: 'less',
    value: level,
  };
}

/**
 * 创建电池充电状态条件
 */
export function batteryCharging(charging: boolean): ConditionInput {
  return {
    type: 'battery',
    operator: 'equals',
    value: charging,
    field: 'isCharging',
  };
}

/**
 * 创建 WiFi 连接条件
 */
export function wifiConnected(ssid: string): ConditionInput {
  return {
    type: 'network',
    operator: 'equals',
    value: ssid,
    field: 'wifiSSID',
  };
}

/**
 * 创建运动状态条件
 */
export function motionIs(state: string): ConditionInput {
  return {
    type: 'motion',
    operator: 'equals',
    value: state,
  };
}

/**
 * 创建前台应用条件
 */
export function appInForeground(packageName: string): ConditionInput {
  return {
    type: 'app',
    operator: 'equals',
    value: packageName,
    field: 'foreground',
  };
}

// ==================== 动作构建辅助函数 ====================

/**
 * 创建系统设置动作
 */
export function setSystemSetting(settings: Record<string, unknown>): ActionInput {
  return {
    type: 'system_setting',
    params: settings,
    description: '调整系统设置',
  };
}

/**
 * 创建启动应用动作
 */
export function launchApp(packageName: string, deepLink?: string): ActionInput {
  return {
    type: 'app_launch',
    params: { packageName, deepLink },
    description: `启动应用: ${packageName}`,
  };
}

/**
 * 创建发送通知动作
 */
export function sendNotification(title: string, body: string, options?: Record<string, unknown>): ActionInput {
  return {
    type: 'notification',
    params: { title, body, ...options },
    description: `发送通知: ${title}`,
  };
}

/**
 * 创建快捷操作动作
 */
export function executeQuickAction(actionId: string, params?: Record<string, unknown>): ActionInput {
  return {
    type: 'quick_action',
    params: { actionId, ...params },
    description: `执行快捷操作: ${actionId}`,
  };
}

// ==================== 命名空间导出（兼容模板语法）====================

/**
 * 条件构建辅助函数集合
 * 用于模板中的 conditions.xxx() 语法
 */
export const conditions = {
  sceneIs,
  sceneIsNot,
  timeBetween,
  timeAfter,
  timeBefore,
  dayOfWeek,
  /** 星期几在列表中 */
  dayOfWeekIn: (days: number[]): ConditionInput => ({
    type: 'time',
    operator: 'in',
    value: days,
    field: 'dayOfWeek',
  }),
  batteryBelow,
  batteryCharging,
  /** 电池电量高于 */
  batteryAbove: (level: number): ConditionInput => ({
    type: 'battery',
    operator: 'greater',
    value: level,
  }),
  wifiConnected,
  /** WiFi 未连接 */
  wifiDisconnected: (): ConditionInput => ({
    type: 'network',
    operator: 'equals',
    value: false,
    field: 'wifiConnected',
  }),
  /** 网络类型检查 */
  networkType: (type: string): ConditionInput => ({
    type: 'network',
    operator: 'equals',
    value: type,
    field: 'type',
  }),
  motionIs,
  /** 运动状态 (别名) */
  motionState: (state: string): ConditionInput => ({
    type: 'motion',
    operator: 'equals',
    value: state,
  }),
  appInForeground,
  /** 位置在指定地点 */
  locationAt: (location: { lat: number; lng: number; radius?: number }): ConditionInput => ({
    type: 'location',
    operator: 'equals',
    value: location,
  }),
  /** 噪声级别高于 */
  noiseLevelAbove: (level: number): ConditionInput => ({
    type: 'audio',
    operator: 'greater',
    value: level,
    field: 'noiseLevel',
  }),
  /** 噪声级别低于 */
  noiseLevelBelow: (level: number): ConditionInput => ({
    type: 'audio',
    operator: 'less',
    value: level,
    field: 'noiseLevel',
  }),
  /** 设备静止 */
  deviceStationary: (): ConditionInput => ({
    type: 'motion',
    operator: 'equals',
    value: 'STILL',
  }),
  /** 正在充电 */
  isCharging: (): ConditionInput => ({
    type: 'battery',
    operator: 'equals',
    value: true,
    field: 'isCharging',
  }),
};

/**
 * 动作构建辅助函数集合
 * 用于模板中的 actions.xxx() 语法
 */
export const actions = {
  setSystemSetting: (setting: string, value: unknown): ActionInput => ({
    type: 'system_setting',
    params: { [setting]: value },
    description: `设置 ${setting}`,
  }),
  launchApp,
  sendNotification,
  /** 显示通知 (别名) */
  showNotification: (title: string, body: string, options?: Record<string, unknown>): ActionInput => ({
    type: 'notification',
    params: { title, body, ...options },
    description: `显示通知: ${title}`,
  }),
  executeQuickAction,
  /** 打开深链接 */
  openDeepLink: (url: string, fallbackPackage?: string): ActionInput => ({
    type: 'app_launch',
    params: { deepLink: url, fallbackPackage },
    description: `打开链接: ${url}`,
  }),
  /** 执行延时动作 */
  delayedAction: (action: ActionInput, delayMs: number): ActionInput => ({
    type: 'delayed',
    params: { action, delayMs },
    description: `延时 ${delayMs}ms 后执行`,
  }),
  /** 触发规则 */
  triggerRule: (ruleId: string): ActionInput => ({
    type: 'trigger_rule',
    params: { ruleId },
    description: `触发规则: ${ruleId}`,
  }),
  /** 记录日志 */
  log: (message: string, level: 'info' | 'warn' | 'error' = 'info'): ActionInput => ({
    type: 'log',
    params: { message, level },
    description: `日志: ${message}`,
  }),
  /** 静音 */
  mute: (): ActionInput => ({
    type: 'system_setting',
    params: { volume: { media: 0, ring: 0 } },
    description: '静音',
  }),
  /** 取消静音 */
  unmute: (volume?: number): ActionInput => ({
    type: 'system_setting',
    params: { volume: { media: volume ?? 50, ring: volume ?? 50 } },
    description: '取消静音',
  }),
};

// ==================== 导出 ====================

export default RuleBuilder;
