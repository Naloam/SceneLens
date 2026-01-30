/**
 * SmartSuggestionEngine - 智能建议引擎
 * 
 * 核心引擎，整合所有组件生成智能建议
 */

import type { SceneType, Prediction, SilentContext, AppCategory } from '../../types';
import type {
  AggregatedContext,
  SmartSuggestion,
  SmartAction,
  ConfidenceLevel,
  SubSceneDefinition,
  SceneTemplateConfig,
} from './types';
import { contextAggregator } from './ContextAggregator';
import { textGenerator } from './TextGenerator';
import { actionReasonGenerator, ActionType } from './ActionReasonGenerator';
import { personalizationManager } from './PersonalizationManager';

// 导入场景模板 (使用类型断言避免严格类型检查)
/* eslint-disable @typescript-eslint/no-var-requires */
const commuteTemplates = require('../../config/suggestion-templates/commute.templates.json');
const homeTemplates = require('../../config/suggestion-templates/home.templates.json');
const officeTemplates = require('../../config/suggestion-templates/office.templates.json');
const studyTemplates = require('../../config/suggestion-templates/study.templates.json');
const sleepTemplates = require('../../config/suggestion-templates/sleep.templates.json');
const travelTemplates = require('../../config/suggestion-templates/travel.templates.json');
/* eslint-enable @typescript-eslint/no-var-requires */

/**
 * 场景模板映射 (类型宽松处理 JSON 导入)
 */
const SCENE_TEMPLATES: Record<SceneType, SceneTemplateConfig> = {
  COMMUTE: commuteTemplates as unknown as SceneTemplateConfig,
  HOME: homeTemplates as unknown as SceneTemplateConfig,
  OFFICE: officeTemplates as unknown as SceneTemplateConfig,
  STUDY: studyTemplates as unknown as SceneTemplateConfig,
  SLEEP: sleepTemplates as unknown as SceneTemplateConfig,
  TRAVEL: travelTemplates as unknown as SceneTemplateConfig,
  UNKNOWN: {
    scene: 'UNKNOWN',
    subScenes: [{
      id: 'UNKNOWN_DEFAULT',
      conditions: [],
      headlines: ['您好，有什么可以帮您的？', '准备就绪', '随时为您服务'],
      subtexts: ['场景识别中...', '正在分析环境'],
      actionReasons: {},
      weight: 1.0,
    }],
    slotFillers: {},
  },
};

/**
 * 场景默认动作配置
 * action: 实际执行的系统操作名称 (对应 SceneBridge/SceneSuggestionManager 的方法)
 */
const SCENE_DEFAULT_ACTIONS: Record<SceneType, Array<{
  id: string;
  label: string;
  type: 'system' | 'app';
  actionType: ActionType | AppCategory;
  action?: string;  // 系统动作的实际方法名
  priority: number;
  params?: Record<string, any>;
}>> = {
  COMMUTE: [
    { id: 'transit', label: '打开乘车码', type: 'app', actionType: 'TRANSIT_APP', priority: 100 },
    { id: 'music', label: '播放音乐', type: 'app', actionType: 'MUSIC_PLAYER', priority: 80 },
    { id: 'dnd', label: '开启勿扰', type: 'system', actionType: 'DND', action: 'setDoNotDisturb', priority: 60, params: { enable: true } },
  ],
  HOME: [
    { id: 'dnd_off', label: '关闭勿扰', type: 'system', actionType: 'DND', action: 'setDoNotDisturb', priority: 80, params: { enable: false } },
    { id: 'smart_home', label: '智能家居', type: 'app', actionType: 'SMART_HOME', priority: 90 },
    { id: 'music', label: '播放音乐', type: 'app', actionType: 'MUSIC_PLAYER', priority: 70 },
  ],
  OFFICE: [
    { id: 'dnd', label: '开启勿扰', type: 'system', actionType: 'DND', action: 'setDoNotDisturb', priority: 80, params: { enable: true } },
    { id: 'calendar', label: '查看日程', type: 'app', actionType: 'CALENDAR', priority: 90 },
    { id: 'meeting', label: '会议应用', type: 'app', actionType: 'MEETING_APP', priority: 100 },
  ],
  STUDY: [
    { id: 'dnd', label: '开启勿扰', type: 'system', actionType: 'DND', action: 'setDoNotDisturb', priority: 100, params: { enable: true } },
    { id: 'study_app', label: '学习应用', type: 'app', actionType: 'STUDY_APP', priority: 90 },
    { id: 'volume', label: '静音', type: 'system', actionType: 'VOLUME', action: 'setVolume', priority: 80, params: { level: 0 } },
  ],
  SLEEP: [
    { id: 'dnd', label: '开启睡眠勿扰', type: 'system', actionType: 'DND', action: 'setDoNotDisturb', priority: 100, params: { enable: true, allowAlarms: true } },
    { id: 'brightness', label: '降低亮度', type: 'system', actionType: 'BRIGHTNESS', action: 'setBrightness', priority: 90, params: { level: 0.1 } },
  ],
  TRAVEL: [
    { id: 'transit', label: '交通信息', type: 'app', actionType: 'TRANSIT_APP', priority: 100 },
    { id: 'dnd', label: '开启勿扰', type: 'system', actionType: 'DND', action: 'setDoNotDisturb', priority: 70, params: { enable: true } },
    { id: 'brightness', label: '调整亮度', type: 'system', actionType: 'BRIGHTNESS', action: 'setBrightness', priority: 60, params: { level: 0.7 } },
  ],
  UNKNOWN: [
    { id: 'generic', label: '快捷操作', type: 'system', actionType: 'GENERIC', priority: 50 },
  ],
};

/**
 * 智能建议引擎类
 */
export class SmartSuggestionEngine {
  private initialized = false;

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await personalizationManager.initialize();

    this.initialized = true;
    console.log('[SmartSuggestionEngine] 初始化完成');
  }

  /**
   * 生成智能建议
   */
  async generate(
    sceneType: SceneType,
    confidence: number,
    silentContext: SilentContext | null,
    mlPredictions: Prediction[] | null
  ): Promise<SmartSuggestion> {
    await this.initialize();

    // 1. 聚合上下文
    const ctx = await contextAggregator.aggregate(
      sceneType,
      confidence,
      silentContext,
      mlPredictions
    );

    // 2. 获取个性化因子
    const factors = await personalizationManager.getPersonalizationFactors(ctx);

    // 3. 选择匹配的子场景
    const template = SCENE_TEMPLATES[sceneType];
    const subScene = this.selectSubScene(template.subScenes, ctx);

    // 4. 生成主标题
    const headline = this.generateHeadline(subScene, ctx, factors);

    // 5. 生成副标题
    const subtext = this.generateSubtext(subScene, ctx, factors);

    // 6. 生成上下文说明
    const contextNotes = personalizationManager.generateContextNotes(ctx, factors);

    // 7. 生成动作列表
    const actions = this.generateActions(sceneType, subScene, ctx, factors);

    // 8. 计算上下文哈希
    const contextHash = contextAggregator.computeContextHash(ctx);

    // 9. 确定置信度级别
    const confidenceLevel = this.determineConfidenceLevel(confidence);

    return {
      headline,
      subtext,
      contextNotes,
      actions,
      generatedAt: Date.now(),
      contextHash,
      confidenceLevel,
      sceneType,
      subSceneId: subScene.id,
    };
  }

  /**
   * 选择匹配的子场景
   */
  private selectSubScene(
    subScenes: SubSceneDefinition[],
    ctx: AggregatedContext
  ): SubSceneDefinition {
    // 评估每个子场景的匹配度
    const scored = subScenes.map(subScene => {
      let score = subScene.weight;

      // 评估条件匹配
      for (const condition of subScene.conditions) {
        if (this.evaluateCondition(condition, ctx)) {
          score += 1;
        }
      }

      return { subScene, score };
    });

    // 按分数排序
    scored.sort((a, b) => b.score - a.score);

    // 在得分最高的子场景中随机选择（增加多样性）
    const topScore = scored[0]?.score || 0;
    const topCandidates = scored.filter(s => s.score >= topScore - 0.5);
    
    if (topCandidates.length === 0) {
      return subScenes[0] || this.getDefaultSubScene();
    }

    const randomIndex = Math.floor(Math.random() * topCandidates.length);
    return topCandidates[randomIndex].subScene;
  }

  /**
   * 获取默认子场景
   */
  private getDefaultSubScene(): SubSceneDefinition {
    return {
      id: 'DEFAULT',
      conditions: [],
      headlines: ['准备就绪', '有什么可以帮您的？'],
      subtexts: ['正在分析场景...'],
      actionReasons: {},
      weight: 0.5,
    };
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(condition: string, ctx: AggregatedContext): boolean {
    try {
      // 简单的条件解析器
      // 支持: time.hour >= 7, image.topLabel === 'subway', !time.isWeekend
      
      // 替换上下文变量
      const expression = condition
        .replace(/time\.hour/g, ctx.time.hour.toString())
        .replace(/time\.minute/g, ctx.time.minute.toString())
        .replace(/time\.dayOfWeek/g, ctx.time.dayOfWeek.toString())
        .replace(/time\.isWeekend/g, ctx.time.isWeekend.toString())
        .replace(/time\.timeOfDay/g, `'${ctx.time.timeOfDay}'`)
        .replace(/image\.topLabel/g, `'${ctx.image.topLabel}'`)
        .replace(/image\.topScore/g, ctx.image.topScore.toString())
        .replace(/image\.environmentType/g, `'${ctx.image.environmentType}'`)
        .replace(/audio\.topLabel/g, `'${ctx.audio.topLabel}'`)
        .replace(/audio\.soundEnvironment/g, `'${ctx.audio.soundEnvironment}'`)
        .replace(/location\.matchedFence/g, ctx.location.matchedFence ? `'${ctx.location.matchedFence}'` : 'null')
        .replace(/location\.isMoving/g, ctx.location.isMoving.toString())
        .replace(/location\.transportMode/g, `'${ctx.location.transportMode}'`)
        .replace(/device\.batteryLevel/g, ctx.device.batteryLevel.toString())
        .replace(/device\.isCharging/g, ctx.device.isCharging.toString())
        .replace(/calendar\.isInMeeting/g, ctx.calendar.isInMeeting.toString())
        .replace(/calendar\.upcomingEvent/g, ctx.calendar.upcomingEvent ? 'true' : 'null')
        .replace(/user\.consecutiveSceneCount/g, ctx.user.consecutiveSceneCount.toString())
        .replace(/scene\.confidence/g, ctx.scene.confidence.toString());

      // 安全地评估表达式
      // 注意：这是简化实现，生产环境应使用更安全的表达式解析器
      // eslint-disable-next-line no-new-func
      return Function(`"use strict"; return (${expression});`)();
    } catch {
      return false;
    }
  }

  /**
   * 生成主标题
   */
  private generateHeadline(
    subScene: SubSceneDefinition,
    ctx: AggregatedContext,
    factors: ReturnType<typeof personalizationManager.getPersonalizationFactors> extends Promise<infer T> ? T : never
  ): string {
    const headline = textGenerator.fillAndSelectRandom(subScene.headlines, ctx);
    return personalizationManager.adjustTextStyle(headline, factors);
  }

  /**
   * 生成副标题
   */
  private generateSubtext(
    subScene: SubSceneDefinition,
    ctx: AggregatedContext,
    factors: ReturnType<typeof personalizationManager.getPersonalizationFactors> extends Promise<infer T> ? T : never
  ): string {
    const subtext = textGenerator.fillAndSelectRandom(subScene.subtexts, ctx);
    return personalizationManager.adjustTextStyle(subtext, factors);
  }

  /**
   * 生成动作列表
   */
  private generateActions(
    sceneType: SceneType,
    subScene: SubSceneDefinition,
    ctx: AggregatedContext,
    factors: ReturnType<typeof personalizationManager.getPersonalizationFactors> extends Promise<infer T> ? T : never
  ): SmartAction[] {
    const defaultActions = SCENE_DEFAULT_ACTIONS[sceneType] || [];
    const actions: SmartAction[] = [];

    for (const actionConfig of defaultActions) {
      // 获取理由模板
      const reasonTemplates = subScene.actionReasons[actionConfig.actionType] || [];
      
      // 生成理由
      let reason: string;
      if (reasonTemplates.length > 0) {
        reason = actionReasonGenerator.selectRandomReason(reasonTemplates, ctx);
      } else {
        reason = actionReasonGenerator.generateReason(
          actionConfig.actionType,
          ctx,
          undefined,
          actionConfig.params
        );
      }

      actions.push({
        id: actionConfig.id,
        label: actionConfig.label,
        reason,
        type: actionConfig.type,
        action: actionConfig.action,  // 传递实际的执行操作名称
        priority: actionConfig.priority,
        executable: !!actionConfig.action || actionConfig.type === 'app',  // 有 action 或是 app 类型才可执行
        params: actionConfig.params || {},
        group: actionConfig.priority >= 90 ? 'primary' : 'optional',
        appCategory: actionConfig.type === 'app' ? actionConfig.actionType as AppCategory : undefined,
      });
    }

    // 应用个性化过滤和排序
    return personalizationManager.filterAndSortActions(actions, factors, sceneType);
  }

  /**
   * 确定置信度级别
   */
  private determineConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * 快速生成建议（用于预览或低延迟场景）
   */
  async generateQuick(
    sceneType: SceneType,
    confidence: number
  ): Promise<{ headline: string; subtext: string }> {
    const template = SCENE_TEMPLATES[sceneType];
    const subScene = template.subScenes[0] || this.getDefaultSubScene();

    // 创建最小上下文
    const minimalCtx = this.createMinimalContext(sceneType, confidence);

    return {
      headline: textGenerator.fillAndSelectRandom(subScene.headlines, minimalCtx),
      subtext: textGenerator.fillAndSelectRandom(subScene.subtexts, minimalCtx),
    };
  }

  /**
   * 创建最小上下文（用于快速生成）
   */
  private createMinimalContext(sceneType: SceneType, confidence: number): AggregatedContext {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dayOfWeek = now.getDay();

    return {
      time: {
        hour,
        minute,
        dayOfWeek,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isHoliday: false,
        timeOfDay: hour >= 5 && hour < 12 ? 'morning' :
                   hour >= 12 && hour < 18 ? 'afternoon' :
                   hour >= 18 && hour < 22 ? 'evening' : 'night',
        timeDescription: `${hour}:${minute.toString().padStart(2, '0')}`,
      },
      image: {
        available: false,
        topLabel: '',
        topScore: 0,
        allLabels: [],
        environmentType: 'unknown',
        specificPlace: '',
      },
      audio: {
        available: false,
        topLabel: '',
        topScore: 0,
        allLabels: [],
        soundEnvironment: 'moderate',
        dominantSound: '',
      },
      location: {
        available: false,
        matchedFence: null,
        wifiSSID: null,
        isMoving: false,
        transportMode: 'unknown',
      },
      calendar: {
        available: false,
        upcomingEvent: null,
        isInMeeting: false,
      },
      device: {
        batteryLevel: 100,
        isCharging: false,
        screenBrightness: 0.5,
        isDNDEnabled: false,
        connectedBluetooth: [],
      },
      user: {
        lastSceneType: 'UNKNOWN',
        consecutiveSceneCount: 1,
        feedbackHistory: {
          acceptRate: 0.5,
          preferredApps: [],
          activeHours: [],
        },
        usagePatterns: {
          morningRoutine: [],
          eveningRoutine: [],
        },
        commuteCountToday: 0,
      },
      scene: {
        type: sceneType,
        confidence,
        alternativeScenes: [],
        signals: [],
      },
      timestamp: Date.now(),
    };
  }

  /**
   * 获取支持的场景类型
   */
  getSupportedScenes(): SceneType[] {
    return Object.keys(SCENE_TEMPLATES) as SceneType[];
  }

  /**
   * 获取场景的子场景列表
   */
  getSubScenes(sceneType: SceneType): string[] {
    const template = SCENE_TEMPLATES[sceneType];
    return template.subScenes.map(s => s.id);
  }
}

// 导出单例
export const smartSuggestionEngine = new SmartSuggestionEngine();
export default smartSuggestionEngine;
