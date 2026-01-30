/**
 * ActionReasonGenerator - 动作理由生成器
 * 
 * 为每个推荐动作生成上下文相关的理由说明
 */

import type { AppCategory } from '../../types';
import type { AggregatedContext } from './types';

/**
 * 动作类型
 */
export type ActionType = 
  | 'DND'           // 勿扰模式
  | 'BRIGHTNESS'    // 亮度调整
  | 'VOLUME'        // 音量调整
  | 'SLEEP_MODE'    // 睡眠模式
  | 'POWER_SAVE'    // 省电模式
  | 'TRANSIT_APP'   // 交通应用
  | 'MUSIC_PLAYER'  // 音乐播放
  | 'MEETING_APP'   // 会议应用
  | 'STUDY_APP'     // 学习应用
  | 'SMART_HOME'    // 智能家居
  | 'PAYMENT_APP'   // 支付应用
  | 'CALENDAR'      // 日历应用
  | 'GENERIC';      // 通用

/**
 * 理由生成函数类型
 */
type ReasonGenerator = (ctx: AggregatedContext, params?: Record<string, any>) => string;

/**
 * 勿扰模式理由生成器
 */
const DND_REASONS: Record<string, ReasonGenerator> = {
  enable_commute: (ctx) => {
    if (ctx.image.topLabel.includes('subway')) {
      return '地铁信号不稳定，开启勿扰避免漏接重要来电通知';
    }
    if (ctx.time.hour >= 7 && ctx.time.hour < 9) {
      return '早高峰通勤，专心赶路减少打扰';
    }
    if (ctx.time.hour >= 17 && ctx.time.hour < 19) {
      return '晚高峰回家，安心通勤减少打扰';
    }
    return '通勤时间，仅允许紧急联系人来电';
  },

  enable_sleep: (ctx) => {
    if (ctx.time.hour >= 23 || ctx.time.hour < 6) {
      return `现在是${ctx.time.hour}点，开启勿扰保证睡眠质量`;
    }
    return '准备休息，开启勿扰模式';
  },

  enable_meeting: (ctx) => {
    if (ctx.calendar.upcomingEvent) {
      return `"${ctx.calendar.upcomingEvent.title}"即将开始，会议期间开启勿扰`;
    }
    return '会议进行中，避免来电打断';
  },

  enable_study: (ctx) => {
    if (ctx.image.topLabel === 'library') {
      return '图书馆请保持安静，开启完全勿扰';
    }
    return '专注学习中，开启勿扰减少干扰';
  },

  enable_office: (ctx) => {
    if (ctx.audio.soundEnvironment === 'quiet') {
      return '办公环境安静，开启勿扰专注工作';
    }
    return '工作时间，仅保留重要通知';
  },

  disable_home: () => '到家了，恢复正常通知',
  
  disable_general: () => '恢复通知接收',
};

/**
 * 亮度调整理由生成器
 */
const BRIGHTNESS_REASONS: Record<string, ReasonGenerator> = {
  decrease_night: (ctx) => `夜间${ctx.time.hour}点，降低亮度保护眼睛`,
  
  decrease_battery: (ctx) => `电量仅剩${ctx.device.batteryLevel}%，降低亮度省电`,
  
  decrease_sleep: () => '准备休息，降低蓝光帮助入睡',
  
  increase_outdoor: () => '室外光线较强，适当提高亮度',
  
  auto_indoor: () => '室内环境，调整至舒适亮度',
  
  auto_general: (ctx, params) => {
    const level = params?.level || 50;
    return `调整至${level}%亮度`;
  },
};

/**
 * 音量调整理由生成器
 */
const VOLUME_REASONS: Record<string, ReasonGenerator> = {
  mute_library: () => '图书馆请保持安静，自动静音',
  
  mute_meeting: () => '会议中，避免响铃打断',
  
  decrease_night: (ctx) => `夜间${ctx.time.hour}点，调低音量`,
  
  increase_noisy: () => '周围嘈杂，适当提高音量',
  
  vibrate_commute: () => '通勤中，切换振动模式',
};

/**
 * 交通应用理由生成器
 */
const TRANSIT_APP_REASONS: Record<string, ReasonGenerator> = {
  subway: () => '检测到地铁环境，为您准备好乘车码',
  
  bus: () => '检测到公交站，打开乘车码方便乘车',
  
  morning_rush: () => '早高峰人多，快速扫码更方便',
  
  evening_rush: () => '晚高峰赶路，一键打开乘车码',
  
  general_commute: () => '通勤模式，为您准备好乘车码',
  
  transport_detected: (ctx) => `检测到您在${ctx.image.specificPlace}，方便快速进站`,
};

/**
 * 音乐应用理由生成器
 */
const MUSIC_APP_REASONS: Record<string, ReasonGenerator> = {
  noisy_environment: (ctx) => `检测到周围${ctx.audio.topLabel}，来点音乐屏蔽噪音`,
  
  commute_routine: () => '通勤路上听点什么？',
  
  morning_music: () => '早晨来点音乐开启美好一天',
  
  relax_home: () => '到家了，放点轻松的音乐',
  
  study_focus: () => '来点白噪音帮助专注',
  
  tired_evening: () => '听点轻松的音乐缓解疲惫',
  
  continue_playing: () => '检测到正在播放音乐，打开播放器控制',
};

/**
 * 会议应用理由生成器
 */
const MEETING_APP_REASONS: Record<string, ReasonGenerator> = {
  upcoming_meeting: (ctx) => {
    if (ctx.calendar.upcomingEvent) {
      return `一键打开会议应用，准备加入"${ctx.calendar.upcomingEvent.title}"`;
    }
    return '会议即将开始，打开会议应用';
  },
  
  view_details: () => '查看会议详情和议程',
  
  quick_join: () => '快速加入会议',
};

/**
 * 学习应用理由生成器
 */
const STUDY_APP_REASONS: Record<string, ReasonGenerator> = {
  library_detected: () => '检测到图书馆环境，打开学习应用',
  
  quiet_environment: () => '环境安静，适合专注学习',
  
  evening_study: () => '晚间学习时间，开启学习应用',
  
  pomodoro_start: () => '开始番茄工作法，专注25分钟',
};

/**
 * 智能家居理由生成器
 */
const SMART_HOME_REASONS: Record<string, ReasonGenerator> = {
  arrived_home: () => '已检测到家庭网络，是否启动智能家居？',
  
  home_mode: () => '一键开启回家模式',
  
  sleep_preparation: () => '准备睡觉，调整智能家居至夜间模式',
  
  leave_home: () => '离家前检查智能家居状态',
};

/**
 * 省电模式理由生成器
 */
const POWER_SAVE_REASONS: Record<string, ReasonGenerator> = {
  low_battery: (ctx) => `电量仅剩${ctx.device.batteryLevel}%，建议开启省电模式`,
  
  very_low: (ctx) => `电量极低(${ctx.device.batteryLevel}%)，立即开启省电模式`,
  
  commute_save: (ctx) => `通勤路上电量${ctx.device.batteryLevel}%，省电模式确保到家`,
  
  night_save: () => '夜间自动省电，延长待机时间',
};

/**
 * 睡眠模式理由生成器
 */
const SLEEP_MODE_REASONS: Record<string, ReasonGenerator> = {
  prepare_sleep: (ctx) => `现在是${ctx.time.hour}:${ctx.time.minute.toString().padStart(2, '0')}，建议开启睡眠模式`,
  
  late_night: () => '夜深了，一键开启睡眠模式',
  
  quiet_home: () => '家中安静，是时候休息了',
  
  complete_mode: () => '一键开启睡眠模式：勿扰+低亮度+蓝光过滤',
};

/**
 * 动作理由生成器类
 */
export class ActionReasonGenerator {
  /**
   * 根据动作类型和上下文生成理由
   */
  generateReason(
    actionType: ActionType | AppCategory,
    ctx: AggregatedContext,
    variant?: string,
    params?: Record<string, any>
  ): string {
    const key = variant || this.selectVariant(actionType, ctx);
    const generator = this.getReasonGenerator(actionType, key);
    
    if (generator) {
      try {
        return generator(ctx, params);
      } catch {
        return this.getDefaultReason(actionType);
      }
    }
    
    return this.getDefaultReason(actionType);
  }

  /**
   * 获取理由生成器
   */
  private getReasonGenerator(
    actionType: ActionType | AppCategory,
    key: string
  ): ReasonGenerator | undefined {
    const generatorMaps: Record<string, Record<string, ReasonGenerator>> = {
      DND: DND_REASONS,
      BRIGHTNESS: BRIGHTNESS_REASONS,
      VOLUME: VOLUME_REASONS,
      TRANSIT_APP: TRANSIT_APP_REASONS,
      MUSIC_PLAYER: MUSIC_APP_REASONS,
      MEETING_APP: MEETING_APP_REASONS,
      STUDY_APP: STUDY_APP_REASONS,
      SMART_HOME: SMART_HOME_REASONS,
      POWER_SAVE: POWER_SAVE_REASONS,
      SLEEP_MODE: SLEEP_MODE_REASONS,
    };

    const map = generatorMaps[actionType];
    return map?.[key];
  }

  /**
   * 根据上下文自动选择理由变体
   */
  private selectVariant(actionType: ActionType | AppCategory, ctx: AggregatedContext): string {
    switch (actionType) {
      case 'DND':
        return this.selectDNDVariant(ctx);
      case 'BRIGHTNESS':
        return this.selectBrightnessVariant(ctx);
      case 'TRANSIT_APP':
        return this.selectTransitVariant(ctx);
      case 'MUSIC_PLAYER':
        return this.selectMusicVariant(ctx);
      case 'POWER_SAVE':
        return this.selectPowerSaveVariant(ctx);
      case 'SLEEP_MODE':
        return this.selectSleepModeVariant(ctx);
      default:
        return 'general';
    }
  }

  /**
   * 选择勿扰模式理由变体
   */
  private selectDNDVariant(ctx: AggregatedContext): string {
    if (ctx.scene.type === 'COMMUTE') return 'enable_commute';
    if (ctx.scene.type === 'SLEEP') return 'enable_sleep';
    if (ctx.calendar.isInMeeting || ctx.calendar.upcomingEvent) return 'enable_meeting';
    if (ctx.scene.type === 'STUDY') return 'enable_study';
    if (ctx.scene.type === 'OFFICE') return 'enable_office';
    if (ctx.scene.type === 'HOME') return 'disable_home';
    return 'disable_general';
  }

  /**
   * 选择亮度理由变体
   */
  private selectBrightnessVariant(ctx: AggregatedContext): string {
    if (ctx.time.timeOfDay === 'night' || ctx.time.timeOfDay === 'midnight') return 'decrease_night';
    if (ctx.device.batteryLevel <= 20) return 'decrease_battery';
    if (ctx.scene.type === 'SLEEP') return 'decrease_sleep';
    if (ctx.image.environmentType === 'outdoor') return 'increase_outdoor';
    if (ctx.image.environmentType === 'indoor') return 'auto_indoor';
    return 'auto_general';
  }

  /**
   * 选择交通应用理由变体
   */
  private selectTransitVariant(ctx: AggregatedContext): string {
    if (ctx.image.topLabel.includes('subway')) return 'subway';
    if (ctx.image.topLabel.includes('bus')) return 'bus';
    if (ctx.time.hour >= 7 && ctx.time.hour < 9) return 'morning_rush';
    if (ctx.time.hour >= 17 && ctx.time.hour < 19) return 'evening_rush';
    if (ctx.image.environmentType === 'transport') return 'transport_detected';
    return 'general_commute';
  }

  /**
   * 选择音乐应用理由变体
   */
  private selectMusicVariant(ctx: AggregatedContext): string {
    if (ctx.audio.topLabel === 'music') return 'continue_playing';
    if (ctx.audio.soundEnvironment === 'noisy') return 'noisy_environment';
    if (ctx.scene.type === 'COMMUTE') return 'commute_routine';
    if (ctx.scene.type === 'HOME' && ctx.time.timeOfDay === 'evening') return 'relax_home';
    if (ctx.scene.type === 'STUDY') return 'study_focus';
    if (ctx.time.hour >= 19) return 'tired_evening';
    if (ctx.time.timeOfDay === 'morning') return 'morning_music';
    return 'commute_routine';
  }

  /**
   * 选择省电模式理由变体
   */
  private selectPowerSaveVariant(ctx: AggregatedContext): string {
    if (ctx.device.batteryLevel <= 10) return 'very_low';
    if (ctx.device.batteryLevel <= 20) return 'low_battery';
    if (ctx.scene.type === 'COMMUTE' && ctx.device.batteryLevel <= 30) return 'commute_save';
    if (ctx.time.timeOfDay === 'night') return 'night_save';
    return 'low_battery';
  }

  /**
   * 选择睡眠模式理由变体
   */
  private selectSleepModeVariant(ctx: AggregatedContext): string {
    if (ctx.time.hour >= 23 || ctx.time.hour < 2) return 'late_night';
    if (ctx.audio.soundEnvironment === 'quiet' && ctx.location.matchedFence === '家') return 'quiet_home';
    return 'prepare_sleep';
  }

  /**
   * 获取默认理由
   */
  private getDefaultReason(actionType: ActionType | AppCategory): string {
    const defaults: Record<string, string> = {
      DND: '减少不必要的打扰',
      BRIGHTNESS: '调整屏幕亮度',
      VOLUME: '调整音量',
      TRANSIT_APP: '打开乘车码',
      MUSIC_PLAYER: '播放音乐',
      MEETING_APP: '打开会议应用',
      STUDY_APP: '开始学习',
      SMART_HOME: '控制智能家居',
      PAYMENT_APP: '打开支付应用',
      CALENDAR: '查看日历',
      POWER_SAVE: '开启省电模式',
      SLEEP_MODE: '开启睡眠模式',
      GENERIC: '执行操作',
    };
    return defaults[actionType] || '推荐操作';
  }

  /**
   * 为一组动作批量生成理由
   */
  generateReasonsForActions(
    actions: Array<{ type: ActionType | AppCategory; params?: Record<string, any> }>,
    ctx: AggregatedContext
  ): string[] {
    return actions.map(action => this.generateReason(action.type, ctx, undefined, action.params));
  }

  /**
   * 从模板列表中随机选择一个理由
   */
  selectRandomReason(reasons: string[], ctx: AggregatedContext): string {
    if (reasons.length === 0) {
      return '推荐操作';
    }
    
    // 使用真随机
    const randomIndex = Math.floor(Math.random() * reasons.length);
    const template = reasons[randomIndex];
    
    // 如果模板中包含槽位，进行填充
    return this.fillReasonTemplate(template, ctx);
  }

  /**
   * 填充理由模板中的槽位
   */
  private fillReasonTemplate(template: string, ctx: AggregatedContext): string {
    return template
      .replace(/\{battery\}/g, ctx.device.batteryLevel.toString())
      .replace(/\{hour\}/g, ctx.time.hour.toString())
      .replace(/\{minute\}/g, ctx.time.minute.toString().padStart(2, '0'))
      .replace(/\{audio_label\}/g, ctx.audio.topLabel || '环境音')
      .replace(/\{image_label\}/g, ctx.image.topLabel || '当前位置')
      .replace(/\{specific_place\}/g, ctx.image.specificPlace || '当前位置')
      .replace(/\{event_title\}/g, ctx.calendar.upcomingEvent?.title || '会议')
      .replace(/\{minutes\}/g, (ctx.calendar.upcomingEvent?.minutesUntil || 0).toString());
  }
}

// 导出单例
export const actionReasonGenerator = new ActionReasonGenerator();
export default actionReasonGenerator;
