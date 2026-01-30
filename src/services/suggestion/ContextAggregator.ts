/**
 * ContextAggregator - 上下文聚合器
 * 
 * 负责收集整合所有数据源信息，生成结构化的 AggregatedContext
 */

import type { SceneType, Prediction, SilentContext, ContextSignal } from '../../types';
import type {
  AggregatedContext,
  TimeContext,
  ImageContext,
  AudioContext,
  LocationContext,
  CalendarContext,
  DeviceContext,
  UserContext,
  SceneContext,
  TimeOfDayType,
  EnvironmentType,
  SoundEnvironment,
  TransportMode,
  LabelScore,
} from './types';
import { feedbackLogger } from '../../reflection/FeedbackLogger';
import { storageManager } from '../../stores/storageManager';

/**
 * 图像标签到环境类型的映射
 */
const IMAGE_LABEL_TO_ENVIRONMENT: Record<string, EnvironmentType> = {
  'indoor_office': 'indoor',
  'indoor_home': 'indoor',
  'library': 'indoor',
  'restaurant': 'indoor',
  'gym': 'indoor',
  'outdoor_street': 'outdoor',
  'outdoor_park': 'outdoor',
  'transport_subway': 'transport',
  'transport_bus': 'transport',
  'transport_car': 'transport',
};

/**
 * 图像标签到具体地点的映射
 */
const IMAGE_LABEL_TO_PLACE: Record<string, string> = {
  'indoor_office': '办公室',
  'indoor_home': '家中',
  'library': '图书馆',
  'restaurant': '餐厅',
  'gym': '健身房',
  'outdoor_street': '街道',
  'outdoor_park': '公园',
  'transport_subway': '地铁',
  'transport_bus': '公交车',
  'transport_car': '车内',
};

/**
 * 音频标签到声音描述的映射
 */
const AUDIO_LABEL_TO_DESCRIPTION: Record<string, string> = {
  'silence': '环境安静',
  'speech': '有人在说话',
  'music': '正在播放音乐',
  'traffic': '交通噪音',
  'nature': '自然声音',
  'machinery': '机器声',
  'crowd': '人群嘈杂',
  'indoor_quiet': '室内安静',
  'outdoor_busy': '室外繁忙',
};

/**
 * 存储键
 */
const STORAGE_KEYS = {
  USER_CONTEXT: 'smart_suggestion_user_context',
  COMMUTE_COUNT: 'daily_commute_count',
  LAST_SCENE: 'last_scene_type',
} as const;

/**
 * 上下文聚合器类
 */
export class ContextAggregator {
  private lastContext: AggregatedContext | null = null;

  /**
   * 聚合所有上下文信息
   */
  async aggregate(
    sceneType: SceneType,
    confidence: number,
    silentContext: SilentContext | null,
    mlPredictions: Prediction[] | null,
  ): Promise<AggregatedContext> {
    const timestamp = Date.now();

    // 并行获取各种上下文
    const [
      timeContext,
      imageContext,
      audioContext,
      locationContext,
      calendarContext,
      deviceContext,
      userContext,
    ] = await Promise.all([
      this.buildTimeContext(),
      this.buildImageContext(mlPredictions),
      this.buildAudioContext(mlPredictions),
      this.buildLocationContext(silentContext),
      this.buildCalendarContext(silentContext),
      this.buildDeviceContext(silentContext),
      this.buildUserContext(sceneType),
    ]);

    // 构建场景上下文
    const sceneContext = this.buildSceneContext(
      sceneType,
      confidence,
      silentContext,
      mlPredictions
    );

    const aggregatedContext: AggregatedContext = {
      time: timeContext,
      image: imageContext,
      audio: audioContext,
      location: locationContext,
      calendar: calendarContext,
      device: deviceContext,
      user: userContext,
      scene: sceneContext,
      timestamp,
    };

    // 保存最后的上下文
    this.lastContext = aggregatedContext;

    // 更新用户历史
    await this.updateUserHistory(sceneType);

    return aggregatedContext;
  }

  /**
   * 构建时间上下文
   */
  private async buildTimeContext(): Promise<TimeContext> {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // 判断时段
    const timeOfDay = this.getTimeOfDay(hour);

    // 生成时间描述
    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const timeOfDayNames: Record<TimeOfDayType, string> = {
      dawn: '凌晨',
      morning: '早上',
      noon: '中午',
      afternoon: '下午',
      evening: '傍晚',
      night: '晚上',
      midnight: '深夜',
    };

    const timeDescription = `${weekdayNames[dayOfWeek]}${timeOfDayNames[timeOfDay]}${hour}点`;

    // 检查是否节假日（简单实现，后续可扩展）
    const isHoliday = this.checkIsHoliday(now);

    return {
      hour,
      minute,
      dayOfWeek,
      isWeekend,
      isHoliday,
      timeOfDay,
      timeDescription,
    };
  }

  /**
   * 获取时段类型
   */
  private getTimeOfDay(hour: number): TimeOfDayType {
    if (hour >= 0 && hour < 5) return 'midnight';
    if (hour >= 5 && hour < 7) return 'dawn';
    if (hour >= 7 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 14) return 'noon';
    if (hour >= 14 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * 检查是否节假日（简单实现）
   */
  private checkIsHoliday(_date: Date): boolean {
    // TODO: 可接入节假日 API 或本地数据
    return false;
  }

  /**
   * 构建图像分析上下文
   */
  private async buildImageContext(predictions: Prediction[] | null): Promise<ImageContext> {
    if (!predictions) {
      return this.getEmptyImageContext();
    }

    // 过滤出图像相关的预测
    const imageLabels = predictions
      .filter(p => p.label.startsWith('image:'))
      .map(p => ({
        label: p.label.replace('image:', ''),
        score: p.score,
      }));

    if (imageLabels.length === 0) {
      return this.getEmptyImageContext();
    }

    // 按分数排序
    const sortedLabels = [...imageLabels].sort((a, b) => b.score - a.score);
    const topLabel = sortedLabels[0];

    return {
      available: true,
      topLabel: topLabel.label,
      topScore: topLabel.score,
      allLabels: sortedLabels,
      environmentType: IMAGE_LABEL_TO_ENVIRONMENT[topLabel.label] || 'unknown',
      specificPlace: IMAGE_LABEL_TO_PLACE[topLabel.label] || '未知位置',
    };
  }

  /**
   * 获取空的图像上下文
   */
  private getEmptyImageContext(): ImageContext {
    return {
      available: false,
      topLabel: '',
      topScore: 0,
      allLabels: [],
      environmentType: 'unknown',
      specificPlace: '',
    };
  }

  /**
   * 构建音频分析上下文
   */
  private async buildAudioContext(predictions: Prediction[] | null): Promise<AudioContext> {
    if (!predictions) {
      return this.getEmptyAudioContext();
    }

    // 过滤出音频相关的预测
    const audioLabels = predictions
      .filter(p => p.label.startsWith('audio:'))
      .map(p => ({
        label: p.label.replace('audio:', ''),
        score: p.score,
      }));

    if (audioLabels.length === 0) {
      return this.getEmptyAudioContext();
    }

    // 按分数排序
    const sortedLabels = [...audioLabels].sort((a, b) => b.score - a.score);
    const topLabel = sortedLabels[0];

    // 判断声音环境
    const soundEnvironment = this.determineSoundEnvironment(sortedLabels);

    return {
      available: true,
      topLabel: topLabel.label,
      topScore: topLabel.score,
      allLabels: sortedLabels,
      soundEnvironment,
      dominantSound: AUDIO_LABEL_TO_DESCRIPTION[topLabel.label] || '未知声音',
    };
  }

  /**
   * 获取空的音频上下文
   */
  private getEmptyAudioContext(): AudioContext {
    return {
      available: false,
      topLabel: '',
      topScore: 0,
      allLabels: [],
      soundEnvironment: 'moderate',
      dominantSound: '',
    };
  }

  /**
   * 判断声音环境
   */
  private determineSoundEnvironment(labels: LabelScore[]): SoundEnvironment {
    const quietLabels = ['silence', 'indoor_quiet'];
    const noisyLabels = ['traffic', 'crowd', 'machinery', 'outdoor_busy'];

    const topLabel = labels[0]?.label || '';

    if (quietLabels.includes(topLabel)) return 'quiet';
    if (noisyLabels.includes(topLabel)) return 'noisy';
    return 'moderate';
  }

  /**
   * 构建位置上下文
   */
  private async buildLocationContext(silentContext: SilentContext | null): Promise<LocationContext> {
    let matchedFence: string | null = null;
    let wifiSSID: string | null = null;
    let isMoving = false;
    let transportMode: TransportMode = 'unknown';

    if (silentContext) {
      // 从信号中提取位置信息
      for (const signal of silentContext.signals) {
        if (signal.type === 'LOCATION') {
          // 尝试解析围栏名称
          const fenceMatch = signal.value.match(/围栏[:：](.+)/);
          if (fenceMatch) {
            matchedFence = fenceMatch[1];
          }
        }
        if (signal.type === 'WIFI') {
          const ssidMatch = signal.value.match(/SSID[:：](.+)/);
          if (ssidMatch) {
            wifiSSID = ssidMatch[1];
          }
        }
        if (signal.type === 'MOTION') {
          const motion = signal.value.toLowerCase();
          if (motion.includes('walking')) {
            transportMode = 'walking';
            isMoving = true;
          } else if (motion.includes('vehicle')) {
            transportMode = 'vehicle';
            isMoving = true;
          } else if (motion.includes('still')) {
            transportMode = 'still';
            isMoving = false;
          }
        }
      }
    }

    return {
      available: silentContext !== null,
      matchedFence,
      wifiSSID,
      isMoving,
      transportMode,
    };
  }

  /**
   * 构建日历上下文
   */
  private async buildCalendarContext(silentContext: SilentContext | null): Promise<CalendarContext> {
    let upcomingEvent = null;
    let isInMeeting = false;

    if (silentContext) {
      // 从信号中提取日历信息
      for (const signal of silentContext.signals) {
        if (signal.type === 'CALENDAR') {
          // 尝试解析会议信息
          const meetingMatch = signal.value.match(/会议[:：](.+?)(?:，|,|$)/);
          const timeMatch = signal.value.match(/(\d+)分钟后/);

          if (meetingMatch && timeMatch) {
            upcomingEvent = {
              title: meetingMatch[1],
              minutesUntil: parseInt(timeMatch[1], 10),
              location: '',
            };
          }

          if (signal.value.includes('会议中') || signal.value.includes('正在开会')) {
            isInMeeting = true;
          }
        }
      }
    }

    return {
      available: silentContext !== null,
      upcomingEvent,
      isInMeeting,
    };
  }

  /**
   * 构建设备状态上下文
   */
  private async buildDeviceContext(silentContext: SilentContext | null): Promise<DeviceContext> {
    let batteryLevel = 100;
    let isCharging = false;
    let screenBrightness = 0.5;
    let isDNDEnabled = false;
    const connectedBluetooth: string[] = [];

    if (silentContext) {
      // 从信号中提取设备状态
      for (const signal of silentContext.signals) {
        if (signal.type === 'BATTERY') {
          const levelMatch = signal.value.match(/(\d+)%/);
          if (levelMatch) {
            batteryLevel = parseInt(levelMatch[1], 10);
          }
          if (signal.value.includes('充电')) {
            isCharging = true;
          }
        }
        if (signal.type === 'SCREEN') {
          const brightnessMatch = signal.value.match(/亮度[:：](\d+)/);
          if (brightnessMatch) {
            screenBrightness = parseInt(brightnessMatch[1], 10) / 100;
          }
        }
      }
    }

    return {
      batteryLevel,
      isCharging,
      screenBrightness,
      isDNDEnabled,
      connectedBluetooth,
    };
  }

  /**
   * 构建用户历史上下文
   */
  private async buildUserContext(currentSceneType: SceneType): Promise<UserContext> {
    try {
      // 获取上一次场景
      const lastSceneJson = storageManager.getString(STORAGE_KEYS.LAST_SCENE);
      const lastScene: SceneType = lastSceneJson ? JSON.parse(lastSceneJson) : 'UNKNOWN';

      // 获取今日通勤计数
      const today = new Date().toDateString();
      const commuteJson = storageManager.getString(STORAGE_KEYS.COMMUTE_COUNT);
      const commuteData = commuteJson ? JSON.parse(commuteJson) as { date: string; count: number } : null;
      let commuteCountToday = 0;
      if (commuteData && commuteData.date === today) {
        commuteCountToday = commuteData.count;
      }

      // 获取反馈统计
      const feedbackStats = await feedbackLogger.getStats(currentSceneType);

      // 计算连续相同场景计数
      const userContextJson = storageManager.getString(STORAGE_KEYS.USER_CONTEXT);
      const userContextData = userContextJson 
        ? JSON.parse(userContextJson) as { lastScene: SceneType; consecutiveCount: number }
        : null;
      let consecutiveSceneCount = 1;
      if (userContextData && userContextData.lastScene === currentSceneType) {
        consecutiveSceneCount = userContextData.consecutiveCount + 1;
      }

      // 计算接受率
      const acceptRate = feedbackStats
        ? feedbackStats.acceptCount / Math.max(feedbackStats.totalCount, 1)
        : 0.5;

      return {
        lastSceneType: lastScene,
        consecutiveSceneCount,
        feedbackHistory: {
          acceptRate,
          preferredApps: [],
          activeHours: [],
        },
        usagePatterns: {
          morningRoutine: [],
          eveningRoutine: [],
        },
        commuteCountToday,
      };
    } catch (error) {
      console.warn('[ContextAggregator] 构建用户上下文失败:', error);
      return this.getDefaultUserContext();
    }
  }

  /**
   * 获取默认用户上下文
   */
  private getDefaultUserContext(): UserContext {
    return {
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
    };
  }

  /**
   * 构建场景上下文
   */
  private buildSceneContext(
    sceneType: SceneType,
    confidence: number,
    silentContext: SilentContext | null,
    mlPredictions: Prediction[] | null
  ): SceneContext {
    // 收集信号描述
    const signals: string[] = [];

    // 从静默上下文获取信号
    if (silentContext) {
      for (const signal of silentContext.signals) {
        signals.push(`${signal.type}: ${signal.value}`);
      }
    }

    // 从 ML 预测获取信号
    if (mlPredictions) {
      const topImage = mlPredictions.find(p => p.label.startsWith('image:'));
      const topAudio = mlPredictions.find(p => p.label.startsWith('audio:'));

      if (topImage) {
        signals.push(`图像: ${topImage.label.replace('image:', '')}`);
      }
      if (topAudio) {
        signals.push(`音频: ${topAudio.label.replace('audio:', '')}`);
      }
    }

    // 构建备选场景（简化实现）
    const alternativeScenes = this.buildAlternativeScenes(sceneType, confidence);

    return {
      type: sceneType,
      confidence,
      alternativeScenes,
      signals,
    };
  }

  /**
   * 构建备选场景列表
   */
  private buildAlternativeScenes(
    primaryScene: SceneType,
    primaryConfidence: number
  ): Array<{ type: SceneType; confidence: number }> {
    // 场景之间的关联性
    const sceneRelations: Record<SceneType, SceneType[]> = {
      COMMUTE: ['TRAVEL', 'OFFICE'],
      OFFICE: ['STUDY', 'COMMUTE'],
      HOME: ['SLEEP', 'STUDY'],
      STUDY: ['HOME', 'OFFICE'],
      SLEEP: ['HOME'],
      TRAVEL: ['COMMUTE'],
      UNKNOWN: [],
    };

    const alternatives = sceneRelations[primaryScene] || [];
    const remainingConfidence = 1 - primaryConfidence;

    return alternatives.map((scene, index) => ({
      type: scene,
      confidence: remainingConfidence * (0.5 / (index + 1)),
    }));
  }

  /**
   * 更新用户历史
   */
  private async updateUserHistory(sceneType: SceneType): Promise<void> {
    try {
      // 保存当前场景
      storageManager.set(STORAGE_KEYS.LAST_SCENE, JSON.stringify(sceneType));

      // 更新连续场景计数
      const existingJson = storageManager.getString(STORAGE_KEYS.USER_CONTEXT);
      const existingData = existingJson 
        ? JSON.parse(existingJson) as { lastScene: SceneType; consecutiveCount: number }
        : null;

      let consecutiveCount = 1;
      if (existingData && existingData.lastScene === sceneType) {
        consecutiveCount = existingData.consecutiveCount + 1;
      }

      storageManager.set(STORAGE_KEYS.USER_CONTEXT, JSON.stringify({
        lastScene: sceneType,
        consecutiveCount,
      }));

      // 如果是通勤场景，更新今日通勤计数
      if (sceneType === 'COMMUTE') {
        const today = new Date().toDateString();
        const commuteJson = storageManager.getString(STORAGE_KEYS.COMMUTE_COUNT);
        const commuteData = commuteJson 
          ? JSON.parse(commuteJson) as { date: string; count: number }
          : null;

        if (commuteData && commuteData.date === today) {
          storageManager.set(STORAGE_KEYS.COMMUTE_COUNT, JSON.stringify({
            date: today,
            count: commuteData.count + 1,
          }));
        } else {
          storageManager.set(STORAGE_KEYS.COMMUTE_COUNT, JSON.stringify({
            date: today,
            count: 1,
          }));
        }
      }
    } catch (error) {
      console.warn('[ContextAggregator] 更新用户历史失败:', error);
    }
  }

  /**
   * 计算上下文哈希（用于判断上下文是否变化）
   */
  computeContextHash(context: AggregatedContext): string {
    const hashParts = [
      context.scene.type,
      context.time.hour.toString(),
      context.time.timeOfDay,
      context.image.topLabel,
      context.audio.topLabel,
      context.location.matchedFence || 'none',
      context.device.batteryLevel > 20 ? 'normal' : 'low',
    ];
    return hashParts.join('|');
  }

  /**
   * 获取最后聚合的上下文
   */
  getLastContext(): AggregatedContext | null {
    return this.lastContext;
  }
}

// 导出单例
export const contextAggregator = new ContextAggregator();
export default contextAggregator;
