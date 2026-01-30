/**
 * HabitDiscovery - 习惯发现引擎
 * 
 * 基于 AppUsageTracker 数据分析用户习惯：
 * - 分析时间段使用模式
 * - 识别场景关联行为
 * - 发现应用使用序列
 * - 生成习惯报告和建议
 * 
 * @module learning
 */

import { appUsageTracker } from './AppUsageTracker';
import type { SceneType } from '../types';
import type { AppUsageRecord } from '../types/automation';

// ==================== 类型定义 ====================

/**
 * 时间段定义
 */
export type TimeSlot = 
  | 'EARLY_MORNING'    // 06:00-08:00 早起
  | 'MORNING'          // 08:00-12:00 上午
  | 'LUNCH'            // 12:00-14:00 午餐
  | 'AFTERNOON'        // 14:00-18:00 下午
  | 'EVENING'          // 18:00-21:00 晚间
  | 'NIGHT'            // 21:00-24:00 深夜
  | 'LATE_NIGHT';      // 00:00-06:00 凌晨

/**
 * 习惯强度级别
 */
export type HabitStrength = 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';

/**
 * 习惯类型
 */
export type HabitType = 
  | 'TIME_BASED'       // 基于时间的习惯
  | 'SCENE_BASED'      // 基于场景的习惯
  | 'SEQUENCE_BASED'   // 基于序列的习惯
  | 'ROUTINE';         // 日常例程

/**
 * 发现的习惯
 */
export interface DiscoveredHabit {
  /** 习惯 ID */
  id: string;
  /** 习惯类型 */
  type: HabitType;
  /** 习惯描述 */
  description: string;
  /** 关联应用 */
  apps: string[];
  /** 时间段（如适用） */
  timeSlots?: TimeSlot[];
  /** 场景类型（如适用） */
  scenes?: SceneType[];
  /** 习惯强度 */
  strength: HabitStrength;
  /** 置信度 (0-1) */
  confidence: number;
  /** 发现时间 */
  discoveredAt: number;
  /** 建议操作 */
  suggestedActions?: string[];
}

/**
 * 时间段使用模式
 */
export interface TimeSlotPattern {
  timeSlot: TimeSlot;
  topApps: Array<{
    packageName: string;
    count: number;
    percentage: number;
  }>;
  totalLaunches: number;
}

/**
 * 场景使用模式
 */
export interface ScenePattern {
  sceneType: SceneType;
  topApps: Array<{
    packageName: string;
    count: number;
    percentage: number;
  }>;
  totalLaunches: number;
}

/**
 * 应用序列模式
 */
export interface SequencePattern {
  sourceApp: string;
  followingApps: Array<{
    packageName: string;
    count: number;
    probability: number;
  }>;
}

/**
 * 习惯报告
 */
export interface HabitReport {
  /** 报告生成时间 */
  generatedAt: number;
  /** 分析数据时间范围 */
  dataRange: {
    start: number;
    end: number;
  };
  /** 发现的习惯 */
  habits: DiscoveredHabit[];
  /** 时间段模式 */
  timePatterns: TimeSlotPattern[];
  /** 场景模式 */
  scenePatterns: ScenePattern[];
  /** 序列模式 */
  sequencePatterns: SequencePattern[];
  /** 统计摘要 */
  summary: {
    totalAppsAnalyzed: number;
    totalLaunches: number;
    strongHabitsCount: number;
    topScenes: SceneType[];
    peakTimeSlot: TimeSlot | null;
  };
}

// ==================== 辅助函数 ====================

/**
 * 根据小时获取时间段
 */
function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 6 && hour < 8) return 'EARLY_MORNING';
  if (hour >= 8 && hour < 12) return 'MORNING';
  if (hour >= 12 && hour < 14) return 'LUNCH';
  if (hour >= 14 && hour < 18) return 'AFTERNOON';
  if (hour >= 18 && hour < 21) return 'EVENING';
  if (hour >= 21) return 'NIGHT';
  return 'LATE_NIGHT';
}

/**
 * 获取时间段的小时范围
 */
function getTimeSlotHours(slot: TimeSlot): number[] {
  const ranges: Record<TimeSlot, number[]> = {
    EARLY_MORNING: [6, 7],
    MORNING: [8, 9, 10, 11],
    LUNCH: [12, 13],
    AFTERNOON: [14, 15, 16, 17],
    EVENING: [18, 19, 20],
    NIGHT: [21, 22, 23],
    LATE_NIGHT: [0, 1, 2, 3, 4, 5],
  };
  return ranges[slot];
}

/**
 * 计算习惯强度
 */
function calculateStrength(confidence: number, frequency: number): HabitStrength {
  const score = confidence * 0.6 + Math.min(frequency / 50, 1) * 0.4;
  
  if (score >= 0.8) return 'VERY_STRONG';
  if (score >= 0.6) return 'STRONG';
  if (score >= 0.4) return 'MODERATE';
  return 'WEAK';
}

/**
 * 获取时间段中文标签
 */
function getTimeSlotLabel(slot: TimeSlot): string {
  const labels: Record<TimeSlot, string> = {
    EARLY_MORNING: '早起',
    MORNING: '上午',
    LUNCH: '午餐时间',
    AFTERNOON: '下午',
    EVENING: '晚间',
    NIGHT: '深夜',
    LATE_NIGHT: '凌晨',
  };
  return labels[slot];
}

/**
 * 获取场景中文标签
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
  return labels[scene];
}

// ==================== HabitDiscovery 类 ====================

export class HabitDiscovery {
  private discoveredHabits: DiscoveredHabit[] = [];
  private lastAnalysisTime: number = 0;

  constructor() {}

  /**
   * 分析用户习惯并生成报告
   */
  async analyzeHabits(): Promise<HabitReport> {
    // 确保追踪器已初始化
    await appUsageTracker.initialize();

    const stats = appUsageTracker.getUsageStats();
    const now = Date.now();
    
    // 分析各类模式
    const timePatterns = this.analyzeTimePatterns();
    const scenePatterns = this.analyzeScenePatterns();
    const sequencePatterns = this.analyzeSequencePatterns();
    
    // 发现习惯
    const habits = this.discoverHabits(timePatterns, scenePatterns, sequencePatterns);
    this.discoveredHabits = habits;
    this.lastAnalysisTime = now;

    // 计算峰值时段
    const peakTimeSlot = this.findPeakTimeSlot(timePatterns);
    
    // 计算主要场景
    const topScenes = scenePatterns
      .sort((a, b) => b.totalLaunches - a.totalLaunches)
      .slice(0, 3)
      .map(p => p.sceneType);

    return {
      generatedAt: now,
      dataRange: {
        start: now - 7 * 24 * 60 * 60 * 1000, // 假设7天数据
        end: now,
      },
      habits,
      timePatterns,
      scenePatterns,
      sequencePatterns,
      summary: {
        totalAppsAnalyzed: stats.totalApps,
        totalLaunches: stats.totalLaunches,
        strongHabitsCount: habits.filter(h => h.strength === 'STRONG' || h.strength === 'VERY_STRONG').length,
        topScenes,
        peakTimeSlot,
      },
    };
  }

  /**
   * 分析时间段使用模式
   */
  private analyzeTimePatterns(): TimeSlotPattern[] {
    const slots: TimeSlot[] = [
      'EARLY_MORNING', 'MORNING', 'LUNCH', 'AFTERNOON', 'EVENING', 'NIGHT', 'LATE_NIGHT'
    ];

    return slots.map(slot => {
      const hours = getTimeSlotHours(slot);
      const appCounts: Record<string, number> = {};
      let totalLaunches = 0;

      // 获取所有应用在该时段的使用次数
      for (const hour of hours) {
        const topApps = appUsageTracker.getTopAppsForTimeSlot(hour, 20);
        for (const app of topApps) {
          appCounts[app.packageName] = (appCounts[app.packageName] || 0) + Math.round(app.score * 10);
          totalLaunches += Math.round(app.score * 10);
        }
      }

      // 排序获取热门应用
      const topApps = Object.entries(appCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([packageName, count]) => ({
          packageName,
          count,
          percentage: totalLaunches > 0 ? count / totalLaunches : 0,
        }));

      return { timeSlot: slot, topApps, totalLaunches };
    });
  }

  /**
   * 分析场景使用模式
   */
  private analyzeScenePatterns(): ScenePattern[] {
    const scenes: SceneType[] = ['COMMUTE', 'OFFICE', 'HOME', 'STUDY', 'SLEEP', 'TRAVEL'];

    return scenes.map(sceneType => {
      const topAppsData = appUsageTracker.getTopAppsForScene(sceneType, 10);
      let totalLaunches = 0;
      
      const topApps = topAppsData.map(app => {
        const count = Math.round(app.score * 100);
        totalLaunches += count;
        return {
          packageName: app.packageName,
          count,
          percentage: 0, // 稍后计算
        };
      });

      // 计算百分比
      topApps.forEach(app => {
        app.percentage = totalLaunches > 0 ? app.count / totalLaunches : 0;
      });

      return { sceneType, topApps: topApps.slice(0, 5), totalLaunches };
    });
  }

  /**
   * 分析应用序列模式
   */
  private analyzeSequencePatterns(): SequencePattern[] {
    const patterns: SequencePattern[] = [];
    const stats = appUsageTracker.getUsageStats();
    
    // 分析启动次数最多的应用的后续应用
    for (const sourceApp of stats.topByLaunch.slice(0, 5)) {
      const prediction = appUsageTracker.predictNextApp(sourceApp);
      
      if (prediction) {
        patterns.push({
          sourceApp,
          followingApps: [{
            packageName: prediction.packageName,
            count: Math.round(prediction.score * 20),
            probability: prediction.score,
          }],
        });
      }
    }

    return patterns;
  }

  /**
   * 发现习惯
   */
  private discoverHabits(
    timePatterns: TimeSlotPattern[],
    scenePatterns: ScenePattern[],
    sequencePatterns: SequencePattern[]
  ): DiscoveredHabit[] {
    const habits: DiscoveredHabit[] = [];
    const now = Date.now();
    let habitId = 1;

    // 1. 发现基于时间的习惯
    for (const pattern of timePatterns) {
      if (pattern.topApps.length === 0) continue;
      
      const topApp = pattern.topApps[0];
      if (topApp.percentage >= 0.3) { // 占比 30% 以上认为是习惯
        const confidence = Math.min(topApp.percentage * 1.5, 1);
        
        habits.push({
          id: `habit_time_${habitId++}`,
          type: 'TIME_BASED',
          description: `${getTimeSlotLabel(pattern.timeSlot)}经常使用 ${this.getAppDisplayName(topApp.packageName)}`,
          apps: [topApp.packageName],
          timeSlots: [pattern.timeSlot],
          strength: calculateStrength(confidence, topApp.count),
          confidence,
          discoveredAt: now,
          suggestedActions: [`在${getTimeSlotLabel(pattern.timeSlot)}自动推荐此应用`],
        });
      }
    }

    // 2. 发现基于场景的习惯
    for (const pattern of scenePatterns) {
      if (pattern.topApps.length === 0) continue;
      
      const topApp = pattern.topApps[0];
      if (topApp.percentage >= 0.25) { // 占比 25% 以上
        const confidence = Math.min(topApp.percentage * 1.5, 1);
        
        habits.push({
          id: `habit_scene_${habitId++}`,
          type: 'SCENE_BASED',
          description: `${getSceneLabel(pattern.sceneType)}场景下常用 ${this.getAppDisplayName(topApp.packageName)}`,
          apps: [topApp.packageName],
          scenes: [pattern.sceneType],
          strength: calculateStrength(confidence, topApp.count),
          confidence,
          discoveredAt: now,
          suggestedActions: [`在${getSceneLabel(pattern.sceneType)}场景自动推荐此应用`],
        });
      }
    }

    // 3. 发现基于序列的习惯
    for (const pattern of sequencePatterns) {
      if (pattern.followingApps.length === 0) continue;
      
      const followApp = pattern.followingApps[0];
      if (followApp.probability >= 0.4) { // 概率 40% 以上
        habits.push({
          id: `habit_seq_${habitId++}`,
          type: 'SEQUENCE_BASED',
          description: `使用 ${this.getAppDisplayName(pattern.sourceApp)} 后经常打开 ${this.getAppDisplayName(followApp.packageName)}`,
          apps: [pattern.sourceApp, followApp.packageName],
          strength: calculateStrength(followApp.probability, followApp.count),
          confidence: followApp.probability,
          discoveredAt: now,
          suggestedActions: [`使用${this.getAppDisplayName(pattern.sourceApp)}后自动推荐${this.getAppDisplayName(followApp.packageName)}`],
        });
      }
    }

    // 4. 发现日常例程（多个时段的组合习惯）
    const morningHabits = habits.filter(h => h.timeSlots?.includes('MORNING'));
    const eveningHabits = habits.filter(h => h.timeSlots?.includes('EVENING'));
    
    if (morningHabits.length >= 2) {
      habits.push({
        id: `habit_routine_${habitId++}`,
        type: 'ROUTINE',
        description: '早晨使用习惯',
        apps: morningHabits.flatMap(h => h.apps),
        timeSlots: ['MORNING'],
        strength: 'MODERATE',
        confidence: 0.7,
        discoveredAt: now,
        suggestedActions: ['创建早晨自动化规则'],
      });
    }

    if (eveningHabits.length >= 2) {
      habits.push({
        id: `habit_routine_${habitId++}`,
        type: 'ROUTINE',
        description: '晚间使用习惯',
        apps: eveningHabits.flatMap(h => h.apps),
        timeSlots: ['EVENING'],
        strength: 'MODERATE',
        confidence: 0.7,
        discoveredAt: now,
        suggestedActions: ['创建晚间自动化规则'],
      });
    }

    return habits;
  }

  /**
   * 查找峰值时段
   */
  private findPeakTimeSlot(patterns: TimeSlotPattern[]): TimeSlot | null {
    if (patterns.length === 0) return null;
    
    const sorted = [...patterns].sort((a, b) => b.totalLaunches - a.totalLaunches);
    return sorted[0].totalLaunches > 0 ? sorted[0].timeSlot : null;
  }

  /**
   * 获取应用显示名称
   */
  private getAppDisplayName(packageName: string): string {
    // 简单处理：取包名最后一部分作为显示名
    const parts = packageName.split('.');
    return parts[parts.length - 1] || packageName;
  }

  /**
   * 获取已发现的习惯
   */
  getDiscoveredHabits(): DiscoveredHabit[] {
    return [...this.discoveredHabits];
  }

  /**
   * 获取强习惯
   */
  getStrongHabits(): DiscoveredHabit[] {
    return this.discoveredHabits.filter(
      h => h.strength === 'STRONG' || h.strength === 'VERY_STRONG'
    );
  }

  /**
   * 获取特定类型的习惯
   */
  getHabitsByType(type: HabitType): DiscoveredHabit[] {
    return this.discoveredHabits.filter(h => h.type === type);
  }

  /**
   * 获取特定场景的习惯
   */
  getHabitsForScene(sceneType: SceneType): DiscoveredHabit[] {
    return this.discoveredHabits.filter(
      h => h.scenes?.includes(sceneType)
    );
  }

  /**
   * 获取当前时段的相关习惯
   */
  getCurrentTimeSlotHabits(): DiscoveredHabit[] {
    const currentSlot = getTimeSlot(new Date().getHours());
    return this.discoveredHabits.filter(
      h => h.timeSlots?.includes(currentSlot)
    );
  }

  /**
   * 获取习惯建议
   */
  getHabitSuggestions(sceneType: SceneType): string[] {
    const suggestions: string[] = [];
    
    // 场景相关习惯建议
    const sceneHabits = this.getHabitsForScene(sceneType);
    for (const habit of sceneHabits) {
      if (habit.suggestedActions) {
        suggestions.push(...habit.suggestedActions);
      }
    }

    // 当前时段习惯建议
    const timeHabits = this.getCurrentTimeSlotHabits();
    for (const habit of timeHabits) {
      if (habit.suggestedActions) {
        suggestions.push(...habit.suggestedActions);
      }
    }

    // 去重
    return [...new Set(suggestions)];
  }

  /**
   * 获取上次分析时间
   */
  getLastAnalysisTime(): number {
    return this.lastAnalysisTime;
  }

  /**
   * 检查是否需要重新分析
   * @param intervalHours 分析间隔（小时）
   */
  needsReanalysis(intervalHours: number = 24): boolean {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    return Date.now() - this.lastAnalysisTime > intervalMs;
  }

  /**
   * 生成习惯摘要文本
   */
  generateHabitSummary(): string {
    const habits = this.getStrongHabits();
    
    if (habits.length === 0) {
      return '还在学习您的使用习惯中...';
    }

    const lines: string[] = ['发现以下使用习惯：'];
    
    for (const habit of habits.slice(0, 5)) {
      lines.push(`• ${habit.description}`);
    }

    if (habits.length > 5) {
      lines.push(`...还有 ${habits.length - 5} 个习惯`);
    }

    return lines.join('\n');
  }
}

// ==================== 单例导出 ====================

export const habitDiscovery = new HabitDiscovery();

export default habitDiscovery;
