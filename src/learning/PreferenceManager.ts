/**
 * PreferenceManager - 用户偏好管理器
 * 
 * 管理用户的场景偏好设置：
 * - 场景默认设置偏好
 * - 快捷操作偏好
 * - 通知偏好
 * - 自动化规则偏好
 * 
 * @module learning
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SceneType } from '../types';
import type { SceneSystemSettings, ActionCategory } from '../types/automation';

// ==================== 存储键 ====================

const STORAGE_KEYS = {
  USER_PREFERENCES: 'user_preferences',
  SCENE_PREFERENCES: 'scene_preferences',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  QUICK_ACTION_PREFERENCES: 'quick_action_preferences',
};

// ==================== 类型定义 ====================

/**
 * 通知偏好设置
 */
export interface NotificationPreferences {
  /** 是否启用场景通知 */
  sceneNotificationsEnabled: boolean;
  /** 是否启用主动提醒 */
  proactiveRemindersEnabled: boolean;
  /** 是否启用每日摘要 */
  dailySummaryEnabled: boolean;
  /** 每日摘要时间 (HH:mm) */
  dailySummaryTime: string;
  /** 免打扰时间段 */
  quietHours: {
    enabled: boolean;
    start: string;  // HH:mm
    end: string;    // HH:mm
  };
}

/**
 * 快捷操作偏好
 */
export interface QuickActionPreferences {
  /** 启用的操作类别 */
  enabledCategories: ActionCategory[];
  /** 收藏的快捷操作 ID */
  favoriteActions: string[];
  /** 隐藏的快捷操作 ID */
  hiddenActions: string[];
  /** 最大显示数量 */
  maxDisplayCount: number;
  /** 布局模式 */
  layoutMode: 'grid' | 'list' | 'compact';
}

/**
 * 场景偏好设置
 */
export interface ScenePreferences {
  /** 场景系统设置 */
  settings: Partial<SceneSystemSettings>;
  /** 是否启用自动化 */
  automationEnabled: boolean;
  /** 自定义快捷操作 ID 列表 */
  quickActions: string[];
  /** 是否需要确认执行 */
  requireConfirmation: boolean;
}

/**
 * 用户全局偏好
 */
export interface UserPreferences {
  /** 是否首次使用 */
  isFirstTime: boolean;
  /** 是否启用数据收集 */
  dataCollectionEnabled: boolean;
  /** 是否启用学习功能 */
  learningEnabled: boolean;
  /** 主题模式 */
  themeMode: 'light' | 'dark' | 'system';
  /** 语言 */
  language: string;
  /** 上次更新时间 */
  lastUpdated: number;
  /** 家庭地址 */
  homeAddress?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  /** 公司地址 */
  workAddress?: {
    name: string;
    latitude: number;
    longitude: number;
  };
}

/**
 * 完整偏好数据结构
 */
interface PreferencesStore {
  user: UserPreferences;
  scenes: Partial<Record<SceneType, ScenePreferences>>;
  notifications: NotificationPreferences;
  quickActions: QuickActionPreferences;
}

// ==================== 默认配置 ====================

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  isFirstTime: true,
  dataCollectionEnabled: true,
  learningEnabled: true,
  themeMode: 'system',
  language: 'zh-CN',
  lastUpdated: Date.now(),
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  sceneNotificationsEnabled: true,
  proactiveRemindersEnabled: true,
  dailySummaryEnabled: false,
  dailySummaryTime: '21:00',
  quietHours: {
    enabled: false,
    start: '23:00',
    end: '07:00',
  },
};

const DEFAULT_QUICK_ACTION_PREFERENCES: QuickActionPreferences = {
  enabledCategories: ['payment', 'navigation', 'communication', 'system'],
  favoriteActions: [],
  hiddenActions: [],
  maxDisplayCount: 6,
  layoutMode: 'grid',
};

const DEFAULT_SCENE_PREFERENCES: ScenePreferences = {
  settings: {},
  automationEnabled: true,
  quickActions: [],
  requireConfirmation: true,
};

// ==================== PreferenceManager 类 ====================

export class PreferenceManager {
  private preferences: PreferencesStore;
  private initialized: boolean = false;

  constructor() {
    this.preferences = {
      user: { ...DEFAULT_USER_PREFERENCES },
      scenes: {},
      notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      quickActions: { ...DEFAULT_QUICK_ACTION_PREFERENCES },
    };
  }

  /**
   * 初始化偏好管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadPreferences();
      this.initialized = true;
      console.log('[PreferenceManager] Initialized');
    } catch (error) {
      console.error('[PreferenceManager] Failed to initialize:', error);
    }
  }

  /**
   * 从存储加载偏好
   */
  private async loadPreferences(): Promise<void> {
    try {
      const [userPref, scenePref, notifPref, quickPref] = await AsyncStorage.multiGet([
        STORAGE_KEYS.USER_PREFERENCES,
        STORAGE_KEYS.SCENE_PREFERENCES,
        STORAGE_KEYS.NOTIFICATION_PREFERENCES,
        STORAGE_KEYS.QUICK_ACTION_PREFERENCES,
      ]);

      if (userPref[1]) {
        this.preferences.user = { ...DEFAULT_USER_PREFERENCES, ...JSON.parse(userPref[1]) };
      }
      if (scenePref[1]) {
        this.preferences.scenes = JSON.parse(scenePref[1]);
      }
      if (notifPref[1]) {
        this.preferences.notifications = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(notifPref[1]) };
      }
      if (quickPref[1]) {
        this.preferences.quickActions = { ...DEFAULT_QUICK_ACTION_PREFERENCES, ...JSON.parse(quickPref[1]) };
      }
    } catch (error) {
      console.error('[PreferenceManager] Failed to load preferences:', error);
    }
  }

  /**
   * 保存偏好到存储
   */
  private async savePreferences(): Promise<void> {
    try {
      this.preferences.user.lastUpdated = Date.now();
      
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(this.preferences.user)],
        [STORAGE_KEYS.SCENE_PREFERENCES, JSON.stringify(this.preferences.scenes)],
        [STORAGE_KEYS.NOTIFICATION_PREFERENCES, JSON.stringify(this.preferences.notifications)],
        [STORAGE_KEYS.QUICK_ACTION_PREFERENCES, JSON.stringify(this.preferences.quickActions)],
      ]);
    } catch (error) {
      console.error('[PreferenceManager] Failed to save preferences:', error);
    }
  }

  // ==================== 用户偏好 ====================

  /**
   * 获取用户全局偏好
   */
  getUserPreferences(): UserPreferences {
    return { ...this.preferences.user };
  }

  /**
   * 更新用户全局偏好
   */
  async updateUserPreferences(updates: Partial<UserPreferences>): Promise<void> {
    await this.initialize();
    this.preferences.user = { ...this.preferences.user, ...updates };
    await this.savePreferences();
  }

  /**
   * 标记非首次使用
   */
  async markNotFirstTime(): Promise<void> {
    await this.updateUserPreferences({ isFirstTime: false });
  }

  // ==================== 地址管理 ====================

  /**
   * 设置家庭地址
   */
  async setHomeAddress(name: string, latitude: number, longitude: number): Promise<void> {
    await this.updateUserPreferences({
      homeAddress: { name, latitude, longitude }
    });
    console.log('[PreferenceManager] Home address set:', name);
  }

  /**
   * 设置公司地址
   */
  async setWorkAddress(name: string, latitude: number, longitude: number): Promise<void> {
    await this.updateUserPreferences({
      workAddress: { name, latitude, longitude }
    });
    console.log('[PreferenceManager] Work address set:', name);
  }

  /**
   * 获取家庭地址
   */
  getHomeAddress(): { name: string; latitude: number; longitude: number } | undefined {
    return this.preferences.user.homeAddress;
  }

  /**
   * 获取公司地址
   */
  getWorkAddress(): { name: string; latitude: number; longitude: number } | undefined {
    return this.preferences.user.workAddress;
  }

  /**
   * 检查是否已设置地址
   */
  hasAddressConfigured(type: 'home' | 'work'): boolean {
    const address = type === 'home' 
      ? this.preferences.user.homeAddress 
      : this.preferences.user.workAddress;
    return !!address && !!address.latitude && !!address.longitude;
  }

  // ==================== 场景偏好 ====================

  /**
   * 获取场景偏好设置
   */
  getScenePreferences(sceneType: SceneType): ScenePreferences {
    return this.preferences.scenes[sceneType] || { ...DEFAULT_SCENE_PREFERENCES };
  }

  /**
   * 更新场景偏好设置
   */
  async updateScenePreferences(
    sceneType: SceneType,
    updates: Partial<ScenePreferences>
  ): Promise<void> {
    await this.initialize();
    
    const current = this.getScenePreferences(sceneType);
    this.preferences.scenes[sceneType] = { ...current, ...updates };
    await this.savePreferences();
    
    console.log(`[PreferenceManager] Updated ${sceneType} preferences`);
  }

  /**
   * 更新场景系统设置
   */
  async updateSceneSettings(
    sceneType: SceneType,
    settings: Partial<SceneSystemSettings>
  ): Promise<void> {
    await this.initialize();
    
    const current = this.getScenePreferences(sceneType);
    this.preferences.scenes[sceneType] = {
      ...current,
      settings: { ...current.settings, ...settings },
    };
    await this.savePreferences();
  }

  /**
   * 设置场景自动化状态
   */
  async setSceneAutomation(sceneType: SceneType, enabled: boolean): Promise<void> {
    await this.updateScenePreferences(sceneType, { automationEnabled: enabled });
  }

  /**
   * 添加场景快捷操作
   */
  async addSceneQuickAction(sceneType: SceneType, actionId: string): Promise<void> {
    const prefs = this.getScenePreferences(sceneType);
    if (!prefs.quickActions.includes(actionId)) {
      await this.updateScenePreferences(sceneType, {
        quickActions: [...prefs.quickActions, actionId],
      });
    }
  }

  /**
   * 移除场景快捷操作
   */
  async removeSceneQuickAction(sceneType: SceneType, actionId: string): Promise<void> {
    const prefs = this.getScenePreferences(sceneType);
    await this.updateScenePreferences(sceneType, {
      quickActions: prefs.quickActions.filter(id => id !== actionId),
    });
  }

  /**
   * 获取所有场景的偏好设置
   */
  getAllScenePreferences(): Partial<Record<SceneType, ScenePreferences>> {
    return { ...this.preferences.scenes };
  }

  // ==================== 通知偏好 ====================

  /**
   * 获取通知偏好
   */
  getNotificationPreferences(): NotificationPreferences {
    return { ...this.preferences.notifications };
  }

  /**
   * 更新通知偏好
   */
  async updateNotificationPreferences(
    updates: Partial<NotificationPreferences>
  ): Promise<void> {
    await this.initialize();
    this.preferences.notifications = { ...this.preferences.notifications, ...updates };
    await this.savePreferences();
  }

  /**
   * 设置免打扰时间
   */
  async setQuietHours(start: string, end: string, enabled: boolean = true): Promise<void> {
    await this.updateNotificationPreferences({
      quietHours: { enabled, start, end },
    });
  }

  /**
   * 检查当前是否在免打扰时间
   */
  isInQuietHours(): boolean {
    const { quietHours } = this.preferences.notifications;
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { start, end } = quietHours;
    
    // 处理跨午夜的情况
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  }

  // ==================== 快捷操作偏好 ====================

  /**
   * 获取快捷操作偏好
   */
  getQuickActionPreferences(): QuickActionPreferences {
    return { ...this.preferences.quickActions };
  }

  /**
   * 更新快捷操作偏好
   */
  async updateQuickActionPreferences(
    updates: Partial<QuickActionPreferences>
  ): Promise<void> {
    await this.initialize();
    this.preferences.quickActions = { ...this.preferences.quickActions, ...updates };
    await this.savePreferences();
  }

  /**
   * 收藏快捷操作
   */
  async favoriteAction(actionId: string): Promise<void> {
    const prefs = this.getQuickActionPreferences();
    if (!prefs.favoriteActions.includes(actionId)) {
      await this.updateQuickActionPreferences({
        favoriteActions: [...prefs.favoriteActions, actionId],
        hiddenActions: prefs.hiddenActions.filter(id => id !== actionId),
      });
    }
  }

  /**
   * 取消收藏快捷操作
   */
  async unfavoriteAction(actionId: string): Promise<void> {
    const prefs = this.getQuickActionPreferences();
    await this.updateQuickActionPreferences({
      favoriteActions: prefs.favoriteActions.filter(id => id !== actionId),
    });
  }

  /**
   * 隐藏快捷操作
   */
  async hideAction(actionId: string): Promise<void> {
    const prefs = this.getQuickActionPreferences();
    if (!prefs.hiddenActions.includes(actionId)) {
      await this.updateQuickActionPreferences({
        hiddenActions: [...prefs.hiddenActions, actionId],
        favoriteActions: prefs.favoriteActions.filter(id => id !== actionId),
      });
    }
  }

  /**
   * 取消隐藏快捷操作
   */
  async unhideAction(actionId: string): Promise<void> {
    const prefs = this.getQuickActionPreferences();
    await this.updateQuickActionPreferences({
      hiddenActions: prefs.hiddenActions.filter(id => id !== actionId),
    });
  }

  /**
   * 检查操作是否被收藏
   */
  isActionFavorited(actionId: string): boolean {
    return this.preferences.quickActions.favoriteActions.includes(actionId);
  }

  /**
   * 检查操作是否被隐藏
   */
  isActionHidden(actionId: string): boolean {
    return this.preferences.quickActions.hiddenActions.includes(actionId);
  }

  // ==================== 导出与重置 ====================

  /**
   * 导出所有偏好设置
   */
  exportPreferences(): PreferencesStore {
    return JSON.parse(JSON.stringify(this.preferences));
  }

  /**
   * 导入偏好设置
   */
  async importPreferences(data: Partial<PreferencesStore>): Promise<void> {
    await this.initialize();
    
    if (data.user) {
      this.preferences.user = { ...DEFAULT_USER_PREFERENCES, ...data.user };
    }
    if (data.scenes) {
      this.preferences.scenes = data.scenes;
    }
    if (data.notifications) {
      this.preferences.notifications = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...data.notifications };
    }
    if (data.quickActions) {
      this.preferences.quickActions = { ...DEFAULT_QUICK_ACTION_PREFERENCES, ...data.quickActions };
    }
    
    await this.savePreferences();
    console.log('[PreferenceManager] Preferences imported');
  }

  /**
   * 重置所有偏好到默认值
   */
  async resetToDefaults(): Promise<void> {
    this.preferences = {
      user: { ...DEFAULT_USER_PREFERENCES },
      scenes: {},
      notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      quickActions: { ...DEFAULT_QUICK_ACTION_PREFERENCES },
    };
    await this.savePreferences();
    console.log('[PreferenceManager] Reset to defaults');
  }

  /**
   * 重置特定场景的偏好
   */
  async resetScenePreferences(sceneType: SceneType): Promise<void> {
    await this.initialize();
    delete this.preferences.scenes[sceneType];
    await this.savePreferences();
    console.log(`[PreferenceManager] Reset ${sceneType} preferences`);
  }
}

// ==================== 单例导出 ====================

export const preferenceManager = new PreferenceManager();

export default preferenceManager;
