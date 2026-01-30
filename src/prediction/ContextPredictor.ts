/**
 * ContextPredictor - 上下文预测器
 * 
 * 整合时间模式和行为分析，提供上下文感知的预测：
 * - 预测下一场景和时间
 * - 出发提醒判断
 * - 日历感知建议
 * - 天气感知建议
 * 
 * @module prediction
 */

import { timePatternEngine } from './TimePatternEngine';
import { behaviorAnalyzer } from './BehaviorAnalyzer';
import type { SceneType, SilentContext } from '../types';
import type {
  ScenePrediction,
  DepartureReminder,
  CalendarSuggestion,
  WeatherSuggestion,
  PredictionContext,
  BehaviorPattern,
  PatternMatchResult,
} from './types';

// ==================== 配置常量 ====================

const CONFIG = {
  /** 默认通勤时间（分钟） */
  DEFAULT_COMMUTE_TIME: 45,
  /** 出发提醒提前时间（分钟） */
  DEPARTURE_REMINDER_ADVANCE: 15,
  /** 预测时间窗口（分钟） */
  PREDICTION_WINDOW_MINUTES: 180,
};

// ==================== 辅助函数 ====================

/**
 * 获取场景标签
 */
function getSceneLabel(scene: SceneType): string {
  const labels: Record<SceneType, string> = {
    COMMUTE: '通勤',
    OFFICE: '办公室',
    HOME: '家',
    STUDY: '学习',
    SLEEP: '睡眠',
    TRAVEL: '出行',
    UNKNOWN: '未知',
  };
  return labels[scene] || scene;
}

/**
 * 解析时间字符串为分钟数
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 分钟数转换为时间字符串
 */
function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * 判断是否工作日
 */
function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

// ==================== ContextPredictor 类 ====================

export class ContextPredictor {
  private initialized: boolean = false;
  private lastPrediction: ScenePrediction | null = null;
  private commuteEstimate: number = CONFIG.DEFAULT_COMMUTE_TIME;

  constructor() {}

  /**
   * 初始化预测器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await timePatternEngine.initialize();
      await behaviorAnalyzer.initialize();
      this.initialized = true;
      console.log('[ContextPredictor] Initialized');
    } catch (error) {
      console.error('[ContextPredictor] Failed to initialize:', error);
    }
  }

  /**
   * 获取预测上下文
   */
  getPredictionContext(currentScene: SceneType): PredictionContext {
    const now = new Date();
    const day = now.getDay();

    let locationType: 'home' | 'office' | 'commute' | 'other' = 'other';
    switch (currentScene) {
      case 'HOME':
      case 'SLEEP':
        locationType = 'home';
        break;
      case 'OFFICE':
      case 'STUDY':
        locationType = 'office';
        break;
      case 'COMMUTE':
        locationType = 'commute';
        break;
    }

    return {
      currentTime: now,
      currentScene,
      locationType,
      dayOfWeek: day || 7,
      isWeekday: isWeekday(now),
    };
  }

  /**
   * 预测下一个场景及时间
   */
  async predictTimeToNextScene(currentScene?: SceneType): Promise<ScenePrediction | null> {
    await this.initialize();

    const prediction = timePatternEngine.predictNextScene();
    
    if (prediction) {
      this.lastPrediction = prediction;
      return prediction;
    }

    // 如果没有基于模式的预测，尝试基于当前场景推断
    if (currentScene) {
      return this.inferNextScene(currentScene);
    }

    return null;
  }

  /**
   * 基于当前场景推断下一场景
   */
  private inferNextScene(currentScene: SceneType): ScenePrediction | null {
    const now = new Date();
    const hour = now.getHours();
    const isWorkday = isWeekday(now);

    // 基于常识的场景转换规则
    const inferenceRules: Record<SceneType, { next: SceneType; conditions: () => boolean; minutesUntil: number }[]> = {
      HOME: [
        { next: 'COMMUTE', conditions: () => isWorkday && hour >= 7 && hour < 9, minutesUntil: 30 },
        { next: 'SLEEP', conditions: () => hour >= 22 || hour < 1, minutesUntil: 60 },
      ],
      OFFICE: [
        { next: 'COMMUTE', conditions: () => hour >= 17 && hour < 20, minutesUntil: 60 },
        { next: 'STUDY', conditions: () => hour >= 14 && hour < 17, minutesUntil: 30 },
      ],
      COMMUTE: [
        { next: 'OFFICE', conditions: () => isWorkday && hour < 12, minutesUntil: this.commuteEstimate },
        { next: 'HOME', conditions: () => hour >= 17, minutesUntil: this.commuteEstimate },
      ],
      STUDY: [
        { next: 'HOME', conditions: () => hour >= 21, minutesUntil: 30 },
        { next: 'OFFICE', conditions: () => hour >= 9 && hour < 12, minutesUntil: 15 },
      ],
      SLEEP: [
        { next: 'HOME', conditions: () => hour >= 6 && hour < 9, minutesUntil: 30 },
      ],
      TRAVEL: [
        { next: 'HOME', conditions: () => true, minutesUntil: 120 },
      ],
      UNKNOWN: [],
    };

    const rules = inferenceRules[currentScene] || [];
    
    for (const rule of rules) {
      if (rule.conditions()) {
        const predictedMinutes = now.getHours() * 60 + now.getMinutes() + rule.minutesUntil;
        return {
          sceneType: rule.next,
          predictedTime: minutesToTimeString(predictedMinutes),
          confidence: 0.5, // 推断的置信度较低
          minutesUntil: rule.minutesUntil,
        };
      }
    }

    return null;
  }

  /**
   * 判断是否应该提醒出发
   */
  async shouldRemindDeparture(currentScene: SceneType): Promise<DepartureReminder> {
    await this.initialize();

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const context = this.getPredictionContext(currentScene);

    // 只在家或办公室时提醒出发
    if (context.locationType !== 'home' && context.locationType !== 'office') {
      return { shouldRemind: false, message: '' };
    }

    // 获取通常的出发/到达时间
    let targetTime: string | null = null;
    let targetScene: SceneType | null = null;

    if (context.locationType === 'home' && context.isWeekday) {
      // 在家，工作日 -> 提醒去上班
      targetTime = timePatternEngine.getUsualArrivalTime('OFFICE');
      targetScene = 'OFFICE';
    } else if (context.locationType === 'office') {
      // 在办公室 -> 提醒回家
      targetTime = timePatternEngine.getUsualArrivalTime('HOME');
      targetScene = 'HOME';
    }

    if (!targetTime || !targetScene) {
      return { shouldRemind: false, message: '' };
    }

    const targetMinutes = parseTimeToMinutes(targetTime);
    const departureMinutes = targetMinutes - this.commuteEstimate;
    const reminderMinutes = departureMinutes - CONFIG.DEPARTURE_REMINDER_ADVANCE;

    // 检查是否在提醒时间窗口内
    if (currentMinutes >= reminderMinutes && currentMinutes < departureMinutes) {
      const minutesUntilDeparture = departureMinutes - currentMinutes;
      return {
        shouldRemind: true,
        message: `您通常在 ${minutesToTimeString(departureMinutes)} 出发去${getSceneLabel(targetScene)}，大约 ${minutesUntilDeparture} 分钟后`,
        targetScene,
        suggestedDepartureTime: minutesToTimeString(departureMinutes),
        estimatedCommute: this.commuteEstimate,
      };
    }

    return { shouldRemind: false, message: '' };
  }

  /**
   * 获取日历感知建议
   * 注意：实际实现需要集成日历 API
   */
  async getCalendarAwareSuggestions(): Promise<CalendarSuggestion[]> {
    // TODO: 集成设备日历 API
    // 这里提供模拟实现框架
    const suggestions: CalendarSuggestion[] = [];
    const now = new Date();
    const hour = now.getHours();

    // 模拟：早上提醒今日日程
    if (hour >= 7 && hour < 9) {
      suggestions.push({
        id: 'morning_schedule',
        eventTitle: '今日日程概览',
        eventTime: '全天',
        suggestion: '查看今日日程安排',
        type: 'reminder',
        priority: 'medium',
      });
    }

    return suggestions;
  }

  /**
   * 获取天气感知建议
   * 注意：实际实现需要集成天气 API
   */
  async getWeatherAwareSuggestions(): Promise<WeatherSuggestion[]> {
    // TODO: 集成天气 API
    // 这里提供模拟实现框架
    const suggestions: WeatherSuggestion[] = [];

    // 可以根据实际天气数据生成建议
    // 例如：下雨提醒带伞，高温提醒防晒等

    return suggestions;
  }

  /**
   * 获取当前上下文的行为建议
   */
  async getContextualSuggestions(context: SilentContext): Promise<{
    prediction: ScenePrediction | null;
    departureReminder: DepartureReminder;
    behaviorMatches: PatternMatchResult[];
    calendarSuggestions: CalendarSuggestion[];
  }> {
    await this.initialize();

    const [prediction, departureReminder, calendarSuggestions] = await Promise.all([
      this.predictTimeToNextScene(context.context),
      this.shouldRemindDeparture(context.context),
      this.getCalendarAwareSuggestions(),
    ]);

    const behaviorMatches = behaviorAnalyzer.matchCurrentPattern(context);

    return {
      prediction,
      departureReminder,
      behaviorMatches,
      calendarSuggestions,
    };
  }

  /**
   * 记录场景变化（同步到各引擎）
   */
  async onSceneChange(
    newScene: SceneType,
    confidence: number,
    previousScene?: SceneType
  ): Promise<void> {
    await this.initialize();

    // 记录到时间模式引擎
    await timePatternEngine.recordSceneChange(newScene, confidence);

    // 记录到行为分析器
    await behaviorAnalyzer.recordBehavior(newScene);

    // 如果是通勤结束，更新通勤时间估计
    if (previousScene === 'COMMUTE' && (newScene === 'HOME' || newScene === 'OFFICE')) {
      // 可以根据实际通勤时间更新估计值
      // this.updateCommuteEstimate(actualDuration);
    }

    console.log(`[ContextPredictor] Scene change recorded: ${previousScene || 'UNKNOWN'} -> ${newScene}`);
  }

  /**
   * 更新通勤时间估计
   */
  updateCommuteEstimate(minutes: number): void {
    // 使用指数移动平均更新估计
    const alpha = 0.3;
    this.commuteEstimate = Math.round(alpha * minutes + (1 - alpha) * this.commuteEstimate);
    console.log(`[ContextPredictor] Commute estimate updated: ${this.commuteEstimate} minutes`);
  }

  /**
   * 获取预测统计
   */
  getStats(): {
    timePatternStats: ReturnType<typeof timePatternEngine.getStatsSummary>;
    behaviorStats: ReturnType<typeof behaviorAnalyzer.getStats>;
    commuteEstimate: number;
    lastPrediction: ScenePrediction | null;
  } {
    return {
      timePatternStats: timePatternEngine.getStatsSummary(),
      behaviorStats: behaviorAnalyzer.getStats(),
      commuteEstimate: this.commuteEstimate,
      lastPrediction: this.lastPrediction,
    };
  }

  /**
   * 手动触发模式分析
   */
  async analyzeAllPatterns(): Promise<void> {
    await this.initialize();
    await Promise.all([
      timePatternEngine.analyzePatterns(),
      behaviorAnalyzer.analyzePatterns(),
    ]);
    console.log('[ContextPredictor] All patterns analyzed');
  }

  /**
   * 清除所有预测数据
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      timePatternEngine.clearAll(),
      behaviorAnalyzer.clearAll(),
    ]);
    this.lastPrediction = null;
    this.commuteEstimate = CONFIG.DEFAULT_COMMUTE_TIME;
    console.log('[ContextPredictor] All data cleared');
  }
}

// 导出单例
export const contextPredictor = new ContextPredictor();
export default contextPredictor;
