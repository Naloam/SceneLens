/**
 * SceneLens 核心类型定义
 */

// ==================== 场景类型 ====================

/**
 * 场景类型枚举
 */
export type SceneType = 
  | 'COMMUTE'      // 通勤
  | 'OFFICE'       // 办公/会议
  | 'HOME'         // 在家
  | 'STUDY'        // 学习/专注
  | 'SLEEP'        // 睡前
  | 'TRAVEL'       // 出行（火车站/机场）
  | 'UNKNOWN';     // 未知

/**
 * 上下文信号类型
 */
export type SignalType = 
  | 'TIME'           // 时间信号
  | 'LOCATION'       // 位置信号
  | 'MOTION'         // 运动状态
  | 'WIFI'           // Wi-Fi 信号
  | 'FOREGROUND_APP' // 前台应用
  | 'CALENDAR'       // 日历事件
  | 'BATTERY'        // 电池状态
  | 'SCREEN';        // 屏幕状态

/**
 * 上下文信号
 */
export interface ContextSignal {
  type: SignalType;
  value: string;
  weight: number;      // 0-1，信号权重
  timestamp: number;
}

/**
 * 静默场景上下文
 */
export interface SilentContext {
  timestamp: number;
  context: SceneType;
  confidence: number;  // 0-1，置信度
  signals: ContextSignal[];
}

// ==================== 位置相关 ====================

/**
 * 位置信息
 */
export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;    // 精度（米）
  timestamp: number;
}

/**
 * Wi-Fi 信息
 */
export interface WiFiInfo {
  ssid: string;
  bssid: string;
  signalStrength: number;
}

/**
 * 地理围栏类型
 */
export type GeoFenceType = 
  | 'HOME'           // 家
  | 'OFFICE'         // 办公室
  | 'SUBWAY_STATION' // 地铁站
  | 'CUSTOM';        // 自定义

/**
 * 地理围栏
 */
export interface GeoFence {
  id: string;
  name: string;
  type: GeoFenceType;
  latitude: number;
  longitude: number;
  radius: number;      // 半径（米）
  wifiSSID?: string;   // 可选的 Wi-Fi 辅助定位
}

// ==================== 运动状态 ====================

/**
 * 运动状态
 */
export type MotionState = 
  | 'STILL'      // 静止
  | 'WALKING'    // 步行
  | 'RUNNING'    // 跑步
  | 'VEHICLE';   // 交通工具

// ==================== 应用相关 ====================

/**
 * 应用类别
 */
export type AppCategory = 
  | 'MUSIC_PLAYER'   // 音乐播放器
  | 'TRANSIT_APP'    // 交通出行
  | 'PAYMENT_APP'    // 支付应用
  | 'MEETING_APP'    // 会议应用
  | 'STUDY_APP'      // 学习应用
  | 'SMART_HOME'     // 智能家居
  | 'CALENDAR'       // 日历
  | 'OTHER';         // 其他

/**
 * 应用信息
 */
export interface AppInfo {
  packageName: string;
  appName: string;
  category: AppCategory;
  icon: string;
  isSystemApp: boolean;
}

/**
 * 应用偏好
 */
export interface AppPreference {
  category: AppCategory;
  topApps: string[];     // 包名列表，按使用频率排序
  lastUpdated: number;
}

/**
 * 应用使用统计
 */
export interface UsageStats {
  packageName: string;
  totalTimeInForeground: number;  // 前台时长（毫秒）
  launchCount: number;            // 启动次数
  lastTimeUsed: number;           // 最后使用时间
}

// ==================== 日历相关 ====================

/**
 * 日历事件
 */
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  location?: string;
  description?: string;
}

// ==================== 规则引擎 ====================

/**
 * 规则优先级
 */
export type RulePriority = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * 规则模式
 */
export type RuleMode = 
  | 'SUGGEST_ONLY'  // 仅建议
  | 'ONE_TAP'       // 一键执行
  | 'AUTO';         // 自动执行

/**
 * 条件类型
 */
export type ConditionType = 
  | 'time'
  | 'location'
  | 'motion'
  | 'wifi'
  | 'app_usage'
  | 'calendar'
  | 'battery'
  | 'screen';

/**
 * 规则条件
 */
export interface Condition {
  type: ConditionType;
  value: string;
  weight: number;
}

/**
 * 动作目标
 */
export type ActionTarget = 
  | 'system'        // 系统设置
  | 'app'           // 应用
  | 'notification'; // 通知

/**
 * 规则动作
 */
export interface Action {
  target: ActionTarget;
  action: string;
  intent?: string;      // 应用意图（如 TRANSIT_APP_TOP1）
  deepLink?: string;    // Deep Link
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

// ==================== 执行结果 ====================

/**
 * 执行结果
 */
export interface ExecutionResult {
  action: Action;
  success: boolean;
  error?: string;
  duration: number;
}

// ==================== 用户反馈 ====================

/**
 * 用户反馈类型
 */
export type UserFeedback = 
  | 'accept'   // 接受
  | 'ignore'   // 忽略
  | 'cancel';  // 取消

/**
 * 触发历史
 */
export interface TriggerHistory {
  sceneType: SceneType;
  lastTriggerTime: number;
  acceptCount: number;
  ignoreCount: number;
  cancelCount: number;
}

/**
 * 场景历史
 */
export interface SceneHistory {
  sceneType: SceneType;
  timestamp: number;
  confidence: number;
  triggered: boolean;
  userAction: UserFeedback | null;
  executionResults?: ExecutionResult[];
}

// ==================== 用户配置 ====================

/**
 * 用户配置
 */
export interface UserConfig {
  onboardingCompleted: boolean;
  permissionsGranted: string[];
  enabledScenes: SceneType[];
  autoModeScenes: SceneType[];
}

// ==================== 存储键 ====================

/**
 * 存储键定义
 */
export const StorageKeys = {
  APP_PREFERENCES: 'app_preferences',
  SCENE_HISTORY: 'scene_history',
  USER_FEEDBACK: 'user_feedback',
  RULE_WEIGHTS: 'rule_weights',
  GEO_FENCES: 'geo_fences',
  USER_CONFIG: 'user_config',
} as const;

// ==================== 错误处理 ====================

/**
 * 错误码
 */
export enum ErrorCode {
  // 权限错误
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PERMISSION_REQUIRED = 'PERMISSION_REQUIRED',
  
  // 系统错误
  SYSTEM_API_FAILED = 'SYSTEM_API_FAILED',
  DEVICE_NOT_SUPPORTED = 'DEVICE_NOT_SUPPORTED',
  
  // 应用错误
  APP_NOT_FOUND = 'APP_NOT_FOUND',
  APP_LAUNCH_FAILED = 'APP_LAUNCH_FAILED',
  DEEP_LINK_INVALID = 'DEEP_LINK_INVALID',
  
  // 模型错误
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  MODEL_INFERENCE_FAILED = 'MODEL_INFERENCE_FAILED',
  
  // 网络错误
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  
  // 数据错误
  DATA_CORRUPTED = 'DATA_CORRUPTED',
  STORAGE_FULL = 'STORAGE_FULL',
}

/**
 * SceneLens 错误
 */
export class SceneLensError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'SceneLensError';
  }
}

// ==================== 预测相关 ====================

/**
 * 预测结果
 */
export interface Prediction {
  label: string;
  score: number;
}

/**
 * 用户触发的上下文
 */
export interface TriggeredContext {
  timestamp: number;
  predictions: Prediction[];
  confidence: number;
}

/**
 * 触发决策
 */
export interface TriggerDecision {
  suggest: boolean;
  reason?: string;
  sceneType?: SceneType;
  confidence?: number;
}
