/**
 * AppUsageTracker - 应用使用追踪器
 * 
 * 追踪和分析用户的应用使用模式：
 * - 记录应用启动和使用时长
 * - 按小时/场景统计使用分布
 * - 分析应用启动序列模式
 * - 提供智能应用推荐
 * 
 * @module learning
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { sceneBridge } from '../core/SceneBridge';
import type { SceneType, UsageStats } from '../types';
import type { AppUsageRecord, AppRecommendation } from '../types/automation';

// ==================== 存储键 ====================

const STORAGE_KEYS = {
  USAGE_RECORDS: 'app_usage_records',
  LAST_APP: 'last_foreground_app',
  LAST_SCENE: 'last_scene_type',
};

// ==================== 类型定义 ====================

/**
 * 使用记录存储格式
 */
interface UsageRecordStore {
  records: Record<string, AppUsageRecord>;
  lastUpdated: number;
}

/**
 * 推荐权重配置
 */
interface RecommendationWeights {
  sceneRelevance: number;    // 场景相关性
  timeRelevance: number;     // 时间相关性
  recentUsage: number;       // 最近使用
  sequencePrediction: number; // 连续启动预测
}

// ==================== 默认配置 ====================

const DEFAULT_WEIGHTS: RecommendationWeights = {
  sceneRelevance: 0.35,
  timeRelevance: 0.25,
  recentUsage: 0.20,
  sequencePrediction: 0.20,
};

// ==================== AppUsageTracker 类 ====================

export class AppUsageTracker {
  private records: Record<string, AppUsageRecord> = {};
  private lastApp: string | null = null;
  private lastScene: SceneType | null = null;
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * 初始化追踪器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadRecords();
      this.initialized = true;
      console.log('[AppUsageTracker] Initialized with', Object.keys(this.records).length, 'app records');
    } catch (error) {
      console.error('[AppUsageTracker] Failed to initialize:', error);
    }
  }

  /**
   * 从存储加载记录
   */
  private async loadRecords(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.USAGE_RECORDS);
      if (stored) {
        const data: UsageRecordStore = JSON.parse(stored);
        this.records = data.records || {};
      }

      const lastApp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_APP);
      if (lastApp) {
        this.lastApp = lastApp;
      }

      const lastScene = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SCENE);
      if (lastScene) {
        this.lastScene = lastScene as SceneType;
      }
    } catch (error) {
      console.error('[AppUsageTracker] Failed to load records:', error);
      this.records = {};
    }
  }

  /**
   * 保存记录到存储
   */
  private async saveRecords(): Promise<void> {
    try {
      const data: UsageRecordStore = {
        records: this.records,
        lastUpdated: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.USAGE_RECORDS, JSON.stringify(data));
    } catch (error) {
      console.error('[AppUsageTracker] Failed to save records:', error);
    }
  }

  /**
   * 追踪应用启动
   * @param packageName 应用包名
   * @param sceneType 当前场景类型
   */
  async trackAppLaunch(packageName: string, sceneType: SceneType): Promise<void> {
    await this.initialize();

    const now = Date.now();
    const hour = new Date().getHours();

    // 获取或创建记录
    if (!this.records[packageName]) {
      this.records[packageName] = {
        packageName,
        launchCount: 0,
        totalDuration: 0,
        lastUsed: 0,
        hourlyDistribution: {},
        sceneDistribution: {},
        sequenceAfter: {},
      };
    }

    const record = this.records[packageName];

    // 更新基础统计
    record.launchCount++;
    record.lastUsed = now;

    // 更新小时分布
    record.hourlyDistribution[hour] = (record.hourlyDistribution[hour] || 0) + 1;

    // 更新场景分布
    record.sceneDistribution[sceneType] = (record.sceneDistribution[sceneType] || 0) + 1;

    // 更新序列统计（记录前一个应用后启动当前应用的次数）
    if (this.lastApp && this.lastApp !== packageName) {
      record.sequenceAfter[this.lastApp] = (record.sequenceAfter[this.lastApp] || 0) + 1;
    }

    // 更新上一个应用和场景
    this.lastApp = packageName;
    this.lastScene = sceneType;

    // 保存
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_APP, packageName);
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SCENE, sceneType);
    await this.saveRecords();

    console.log(`[AppUsageTracker] Tracked launch: ${packageName} in ${sceneType} at hour ${hour}`);
  }

  /**
   * 追踪应用使用时长
   * @param packageName 应用包名
   * @param duration 使用时长（毫秒）
   */
  async trackAppDuration(packageName: string, duration: number): Promise<void> {
    await this.initialize();

    if (this.records[packageName]) {
      this.records[packageName].totalDuration += duration;
      await this.saveRecords();
    }
  }

  /**
   * 从系统使用统计同步数据
   * @param days 天数
   */
  async syncFromSystemStats(days: number = 7): Promise<void> {
    try {
      const stats = await sceneBridge.getUsageStats(days);
      
      for (const stat of stats) {
        if (!this.records[stat.packageName]) {
          this.records[stat.packageName] = {
            packageName: stat.packageName,
            launchCount: stat.launchCount || 0,
            totalDuration: stat.totalTimeInForeground || 0,
            lastUsed: stat.lastTimeUsed || 0,
            hourlyDistribution: {},
            sceneDistribution: {},
            sequenceAfter: {},
          };
        } else {
          // 合并系统统计
          const record = this.records[stat.packageName];
          record.totalDuration = Math.max(record.totalDuration, stat.totalTimeInForeground || 0);
          record.lastUsed = Math.max(record.lastUsed, stat.lastTimeUsed || 0);
          if (stat.launchCount) {
            record.launchCount = Math.max(record.launchCount, stat.launchCount);
          }
        }
      }

      await this.saveRecords();
      console.log('[AppUsageTracker] Synced from system stats:', stats.length, 'apps');
    } catch (error) {
      console.error('[AppUsageTracker] Failed to sync from system stats:', error);
    }
  }

  /**
   * 获取指定场景的热门应用
   * @param sceneType 场景类型
   * @param limit 数量限制
   */
  getTopAppsForScene(sceneType: SceneType, limit: number = 5): AppRecommendation[] {
    const apps = Object.values(this.records)
      .filter(r => (r.sceneDistribution[sceneType] || 0) > 0)
      .sort((a, b) => 
        (b.sceneDistribution[sceneType] || 0) - (a.sceneDistribution[sceneType] || 0)
      )
      .slice(0, limit);

    return apps.map(app => ({
      packageName: app.packageName,
      appName: app.packageName.split('.').pop() || '',
      score: this.calculateSceneScore(app, sceneType),
      reason: `在${this.getSceneLabel(sceneType)}场景使用${app.sceneDistribution[sceneType] || 0}次`,
    }));
  }

  /**
   * 获取指定时间段的热门应用
   * @param hour 小时 (0-23)
   * @param limit 数量限制
   */
  getTopAppsForTimeSlot(hour: number, limit: number = 5): AppRecommendation[] {
    const apps = Object.values(this.records)
      .filter(r => (r.hourlyDistribution[hour] || 0) > 0)
      .sort((a, b) => 
        (b.hourlyDistribution[hour] || 0) - (a.hourlyDistribution[hour] || 0)
      )
      .slice(0, limit);

    return apps.map(app => ({
      packageName: app.packageName,
      appName: app.packageName.split('.').pop() || '',
      score: this.calculateTimeScore(app, hour),
      reason: `在${hour}点常用（${app.hourlyDistribution[hour] || 0}次）`,
    }));
  }

  /**
   * 预测下一个可能启动的应用
   * @param currentApp 当前应用包名
   */
  predictNextApp(currentApp: string): AppRecommendation | null {
    const record = this.records[currentApp];
    if (!record || Object.keys(record.sequenceAfter).length === 0) {
      return null;
    }

    // 找到最常在当前应用之后启动的应用
    let maxCount = 0;
    let predictedApp: string | null = null;

    // 注意：sequenceAfter 记录的是"哪些应用之后会启动当前应用"
    // 我们需要反向查找
    for (const [packageName, appRecord] of Object.entries(this.records)) {
      const count = appRecord.sequenceAfter[currentApp] || 0;
      if (count > maxCount) {
        maxCount = count;
        predictedApp = packageName;
      }
    }

    if (!predictedApp || maxCount < 2) {
      return null;
    }

    return {
      packageName: predictedApp,
      appName: predictedApp.split('.').pop() || '',
      score: Math.min(maxCount / 10, 1),
      reason: `通常在此应用后使用`,
    };
  }

  /**
   * 获取综合推荐
   * @param context 当前上下文
   * @param limit 数量限制
   * @param weights 权重配置
   */
  getRecommendations(
    context: {
      sceneType: SceneType;
      hour?: number;
      currentApp?: string;
    },
    limit: number = 5,
    weights: RecommendationWeights = DEFAULT_WEIGHTS
  ): AppRecommendation[] {
    const { sceneType, hour = new Date().getHours(), currentApp } = context;
    const scores: Record<string, { score: number; reasons: string[] }> = {};

    // 遍历所有记录计算综合分数
    for (const [packageName, record] of Object.entries(this.records)) {
      if (packageName === currentApp) continue;

      let totalScore = 0;
      const reasons: string[] = [];

      // 场景相关性
      const sceneScore = this.calculateSceneScore(record, sceneType);
      if (sceneScore > 0) {
        totalScore += sceneScore * weights.sceneRelevance;
        reasons.push(`场景相关`);
      }

      // 时间相关性
      const timeScore = this.calculateTimeScore(record, hour);
      if (timeScore > 0) {
        totalScore += timeScore * weights.timeRelevance;
        reasons.push(`时段常用`);
      }

      // 最近使用
      const recencyScore = this.calculateRecencyScore(record);
      totalScore += recencyScore * weights.recentUsage;

      // 序列预测
      if (currentApp) {
        const sequenceScore = this.calculateSequenceScore(record, currentApp);
        if (sequenceScore > 0) {
          totalScore += sequenceScore * weights.sequencePrediction;
          reasons.push(`使用序列`);
        }
      }

      if (totalScore > 0) {
        scores[packageName] = { score: totalScore, reasons };
      }
    }

    // 排序并返回
    return Object.entries(scores)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, limit)
      .map(([packageName, { score, reasons }]) => ({
        packageName,
        appName: packageName.split('.').pop() || '',
        score: Math.min(score, 1),
        reason: reasons.join('、'),
      }));
  }

  /**
   * 获取使用统计摘要
   */
  getUsageStats(): {
    totalApps: number;
    totalLaunches: number;
    totalDuration: number;
    topByLaunch: string[];
    topByDuration: string[];
  } {
    const apps = Object.values(this.records);
    
    return {
      totalApps: apps.length,
      totalLaunches: apps.reduce((sum, r) => sum + r.launchCount, 0),
      totalDuration: apps.reduce((sum, r) => sum + r.totalDuration, 0),
      topByLaunch: apps
        .sort((a, b) => b.launchCount - a.launchCount)
        .slice(0, 5)
        .map(r => r.packageName),
      topByDuration: apps
        .sort((a, b) => b.totalDuration - a.totalDuration)
        .slice(0, 5)
        .map(r => r.packageName),
    };
  }

  /**
   * 清除所有记录
   */
  async clearRecords(): Promise<void> {
    this.records = {};
    this.lastApp = null;
    this.lastScene = null;
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USAGE_RECORDS,
      STORAGE_KEYS.LAST_APP,
      STORAGE_KEYS.LAST_SCENE,
    ]);
    console.log('[AppUsageTracker] Records cleared');
  }

  // ==================== 私有辅助方法 ====================

  private calculateSceneScore(record: AppUsageRecord, sceneType: SceneType): number {
    const sceneCount = record.sceneDistribution[sceneType] || 0;
    const totalSceneCount = Object.values(record.sceneDistribution).reduce((a, b) => a + b, 0);
    
    if (totalSceneCount === 0) return 0;
    return sceneCount / totalSceneCount;
  }

  private calculateTimeScore(record: AppUsageRecord, hour: number): number {
    const hourCount = record.hourlyDistribution[hour] || 0;
    const totalHourCount = Object.values(record.hourlyDistribution).reduce((a, b) => a + b, 0);
    
    if (totalHourCount === 0) return 0;
    return hourCount / totalHourCount;
  }

  private calculateRecencyScore(record: AppUsageRecord): number {
    const now = Date.now();
    const daysSinceLastUse = (now - record.lastUsed) / (1000 * 60 * 60 * 24);
    
    // 指数衰减：7天前的应用得分接近0
    return Math.exp(-daysSinceLastUse / 7);
  }

  private calculateSequenceScore(record: AppUsageRecord, currentApp: string): number {
    const afterCount = record.sequenceAfter[currentApp] || 0;
    const totalSequenceCount = Object.values(record.sequenceAfter).reduce((a, b) => a + b, 0);
    
    if (totalSequenceCount === 0) return 0;
    return afterCount / totalSequenceCount;
  }

  private getSceneLabel(sceneType: SceneType): string {
    const labels: Record<SceneType, string> = {
      COMMUTE: '通勤',
      OFFICE: '办公',
      HOME: '在家',
      STUDY: '学习',
      SLEEP: '睡眠',
      TRAVEL: '出行',
      UNKNOWN: '未知',
    };
    return labels[sceneType] || sceneType;
  }
}

// ==================== 单例导出 ====================

export const appUsageTracker = new AppUsageTracker();

export default appUsageTracker;
