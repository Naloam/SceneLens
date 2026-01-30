/**
 * PersonalizationManager - 个性化管理器
 * 
 * 根据用户历史和偏好调整建议风格和内容
 */

import type { SceneType } from '../../types';
import type {
  AggregatedContext,
  PersonalizationFactors,
  ToneStyle,
  VerbosityLevel,
} from './types';
import { feedbackLogger } from '../../reflection/FeedbackLogger';
import { storageManager } from '../../stores/storageManager';

/**
 * 存储键
 */
const STORAGE_KEYS = {
  PERSONALIZATION: 'smart_suggestion_personalization',
  APP_USAGE: 'smart_suggestion_app_usage',
  PREFERENCE: 'smart_suggestion_preference',
} as const;

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  /** 语气风格偏好 */
  preferredTone?: ToneStyle;
  /** 详细程度偏好 */
  preferredVerbosity?: VerbosityLevel;
  /** 最大建议数量 */
  maxSuggestions?: number;
  /** 是否显示动作理由 */
  showActionReasons?: boolean;
  /** 是否启用个性化 */
  personalizationEnabled?: boolean;
}

/**
 * 应用使用记录
 */
interface AppUsageRecord {
  packageName: string;
  category: string;
  usageCount: number;
  lastUsed: number;
  sceneUsage: Record<SceneType, number>;
}

/**
 * 个性化管理器类
 */
export class PersonalizationManager {
  private preferences: UserPreferences = {};
  private appUsage: Map<string, AppUsageRecord> = new Map();
  private initialized = false;

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 加载用户偏好
      const savedPrefsJson = storageManager.getString(STORAGE_KEYS.PREFERENCE);
      if (savedPrefsJson) {
        this.preferences = JSON.parse(savedPrefsJson) as UserPreferences;
      }

      // 加载应用使用记录
      const savedUsageJson = storageManager.getString(STORAGE_KEYS.APP_USAGE);
      if (savedUsageJson) {
        const savedUsage = JSON.parse(savedUsageJson) as AppUsageRecord[];
        for (const record of savedUsage) {
          this.appUsage.set(record.packageName, record);
        }
      }

      this.initialized = true;
      console.log('[PersonalizationManager] 初始化完成');
    } catch (error) {
      console.warn('[PersonalizationManager] 初始化失败:', error);
      this.initialized = true;
    }
  }

  /**
   * 获取个性化因子
   */
  async getPersonalizationFactors(ctx: AggregatedContext): Promise<PersonalizationFactors> {
    await this.initialize();

    // 如果用户禁用了个性化，返回默认值
    if (this.preferences.personalizationEnabled === false) {
      return this.getDefaultFactors();
    }

    // 基于用户历史计算个性化因子
    const tone = await this.determineTone(ctx);
    const verbosity = await this.determineVerbosity(ctx);
    const suggestionCount = this.determineSuggestionCount(ctx);
    const preferredApps = await this.getPreferredApps(ctx.scene.type);

    return {
      tone,
      verbosity,
      suggestionCount,
      preferredApps,
    };
  }

  /**
   * 获取默认个性化因子
   */
  private getDefaultFactors(): PersonalizationFactors {
    return {
      tone: 'casual',
      verbosity: 'normal',
      suggestionCount: 3,
      preferredApps: [],
    };
  }

  /**
   * 确定语气风格
   */
  private async determineTone(ctx: AggregatedContext): Promise<ToneStyle> {
    // 如果用户设置了偏好，使用偏好
    if (this.preferences.preferredTone) {
      return this.preferences.preferredTone;
    }

    // 基于接受率调整语气
    const acceptRate = ctx.user.feedbackHistory.acceptRate;

    // 高接受率用户 -> 更随意的语气
    if (acceptRate > 0.7) {
      return 'enthusiastic';
    }
    
    // 中等接受率 -> 普通语气
    if (acceptRate > 0.4) {
      return 'casual';
    }
    
    // 低接受率 -> 更正式、更谨慎
    return 'formal';
  }

  /**
   * 确定详细程度
   */
  private async determineVerbosity(ctx: AggregatedContext): Promise<VerbosityLevel> {
    // 如果用户设置了偏好，使用偏好
    if (this.preferences.preferredVerbosity) {
      return this.preferences.preferredVerbosity;
    }

    // 连续相同场景多次触发 -> 更简洁
    if (ctx.user.consecutiveSceneCount >= 3) {
      return 'concise';
    }

    // 低置信度场景 -> 更详细解释
    if (ctx.scene.confidence < 0.5) {
      return 'detailed';
    }

    return 'normal';
  }

  /**
   * 确定建议数量
   */
  private determineSuggestionCount(ctx: AggregatedContext): number {
    // 如果用户设置了最大数量，使用设置
    if (this.preferences.maxSuggestions) {
      return this.preferences.maxSuggestions;
    }

    // 高置信度场景 -> 可以显示更多建议
    if (ctx.scene.confidence > 0.8) {
      return 4;
    }

    // 低置信度 -> 减少建议数量
    if (ctx.scene.confidence < 0.5) {
      return 2;
    }

    return 3;
  }

  /**
   * 获取偏好应用列表
   */
  private async getPreferredApps(sceneType: SceneType): Promise<string[]> {
    await this.initialize();

    // 按该场景的使用次数排序
    const appsForScene = Array.from(this.appUsage.values())
      .filter(app => (app.sceneUsage[sceneType] || 0) > 0)
      .sort((a, b) => (b.sceneUsage[sceneType] || 0) - (a.sceneUsage[sceneType] || 0))
      .slice(0, 5)
      .map(app => app.packageName);

    return appsForScene;
  }

  /**
   * 记录应用使用
   */
  async recordAppUsage(packageName: string, category: string, sceneType: SceneType): Promise<void> {
    await this.initialize();

    const existing = this.appUsage.get(packageName);
    
    if (existing) {
      existing.usageCount++;
      existing.lastUsed = Date.now();
      existing.sceneUsage[sceneType] = (existing.sceneUsage[sceneType] || 0) + 1;
    } else {
      this.appUsage.set(packageName, {
        packageName,
        category,
        usageCount: 1,
        lastUsed: Date.now(),
        sceneUsage: { [sceneType]: 1 } as Record<SceneType, number>,
      });
    }

    // 保存
    await this.saveAppUsage();
  }

  /**
   * 保存应用使用记录
   */
  private async saveAppUsage(): Promise<void> {
    try {
      const records = Array.from(this.appUsage.values());
      storageManager.set(STORAGE_KEYS.APP_USAGE, JSON.stringify(records));
    } catch (error) {
      console.warn('[PersonalizationManager] 保存应用使用记录失败:', error);
    }
  }

  /**
   * 设置用户偏好
   */
  async setPreferences(prefs: Partial<UserPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...prefs };
    
    try {
      storageManager.set(STORAGE_KEYS.PREFERENCE, JSON.stringify(this.preferences));
    } catch (error) {
      console.warn('[PersonalizationManager] 保存偏好失败:', error);
    }
  }

  /**
   * 获取用户偏好
   */
  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  /**
   * 调整文本风格
   */
  adjustTextStyle(text: string, factors: PersonalizationFactors): string {
    let adjusted = text;

    // 根据语气风格调整
    switch (factors.tone) {
      case 'enthusiastic':
        // 添加感叹号和表情
        if (!adjusted.endsWith('!') && !adjusted.endsWith('！')) {
          adjusted = adjusted.replace(/[。.]$/, '！');
        }
        break;
      case 'formal':
        // 移除过于随意的表达
        adjusted = adjusted
          .replace(/~/g, '')
          .replace(/！/g, '。')
          .replace(/!/g, '.');
        break;
      // casual 保持原样
    }

    // 根据详细程度调整
    switch (factors.verbosity) {
      case 'concise':
        // 截取主要信息
        if (adjusted.includes('，')) {
          const parts = adjusted.split('，');
          if (parts.length > 2) {
            adjusted = parts.slice(0, 2).join('，');
          }
        }
        break;
      case 'detailed':
        // 保持原样或添加更多信息
        break;
      // normal 保持原样
    }

    return adjusted;
  }

  /**
   * 过滤和排序动作
   */
  filterAndSortActions<T extends { priority: number; params?: Record<string, any> }>(
    actions: T[],
    factors: PersonalizationFactors,
    sceneType: SceneType
  ): T[] {
    let filtered = [...actions];

    // 根据偏好应用调整优先级
    const preferredSet = new Set(factors.preferredApps);
    filtered = filtered.map(action => {
      const packageName = action.params?.packageName;
      if (packageName && preferredSet.has(packageName)) {
        return { ...action, priority: action.priority + 10 };
      }
      return action;
    });

    // 按优先级排序
    filtered.sort((a, b) => b.priority - a.priority);

    // 限制数量
    return filtered.slice(0, factors.suggestionCount + 1);
  }

  /**
   * 获取场景特定的个性化文本
   */
  getPersonalizedGreeting(ctx: AggregatedContext, factors: PersonalizationFactors): string {
    const baseGreetings: Record<ToneStyle, string[]> = {
      enthusiastic: [
        '嗨！又见面了！',
        '准备好了吗？出发！',
        '新的一天，新的开始！',
      ],
      casual: [
        '嗨，准备好了',
        '一切就绪',
        '准备出发',
      ],
      formal: [
        '您好',
        '已为您准备就绪',
        '系统已就绪',
      ],
    };

    const greetings = baseGreetings[factors.tone];
    
    // 连续触发时使用更简单的问候
    if (ctx.user.consecutiveSceneCount >= 3) {
      return factors.tone === 'formal' ? '您好' : '又见面了';
    }

    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * 生成上下文说明
   */
  generateContextNotes(ctx: AggregatedContext, factors: PersonalizationFactors): string[] {
    const notes: string[] = [];

    // 根据详细程度决定显示多少上下文信息
    if (factors.verbosity === 'concise') {
      // 只显示最重要的一条
      if (ctx.image.available && ctx.image.topScore > 0.7) {
        notes.push(`识别: ${ctx.image.specificPlace}`);
      }
      return notes;
    }

    // normal 和 detailed 显示更多
    if (ctx.image.available) {
      const confidence = Math.round(ctx.image.topScore * 100);
      notes.push(`图像识别: ${ctx.image.specificPlace} (${confidence}%)`);
    }

    if (ctx.audio.available && ctx.audio.soundEnvironment !== 'moderate') {
      notes.push(`环境: ${ctx.audio.dominantSound}`);
    }

    // detailed 模式显示更多
    if (factors.verbosity === 'detailed') {
      notes.push(`当前时间: ${ctx.time.timeDescription}`);
      
      if (ctx.device.batteryLevel <= 30) {
        notes.push(`电量: ${ctx.device.batteryLevel}%`);
      }

      if (ctx.location.wifiSSID) {
        notes.push(`WiFi: ${ctx.location.wifiSSID}`);
      }
    }

    return notes;
  }

  /**
   * 重置个性化数据
   */
  async reset(): Promise<void> {
    this.preferences = {};
    this.appUsage.clear();

    try {
      // 通过设置空字符串来删除（MMKV 的 delete 模拟）
      storageManager.delete(STORAGE_KEYS.PREFERENCE);
      storageManager.delete(STORAGE_KEYS.APP_USAGE);
      storageManager.delete(STORAGE_KEYS.PERSONALIZATION);
    } catch (error) {
      console.warn('[PersonalizationManager] 重置失败:', error);
    }

    this.initialized = false;
  }
}

// 导出单例
export const personalizationManager = new PersonalizationManager();
export default personalizationManager;
