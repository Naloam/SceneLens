/**
 * BehaviorAnalyzer - 行为模式分析器
 * 
 * 发现用户的行为习惯模式：
 * - 分析场景-应用关联
 * - 识别时间-行为序列
 * - 发现重复行为模式
 * - 生成模式建议
 * 
 * @module prediction
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SceneType, SilentContext } from '../types';
import type { AppUsageRecord } from '../types/automation';
import type {
  BehaviorPattern,
  PatternCondition,
  PatternConditionType,
  PatternMatchResult,
} from './types';

// ==================== 存储键 ====================

const STORAGE_KEYS = {
  BEHAVIOR_PATTERNS: 'behavior_patterns',
  BEHAVIOR_HISTORY: 'behavior_history',
  LAST_ANALYSIS: 'behavior_last_analysis',
};

// ==================== 配置常量 ====================

const CONFIG = {
  /** 最小模式频率 */
  MIN_PATTERN_FREQUENCY: 3,
  /** 置信度阈值 */
  CONFIDENCE_THRESHOLD: 0.5,
  /** 历史记录最大数量 */
  MAX_HISTORY_SIZE: 500,
  /** 分析间隔（小时） */
  ANALYSIS_INTERVAL_HOURS: 12,
};

// ==================== 类型定义 ====================

/**
 * 行为事件记录
 */
interface BehaviorEvent {
  /** 事件时间 */
  timestamp: number;
  /** 场景类型 */
  scene: SceneType;
  /** 应用包名 */
  app?: string;
  /** 小时 */
  hour: number;
  /** 星期几 */
  dayOfWeek: number;
  /** 前一个应用 */
  previousApp?: string;
}

// ==================== 辅助函数 ====================

/**
 * 生成模式 ID
 */
function generatePatternId(): string {
  return `bp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取时间段标签
 */
function getTimeSlotLabel(hour: number): string {
  if (hour >= 6 && hour < 9) return '早晨';
  if (hour >= 9 && hour < 12) return '上午';
  if (hour >= 12 && hour < 14) return '中午';
  if (hour >= 14 && hour < 18) return '下午';
  if (hour >= 18 && hour < 21) return '晚间';
  if (hour >= 21 || hour < 6) return '夜间';
  return '未知';
}

/**
 * 获取场景标签
 */
function getSceneLabel(scene: SceneType): string {
  const labels: Record<SceneType, string> = {
    COMMUTE: '通勤',
    OFFICE: '办公',
    HOME: '在家',
    STUDY: '学习',
    SLEEP: '睡眠',
    TRAVEL: '出行',
    UNKNOWN: '未知',
  };
  return labels[scene] || scene;
}

// ==================== BehaviorAnalyzer 类 ====================

export class BehaviorAnalyzer {
  private patterns: BehaviorPattern[] = [];
  private behaviorHistory: BehaviorEvent[] = [];
  private lastAnalysisTime: number = 0;
  private initialized: boolean = false;

  constructor() {}

  /**
   * 初始化分析器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadData();
      this.initialized = true;
      console.log('[BehaviorAnalyzer] Initialized with', this.behaviorHistory.length, 'events and', this.patterns.length, 'patterns');
    } catch (error) {
      console.error('[BehaviorAnalyzer] Failed to initialize:', error);
    }
  }

  /**
   * 加载数据
   */
  private async loadData(): Promise<void> {
    try {
      const [patternsStr, historyStr, lastAnalysisStr] = await AsyncStorage.multiGet([
        STORAGE_KEYS.BEHAVIOR_PATTERNS,
        STORAGE_KEYS.BEHAVIOR_HISTORY,
        STORAGE_KEYS.LAST_ANALYSIS,
      ]);

      if (patternsStr[1]) {
        this.patterns = JSON.parse(patternsStr[1]);
      }

      if (historyStr[1]) {
        this.behaviorHistory = JSON.parse(historyStr[1]);
      }

      if (lastAnalysisStr[1]) {
        this.lastAnalysisTime = parseInt(lastAnalysisStr[1], 10);
      }
    } catch (error) {
      console.error('[BehaviorAnalyzer] Failed to load data:', error);
    }
  }

  /**
   * 保存数据
   */
  private async saveData(): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.BEHAVIOR_PATTERNS, JSON.stringify(this.patterns)],
        [STORAGE_KEYS.BEHAVIOR_HISTORY, JSON.stringify(this.behaviorHistory)],
        [STORAGE_KEYS.LAST_ANALYSIS, String(this.lastAnalysisTime)],
      ]);
    } catch (error) {
      console.error('[BehaviorAnalyzer] Failed to save data:', error);
    }
  }

  /**
   * 记录行为事件
   */
  async recordBehavior(
    scene: SceneType,
    app?: string,
    previousApp?: string
  ): Promise<void> {
    await this.initialize();

    const now = new Date();
    const event: BehaviorEvent = {
      timestamp: Date.now(),
      scene,
      app,
      hour: now.getHours(),
      dayOfWeek: now.getDay() || 7,
      previousApp,
    };

    this.behaviorHistory.push(event);

    // 限制历史大小
    if (this.behaviorHistory.length > CONFIG.MAX_HISTORY_SIZE) {
      this.behaviorHistory = this.behaviorHistory.slice(-CONFIG.MAX_HISTORY_SIZE);
    }

    // 检查是否需要重新分析
    if (this.shouldReanalyze()) {
      await this.analyzePatterns();
    }

    await this.saveData();
  }

  /**
   * 检查是否应该重新分析
   */
  private shouldReanalyze(): boolean {
    const hoursSinceLastAnalysis = (Date.now() - this.lastAnalysisTime) / (1000 * 60 * 60);
    return hoursSinceLastAnalysis >= CONFIG.ANALYSIS_INTERVAL_HOURS;
  }

  /**
   * 分析行为模式
   */
  async analyzePatterns(): Promise<BehaviorPattern[]> {
    await this.initialize();

    console.log('[BehaviorAnalyzer] Analyzing patterns...');
    const newPatterns: BehaviorPattern[] = [];

    // 1. 分析场景-应用关联模式
    const sceneAppPatterns = this.analyzeSceneAppPatterns();
    newPatterns.push(...sceneAppPatterns);

    // 2. 分析时间-场景模式
    const timeScenePatterns = this.analyzeTimeScenePatterns();
    newPatterns.push(...timeScenePatterns);

    // 3. 分析应用序列模式
    const sequencePatterns = this.analyzeSequencePatterns();
    newPatterns.push(...sequencePatterns);

    // 4. 分析周期性模式
    const periodicPatterns = this.analyzePeriodicPatterns();
    newPatterns.push(...periodicPatterns);

    this.patterns = newPatterns;
    this.lastAnalysisTime = Date.now();
    await this.saveData();

    console.log(`[BehaviorAnalyzer] Found ${newPatterns.length} patterns`);
    return newPatterns;
  }

  /**
   * 分析场景-应用关联模式
   */
  private analyzeSceneAppPatterns(): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];
    const sceneAppCounts: Map<string, number> = new Map();

    // 统计场景-应用组合频率
    for (const event of this.behaviorHistory) {
      if (event.app) {
        const key = `${event.scene}:${event.app}`;
        sceneAppCounts.set(key, (sceneAppCounts.get(key) || 0) + 1);
      }
    }

    // 创建高频模式
    for (const [key, count] of sceneAppCounts) {
      if (count >= CONFIG.MIN_PATTERN_FREQUENCY) {
        const [scene, app] = key.split(':');
        const confidence = Math.min(count / 20, 1);

        if (confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
          patterns.push({
            id: generatePatternId(),
            description: `在${getSceneLabel(scene as SceneType)}时经常使用此应用`,
            conditions: [
              { type: 'scene', value: scene, operator: 'equals' },
            ],
            frequency: count,
            lastOccurrence: Date.now(),
            confidence,
            relatedApps: [app],
            relatedScenes: [scene as SceneType],
            suggestedAction: {
              type: 'launch_app',
              payload: { packageName: app },
            },
          });
        }
      }
    }

    return patterns;
  }

  /**
   * 分析时间-场景模式
   */
  private analyzeTimeScenePatterns(): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];
    const timeSceneCounts: Map<string, number> = new Map();

    // 统计时间段-场景组合频率
    for (const event of this.behaviorHistory) {
      const timeSlot = Math.floor(event.hour / 3); // 每3小时一个时间段
      const key = `${timeSlot}:${event.scene}`;
      timeSceneCounts.set(key, (timeSceneCounts.get(key) || 0) + 1);
    }

    // 创建高频模式
    for (const [key, count] of timeSceneCounts) {
      if (count >= CONFIG.MIN_PATTERN_FREQUENCY) {
        const [timeSlotStr, scene] = key.split(':');
        const timeSlot = parseInt(timeSlotStr, 10);
        const startHour = timeSlot * 3;
        const endHour = startHour + 3;
        const confidence = Math.min(count / 15, 1);

        if (confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
          patterns.push({
            id: generatePatternId(),
            description: `在${getTimeSlotLabel(startHour + 1)}（${startHour}:00-${endHour}:00）通常处于${getSceneLabel(scene as SceneType)}`,
            conditions: [
              { type: 'time', value: [startHour, endHour], operator: 'between' },
            ],
            frequency: count,
            lastOccurrence: Date.now(),
            confidence,
            relatedScenes: [scene as SceneType],
          });
        }
      }
    }

    return patterns;
  }

  /**
   * 分析应用序列模式
   */
  private analyzeSequencePatterns(): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];
    const sequenceCounts: Map<string, number> = new Map();

    // 统计应用启动序列
    for (const event of this.behaviorHistory) {
      if (event.app && event.previousApp) {
        const key = `${event.previousApp}:${event.app}`;
        sequenceCounts.set(key, (sequenceCounts.get(key) || 0) + 1);
      }
    }

    // 创建高频序列模式
    for (const [key, count] of sequenceCounts) {
      if (count >= CONFIG.MIN_PATTERN_FREQUENCY) {
        const [prevApp, nextApp] = key.split(':');
        const confidence = Math.min(count / 10, 1);

        if (confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
          patterns.push({
            id: generatePatternId(),
            description: `使用前一个应用后经常打开此应用`,
            conditions: [
              { type: 'sequence', value: prevApp, operator: 'after' },
            ],
            frequency: count,
            lastOccurrence: Date.now(),
            confidence,
            relatedApps: [prevApp, nextApp],
            suggestedAction: {
              type: 'launch_app',
              payload: { packageName: nextApp, afterApp: prevApp },
            },
          });
        }
      }
    }

    return patterns;
  }

  /**
   * 分析周期性模式（工作日/周末）
   */
  private analyzePeriodicPatterns(): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];
    
    // 分离工作日和周末数据
    const weekdayEvents = this.behaviorHistory.filter(e => e.dayOfWeek >= 1 && e.dayOfWeek <= 5);
    const weekendEvents = this.behaviorHistory.filter(e => e.dayOfWeek === 6 || e.dayOfWeek === 7);

    // 分析工作日特有模式
    const weekdaySceneCounts: Map<SceneType, number> = new Map();
    for (const event of weekdayEvents) {
      weekdaySceneCounts.set(event.scene, (weekdaySceneCounts.get(event.scene) || 0) + 1);
    }

    // 分析周末特有模式
    const weekendSceneCounts: Map<SceneType, number> = new Map();
    for (const event of weekendEvents) {
      weekendSceneCounts.set(event.scene, (weekendSceneCounts.get(event.scene) || 0) + 1);
    }

    // 找出工作日和周末的主要场景差异
    const allScenes: SceneType[] = ['COMMUTE', 'OFFICE', 'HOME', 'STUDY', 'SLEEP', 'TRAVEL'];
    
    for (const scene of allScenes) {
      const weekdayRatio = (weekdaySceneCounts.get(scene) || 0) / Math.max(weekdayEvents.length, 1);
      const weekendRatio = (weekendSceneCounts.get(scene) || 0) / Math.max(weekendEvents.length, 1);

      // 工作日显著更多
      if (weekdayRatio > weekendRatio * 2 && weekdayRatio > 0.1) {
        patterns.push({
          id: generatePatternId(),
          description: `工作日经常处于${getSceneLabel(scene)}场景`,
          conditions: [
            { type: 'day', value: [1, 2, 3, 4, 5], operator: 'in' },
            { type: 'scene', value: scene, operator: 'equals' },
          ],
          frequency: weekdaySceneCounts.get(scene) || 0,
          lastOccurrence: Date.now(),
          confidence: Math.min(weekdayRatio * 2, 1),
          relatedScenes: [scene],
        });
      }

      // 周末显著更多
      if (weekendRatio > weekdayRatio * 2 && weekendRatio > 0.1) {
        patterns.push({
          id: generatePatternId(),
          description: `周末经常处于${getSceneLabel(scene)}场景`,
          conditions: [
            { type: 'day', value: [6, 7], operator: 'in' },
            { type: 'scene', value: scene, operator: 'equals' },
          ],
          frequency: weekendSceneCounts.get(scene) || 0,
          lastOccurrence: Date.now(),
          confidence: Math.min(weekendRatio * 2, 1),
          relatedScenes: [scene],
        });
      }
    }

    return patterns;
  }

  /**
   * 匹配当前上下文的模式
   */
  matchCurrentPattern(context: SilentContext, currentApp?: string): PatternMatchResult[] {
    const results: PatternMatchResult[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay() || 7;

    for (const pattern of this.patterns) {
      let matchScore = 0;
      const matchedConditions: PatternCondition[] = [];

      for (const condition of pattern.conditions) {
        const conditionMatch = this.evaluateCondition(
          condition,
          context.context,
          currentHour,
          currentDay,
          currentApp
        );

        if (conditionMatch > 0) {
          matchScore += conditionMatch;
          matchedConditions.push(condition);
        }
      }

      if (matchedConditions.length > 0) {
        const avgScore = matchScore / pattern.conditions.length;
        const finalScore = avgScore * pattern.confidence;

        if (finalScore >= CONFIG.CONFIDENCE_THRESHOLD) {
          results.push({
            pattern,
            matchScore: finalScore,
            matchedConditions,
          });
        }
      }
    }

    // 按分数排序
    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * 评估条件匹配度
   */
  private evaluateCondition(
    condition: PatternCondition,
    scene: SceneType,
    hour: number,
    dayOfWeek: number,
    currentApp?: string
  ): number {
    switch (condition.type) {
      case 'scene':
        return condition.value === scene ? 1 : 0;

      case 'time':
        if (Array.isArray(condition.value) && condition.operator === 'between') {
          const [start, end] = condition.value as number[];
          return hour >= start && hour < end ? 1 : 0;
        }
        return 0;

      case 'day':
        if (Array.isArray(condition.value) && condition.operator === 'in') {
          return (condition.value as number[]).includes(dayOfWeek) ? 1 : 0;
        }
        return 0;

      case 'sequence':
        // 序列条件需要上下文中的前一个应用
        return 0;

      case 'app':
        return condition.value === currentApp ? 1 : 0;

      default:
        return 0;
    }
  }

  /**
   * 生成模式建议
   */
  generatePatternSuggestion(pattern: BehaviorPattern): {
    title: string;
    description: string;
    action?: { type: string; payload: Record<string, unknown> };
  } | null {
    if (!pattern.suggestedAction) {
      return null;
    }

    return {
      title: '发现行为模式',
      description: pattern.description,
      action: pattern.suggestedAction,
    };
  }

  /**
   * 获取所有模式
   */
  getPatterns(): BehaviorPattern[] {
    return [...this.patterns];
  }

  /**
   * 获取特定场景的模式
   */
  getPatternsForScene(scene: SceneType): BehaviorPattern[] {
    return this.patterns.filter(p => p.relatedScenes?.includes(scene));
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalPatterns: number;
    totalEvents: number;
    patternTypes: Record<string, number>;
    averageConfidence: number;
  } {
    const patternTypes: Record<string, number> = {};
    let totalConfidence = 0;

    for (const pattern of this.patterns) {
      const type = pattern.conditions[0]?.type || 'unknown';
      patternTypes[type] = (patternTypes[type] || 0) + 1;
      totalConfidence += pattern.confidence;
    }

    return {
      totalPatterns: this.patterns.length,
      totalEvents: this.behaviorHistory.length,
      patternTypes,
      averageConfidence: this.patterns.length > 0 
        ? totalConfidence / this.patterns.length 
        : 0,
    };
  }

  /**
   * 清除所有数据
   */
  async clearAll(): Promise<void> {
    this.patterns = [];
    this.behaviorHistory = [];
    this.lastAnalysisTime = 0;

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.BEHAVIOR_PATTERNS,
      STORAGE_KEYS.BEHAVIOR_HISTORY,
      STORAGE_KEYS.LAST_ANALYSIS,
    ]);

    console.log('[BehaviorAnalyzer] All data cleared');
  }
}

// 导出单例
export const behaviorAnalyzer = new BehaviorAnalyzer();
export default behaviorAnalyzer;
