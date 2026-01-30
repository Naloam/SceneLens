/**
 * WeightAdjuster - 规则权重调整器
 * 
 * 职责：根据用户反馈自动调整规则权重
 * - 分析反馈模式
 * - 计算权重调整值
 * - 应用调整到规则引擎
 * - 持久化权重配置
 */

import type { SceneType, StorageKeys } from '../types';
import { feedbackLogger, FeedbackPattern, FeedbackStats } from './FeedbackLogger';
import { storageManager } from '../stores/storageManager';

/**
 * 权重配置
 */
export interface WeightConfig {
  sceneType: SceneType;
  baseWeight: number;      // 基础权重（1.0 为默认）
  adjustment: number;      // 当前调整值（-0.5 到 0.5）
  effectiveWeight: number; // 有效权重 = baseWeight + adjustment
  lastAdjusted: number;
  adjustmentHistory: WeightAdjustmentRecord[];
}

/**
 * 权重调整记录
 */
export interface WeightAdjustmentRecord {
  timestamp: number;
  previousWeight: number;
  newWeight: number;
  reason: string;
  pattern: FeedbackPattern['pattern'];
}

/**
 * 调整建议
 */
export interface AdjustmentRecommendation {
  sceneType: SceneType;
  currentWeight: number;
  suggestedWeight: number;
  delta: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  autoApply: boolean;  // 是否建议自动应用
}

/**
 * 存储键
 */
const STORAGE_KEYS = {
  WEIGHT_CONFIGS: 'weight_configs',
} as const;

/**
 * 所有场景类型
 */
const ALL_SCENE_TYPES: SceneType[] = [
  'COMMUTE',
  'OFFICE',
  'HOME',
  'STUDY',
  'SLEEP',
  'TRAVEL',
  'UNKNOWN',
];

/**
 * WeightAdjuster 类
 */
export class WeightAdjuster {
  private weights: Map<SceneType, WeightConfig> = new Map();
  private initialized = false;
  
  /**
   * 权重调整监听器
   */
  private listeners: Array<(sceneType: SceneType, newWeight: number) => void> = [];

  /**
   * 配置
   */
  private readonly config = {
    // 最小权重
    minWeight: 0.3,
    // 最大权重
    maxWeight: 1.5,
    // 单次最大调整幅度
    maxSingleAdjustment: 0.2,
    // 自动调整的最小反馈数量
    minFeedbackForAutoAdjust: 10,
    // 高置信度自动应用阈值
    highConfidenceThreshold: 0.8,
    // 调整历史保留数量
    maxHistoryRecords: 20,
    // 调整冷却时间（小时）
    adjustmentCooldownHours: 24,
  };

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await feedbackLogger.initialize();
    await this.loadWeights();
    this.ensureAllScenesHaveWeights();
    this.initialized = true;

    console.log('[WeightAdjuster] Initialized');
  }

  /**
   * 获取场景的有效权重
   */
  getWeight(sceneType: SceneType): number {
    const config = this.weights.get(sceneType);
    return config?.effectiveWeight ?? 1.0;
  }

  /**
   * 获取场景的权重配置
   */
  getWeightConfig(sceneType: SceneType): WeightConfig | null {
    return this.weights.get(sceneType) || null;
  }

  /**
   * 获取所有权重配置
   */
  getAllWeightConfigs(): WeightConfig[] {
    return Array.from(this.weights.values());
  }

  /**
   * 分析并获取调整建议
   */
  getAdjustmentRecommendations(): AdjustmentRecommendation[] {
    const recommendations: AdjustmentRecommendation[] = [];

    for (const sceneType of ALL_SCENE_TYPES) {
      if (sceneType === 'UNKNOWN') continue;

      const pattern = feedbackLogger.analyzeFeedbackPattern(sceneType);
      const currentWeight = this.getWeight(sceneType);
      const stats = feedbackLogger.getStats(sceneType);

      if (pattern.pattern === 'unknown') continue;

      // 检查是否在冷却期
      const weightConfig = this.weights.get(sceneType);
      if (weightConfig && this.isInCooldown(weightConfig)) {
        continue;
      }

      // 计算建议的调整
      let delta = pattern.suggestedWeightAdjustment;
      
      // 限制单次调整幅度
      delta = Math.max(-this.config.maxSingleAdjustment, Math.min(this.config.maxSingleAdjustment, delta));

      const suggestedWeight = this.clampWeight(currentWeight + delta);

      // 如果调整很小，跳过
      if (Math.abs(suggestedWeight - currentWeight) < 0.01) continue;

      // 计算置信度
      const confidence = this.calculateConfidence(stats);

      // 是否建议自动应用
      const autoApply = confidence === 'high' && 
                        (stats?.totalCount ?? 0) >= this.config.minFeedbackForAutoAdjust;

      recommendations.push({
        sceneType,
        currentWeight,
        suggestedWeight,
        delta: suggestedWeight - currentWeight,
        reason: pattern.recommendation,
        confidence,
        autoApply,
      });
    }

    return recommendations;
  }

  /**
   * 应用调整建议
   */
  async applyRecommendation(recommendation: AdjustmentRecommendation): Promise<void> {
    await this.adjustWeight(
      recommendation.sceneType,
      recommendation.suggestedWeight,
      recommendation.reason
    );
  }

  /**
   * 自动应用所有高置信度的调整
   */
  async autoApplyRecommendations(): Promise<number> {
    const recommendations = this.getAdjustmentRecommendations();
    let appliedCount = 0;

    for (const rec of recommendations) {
      if (rec.autoApply) {
        await this.applyRecommendation(rec);
        appliedCount++;
      }
    }

    if (appliedCount > 0) {
      console.log(`[WeightAdjuster] Auto-applied ${appliedCount} weight adjustments`);
    }

    return appliedCount;
  }

  /**
   * 手动调整权重
   */
  async adjustWeight(
    sceneType: SceneType,
    newWeight: number,
    reason: string
  ): Promise<void> {
    const config = this.weights.get(sceneType);
    const previousWeight = config?.effectiveWeight ?? 1.0;
    const clampedWeight = this.clampWeight(newWeight);

    // 创建调整记录
    const record: WeightAdjustmentRecord = {
      timestamp: Date.now(),
      previousWeight,
      newWeight: clampedWeight,
      reason,
      pattern: feedbackLogger.analyzeFeedbackPattern(sceneType).pattern,
    };

    // 更新配置
    const newConfig: WeightConfig = {
      sceneType,
      baseWeight: 1.0,
      adjustment: clampedWeight - 1.0,
      effectiveWeight: clampedWeight,
      lastAdjusted: Date.now(),
      adjustmentHistory: [
        ...(config?.adjustmentHistory || []).slice(-this.config.maxHistoryRecords + 1),
        record,
      ],
    };

    this.weights.set(sceneType, newConfig);
    await this.saveWeights();

    // 通知监听器
    this.notifyListeners(sceneType, clampedWeight);

    console.log(`[WeightAdjuster] Adjusted ${sceneType} weight: ${previousWeight.toFixed(2)} -> ${clampedWeight.toFixed(2)}`);
  }

  /**
   * 重置场景权重
   */
  async resetWeight(sceneType: SceneType): Promise<void> {
    const config = this.weights.get(sceneType);
    if (config) {
      await this.adjustWeight(sceneType, 1.0, '用户手动重置');
    }
  }

  /**
   * 重置所有权重
   */
  async resetAllWeights(): Promise<void> {
    for (const sceneType of ALL_SCENE_TYPES) {
      await this.resetWeight(sceneType);
    }
  }

  /**
   * 添加权重变化监听器
   */
  addListener(listener: (sceneType: SceneType, newWeight: number) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * 根据反馈直接触发调整（实时反馈响应）
   * 当用户给出反馈时调用
   */
  async onUserFeedback(sceneType: SceneType): Promise<void> {
    // 检查是否需要调整
    const stats = feedbackLogger.getStats(sceneType);
    if (!stats || stats.totalCount < 5) return;

    const pattern = feedbackLogger.analyzeFeedbackPattern(sceneType);
    
    // 只有在明显的拒绝模式时才即时调整
    if (pattern.pattern === 'rejected') {
      const currentWeight = this.getWeight(sceneType);
      const newWeight = this.clampWeight(currentWeight - 0.1);
      
      await this.adjustWeight(
        sceneType,
        newWeight,
        '用户频繁拒绝，自动降低权重'
      );
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 加载权重配置
   */
  private async loadWeights(): Promise<void> {
    try {
      const data = storageManager.getString(STORAGE_KEYS.WEIGHT_CONFIGS);
      if (data) {
        const configs: WeightConfig[] = JSON.parse(data);
        for (const config of configs) {
          this.weights.set(config.sceneType, config);
        }
      }
    } catch (error) {
      console.error('[WeightAdjuster] Failed to load weights:', error);
    }
  }

  /**
   * 保存权重配置
   */
  private async saveWeights(): Promise<void> {
    try {
      const configs = Array.from(this.weights.values());
      storageManager.set(STORAGE_KEYS.WEIGHT_CONFIGS, JSON.stringify(configs));
    } catch (error) {
      console.error('[WeightAdjuster] Failed to save weights:', error);
    }
  }

  /**
   * 确保所有场景都有权重配置
   */
  private ensureAllScenesHaveWeights(): void {
    for (const sceneType of ALL_SCENE_TYPES) {
      if (!this.weights.has(sceneType)) {
        this.weights.set(sceneType, {
          sceneType,
          baseWeight: 1.0,
          adjustment: 0,
          effectiveWeight: 1.0,
          lastAdjusted: 0,
          adjustmentHistory: [],
        });
      }
    }
  }

  /**
   * 限制权重范围
   */
  private clampWeight(weight: number): number {
    return Math.max(this.config.minWeight, Math.min(this.config.maxWeight, weight));
  }

  /**
   * 检查是否在冷却期
   */
  private isInCooldown(config: WeightConfig): boolean {
    if (!config.lastAdjusted) return false;
    const cooldownMs = this.config.adjustmentCooldownHours * 60 * 60 * 1000;
    return Date.now() - config.lastAdjusted < cooldownMs;
  }

  /**
   * 计算调整置信度
   */
  private calculateConfidence(stats: FeedbackStats | null): 'high' | 'medium' | 'low' {
    if (!stats) return 'low';

    if (stats.totalCount >= 20 && 
        (stats.acceptRate >= this.config.highConfidenceThreshold || 
         stats.ignoreRate >= this.config.highConfidenceThreshold)) {
      return 'high';
    }

    if (stats.totalCount >= 10) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * 通知监听器
   */
  private notifyListeners(sceneType: SceneType, newWeight: number): void {
    for (const listener of this.listeners) {
      try {
        listener(sceneType, newWeight);
      } catch (error) {
        console.error('[WeightAdjuster] Listener error:', error);
      }
    }
  }
}

// 导出单例实例
export const weightAdjuster = new WeightAdjuster();

export default WeightAdjuster;
