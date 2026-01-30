/**
 * RuleTemplates - 预设规则模板库
 * 
 * 提供常用的自动化规则模板，用户可以快速启用
 * 
 * @module rules
 */

import type { AutomationRule, AutomationCondition, AutomationAction } from '../types/automation';
import type { SceneType } from '../types';

// ==================== 类型定义 ====================

/**
 * 规则模板分类
 */
export type TemplateCategory = 
  | 'work'       // 工作相关
  | 'home'       // 居家相关
  | 'commute'    // 通勤相关
  | 'sleep'      // 睡眠相关
  | 'health'     // 健康相关
  | 'custom';    // 自定义

/**
 * 规则模板
 */
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  tags: string[];
  recommended?: boolean;       // 是否推荐
  rule: Omit<AutomationRule, 'id' | 'createdAt'>;
}

/**
 * 模板组
 */
export interface TemplateGroup {
  category: TemplateCategory;
  label: string;
  icon: string;
  templates: RuleTemplate[];
}

// ==================== 工作相关模板 ====================

export const workTemplates: RuleTemplate[] = [
  {
    id: 'tpl_work_mode',
    name: '工作模式',
    description: '到达办公室后自动开启勿扰模式，专注工作',
    category: 'work',
    icon: '💼',
    tags: ['办公', '专注', '勿扰'],
    recommended: true,
    rule: {
      name: '工作模式',
      description: '到达办公室后自动开启勿扰模式',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'OFFICE' },
        { type: 'time', operator: 'between', value: ['09:00', '18:00'] },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            doNotDisturb: 'priority',
            volume: { notification: 30 },
          },
          description: '开启优先模式',
        },
      ],
      conditionLogic: 'AND',
      priority: 7,
      cooldown: 60,
    },
  },
  {
    id: 'tpl_meeting_mode',
    name: '会议模式',
    description: '开会时自动静音，避免打扰',
    category: 'work',
    icon: '🎤',
    tags: ['会议', '静音', '专注'],
    recommended: true,
    rule: {
      name: '会议模式',
      description: '开会时自动静音',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'OFFICE' },
        { type: 'calendar', operator: 'equals', value: true, field: 'hasMeeting' },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            doNotDisturb: true,
            volume: { ring: 0, notification: 0 },
          },
          description: '开启勿扰并静音',
        },
      ],
      conditionLogic: 'AND',
      priority: 9,
      cooldown: 30,
    },
  },
  {
    id: 'tpl_lunch_break',
    name: '午休时间',
    description: '中午时段允许通知，享受休息时光',
    category: 'work',
    icon: '🍱',
    tags: ['午休', '休息', '放松'],
    rule: {
      name: '午休时间',
      description: '午休时间放松通知限制',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'OFFICE' },
        { type: 'time', operator: 'between', value: ['12:00', '13:30'] },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            doNotDisturb: false,
            volume: { notification: 50 },
          },
          description: '关闭勿扰模式',
        },
      ],
      conditionLogic: 'AND',
      priority: 6,
      cooldown: 60,
    },
  },
  {
    id: 'tpl_work_end',
    name: '下班模式',
    description: '下班后关闭工作相关设置，切换到个人时间',
    category: 'work',
    icon: '🏃',
    tags: ['下班', '切换', '个人时间'],
    rule: {
      name: '下班模式',
      description: '下班后恢复正常通知',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'not_equals', value: 'OFFICE' },
        { type: 'time', operator: 'greater', value: '18:00' },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            doNotDisturb: false,
            volume: { ring: 70, notification: 60 },
          },
          description: '恢复正常通知',
        },
      ],
      conditionLogic: 'AND',
      priority: 5,
      cooldown: 30,
    },
  },
];

// ==================== 居家相关模板 ====================

export const homeTemplates: RuleTemplate[] = [
  {
    id: 'tpl_home_arrival',
    name: '回家模式',
    description: '到家后自动开启 WiFi，调整为舒适的家庭设置',
    category: 'home',
    icon: '🏠',
    tags: ['回家', 'WiFi', '舒适'],
    recommended: true,
    rule: {
      name: '回家模式',
      description: '到家后开启 WiFi',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'HOME' },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            wifi: true,
            doNotDisturb: false,
            volume: { media: 60, ring: 80 },
          },
          description: '开启 WiFi，恢复通知',
        },
      ],
      conditionLogic: 'AND',
      priority: 6,
      cooldown: 60,
    },
  },
  {
    id: 'tpl_home_evening',
    name: '晚间模式',
    description: '晚上在家时降低屏幕亮度，保护眼睛',
    category: 'home',
    icon: '🌙',
    tags: ['晚间', '护眼', '舒适'],
    rule: {
      name: '晚间模式',
      description: '晚上降低亮度',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'HOME' },
        { type: 'time', operator: 'greater', value: '20:00' },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            brightness: 50,
            volume: { media: 40 },
          },
          description: '降低亮度和音量',
        },
      ],
      conditionLogic: 'AND',
      priority: 5,
      cooldown: 120,
    },
  },
  {
    id: 'tpl_weekend_relax',
    name: '周末放松',
    description: '周末在家时减少打扰，享受休息',
    category: 'home',
    icon: '☕',
    tags: ['周末', '放松', '休息'],
    rule: {
      name: '周末放松',
      description: '周末减少打扰',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'HOME' },
        { type: 'time', operator: 'in', value: [0, 6], field: 'dayOfWeek' },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            doNotDisturb: 'priority',
          },
          description: '开启优先通知模式',
        },
      ],
      conditionLogic: 'AND',
      priority: 4,
      cooldown: 120,
    },
  },
];

// ==================== 通勤相关模板 ====================

export const commuteTemplates: RuleTemplate[] = [
  {
    id: 'tpl_morning_commute',
    name: '早高峰通勤',
    description: '早上通勤时开启蓝牙连接耳机，准备听音乐或播客',
    category: 'commute',
    icon: '🚇',
    tags: ['通勤', '早上', '蓝牙'],
    recommended: true,
    rule: {
      name: '早高峰通勤',
      description: '通勤时开启蓝牙',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'COMMUTE' },
        { type: 'time', operator: 'between', value: ['07:00', '09:30'] },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            bluetooth: true,
            volume: { media: 70 },
          },
          description: '开启蓝牙，调整媒体音量',
        },
      ],
      conditionLogic: 'AND',
      priority: 7,
      cooldown: 30,
    },
  },
  {
    id: 'tpl_evening_commute',
    name: '晚高峰通勤',
    description: '下班通勤时的个性化设置',
    category: 'commute',
    icon: '🌆',
    tags: ['通勤', '下班', '音乐'],
    rule: {
      name: '晚高峰通勤',
      description: '晚上通勤设置',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'COMMUTE' },
        { type: 'time', operator: 'between', value: ['17:30', '20:00'] },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            bluetooth: true,
            doNotDisturb: false,
          },
          description: '开启蓝牙，允许通知',
        },
      ],
      conditionLogic: 'AND',
      priority: 6,
      cooldown: 30,
    },
  },
  {
    id: 'tpl_travel_mode',
    name: '旅途模式',
    description: '长途出行时的特殊设置',
    category: 'commute',
    icon: '✈️',
    tags: ['旅行', '出差', '长途'],
    rule: {
      name: '旅途模式',
      description: '长途出行设置',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'TRAVEL' },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            bluetooth: true,
            wifi: false,
          },
          description: '开启蓝牙，关闭 WiFi 省电',
        },
        { 
          type: 'notification', 
          params: { 
            title: '旅途模式已启动',
            body: '祝您旅途愉快！',
          },
          description: '发送提醒通知',
        },
      ],
      conditionLogic: 'AND',
      priority: 5,
      cooldown: 60,
    },
  },
];

// ==================== 睡眠相关模板 ====================

export const sleepTemplates: RuleTemplate[] = [
  {
    id: 'tpl_bedtime',
    name: '睡前准备',
    description: '睡前降低亮度和音量，帮助入睡',
    category: 'sleep',
    icon: '🌙',
    tags: ['睡眠', '准备', '护眼'],
    recommended: true,
    rule: {
      name: '睡前准备',
      description: '睡前降低亮度',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'HOME' },
        { type: 'time', operator: 'between', value: ['22:00', '23:30'] },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            brightness: 30,
            volume: { media: 20, notification: 10 },
          },
          description: '降低亮度和音量',
        },
      ],
      conditionLogic: 'AND',
      priority: 6,
      cooldown: 60,
    },
  },
  {
    id: 'tpl_sleep_mode',
    name: '深度睡眠',
    description: '睡眠时完全静音，只接受紧急电话',
    category: 'sleep',
    icon: '😴',
    tags: ['睡眠', '静音', '勿扰'],
    recommended: true,
    rule: {
      name: '深度睡眠',
      description: '睡眠时完全勿扰',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'SLEEP' },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            doNotDisturb: true,
            brightness: 10,
            volume: { ring: 0, notification: 0, media: 0 },
          },
          description: '完全勿扰模式',
        },
      ],
      conditionLogic: 'AND',
      priority: 9,
      cooldown: 120,
    },
  },
  {
    id: 'tpl_wake_up',
    name: '起床模式',
    description: '早上醒来时恢复正常设置',
    category: 'sleep',
    icon: '🌅',
    tags: ['起床', '早晨', '恢复'],
    rule: {
      name: '起床模式',
      description: '起床恢复正常',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'not_equals', value: 'SLEEP' },
        { type: 'time', operator: 'between', value: ['06:00', '09:00'] },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            doNotDisturb: false,
            brightness: 70,
            volume: { ring: 70, notification: 50 },
          },
          description: '恢复正常设置',
        },
      ],
      conditionLogic: 'AND',
      priority: 7,
      cooldown: 60,
    },
  },
];

// ==================== 健康相关模板 ====================

export const healthTemplates: RuleTemplate[] = [
  {
    id: 'tpl_study_focus',
    name: '专注学习',
    description: '学习时开启勿扰，专心致志',
    category: 'health',
    icon: '📚',
    tags: ['学习', '专注', '效率'],
    recommended: true,
    rule: {
      name: '专注学习',
      description: '学习时勿扰',
      enabled: true,
      conditions: [
        { type: 'scene', operator: 'equals', value: 'STUDY' },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            doNotDisturb: true,
            volume: { notification: 0 },
          },
          description: '开启勿扰模式',
        },
      ],
      conditionLogic: 'AND',
      priority: 8,
      cooldown: 30,
    },
  },
  {
    id: 'tpl_battery_saver',
    name: '省电模式',
    description: '电量低时自动关闭不必要的功能',
    category: 'health',
    icon: '🔋',
    tags: ['电池', '省电', '续航'],
    rule: {
      name: '省电模式',
      description: '低电量时省电',
      enabled: true,
      conditions: [
        { type: 'battery', operator: 'less', value: 20 },
      ],
      actions: [
        { 
          type: 'system_setting', 
          params: { 
            brightness: 30,
            wifi: false,
            bluetooth: false,
          },
          description: '降低亮度，关闭无线',
        },
        { 
          type: 'notification', 
          params: { 
            title: '电量不足',
            body: '已自动开启省电模式',
          },
          description: '提醒用户',
        },
      ],
      conditionLogic: 'AND',
      priority: 8,
      cooldown: 60,
    },
  },
];

// ==================== 导出所有模板 ====================

/**
 * 所有规则模板
 */
export const ALL_RULE_TEMPLATES: RuleTemplate[] = [
  ...workTemplates,
  ...homeTemplates,
  ...commuteTemplates,
  ...sleepTemplates,
  ...healthTemplates,
];

/**
 * 模板分组
 */
export const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    category: 'work',
    label: '工作办公',
    icon: '💼',
    templates: workTemplates,
  },
  {
    category: 'home',
    label: '居家生活',
    icon: '🏠',
    templates: homeTemplates,
  },
  {
    category: 'commute',
    label: '通勤出行',
    icon: '🚇',
    templates: commuteTemplates,
  },
  {
    category: 'sleep',
    label: '睡眠休息',
    icon: '😴',
    templates: sleepTemplates,
  },
  {
    category: 'health',
    label: '健康效率',
    icon: '💪',
    templates: healthTemplates,
  },
];

// ==================== 辅助函数 ====================

/**
 * 根据分类获取模板
 */
export function getTemplatesByCategory(category: TemplateCategory): RuleTemplate[] {
  return ALL_RULE_TEMPLATES.filter(t => t.category === category);
}

/**
 * 获取推荐模板
 */
export function getRecommendedTemplates(): RuleTemplate[] {
  return ALL_RULE_TEMPLATES.filter(t => t.recommended);
}

/**
 * 根据 ID 获取模板
 */
export function getTemplateById(id: string): RuleTemplate | undefined {
  return ALL_RULE_TEMPLATES.find(t => t.id === id);
}

/**
 * 根据标签搜索模板
 */
export function searchTemplatesByTag(tag: string): RuleTemplate[] {
  const lowerTag = tag.toLowerCase();
  return ALL_RULE_TEMPLATES.filter(t => 
    t.tags.some(tg => tg.toLowerCase().includes(lowerTag)) ||
    t.name.toLowerCase().includes(lowerTag) ||
    t.description.toLowerCase().includes(lowerTag)
  );
}

/**
 * 根据场景获取相关模板
 */
export function getTemplatesForScene(sceneType: SceneType): RuleTemplate[] {
  return ALL_RULE_TEMPLATES.filter(template => 
    template.rule.conditions.some(
      c => c.type === 'scene' && c.value === sceneType
    )
  );
}

/**
 * 从模板创建规则
 * @param template 规则模板
 * @param overrides 覆盖的属性
 */
export function createRuleFromTemplate(
  template: RuleTemplate,
  overrides?: Partial<Omit<AutomationRule, 'id' | 'createdAt'>>
): AutomationRule {
  const rule = template.rule;
  
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: overrides?.name ?? rule.name,
    description: overrides?.description ?? rule.description,
    enabled: overrides?.enabled ?? rule.enabled,
    conditions: overrides?.conditions ?? [...rule.conditions],
    actions: overrides?.actions ?? [...rule.actions],
    conditionLogic: overrides?.conditionLogic ?? rule.conditionLogic,
    priority: overrides?.priority ?? rule.priority,
    cooldown: overrides?.cooldown ?? rule.cooldown,
    createdAt: Date.now(),
  };
}

/**
 * 批量启用推荐模板
 */
export function createRecommendedRules(): AutomationRule[] {
  return getRecommendedTemplates().map(template => 
    createRuleFromTemplate(template)
  );
}

/**
 * 获取模板分类信息
 */
export function getCategoryInfo(category: TemplateCategory): { label: string; icon: string } | undefined {
  const group = TEMPLATE_GROUPS.find(g => g.category === category);
  return group ? { label: group.label, icon: group.icon } : undefined;
}
