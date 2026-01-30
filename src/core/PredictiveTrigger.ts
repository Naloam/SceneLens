/**
 * PredictiveTrigger - 预测触发器
 * 
 * 职责：在置信度不足时，智能提示用户，并根据反馈学习。
 * 实现置信度阈值检查、停留时间检查、冷却机制等功能。
 * 
 * 集成反思层：
 * - FeedbackLogger: 记录用户反馈详情
 * - WeightAdjuster: 根据反馈动态调整场景权重
 */

import {
  SilentContext,
  SceneType,
  TriggerHistory,
  TriggerDecision,
  UserFeedback,
  StorageKeys,
} from '../types';
import { feedbackLogger } from '../reflection/FeedbackLogger';
import { weightAdjuster } from '../reflection/WeightAdjuster';

/**
 * 简单的存储接口
 */
interface SimpleStorage {
  set(key: string, value: string): void;
  getString(key: string): string | undefined;
  clearAll(): void;
}

/**
 * 内存存储实现（用于测试和开发）
 */
class MemoryStorage implements SimpleStorage {
  private data: Map<string, string> = new Map();

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  getString(key: string): string | undefined {
    return this.data.get(key);
  }

  clearAll(): void {
    this.data.clear();
  }
}

/**
 * MMKV 存储实现
 */
class MMKVStorage implements SimpleStorage {
  private storage: any;

  constructor() {
    try {
      const { MMKV } = require('react-native-mmkv');
      this.storage = new MMKV({
        id: 'predictive-trigger',
        encryptionKey: 'scenelens-trigger-key',
      });
    } catch (error) {
      console.warn('MMKV not available, using memory storage:', error);
      this.storage = new MemoryStorage();
    }
  }

  set(key: string, value: string): void {
    this.storage.set(key, value);
  }

  getString(key: string): string | undefined {
    return this.storage.getString(key);
  }

  clearAll(): void {
    if (this.storage.clearAll) {
      this.storage.clearAll();
    } else {
      // Fallback for memory storage
      this.storage.data?.clear();
    }
  }
}

/**
 * 停留时间跟踪
 */
interface DwellTimeTracker {
  sceneType: SceneType;
  startTime: number;
  lastUpdateTime: number;
}

/**
 * PredictiveTrigger 类
 * 
 * 预测触发器，负责：
 * 1. 检查置信度阈值（0.6-0.75）
 * 2. 检查停留时间（2分钟）
 * 3. 实现冷却机制（1小时）
 * 4. 记录和学习用户反馈
 */
export class PredictiveTrigger {
  /**
   * 存储实例
   */
  private storage: SimpleStorage;

  /**
   * 触发历史缓存
   */
  private historyCache: Map<SceneType, TriggerHistory> = new Map();

  /**
   * 停留时间跟踪器
   */
  private dwellTracker: DwellTimeTracker | null = null;

  /**
   * 反思层初始化状态
   */
  private reflectionInitialized = false;

  /**
   * 配置常量
   */
  private readonly config = {
    // 置信度阈值范围
    minConfidence: 0.6,
    maxConfidence: 0.75,
    
    // 停留时间要求（2分钟）
    minDwellTime: 2 * 60 * 1000,
    
    // 冷却时间（1小时）
    cooldownPeriod: 60 * 60 * 1000,
    
    // 高忽略率阈值
    highIgnoreRateThreshold: 0.7,
    
    // 连续忽略阈值（需求 10.3：连续 3 次忽略）
    consecutiveIgnoreThreshold: 3,
    
    // 自动模式升级阈值
    autoModeUpgradeThreshold: 5,
  };

  constructor() {
    this.storage = new MMKVStorage();
    
    // 加载历史数据
    this.loadHistoryFromStorage();
    
    // 初始化反思层（异步）
    this.initializeReflection();
  }

  /**
   * 初始化反思层
   */
  private async initializeReflection(): Promise<void> {
    if (this.reflectionInitialized) return;
    
    try {
      await feedbackLogger.initialize();
      await weightAdjuster.initialize();
      this.reflectionInitialized = true;
      console.log('[PredictiveTrigger] Reflection layer initialized');
    } catch (error) {
      console.error('[PredictiveTrigger] Failed to initialize reflection layer:', error);
    }
  }

  /**
   * 判断是否应该触发场景建议
   * 
   * 检查流程：
   * 1. 置信度是否在 0.6-0.75 范围内
   * 2. 用户是否在该场景停留超过 2 分钟
   * 3. 是否在冷却期内
   * 4. 用户历史反馈是否表明应该降低触发频率
   * 
   * @param context 静默上下文
   * @returns 触发决策
   */
  shouldTrigger(context: SilentContext): TriggerDecision {
    // 1. 检查置信度阈值
    if (context.confidence < this.config.minConfidence || 
        context.confidence > this.config.maxConfidence) {
      return {
        suggest: false,
        reason: 'confidence_out_of_range',
      };
    }

    // 2. 检查停留时间
    const dwellTime = this.updateAndGetDwellTime(context);
    if (dwellTime < this.config.minDwellTime) {
      return {
        suggest: false,
        reason: 'insufficient_dwell_time',
      };
    }

    // 3. 检查冷却时间
    const history = this.getHistory(context.context);
    if (this.isInCooldown(history)) {
      return {
        suggest: false,
        reason: 'in_cooldown',
      };
    }

    // 4. 检查用户反馈历史
    if (this.hasHighIgnoreRate(history)) {
      return {
        suggest: false,
        reason: 'high_ignore_rate',
      };
    }

    // 所有检查通过，建议触发
    return {
      suggest: true,
      sceneType: context.context,
      confidence: context.confidence,
    };
  }

  /**
   * 记录用户反馈
   * 
   * 实现需求 10.3 和 10.6：
   * - 记录用户的"接受/忽略/取消"操作
   * - 跟踪连续忽略次数，实现触发频率调整
   * - 在自动模式下记录反馈并调整场景权重
   * - 集成反思层进行反馈分析和权重调整
   * 
   * @param sceneType 场景类型
   * @param feedback 用户反馈
   * @param confidence 触发时的置信度
   * @param contextSignals 触发时的信号摘要
   */
  recordFeedback(
    sceneType: SceneType, 
    feedback: UserFeedback,
    confidence: number = 0.7,
    contextSignals: string[] = []
  ): void {
    const history = this.getHistory(sceneType);
    
    // 更新触发时间
    history.lastTriggerTime = Date.now();
    
    // 更新反馈计数
    switch (feedback) {
      case 'accept':
        history.acceptCount++;
        // 接受操作重置连续忽略计数
        history.consecutiveIgnores = 0;
        break;
      case 'ignore':
        history.ignoreCount++;
        // 更新连续忽略计数
        if (history.lastFeedback === 'ignore') {
          history.consecutiveIgnores++;
        } else {
          history.consecutiveIgnores = 1;
        }
        break;
      case 'cancel':
        history.cancelCount++;
        // 取消操作重置连续忽略计数
        history.consecutiveIgnores = 0;
        break;
    }

    // 更新最后一次反馈
    history.lastFeedback = feedback;

    // 更新缓存和存储
    this.historyCache.set(sceneType, history);
    this.saveHistoryToStorage();

    // === 反思层集成 ===
    // 记录详细反馈到 FeedbackLogger
    this.logFeedbackToReflection(sceneType, feedback, confidence, contextSignals);
    
    // 触发权重调整检查
    this.checkWeightAdjustment(sceneType);

    // 检查是否应该建议升级为自动模式
    if (this.shouldSuggestAutoMode(history)) {
      this.onAutoModeUpgradeSuggestion(sceneType, history);
    }

    // 检查连续忽略情况（需求 10.3）
    if (history.consecutiveIgnores >= this.config.consecutiveIgnoreThreshold) {
      this.onConsecutiveIgnoresDetected(sceneType, history);
    }
  }

  /**
   * 获取场景的触发历史
   * 
   * @param sceneType 场景类型
   * @returns 触发历史
   */
  getHistory(sceneType: SceneType): TriggerHistory {
    let history = this.historyCache.get(sceneType);
    
    if (!history) {
      history = {
        sceneType,
        lastTriggerTime: 0,
        acceptCount: 0,
        ignoreCount: 0,
        cancelCount: 0,
        consecutiveIgnores: 0,
        lastFeedback: null,
      };
      this.historyCache.set(sceneType, history);
    }
    
    return history;
  }

  /**
   * 获取所有场景的触发历史
   * 
   * @returns 所有触发历史
   */
  getAllHistory(): TriggerHistory[] {
    return Array.from(this.historyCache.values());
  }

  /**
   * 清除指定场景的历史数据
   * 
   * @param sceneType 场景类型
   */
  clearHistory(sceneType: SceneType): void {
    this.historyCache.delete(sceneType);
    this.saveHistoryToStorage();
  }

  /**
   * 清除所有历史数据
   */
  clearAllHistory(): void {
    this.historyCache.clear();
    this.storage.clearAll();
  }

  /**
   * 重置停留时间跟踪器
   */
  resetDwellTracker(): void {
    this.dwellTracker = null;
  }

  /**
   * 更新并获取停留时间
   * 
   * @param context 当前上下文
   * @returns 停留时间（毫秒）
   */
  private updateAndGetDwellTime(context: SilentContext): number {
    const now = Date.now();
    
    // 如果场景发生变化，重置跟踪器
    if (!this.dwellTracker || this.dwellTracker.sceneType !== context.context) {
      this.dwellTracker = {
        sceneType: context.context,
        startTime: now,
        lastUpdateTime: now,
      };
      return 0;
    }

    // 更新最后更新时间
    this.dwellTracker.lastUpdateTime = now;
    
    // 返回停留时间
    return now - this.dwellTracker.startTime;
  }

  /**
   * 检查是否在冷却期内
   * 
   * @param history 触发历史
   * @returns 是否在冷却期
   */
  private isInCooldown(history: TriggerHistory): boolean {
    if (history.lastTriggerTime === 0) {
      return false;
    }
    
    const timeSinceLastTrigger = Date.now() - history.lastTriggerTime;
    return timeSinceLastTrigger < this.config.cooldownPeriod;
  }

  /**
   * 检查是否有高忽略率或连续忽略
   * 
   * 实现需求 10.3：连续 3 次忽略降低触发频率
   * 
   * @param history 触发历史
   * @returns 是否应该降低触发频率
   */
  private hasHighIgnoreRate(history: TriggerHistory): boolean {
    // 检查连续忽略（需求 10.3）
    if (history.consecutiveIgnores >= this.config.consecutiveIgnoreThreshold) {
      return true;
    }

    // 检查总体忽略率
    const totalFeedback = history.acceptCount + history.ignoreCount + history.cancelCount;
    
    if (totalFeedback < 3) {
      // 反馈数量太少，不做判断
      return false;
    }
    
    const ignoreRate = history.ignoreCount / totalFeedback;
    return ignoreRate > this.config.highIgnoreRateThreshold;
  }



  /**
   * 自动模式升级建议回调
   * 
   * 子类可以重写此方法来处理升级建议
   * 
   * @param sceneType 场景类型
   * @param history 触发历史
   */
  protected onAutoModeUpgradeSuggestion(sceneType: SceneType, history: TriggerHistory): void {
    console.log(`建议将 ${sceneType} 场景升级为自动模式`, {
      acceptCount: history.acceptCount,
      ignoreCount: history.ignoreCount,
      cancelCount: history.cancelCount,
    });

    // 触发自动模式升级提示
    this.showAutoModeUpgradePrompt(sceneType, history);
  }

  /**
   * 显示自动模式升级提示
   * 
   * 实现需求 10.4 和 10.5：
   * - 检测用户连续 5 次接受同类场景
   * - 弹出升级为自动模式的提示
   * 
   * @param sceneType 场景类型
   * @param history 触发历史
   */
  private async showAutoModeUpgradePrompt(sceneType: SceneType, history: TriggerHistory): Promise<void> {
    try {
      // 动态导入 NotificationManager 以避免循环依赖
      const { notificationManager } = await import('../notifications/NotificationManager');
      
      // 确保通知管理器已初始化
      await notificationManager.initialize();

      // 构建升级提示通知
      const sceneDisplayName = this.getSceneDisplayName(sceneType);
      const title = `🚀 ${sceneDisplayName}场景升级建议`;
      const body = `您已连续 ${history.acceptCount} 次接受${sceneDisplayName}场景建议，是否升级为自动执行模式？`;

      // 显示自动模式升级通知
      const notificationId = await notificationManager.showAutoModeUpgradePrompt({
        sceneType,
        title,
        body,
        acceptCount: history.acceptCount,
      });

      if (notificationId) {
        console.log(`已显示 ${sceneType} 场景自动模式升级提示，通知ID: ${notificationId}`);
      } else {
        console.warn(`显示 ${sceneType} 场景自动模式升级提示失败`);
      }
    } catch (error) {
      console.error('显示自动模式升级提示时发生错误:', error);
    }
  }

  /**
   * 获取场景显示名称
   * 
   * @param sceneType 场景类型
   * @returns 场景显示名称
   */
  private getSceneDisplayName(sceneType: SceneType): string {
    const sceneNames: Record<SceneType, string> = {
      COMMUTE: '通勤',
      OFFICE: '办公',
      HOME: '到家',
      STUDY: '学习',
      SLEEP: '睡前',
      TRAVEL: '出行',
      UNKNOWN: '未知',
    };

    return sceneNames[sceneType] || sceneType;
  }

  /**
   * 处理自动模式升级响应
   * 
   * @param sceneType 场景类型
   * @param accepted 用户是否接受升级
   */
  async handleAutoModeUpgradeResponse(sceneType: SceneType, accepted: boolean): Promise<void> {
    console.log(`用户${accepted ? '接受' : '拒绝'}了 ${sceneType} 场景的自动模式升级`);

    if (accepted) {
      // 用户接受升级，启用自动模式
      await this.enableAutoModeForScene(sceneType);
    } else {
      // 用户拒绝升级，记录拒绝状态，避免重复提示
      await this.recordAutoModeUpgradeRejection(sceneType);
    }
  }

  /**
   * 为场景启用自动模式
   * 
   * @param sceneType 场景类型
   */
  private async enableAutoModeForScene(sceneType: SceneType): Promise<void> {
    try {
      // 动态导入存储管理器
      const { storageManager } = await import('../stores');
      
      // 获取当前用户配置
      const userConfig = await storageManager.getUserConfig();
      
      // 添加到自动模式场景列表
      if (!userConfig.autoModeScenes.includes(sceneType)) {
        userConfig.autoModeScenes.push(sceneType);
        await storageManager.saveUserConfig(userConfig);
        
        console.log(`已为 ${sceneType} 场景启用自动模式`);
        
        // 显示确认通知
        const { notificationManager } = await import('../notifications/NotificationManager');
        await notificationManager.showSystemNotification(
          '✅ 自动模式已启用',
          `${this.getSceneDisplayName(sceneType)}场景已升级为自动执行模式`
        );
      }
    } catch (error) {
      console.error(`启用 ${sceneType} 场景自动模式时发生错误:`, error);
    }
  }

  /**
   * 记录自动模式升级拒绝
   * 
   * @param sceneType 场景类型
   */
  private async recordAutoModeUpgradeRejection(sceneType: SceneType): Promise<void> {
    try {
      // 在历史记录中标记拒绝状态，避免重复提示
      const history = this.getHistory(sceneType);
      
      // 添加拒绝标记（可以扩展 TriggerHistory 接口来支持这个字段）
      (history as any).autoModeUpgradeRejected = true;
      (history as any).autoModeUpgradeRejectedAt = Date.now();
      
      this.historyCache.set(sceneType, history);
      this.saveHistoryToStorage();
      
      console.log(`已记录 ${sceneType} 场景自动模式升级拒绝`);
    } catch (error) {
      console.error(`记录 ${sceneType} 场景自动模式升级拒绝时发生错误:`, error);
    }
  }

  /**
   * 检查是否应该建议升级为自动模式
   * 
   * 实现需求 10.4：连续 5 次接受同类场景后提示升级
   * 
   * @param history 触发历史
   * @returns 是否应该建议升级
   */
  private shouldSuggestAutoMode(history: TriggerHistory): boolean {
    // 检查是否已经拒绝过升级（避免重复提示）
    const rejectedBefore = (history as any).autoModeUpgradeRejected;
    if (rejectedBefore) {
      return false;
    }

    // 检查是否达到升级阈值（连续 5 次接受）
    const meetsThreshold = history.acceptCount >= this.config.autoModeUpgradeThreshold;
    
    // 检查是否没有忽略或取消操作（确保用户真正喜欢这个场景）
    const noNegativeFeedback = history.ignoreCount === 0 && history.cancelCount === 0;

    return meetsThreshold && noNegativeFeedback;
  }

  /**
   * 连续忽略检测回调
   * 
   * 实现需求 10.3：连续 3 次忽略降低触发频率
   * 子类可以重写此方法来处理连续忽略情况
   * 
   * @param sceneType 场景类型
   * @param history 触发历史
   */
  protected onConsecutiveIgnoresDetected(sceneType: SceneType, history: TriggerHistory): void {
    console.log(`检测到 ${sceneType} 场景连续忽略 ${history.consecutiveIgnores} 次，降低触发频率`, {
      consecutiveIgnores: history.consecutiveIgnores,
      threshold: this.config.consecutiveIgnoreThreshold,
    });
  }

  /**
   * 场景权重调整回调
   * 
   * 实现需求 10.6：在自动模式下记录反馈并调整场景权重
   * 子类可以重写此方法来处理权重调整
   * 
   * @param sceneType 场景类型
   * @param feedback 用户反馈
   * @param currentWeight 当前权重
   * @returns 调整后的权重
   */
  protected adjustSceneWeight(
    sceneType: SceneType, 
    feedback: UserFeedback, 
    currentWeight: number = 1.0
  ): number {
    let adjustedWeight = currentWeight;
    
    switch (feedback) {
      case 'accept':
        // 接受反馈增加权重
        adjustedWeight = Math.min(currentWeight * 1.1, 2.0);
        break;
      case 'ignore':
        // 忽略反馈降低权重
        adjustedWeight = Math.max(currentWeight * 0.9, 0.1);
        break;
      case 'cancel':
        // 取消反馈显著降低权重
        adjustedWeight = Math.max(currentWeight * 0.8, 0.1);
        break;
    }

    console.log(`调整 ${sceneType} 场景权重: ${currentWeight.toFixed(2)} → ${adjustedWeight.toFixed(2)} (反馈: ${feedback})`);
    
    return adjustedWeight;
  }

  /**
   * 从存储加载历史数据
   */
  private loadHistoryFromStorage(): void {
    try {
      const historyJson = this.storage.getString(StorageKeys.USER_FEEDBACK);
      if (historyJson) {
        const historyArray: TriggerHistory[] = JSON.parse(historyJson);
        
        // 重建 Map 并处理数据迁移
        this.historyCache.clear();
        for (const history of historyArray) {
          // 数据迁移：为旧数据添加新字段
          const migratedHistory: TriggerHistory = {
            ...history,
            consecutiveIgnores: history.consecutiveIgnores ?? 0,
            lastFeedback: history.lastFeedback ?? null,
          };
          this.historyCache.set(migratedHistory.sceneType, migratedHistory);
        }
      }
    } catch (error) {
      console.warn('Failed to load trigger history from storage:', error);
      this.historyCache.clear();
    }
  }

  /**
   * 保存历史数据到存储
   */
  private saveHistoryToStorage(): void {
    try {
      const historyArray = Array.from(this.historyCache.values());
      const historyJson = JSON.stringify(historyArray);
      this.storage.set(StorageKeys.USER_FEEDBACK, historyJson);
    } catch (error) {
      console.warn('Failed to save trigger history to storage:', error);
    }
  }

  /**
   * 获取统计信息
   * 
   * @returns 统计信息
   */
  getStatistics(): {
    totalScenes: number;
    totalTriggers: number;
    totalAccepts: number;
    totalIgnores: number;
    totalCancels: number;
    averageAcceptRate: number;
    scenesWithConsecutiveIgnores: number;
    scenesWithHighIgnoreRate: number;
  } {
    const histories = Array.from(this.historyCache.values());
    
    const totalTriggers = histories.reduce(
      (sum, h) => sum + h.acceptCount + h.ignoreCount + h.cancelCount,
      0
    );
    
    const totalAccepts = histories.reduce((sum, h) => sum + h.acceptCount, 0);
    const totalIgnores = histories.reduce((sum, h) => sum + h.ignoreCount, 0);
    const totalCancels = histories.reduce((sum, h) => sum + h.cancelCount, 0);
    
    const averageAcceptRate = totalTriggers > 0 ? totalAccepts / totalTriggers : 0;

    // 统计有问题的场景
    const scenesWithConsecutiveIgnores = histories.filter(
      h => h.consecutiveIgnores >= this.config.consecutiveIgnoreThreshold
    ).length;

    const scenesWithHighIgnoreRate = histories.filter(h => {
      const totalFeedback = h.acceptCount + h.ignoreCount + h.cancelCount;
      if (totalFeedback < 3) return false;
      const ignoreRate = h.ignoreCount / totalFeedback;
      return ignoreRate > this.config.highIgnoreRateThreshold;
    }).length;

    return {
      totalScenes: histories.length,
      totalTriggers,
      totalAccepts,
      totalIgnores,
      totalCancels,
      averageAcceptRate,
      scenesWithConsecutiveIgnores,
      scenesWithHighIgnoreRate,
    };
  }

  /**
   * 获取场景的触发频率调整因子
   * 
   * 基于用户反馈历史计算触发频率调整因子
   * 
   * @param sceneType 场景类型
   * @returns 触发频率调整因子 (0.1 - 2.0)
   */
  getTriggerFrequencyFactor(sceneType: SceneType): number {
    const history = this.getHistory(sceneType);
    
    // 基础因子
    let factor = 1.0;
    
    // 连续忽略惩罚
    if (history.consecutiveIgnores >= this.config.consecutiveIgnoreThreshold) {
      factor *= Math.max(0.1, 1.0 - (history.consecutiveIgnores * 0.2));
    }
    
    // 总体反馈调整
    const totalFeedback = history.acceptCount + history.ignoreCount + history.cancelCount;
    if (totalFeedback >= 3) {
      const acceptRate = history.acceptCount / totalFeedback;
      const ignoreRate = history.ignoreCount / totalFeedback;
      
      // 高接受率增加频率
      if (acceptRate > 0.8) {
        factor *= 1.5;
      }
      // 高忽略率降低频率
      else if (ignoreRate > this.config.highIgnoreRateThreshold) {
        factor *= 0.5;
      }
    }
    
    // 限制在合理范围内
    return Math.max(0.1, Math.min(2.0, factor));
  }

  /**
   * 重置场景的连续忽略计数
   * 
   * @param sceneType 场景类型
   */
  resetConsecutiveIgnores(sceneType: SceneType): void {
    const history = this.getHistory(sceneType);
    history.consecutiveIgnores = 0;
    this.historyCache.set(sceneType, history);
    this.saveHistoryToStorage();
  }

  // ==================== 反思层集成方法 ====================

  /**
   * 记录反馈到反思层
   */
  private async logFeedbackToReflection(
    sceneType: SceneType,
    feedback: UserFeedback,
    confidence: number,
    contextSignals: string[]
  ): Promise<void> {
    if (!this.reflectionInitialized) {
      await this.initializeReflection();
    }

    try {
      await feedbackLogger.logFeedback(
        sceneType,
        feedback,
        confidence,
        contextSignals,
        feedback === 'accept' ? ['场景已执行'] : undefined
      );
    } catch (error) {
      console.error('[PredictiveTrigger] Failed to log feedback to reflection:', error);
    }
  }

  /**
   * 检查并触发权重调整
   */
  private async checkWeightAdjustment(sceneType: SceneType): Promise<void> {
    if (!this.reflectionInitialized) return;

    try {
      await weightAdjuster.onUserFeedback(sceneType);
    } catch (error) {
      console.error('[PredictiveTrigger] Failed to check weight adjustment:', error);
    }
  }

  /**
   * 获取场景的调整后权重
   * 
   * @param sceneType 场景类型
   * @returns 调整后的权重
   */
  getSceneWeight(sceneType: SceneType): number {
    if (!this.reflectionInitialized) return 1.0;
    return weightAdjuster.getWeight(sceneType);
  }

  /**
   * 获取反馈统计（从反思层）
   */
  getFeedbackStats(sceneType: SceneType) {
    if (!this.reflectionInitialized) return null;
    return feedbackLogger.getStats(sceneType);
  }

  /**
   * 获取调整建议
   */
  getAdjustmentRecommendations() {
    if (!this.reflectionInitialized) return [];
    return weightAdjuster.getAdjustmentRecommendations();
  }

  /**
   * 自动应用推荐的权重调整
   */
  async autoApplyWeightAdjustments(): Promise<number> {
    if (!this.reflectionInitialized) {
      await this.initializeReflection();
    }
    return weightAdjuster.autoApplyRecommendations();
  }
}

// 导出单例实例
export const predictiveTrigger = new PredictiveTrigger();

// 默认导出类
export default PredictiveTrigger;