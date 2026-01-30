/**
 * BackgroundService - 后台场景检测服务
 * 
 * 职责：
 * - 在后台定期执行场景检测
 * - 管理检测任务调度
 * - 处理后台任务生命周期
 * 
 * 注意：需要配合原生代码实现完整的后台运行
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import { silentContextEngine } from '../core/SilentContextEngine';
import { ruleEngine } from '../rules/RuleEngine';
import { predictiveTrigger } from '../core/PredictiveTrigger';
import { notificationManager } from '../notifications/NotificationManager';
import type { SilentContext, SceneType } from '../types';

/**
 * 后台任务状态
 */
export type BackgroundTaskStatus = 'idle' | 'running' | 'paused' | 'stopped';

/**
 * 后台服务配置
 */
export interface BackgroundServiceConfig {
  // 检测间隔（毫秒）
  detectionIntervalMs: number;
  // 最小检测间隔（省电模式）
  minDetectionIntervalMs: number;
  // 是否在低电量时降低频率
  reducedFrequencyOnLowBattery: boolean;
  // 低电量阈值
  lowBatteryThreshold: number;
  // 是否在充电时保持正常频率
  normalFrequencyWhenCharging: boolean;
}

/**
 * 检测结果
 */
export interface DetectionResult {
  context: SilentContext;
  triggered: boolean;
  sceneType: SceneType;
  timestamp: number;
}

/**
 * BackgroundService 类
 */
export class BackgroundService {
  private config: BackgroundServiceConfig = {
    detectionIntervalMs: 5 * 60 * 1000, // 5分钟
    minDetectionIntervalMs: 15 * 60 * 1000, // 15分钟（省电模式）
    reducedFrequencyOnLowBattery: true,
    lowBatteryThreshold: 20,
    normalFrequencyWhenCharging: true,
  };

  private status: BackgroundTaskStatus = 'idle';
  private intervalId: NodeJS.Timeout | null = null;
  private lastDetectionTime: number = 0;
  private appStateSubscription: any = null;
  private isInForeground: boolean = true;
  private detectionCount: number = 0;

  /**
   * 初始化后台服务
   */
  async initialize(): Promise<void> {
    console.log('[BackgroundService] Initializing...');

    // 监听应用状态变化
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );

    // 初始化通知管理器
    await notificationManager.initialize();

    console.log('[BackgroundService] Initialized');
  }

  /**
   * 启动后台检测
   */
  start(): void {
    if (this.status === 'running') {
      console.log('[BackgroundService] Already running');
      return;
    }

    console.log('[BackgroundService] Starting background detection');
    this.status = 'running';
    this.scheduleNextDetection();
  }

  /**
   * 停止后台检测
   */
  stop(): void {
    console.log('[BackgroundService] Stopping background detection');
    
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    
    this.status = 'stopped';
  }

  /**
   * 暂停后台检测
   */
  pause(): void {
    console.log('[BackgroundService] Pausing background detection');
    
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    
    this.status = 'paused';
  }

  /**
   * 恢复后台检测
   */
  resume(): void {
    if (this.status !== 'paused') {
      return;
    }

    console.log('[BackgroundService] Resuming background detection');
    this.status = 'running';
    this.scheduleNextDetection();
  }

  /**
   * 获取当前状态
   */
  getStatus(): BackgroundTaskStatus {
    return this.status;
  }

  /**
   * 获取检测统计
   */
  getStats(): { detectionCount: number; lastDetectionTime: number } {
    return {
      detectionCount: this.detectionCount,
      lastDetectionTime: this.lastDetectionTime,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BackgroundServiceConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[BackgroundService] Config updated:', this.config);
  }

  /**
   * 立即执行一次检测
   */
  async detectNow(): Promise<DetectionResult | null> {
    return this.performDetection();
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.stop();
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    console.log('[BackgroundService] Destroyed');
  }

  // ==================== 私有方法 ====================

  /**
   * 处理应用状态变化
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const wasForeground = this.isInForeground;
    this.isInForeground = nextAppState === 'active';

    console.log(`[BackgroundService] App state changed: ${nextAppState}`);

    if (wasForeground && !this.isInForeground) {
      // 应用进入后台
      this.onEnterBackground();
    } else if (!wasForeground && this.isInForeground) {
      // 应用进入前台
      this.onEnterForeground();
    }
  }

  /**
   * 应用进入后台
   */
  private onEnterBackground(): void {
    console.log('[BackgroundService] App entered background');
    
    // 如果服务正在运行，继续后台检测
    if (this.status === 'running') {
      // 重新调度，可能使用不同的间隔
      this.scheduleNextDetection();
    }
  }

  /**
   * 应用进入前台
   */
  private onEnterForeground(): void {
    console.log('[BackgroundService] App entered foreground');
    
    // 立即执行一次检测
    if (this.status === 'running') {
      this.performDetection();
    }
  }

  /**
   * 调度下一次检测
   */
  private async scheduleNextDetection(): Promise<void> {
    if (this.status !== 'running') {
      return;
    }

    // 清除现有定时器
    if (this.intervalId) {
      clearTimeout(this.intervalId);
    }

    // 计算下一次检测间隔
    const interval = await this.calculateDetectionInterval();

    this.intervalId = setTimeout(async () => {
      await this.performDetection();
      this.scheduleNextDetection();
    }, interval);

    console.log(`[BackgroundService] Next detection scheduled in ${interval / 1000}s`);
  }

  /**
   * 计算检测间隔
   */
  private async calculateDetectionInterval(): Promise<number> {
    let interval = this.config.detectionIntervalMs;

    // 检查电池状态
    if (this.config.reducedFrequencyOnLowBattery) {
      try {
        const { sceneBridge } = await import('../core/SceneBridge');
        const batteryStatus = await sceneBridge.getBatteryStatus();

        if (batteryStatus.batteryLevel <= this.config.lowBatteryThreshold) {
          // 低电量，使用较长间隔
          if (!this.config.normalFrequencyWhenCharging || !batteryStatus.isCharging) {
            interval = this.config.minDetectionIntervalMs;
            console.log('[BackgroundService] Using reduced frequency due to low battery');
          }
        }
      } catch (error) {
        console.warn('[BackgroundService] Failed to check battery status:', error);
      }
    }

    // 在后台时使用较长间隔
    if (!this.isInForeground) {
      interval = Math.max(interval, this.config.minDetectionIntervalMs);
    }

    return interval;
  }

  /**
   * 执行场景检测
   */
  private async performDetection(): Promise<DetectionResult | null> {
    if (this.status !== 'running' && this.status !== 'idle') {
      return null;
    }

    console.log('[BackgroundService] Performing detection...');
    this.lastDetectionTime = Date.now();
    this.detectionCount++;

    try {
      // 获取当前上下文
      const context = await silentContextEngine.getContext();

      // 匹配规则
      const matchedRules = await ruleEngine.matchRules(context);

      // 检查是否应该触发
      const decision = predictiveTrigger.shouldTrigger(context);

      const result: DetectionResult = {
        context,
        triggered: decision.suggest,
        sceneType: context.context,
        timestamp: Date.now(),
      };

      // 如果应该触发，发送通知
      if (decision.suggest && matchedRules.length > 0) {
        await this.handleTriggeredScene(context, matchedRules);
      }

      console.log(`[BackgroundService] Detection complete: ${context.context} (confidence: ${context.confidence.toFixed(2)})`);

      return result;
    } catch (error) {
      console.error('[BackgroundService] Detection failed:', error);
      return null;
    }
  }

  /**
   * 处理触发的场景
   */
  private async handleTriggeredScene(context: SilentContext, matchedRules: any[]): Promise<void> {
    try {
      // 获取最高优先级的规则
      const topRule = matchedRules[0];

      // 发送场景建议通知
      await notificationManager.showSceneSuggestion({
        sceneType: context.context,
        title: this.getSceneTitle(context.context),
        body: this.getSceneDescription(context.context, context.confidence),
        actions: topRule.rule.actions,
        confidence: context.confidence,
      });

      console.log(`[BackgroundService] Notification sent for ${context.context}`);
    } catch (error) {
      console.error('[BackgroundService] Failed to handle triggered scene:', error);
    }
  }

  /**
   * 获取场景标题
   */
  private getSceneTitle(sceneType: SceneType): string {
    const titles: Record<SceneType, string> = {
      COMMUTE: '🚇 通勤模式',
      OFFICE: '🏢 办公模式',
      HOME: '🏠 到家模式',
      STUDY: '📚 学习模式',
      SLEEP: '😴 睡眠模式',
      TRAVEL: '✈️ 出行模式',
      UNKNOWN: '🤔 场景识别中',
    };
    return titles[sceneType] || sceneType;
  }

  /**
   * 获取场景描述
   */
  private getSceneDescription(sceneType: SceneType, confidence: number): string {
    const descriptions: Record<SceneType, string> = {
      COMMUTE: '检测到您在通勤路上',
      OFFICE: '检测到您在办公环境',
      HOME: '欢迎回家',
      STUDY: '检测到学习氛围',
      SLEEP: '夜深了，该休息了',
      TRAVEL: '检测到出行场景',
      UNKNOWN: '正在分析您的场景',
    };
    
    const desc = descriptions[sceneType] || '';
    return `${desc}（置信度: ${(confidence * 100).toFixed(0)}%）`;
  }
}

// 导出单例实例
export const backgroundService = new BackgroundService();

export default BackgroundService;
