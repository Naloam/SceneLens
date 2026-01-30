/**
 * NaturalLanguageParser.ts
 * 自然语言规则解析器 - 将自然语言描述转换为规则条件和动作
 * 
 * 功能：
 * 1. 解析中文自然语言规则描述
 * 2. 提取场景触发条件
 * 3. 提取执行动作
 * 4. 生成 RuleBuilder 兼容的配置
 * 5. 提供输入建议和智能补全
 */

import { RuleBuilder, ConditionInput, ActionInput } from './engine/RuleBuilder';
import type { AutomationRule } from '../types/automation';

// ==================== 类型定义 ====================

/**
 * NL 解析条件类型 (扩展了 AutomationConditionType)
 */
export type NLConditionType = 
  | 'scene'
  | 'time'
  | 'timeRange'
  | 'weekday'
  | 'activity'
  | 'connectivity'
  | 'battery'
  | 'location';

/**
 * NL 解析动作类型 (扩展了 AutomationActionType)
 */
export type NLActionType =
  | 'setVolume'
  | 'setBrightness'
  | 'setDND'
  | 'setWiFi'
  | 'setBluetooth'
  | 'openApp'
  | 'sendNotification'
  | 'system_setting';

/**
 * 解析结果
 */
export interface ParseResult {
  /** 是否解析成功 */
  success: boolean;
  /** 解析置信度 0-1 */
  confidence: number;
  /** 识别的条件列表 */
  conditions: ParsedCondition[];
  /** 识别的动作列表 */
  actions: ParsedAction[];
  /** 生成的规则名称 */
  ruleName: string;
  /** 解析说明 */
  explanation: string;
  /** 原始输入 */
  originalInput: string;
  /** 未识别的部分 */
  unrecognizedParts: string[];
  /** 建议改进 */
  suggestions: string[];
}

/**
 * 解析出的条件
 */
export interface ParsedCondition {
  type: NLConditionType;
  params: Record<string, any>;
  matchedText: string;
  confidence: number;
}

/**
 * 解析出的动作
 */
export interface ParsedAction {
  type: NLActionType;
  params: Record<string, any>;
  matchedText: string;
  confidence: number;
}

/**
 * 输入建议
 */
export interface InputSuggestion {
  text: string;
  description: string;
  category: 'condition' | 'action' | 'template';
  example: string;
}

/**
 * 词汇映射配置
 */
interface VocabularyMapping {
  patterns: RegExp[];
  type: string;
  extractor: (match: RegExpMatchArray, fullText: string) => Record<string, any>;
  confidence: number;
}

// ==================== 词汇表 ====================

/**
 * 场景词汇
 */
const SCENE_VOCABULARY: Record<string, string[]> = {
  home: ['家', '家里', '到家', '回家', '家中', '住宅', '住所'],
  work: ['公司', '办公室', '工作', '上班', '单位', '写字楼'],
  commute: ['通勤', '上下班', '路上', '途中', '交通'],
  outdoor: ['户外', '外面', '室外', '出门'],
  sleeping: ['睡觉', '睡眠', '休息', '入睡', '就寝', '晚安'],
  meeting: ['会议', '开会', '会议室'],
  driving: ['开车', '驾驶', '驾车', '行驶'],
  exercise: ['运动', '健身', '锻炼', '跑步', '游泳'],
  dining: ['吃饭', '用餐', '餐厅', '饭店'],
  shopping: ['购物', '逛街', '商场', '超市'],
  entertainment: ['娱乐', '看电影', '电影院', '游戏'],
};

/**
 * 时间词汇
 */
const TIME_VOCABULARY: Record<string, { hour: number; minute: number } | 'range'> = {
  '早上': { hour: 7, minute: 0 },
  '早晨': { hour: 7, minute: 0 },
  '上午': { hour: 9, minute: 0 },
  '中午': { hour: 12, minute: 0 },
  '下午': { hour: 14, minute: 0 },
  '傍晚': { hour: 18, minute: 0 },
  '晚上': { hour: 20, minute: 0 },
  '夜里': { hour: 22, minute: 0 },
  '深夜': { hour: 23, minute: 0 },
  '凌晨': { hour: 2, minute: 0 },
};

/**
 * 星期词汇
 */
const WEEKDAY_VOCABULARY: Record<string, number[]> = {
  '周一': [1],
  '周二': [2],
  '周三': [3],
  '周四': [4],
  '周五': [5],
  '周六': [6],
  '周日': [0],
  '星期一': [1],
  '星期二': [2],
  '星期三': [3],
  '星期四': [4],
  '星期五': [5],
  '星期六': [6],
  '星期日': [0],
  '星期天': [0],
  '工作日': [1, 2, 3, 4, 5],
  '周末': [0, 6],
  '每天': [0, 1, 2, 3, 4, 5, 6],
  '每日': [0, 1, 2, 3, 4, 5, 6],
};

/**
 * 动作词汇
 */
const ACTION_VOCABULARY = {
  // 音量控制
  volume: {
    mute: ['静音', '关闭声音', '关掉声音', '无声'],
    low: ['小声', '低音量', '调低音量', '降低音量'],
    medium: ['中等音量', '正常音量'],
    high: ['大声', '高音量', '调高音量'],
  },
  // 亮度控制
  brightness: {
    low: ['降低亮度', '调暗', '暗一点', '低亮度'],
    medium: ['正常亮度', '中等亮度'],
    high: ['调亮', '亮一点', '高亮度', '最亮'],
    auto: ['自动亮度', '自适应亮度'],
  },
  // 勿扰模式
  dnd: {
    enable: ['勿扰', '勿扰模式', '免打扰', '请勿打扰', '开启勿扰'],
    disable: ['关闭勿扰', '取消勿扰'],
  },
  // WiFi
  wifi: {
    enable: ['打开WiFi', '开启WiFi', '连接WiFi', '打开无线'],
    disable: ['关闭WiFi', '断开WiFi', '关掉无线'],
  },
  // 蓝牙
  bluetooth: {
    enable: ['打开蓝牙', '开启蓝牙', '连接蓝牙'],
    disable: ['关闭蓝牙', '断开蓝牙'],
  },
  // 应用操作
  app: {
    open: ['打开', '启动', '开启', '运行'],
    close: ['关闭', '退出', '停止'],
  },
};

/**
 * 应用名称映射
 */
const APP_NAME_MAPPING: Record<string, string> = {
  '微信': 'com.tencent.mm',
  '支付宝': 'com.eg.android.AlipayGphone',
  '抖音': 'com.ss.android.ugc.aweme',
  '淘宝': 'com.taobao.taobao',
  '高德地图': 'com.autonavi.minimap',
  '百度地图': 'com.baidu.BaiduMap',
  '网易云音乐': 'com.netease.cloudmusic',
  'QQ音乐': 'com.tencent.qqmusic',
  '喜马拉雅': 'com.ximalaya.ting.android',
  '钉钉': 'com.alibaba.android.rimet',
  '企业微信': 'com.tencent.wework',
  '飞书': 'com.ss.android.lark',
  '美团': 'com.sankuai.meituan',
  '饿了么': 'me.ele',
  '滴滴': 'com.sdu.didi.psnger',
  'B站': 'tv.danmaku.bili',
  '哔哩哔哩': 'tv.danmaku.bili',
  '知乎': 'com.zhihu.android',
  '小红书': 'com.xingin.xhs',
  '京东': 'com.jingdong.app.mall',
  '拼多多': 'com.xunmeng.pinduoduo',
  '相机': 'com.android.camera',
  '计算器': 'com.android.calculator2',
  '日历': 'com.android.calendar',
  '时钟': 'com.android.deskclock',
  '设置': 'com.android.settings',
  '浏览器': 'com.android.browser',
  '邮件': 'com.android.email',
};

// ==================== 主类实现 ====================

/**
 * 自然语言规则解析器
 */
export class NaturalLanguageParser {
  private conditionMappings: VocabularyMapping[];
  private actionMappings: VocabularyMapping[];
  private suggestionCache: Map<string, InputSuggestion[]>;

  constructor() {
    this.conditionMappings = this.initConditionMappings();
    this.actionMappings = this.initActionMappings();
    this.suggestionCache = new Map();
  }

  /**
   * 初始化条件映射
   */
  private initConditionMappings(): VocabularyMapping[] {
    const mappings: VocabularyMapping[] = [];

    // 场景条件
    for (const [scene, keywords] of Object.entries(SCENE_VOCABULARY)) {
      const pattern = new RegExp(`(在|到|进入|离开)?\\s*(${keywords.join('|')})\\s*(时|后|的时候)?`, 'i');
      mappings.push({
        patterns: [pattern],
        type: 'scene',
        extractor: (match) => ({
          scene,
          trigger: match[1] === '离开' ? 'exit' : 'enter',
        }),
        confidence: 0.9,
      });
    }

    // 时间条件 - 具体时间点
    mappings.push({
      patterns: [
        /(\d{1,2})[点时:：](\d{0,2})?/,
        /(早上|上午|中午|下午|傍晚|晚上|夜里|深夜|凌晨)\s*(\d{1,2})?[点时]?(\d{0,2})?/,
      ],
      type: 'time',
      extractor: (match, fullText) => {
        let hour = 0;
        let minute = 0;

        // 检查是否是时间词汇
        for (const [word, time] of Object.entries(TIME_VOCABULARY)) {
          if (fullText.includes(word)) {
            if (typeof time === 'object') {
              hour = time.hour;
              minute = time.minute;
            }
            break;
          }
        }

        // 解析具体数字
        const hourMatch = fullText.match(/(\d{1,2})[点时:：]/);
        if (hourMatch) {
          hour = parseInt(hourMatch[1], 10);
        }

        const minuteMatch = fullText.match(/[点时:：](\d{1,2})/);
        if (minuteMatch) {
          minute = parseInt(minuteMatch[1], 10);
        }

        // 修正上下午
        if (fullText.includes('下午') || fullText.includes('晚上')) {
          if (hour < 12) hour += 12;
        }

        return {
          hour,
          minute,
          tolerance: 5, // 默认5分钟容差
        };
      },
      confidence: 0.85,
    });

    // 时间范围条件
    mappings.push({
      patterns: [
        /从?\s*(\d{1,2})[点时]\s*到\s*(\d{1,2})[点时]/,
        /(\d{1,2})[点时]\s*[-~到至]\s*(\d{1,2})[点时]/,
      ],
      type: 'timeRange',
      extractor: (match) => ({
        startHour: parseInt(match[1], 10),
        endHour: parseInt(match[2], 10),
      }),
      confidence: 0.85,
    });

    // 星期条件
    mappings.push({
      patterns: [
        new RegExp(`(${Object.keys(WEEKDAY_VOCABULARY).join('|')})`, 'g'),
      ],
      type: 'weekday',
      extractor: (match, fullText) => {
        const days = new Set<number>();
        for (const [word, dayNums] of Object.entries(WEEKDAY_VOCABULARY)) {
          if (fullText.includes(word)) {
            dayNums.forEach(d => days.add(d));
          }
        }
        return { days: Array.from(days).sort() };
      },
      confidence: 0.9,
    });

    // 活动检测条件
    mappings.push({
      patterns: [
        /当?\s*(走路|步行|跑步|骑车|骑行|开车|驾驶|静止|不动)\s*(时|的时候)?/,
      ],
      type: 'activity',
      extractor: (match) => {
        const activityMap: Record<string, string> = {
          '走路': 'walking',
          '步行': 'walking',
          '跑步': 'running',
          '骑车': 'cycling',
          '骑行': 'cycling',
          '开车': 'driving',
          '驾驶': 'driving',
          '静止': 'still',
          '不动': 'still',
        };
        return { activity: activityMap[match[1]] || 'unknown' };
      },
      confidence: 0.85,
    });

    // 连接状态条件
    mappings.push({
      patterns: [
        /当?\s*(连接|断开|没有)\s*(WiFi|无线网|蓝牙|耳机)\s*(时|后)?/,
      ],
      type: 'connectivity',
      extractor: (match) => {
        const typeMap: Record<string, string> = {
          'WiFi': 'wifi',
          '无线网': 'wifi',
          '蓝牙': 'bluetooth',
          '耳机': 'headphones',
        };
        return {
          connectionType: typeMap[match[2]] || 'unknown',
          state: match[1] === '连接' ? 'connected' : 'disconnected',
        };
      },
      confidence: 0.85,
    });

    // 电量条件
    mappings.push({
      patterns: [
        /当?\s*电量\s*(低于|高于|超过|达到|不足)\s*(\d+)%?\s*(时)?/,
        /电量\s*(\d+)%?\s*(以下|以上)/,
      ],
      type: 'battery',
      extractor: (match) => {
        let level = parseInt(match[2] || match[1], 10);
        const isBelow = match[0].includes('低于') || match[0].includes('不足') || match[0].includes('以下');
        return {
          level,
          comparison: isBelow ? 'below' : 'above',
        };
      },
      confidence: 0.85,
    });

    return mappings;
  }

  /**
   * 初始化动作映射
   */
  private initActionMappings(): VocabularyMapping[] {
    const mappings: VocabularyMapping[] = [];

    // 音量动作
    mappings.push({
      patterns: [
        /(静音|关闭声音|调低音量|调高音量|小声|大声)/,
        /(把|将)?\s*音量\s*(调到|设为|设置为)?\s*(\d+)%?/,
        /音量\s*(\d+)%?/,
      ],
      type: 'setVolume',
      extractor: (match, fullText) => {
        // 检查是否有具体数值
        const volumeMatch = fullText.match(/音量\s*(\d+)%?/);
        if (volumeMatch) {
          return { level: parseInt(volumeMatch[1], 10) };
        }

        // 关键词映射
        if (fullText.includes('静音') || fullText.includes('关闭声音')) {
          return { level: 0 };
        }
        if (fullText.includes('小声') || fullText.includes('调低')) {
          return { level: 30 };
        }
        if (fullText.includes('大声') || fullText.includes('调高')) {
          return { level: 80 };
        }
        return { level: 50 };
      },
      confidence: 0.9,
    });

    // 亮度动作
    mappings.push({
      patterns: [
        /(调暗|调亮|降低亮度|提高亮度|自动亮度)/,
        /(把|将)?\s*亮度\s*(调到|设为|设置为)?\s*(\d+)%?/,
        /亮度\s*(\d+)%?/,
      ],
      type: 'setBrightness',
      extractor: (match, fullText) => {
        const brightnessMatch = fullText.match(/亮度\s*(\d+)%?/);
        if (brightnessMatch) {
          return { level: parseInt(brightnessMatch[1], 10) };
        }

        if (fullText.includes('调暗') || fullText.includes('降低亮度')) {
          return { level: 30 };
        }
        if (fullText.includes('调亮') || fullText.includes('提高亮度')) {
          return { level: 80 };
        }
        if (fullText.includes('自动亮度')) {
          return { auto: true };
        }
        return { level: 50 };
      },
      confidence: 0.9,
    });

    // 勿扰模式动作
    mappings.push({
      patterns: [
        /(开启|打开|启用|关闭|取消|禁用)\s*(勿扰|免打扰|请勿打扰)/,
        /(勿扰|免打扰)模式/,
      ],
      type: 'setDND',
      extractor: (match, fullText) => {
        const enable = !fullText.includes('关闭') && !fullText.includes('取消') && !fullText.includes('禁用');
        return { enable };
      },
      confidence: 0.9,
    });

    // WiFi 动作
    mappings.push({
      patterns: [
        /(打开|开启|关闭|断开)\s*(WiFi|无线网|无线)/,
        /(WiFi|无线网)\s*(打开|关闭)/,
      ],
      type: 'setWiFi',
      extractor: (match, fullText) => {
        const enable = fullText.includes('打开') || fullText.includes('开启');
        return { enable };
      },
      confidence: 0.9,
    });

    // 蓝牙动作
    mappings.push({
      patterns: [
        /(打开|开启|关闭|断开)\s*蓝牙/,
        /蓝牙\s*(打开|关闭)/,
      ],
      type: 'setBluetooth',
      extractor: (match, fullText) => {
        const enable = fullText.includes('打开') || fullText.includes('开启');
        return { enable };
      },
      confidence: 0.9,
    });

    // 打开应用动作
    mappings.push({
      patterns: [
        /(打开|启动|开启|运行)\s*(.+?)(?:应用|APP|app)?$/,
        /启动\s*(.+)/,
      ],
      type: 'openApp',
      extractor: (match, fullText) => {
        // 提取应用名
        let appName = match[2] || match[1];
        appName = appName.trim();

        // 尝试匹配已知应用
        const packageName = APP_NAME_MAPPING[appName];

        return {
          appName,
          packageName: packageName || null,
        };
      },
      confidence: 0.8,
    });

    // 发送通知动作
    mappings.push({
      patterns: [
        /(提醒|通知|推送)\s*(我)?\s*(.+)/,
        /发送\s*(通知|提醒)\s*[：:]\s*(.+)/,
      ],
      type: 'sendNotification',
      extractor: (match) => {
        return {
          title: '规则提醒',
          message: match[3] || match[2] || '规则已触发',
        };
      },
      confidence: 0.75,
    });

    return mappings;
  }

  /**
   * 解析自然语言规则描述
   */
  parse(input: string): ParseResult {
    const normalizedInput = this.normalizeInput(input);
    const conditions: ParsedCondition[] = [];
    const actions: ParsedAction[] = [];
    const unrecognizedParts: string[] = [];
    let matchedParts: string[] = [];

    // 分割条件和动作部分
    const { conditionPart, actionPart } = this.splitInputParts(normalizedInput);

    // 解析条件
    for (const mapping of this.conditionMappings) {
      for (const pattern of mapping.patterns) {
        const match = conditionPart.match(pattern);
        if (match) {
          const params = mapping.extractor(match, conditionPart);
          conditions.push({
            type: mapping.type as NLConditionType,
            params,
            matchedText: match[0],
            confidence: mapping.confidence,
          });
          matchedParts.push(match[0]);
        }
      }
    }

    // 解析动作
    for (const mapping of this.actionMappings) {
      for (const pattern of mapping.patterns) {
        const match = actionPart.match(pattern);
        if (match) {
          const params = mapping.extractor(match, actionPart);
          actions.push({
            type: mapping.type as NLActionType,
            params,
            matchedText: match[0],
            confidence: mapping.confidence,
          });
          matchedParts.push(match[0]);
        }
      }
    }

    // 找出未识别的部分
    let remainingText = normalizedInput;
    for (const part of matchedParts) {
      remainingText = remainingText.replace(part, '');
    }
    const remaining = remainingText.replace(/[，。、！？\s]+/g, ' ').trim();
    if (remaining.length > 0) {
      unrecognizedParts.push(...remaining.split(/\s+/).filter(s => s.length > 0));
    }

    // 计算整体置信度
    const allConfidences = [...conditions, ...actions].map(c => c.confidence);
    const avgConfidence = allConfidences.length > 0
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
      : 0;

    // 生成规则名称
    const ruleName = this.generateRuleName(conditions, actions);

    // 生成解释
    const explanation = this.generateExplanation(conditions, actions);

    // 生成改进建议
    const suggestions = this.generateSuggestions(conditions, actions, unrecognizedParts);

    return {
      success: conditions.length > 0 && actions.length > 0,
      confidence: avgConfidence * (unrecognizedParts.length > 0 ? 0.8 : 1),
      conditions,
      actions,
      ruleName,
      explanation,
      originalInput: input,
      unrecognizedParts,
      suggestions,
    };
  }

  /**
   * 规范化输入
   */
  private normalizeInput(input: string): string {
    return input
      .replace(/\s+/g, ' ')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .trim();
  }

  /**
   * 分割条件和动作部分
   */
  private splitInputParts(input: string): { conditionPart: string; actionPart: string } {
    // 常见的分隔词
    const separators = [
      '就', '则', '然后', '之后', '时候', '自动', '帮我', '请',
    ];

    for (const sep of separators) {
      const index = input.indexOf(sep);
      if (index !== -1) {
        return {
          conditionPart: input.substring(0, index + sep.length),
          actionPart: input.substring(index),
        };
      }
    }

    // 如果没找到分隔词，尝试用逗号分割
    const commaIndex = input.indexOf('，');
    if (commaIndex !== -1) {
      return {
        conditionPart: input.substring(0, commaIndex),
        actionPart: input.substring(commaIndex + 1),
      };
    }

    // 默认整体作为条件和动作
    return {
      conditionPart: input,
      actionPart: input,
    };
  }

  /**
   * 生成规则名称
   */
  private generateRuleName(conditions: ParsedCondition[], actions: ParsedAction[]): string {
    const conditionNames: string[] = [];
    const actionNames: string[] = [];

    for (const condition of conditions) {
      if (condition.type === 'scene') {
        const sceneNames: Record<string, string> = {
          home: '到家',
          work: '上班',
          commute: '通勤',
          sleeping: '睡眠',
          meeting: '会议',
          driving: '驾驶',
        };
        conditionNames.push(sceneNames[condition.params.scene] || condition.params.scene);
      } else if (condition.type === 'time') {
        conditionNames.push(`${condition.params.hour}点`);
      } else if (condition.type === 'weekday') {
        conditionNames.push('特定日期');
      }
    }

    for (const action of actions) {
      if (action.type === 'setVolume') {
        actionNames.push(action.params.level === 0 ? '静音' : '调节音量');
      } else if (action.type === 'setDND') {
        actionNames.push(action.params.enable ? '勿扰' : '关闭勿扰');
      } else if (action.type === 'openApp') {
        actionNames.push(`打开${action.params.appName}`);
      } else if (action.type === 'setBrightness') {
        actionNames.push('调节亮度');
      }
    }

    const conditionStr = conditionNames.length > 0 ? conditionNames.join('+') : '自定义条件';
    const actionStr = actionNames.length > 0 ? actionNames.join('+') : '自定义动作';

    return `${conditionStr}-${actionStr}`;
  }

  /**
   * 生成解释说明
   */
  private generateExplanation(conditions: ParsedCondition[], actions: ParsedAction[]): string {
    const parts: string[] = [];

    // 条件解释
    if (conditions.length > 0) {
      parts.push('当满足以下条件时：');
      for (const condition of conditions) {
        parts.push(`  - ${this.explainCondition(condition)}`);
      }
    }

    // 动作解释
    if (actions.length > 0) {
      parts.push('将执行以下操作：');
      for (const action of actions) {
        parts.push(`  - ${this.explainAction(action)}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 解释条件
   */
  private explainCondition(condition: ParsedCondition): string {
    const { type, params } = condition;

    switch (type) {
      case 'scene':
        const sceneNames: Record<string, string> = {
          home: '家',
          work: '公司',
          commute: '通勤途中',
          outdoor: '户外',
          sleeping: '睡眠状态',
          meeting: '会议中',
          driving: '驾驶中',
          exercise: '运动中',
        };
        const trigger = params.trigger === 'exit' ? '离开' : '进入/到达';
        return `${trigger}${sceneNames[params.scene] || params.scene}`;

      case 'time':
        return `时间为 ${params.hour}:${String(params.minute).padStart(2, '0')}`;

      case 'timeRange':
        return `时间在 ${params.startHour}:00 到 ${params.endHour}:00 之间`;

      case 'weekday':
        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const days = params.days.map((d: number) => dayNames[d]).join('、');
        return `日期为${days}`;

      case 'activity':
        const activityNames: Record<string, string> = {
          walking: '步行',
          running: '跑步',
          cycling: '骑行',
          driving: '驾驶',
          still: '静止',
        };
        return `检测到${activityNames[params.activity] || params.activity}活动`;

      case 'connectivity':
        const connNames: Record<string, string> = {
          wifi: 'WiFi',
          bluetooth: '蓝牙',
          headphones: '耳机',
        };
        const state = params.state === 'connected' ? '连接' : '断开';
        return `${connNames[params.connectionType] || params.connectionType}${state}`;

      case 'battery':
        return `电量${params.comparison === 'below' ? '低于' : '高于'}${params.level}%`;

      default:
        return `未知条件类型: ${type}`;
    }
  }

  /**
   * 解释动作
   */
  private explainAction(action: ParsedAction): string {
    const { type, params } = action;

    switch (type) {
      case 'setVolume':
        if (params.level === 0) return '设置为静音';
        return `设置音量为 ${params.level}%`;

      case 'setBrightness':
        if (params.auto) return '启用自动亮度';
        return `设置亮度为 ${params.level}%`;

      case 'setDND':
        return params.enable ? '开启勿扰模式' : '关闭勿扰模式';

      case 'setWiFi':
        return params.enable ? '打开 WiFi' : '关闭 WiFi';

      case 'setBluetooth':
        return params.enable ? '打开蓝牙' : '关闭蓝牙';

      case 'openApp':
        return `打开 ${params.appName}${params.packageName ? ` (${params.packageName})` : ''}`;

      case 'sendNotification':
        return `发送通知: "${params.message}"`;

      default:
        return `未知动作类型: ${type}`;
    }
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(
    conditions: ParsedCondition[],
    actions: ParsedAction[],
    unrecognizedParts: string[]
  ): string[] {
    const suggestions: string[] = [];

    if (conditions.length === 0) {
      suggestions.push('请添加触发条件，例如：到家时、晚上8点、工作日');
    }

    if (actions.length === 0) {
      suggestions.push('请添加要执行的操作，例如：静音、打开WiFi、开启勿扰');
    }

    if (unrecognizedParts.length > 0) {
      suggestions.push(`以下内容未被识别：${unrecognizedParts.join('、')}`);
    }

    // 特定场景建议
    const hasTimeCondition = conditions.some(c => c.type === 'time' || c.type === 'timeRange');
    const hasSceneCondition = conditions.some(c => c.type === 'scene');
    
    if (hasTimeCondition && !conditions.some(c => c.type === 'weekday')) {
      suggestions.push('可以添加星期条件使规则更精确，例如：工作日、周末');
    }

    if (hasSceneCondition && !actions.some(a => a.type === 'setDND' || a.type === 'setVolume')) {
      suggestions.push('场景规则通常会包含音量或勿扰设置');
    }

    return suggestions;
  }

  /**
   * 将解析结果转换为规则
   */
  toRule(parseResult: ParseResult): AutomationRule | null {
    if (!parseResult.success) {
      return null;
    }

    const builder = new RuleBuilder().name(parseResult.ruleName);

    // 添加条件
    for (const condition of parseResult.conditions) {
      const ruleCondition: ConditionInput = {
        type: condition.type as any,
        operator: 'equals',
        value: condition.params,
      };
      builder.when(ruleCondition);
    }

    // 添加动作
    for (const action of parseResult.actions) {
      const ruleAction: ActionInput = {
        type: action.type as any,
        params: action.params,
      };
      builder.then(ruleAction);
    }

    return builder.build();
  }

  /**
   * 获取输入建议
   */
  getSuggestions(partialInput: string): InputSuggestion[] {
    const cacheKey = partialInput.substring(0, 10);
    if (this.suggestionCache.has(cacheKey)) {
      return this.suggestionCache.get(cacheKey)!;
    }

    const suggestions: InputSuggestion[] = [];

    // 如果输入为空或很短，返回模板建议
    if (partialInput.length < 3) {
      suggestions.push(
        {
          text: '到家后静音',
          description: '回到家自动静音',
          category: 'template',
          example: '到家后静音',
        },
        {
          text: '工作日早上8点提醒出门',
          description: '工作日通勤提醒',
          category: 'template',
          example: '工作日早上8点提醒出门',
        },
        {
          text: '晚上10点开启勿扰',
          description: '睡眠时间勿扰',
          category: 'template',
          example: '晚上10点开启勿扰',
        },
        {
          text: '连接车载蓝牙后打开高德地图',
          description: '驾驶导航',
          category: 'template',
          example: '连接车载蓝牙后打开高德地图',
        },
      );
      return suggestions;
    }

    // 条件建议
    if (!this.hasConditionKeywords(partialInput)) {
      suggestions.push(
        {
          text: '到家后',
          description: '位置触发：回到家',
          category: 'condition',
          example: '到家后...',
        },
        {
          text: '晚上',
          description: '时间触发：晚间',
          category: 'condition',
          example: '晚上8点...',
        },
        {
          text: '工作日',
          description: '日期条件：周一到周五',
          category: 'condition',
          example: '工作日...',
        },
      );
    }

    // 动作建议
    if (this.hasConditionKeywords(partialInput) && !this.hasActionKeywords(partialInput)) {
      suggestions.push(
        {
          text: '静音',
          description: '关闭所有声音',
          category: 'action',
          example: '...静音',
        },
        {
          text: '开启勿扰',
          description: '启用勿扰模式',
          category: 'action',
          example: '...开启勿扰',
        },
        {
          text: '打开微信',
          description: '启动微信应用',
          category: 'action',
          example: '...打开微信',
        },
      );
    }

    this.suggestionCache.set(cacheKey, suggestions);
    return suggestions;
  }

  /**
   * 检查是否包含条件关键词
   */
  private hasConditionKeywords(input: string): boolean {
    const conditionKeywords = [
      '到', '在', '进入', '离开', '当', '时', '点', '早', '晚',
      '周', '工作日', '连接', '断开', '电量',
    ];
    return conditionKeywords.some(k => input.includes(k));
  }

  /**
   * 检查是否包含动作关键词
   */
  private hasActionKeywords(input: string): boolean {
    const actionKeywords = [
      '静音', '音量', '亮度', '勿扰', 'WiFi', '蓝牙',
      '打开', '关闭', '启动', '开启', '提醒', '通知',
    ];
    return actionKeywords.some(k => input.includes(k));
  }

  /**
   * 解释规则（将规则转换为自然语言描述）
   */
  explainRule(rule: AutomationRule): string {
    const parts: string[] = [];
    
    parts.push(`📋 规则名称: ${rule.name}`);
    parts.push('');
    
    // 解释条件
    parts.push('📍 触发条件:');
    for (const condition of rule.conditions) {
      const parsed: ParsedCondition = {
        type: condition.type as NLConditionType,
        params: condition as any,
        matchedText: '',
        confidence: 1,
      };
      parts.push(`   • ${this.explainCondition(parsed)}`);
    }
    
    parts.push('');
    
    // 解释动作
    parts.push('⚡ 执行动作:');
    for (const action of rule.actions) {
      const parsed: ParsedAction = {
        type: action.type as NLActionType,
        params: action.params as any,
        matchedText: '',
        confidence: 1,
      };
      parts.push(`   • ${this.explainAction(parsed)}`);
    }
    
    // 其他信息
    if (rule.cooldown) {
      const minutes = rule.cooldown;
      parts.push('');
      parts.push(`⏱️ 冷却时间: ${minutes} 分钟`);
    }
    
    if (rule.priority !== undefined) {
      parts.push(`🔢 优先级: ${rule.priority}`);
    }
    
    return parts.join('\n');
  }

  /**
   * 清除建议缓存
   */
  clearCache(): void {
    this.suggestionCache.clear();
  }
}

// ==================== 预设规则模板 ====================

/**
 * 预设自然语言规则模板
 */
export const NATURAL_LANGUAGE_TEMPLATES = [
  // 回家场景
  '到家后静音并打开WiFi',
  '回家后关闭勿扰并打开微信',
  '离开家时关闭WiFi并开启勿扰',
  
  // 上班场景
  '到公司后开启勿扰',
  '工作日早上9点到公司静音',
  '离开公司后关闭勿扰',
  
  // 睡眠场景
  '晚上10点开启勿扰并降低亮度',
  '每天晚上11点静音',
  '早上7点关闭勿扰并调高亮度',
  
  // 驾驶场景
  '连接车载蓝牙后打开高德地图',
  '开车时打开导航并调高音量',
  '断开车载蓝牙后关闭导航',
  
  // 会议场景
  '开会时静音',
  '会议期间开启勿扰',
  
  // 运动场景
  '运动时打开网易云音乐',
  '跑步时调高音量',
  
  // 电量管理
  '电量低于20%时开启省电模式',
  '电量低于10%时发送提醒',
];

// ==================== 导出默认实例 ====================

export const naturalLanguageParser = new NaturalLanguageParser();

export default NaturalLanguageParser;
