/**
 * FeedbackProcessor - 反馈处理器
 * 
 * 处理用户对建议的反馈并用于优化：
 * - 详细反馈记录（accept/ignore/dismiss/modify）
 * - 反馈洞察分析
 * - 建议权重自动调整
 * - 个性化报告生成
 * 
 * @module learning
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SceneType } from '../types';

// ==================== 存储键 ====================

const STORAGE_KEYS = {
  FEEDBACK_RECORDS: 'feedback_records',
  SUGGESTION_WEIGHTS: 'suggestion_weights',
  FEEDBACK_INSIGHTS: 'feedback_insights',
  PERSONALIZATION_REPORT: 'personalization_report',
};

// ==================== 类型定义 ====================

/**
 * 反馈类型
 */
export type FeedbackType = 
  | 'ACCEPT'          // 接受建议
  | 'IGNORE'          // 忽略建议（未操作）
  | 'DISMISS'         // 明确关闭建议
  | 'MODIFY'          // 修改后执行
  | 'UNDO'            // 执行后撤销
  | 'HELPFUL'         // 标记为有用
  | 'NOT_HELPFUL';    // 标记为无用

/**
 * 建议类型
 */
export type SuggestionType = 
  | 'APP_LAUNCH'      // 应用启动
  | 'SYSTEM_SETTING'  // 系统设置
  | 'QUICK_ACTION'    // 快捷操作
  | 'REMINDER'        // 提醒
  | 'SCENE_ACTION'    // 场景操作
  | 'PREDICTION'      // 预测建议
  | 'AUTOMATION';     // 自动化规则

/**
 * 建议信息
 */
export interface SuggestionInfo {
  /** 建议 ID */
  id: string;
  /** 建议类型 */
  type: SuggestionType;
  /** 触发场景 */
  scene: SceneType;
  /** 建议标题 */
  title: string;
  /** 建议内容 */
  content: string;
  /** 关联应用 */
  relatedApp?: string;
  /** 关联操作 */
  relatedAction?: string;
  /** 置信度 */
  confidence: number;
  /** 来源规则/模式 ID */
  sourceId?: string;
}

/**
 * 反馈记录
 */
export interface FeedbackRecord {
  /** 记录 ID */
  id: string;
  /** 建议信息 */
  suggestion: SuggestionInfo;
  /** 反馈类型 */
  feedback: FeedbackType;
  /** 反馈时间 */
  timestamp: number;
  /** 响应时间（毫秒，从建议显示到用户操作） */
  responseTime?: number;
  /** 用户修改内容 */
  modification?: string;
  /** 用户评论 */
  comment?: string;
  /** 上下文信息 */
  context: {
    hour: number;
    dayOfWeek: number;
    scene: SceneType;
  };
}

/**
 * 建议权重
 */
export interface SuggestionWeight {
  /** 建议类型 */
  type: SuggestionType;
  /** 场景 */
  scene: SceneType;
  /** 权重 (0-2, 1为默认) */
  weight: number;
  /** 样本数量 */
  sampleCount: number;
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 反馈洞察
 */
export interface FeedbackInsight {
  /** 洞察类型 */
  type: 'POSITIVE' | 'NEGATIVE' | 'PATTERN' | 'SUGGESTION';
  /** 洞察描述 */
  description: string;
  /** 相关数据 */
  data: {
    suggestionType?: SuggestionType;
    scene?: SceneType;
    app?: string;
    rate?: number;
    count?: number;
  };
  /** 可操作建议 */
  actionable?: {
    action: 'INCREASE_WEIGHT' | 'DECREASE_WEIGHT' | 'DISABLE' | 'CUSTOMIZE';
    target: string;
  };
  /** 生成时间 */
  generatedAt: number;
}

/**
 * 个性化报告
 */
export interface PersonalizationReport {
  /** 报告生成时间 */
  generatedAt: number;
  /** 数据时间范围 */
  period: {
    start: number;
    end: number;
    days: number;
  };
  /** 总体统计 */
  overview: {
    totalSuggestions: number;
    totalFeedback: number;
    acceptRate: number;
    dismissRate: number;
    avgResponseTime: number;
  };
  /** 按类型统计 */
  byType: Record<SuggestionType, {
    total: number;
    acceptRate: number;
    currentWeight: number;
  }>;
  /** 按场景统计 */
  byScene: Partial<Record<SceneType, {
    total: number;
    acceptRate: number;
    topAccepted: string[];
    topDismissed: string[];
  }>>;
  /** 时间模式 */
  timePatterns: {
    peakAcceptHours: number[];
    peakDismissHours: number[];
    bestResponseDays: number[];
  };
  /** 洞察 */
  insights: FeedbackInsight[];
  /** 建议调整 */
  recommendedAdjustments: Array<{
    type: SuggestionType;
    scene: SceneType;
    currentWeight: number;
    recommendedWeight: number;
    reason: string;
  }>;
}

// ==================== 默认配置 ====================

const CONFIG = {
  /** 最大记录数量 */
  MAX_RECORDS: 1000,
  /** 权重调整速率 */
  WEIGHT_ADJUSTMENT_RATE: 0.1,
  /** 最小权重 */
  MIN_WEIGHT: 0.2,
  /** 最大权重 */
  MAX_WEIGHT: 2.0,
  /** 报告生成间隔（天） */
  REPORT_INTERVAL_DAYS: 7,
  /** 洞察生成最小样本数 */
  MIN_SAMPLES_FOR_INSIGHT: 5,
};

// ==================== 辅助函数 ====================

/**
 * 生成记录 ID
 */
function generateRecordId(): string {
  return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 计算接受率
 */
function calculateAcceptRate(records: FeedbackRecord[]): number {
  if (records.length === 0) return 0;
  const accepted = records.filter(r => r.feedback === 'ACCEPT' || r.feedback === 'MODIFY').length;
  return accepted / records.length;
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

/**
 * 获取建议类型标签
 */
function getSuggestionTypeLabel(type: SuggestionType): string {
  const labels: Record<SuggestionType, string> = {
    APP_LAUNCH: '应用启动',
    SYSTEM_SETTING: '系统设置',
    QUICK_ACTION: '快捷操作',
    REMINDER: '提醒',
    SCENE_ACTION: '场景操作',
    PREDICTION: '预测建议',
    AUTOMATION: '自动化规则',
  };
  return labels[type] || type;
}

// ==================== FeedbackProcessor 类 ====================

export class FeedbackProcessor {
  private records: FeedbackRecord[] = [];
  private weights: Map<string, SuggestionWeight> = new Map();
  private insights: FeedbackInsight[] = [];
  private lastReportTime: number = 0;
  private initialized: boolean = false;

  constructor() {}

  /**
   * 初始化处理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadData();
      this.initialized = true;
      console.log('[FeedbackProcessor] Initialized with', this.records.length, 'records');
    } catch (error) {
      console.error('[FeedbackProcessor] Failed to initialize:', error);
    }
  }

  /**
   * 加载数据
   */
  private async loadData(): Promise<void> {
    try {
      const [recordsStr, weightsStr, insightsStr] = await AsyncStorage.multiGet([
        STORAGE_KEYS.FEEDBACK_RECORDS,
        STORAGE_KEYS.SUGGESTION_WEIGHTS,
        STORAGE_KEYS.FEEDBACK_INSIGHTS,
      ]);

      if (recordsStr[1]) {
        this.records = JSON.parse(recordsStr[1]);
      }

      if (weightsStr[1]) {
        const weights: SuggestionWeight[] = JSON.parse(weightsStr[1]);
        this.weights = new Map(weights.map(w => [`${w.type}_${w.scene}`, w]));
      }

      if (insightsStr[1]) {
        this.insights = JSON.parse(insightsStr[1]);
      }
    } catch (error) {
      console.error('[FeedbackProcessor] Failed to load data:', error);
    }
  }

  /**
   * 保存数据
   */
  private async saveData(): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.FEEDBACK_RECORDS, JSON.stringify(this.records.slice(-CONFIG.MAX_RECORDS))],
        [STORAGE_KEYS.SUGGESTION_WEIGHTS, JSON.stringify(Array.from(this.weights.values()))],
        [STORAGE_KEYS.FEEDBACK_INSIGHTS, JSON.stringify(this.insights)],
      ]);
    } catch (error) {
      console.error('[FeedbackProcessor] Failed to save data:', error);
    }
  }

  // ==================== 反馈记录 ====================

  /**
   * 记录反馈
   */
  async recordFeedback(
    suggestion: SuggestionInfo,
    feedback: FeedbackType,
    options?: {
      responseTime?: number;
      modification?: string;
      comment?: string;
    }
  ): Promise<void> {
    await this.initialize();

    const now = new Date();
    const record: FeedbackRecord = {
      id: generateRecordId(),
      suggestion,
      feedback,
      timestamp: Date.now(),
      responseTime: options?.responseTime,
      modification: options?.modification,
      comment: options?.comment,
      context: {
        hour: now.getHours(),
        dayOfWeek: now.getDay() || 7,
        scene: suggestion.scene,
      },
    };

    this.records.push(record);

    // 限制记录数量
    if (this.records.length > CONFIG.MAX_RECORDS) {
      this.records = this.records.slice(-CONFIG.MAX_RECORDS);
    }

    // 更新权重
    this.updateWeight(suggestion, feedback);

    await this.saveData();
    console.log(`[FeedbackProcessor] Recorded feedback: ${feedback} for ${suggestion.type}`);
  }

  /**
   * 更新权重
   */
  private updateWeight(suggestion: SuggestionInfo, feedback: FeedbackType): void {
    const key = `${suggestion.type}_${suggestion.scene}`;
    let weight = this.weights.get(key);

    if (!weight) {
      weight = {
        type: suggestion.type,
        scene: suggestion.scene,
        weight: 1.0,
        sampleCount: 0,
        lastUpdated: Date.now(),
      };
    }

    // 根据反馈调整权重
    let adjustment = 0;
    switch (feedback) {
      case 'ACCEPT':
      case 'HELPFUL':
        adjustment = CONFIG.WEIGHT_ADJUSTMENT_RATE;
        break;
      case 'MODIFY':
        adjustment = CONFIG.WEIGHT_ADJUSTMENT_RATE * 0.5;
        break;
      case 'IGNORE':
        adjustment = -CONFIG.WEIGHT_ADJUSTMENT_RATE * 0.3;
        break;
      case 'DISMISS':
      case 'NOT_HELPFUL':
        adjustment = -CONFIG.WEIGHT_ADJUSTMENT_RATE;
        break;
      case 'UNDO':
        adjustment = -CONFIG.WEIGHT_ADJUSTMENT_RATE * 1.5;
        break;
    }

    // 应用调整
    weight.weight = Math.max(
      CONFIG.MIN_WEIGHT,
      Math.min(CONFIG.MAX_WEIGHT, weight.weight + adjustment)
    );
    weight.sampleCount++;
    weight.lastUpdated = Date.now();

    this.weights.set(key, weight);
  }

  /**
   * 获取建议权重
   */
  getWeight(type: SuggestionType, scene: SceneType): number {
    const key = `${type}_${scene}`;
    const weight = this.weights.get(key);
    return weight?.weight ?? 1.0;
  }

  /**
   * 获取所有权重
   */
  getAllWeights(): SuggestionWeight[] {
    return Array.from(this.weights.values());
  }

  // ==================== 洞察分析 ====================

  /**
   * 生成反馈洞察
   */
  async generateInsights(): Promise<FeedbackInsight[]> {
    await this.initialize();

    const insights: FeedbackInsight[] = [];
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentRecords = this.records.filter(r => r.timestamp >= weekAgo);

    if (recentRecords.length < CONFIG.MIN_SAMPLES_FOR_INSIGHT) {
      return insights;
    }

    // 1. 分析高接受率的建议类型
    const byType = this.groupByType(recentRecords);
    for (const [type, records] of byType) {
      const acceptRate = calculateAcceptRate(records);
      
      if (acceptRate >= 0.7 && records.length >= CONFIG.MIN_SAMPLES_FOR_INSIGHT) {
        insights.push({
          type: 'POSITIVE',
          description: `${getSuggestionTypeLabel(type)}建议表现优秀，接受率达 ${(acceptRate * 100).toFixed(0)}%`,
          data: {
            suggestionType: type,
            rate: acceptRate,
            count: records.length,
          },
          generatedAt: now,
        });
      }
      
      if (acceptRate <= 0.3 && records.length >= CONFIG.MIN_SAMPLES_FOR_INSIGHT) {
        insights.push({
          type: 'NEGATIVE',
          description: `${getSuggestionTypeLabel(type)}建议接受率较低（${(acceptRate * 100).toFixed(0)}%），考虑调整策略`,
          data: {
            suggestionType: type,
            rate: acceptRate,
            count: records.length,
          },
          actionable: {
            action: 'DECREASE_WEIGHT',
            target: type,
          },
          generatedAt: now,
        });
      }
    }

    // 2. 分析场景特定模式
    const byScene = this.groupByScene(recentRecords);
    for (const [scene, records] of byScene) {
      const acceptRate = calculateAcceptRate(records);
      
      if (records.length >= CONFIG.MIN_SAMPLES_FOR_INSIGHT) {
        if (acceptRate >= 0.6) {
          insights.push({
            type: 'PATTERN',
            description: `在${getSceneLabel(scene)}场景下，建议普遍受欢迎`,
            data: {
              scene,
              rate: acceptRate,
              count: records.length,
            },
            generatedAt: now,
          });
        }
      }
    }

    // 3. 分析时间模式
    const byHour = this.groupByHour(recentRecords);
    const peakAcceptHours: number[] = [];
    const peakDismissHours: number[] = [];

    for (const [hour, records] of byHour) {
      if (records.length >= 3) {
        const acceptRate = calculateAcceptRate(records);
        if (acceptRate >= 0.7) {
          peakAcceptHours.push(hour);
        }
        if (acceptRate <= 0.3) {
          peakDismissHours.push(hour);
        }
      }
    }

    if (peakAcceptHours.length > 0) {
      insights.push({
        type: 'PATTERN',
        description: `在 ${peakAcceptHours.join('、')} 点建议更容易被接受`,
        data: {
          rate: 0.7,
        },
        generatedAt: now,
      });
    }

    this.insights = insights;
    await this.saveData();

    return insights;
  }

  /**
   * 按类型分组
   */
  private groupByType(records: FeedbackRecord[]): Map<SuggestionType, FeedbackRecord[]> {
    const groups = new Map<SuggestionType, FeedbackRecord[]>();
    
    for (const record of records) {
      const type = record.suggestion.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(record);
    }
    
    return groups;
  }

  /**
   * 按场景分组
   */
  private groupByScene(records: FeedbackRecord[]): Map<SceneType, FeedbackRecord[]> {
    const groups = new Map<SceneType, FeedbackRecord[]>();
    
    for (const record of records) {
      const scene = record.context.scene;
      if (!groups.has(scene)) {
        groups.set(scene, []);
      }
      groups.get(scene)!.push(record);
    }
    
    return groups;
  }

  /**
   * 按小时分组
   */
  private groupByHour(records: FeedbackRecord[]): Map<number, FeedbackRecord[]> {
    const groups = new Map<number, FeedbackRecord[]>();
    
    for (const record of records) {
      const hour = record.context.hour;
      if (!groups.has(hour)) {
        groups.set(hour, []);
      }
      groups.get(hour)!.push(record);
    }
    
    return groups;
  }

  // ==================== 报告生成 ====================

  /**
   * 生成个性化报告
   */
  async generateReport(days: number = 7): Promise<PersonalizationReport> {
    await this.initialize();

    const now = Date.now();
    const start = now - days * 24 * 60 * 60 * 1000;
    const recentRecords = this.records.filter(r => r.timestamp >= start);

    // 生成洞察
    const insights = await this.generateInsights();

    // 总体统计
    const totalSuggestions = recentRecords.length;
    const acceptedRecords = recentRecords.filter(
      r => r.feedback === 'ACCEPT' || r.feedback === 'MODIFY'
    );
    const dismissedRecords = recentRecords.filter(
      r => r.feedback === 'DISMISS' || r.feedback === 'NOT_HELPFUL'
    );
    const avgResponseTime = recentRecords
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0) / 
      Math.max(recentRecords.filter(r => r.responseTime).length, 1);

    // 按类型统计
    const byType: PersonalizationReport['byType'] = {} as PersonalizationReport['byType'];
    const typeGroups = this.groupByType(recentRecords);
    
    const allTypes: SuggestionType[] = [
      'APP_LAUNCH', 'SYSTEM_SETTING', 'QUICK_ACTION', 
      'REMINDER', 'SCENE_ACTION', 'PREDICTION', 'AUTOMATION'
    ];
    
    for (const type of allTypes) {
      const typeRecords = typeGroups.get(type) || [];
      byType[type] = {
        total: typeRecords.length,
        acceptRate: calculateAcceptRate(typeRecords),
        currentWeight: this.getAverageWeightForType(type),
      };
    }

    // 按场景统计
    const byScene: PersonalizationReport['byScene'] = {};
    const sceneGroups = this.groupByScene(recentRecords);
    
    for (const [scene, sceneRecords] of sceneGroups) {
      const accepted = sceneRecords.filter(r => r.feedback === 'ACCEPT' || r.feedback === 'MODIFY');
      const dismissed = sceneRecords.filter(r => r.feedback === 'DISMISS');

      byScene[scene] = {
        total: sceneRecords.length,
        acceptRate: calculateAcceptRate(sceneRecords),
        topAccepted: this.getTopSuggestions(accepted, 3),
        topDismissed: this.getTopSuggestions(dismissed, 3),
      };
    }

    // 时间模式
    const hourGroups = this.groupByHour(recentRecords);
    const peakAcceptHours: number[] = [];
    const peakDismissHours: number[] = [];
    
    for (const [hour, hourRecords] of hourGroups) {
      const acceptRate = calculateAcceptRate(hourRecords);
      if (acceptRate >= 0.6) peakAcceptHours.push(hour);
      if (acceptRate <= 0.3) peakDismissHours.push(hour);
    }

    // 推荐调整
    const recommendedAdjustments: PersonalizationReport['recommendedAdjustments'] = [];
    
    for (const [key, weight] of this.weights) {
      const [type, scene] = key.split('_') as [SuggestionType, SceneType];
      const typeRecords = recentRecords.filter(
        r => r.suggestion.type === type && r.context.scene === scene
      );
      
      if (typeRecords.length >= CONFIG.MIN_SAMPLES_FOR_INSIGHT) {
        const acceptRate = calculateAcceptRate(typeRecords);
        let recommendedWeight = weight.weight;
        let reason = '';

        if (acceptRate >= 0.8 && weight.weight < 1.5) {
          recommendedWeight = Math.min(weight.weight + 0.3, CONFIG.MAX_WEIGHT);
          reason = '高接受率，建议增加权重';
        } else if (acceptRate <= 0.2 && weight.weight > 0.5) {
          recommendedWeight = Math.max(weight.weight - 0.3, CONFIG.MIN_WEIGHT);
          reason = '低接受率，建议降低权重';
        }

        if (recommendedWeight !== weight.weight) {
          recommendedAdjustments.push({
            type,
            scene,
            currentWeight: weight.weight,
            recommendedWeight,
            reason,
          });
        }
      }
    }

    const report: PersonalizationReport = {
      generatedAt: now,
      period: {
        start,
        end: now,
        days,
      },
      overview: {
        totalSuggestions,
        totalFeedback: recentRecords.length,
        acceptRate: totalSuggestions > 0 ? acceptedRecords.length / totalSuggestions : 0,
        dismissRate: totalSuggestions > 0 ? dismissedRecords.length / totalSuggestions : 0,
        avgResponseTime,
      },
      byType,
      byScene,
      timePatterns: {
        peakAcceptHours,
        peakDismissHours,
        bestResponseDays: [], // 需要更多数据计算
      },
      insights,
      recommendedAdjustments,
    };

    // 保存报告
    await AsyncStorage.setItem(STORAGE_KEYS.PERSONALIZATION_REPORT, JSON.stringify(report));
    this.lastReportTime = now;

    return report;
  }

  /**
   * 获取类型平均权重
   */
  private getAverageWeightForType(type: SuggestionType): number {
    const typeWeights = Array.from(this.weights.values()).filter(w => w.type === type);
    if (typeWeights.length === 0) return 1.0;
    return typeWeights.reduce((sum, w) => sum + w.weight, 0) / typeWeights.length;
  }

  /**
   * 获取热门建议
   */
  private getTopSuggestions(records: FeedbackRecord[], limit: number): string[] {
    const counts = new Map<string, number>();
    
    for (const record of records) {
      const key = record.suggestion.title;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([title]) => title);
  }

  /**
   * 获取上次报告
   */
  async getLastReport(): Promise<PersonalizationReport | null> {
    try {
      const reportStr = await AsyncStorage.getItem(STORAGE_KEYS.PERSONALIZATION_REPORT);
      if (reportStr) {
        return JSON.parse(reportStr);
      }
    } catch (error) {
      console.error('[FeedbackProcessor] Failed to get last report:', error);
    }
    return null;
  }

  // ==================== 工具方法 ====================

  /**
   * 应用推荐的权重调整
   */
  async applyRecommendedAdjustments(
    adjustments: PersonalizationReport['recommendedAdjustments']
  ): Promise<void> {
    for (const adjustment of adjustments) {
      const key = `${adjustment.type}_${adjustment.scene}`;
      const weight = this.weights.get(key);
      
      if (weight) {
        weight.weight = adjustment.recommendedWeight;
        weight.lastUpdated = Date.now();
        this.weights.set(key, weight);
      }
    }

    await this.saveData();
    console.log(`[FeedbackProcessor] Applied ${adjustments.length} weight adjustments`);
  }

  /**
   * 重置权重
   */
  async resetWeights(): Promise<void> {
    this.weights.clear();
    await this.saveData();
    console.log('[FeedbackProcessor] All weights reset');
  }

  /**
   * 获取反馈统计
   */
  getStats(): {
    totalRecords: number;
    totalWeights: number;
    overallAcceptRate: number;
    lastReportTime: number;
  } {
    return {
      totalRecords: this.records.length,
      totalWeights: this.weights.size,
      overallAcceptRate: calculateAcceptRate(this.records),
      lastReportTime: this.lastReportTime,
    };
  }

  /**
   * 获取反馈历史
   */
  getFeedbackHistory(limit: number = 50): FeedbackRecord[] {
    return this.records.slice(-limit).reverse();
  }

  /**
   * 获取个性化报告（同步版本，用于UI）
   */
  getPersonalizationReport(): PersonalizationReport {
    const recentRecords = this.records.slice(-CONFIG.MAX_RECORDS);
    const acceptCount = recentRecords.filter(r => r.feedback === 'ACCEPT').length;
    const dismissCount = recentRecords.filter(r => r.feedback === 'DISMISS').length;
    
    // 按场景统计
    const sceneStats = new Map<SceneType, { accept: number; total: number }>();
    for (const record of recentRecords) {
      const scene = record.suggestion.scene;
      if (!sceneStats.has(scene)) {
        sceneStats.set(scene, { accept: 0, total: 0 });
      }
      const stats = sceneStats.get(scene)!;
      stats.total++;
      if (record.feedback === 'ACCEPT') {
        stats.accept++;
      }
    }

    // 计算平均响应时间
    const responseTimes = recentRecords
      .filter(r => r.responseTime !== undefined)
      .map(r => r.responseTime!);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // 构建 byScene
    const byScene: PersonalizationReport['byScene'] = {};
    for (const [scene, stats] of sceneStats.entries()) {
      byScene[scene] = {
        total: stats.total,
        acceptRate: stats.total > 0 ? stats.accept / stats.total : 0,
        topAccepted: [],
        topDismissed: [],
      };
    }

    return {
      generatedAt: Date.now(),
      period: { 
        start: Date.now() - 7 * 24 * 60 * 60 * 1000, 
        end: Date.now(),
        days: 7,
      },
      overview: {
        totalSuggestions: recentRecords.length,
        totalFeedback: recentRecords.length,
        acceptRate: recentRecords.length > 0 ? acceptCount / recentRecords.length : 0,
        dismissRate: recentRecords.length > 0 ? dismissCount / recentRecords.length : 0,
        avgResponseTime,
      },
      byType: {} as PersonalizationReport['byType'],
      byScene,
      timePatterns: {
        peakAcceptHours: [],
        peakDismissHours: [],
        bestResponseDays: [],
      },
      insights: this.insights,
      recommendedAdjustments: [],
    };
  }

  /**
   * 获取洞察列表
   */
  getInsights(): FeedbackInsight[] {
    return this.insights.slice().reverse();
  }

  /**
   * 清除所有数据
   */
  async clearAll(): Promise<void> {
    this.records = [];
    this.weights.clear();
    this.insights = [];
    this.lastReportTime = 0;

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.FEEDBACK_RECORDS,
      STORAGE_KEYS.SUGGESTION_WEIGHTS,
      STORAGE_KEYS.FEEDBACK_INSIGHTS,
      STORAGE_KEYS.PERSONALIZATION_REPORT,
    ]);

    console.log('[FeedbackProcessor] All data cleared');
  }
}

// 导出单例
export const feedbackProcessor = new FeedbackProcessor();
export default feedbackProcessor;
