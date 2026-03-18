/**
 * UnifiedSceneAnalyzer - 统一场景分析器
 *
 * 整合静默上下文检测和用户触发检测，将 ML 模型预测结果
 * 映射到统一的 SceneType，并结合动态建议服务生成智能建议
 * 
 * v2.0: 集成 SmartSuggestionEngine 支持增强的规则系统
 */

import type {
  SceneType,
  SilentContext,
  ContextSignal,
  TriggeredContext,
  Prediction,
} from '../types';
import { silentContextEngine } from '../sensors';
import { dynamicSuggestionService, TimeOfDay } from '../services/DynamicSuggestionService';
import { feedbackLogger } from '../reflection/FeedbackLogger';
import { weightAdjuster } from '../reflection/WeightAdjuster';
import { smartSuggestionEngine, SmartSuggestion } from '../services/suggestion';

/**
 * ML 预测标签到 SceneType 的映射配置
 */
const IMAGE_LABEL_TO_SCENE: Record<string, SceneType[]> = {
  // 图像分类标签
  'indoor_office': ['OFFICE'],
  'indoor_home': ['HOME', 'SLEEP'],
  'outdoor_street': ['COMMUTE', 'TRAVEL'],
  'outdoor_park': ['HOME', 'STUDY'], // 公园可能是休闲或户外学习
  'transport_subway': ['COMMUTE'],
  'transport_bus': ['COMMUTE'],
  'transport_car': ['COMMUTE', 'TRAVEL'],
  'restaurant': ['HOME'], // 餐厅通常对应休闲时间
  'gym': ['STUDY'], // 健身房对应专注状态
  'library': ['STUDY'],
};

const AUDIO_LABEL_TO_SCENE: Record<string, SceneType[]> = {
  // 音频分类标签
  'silence': ['SLEEP', 'STUDY', 'HOME'],
  'speech': ['OFFICE', 'HOME'],
  'music': ['COMMUTE', 'HOME', 'STUDY'],
  'traffic': ['COMMUTE', 'TRAVEL'],
  'nature': ['HOME', 'TRAVEL'],
  'machinery': ['OFFICE', 'COMMUTE'],
  'crowd': ['COMMUTE', 'TRAVEL'],
  'indoor_quiet': ['HOME', 'STUDY', 'OFFICE'],
  'outdoor_busy': ['COMMUTE', 'TRAVEL'],
};

/**
 * 场景匹配结果
 */
interface SceneMatchResult {
  sceneType: SceneType;
  confidence: number;
  sources: Array<{
    type: 'silent' | 'image' | 'audio' | 'time' | 'location';
    label: string;
    score: number;
  }>;
}

/**
 * 统一分析结果
 */
export interface UnifiedAnalysisResult {
  /** 最终确定的场景类型 */
  sceneType: SceneType;
  /** 综合置信度 (0-1) */
  confidence: number;
  /** 静默上下文（如果可用） */
  silentContext: SilentContext | null;
  /** ML 预测结果（如果可用） */
  mlPredictions: Prediction[] | null;
  /** 融合后的场景匹配详情 */
  matchDetails: SceneMatchResult[];
  /** 时间上下文 */
  timeContext: {
    timeOfDay: TimeOfDay;
    hour: number;
    isWeekend: boolean;
  };
  /** 个性化建议文本 (旧版兼容) */
  personalizedNotes: string[];
  /** 智能建议 (新版增强) */
  smartSuggestion: SmartSuggestion | null;
  /** 分析时间戳 */
  timestamp: number;
}

/**
 * 统一场景分析器类
 */
class UnifiedSceneAnalyzerClass {
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private smartEngineEnabled = true; // 是否使用新版智能建议引擎

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.performInitialize();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async performInitialize(): Promise<void> {
    await dynamicSuggestionService.initialize();

    try {
      await smartSuggestionEngine.initialize();
      this.smartEngineEnabled = true;
      console.log('[UnifiedSceneAnalyzer] SmartSuggestionEngine initialized');
    } catch (error) {
      console.warn('[UnifiedSceneAnalyzer] SmartSuggestionEngine init failed, fallback to legacy flow:', error);
      this.smartEngineEnabled = false;
    }

    this.initialized = true;
    console.log('[UnifiedSceneAnalyzer] Initialized');
  }

  /**
   * 执行统一场景分析
   * 
   * @param triggeredPredictions 用户触发分析的 ML 预测结果（可选）
   * @returns 统一分析结果
   */
  async analyze(triggeredPredictions?: Prediction[]): Promise<UnifiedAnalysisResult> {
    await this.initialize();

    const timestamp = Date.now();
    const matchDetails: SceneMatchResult[] = [];

    // 1. 获取静默上下文（始终获取，作为基础）
    let silentContext: SilentContext | null = null;
    try {
      silentContext = await silentContextEngine.getContext();
      console.log('[UnifiedSceneAnalyzer] 静默上下文:', silentContext.context, '置信度:', silentContext.confidence);
    } catch (error) {
      console.warn('[UnifiedSceneAnalyzer] 获取静默上下文失败:', error);
    }

    // 2. 处理 ML 预测结果（如果有）
    let mlSceneScores: Map<SceneType, number> = new Map();
    if (triggeredPredictions && triggeredPredictions.length > 0) {
      mlSceneScores = this.mapPredictionsToScenes(triggeredPredictions);
      console.log('[UnifiedSceneAnalyzer] ML 预测映射结果:', Object.fromEntries(mlSceneScores));
    }

    // 3. 获取时间上下文
    const timeContext = this.getTimeContext();

    // 4. 融合多源信号
    const fusedScores = this.fuseSignals(silentContext, mlSceneScores, timeContext);

    // 5. 确定最终场景
    let finalScene: SceneType = 'UNKNOWN';
    let finalConfidence = 0;

    for (const [scene, score] of fusedScores.entries()) {
      // 应用用户反馈权重
      const weight = weightAdjuster.getWeight(scene);
      const adjustedScore = score * weight;

      matchDetails.push({
        sceneType: scene,
        confidence: adjustedScore,
        sources: this.getSourcesForScene(scene, silentContext, triggeredPredictions),
      });

      if (adjustedScore > finalConfidence) {
        finalConfidence = adjustedScore;
        finalScene = scene;
      }
    }

    // 按置信度排序
    matchDetails.sort((a, b) => b.confidence - a.confidence);

    // 6. 生成个性化建议
    const personalizedNotes = this.generatePersonalizedNotes(finalScene, timeContext, finalConfidence);

    // 7. 使用智能建议引擎生成增强建议
    let smartSuggestion: SmartSuggestion | null = null;
    if (this.smartEngineEnabled) {
      try {
        smartSuggestion = await smartSuggestionEngine.generate(
          finalScene,
          finalConfidence,
          silentContext,
          triggeredPredictions || null
        );
        console.log('[UnifiedSceneAnalyzer] 智能建议生成成功:', smartSuggestion.subSceneId);
      } catch (error) {
        console.warn('[UnifiedSceneAnalyzer] 智能建议生成失败:', error);
      }
    }

    console.log('[UnifiedSceneAnalyzer] 最终场景:', finalScene, '置信度:', finalConfidence.toFixed(2));

    return {
      sceneType: finalScene,
      confidence: finalConfidence,
      silentContext,
      mlPredictions: triggeredPredictions || null,
      matchDetails,
      timeContext,
      personalizedNotes,
      smartSuggestion,
      timestamp,
    };
  }

  /**
   * 将 ML 预测结果映射到场景类型
   */
  private mapPredictionsToScenes(predictions: Prediction[]): Map<SceneType, number> {
    const sceneScores: Map<SceneType, number> = new Map();

    for (const pred of predictions) {
      // 移除 "image:" 或 "audio:" 前缀
      const [sourceType, rawLabel] = pred.label.includes(':') 
        ? pred.label.split(':') 
        : ['unknown', pred.label];

      const labelMap = sourceType === 'image' ? IMAGE_LABEL_TO_SCENE : AUDIO_LABEL_TO_SCENE;
      const mappedScenes = labelMap[rawLabel] || [];

      for (const scene of mappedScenes) {
        const currentScore = sceneScores.get(scene) || 0;
        // 使用加权累加，多个来源指向同一场景会增加置信度
        sceneScores.set(scene, currentScore + pred.score * 0.5);
      }
    }

    return sceneScores;
  }

  /**
   * 融合多源信号
   */
  private fuseSignals(
    silentContext: SilentContext | null,
    mlSceneScores: Map<SceneType, number>,
    timeContext: { timeOfDay: TimeOfDay; hour: number; isWeekend: boolean }
  ): Map<SceneType, number> {
    const fusedScores: Map<SceneType, number> = new Map();

    // 权重配置
    const SILENT_WEIGHT = 0.5;  // 静默上下文权重
    const ML_WEIGHT = 0.35;     // ML 预测权重
    const TIME_WEIGHT = 0.15;   // 时间上下文权重

    // 1. 静默上下文贡献
    if (silentContext) {
      const currentScore = fusedScores.get(silentContext.context) || 0;
      fusedScores.set(silentContext.context, currentScore + silentContext.confidence * SILENT_WEIGHT);
    }

    // 2. ML 预测贡献
    for (const [scene, score] of mlSceneScores.entries()) {
      const currentScore = fusedScores.get(scene) || 0;
      fusedScores.set(scene, currentScore + score * ML_WEIGHT);
    }

    // 3. 时间上下文贡献
    const timeBasedScenes = this.getTimeBasedSceneBoosts(timeContext);
    for (const [scene, boost] of timeBasedScenes.entries()) {
      const currentScore = fusedScores.get(scene) || 0;
      fusedScores.set(scene, currentScore + boost * TIME_WEIGHT);
    }

    // 归一化
    const maxScore = Math.max(...fusedScores.values(), 0.01);
    for (const [scene, score] of fusedScores.entries()) {
      fusedScores.set(scene, Math.min(score / maxScore, 1));
    }

    return fusedScores;
  }

  /**
   * 根据时间获取场景加权
   */
  private getTimeBasedSceneBoosts(
    timeContext: { timeOfDay: TimeOfDay; hour: number; isWeekend: boolean }
  ): Map<SceneType, number> {
    const boosts: Map<SceneType, number> = new Map();
    const { timeOfDay, isWeekend } = timeContext;

    // 工作日通勤时间
    if (!isWeekend && (timeOfDay === 'morning')) {
      // 早上 7-9 点
      if (timeContext.hour >= 7 && timeContext.hour < 9) {
        boosts.set('COMMUTE', 0.9);
      }
    }

    // 晚高峰
    if (!isWeekend && timeOfDay === 'afternoon') {
      if (timeContext.hour >= 17 && timeContext.hour < 19) {
        boosts.set('COMMUTE', 0.8);
      }
    }

    // 工作时间
    if (!isWeekend && (timeOfDay === 'morning' || timeOfDay === 'afternoon')) {
      if (timeContext.hour >= 9 && timeContext.hour < 18) {
        boosts.set('OFFICE', 0.7);
      }
    }

    // 晚上学习时间
    if (timeOfDay === 'evening') {
      boosts.set('STUDY', 0.6);
      boosts.set('HOME', 0.5);
    }

    // 深夜睡眠时间
    if (timeOfDay === 'night') {
      boosts.set('SLEEP', 0.9);
      boosts.set('HOME', 0.4);
    }

    // 周末在家
    if (isWeekend) {
      boosts.set('HOME', (boosts.get('HOME') || 0) + 0.3);
    }

    return boosts;
  }

  /**
   * 获取场景的信号来源
   */
  private getSourcesForScene(
    scene: SceneType,
    silentContext: SilentContext | null,
    mlPredictions?: Prediction[]
  ): SceneMatchResult['sources'] {
    const sources: SceneMatchResult['sources'] = [];

    // 静默上下文来源
    if (silentContext && silentContext.context === scene) {
      sources.push({
        type: 'silent',
        label: `静默检测: ${scene}`,
        score: silentContext.confidence,
      });

      // 添加具体信号
      for (const signal of silentContext.signals) {
        sources.push({
          type: signal.type === 'TIME' ? 'time' : 
                signal.type === 'LOCATION' ? 'location' : 'silent',
          label: `${signal.type}: ${signal.value}`,
          score: signal.weight,
        });
      }
    }

    // ML 预测来源
    if (mlPredictions) {
      for (const pred of mlPredictions) {
        const [sourceType, rawLabel] = pred.label.includes(':') 
          ? pred.label.split(':') 
          : ['unknown', pred.label];

        const labelMap = sourceType === 'image' ? IMAGE_LABEL_TO_SCENE : AUDIO_LABEL_TO_SCENE;
        const mappedScenes = labelMap[rawLabel] || [];

        if (mappedScenes.includes(scene)) {
          sources.push({
            type: sourceType === 'image' ? 'image' : 'audio',
            label: `${sourceType}: ${rawLabel}`,
            score: pred.score,
          });
        }
      }
    }

    return sources;
  }

  /**
   * 获取时间上下文
   */
  private getTimeContext(): { timeOfDay: TimeOfDay; hour: number; isWeekend: boolean } {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    return {
      timeOfDay: dynamicSuggestionService.getTimeOfDay(now),
      hour,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
  }

  /**
   * 生成个性化建议文本
   */
  private generatePersonalizedNotes(
    scene: SceneType,
    timeContext: { timeOfDay: TimeOfDay; hour: number; isWeekend: boolean },
    confidence: number
  ): string[] {
    const notes: string[] = [];

    // 添加问候语
    notes.push(dynamicSuggestionService.getGreeting(scene));

    // 添加场景说明
    const sceneName = this.getSceneDisplayName(scene);
    if (confidence > 0.7) {
      notes.push(`✨ 检测到您处于${sceneName}状态`);
    } else if (confidence > 0.4) {
      notes.push(`📍 可能处于${sceneName}状态`);
    } else {
      notes.push(`💡 正在尝试识别您的场景...`);
    }

    // 添加时间相关提示
    notes.push(dynamicSuggestionService.getTip(scene));

    return notes;
  }

  /**
   * 获取场景显示名称
   */
  private getSceneDisplayName(scene: SceneType): string {
    const names: Record<SceneType, string> = {
      COMMUTE: '通勤',
      OFFICE: '办公',
      HOME: '居家',
      STUDY: '学习',
      SLEEP: '休息',
      TRAVEL: '出行',
      UNKNOWN: '未知',
    };
    return names[scene] || '未知';
  }

  /**
   * 将触发分析结果转换为 SilentContext 格式（兼容现有代码）
   */
  convertToSilentContext(result: UnifiedAnalysisResult): SilentContext {
    const signals: ContextSignal[] = [];

    // 从 matchDetails 提取信号
    if (result.matchDetails.length > 0) {
      for (const source of result.matchDetails[0].sources) {
        signals.push({
          type: source.type === 'time' ? 'TIME' : 
                source.type === 'location' ? 'LOCATION' : 
                source.type === 'image' ? 'FOREGROUND_APP' : 'MOTION',
          value: source.label,
          weight: source.score,
          timestamp: result.timestamp,
        });
      }
    }

    return {
      timestamp: result.timestamp,
      context: result.sceneType,
      confidence: result.confidence,
      signals,
    };
  }

  /**
   * 记录用户反馈
   */
  async recordFeedback(
    result: UnifiedAnalysisResult,
    action: 'accept' | 'ignore' | 'cancel'
  ): Promise<void> {
    await dynamicSuggestionService.initialize();

    // 直接使用 action，因为 UserFeedback 类型就是 'accept' | 'ignore' | 'cancel'
    await feedbackLogger.logFeedback(
      result.sceneType,
      action,
      result.confidence,
      result.matchDetails[0]?.sources.map(s => s.label) || [],
      action === 'accept' ? ['scene_executed'] : undefined
    );

    // 触发权重调整检查
    const recommendations = weightAdjuster.getAdjustmentRecommendations();
    for (const rec of recommendations) {
      if (rec.autoApply) {
        await weightAdjuster.applyRecommendation(rec);
        console.log(`[UnifiedSceneAnalyzer] 自动应用权重调整: ${rec.sceneType} -> ${rec.suggestedWeight.toFixed(2)}`);
      }
    }
  }
}

export const unifiedSceneAnalyzer = new UnifiedSceneAnalyzerClass();
export default unifiedSceneAnalyzer;
