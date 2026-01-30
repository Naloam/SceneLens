/**
 * 自动化模块类型定义
 */

import { SceneType } from './index';

// ==================== 系统设置类型 ====================

/**
 * 音量类型
 */
export type VolumeStreamType = 'media' | 'ring' | 'notification' | 'alarm' | 'system';

/**
 * 音量信息
 */
export interface VolumeInfo {
  level: number;        // 0-100
  current: number;      // 实际音量值
  max: number;          // 最大音量值
}

/**
 * 音量设置
 */
export interface VolumeSettings {
  media?: number;       // 媒体音量 0-100
  ring?: number;        // 铃声音量 0-100
  notification?: number; // 通知音量 0-100
  alarm?: number;       // 闹钟音量 0-100
  system?: number;      // 系统音量 0-100
}

/**
 * 亮度设置
 */
export interface BrightnessSettings {
  level: number;        // 0-100
  autoMode: boolean;    // 是否自动亮度
}

/**
 * 勿扰模式类型
 */
export type DoNotDisturbMode = 'all' | 'priority' | 'alarms' | 'none';

/**
 * 勿扰模式设置
 */
export interface DoNotDisturbSettings {
  enabled: boolean;
  mode: DoNotDisturbMode;
}

/**
 * WiFi 状态
 */
export interface WiFiStatus {
  enabled: boolean;
  state?: number;
}

/**
 * 蓝牙状态
 */
export interface BluetoothStatus {
  supported: boolean;
  enabled: boolean;
  state?: number;
}

/**
 * 系统权限状态
 */
export interface SystemPermissions {
  writeSettings: boolean;
  notificationPolicy: boolean;
  bluetoothConnect: boolean;
}

/**
 * 完整的系统状态
 */
export interface SystemState {
  volume: VolumeSettings;
  brightness: BrightnessSettings;
  doNotDisturb: DoNotDisturbSettings;
  wifi: WiFiStatus;
  bluetooth: BluetoothStatus;
  screenTimeout: number;  // 秒
  permissions: SystemPermissions;
}

/**
 * 场景系统设置
 */
export interface SceneSystemSettings {
  volume?: VolumeSettings;
  brightness?: number;
  autoBrightness?: boolean;
  doNotDisturb?: boolean | DoNotDisturbMode;
  wifi?: boolean;
  bluetooth?: boolean;
  screenTimeout?: number;  // 秒
}

/**
 * 场景系统预设
 */
export type SceneSystemPresets = Record<SceneType, Partial<SceneSystemSettings>>;

/**
 * 设置操作结果
 */
export interface SettingsOperationResult {
  success: boolean;
  error?: string;
  settingsOpened?: boolean;
}

/**
 * 批量设置结果
 */
export interface BatchSettingsResult {
  results: Record<string, boolean>;
  success: boolean;
  hasErrors: boolean;
}

// ==================== 应用启动类型 ====================

/**
 * 深度链接配置
 */
export interface DeepLinkConfig {
  packageName: string;
  deepLink: string;
  fallback?: string;
  description?: string;
}

/**
 * 应用推荐
 */
export interface AppRecommendation {
  packageName: string;
  appName: string;
  score: number;        // 推荐分数 0-1
  reason: string;       // 推荐原因
  deepLink?: string;
}

/**
 * 应用使用记录
 */
export interface AppUsageRecord {
  packageName: string;
  launchCount: number;
  totalDuration: number;       // 毫秒
  lastUsed: number;            // 时间戳
  hourlyDistribution: Record<number, number>;  // 按小时统计
  sceneDistribution: Partial<Record<SceneType, number>>; // 按场景统计
  sequenceAfter: Record<string, number>;       // 连续启动统计
}

/**
 * 已安装应用信息（扩展）
 */
export interface InstalledAppInfo {
  packageName: string;
  appName: string;
  isSystemApp: boolean;
  category?: string;
  icon?: string;
  launchCount?: number;
  lastUsed?: number;
}

// ==================== 规则引擎类型 ====================

/**
 * 自动化规则条件类型
 */
export type AutomationConditionType = 
  | 'scene'       // 场景条件
  | 'time'        // 时间条件
  | 'location'    // 位置条件
  | 'app'         // 应用条件
  | 'battery'     // 电池条件
  | 'network'     // 网络条件
  | 'motion'      // 运动状态
  | 'calendar'    // 日历事件
  | 'audio'       // 音频/噪声级别条件
  | 'custom';     // 自定义条件

/**
 * 条件操作符
 */
export type ConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'greater' 
  | 'less' 
  | 'between'
  | 'in'
  | 'not_in';

/**
 * 自动化规则条件
 */
export interface AutomationCondition {
  type: AutomationConditionType;
  operator: ConditionOperator;
  value: unknown;
  field?: string;  // 可选的字段名，用于复杂条件
}

/**
 * 自动化动作类型
 */
export type AutomationActionType = 
  | 'system_setting'   // 系统设置
  | 'app_launch'       // 启动应用
  | 'notification'     // 发送通知
  | 'quick_action'     // 快捷操作
  | 'delayed'          // 延时动作
  | 'trigger_rule'     // 触发其他规则
  | 'log'              // 记录日志
  | 'custom';          // 自定义动作

/**
 * 自动化动作
 */
export interface AutomationAction {
  type: AutomationActionType;
  params: Record<string, unknown>;
  description?: string;
}

/**
 * 自动化规则
 */
export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  conditionLogic: 'AND' | 'OR';
  priority: number;           // 1-10, 10最高
  cooldown: number;           // 冷却时间（分钟）
  createdAt: number;
  updatedAt?: number;
  lastTriggered?: number;
  triggerCount?: number;
}

/**
 * 规则模板
 */
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: 'commute' | 'work' | 'home' | 'sleep' | 'custom';
  rule: Omit<AutomationRule, 'id' | 'createdAt'>;
}

/**
 * 规则执行结果
 */
export interface RuleExecutionResult {
  ruleId: string;
  success: boolean;
  executedActions: Array<{
    action: AutomationAction;
    success: boolean;
    error?: string;
    duration: number;
  }>;
  timestamp: number;
}

// ==================== 快捷操作类型 ====================

/**
 * 快捷操作分类
 */
export type QuickActionCategory = 
  | 'payment'        // 支付
  | 'navigation'     // 导航
  | 'communication'  // 通讯
  | 'system'         // 系统
  | 'entertainment'  // 娱乐
  | 'custom';        // 自定义

/**
 * 操作分类别名（用于新的快捷操作系统）
 */
export type ActionCategory = QuickActionCategory;

/**
 * 快捷操作（旧版 - 用于兼容）
 */
export interface LegacyQuickAction {
  id: string;
  label: string;
  description?: string;
  icon: string;
  category: QuickActionCategory;
  sceneRelevance: Partial<Record<SceneType, number>>; // 0-1 场景相关性
  execute: () => Promise<QuickActionResult>;
  isAvailable: () => Promise<boolean>;
  requiredPermissions?: string[];
}

/**
 * 快捷操作动作类型
 */
export type QuickActionType = 
  | 'system_setting'   // 系统设置
  | 'app_launch'       // 启动应用
  | 'deep_link'        // 深度链接
  | 'composite';       // 组合操作

/**
 * 时间范围
 */
export interface TimeRange {
  start: string;  // HH:mm 格式
  end: string;
}

/**
 * 上下文触发条件
 */
export interface ContextTrigger {
  scenes: SceneType[];
  timeRanges?: TimeRange[];
}

/**
 * 快捷操作（新版）
 */
export interface QuickAction {
  id: string;
  name: string;
  description?: string;
  icon: string;
  category: ActionCategory;
  actionType: QuickActionType;
  actionParams: Record<string, unknown>;
  contextTriggers?: ContextTrigger;
  enabled: boolean;
  priority?: number;  // 1-10, 优先级
}

/**
 * 快捷操作执行结果
 */
export interface QuickActionResult {
  success: boolean;
  actionId: string;
  error?: string;
  duration: number;
  timestamp: number;
}

/**
 * 快捷操作使用记录
 */
export interface QuickActionUsage {
  actionId: string;
  sceneType: SceneType;
  timestamp: number;
  success: boolean;
}

// ==================== 默认场景预设 ====================

/**
 * 场景预设
 */
export interface ScenePreset {
  id: string;
  name: string;
  sceneType: SceneType;
  settings: SceneSystemSettings;
  quickActions?: string[];  // 快捷操作 ID 列表
}

/**
 * 默认场景系统设置预设
 */
export const DEFAULT_SCENE_PRESETS: SceneSystemPresets = {
  COMMUTE: {
    volume: { media: 70, ring: 80 },
    bluetooth: true,
    doNotDisturb: false,
  },
  OFFICE: {
    volume: { ring: 0, notification: 30 },
    doNotDisturb: 'priority',
    screenTimeout: 120,
  },
  HOME: {
    wifi: true,
    volume: { media: 60, ring: 100 },
    doNotDisturb: false,
  },
  STUDY: {
    doNotDisturb: true,
    volume: { ring: 0, notification: 0 },
    screenTimeout: 300,
  },
  SLEEP: {
    doNotDisturb: true,
    brightness: 10,
    volume: { ring: 0, media: 0 },
  },
  TRAVEL: {
    bluetooth: true,
    volume: { media: 50, ring: 100 },
  },
  UNKNOWN: {},
};
