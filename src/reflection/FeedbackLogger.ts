/**
 * FeedbackLogger - 用户反馈记录器
 * 
 * 职责：记录和分析用户对场景建议的反馈行为
 * - 记录接受/忽略/取消操作
 * - 统计各场景的反馈模式
 * - 为权重调整提供数据支持
 */

import type {
  SceneType,
  UserFeedback,
  TriggerHistory,
  StorageKeys,
} from '../types';
import { storageManager } from '../stores/storageManager';

/**
 * 反馈记录项
 */
export interface FeedbackRecord {
  id: string;
  sceneType: SceneType;
  feedback: UserFeedback;
  confidence: number;
  timestamp: number;
  contextSignals: string[];  // 触发时的信号摘要
  executedActions?: string[]; // 执行的动作（如果接受）
}

/**
 * 反馈统计
 */
export interface FeedbackStats {
  sceneType: SceneType;
  totalCount: number;
  acceptCount: number;
  ignoreCount: number;
  cancelCount: number;
  acceptRate: number;
  ignoreRate: number;
  cancelRate: number;
  consecutiveIgnores: number;
  lastFeedback: UserFeedback | null;
  lastFeedbackTime: number | null;
  averageConfidenceOnAccept: number;
  averageConfidenceOnIgnore: number;
}

/**
 * 反馈模式分析结果
 */
export interface FeedbackPattern {
  sceneType: SceneType;
  pattern: 'healthy' | 'declining' | 'rejected' | 'unknown';
  recommendation: string;
  suggestedWeightAdjustment: number; // -1 到 1 之间
}

/**
 * 存储键
 */
const STORAGE_KEYS = {
  FEEDBACK_RECORDS: 'feedback_records',
  FEEDBACK_STATS: 'feedback_stats',
} as const;

/**
 * FeedbackLogger 类
 */
export class FeedbackLogger {
  private records: FeedbackRecord[] = [];
  private statsCache: Map<SceneType, FeedbackStats> = new Map();
  private initialized = false;

  /**
   * 配置
   */
  private readonly config = {
    // 最大记录数量（防止存储膨胀）
    maxRecords: 1000,
    // 记录保留天数
    retentionDays: 30,
    // 健康接受率阈值
    healthyAcceptRateThreshold: 0.6,
    // 拒绝模式阈值
    rejectedRateThreshold: 0.3,
    // 连续忽略警告阈值
    consecutiveIgnoreWarningThreshold: 3,
  };

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadRecords();
    this.rebuildStatsCache();
    this.initialized = true;
    
    console.log('[FeedbackLogger] Initialized with', this.records.length, 'records');
  }

  /**
   * 记录用户反馈
   */
  async logFeedback(
    sceneType: SceneType,
    feedback: UserFeedback,
    confidence: number,
    contextSignals: string[],
    executedActions?: string[]
  ): Promise<void> {
    const record: FeedbackRecord = {
      id: this.generateId(),
      sceneType,
      feedback,
      confidence,
      timestamp: Date.now(),
      contextSignals,
      executedActions,
    };

    this.records.push(record);
    this.updateStats(sceneType, record);

    // 清理过期记录
    this.cleanupOldRecords();

    // 持久化
    await this.saveRecords();

    console.log(`[FeedbackLogger] Logged ${feedback} for ${sceneType}, confidence: ${confidence.toFixed(2)}`);
  }

  /**
   * 获取场景的反馈统计
   */
  getStats(sceneType: SceneType): FeedbackStats | null {
    return this.statsCache.get(sceneType) || null;
  }

  /**
   * 获取所有场景的反馈统计
   */
  getAllStats(): FeedbackStats[] {
    return Array.from(this.statsCache.values());
  }

  /**
   * 分析反馈模式
   */
  analyzeFeedbackPattern(sceneType: SceneType): FeedbackPattern {
    const stats = this.getStats(sceneType);

    if (!stats || stats.totalCount < 5) {
      return {
        sceneType,
        pattern: 'unknown',
        recommendation: '数据不足，继续收集反馈',
        suggestedWeightAdjustment: 0,
      };
    }

    // 检查是否被拒绝
    if (stats.acceptRate < this.config.rejectedRateThreshold) {
      return {
        sceneType,
        pattern: 'rejected',
        recommendation: '用户频繁拒绝此场景，建议降低触发频率或调整条件',
        suggestedWeightAdjustment: -0.3,
      };
    }

    // 检查连续忽略
    if (stats.consecutiveIgnores >= this.config.consecutiveIgnoreWarningThreshold) {
      return {
        sceneType,
        pattern: 'declining',
        recommendation: '用户连续忽略此场景，可能需要调整触发时机',
        suggestedWeightAdjustment: -0.15,
      };
    }

    // 检查健康状态
    if (stats.acceptRate >= this.config.healthyAcceptRateThreshold) {
      return {
        sceneType,
        pattern: 'healthy',
        recommendation: '场景识别效果良好',
        suggestedWeightAdjustment: 0.1,
      };
    }

    // 中等状态
    return {
      sceneType,
      pattern: 'declining',
      recommendation: '场景识别效果一般，可考虑微调',
      suggestedWeightAdjustment: -0.05,
    };
  }

  /**
   * 获取最近的反馈记录
   */
  getRecentRecords(limit: number = 20): FeedbackRecord[] {
    return this.records.slice(-limit).reverse();
  }

  /**
   * 获取指定场景的反馈记录
   */
  getRecordsForScene(sceneType: SceneType, limit: number = 20): FeedbackRecord[] {
    return this.records
      .filter(r => r.sceneType === sceneType)
      .slice(-limit)
      .reverse();
  }

  /**
   * 转换为 TriggerHistory 格式（兼容现有代码）
   */
  toTriggerHistory(sceneType: SceneType): TriggerHistory {
    const stats = this.getStats(sceneType);

    if (!stats) {
      return {
        sceneType,
        lastTriggerTime: 0,
        acceptCount: 0,
        ignoreCount: 0,
        cancelCount: 0,
        consecutiveIgnores: 0,
        lastFeedback: null,
      };
    }

    return {
      sceneType,
      lastTriggerTime: stats.lastFeedbackTime || 0,
      acceptCount: stats.acceptCount,
      ignoreCount: stats.ignoreCount,
      cancelCount: stats.cancelCount,
      consecutiveIgnores: stats.consecutiveIgnores,
      lastFeedback: stats.lastFeedback,
    };
  }

  /**
   * 清空所有记录
   */
  async clearAll(): Promise<void> {
    this.records = [];
    this.statsCache.clear();
    await this.saveRecords();
    console.log('[FeedbackLogger] All records cleared');
  }

  // ==================== 私有方法 ====================

  /**
   * 加载记录
   */
  private async loadRecords(): Promise<void> {
    try {
      const data = storageManager.getString(STORAGE_KEYS.FEEDBACK_RECORDS);
      if (data) {
        this.records = JSON.parse(data);
      }
    } catch (error) {
      console.error('[FeedbackLogger] Failed to load records:', error);
      this.records = [];
    }
  }

  /**
   * 保存记录
   */
  private async saveRecords(): Promise<void> {
    try {
      storageManager.set(STORAGE_KEYS.FEEDBACK_RECORDS, JSON.stringify(this.records));
    } catch (error) {
      console.error('[FeedbackLogger] Failed to save records:', error);
    }
  }

  /**
   * 重建统计缓存
   */
  private rebuildStatsCache(): void {
    this.statsCache.clear();

    // 按场景分组
    const recordsByScene = new Map<SceneType, FeedbackRecord[]>();
    for (const record of this.records) {
      const existing = recordsByScene.get(record.sceneType) || [];
      existing.push(record);
      recordsByScene.set(record.sceneType, existing);
    }

    // 计算每个场景的统计
    for (const [sceneType, sceneRecords] of recordsByScene) {
      this.statsCache.set(sceneType, this.calculateStats(sceneType, sceneRecords));
    }
  }

  /**
   * 计算统计数据
   */
  private calculateStats(sceneType: SceneType, records: FeedbackRecord[]): FeedbackStats {
    const totalCount = records.length;
    const acceptCount = records.filter(r => r.feedback === 'accept').length;
    const ignoreCount = records.filter(r => r.feedback === 'ignore').length;
    const cancelCount = records.filter(r => r.feedback === 'cancel').length;

    // 计算连续忽略
    let consecutiveIgnores = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].feedback === 'ignore') {
        consecutiveIgnores++;
      } else {
        break;
      }
    }

    // 最后一条记录
    const lastRecord = records[records.length - 1];

    // 计算接受/忽略时的平均置信度
    const acceptRecords = records.filter(r => r.feedback === 'accept');
    const ignoreRecords = records.filter(r => r.feedback === 'ignore');

    const avgConfidenceAccept = acceptRecords.length > 0
      ? acceptRecords.reduce((sum, r) => sum + r.confidence, 0) / acceptRecords.length
      : 0;

    const avgConfidenceIgnore = ignoreRecords.length > 0
      ? ignoreRecords.reduce((sum, r) => sum + r.confidence, 0) / ignoreRecords.length
      : 0;

    return {
      sceneType,
      totalCount,
      acceptCount,
      ignoreCount,
      cancelCount,
      acceptRate: totalCount > 0 ? acceptCount / totalCount : 0,
      ignoreRate: totalCount > 0 ? ignoreCount / totalCount : 0,
      cancelRate: totalCount > 0 ? cancelCount / totalCount : 0,
      consecutiveIgnores,
      lastFeedback: lastRecord?.feedback || null,
      lastFeedbackTime: lastRecord?.timestamp || null,
      averageConfidenceOnAccept: avgConfidenceAccept,
      averageConfidenceOnIgnore: avgConfidenceIgnore,
    };
  }

  /**
   * 更新单个场景的统计（增量更新）
   */
  private updateStats(sceneType: SceneType, newRecord: FeedbackRecord): void {
    const existing = this.statsCache.get(sceneType);

    if (!existing) {
      // 首次记录
      this.statsCache.set(sceneType, {
        sceneType,
        totalCount: 1,
        acceptCount: newRecord.feedback === 'accept' ? 1 : 0,
        ignoreCount: newRecord.feedback === 'ignore' ? 1 : 0,
        cancelCount: newRecord.feedback === 'cancel' ? 1 : 0,
        acceptRate: newRecord.feedback === 'accept' ? 1 : 0,
        ignoreRate: newRecord.feedback === 'ignore' ? 1 : 0,
        cancelRate: newRecord.feedback === 'cancel' ? 1 : 0,
        consecutiveIgnores: newRecord.feedback === 'ignore' ? 1 : 0,
        lastFeedback: newRecord.feedback,
        lastFeedbackTime: newRecord.timestamp,
        averageConfidenceOnAccept: newRecord.feedback === 'accept' ? newRecord.confidence : 0,
        averageConfidenceOnIgnore: newRecord.feedback === 'ignore' ? newRecord.confidence : 0,
      });
      return;
    }

    // 增量更新
    const newTotal = existing.totalCount + 1;
    const newAccept = existing.acceptCount + (newRecord.feedback === 'accept' ? 1 : 0);
    const newIgnore = existing.ignoreCount + (newRecord.feedback === 'ignore' ? 1 : 0);
    const newCancel = existing.cancelCount + (newRecord.feedback === 'cancel' ? 1 : 0);

    // 更新连续忽略
    const newConsecutiveIgnores = newRecord.feedback === 'ignore'
      ? existing.consecutiveIgnores + 1
      : 0;

    // 更新平均置信度
    let newAvgAccept = existing.averageConfidenceOnAccept;
    let newAvgIgnore = existing.averageConfidenceOnIgnore;

    if (newRecord.feedback === 'accept') {
      newAvgAccept = (existing.averageConfidenceOnAccept * existing.acceptCount + newRecord.confidence) / newAccept;
    } else if (newRecord.feedback === 'ignore') {
      newAvgIgnore = (existing.averageConfidenceOnIgnore * existing.ignoreCount + newRecord.confidence) / newIgnore;
    }

    this.statsCache.set(sceneType, {
      sceneType,
      totalCount: newTotal,
      acceptCount: newAccept,
      ignoreCount: newIgnore,
      cancelCount: newCancel,
      acceptRate: newAccept / newTotal,
      ignoreRate: newIgnore / newTotal,
      cancelRate: newCancel / newTotal,
      consecutiveIgnores: newConsecutiveIgnores,
      lastFeedback: newRecord.feedback,
      lastFeedbackTime: newRecord.timestamp,
      averageConfidenceOnAccept: newAvgAccept,
      averageConfidenceOnIgnore: newAvgIgnore,
    });
  }

  /**
   * 清理过期记录
   */
  private cleanupOldRecords(): void {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);

    // 按时间过滤
    this.records = this.records.filter(r => r.timestamp > cutoffTime);

    // 限制数量
    if (this.records.length > this.config.maxRecords) {
      this.records = this.records.slice(-this.config.maxRecords);
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出单例实例
export const feedbackLogger = new FeedbackLogger();

export default FeedbackLogger;
