/**
 * TimePatternEngine - 时间模式分析引擎
 * 
 * 分析用户场景切换的时间规律：
 * - 分析每日/每周的场景模式
 * - 预测下一个场景和时间
 * - 检测异常行为
 * - 提供出发时间建议
 * 
 * @module prediction
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SceneType } from '../types';
import type {
  TimePattern,
  SceneHistoryRecord,
  ScenePrediction,
  SceneAnomaly,
  PatternPeriod,
} from './types';

// ==================== 存储键 ====================

const STORAGE_KEYS = {
  SCENE_HISTORY: 'scene_history',
  TIME_PATTERNS: 'time_patterns',
  LAST_ANALYSIS: 'time_pattern_last_analysis',
};

// ==================== 配置常量 ====================

const CONFIG = {
  /** 历史记录最大保留天数 */
  MAX_HISTORY_DAYS: 30,
  /** 模式识别最小样本数 */
  MIN_PATTERN_SAMPLES: 3,
  /** 模式置信度阈值 */
  CONFIDENCE_THRESHOLD: 0.6,
  /** 时间容差（分钟） */
  TIME_TOLERANCE_MINUTES: 30,
  /** 分析间隔（小时） */
  ANALYSIS_INTERVAL_HOURS: 6,
};

// ==================== 辅助函数 ====================

/**
 * 格式化时间为 HH:mm
 */
function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 解析时间字符串 HH:mm 为分钟数
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 计算两个时间的分钟差
 */
function timeDifferenceMinutes(time1: string, time2: string): number {
  const m1 = parseTimeToMinutes(time1);
  const m2 = parseTimeToMinutes(time2);
  return Math.abs(m1 - m2);
}

/**
 * 生成模式 ID
 */
function generatePatternId(): string {
  return `tp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取场景中文名
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

// ==================== TimePatternEngine 类 ====================

export class TimePatternEngine {
  private sceneHistory: SceneHistoryRecord[] = [];
  private patterns: TimePattern[] = [];
  private lastAnalysisTime: number = 0;
  private initialized: boolean = false;
  private currentScene: SceneType = 'UNKNOWN';
  private currentSceneStartTime: number = 0;

  constructor() {}

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadData();
      this.initialized = true;
      console.log('[TimePatternEngine] Initialized with', this.sceneHistory.length, 'history records and', this.patterns.length, 'patterns');
    } catch (error) {
      console.error('[TimePatternEngine] Failed to initialize:', error);
    }
  }

  /**
   * 加载数据
   */
  private async loadData(): Promise<void> {
    try {
      const [historyStr, patternsStr, lastAnalysisStr] = await AsyncStorage.multiGet([
        STORAGE_KEYS.SCENE_HISTORY,
        STORAGE_KEYS.TIME_PATTERNS,
        STORAGE_KEYS.LAST_ANALYSIS,
      ]);

      if (historyStr[1]) {
        this.sceneHistory = JSON.parse(historyStr[1]);
      }

      if (patternsStr[1]) {
        this.patterns = JSON.parse(patternsStr[1]);
      }

      if (lastAnalysisStr[1]) {
        this.lastAnalysisTime = parseInt(lastAnalysisStr[1], 10);
      }
    } catch (error) {
      console.error('[TimePatternEngine] Failed to load data:', error);
    }
  }

  /**
   * 保存数据
   */
  private async saveData(): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.SCENE_HISTORY, JSON.stringify(this.sceneHistory)],
        [STORAGE_KEYS.TIME_PATTERNS, JSON.stringify(this.patterns)],
        [STORAGE_KEYS.LAST_ANALYSIS, String(this.lastAnalysisTime)],
      ]);
    } catch (error) {
      console.error('[TimePatternEngine] Failed to save data:', error);
    }
  }

  /**
   * 记录场景变化
   */
  async recordSceneChange(newScene: SceneType, confidence: number): Promise<void> {
    await this.initialize();

    const now = Date.now();
    const date = new Date(now);

    // 如果有当前场景，先结束它
    if (this.currentScene !== 'UNKNOWN' && this.currentSceneStartTime > 0) {
      const lastRecord = this.sceneHistory[this.sceneHistory.length - 1];
      if (lastRecord && !lastRecord.endTime) {
        lastRecord.endTime = now;
        lastRecord.duration = Math.round((now - lastRecord.startTime) / 60000);
      }
    }

    // 记录新场景
    const record: SceneHistoryRecord = {
      sceneType: newScene,
      startTime: now,
      confidence,
      dayOfWeek: date.getDay() || 7, // 0=周日 -> 7
      hour: date.getHours(),
    };

    this.sceneHistory.push(record);
    this.currentScene = newScene;
    this.currentSceneStartTime = now;

    // 清理旧数据
    this.cleanupOldHistory();

    // 检查是否需要重新分析
    if (this.shouldReanalyze()) {
      await this.analyzePatterns();
    }

    await this.saveData();
    console.log(`[TimePatternEngine] Recorded scene change: ${newScene} at ${formatTime(date)}`);
  }

  /**
   * 清理过期历史
   */
  private cleanupOldHistory(): void {
    const cutoffTime = Date.now() - CONFIG.MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    this.sceneHistory = this.sceneHistory.filter(r => r.startTime >= cutoffTime);
  }

  /**
   * 检查是否应该重新分析
   */
  private shouldReanalyze(): boolean {
    const hoursSinceLastAnalysis = (Date.now() - this.lastAnalysisTime) / (1000 * 60 * 60);
    return hoursSinceLastAnalysis >= CONFIG.ANALYSIS_INTERVAL_HOURS;
  }

  /**
   * 分析时间模式
   */
  async analyzePatterns(): Promise<TimePattern[]> {
    await this.initialize();

    console.log('[TimePatternEngine] Analyzing patterns...');
    const newPatterns: TimePattern[] = [];

    // 按场景类型分组分析
    const sceneTypes: SceneType[] = ['COMMUTE', 'OFFICE', 'HOME', 'STUDY', 'SLEEP', 'TRAVEL'];

    for (const sceneType of sceneTypes) {
      const sceneRecords = this.sceneHistory.filter(r => r.sceneType === sceneType);
      
      if (sceneRecords.length < CONFIG.MIN_PATTERN_SAMPLES) {
        continue;
      }

      // 分析每日模式
      const dailyPatterns = this.analyzeDailyPatterns(sceneType, sceneRecords);
      newPatterns.push(...dailyPatterns);

      // 分析每周模式
      const weeklyPatterns = this.analyzeWeeklyPatterns(sceneType, sceneRecords);
      newPatterns.push(...weeklyPatterns);
    }

    this.patterns = newPatterns;
    this.lastAnalysisTime = Date.now();
    await this.saveData();

    console.log(`[TimePatternEngine] Found ${newPatterns.length} patterns`);
    return newPatterns;
  }

  /**
   * 分析每日模式
   */
  private analyzeDailyPatterns(sceneType: SceneType, records: SceneHistoryRecord[]): TimePattern[] {
    const patterns: TimePattern[] = [];

    // 按小时分组
    const hourGroups: Map<number, SceneHistoryRecord[]> = new Map();
    
    for (const record of records) {
      const hour = record.hour;
      if (!hourGroups.has(hour)) {
        hourGroups.set(hour, []);
      }
      hourGroups.get(hour)!.push(record);
    }

    // 找出高频小时
    for (const [hour, hourRecords] of hourGroups) {
      if (hourRecords.length >= CONFIG.MIN_PATTERN_SAMPLES) {
        // 计算平均分钟
        const avgMinutes = hourRecords.reduce((sum, r) => {
          const date = new Date(r.startTime);
          return sum + date.getMinutes();
        }, 0) / hourRecords.length;

        const confidence = Math.min(hourRecords.length / 10, 1);
        
        if (confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
          const avgDuration = hourRecords
            .filter(r => r.duration)
            .reduce((sum, r) => sum + (r.duration || 0), 0) / hourRecords.length || undefined;

          patterns.push({
            id: generatePatternId(),
            period: 'daily',
            triggerTime: `${String(hour).padStart(2, '0')}:${String(Math.round(avgMinutes)).padStart(2, '0')}`,
            sceneType,
            confidence,
            sampleCount: hourRecords.length,
            avgDuration: avgDuration ? Math.round(avgDuration) : undefined,
            lastOccurrence: Math.max(...hourRecords.map(r => r.startTime)),
          });
        }
      }
    }

    return patterns;
  }

  /**
   * 分析每周模式
   */
  private analyzeWeeklyPatterns(sceneType: SceneType, records: SceneHistoryRecord[]): TimePattern[] {
    const patterns: TimePattern[] = [];

    // 按 (星期几, 小时) 分组
    const dayHourGroups: Map<string, SceneHistoryRecord[]> = new Map();

    for (const record of records) {
      const key = `${record.dayOfWeek}_${record.hour}`;
      if (!dayHourGroups.has(key)) {
        dayHourGroups.set(key, []);
      }
      dayHourGroups.get(key)!.push(record);
    }

    // 找出特定日期的高频模式
    for (const [key, groupRecords] of dayHourGroups) {
      const [dayStr, hourStr] = key.split('_');
      const day = parseInt(dayStr, 10);
      const hour = parseInt(hourStr, 10);

      if (groupRecords.length >= 2) { // 周模式样本要求较低
        const avgMinutes = groupRecords.reduce((sum, r) => {
          const date = new Date(r.startTime);
          return sum + date.getMinutes();
        }, 0) / groupRecords.length;

        const confidence = Math.min(groupRecords.length / 4, 1);

        if (confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
          patterns.push({
            id: generatePatternId(),
            period: 'weekly',
            triggerTime: `${String(hour).padStart(2, '0')}:${String(Math.round(avgMinutes)).padStart(2, '0')}`,
            triggerDays: [day],
            sceneType,
            confidence,
            sampleCount: groupRecords.length,
            lastOccurrence: Math.max(...groupRecords.map(r => r.startTime)),
          });
        }
      }
    }

    return patterns;
  }

  /**
   * 预测下一个场景
   */
  predictNextScene(currentTime: Date = new Date()): ScenePrediction | null {
    if (this.patterns.length === 0) {
      return null;
    }

    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const currentDay = currentTime.getDay() || 7;

    let bestPrediction: ScenePrediction | null = null;
    let bestScore = 0;

    for (const pattern of this.patterns) {
      // 检查周模式是否匹配当天
      if (pattern.period === 'weekly' && pattern.triggerDays) {
        if (!pattern.triggerDays.includes(currentDay)) {
          continue;
        }
      }

      const patternMinutes = parseTimeToMinutes(pattern.triggerTime);
      const minutesUntil = patternMinutes - currentMinutes;

      // 只预测未来的场景（0-180分钟内）
      if (minutesUntil > 0 && minutesUntil <= 180) {
        const score = pattern.confidence * (1 - minutesUntil / 180);

        if (score > bestScore) {
          bestScore = score;
          bestPrediction = {
            sceneType: pattern.sceneType,
            predictedTime: pattern.triggerTime,
            confidence: pattern.confidence,
            basedOnPattern: pattern.id,
            minutesUntil,
          };
        }
      }
    }

    return bestPrediction;
  }

  /**
   * 获取通常的出发时间（去办公室）
   */
  getUsualDepartureTime(): string | null {
    const commutePatterns = this.patterns.filter(
      p => p.sceneType === 'COMMUTE' && p.period === 'daily'
    );

    if (commutePatterns.length === 0) {
      return null;
    }

    // 找出置信度最高的通勤模式
    const bestPattern = commutePatterns.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    return bestPattern.triggerTime;
  }

  /**
   * 获取通常到达某场景的时间
   */
  getUsualArrivalTime(sceneType: SceneType): string | null {
    const patterns = this.patterns.filter(
      p => p.sceneType === sceneType && p.period === 'daily'
    );

    if (patterns.length === 0) {
      return null;
    }

    const bestPattern = patterns.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    return bestPattern.triggerTime;
  }

  /**
   * 检测异常
   */
  detectAnomaly(currentScene: SceneType, currentTime: Date = new Date()): SceneAnomaly | null {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const currentDay = currentTime.getDay() || 7;

    // 查找当前时间段应该出现的场景
    const expectedPatterns = this.patterns.filter(pattern => {
      const patternMinutes = parseTimeToMinutes(pattern.triggerTime);
      const timeDiff = Math.abs(patternMinutes - currentMinutes);

      // 检查时间匹配
      if (timeDiff > CONFIG.TIME_TOLERANCE_MINUTES) {
        return false;
      }

      // 检查周模式是否匹配
      if (pattern.period === 'weekly' && pattern.triggerDays) {
        return pattern.triggerDays.includes(currentDay);
      }

      return true;
    });

    if (expectedPatterns.length === 0) {
      return null;
    }

    // 找出最匹配的预期模式
    const bestExpected = expectedPatterns.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    // 如果当前场景与预期不符，且预期置信度足够高
    if (bestExpected.sceneType !== currentScene && bestExpected.confidence >= 0.7) {
      return {
        type: 'UNEXPECTED_SCENE',
        description: `通常这个时间您应该在${getSceneLabel(bestExpected.sceneType)}，但现在在${getSceneLabel(currentScene)}`,
        currentScene,
        expectedScene: bestExpected.sceneType,
        confidence: bestExpected.confidence,
        detectedAt: Date.now(),
      };
    }

    return null;
  }

  /**
   * 获取所有模式
   */
  getPatterns(): TimePattern[] {
    return [...this.patterns];
  }

  /**
   * 获取场景历史
   */
  getSceneHistory(days: number = 7): SceneHistoryRecord[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.sceneHistory.filter(r => r.startTime >= cutoff);
  }

  /**
   * 获取统计摘要
   */
  getStatsSummary(): {
    totalRecords: number;
    totalPatterns: number;
    patternsByScene: Record<SceneType, number>;
    mostPredictableScene: SceneType | null;
  } {
    const patternsByScene: Partial<Record<SceneType, number>> = {};
    let maxPatterns = 0;
    let mostPredictable: SceneType | null = null;

    for (const pattern of this.patterns) {
      patternsByScene[pattern.sceneType] = (patternsByScene[pattern.sceneType] || 0) + 1;
      if (patternsByScene[pattern.sceneType]! > maxPatterns) {
        maxPatterns = patternsByScene[pattern.sceneType]!;
        mostPredictable = pattern.sceneType;
      }
    }

    return {
      totalRecords: this.sceneHistory.length,
      totalPatterns: this.patterns.length,
      patternsByScene: patternsByScene as Record<SceneType, number>,
      mostPredictableScene: mostPredictable,
    };
  }

  /**
   * 清除所有数据
   */
  async clearAll(): Promise<void> {
    this.sceneHistory = [];
    this.patterns = [];
    this.lastAnalysisTime = 0;

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.SCENE_HISTORY,
      STORAGE_KEYS.TIME_PATTERNS,
      STORAGE_KEYS.LAST_ANALYSIS,
    ]);

    console.log('[TimePatternEngine] All data cleared');
  }
}

// 导出单例
export const timePatternEngine = new TimePatternEngine();
export default timePatternEngine;
