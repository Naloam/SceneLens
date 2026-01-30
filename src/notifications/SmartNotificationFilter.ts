/**
 * SmartNotificationFilter - 智能通知过滤器
 * 
 * 基于场景的智能通知过滤：
 * - 场景感知的通知策略
 * - 应用级别的通知控制
 * - 紧急程度分级过滤
 * - 静默模式管理
 * 
 * @module notifications
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SceneType } from '../types';

// ==================== 存储键 ====================

const STORAGE_KEYS = {
  FILTER_SETTINGS: 'smart_notification_filter_settings',
  APP_RULES: 'smart_notification_app_rules',
  FILTER_HISTORY: 'smart_notification_filter_history',
};

// ==================== 类型定义 ====================

/**
 * 通知紧急程度
 */
export type NotificationUrgency = 
  | 'CRITICAL'     // 紧急：来电、紧急警报
  | 'HIGH'         // 高：即时通讯、日历提醒
  | 'MEDIUM'       // 中：一般通知
  | 'LOW'          // 低：促销、订阅更新
  | 'MINIMAL';     // 最低：静默通知

/**
 * 过滤动作
 */
export type FilterAction = 
  | 'ALLOW'        // 允许
  | 'SILENT'       // 静默（不响铃/振动）
  | 'DELAY'        // 延迟
  | 'BLOCK'        // 阻止
  | 'SUMMARIZE';   // 汇总

/**
 * 应用通知规则
 */
export interface AppNotificationRule {
  /** 应用包名 */
  packageName: string;
  /** 应用名称 */
  appName?: string;
  /** 默认紧急程度 */
  defaultUrgency: NotificationUrgency;
  /** 场景特定规则 */
  sceneRules: Partial<Record<SceneType, FilterAction>>;
  /** 是否是联系人相关应用（特殊处理） */
  isContactRelated: boolean;
  /** VIP 联系人始终允许 */
  allowVipContacts: boolean;
  /** 自定义规则启用 */
  customRulesEnabled: boolean;
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 场景通知策略
 */
export interface SceneNotificationPolicy {
  /** 场景类型 */
  sceneType: SceneType;
  /** 允许的最低紧急程度 */
  minAllowedUrgency: NotificationUrgency;
  /** 静默模式 */
  silentMode: boolean;
  /** 延迟通知（分钟，0=不延迟） */
  delayMinutes: number;
  /** 汇总通知 */
  summarize: boolean;
  /** 汇总间隔（分钟） */
  summarizeInterval: number;
  /** 白名单应用 */
  whitelist: string[];
  /** 黑名单应用 */
  blacklist: string[];
  /** 允许闹钟 */
  allowAlarms: boolean;
  /** 允许定时器 */
  allowTimers: boolean;
  /** 允许提醒 */
  allowReminders: boolean;
}

/**
 * 过滤器设置
 */
export interface FilterSettings {
  /** 是否启用智能过滤 */
  enabled: boolean;
  /** 学习模式（收集数据但不过滤） */
  learningMode: boolean;
  /** 场景策略 */
  scenePolicies: Partial<Record<SceneType, SceneNotificationPolicy>>;
  /** 全局白名单应用 */
  globalWhitelist: string[];
  /** 全局黑名单应用 */
  globalBlacklist: string[];
  /** VIP 联系人列表 */
  vipContacts: string[];
  /** 紧急关键词 */
  urgentKeywords: string[];
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 通知信息
 */
export interface NotificationInfo {
  /** 通知 ID */
  id: string;
  /** 应用包名 */
  packageName: string;
  /** 标题 */
  title: string;
  /** 内容 */
  content: string;
  /** 发送者（如适用） */
  sender?: string;
  /** 时间戳 */
  timestamp: number;
  /** 是否为群组通知 */
  isGroup?: boolean;
  /** 自定义紧急程度 */
  customUrgency?: NotificationUrgency;
}

/**
 * 过滤结果
 */
export interface FilterResult {
  /** 过滤动作 */
  action: FilterAction;
  /** 原因 */
  reason: string;
  /** 判定的紧急程度 */
  urgency: NotificationUrgency;
  /** 延迟时间（分钟） */
  delayMinutes?: number;
  /** 匹配的规则 */
  matchedRule?: string;
}

/**
 * 过滤历史记录
 */
export interface FilterHistoryRecord {
  /** 记录 ID */
  id: string;
  /** 通知信息 */
  notification: NotificationInfo;
  /** 过滤结果 */
  result: FilterResult;
  /** 当时的场景 */
  scene: SceneType;
  /** 时间戳 */
  timestamp: number;
  /** 用户是否覆盖了决策 */
  userOverride?: FilterAction;
}

// ==================== 默认配置 ====================

const DEFAULT_URGENCY_MAP: Record<string, NotificationUrgency> = {
  // 通讯类 - 高优先级
  'com.tencent.mm': 'HIGH',           // 微信
  'com.tencent.mobileqq': 'HIGH',     // QQ
  'com.whatsapp': 'HIGH',
  'com.facebook.orca': 'HIGH',
  'org.telegram.messenger': 'HIGH',
  
  // 电话/短信 - 紧急
  'com.android.dialer': 'CRITICAL',
  'com.android.mms': 'HIGH',
  'com.google.android.apps.messaging': 'HIGH',
  
  // 邮件 - 中等
  'com.google.android.gm': 'MEDIUM',
  'com.microsoft.office.outlook': 'MEDIUM',
  
  // 社交媒体 - 低
  'com.instagram.android': 'LOW',
  'com.twitter.android': 'LOW',
  'com.zhihu.android': 'LOW',
  'com.sina.weibo': 'LOW',
  
  // 购物/外卖 - 中等
  'com.taobao.taobao': 'MEDIUM',
  'com.jingdong.app.mall': 'MEDIUM',
  'me.ele': 'MEDIUM',
  'com.sankuai.meituan': 'MEDIUM',
  
  // 新闻/资讯 - 最低
  'com.ss.android.article.news': 'MINIMAL',
  'com.netease.newsreader.activity': 'MINIMAL',
};

const DEFAULT_SCENE_POLICIES: Partial<Record<SceneType, SceneNotificationPolicy>> = {
  SLEEP: {
    sceneType: 'SLEEP',
    minAllowedUrgency: 'CRITICAL',
    silentMode: true,
    delayMinutes: 0,
    summarize: true,
    summarizeInterval: 60,
    whitelist: [],
    blacklist: [],
    allowAlarms: true,
    allowTimers: false,
    allowReminders: false,
  },
  STUDY: {
    sceneType: 'STUDY',
    minAllowedUrgency: 'HIGH',
    silentMode: true,
    delayMinutes: 30,
    summarize: true,
    summarizeInterval: 30,
    whitelist: [],
    blacklist: [],
    allowAlarms: true,
    allowTimers: true,
    allowReminders: true,
  },
  OFFICE: {
    sceneType: 'OFFICE',
    minAllowedUrgency: 'MEDIUM',
    silentMode: false,
    delayMinutes: 0,
    summarize: false,
    summarizeInterval: 0,
    whitelist: [],
    blacklist: [],
    allowAlarms: true,
    allowTimers: true,
    allowReminders: true,
  },
  COMMUTE: {
    sceneType: 'COMMUTE',
    minAllowedUrgency: 'LOW',
    silentMode: false,
    delayMinutes: 0,
    summarize: false,
    summarizeInterval: 0,
    whitelist: [],
    blacklist: [],
    allowAlarms: true,
    allowTimers: true,
    allowReminders: true,
  },
  HOME: {
    sceneType: 'HOME',
    minAllowedUrgency: 'MINIMAL',
    silentMode: false,
    delayMinutes: 0,
    summarize: false,
    summarizeInterval: 0,
    whitelist: [],
    blacklist: [],
    allowAlarms: true,
    allowTimers: true,
    allowReminders: true,
  },
};

const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  enabled: true,
  learningMode: true,
  scenePolicies: DEFAULT_SCENE_POLICIES,
  globalWhitelist: [],
  globalBlacklist: [],
  vipContacts: [],
  urgentKeywords: ['紧急', '急', '立即', '马上', 'urgent', 'emergency', 'asap'],
  lastUpdated: Date.now(),
};

// ==================== 辅助函数 ====================

/**
 * 紧急程度优先级
 */
const URGENCY_PRIORITY: Record<NotificationUrgency, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  MINIMAL: 1,
};

/**
 * 比较紧急程度
 */
function isUrgencyHigherOrEqual(a: NotificationUrgency, b: NotificationUrgency): boolean {
  return URGENCY_PRIORITY[a] >= URGENCY_PRIORITY[b];
}

/**
 * 生成记录 ID
 */
function generateRecordId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== SmartNotificationFilter 类 ====================

export class SmartNotificationFilter {
  private settings: FilterSettings = { ...DEFAULT_FILTER_SETTINGS };
  private appRules: Map<string, AppNotificationRule> = new Map();
  private filterHistory: FilterHistoryRecord[] = [];
  private pendingNotifications: Map<string, { notification: NotificationInfo; delayUntil: number }> = new Map();
  private initialized: boolean = false;
  private currentScene: SceneType = 'UNKNOWN';

  constructor() {}

  /**
   * 初始化过滤器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadData();
      this.initialized = true;
      console.log('[SmartNotificationFilter] Initialized');
    } catch (error) {
      console.error('[SmartNotificationFilter] Failed to initialize:', error);
    }
  }

  /**
   * 加载数据
   */
  private async loadData(): Promise<void> {
    try {
      const [settingsStr, rulesStr, historyStr] = await AsyncStorage.multiGet([
        STORAGE_KEYS.FILTER_SETTINGS,
        STORAGE_KEYS.APP_RULES,
        STORAGE_KEYS.FILTER_HISTORY,
      ]);

      if (settingsStr[1]) {
        this.settings = { ...DEFAULT_FILTER_SETTINGS, ...JSON.parse(settingsStr[1]) };
      }

      if (rulesStr[1]) {
        const rules: AppNotificationRule[] = JSON.parse(rulesStr[1]);
        this.appRules = new Map(rules.map(r => [r.packageName, r]));
      }

      if (historyStr[1]) {
        this.filterHistory = JSON.parse(historyStr[1]);
      }
    } catch (error) {
      console.error('[SmartNotificationFilter] Failed to load data:', error);
    }
  }

  /**
   * 保存数据
   */
  private async saveData(): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.FILTER_SETTINGS, JSON.stringify(this.settings)],
        [STORAGE_KEYS.APP_RULES, JSON.stringify(Array.from(this.appRules.values()))],
        [STORAGE_KEYS.FILTER_HISTORY, JSON.stringify(this.filterHistory.slice(-500))], // 保留最近500条
      ]);
    } catch (error) {
      console.error('[SmartNotificationFilter] Failed to save data:', error);
    }
  }

  /**
   * 设置当前场景
   */
  setCurrentScene(scene: SceneType): void {
    this.currentScene = scene;
    console.log(`[SmartNotificationFilter] Scene updated: ${scene}`);
  }

  /**
   * 过滤通知
   */
  async filterNotification(notification: NotificationInfo, scene?: SceneType): Promise<FilterResult> {
    await this.initialize();

    const currentScene = scene || this.currentScene;
    const urgency = this.determineUrgency(notification);
    
    let result: FilterResult;

    // 检查全局黑名单
    if (this.settings.globalBlacklist.includes(notification.packageName)) {
      result = {
        action: 'BLOCK',
        reason: '应用在全局黑名单中',
        urgency,
        matchedRule: 'global_blacklist',
      };
    }
    // 检查全局白名单
    else if (this.settings.globalWhitelist.includes(notification.packageName)) {
      result = {
        action: 'ALLOW',
        reason: '应用在全局白名单中',
        urgency,
        matchedRule: 'global_whitelist',
      };
    }
    // 检查 VIP 联系人
    else if (notification.sender && this.settings.vipContacts.includes(notification.sender)) {
      result = {
        action: 'ALLOW',
        reason: 'VIP 联系人',
        urgency: 'CRITICAL',
        matchedRule: 'vip_contact',
      };
    }
    // 检查紧急关键词
    else if (this.containsUrgentKeyword(notification)) {
      result = {
        action: 'ALLOW',
        reason: '包含紧急关键词',
        urgency: 'HIGH',
        matchedRule: 'urgent_keyword',
      };
    }
    // 应用场景策略
    else {
      result = this.applyScenePolicy(notification, urgency, currentScene);
    }

    // 记录历史
    this.recordFilterDecision(notification, result, currentScene);

    // 如果是学习模式，始终允许
    if (this.settings.learningMode && result.action !== 'ALLOW') {
      console.log(`[SmartNotificationFilter] Learning mode: would ${result.action} but allowing`);
      result = { ...result, action: 'ALLOW', reason: `(学习模式) ${result.reason}` };
    }

    return result;
  }

  /**
   * 判定通知紧急程度
   */
  private determineUrgency(notification: NotificationInfo): NotificationUrgency {
    // 如果有自定义紧急程度，使用它
    if (notification.customUrgency) {
      return notification.customUrgency;
    }

    // 检查应用规则
    const appRule = this.appRules.get(notification.packageName);
    if (appRule) {
      return appRule.defaultUrgency;
    }

    // 使用默认映射
    const defaultUrgency = DEFAULT_URGENCY_MAP[notification.packageName];
    if (defaultUrgency) {
      return defaultUrgency;
    }

    // 基于内容分析
    if (this.containsUrgentKeyword(notification)) {
      return 'HIGH';
    }

    return 'MEDIUM';
  }

  /**
   * 检查是否包含紧急关键词
   */
  private containsUrgentKeyword(notification: NotificationInfo): boolean {
    const text = `${notification.title} ${notification.content}`.toLowerCase();
    return this.settings.urgentKeywords.some(keyword => 
      text.includes(keyword.toLowerCase())
    );
  }

  /**
   * 应用场景策略
   */
  private applyScenePolicy(
    notification: NotificationInfo,
    urgency: NotificationUrgency,
    scene: SceneType
  ): FilterResult {
    const policy = this.settings.scenePolicies[scene];

    // 没有特定策略，默认允许
    if (!policy) {
      return {
        action: 'ALLOW',
        reason: '场景无特定策略',
        urgency,
      };
    }

    // 检查场景白名单
    if (policy.whitelist.includes(notification.packageName)) {
      return {
        action: 'ALLOW',
        reason: '在场景白名单中',
        urgency,
        matchedRule: `scene_${scene}_whitelist`,
      };
    }

    // 检查场景黑名单
    if (policy.blacklist.includes(notification.packageName)) {
      return {
        action: 'BLOCK',
        reason: '在场景黑名单中',
        urgency,
        matchedRule: `scene_${scene}_blacklist`,
      };
    }

    // 检查应用的场景特定规则
    const appRule = this.appRules.get(notification.packageName);
    if (appRule?.sceneRules[scene]) {
      return {
        action: appRule.sceneRules[scene]!,
        reason: '应用场景规则',
        urgency,
        matchedRule: `app_${notification.packageName}_scene_${scene}`,
      };
    }

    // 检查紧急程度是否满足
    if (!isUrgencyHigherOrEqual(urgency, policy.minAllowedUrgency)) {
      if (policy.summarize) {
        return {
          action: 'SUMMARIZE',
          reason: `紧急程度不足（${urgency} < ${policy.minAllowedUrgency}），将汇总`,
          urgency,
          matchedRule: `scene_${scene}_urgency`,
        };
      }
      return {
        action: 'BLOCK',
        reason: `紧急程度不足（${urgency} < ${policy.minAllowedUrgency}）`,
        urgency,
        matchedRule: `scene_${scene}_urgency`,
      };
    }

    // 检查是否需要延迟
    if (policy.delayMinutes > 0) {
      return {
        action: 'DELAY',
        reason: `场景策略要求延迟 ${policy.delayMinutes} 分钟`,
        urgency,
        delayMinutes: policy.delayMinutes,
        matchedRule: `scene_${scene}_delay`,
      };
    }

    // 检查静默模式
    if (policy.silentMode) {
      return {
        action: 'SILENT',
        reason: '场景处于静默模式',
        urgency,
        matchedRule: `scene_${scene}_silent`,
      };
    }

    return {
      action: 'ALLOW',
      reason: '符合场景策略',
      urgency,
    };
  }

  /**
   * 记录过滤决策
   */
  private recordFilterDecision(
    notification: NotificationInfo,
    result: FilterResult,
    scene: SceneType
  ): void {
    const record: FilterHistoryRecord = {
      id: generateRecordId(),
      notification,
      result,
      scene,
      timestamp: Date.now(),
    };

    this.filterHistory.push(record);

    // 限制历史大小
    if (this.filterHistory.length > 500) {
      this.filterHistory = this.filterHistory.slice(-500);
    }

    // 异步保存
    this.saveData().catch(console.error);
  }

  /**
   * 用户覆盖决策
   */
  async recordUserOverride(recordId: string, action: FilterAction): Promise<void> {
    const record = this.filterHistory.find(r => r.id === recordId);
    if (record) {
      record.userOverride = action;
      await this.saveData();
      console.log(`[SmartNotificationFilter] User override recorded: ${recordId} -> ${action}`);
    }
  }

  // ==================== 设置管理 ====================

  /**
   * 获取设置
   */
  getSettings(): FilterSettings {
    return { ...this.settings };
  }

  /**
   * 更新设置
   */
  async updateSettings(updates: Partial<FilterSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates, lastUpdated: Date.now() };
    await this.saveData();
    console.log('[SmartNotificationFilter] Settings updated');
  }

  /**
   * 设置场景策略
   */
  async setScenePolicy(scene: SceneType, policy: Partial<SceneNotificationPolicy>): Promise<void> {
    const existing = this.settings.scenePolicies[scene] || DEFAULT_SCENE_POLICIES[scene];
    this.settings.scenePolicies[scene] = { 
      ...existing, 
      ...policy, 
      sceneType: scene 
    } as SceneNotificationPolicy;
    await this.saveData();
  }

  /**
   * 设置应用规则
   */
  async setAppRule(rule: AppNotificationRule): Promise<void> {
    rule.lastUpdated = Date.now();
    this.appRules.set(rule.packageName, rule);
    await this.saveData();
  }

  /**
   * 删除应用规则
   */
  async removeAppRule(packageName: string): Promise<void> {
    this.appRules.delete(packageName);
    await this.saveData();
  }

  /**
   * 获取应用规则
   */
  getAppRule(packageName: string): AppNotificationRule | undefined {
    return this.appRules.get(packageName);
  }

  /**
   * 获取所有应用规则
   */
  getAllAppRules(): AppNotificationRule[] {
    return Array.from(this.appRules.values());
  }

  // ==================== 白名单/黑名单管理 ====================

  /**
   * 添加到全局白名单
   */
  async addToGlobalWhitelist(packageName: string): Promise<void> {
    if (!this.settings.globalWhitelist.includes(packageName)) {
      this.settings.globalWhitelist.push(packageName);
      // 从黑名单移除
      this.settings.globalBlacklist = this.settings.globalBlacklist.filter(p => p !== packageName);
      await this.saveData();
    }
  }

  /**
   * 添加到全局黑名单
   */
  async addToGlobalBlacklist(packageName: string): Promise<void> {
    if (!this.settings.globalBlacklist.includes(packageName)) {
      this.settings.globalBlacklist.push(packageName);
      // 从白名单移除
      this.settings.globalWhitelist = this.settings.globalWhitelist.filter(p => p !== packageName);
      await this.saveData();
    }
  }

  /**
   * 从白名单/黑名单移除
   */
  async removeFromLists(packageName: string): Promise<void> {
    this.settings.globalWhitelist = this.settings.globalWhitelist.filter(p => p !== packageName);
    this.settings.globalBlacklist = this.settings.globalBlacklist.filter(p => p !== packageName);
    await this.saveData();
  }

  // ==================== VIP 联系人管理 ====================

  /**
   * 添加 VIP 联系人
   */
  async addVipContact(contact: string): Promise<void> {
    if (!this.settings.vipContacts.includes(contact)) {
      this.settings.vipContacts.push(contact);
      await this.saveData();
    }
  }

  /**
   * 移除 VIP 联系人
   */
  async removeVipContact(contact: string): Promise<void> {
    this.settings.vipContacts = this.settings.vipContacts.filter(c => c !== contact);
    await this.saveData();
  }

  // ==================== 统计和分析 ====================

  /**
   * 获取过滤统计
   */
  getFilterStats(days: number = 7): {
    totalFiltered: number;
    byAction: Record<FilterAction, number>;
    byScene: Partial<Record<SceneType, number>>;
    byApp: Record<string, number>;
    userOverrideRate: number;
  } {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentHistory = this.filterHistory.filter(r => r.timestamp >= cutoff);

    const byAction: Record<FilterAction, number> = {
      ALLOW: 0,
      SILENT: 0,
      DELAY: 0,
      BLOCK: 0,
      SUMMARIZE: 0,
    };

    const byScene: Partial<Record<SceneType, number>> = {};
    const byApp: Record<string, number> = {};
    let overrideCount = 0;

    for (const record of recentHistory) {
      byAction[record.result.action]++;
      byScene[record.scene] = (byScene[record.scene] || 0) + 1;
      byApp[record.notification.packageName] = (byApp[record.notification.packageName] || 0) + 1;
      if (record.userOverride) {
        overrideCount++;
      }
    }

    return {
      totalFiltered: recentHistory.length,
      byAction,
      byScene,
      byApp,
      userOverrideRate: recentHistory.length > 0 ? overrideCount / recentHistory.length : 0,
    };
  }

  /**
   * 获取过滤历史
   */
  getFilterHistory(limit: number = 50): FilterHistoryRecord[] {
    return this.filterHistory.slice(-limit).reverse();
  }

  /**
   * 清除所有数据
   */
  async clearAll(): Promise<void> {
    this.settings = { ...DEFAULT_FILTER_SETTINGS };
    this.appRules.clear();
    this.filterHistory = [];
    this.pendingNotifications.clear();

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.FILTER_SETTINGS,
      STORAGE_KEYS.APP_RULES,
      STORAGE_KEYS.FILTER_HISTORY,
    ]);

    console.log('[SmartNotificationFilter] All data cleared');
  }

  // ==================== 便捷方法 ====================

  /**
   * 启用智能过滤
   */
  enable(): void {
    this.settings.enabled = true;
    this.saveData();
  }

  /**
   * 禁用智能过滤
   */
  disable(): void {
    this.settings.enabled = false;
    this.saveData();
  }

  /**
   * 启用学习模式
   */
  enableLearningMode(): void {
    this.settings.learningMode = true;
    this.saveData();
  }

  /**
   * 禁用学习模式
   */
  disableLearningMode(): void {
    this.settings.learningMode = false;
    this.saveData();
  }

  /**
   * 添加到白名单
   */
  async addToWhitelist(packageName: string): Promise<void> {
    return this.addToGlobalWhitelist(packageName);
  }

  /**
   * 添加到黑名单
   */
  async addToBlacklist(packageName: string): Promise<void> {
    return this.addToGlobalBlacklist(packageName);
  }

  /**
   * 从白名单移除
   */
  async removeFromWhitelist(packageName: string): Promise<void> {
    this.settings.globalWhitelist = this.settings.globalWhitelist.filter(p => p !== packageName);
    await this.saveData();
  }

  /**
   * 从黑名单移除
   */
  async removeFromBlacklist(packageName: string): Promise<void> {
    this.settings.globalBlacklist = this.settings.globalBlacklist.filter(p => p !== packageName);
    await this.saveData();
  }

  /**
   * 获取场景策略
   */
  getScenePolicy(scene: SceneType): SceneNotificationPolicy | undefined {
    return this.settings.scenePolicies[scene];
  }

  /**
   * 清除过滤历史
   */
  async clearHistory(): Promise<void> {
    this.filterHistory = [];
    await AsyncStorage.removeItem(STORAGE_KEYS.FILTER_HISTORY);
    console.log('[SmartNotificationFilter] History cleared');
  }

  /**
   * 获取统计数据
   */
  getStats(): NotificationFilterStats {
    const stats = this.getFilterStats(7);
    return {
      totalFiltered: stats.byAction.BLOCK + stats.byAction.SILENT + stats.byAction.DELAY + stats.byAction.SUMMARIZE,
      totalPassed: stats.byAction.ALLOW,
      filterRate: stats.totalFiltered > 0 
        ? ((stats.totalFiltered - stats.byAction.ALLOW) / stats.totalFiltered) * 100 
        : 0,
      isEnabled: this.settings.enabled,
      learningModeEnabled: this.settings.learningMode,
      blacklistCount: this.settings.globalBlacklist.length,
      whitelistCount: this.settings.globalWhitelist.length,
      vipContactsCount: this.settings.vipContacts.length,
    };
  }
}

/**
 * 通知过滤统计接口
 */
export interface NotificationFilterStats {
  totalFiltered: number;
  totalPassed: number;
  filterRate: number;
  isEnabled: boolean;
  learningModeEnabled: boolean;
  blacklistCount: number;
  whitelistCount: number;
  vipContactsCount: number;
}

/**
 * 紧急程度等级（用于UI）
 */
export type UrgencyLevel = NotificationUrgency;

// 导出单例
export const smartNotificationFilter = new SmartNotificationFilter();
export default smartNotificationFilter;
