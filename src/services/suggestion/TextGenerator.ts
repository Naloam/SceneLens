/**
 * TextGenerator - 文本生成器
 * 
 * 负责模板槽位填充，生成多样化的建议文本
 */

import type { AggregatedContext, TimeOfDayType } from './types';

/**
 * 内置槽位填充函数类型
 */
type SlotFiller = (ctx: AggregatedContext) => string;

/**
 * 星期名称
 */
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 时段问候语
 */
const TIME_GREETINGS: Record<TimeOfDayType, string[]> = {
  dawn: ['凌晨好', '天还没亮', '起得真早'],
  morning: ['早上好', '早安', '上午好'],
  noon: ['中午好', '午安'],
  afternoon: ['下午好', '午后好'],
  evening: ['傍晚好', '晚上好'],
  night: ['晚上好', '夜深了'],
  midnight: ['夜深了', '深夜好'],
};

/**
 * 内置槽位填充器
 */
const BUILT_IN_SLOT_FILLERS: Record<string, SlotFiller> = {
  // 问候语
  greeting: (ctx) => {
    const greetings = TIME_GREETINGS[ctx.time.timeOfDay] || ['您好'];
    return greetings[Math.floor(Math.random() * greetings.length)];
  },

  // 星期名称
  weekday_name: (ctx) => WEEKDAY_NAMES[ctx.time.dayOfWeek],

  // 时段描述
  time_period: (ctx) => {
    const periods: Record<TimeOfDayType, string> = {
      dawn: '凌晨',
      morning: '早晨',
      noon: '中午',
      afternoon: '下午',
      evening: '傍晚',
      night: '晚上',
      midnight: '深夜',
    };
    return periods[ctx.time.timeOfDay];
  },

  // 小时
  hour: (ctx) => ctx.time.hour.toString(),

  // 分钟（带前导零）
  minute: (ctx) => ctx.time.minute.toString().padStart(2, '0'),

  // 时间完整描述
  time_description: (ctx) => ctx.time.timeDescription,

  // 电量
  battery: (ctx) => ctx.device.batteryLevel.toString(),

  // 电量提示
  battery_hint: (ctx) => {
    const level = ctx.device.batteryLevel;
    if (ctx.device.isCharging) return '正在充电';
    if (level <= 10) return '电量极低';
    if (level <= 20) return '电量偏低';
    if (level <= 50) return '电量一般';
    return '电量充足';
  },

  // 图像标签
  image_label: (ctx) => ctx.image.topLabel || '未知环境',

  // 图像置信度
  image_confidence: (ctx) => Math.round(ctx.image.topScore * 100).toString(),

  // 具体地点
  specific_place: (ctx) => ctx.image.specificPlace || '当前位置',

  // 音频标签
  audio_label: (ctx) => ctx.audio.topLabel || '未知',

  // 音频环境描述
  audio_env_hint: (ctx) => {
    const envMap: Record<string, string> = {
      silence: '安静',
      speech: '有人交谈',
      music: '有音乐',
      traffic: '有交通声',
      nature: '自然声音',
      machinery: '有机器声',
      crowd: '嘈杂',
      indoor_quiet: '室内安静',
      outdoor_busy: '室外繁忙',
    };
    return envMap[ctx.audio.topLabel] || '正常';
  },

  // 声音环境
  sound_environment: (ctx) => {
    const envMap = {
      quiet: '安静',
      moderate: '适中',
      noisy: '嘈杂',
    };
    return envMap[ctx.audio.soundEnvironment];
  },

  // 主要声音
  dominant_sound: (ctx) => ctx.audio.dominantSound || '环境音',

  // WiFi 名称
  wifi_ssid: (ctx) => ctx.location.wifiSSID || '未连接',

  // 围栏名称
  fence_name: (ctx) => ctx.location.matchedFence || '未知位置',

  // 交通方式
  transport_mode: (ctx) => {
    const modes = {
      walking: '步行',
      vehicle: '乘车',
      still: '静止',
      unknown: '未知',
    };
    return modes[ctx.location.transportMode];
  },

  // 会议标题
  event_title: (ctx) => ctx.calendar.upcomingEvent?.title || '即将开始的会议',

  // 会议剩余时间
  minutes_until_event: (ctx) => (ctx.calendar.upcomingEvent?.minutesUntil || 0).toString(),

  // 通勤次数
  commute_count: (ctx) => ctx.user.commuteCountToday.toString(),

  // 场景置信度
  confidence: (ctx) => Math.round(ctx.scene.confidence * 100).toString(),

  // 明天类型
  tomorrow_type: (ctx) => {
    const tomorrow = (ctx.time.dayOfWeek + 1) % 7;
    return (tomorrow === 0 || tomorrow === 6) ? '周末' : '工作日';
  },

  // 明天星期几
  tomorrow_day: (ctx) => {
    const tomorrow = (ctx.time.dayOfWeek + 1) % 7;
    return `周${WEEKDAY_NAMES[tomorrow]}`;
  },

  // 环境类型
  environment_type: (ctx) => {
    const types = {
      indoor: '室内',
      outdoor: '室外',
      transport: '交通工具',
      unknown: '未知',
    };
    return types[ctx.image.environmentType];
  },

  // 时间段提示
  time_hint: (ctx) => {
    const hour = ctx.time.hour;
    if (hour >= 7 && hour < 9) return '早高峰';
    if (hour >= 17 && hour < 19) return '晚高峰';
    if (hour >= 12 && hour < 14) return '午休时间';
    if (hour >= 22 || hour < 6) return '夜间';
    return '';
  },

  // 加班提示
  overtime_hint: (ctx) => {
    const hour = ctx.time.hour;
    if (hour >= 21) return '这么晚';
    if (hour >= 20) return '到现在';
    if (hour >= 19) return '有点晚了';
    return '';
  },

  // 工作提示
  work_hint: (ctx) => {
    if (ctx.time.isWeekend) return '周末';
    if (ctx.time.hour >= 19) return '加班';
    return '工作';
  },

  // 动作提示
  action_hint: (ctx) => {
    if (ctx.scene.type === 'COMMUTE') return '出发';
    if (ctx.scene.type === 'HOME') return '回家';
    if (ctx.scene.type === 'OFFICE') return '开始工作';
    if (ctx.scene.type === 'STUDY') return '开始学习';
    if (ctx.scene.type === 'SLEEP') return '休息';
    return '行动';
  },

  // 鼓励语
  encouragement: (ctx) => {
    const phrases = [
      '加油',
      '继续保持',
      '元气满满',
      '精神饱满',
      '状态不错',
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  },

  // 天气（占位，可后续扩展）
  weather: () => '天气不错',

  // 基于上下文的建议
  context_based_suggestion: (ctx) => {
    if (ctx.device.batteryLevel <= 20) {
      return '电量较低，要不要省电模式？';
    }
    if (ctx.calendar.upcomingEvent && ctx.calendar.upcomingEvent.minutesUntil <= 30) {
      return `${ctx.calendar.upcomingEvent.minutesUntil}分钟后有会议哦`;
    }
    if (ctx.audio.soundEnvironment === 'noisy') {
      return '周围有点吵，要开启勿扰吗？';
    }
    return '一切准备就绪';
  },

  // 用户习惯提示
  user_habit: (ctx) => {
    if (ctx.user.consecutiveSceneCount >= 3) {
      return '熟悉的时间';
    }
    return '新的一天';
  },

  // 乘车提示
  transit_hint: (ctx) => {
    if (ctx.image.topLabel.includes('subway')) return '乘车码已就绪';
    if (ctx.image.topLabel.includes('bus')) return '准备好乘车码';
    return '为您准备好乘车码';
  },

  // 静坐时长（占位）
  still_duration: () => '30',

  // 屏幕使用时间（占位）
  screen_time: () => '1小时',

  // 日出时间（占位）
  sunrise_hours: () => '6',

  // 闹钟时间（占位）
  alarm_time: () => '7:00',

  // 闹钟提示
  alarm_hint: (ctx) => {
    if (ctx.time.isWeekend) return '周末可以睡个懒觉';
    return '记得设好闹钟';
  },

  // ETA（占位）
  eta: () => '约30分钟',

  // 拥挤程度（占位）
  crowdLevel: () => '适中',

  // 离开时长（占位）
  hours_away: () => '8',

  // 工作时长（占位）
  work_duration: () => '9小时',

  // 办公室总时长（占位）
  total_hours: () => '10',

  // 加班时长（占位）
  overtime_hours: () => '2',

  // 安静程度
  quiet_level: (ctx) => {
    if (ctx.audio.soundEnvironment === 'quiet') return '非常安静';
    if (ctx.audio.soundEnvironment === 'moderate') return '适中';
    return '有些嘈杂';
  },

  // 会议应用
  meeting_app: () => '腾讯会议',

  // 会议时长
  event_duration: (ctx) => (ctx.calendar.upcomingEvent?.durationMinutes || 60).toString(),

  // 会议地点
  event_location: (ctx) => ctx.calendar.upcomingEvent?.location || '线上会议',
};

/**
 * 文本生成器类
 */
export class TextGenerator {
  private customFillers: Map<string, SlotFiller> = new Map();

  /**
   * 注册自定义槽位填充器
   */
  registerFiller(name: string, filler: SlotFiller): void {
    this.customFillers.set(name, filler);
  }

  /**
   * 填充模板中的槽位
   * 
   * @param template 包含槽位的模板字符串，如 "{greeting}，今天是{weekday_name}"
   * @param ctx 聚合上下文
   * @returns 填充后的字符串
   */
  fillTemplate(template: string, ctx: AggregatedContext): string {
    // 匹配 {slotName} 格式的槽位
    return template.replace(/\{(\w+)\}/g, (match, slotName) => {
      // 优先使用自定义填充器
      const customFiller = this.customFillers.get(slotName);
      if (customFiller) {
        try {
          return customFiller(ctx);
        } catch {
          return match; // 保持原样
        }
      }

      // 使用内置填充器
      const builtInFiller = BUILT_IN_SLOT_FILLERS[slotName];
      if (builtInFiller) {
        try {
          return builtInFiller(ctx);
        } catch {
          return match; // 保持原样
        }
      }

      // 尝试从上下文直接获取（支持点号路径，如 time.hour）
      const value = this.getNestedValue(ctx, slotName);
      if (value !== undefined && value !== null) {
        return String(value);
      }

      return match; // 未知槽位保持原样
    });
  }

  /**
   * 批量填充多个模板并随机选择一个
   */
  fillAndSelectRandom(templates: string[], ctx: AggregatedContext): string {
    if (templates.length === 0) {
      return '';
    }

    // 使用真随机选择
    const randomIndex = Math.floor(Math.random() * templates.length);
    const selected = templates[randomIndex];
    
    return this.fillTemplate(selected, ctx);
  }

  /**
   * 生成多个不重复的建议文本
   */
  generateMultiple(templates: string[], ctx: AggregatedContext, count: number): string[] {
    if (templates.length === 0) {
      return [];
    }

    // 打乱模板顺序
    const shuffled = [...templates].sort(() => Math.random() - 0.5);
    
    // 取前 count 个并填充
    const results: string[] = [];
    const seen = new Set<string>();

    for (const template of shuffled) {
      if (results.length >= count) break;
      
      const filled = this.fillTemplate(template, ctx);
      if (!seen.has(filled)) {
        seen.add(filled);
        results.push(filled);
      }
    }

    return results;
  }

  /**
   * 从上下文中获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * 检查模板中的槽位是否都可以填充
   */
  validateTemplate(template: string, ctx: AggregatedContext): { valid: boolean; missingSlots: string[] } {
    const missingSlots: string[] = [];
    const slotPattern = /\{(\w+)\}/g;
    let match;

    while ((match = slotPattern.exec(template)) !== null) {
      const slotName = match[1];
      
      // 检查是否有对应的填充器
      const hasCustomFiller = this.customFillers.has(slotName);
      const hasBuiltInFiller = slotName in BUILT_IN_SLOT_FILLERS;
      const hasContextValue = this.getNestedValue(ctx, slotName) !== undefined;

      if (!hasCustomFiller && !hasBuiltInFiller && !hasContextValue) {
        missingSlots.push(slotName);
      }
    }

    return {
      valid: missingSlots.length === 0,
      missingSlots,
    };
  }

  /**
   * 获取所有可用的内置槽位名称
   */
  getAvailableSlots(): string[] {
    return [
      ...Object.keys(BUILT_IN_SLOT_FILLERS),
      ...Array.from(this.customFillers.keys()),
    ];
  }
}

// 导出单例
export const textGenerator = new TextGenerator();
export default textGenerator;
