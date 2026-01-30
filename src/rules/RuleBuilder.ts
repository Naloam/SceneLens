/**
 * RuleBuilder - 面向 UI 的规则构建器
 * 
 * 提供简化的 API 用于 UI 可视化规则创建
 * 封装底层 engine/RuleBuilder，提供更友好的接口
 * 
 * @module rules
 */

import { 
  RuleBuilder as CoreRuleBuilder, 
  conditions, 
  actions,
  type ConditionInput,
  type ActionInput,
} from './engine/RuleBuilder';
import type { 
  AutomationRule, 
  AutomationCondition, 
  AutomationAction,
  AutomationConditionType,
  AutomationActionType,
  ConditionOperator,
} from '../types/automation';
import type { SceneType } from '../types';

// ==================== 类型定义 ====================

/**
 * 条件选项 - 用于 UI 选择器
 */
export interface ConditionOption {
  type: AutomationConditionType;
  label: string;
  icon: string;
  description: string;
  operators: OperatorOption[];
  valueType: 'scene' | 'time' | 'timeRange' | 'number' | 'boolean' | 'text' | 'days';
  defaultValue?: unknown;
}

/**
 * 操作符选项
 */
export interface OperatorOption {
  value: ConditionOperator;
  label: string;
}

/**
 * 动作选项 - 用于 UI 选择器
 */
export interface ActionOption {
  type: AutomationActionType;
  label: string;
  icon: string;
  description: string;
  paramFields: ParamField[];
}

/**
 * 参数字段定义
 */
export interface ParamField {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'text' | 'select' | 'app';
  options?: Array<{ value: unknown; label: string }>;
  required?: boolean;
  defaultValue?: unknown;
  min?: number;
  max?: number;
}

/**
 * 规则验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

/**
 * 规则草稿 - 用于 UI 编辑状态
 */
export interface RuleDraft {
  name: string;
  description?: string;
  enabled: boolean;
  conditions: ConditionDraft[];
  actions: ActionDraft[];
  conditionLogic: 'AND' | 'OR';
  priority: number;
  cooldown: number;
}

export interface ConditionDraft {
  id: string;
  type: AutomationConditionType;
  operator: ConditionOperator;
  value: unknown;
  field?: string;
}

export interface ActionDraft {
  id: string;
  type: AutomationActionType;
  params: Record<string, unknown>;
  description?: string;
}

// ==================== 常量定义 ====================

/**
 * 可用的条件类型列表
 */
export const CONDITION_OPTIONS: ConditionOption[] = [
  {
    type: 'scene',
    label: '场景',
    icon: '🎬',
    description: '当前检测到的场景类型',
    operators: [
      { value: 'equals', label: '等于' },
      { value: 'not_equals', label: '不等于' },
    ],
    valueType: 'scene',
  },
  {
    type: 'time',
    label: '时间',
    icon: '🕐',
    description: '当前时间范围',
    operators: [
      { value: 'between', label: '在...之间' },
      { value: 'greater', label: '晚于' },
      { value: 'less', label: '早于' },
    ],
    valueType: 'timeRange',
  },
  {
    type: 'battery',
    label: '电池',
    icon: '🔋',
    description: '电池电量或充电状态',
    operators: [
      { value: 'less', label: '低于' },
      { value: 'greater', label: '高于' },
      { value: 'equals', label: '等于（充电状态）' },
    ],
    valueType: 'number',
    defaultValue: 20,
  },
  {
    type: 'network',
    label: 'WiFi',
    icon: '📶',
    description: 'WiFi 连接状态',
    operators: [
      { value: 'equals', label: '已连接' },
      { value: 'not_equals', label: '未连接' },
    ],
    valueType: 'text',
  },
  {
    type: 'motion',
    label: '运动状态',
    icon: '🚶',
    description: '用户当前的运动状态',
    operators: [
      { value: 'equals', label: '等于' },
      { value: 'not_equals', label: '不等于' },
    ],
    valueType: 'text',
  },
];

/**
 * 可用的动作类型列表
 */
export const ACTION_OPTIONS: ActionOption[] = [
  {
    type: 'system_setting',
    label: '系统设置',
    icon: '⚙️',
    description: '调整系统设置（音量、亮度、勿扰等）',
    paramFields: [
      {
        key: 'doNotDisturb',
        label: '勿扰模式',
        type: 'select',
        options: [
          { value: undefined, label: '不变' },
          { value: true, label: '开启' },
          { value: false, label: '关闭' },
          { value: 'priority', label: '仅优先' },
        ],
      },
      {
        key: 'volume',
        label: '媒体音量',
        type: 'number',
        min: 0,
        max: 100,
      },
      {
        key: 'brightness',
        label: '屏幕亮度',
        type: 'number',
        min: 0,
        max: 100,
      },
      {
        key: 'wifi',
        label: 'WiFi',
        type: 'select',
        options: [
          { value: undefined, label: '不变' },
          { value: true, label: '开启' },
          { value: false, label: '关闭' },
        ],
      },
      {
        key: 'bluetooth',
        label: '蓝牙',
        type: 'select',
        options: [
          { value: undefined, label: '不变' },
          { value: true, label: '开启' },
          { value: false, label: '关闭' },
        ],
      },
    ],
  },
  {
    type: 'app_launch',
    label: '启动应用',
    icon: '📱',
    description: '启动指定应用或打开深度链接',
    paramFields: [
      {
        key: 'packageName',
        label: '应用',
        type: 'app',
        required: true,
      },
      {
        key: 'deepLink',
        label: '深度链接（可选）',
        type: 'text',
      },
    ],
  },
  {
    type: 'notification',
    label: '发送通知',
    icon: '🔔',
    description: '发送本地通知提醒',
    paramFields: [
      {
        key: 'title',
        label: '标题',
        type: 'text',
        required: true,
      },
      {
        key: 'body',
        label: '内容',
        type: 'text',
        required: true,
      },
    ],
  },
  {
    type: 'quick_action',
    label: '快捷操作',
    icon: '⚡',
    description: '执行预设的快捷操作',
    paramFields: [
      {
        key: 'actionId',
        label: '操作 ID',
        type: 'text',
        required: true,
      },
    ],
  },
];

/**
 * 场景选项
 */
export const SCENE_OPTIONS: Array<{ value: SceneType; label: string; icon: string }> = [
  { value: 'COMMUTE', label: '通勤', icon: '🚇' },
  { value: 'OFFICE', label: '办公室', icon: '🏢' },
  { value: 'HOME', label: '家', icon: '🏠' },
  { value: 'STUDY', label: '学习', icon: '📚' },
  { value: 'SLEEP', label: '睡眠', icon: '😴' },
  { value: 'TRAVEL', label: '出行', icon: '✈️' },
];

/**
 * 运动状态选项
 */
export const MOTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'STILL', label: '静止' },
  { value: 'WALKING', label: '步行' },
  { value: 'RUNNING', label: '跑步' },
  { value: 'VEHICLE', label: '交通工具' },
];

// ==================== UI 规则构建器 ====================

/**
 * 面向 UI 的规则构建器
 */
export class UIRuleBuilder {
  private draft: RuleDraft;

  constructor(existingRule?: AutomationRule) {
    if (existingRule) {
      this.draft = this.ruleToInitialDraft(existingRule);
    } else {
      this.draft = this.createEmptyDraft();
    }
  }

  /**
   * 创建空白草稿
   */
  private createEmptyDraft(): RuleDraft {
    return {
      name: '',
      description: '',
      enabled: true,
      conditions: [],
      actions: [],
      conditionLogic: 'AND',
      priority: 5,
      cooldown: 0,
    };
  }

  /**
   * 从现有规则创建草稿
   */
  private ruleToInitialDraft(rule: AutomationRule): RuleDraft {
    return {
      name: rule.name,
      description: rule.description || '',
      enabled: rule.enabled,
      conditions: rule.conditions.map((c, i) => ({
        id: `condition_${i}_${Date.now()}`,
        type: c.type,
        operator: c.operator,
        value: c.value,
        field: c.field,
      })),
      actions: rule.actions.map((a, i) => ({
        id: `action_${i}_${Date.now()}`,
        type: a.type,
        params: { ...a.params },
        description: a.description,
      })),
      conditionLogic: rule.conditionLogic,
      priority: rule.priority,
      cooldown: rule.cooldown,
    };
  }

  /**
   * 获取当前草稿
   */
  getDraft(): RuleDraft {
    return { ...this.draft };
  }

  /**
   * 更新草稿
   */
  updateDraft(updates: Partial<RuleDraft>): void {
    this.draft = { ...this.draft, ...updates };
  }

  /**
   * 设置名称
   */
  setName(name: string): UIRuleBuilder {
    this.draft.name = name;
    return this;
  }

  /**
   * 设置描述
   */
  setDescription(description: string): UIRuleBuilder {
    this.draft.description = description;
    return this;
  }

  /**
   * 添加条件
   */
  addCondition(condition: Omit<ConditionDraft, 'id'>): UIRuleBuilder {
    this.draft.conditions.push({
      ...condition,
      id: `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
    return this;
  }

  /**
   * 更新条件
   */
  updateCondition(id: string, updates: Partial<ConditionDraft>): UIRuleBuilder {
    const index = this.draft.conditions.findIndex(c => c.id === id);
    if (index >= 0) {
      this.draft.conditions[index] = { ...this.draft.conditions[index], ...updates };
    }
    return this;
  }

  /**
   * 移除条件
   */
  removeCondition(id: string): UIRuleBuilder {
    this.draft.conditions = this.draft.conditions.filter(c => c.id !== id);
    return this;
  }

  /**
   * 添加动作
   */
  addAction(action: Omit<ActionDraft, 'id'>): UIRuleBuilder {
    this.draft.actions.push({
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
    return this;
  }

  /**
   * 更新动作
   */
  updateAction(id: string, updates: Partial<ActionDraft>): UIRuleBuilder {
    const index = this.draft.actions.findIndex(a => a.id === id);
    if (index >= 0) {
      this.draft.actions[index] = { ...this.draft.actions[index], ...updates };
    }
    return this;
  }

  /**
   * 移除动作
   */
  removeAction(id: string): UIRuleBuilder {
    this.draft.actions = this.draft.actions.filter(a => a.id !== id);
    return this;
  }

  /**
   * 设置条件逻辑
   */
  setConditionLogic(logic: 'AND' | 'OR'): UIRuleBuilder {
    this.draft.conditionLogic = logic;
    return this;
  }

  /**
   * 设置优先级
   */
  setPriority(priority: number): UIRuleBuilder {
    this.draft.priority = Math.max(1, Math.min(10, priority));
    return this;
  }

  /**
   * 设置冷却时间
   */
  setCooldown(minutes: number): UIRuleBuilder {
    this.draft.cooldown = Math.max(0, minutes);
    return this;
  }

  /**
   * 验证规则
   */
  validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 验证名称
    if (!this.draft.name.trim()) {
      errors.push({ field: 'name', message: '规则名称不能为空' });
    } else if (this.draft.name.length > 50) {
      errors.push({ field: 'name', message: '规则名称不能超过50个字符' });
    }

    // 验证条件
    if (this.draft.conditions.length === 0) {
      errors.push({ field: 'conditions', message: '至少需要一个触发条件' });
    } else {
      this.draft.conditions.forEach((condition, index) => {
        if (condition.value === undefined || condition.value === null || condition.value === '') {
          errors.push({ field: `conditions[${index}]`, message: `条件 ${index + 1} 的值不能为空` });
        }
      });
    }

    // 验证动作
    if (this.draft.actions.length === 0) {
      errors.push({ field: 'actions', message: '至少需要一个执行动作' });
    } else {
      this.draft.actions.forEach((action, index) => {
        const actionOption = ACTION_OPTIONS.find(a => a.type === action.type);
        if (actionOption) {
          actionOption.paramFields.forEach(field => {
            if (field.required && (action.params[field.key] === undefined || action.params[field.key] === '')) {
              errors.push({ field: `actions[${index}].${field.key}`, message: `动作 ${index + 1} 的 ${field.label} 不能为空` });
            }
          });
        }
      });
    }

    // 警告
    if (this.draft.cooldown === 0) {
      warnings.push({ field: 'cooldown', message: '建议设置冷却时间以避免频繁触发' });
    }

    if (this.draft.conditions.length > 5) {
      warnings.push({ field: 'conditions', message: '条件过多可能导致规则难以触发' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 构建规则
   */
  build(existingId?: string): AutomationRule | null {
    const validation = this.validate();
    if (!validation.valid) {
      console.error('[UIRuleBuilder] Validation failed:', validation.errors);
      return null;
    }

    try {
      const builder = new CoreRuleBuilder(existingId);
      
      builder.name(this.draft.name);
      if (this.draft.description) {
        builder.description(this.draft.description);
      }
      builder.enabled(this.draft.enabled);
      builder.withPriority(this.draft.priority);
      builder.withCooldown(this.draft.cooldown);

      // 添加条件
      this.draft.conditions.forEach((condition, index) => {
        const conditionInput: ConditionInput = {
          type: condition.type,
          operator: condition.operator,
          value: condition.value,
          field: condition.field,
        };

        if (index === 0) {
          builder.when(conditionInput);
        } else if (this.draft.conditionLogic === 'AND') {
          builder.and(conditionInput);
        } else {
          builder.or(conditionInput);
        }
      });

      // 添加动作
      this.draft.actions.forEach(action => {
        const actionInput: ActionInput = {
          type: action.type,
          params: action.params,
          description: action.description,
        };
        builder.then(actionInput);
      });

      return builder.build();
    } catch (error) {
      console.error('[UIRuleBuilder] Build failed:', error);
      return null;
    }
  }

  /**
   * 重置草稿
   */
  reset(): void {
    this.draft = this.createEmptyDraft();
  }
}

// ==================== 辅助函数 ====================

/**
 * 获取条件的显示文本
 */
export function getConditionDisplayText(condition: ConditionDraft): string {
  const option = CONDITION_OPTIONS.find(o => o.type === condition.type);
  const opLabel = option?.operators.find(o => o.value === condition.operator)?.label || condition.operator;
  
  let valueText: string;
  
  switch (condition.type) {
    case 'scene':
      const scene = SCENE_OPTIONS.find(s => s.value === condition.value);
      valueText = scene ? `${scene.icon} ${scene.label}` : String(condition.value);
      break;
    case 'time':
      if (Array.isArray(condition.value)) {
        valueText = `${condition.value[0]} - ${condition.value[1]}`;
      } else {
        valueText = String(condition.value);
      }
      break;
    case 'battery':
      valueText = `${condition.value}%`;
      break;
    case 'motion':
      const motion = MOTION_OPTIONS.find(m => m.value === condition.value);
      valueText = motion?.label || String(condition.value);
      break;
    default:
      valueText = String(condition.value);
  }

  return `${option?.label || condition.type} ${opLabel} ${valueText}`;
}

/**
 * 获取动作的显示文本
 */
export function getActionDisplayText(action: ActionDraft): string {
  const option = ACTION_OPTIONS.find(o => o.type === action.type);
  
  switch (action.type) {
    case 'system_setting':
      const settings: string[] = [];
      if (action.params.doNotDisturb !== undefined) {
        settings.push(`勿扰:${action.params.doNotDisturb ? '开' : '关'}`);
      }
      if (action.params.volume !== undefined) {
        settings.push(`音量:${action.params.volume}%`);
      }
      if (action.params.brightness !== undefined) {
        settings.push(`亮度:${action.params.brightness}%`);
      }
      return settings.length > 0 ? settings.join(', ') : '调整系统设置';
    
    case 'app_launch':
      return `启动 ${action.params.packageName || '应用'}`;
    
    case 'notification':
      return `通知: ${action.params.title || '提醒'}`;
    
    case 'quick_action':
      return `快捷操作: ${action.params.actionId || '操作'}`;
    
    default:
      return action.description || option?.label || action.type;
  }
}

/**
 * 创建快速规则的辅助函数
 */
export function createQuickRule(
  name: string,
  sceneType: SceneType,
  systemSettings: Record<string, unknown>
): AutomationRule | null {
  const builder = new UIRuleBuilder();
  
  return builder
    .setName(name)
    .addCondition({
      type: 'scene',
      operator: 'equals',
      value: sceneType,
    })
    .addAction({
      type: 'system_setting',
      params: systemSettings,
    })
    .setCooldown(30)
    .build();
}

// 重新导出底层模块
export { 
  CoreRuleBuilder as RuleBuilderCore,
  conditions,
  actions,
};
export type { ConditionInput, ActionInput };
