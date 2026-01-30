/**
 * 预测引擎类型定义
 * 
 * @module prediction
 */

import type { SceneType } from '../types';

// ==================== 时间模式类型 ====================

/**
 * 时间模式周期类型
 */
export type PatternPeriod = 'daily' | 'weekly' | 'monthly';

/**
 * 时间模式
 */
export interface TimePattern {
  /** 模式 ID */
  id: string;
  /** 周期类型 */
  period: PatternPeriod;
  /** 触发时间 (HH:mm) */
  triggerTime: string;
  /** 触发日期（周几 1-7 或 月几 1-31） */
  triggerDays?: number[];
  /** 关联场景 */
  sceneType: SceneType;
  /** 置信度 0-1 */
  confidence: number;
  /** 样本数量 */
  sampleCount: number;
  /** 平均持续时间（分钟） */
  avgDuration?: number;
  /** 最后出现时间 */
  lastOccurrence?: number;
}

/**
 * 场景历史记录
 */
export interface SceneHistoryRecord {
  /** 场景类型 */
  sceneType: SceneType;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 持续时间（分钟） */
  duration?: number;
  /** 置信度 */
  confidence: number;
  /** 星期几 (1-7) */
  dayOfWeek: number;
  /** 小时 (0-23) */
  hour: number;
}

/**
 * 场景预测结果
 */
export interface ScenePrediction {
  /** 预测的场景 */
  sceneType: SceneType;
  /** 预测时间 */
  predictedTime: string;
  /** 置信度 */
  confidence: number;
  /** 基于的模式 */
  basedOnPattern?: string;
  /** 预计距离（分钟） */
  minutesUntil: number;
}

/**
 * 异常检测结果
 */
export interface SceneAnomaly {
  /** 异常类型 */
  type: 'UNEXPECTED_SCENE' | 'UNUSUAL_TIME' | 'MISSED_ROUTINE';
  /** 描述 */
  description: string;
  /** 当前场景 */
  currentScene: SceneType;
  /** 期望场景 */
  expectedScene?: SceneType;
  /** 置信度 */
  confidence: number;
  /** 检测时间 */
  detectedAt: number;
}

// ==================== 行为模式类型 ====================

/**
 * 行为模式条件类型
 */
export type PatternConditionType = 
  | 'scene'       // 场景条件
  | 'time'        // 时间条件
  | 'day'         // 星期条件
  | 'app'         // 应用条件
  | 'sequence';   // 序列条件

/**
 * 行为模式条件
 */
export interface PatternCondition {
  /** 条件类型 */
  type: PatternConditionType;
  /** 条件值 */
  value: string | number | string[] | number[];
  /** 条件操作符 */
  operator?: 'equals' | 'in' | 'between' | 'after' | 'before';
}

/**
 * 行为模式
 */
export interface BehaviorPattern {
  /** 模式 ID */
  id: string;
  /** 模式描述 */
  description: string;
  /** 触发条件 */
  conditions: PatternCondition[];
  /** 发生频率 */
  frequency: number;
  /** 最后出现时间 */
  lastOccurrence: number;
  /** 置信度 */
  confidence: number;
  /** 关联应用 */
  relatedApps?: string[];
  /** 关联场景 */
  relatedScenes?: SceneType[];
  /** 建议操作 */
  suggestedAction?: {
    type: 'launch_app' | 'adjust_settings' | 'show_reminder' | 'custom';
    payload: Record<string, unknown>;
  };
}

/**
 * 模式匹配结果
 */
export interface PatternMatchResult {
  /** 匹配的模式 */
  pattern: BehaviorPattern;
  /** 匹配分数 0-1 */
  matchScore: number;
  /** 匹配的条件 */
  matchedConditions: PatternCondition[];
}

// ==================== 上下文预测类型 ====================

/**
 * 出发提醒
 */
export interface DepartureReminder {
  /** 是否应该提醒 */
  shouldRemind: boolean;
  /** 提醒消息 */
  message: string;
  /** 目标场景 */
  targetScene?: SceneType;
  /** 建议出发时间 */
  suggestedDepartureTime?: string;
  /** 预计通勤时间（分钟） */
  estimatedCommute?: number;
}

/**
 * 日历感知建议
 */
export interface CalendarSuggestion {
  /** 建议 ID */
  id: string;
  /** 事件标题 */
  eventTitle: string;
  /** 事件时间 */
  eventTime: string;
  /** 建议内容 */
  suggestion: string;
  /** 建议类型 */
  type: 'prepare' | 'reminder' | 'travel';
  /** 优先级 */
  priority: 'low' | 'medium' | 'high';
}

/**
 * 天气感知建议
 */
export interface WeatherSuggestion {
  /** 建议 ID */
  id: string;
  /** 天气状况 */
  weatherCondition: string;
  /** 建议内容 */
  suggestion: string;
  /** 建议类型 */
  type: 'clothing' | 'travel' | 'activity' | 'reminder';
}

/**
 * 预测上下文
 */
export interface PredictionContext {
  /** 当前时间 */
  currentTime: Date;
  /** 当前场景 */
  currentScene: SceneType;
  /** 当前位置类型 */
  locationType?: 'home' | 'office' | 'commute' | 'other';
  /** 星期几 */
  dayOfWeek: number;
  /** 是否工作日 */
  isWeekday: boolean;
}

// ==================== 存储类型 ====================

/**
 * 预测引擎存储数据
 */
export interface PredictionStore {
  /** 场景历史 */
  sceneHistory: SceneHistoryRecord[];
  /** 时间模式 */
  timePatterns: TimePattern[];
  /** 行为模式 */
  behaviorPatterns: BehaviorPattern[];
  /** 最后分析时间 */
  lastAnalysisTime: number;
  /** 数据版本 */
  version: number;
}
