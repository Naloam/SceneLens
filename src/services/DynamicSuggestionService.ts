/**
 * DynamicSuggestionService - AI 动态场景建议服务
 *
 * 职责：根据上下文动态生成个性化场景建议
 * - 时间感知（早晨/下午/晚上/深夜）
 * - 历史使用模式分析
 * - 用户反馈学习
 * - 多样化建议生成
 */

import type {
  SceneType,
  OneTapAction,
  SystemAdjustment,
  AppLaunch,
} from '../types';
import { feedbackLogger, FeedbackLogger, FeedbackStats } from '../reflection/FeedbackLogger';
import { weightAdjuster, WeightAdjuster } from '../reflection/WeightAdjuster';
import { storageManager } from '../stores/storageManager';
import { classifyDay } from './suggestion/workdayCalendar';

interface DynamicSuggestionDependencies {
  feedbackLogger: Pick<FeedbackLogger, 'initialize' | 'getStats'>;
  weightAdjuster: Pick<WeightAdjuster, 'initialize' | 'getWeight'>;
  storage: Pick<typeof storageManager, 'getString' | 'set'>;
  logger: Pick<Console, 'log' | 'warn' | 'error'>;
}

const defaultDependencies: DynamicSuggestionDependencies = {
  feedbackLogger,
  weightAdjuster,
  storage: storageManager,
  logger: console,
};

/**
 * 时间段类型
 */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * 动态建议配置
 */
export interface DynamicSuggestionConfig {
  /** 建议 ID */
  id: string;
  /** 建议标签 */
  label: string;
  /** 描述 */
  description: string;
  /** 优先级（越高越靠前） */
  priority: number;
  /** 适用时间段 */
  applicableTimeOfDay?: TimeOfDay[];
  /** 最小置信度要求 */
  minConfidence?: number;
  /** 是否需要特定条件 */
  condition?: () => boolean;
}

/**
 * 动态系统调整
 */
export interface DynamicSystemAdjustment extends SystemAdjustment {
  /** 动态优先级 */
  dynamicPriority: number;
  /** 推荐理由 */
  reason: string;
  /** 时间相关性评分 */
  timeRelevance: number;
}

/**
 * 动态应用启动
 */
export interface DynamicAppLaunch extends AppLaunch {
  /** 动态优先级 */
  dynamicPriority: number;
  /** 推荐理由 */
  reason: string;
  /** 历史使用频率评分 */
  usageScore: number;
}

/**
 * 动态建议包
 */
export interface DynamicSuggestionPackage {
  sceneType: SceneType;
  systemAdjustments: DynamicSystemAdjustment[];
  appLaunches: DynamicAppLaunch[];
  oneTapActions: OneTapAction[];
  /** 建议生成时间 */
  generatedAt: number;
  /** 上下文信息 */
  context: {
    timeOfDay: TimeOfDay;
    hour: number;
    dayOfWeek: number;
    isWeekend: boolean;
    isHoliday: boolean;
    isWorkday: boolean;
    isRestDay: boolean;
    dayTypeLabel: '工作日' | '周末' | '休息日';
  };
  /** 个性化说明 */
  personalizedNotes: string[];
}

/**
 * 应用使用历史记录
 */
interface AppUsageRecord {
  packageName: string;
  intentType: string;
  usageCount: number;
  lastUsed: number;
  hourlyDistribution: Record<number, number>; // 按小时统计使用次数
}

/**
 * 存储键
 */
const STORAGE_KEYS = {
  APP_USAGE_HISTORY: 'app_usage_history',
  SUGGESTION_HISTORY: 'suggestion_history',
} as const;

/**
 * 时间段配置
 */
const TIME_OF_DAY_CONFIG: Record<TimeOfDay, { startHour: number; endHour: number; label: string }> = {
  morning: { startHour: 5, endHour: 12, label: '早晨' },
  afternoon: { startHour: 12, endHour: 18, label: '下午' },
  evening: { startHour: 18, endHour: 22, label: '傍晚' },
  night: { startHour: 22, endHour: 5, label: '夜间' },
};

/**
 * 场景-时间段相关性配置
 */
const SCENE_TIME_RELEVANCE: Record<SceneType, Record<TimeOfDay, number>> = {
  COMMUTE: { morning: 1.0, afternoon: 0.3, evening: 0.9, night: 0.1 },
  OFFICE: { morning: 0.7, afternoon: 1.0, evening: 0.3, night: 0.0 },
  HOME: { morning: 0.4, afternoon: 0.3, evening: 0.8, night: 1.0 },
  STUDY: { morning: 0.6, afternoon: 0.8, evening: 0.9, night: 0.5 },
  SLEEP: { morning: 0.1, afternoon: 0.0, evening: 0.3, night: 1.0 },
  TRAVEL: { morning: 0.6, afternoon: 0.7, evening: 0.5, night: 0.3 },
  UNKNOWN: { morning: 0.5, afternoon: 0.5, evening: 0.5, night: 0.5 },
};

/**
 * 动态建议变体配置（用于多样化）
 */
const SUGGESTION_VARIANTS: Record<SceneType, {
  greetings: string[];
  tips: string[];
  actionLabels: Record<string, string[]>;
}> = {
  COMMUTE: {
    greetings: [
      '准备出发了！',
      '通勤时间到~',
      '让我帮你准备好',
      '一切就绪！',
    ],
    tips: [
      '今天路上听点什么？',
      '别忘了戴好耳机',
      '准备好乘车码了吗？',
    ],
    actionLabels: {
      execute: ['开始通勤', '出发吧', '准备好了', '启程'],
    },
  },
  HOME: {
    greetings: [
      '欢迎回家！',
      '到家了~',
      '辛苦了，放松一下',
      '家是最舒适的地方',
    ],
    tips: [
      '今天过得怎么样？',
      '是时候休息一下了',
      '打开智能家居享受温馨时光',
    ],
    actionLabels: {
      execute: ['回家模式', '欢迎回家', '开始放松', '家庭模式'],
    },
  },
  OFFICE: {
    greetings: [
      '进入工作状态',
      '开始新的一天！',
      '专注工作时间',
      '准备好迎接挑战',
      '会议即将开始',
      '准备好开会了',
    ],
    tips: [
      '今天有什么重要会议？',
      '记得定时休息眼睛',
      '专注模式已就绪',
      '已为您打开勿扰模式',
    ],
    actionLabels: {
      execute: ['工作模式', '开始专注', '进入状态', '准备就绪', '进入会议'],
    },
  },
  STUDY: {
    greetings: [
      '学习时间到！',
      '准备开始学习',
      '专注学习模式',
      '知识充电时间',
    ],
    tips: [
      '番茄工作法效果更好',
      '记得适时休息',
      '专注是成功的关键',
    ],
    actionLabels: {
      execute: ['开始学习', '专注模式', '学习时间', '开始专注'],
    },
  },
  SLEEP: {
    greetings: [
      '该休息了',
      '夜深了，早点休息',
      '准备睡眠',
      '晚安模式',
    ],
    tips: [
      '放下手机，好好休息',
      '明天又是新的一天',
      '养成规律作息',
    ],
    actionLabels: {
      execute: ['睡眠模式', '开始休息', '晚安', '准备睡觉'],
    },
  },
  TRAVEL: {
    greetings: [
      '旅途愉快！',
      '准备出发',
      '开始新的旅程',
      '旅行模式启动',
    ],
    tips: [
      '检查好证件和行李',
      '注意安全，祝旅途顺利',
      '别忘了查看航班/车次信息',
    ],
    actionLabels: {
      execute: ['出发模式', '开始旅程', '旅行准备', '准备出发'],
    },
  },
  UNKNOWN: {
    greetings: ['您好！', '准备好了'],
    tips: ['让我帮您准备'],
    actionLabels: {
      execute: ['执行', '确认', '开始'],
    },
  },
};

/**
 * DynamicSuggestionService 类
 */
export class DynamicSuggestionService {
  private appUsageHistory: Map<string, AppUsageRecord> = new Map();
  private appUsageHistoryLoaded = false;
  private initialized = false;
  private historyLoadingPromise: Promise<void> | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    private readonly dependencies: DynamicSuggestionDependencies = defaultDependencies
  ) {}

  /**
   * 初始化服务
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
    await this.ensureAppUsageHistoryLoaded();
    await this.dependencies.feedbackLogger.initialize();
    await this.dependencies.weightAdjuster.initialize();

    this.initialized = true;
    this.dependencies.logger.log('[DynamicSuggestionService] initialize complete');
  }

  private async ensureAppUsageHistoryLoaded(): Promise<void> {
    if (this.appUsageHistoryLoaded) return;

    if (this.historyLoadingPromise) {
      await this.historyLoadingPromise;
      return;
    }

    this.historyLoadingPromise = this.loadAppUsageHistory();

    try {
      await this.historyLoadingPromise;
      this.appUsageHistoryLoaded = true;
    } finally {
      this.historyLoadingPromise = null;
    }
  }

  /**
   * 获取当前时间段
   */
  getTimeOfDay(date: Date = new Date()): TimeOfDay {
    const hour = date.getHours();
    
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * 获取时间段的友好名称
   */
  getTimeOfDayLabel(timeOfDay: TimeOfDay): string {
    return TIME_OF_DAY_CONFIG[timeOfDay].label;
  }

  /**
   * 获取时间上下文
   */
  private getTimeContext(): DynamicSuggestionPackage['context'] {
    const now = new Date();
    const dayClassification = classifyDay(now);
    
    return {
      timeOfDay: this.getTimeOfDay(now),
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      isWeekend: dayClassification.isWeekend,
      isHoliday: dayClassification.isHoliday,
      isWorkday: dayClassification.isWorkday,
      isRestDay: dayClassification.isRestDay,
      dayTypeLabel: dayClassification.dayTypeLabel,
    };
  }

  /**
   * 生成动态建议包
   */
  async generateDynamicSuggestions(
    sceneType: SceneType,
    baseSuggestions: {
      systemAdjustments: SystemAdjustment[];
      appLaunches: AppLaunch[];
      oneTapActions: OneTapAction[];
    }
  ): Promise<DynamicSuggestionPackage> {
    await this.initialize();

    const context = this.getTimeContext();
    const feedbackStats = this.dependencies.feedbackLogger.getStats(sceneType);
    const sceneWeight = this.dependencies.weightAdjuster.getWeight(sceneType);

    // 生成动态系统调整
    const dynamicSystemAdjustments = this.enhanceSystemAdjustments(
      baseSuggestions.systemAdjustments,
      sceneType,
      context
    );

    // 生成动态应用启动
    const dynamicAppLaunches = await this.enhanceAppLaunches(
      baseSuggestions.appLaunches,
      sceneType,
      context
    );

    // 生成动态一键操作
    const dynamicOneTapActions = this.enhanceOneTapActions(
      baseSuggestions.oneTapActions,
      sceneType,
      context
    );

    // 生成个性化说明
    const personalizedNotes = this.generatePersonalizedNotes(
      sceneType,
      context,
      feedbackStats
    );

    return {
      sceneType,
      systemAdjustments: dynamicSystemAdjustments,
      appLaunches: dynamicAppLaunches,
      oneTapActions: dynamicOneTapActions,
      generatedAt: Date.now(),
      context,
      personalizedNotes,
    };
  }

  /**
   * 增强系统调整建议
   */
  private enhanceSystemAdjustments(
    baseAdjustments: SystemAdjustment[],
    sceneType: SceneType,
    context: DynamicSuggestionPackage['context']
  ): DynamicSystemAdjustment[] {
    const timeRelevance = SCENE_TIME_RELEVANCE[sceneType]?.[context.timeOfDay] ?? 0.5;

    return baseAdjustments.map((adjustment, index) => {
      // 根据时间调整亮度参数
      let adjustedParams = adjustment.params;
      let reason = '基于场景建议';

      if (adjustment.action === 'setBrightness') {
        const hour = context.hour;
        let suggestedLevel = adjustment.params?.level ?? 0.7;

        // 夜间降低亮度
        if (context.timeOfDay === 'night') {
          suggestedLevel = Math.min(suggestedLevel, 0.4);
          reason = '夜间模式：降低亮度保护眼睛';
        }
        // 早晨逐渐提高亮度
        else if (context.timeOfDay === 'morning' && hour >= 6 && hour <= 8) {
          suggestedLevel = 0.5 + (hour - 6) * 0.15;
          reason = '早晨模式：逐渐提高亮度';
        }

        adjustedParams = { ...adjustment.params, level: suggestedLevel };
      }

      // 根据时间调整勿扰模式
      if (adjustment.action === 'setDoNotDisturb') {
        if (context.timeOfDay === 'night' && sceneType === 'SLEEP') {
          reason = '睡眠时间：开启完全勿扰';
        } else if (context.timeOfDay === 'morning' && sceneType === 'COMMUTE') {
          reason = '通勤时间：仅允许紧急联系人';
        }
      }

      return {
        ...adjustment,
        params: adjustedParams,
        dynamicPriority: baseAdjustments.length - index + timeRelevance * 10,
        reason,
        timeRelevance,
      };
    }).sort((a, b) => b.dynamicPriority - a.dynamicPriority);
  }

  /**
   * 增强应用启动建议
   */
  private async enhanceAppLaunches(
    baseLaunches: AppLaunch[],
    sceneType: SceneType,
    context: DynamicSuggestionPackage['context']
  ): Promise<DynamicAppLaunch[]> {
    const timeRelevance = SCENE_TIME_RELEVANCE[sceneType]?.[context.timeOfDay] ?? 0.5;

    return baseLaunches.map((launch, index) => {
      // 获取应用使用历史
      const usageRecord = this.appUsageHistory.get(launch.intent ?? '');
      const usageScore = this.calculateUsageScore(usageRecord, context.hour);

      // 生成推荐理由
      let reason = '场景推荐应用';
      
      if (usageRecord && usageRecord.usageCount > 5) {
        const hourlyUsage = usageRecord.hourlyDistribution[context.hour] || 0;
        if (hourlyUsage > 3) {
          reason = `您在${context.hour}点经常使用此应用`;
        } else if (usageRecord.usageCount > 10) {
          reason = '您的常用应用';
        }
      }

      // 通勤场景的特殊处理
      if (sceneType === 'COMMUTE') {
        if (launch.intent?.includes('TRANSIT')) {
          reason = context.timeOfDay === 'morning' 
            ? '早高峰出行必备' 
            : '晚高峰返程准备';
        } else if (launch.intent?.includes('MUSIC')) {
          reason = '通勤路上来点音乐';
        }
      }

      // 睡眠场景的特殊处理
      if (sceneType === 'SLEEP' && launch.intent?.includes('MUSIC')) {
        reason = '助眠音乐推荐';
      }

      return {
        ...launch,
        dynamicPriority: baseLaunches.length - index + usageScore + timeRelevance * 5,
        reason,
        usageScore,
      };
    }).sort((a, b) => b.dynamicPriority - a.dynamicPriority);
  }

  /**
   * 计算应用使用评分
   */
  private calculateUsageScore(
    usageRecord: AppUsageRecord | undefined,
    currentHour: number
  ): number {
    if (!usageRecord) return 0;

    const baseScore = Math.min(usageRecord.usageCount / 20, 1) * 5;
    const hourlyBonus = (usageRecord.hourlyDistribution[currentHour] || 0) / 5;
    const recencyBonus = this.calculateRecencyBonus(usageRecord.lastUsed);

    return baseScore + hourlyBonus + recencyBonus;
  }

  /**
   * 计算最近使用奖励
   */
  private calculateRecencyBonus(lastUsed: number): number {
    const daysSinceLastUse = (Date.now() - lastUsed) / (1000 * 60 * 60 * 24);
    if (daysSinceLastUse < 1) return 2;
    if (daysSinceLastUse < 7) return 1;
    return 0;
  }

  /**
   * 增强一键操作
   */
  private enhanceOneTapActions(
    baseActions: OneTapAction[],
    sceneType: SceneType,
    context: DynamicSuggestionPackage['context']
  ): OneTapAction[] {
    const variants = SUGGESTION_VARIANTS[sceneType] || SUGGESTION_VARIANTS.UNKNOWN;
    
    return baseActions.map(action => {
      // 如果是主要操作，随机选择一个变体标签
      if (action.type === 'primary' && action.action === 'execute_all') {
        const labels = variants.actionLabels.execute || [action.label];
        const randomIndex = this.getSeededRandom(context.hour, labels.length);
        
        return {
          ...action,
          label: labels[randomIndex],
        };
      }
      
      return action;
    });
  }

  /**
   * 生成个性化说明
   */
  private generatePersonalizedNotes(
    sceneType: SceneType,
    context: DynamicSuggestionPackage['context'],
    feedbackStats: FeedbackStats | null
  ): string[] {
    const notes: string[] = [];
    const variants = SUGGESTION_VARIANTS[sceneType] || SUGGESTION_VARIANTS.UNKNOWN;

    // 添加问候语
    const greetingIndex = this.getSeededRandom(context.hour, variants.greetings.length);
    notes.push(variants.greetings[greetingIndex]);

    // 添加小贴士
    const tipIndex = this.getSeededRandom(context.dayOfWeek, variants.tips.length);
    notes.push(variants.tips[tipIndex]);

    // 根据反馈历史添加说明
    if (feedbackStats && feedbackStats.acceptRate > 0.7 && feedbackStats.totalCount > 5) {
      notes.push('✨ 这是您常用的场景设置');
    }

    // 周末特殊说明
    if (sceneType === 'OFFICE') {
      if (context.isWeekend && context.isWorkday) {
        notes.push('💡 今天是调休工作日，办公建议按工作日处理');
      } else if (!context.isWorkday) {
        notes.push(
          context.dayTypeLabel === '周末'
            ? '💡 周末还在处理工作，记得给自己留点休息时间'
            : '💡 今天是休息日，如非必要可稍后处理工作'
        );
      }
    }

    return notes;
  }

  /**
   * 获取基于种子的伪随机数（确保同一小时内结果一致）
   */
  private getSeededRandom(seed: number, max: number): number {
    // 使用日期作为额外种子，确保每天变化
    const dateSeed = new Date().toDateString().split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const combinedSeed = seed + dateSeed;
    return combinedSeed % max;
  }

  /**
   * 记录应用使用
   */
  async recordAppUsage(intentType: string, packageName: string): Promise<void> {
    await this.ensureAppUsageHistoryLoaded();

    const key = intentType || packageName;
    const existing = this.appUsageHistory.get(key) || {
      packageName,
      intentType,
      usageCount: 0,
      lastUsed: 0,
      hourlyDistribution: {},
    };

    const currentHour = new Date().getHours();

    existing.usageCount++;
    existing.lastUsed = Date.now();
    existing.hourlyDistribution[currentHour] = (existing.hourlyDistribution[currentHour] || 0) + 1;

    this.appUsageHistory.set(key, existing);
    await this.saveAppUsageHistory();
  }

  /**
   * 加载应用使用历史
   */
  private async loadAppUsageHistory(): Promise<void> {
    try {
      const data = this.dependencies.storage.getString(STORAGE_KEYS.APP_USAGE_HISTORY);
      if (data) {
        const parsed = JSON.parse(data) as Array<[string, AppUsageRecord]>;
        this.appUsageHistory = new Map(parsed);
      }
    } catch (error) {
      this.appUsageHistory = new Map();
      this.dependencies.logger.warn('[DynamicSuggestionService] 加载应用使用历史失败:', error);
    }
  }

  /**
   * 保存应用使用历史
   */
  private async saveAppUsageHistory(): Promise<void> {
    try {
      const data = JSON.stringify(Array.from(this.appUsageHistory.entries()));
      this.dependencies.storage.set(STORAGE_KEYS.APP_USAGE_HISTORY, data);
    } catch (error) {
      this.dependencies.logger.error('[DynamicSuggestionService] 保存应用使用历史失败:', error);
    }
  }

  /**
   * 获取场景的动态问候语
   */
  getGreeting(sceneType: SceneType): string {
    const variants = SUGGESTION_VARIANTS[sceneType] || SUGGESTION_VARIANTS.UNKNOWN;
    const context = this.getTimeContext();
    const index = this.getSeededRandom(context.hour, variants.greetings.length);
    return variants.greetings[index];
  }

  /**
   * 获取场景的动态提示
   */
  getTip(sceneType: SceneType): string {
    const variants = SUGGESTION_VARIANTS[sceneType] || SUGGESTION_VARIANTS.UNKNOWN;
    const context = this.getTimeContext();
    const index = this.getSeededRandom(context.dayOfWeek, variants.tips.length);
    return variants.tips[index];
  }
}

// 导出单例
export const dynamicSuggestionService = new DynamicSuggestionService();
export default dynamicSuggestionService;
