/**
 * 智能建议系统类型定义
 * 
 * 包含上下文聚合、智能建议、智能动作、模板槽位等核心类型
 */

import type { SceneType, AppCategory } from '../../types';

// ==================== 时间上下文 ====================

/**
 * 时段类型
 */
export type TimeOfDayType = 
  | 'dawn'       // 凌晨 (5-7)
  | 'morning'    // 早晨 (7-12)
  | 'noon'       // 中午 (12-14)
  | 'afternoon'  // 下午 (14-18)
  | 'evening'    // 傍晚 (18-21)
  | 'night'      // 夜间 (21-24)
  | 'midnight';  // 深夜 (0-5)

/**
 * 时间上下文
 */
export interface TimeContext {
  /** 小时 (0-23) */
  hour: number;
  /** 分钟 (0-59) */
  minute: number;
  /** 星期几 (0-6, 0=周日) */
  dayOfWeek: number;
  /** 是否周末 */
  isWeekend: boolean;
  /** 是否节假日 */
  isHoliday: boolean;
  /** 时段类型 */
  timeOfDay: TimeOfDayType;
  /** 时间描述 (如 "周五下午3点") */
  timeDescription: string;
}

// ==================== 图像分析上下文 ====================

/**
 * 环境类型
 */
export type EnvironmentType = 'indoor' | 'outdoor' | 'transport' | 'unknown';

/**
 * 标签置信度对
 */
export interface LabelScore {
  label: string;
  score: number;
}

/**
 * 图像分析上下文
 */
export interface ImageContext {
  /** 数据是否可用 */
  available: boolean;
  /** 最高置信度标签 */
  topLabel: string;
  /** 最高置信度分数 */
  topScore: number;
  /** 所有标签和分数 */
  allLabels: LabelScore[];
  /** 环境类型 */
  environmentType: EnvironmentType;
  /** 具体地点描述 (如 "地铁车厢") */
  specificPlace: string;
}

// ==================== 音频分析上下文 ====================

/**
 * 声音环境类型
 */
export type SoundEnvironment = 'quiet' | 'moderate' | 'noisy';

/**
 * 音频分析上下文
 */
export interface AudioContext {
  /** 数据是否可用 */
  available: boolean;
  /** 最高置信度标签 */
  topLabel: string;
  /** 最高置信度分数 */
  topScore: number;
  /** 所有标签和分数 */
  allLabels: LabelScore[];
  /** 声音环境 */
  soundEnvironment: SoundEnvironment;
  /** 主要声音描述 (如 "有人在说话") */
  dominantSound: string;
}

// ==================== 位置上下文 ====================

/**
 * 交通方式
 */
export type TransportMode = 'walking' | 'vehicle' | 'still' | 'unknown';

/**
 * 位置上下文
 */
export interface LocationContext {
  /** 数据是否可用 */
  available: boolean;
  /** 匹配的围栏名称 */
  matchedFence: string | null;
  /** 连接的 WiFi SSID */
  wifiSSID: string | null;
  /** 是否在移动中 */
  isMoving: boolean;
  /** 交通方式 */
  transportMode: TransportMode;
}

// ==================== 日历上下文 ====================

/**
 * 即将到来的事件
 */
export interface UpcomingEvent {
  /** 事件标题 */
  title: string;
  /** 距开始还有几分钟 */
  minutesUntil: number;
  /** 事件地点 */
  location: string;
  /** 预计时长(分钟) */
  durationMinutes?: number;
}

/**
 * 日历上下文
 */
export interface CalendarContext {
  /** 数据是否可用 */
  available: boolean;
  /** 即将到来的事件 */
  upcomingEvent: UpcomingEvent | null;
  /** 是否正在会议中 */
  isInMeeting: boolean;
}

// ==================== 设备状态上下文 ====================

/**
 * 设备状态上下文
 */
export interface DeviceContext {
  /** 电池电量 (0-100) */
  batteryLevel: number;
  /** 是否正在充电 */
  isCharging: boolean;
  /** 屏幕亮度 (0-1) */
  screenBrightness: number;
  /** 是否开启勿扰模式 */
  isDNDEnabled: boolean;
  /** 已连接的蓝牙设备 */
  connectedBluetooth: string[];
}

// ==================== 用户历史上下文 ====================

/**
 * 反馈历史统计
 */
export interface FeedbackHistoryStats {
  /** 接受率 (0-1) */
  acceptRate: number;
  /** 偏好应用列表 */
  preferredApps: string[];
  /** 活跃时段 */
  activeHours: number[];
}

/**
 * 使用模式
 */
export interface UsagePatterns {
  /** 早间惯例 */
  morningRoutine: string[];
  /** 晚间惯例 */
  eveningRoutine: string[];
}

/**
 * 用户历史上下文
 */
export interface UserContext {
  /** 上一次场景类型 */
  lastSceneType: SceneType;
  /** 连续相同场景计数 */
  consecutiveSceneCount: number;
  /** 反馈历史统计 */
  feedbackHistory: FeedbackHistoryStats;
  /** 使用模式 */
  usagePatterns: UsagePatterns;
  /** 今日通勤次数 */
  commuteCountToday: number;
}

// ==================== 场景上下文 ====================

/**
 * 备选场景
 */
export interface AlternativeScene {
  type: SceneType;
  confidence: number;
}

/**
 * 场景上下文
 */
export interface SceneContext {
  /** 场景类型 */
  type: SceneType;
  /** 置信度 (0-1) */
  confidence: number;
  /** 备选场景列表 */
  alternativeScenes: AlternativeScene[];
  /** 信号列表 (如 ["时间:下班高峰", "位置:地铁站"]) */
  signals: string[];
}

// ==================== 聚合上下文 ====================

/**
 * 聚合上下文 - 收集所有数据源的完整上下文
 */
export interface AggregatedContext {
  /** 时间上下文 */
  time: TimeContext;
  /** 图像分析上下文 */
  image: ImageContext;
  /** 音频分析上下文 */
  audio: AudioContext;
  /** 位置上下文 */
  location: LocationContext;
  /** 日历上下文 */
  calendar: CalendarContext;
  /** 设备状态 */
  device: DeviceContext;
  /** 用户历史 */
  user: UserContext;
  /** 综合场景判断 */
  scene: SceneContext;
  /** 生成时间戳 */
  timestamp: number;
}

// ==================== 智能动作 ====================

/**
 * 动作类型
 */
export type SmartActionType = 'system' | 'app' | 'notification';

/**
 * 动作分组
 */
export type SmartActionGroup = 'primary' | 'optional';

/**
 * 智能动作
 */
export interface SmartAction {
  /** 动作 ID */
  id: string;
  /** 显示标签 */
  label: string;
  /** 动作理由 */
  reason: string;
  /** 动作类型 */
  type: SmartActionType;
  /** 实际执行的操作名称 (system 类型时必须) */
  action?: string;
  /** 优先级 (越高越靠前) */
  priority: number;
  /** 是否可执行 */
  executable: boolean;
  /** 执行参数 */
  params: Record<string, any>;
  /** 分组 */
  group?: SmartActionGroup;
  /** 应用类别 (仅 app 类型) */
  appCategory?: AppCategory;
}

// ==================== 智能建议 ====================

/**
 * 置信度级别
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * 智能建议
 */
export interface SmartSuggestion {
  /** 主标题 */
  headline: string;
  /** 副标题 */
  subtext: string;
  /** 上下文说明列表 */
  contextNotes: string[];
  /** 可执行动作列表 */
  actions: SmartAction[];
  /** 生成时间戳 */
  generatedAt: number;
  /** 上下文哈希 (用于判断上下文是否变化) */
  contextHash: string;
  /** 置信度级别 */
  confidenceLevel: ConfidenceLevel;
  /** 场景类型 */
  sceneType: SceneType;
  /** 子场景 ID */
  subSceneId?: string;
}

// ==================== 模板系统 ====================

/**
 * 槽位填充条件
 */
export interface SlotCondition {
  /** 条件表达式 */
  when: string;
  /** 满足条件时的值 */
  value: string;
}

/**
 * 槽位填充配置
 */
export interface SlotFillerConfig {
  /** 条件列表 */
  conditions?: Array<SlotCondition & { default?: string }>;
  /** 映射表 */
  mapping?: Record<string, string>;
  /** 数据源路径 (如 "time.dayOfWeek") */
  source?: string;
  /** 默认值 */
  default?: string;
}

/**
 * 模板槽位
 */
export interface TemplateSlot {
  /** 槽位名称 */
  name: string;
  /** 填充函数 */
  filler: (ctx: AggregatedContext) => string;
  /** 默认值 */
  fallback: string;
}

/**
 * 子场景定义
 */
export interface SubSceneDefinition {
  /** 子场景 ID */
  id: string;
  /** 触发条件表达式列表 */
  conditions: string[];
  /** 主标题模板列表 */
  headlines: string[];
  /** 副标题模板列表 */
  subtexts: string[];
  /** 动作理由模板 (某些动作类型可能不存在) */
  actionReasons: { [key: string]: string[] | undefined };
  /** 权重 (0-1) */
  weight: number;
}

/**
 * 场景模板配置
 */
export interface SceneTemplateConfig {
  /** 场景类型 */
  scene: SceneType;
  /** 子场景列表 */
  subScenes: SubSceneDefinition[];
  /** 槽位填充配置 */
  slotFillers: Record<string, SlotFillerConfig>;
}

/**
 * 建议模板
 */
export interface SuggestionTemplate {
  /** 模板 ID */
  id: string;
  /** 场景类型 */
  scene: SceneType;
  /** 子场景 ID */
  subScene?: string;
  /** 触发条件 */
  conditions?: Array<(ctx: AggregatedContext) => boolean>;
  /** 主标题列表 */
  headlines: string[];
  /** 副标题列表 */
  subtexts: string[];
  /** 动作理由模板 */
  actionReasons: Record<string, string[]>;
  /** 权重 */
  weight: number;
}

// ==================== 个性化配置 ====================

/**
 * 语气风格
 */
export type ToneStyle = 'formal' | 'casual' | 'enthusiastic';

/**
 * 详细程度
 */
export type VerbosityLevel = 'concise' | 'normal' | 'detailed';

/**
 * 个性化因子
 */
export interface PersonalizationFactors {
  /** 语气风格 */
  tone: ToneStyle;
  /** 详细程度 */
  verbosity: VerbosityLevel;
  /** 建议数量 */
  suggestionCount: number;
  /** 偏好应用 */
  preferredApps: string[];
}

// ==================== 共享模板类型 ====================

/**
 * 共享槽位填充器配置
 */
export interface SharedSlotFillers {
  /** 问候语 */
  greeting: SlotFillerConfig;
  /** 星期名称 */
  weekday_name: SlotFillerConfig;
  /** 时段描述 */
  time_period: SlotFillerConfig;
  /** 电量描述 */
  battery_hint: SlotFillerConfig;
  /** 音频环境描述 */
  audio_env_hint: SlotFillerConfig;
}

/**
 * 通用片段
 */
export interface CommonSnippets {
  /** 低电量提示 */
  low_battery: string[];
  /** 充电中提示 */
  charging: string[];
  /** 会议提醒 */
  meeting_reminder: string[];
  /** 鼓励语 */
  encouragement: string[];
}

/**
 * 共享模板配置
 */
export interface SharedTemplateConfig {
  /** 版本号 */
  version: string;
  /** 共享槽位填充器 */
  slotFillers: SharedSlotFillers;
  /** 通用片段 */
  commonSnippets: CommonSnippets;
}
