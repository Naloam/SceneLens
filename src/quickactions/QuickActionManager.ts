/**
 * QuickActionManager - 快捷操作管理器
 * 
 * 管理和执行快捷操作，支持自定义和预设操作
 * 
 * @module quickactions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SceneType } from '../types';
import type { QuickAction, ActionCategory } from '../types/automation';
import { SystemSettingsController } from '../automation/SystemSettingsController';
import { AppLaunchController } from '../automation/AppLaunchController';
import { preferenceManager } from '../learning/PreferenceManager';
import { allPresets, getDefaultPresets } from './presets';

// ==================== 存储键 ====================

const STORAGE_KEYS = {
  QUICK_ACTIONS: 'quick_actions',
  ACTION_USAGE: 'quick_action_usage',
  USER_PREFERENCES: 'quick_action_preferences',
};

// ==================== 类型定义 ====================

/**
 * 动作使用统计
 */
interface ActionUsageStats {
  actionId: string;
  totalUsage: number;
  lastUsed: number;
  usageByScene: Record<SceneType, number>;
  usageByTime: Record<string, number>; // 时间段 -> 次数
}

/**
 * 用户偏好设置
 */
interface UserPreferences {
  favoriteActions: string[];
  hiddenActions: string[];
  sortOrder: 'usage' | 'recent' | 'alphabetical';
  maxVisibleActions: number;
}

// ==================== QuickActionManager 类 ====================

export class QuickActionManager {
  private actions: Map<string, QuickAction> = new Map();
  private usageStats: Map<string, ActionUsageStats> = new Map();
  private preferences: UserPreferences = {
    favoriteActions: [],
    hiddenActions: [],
    sortOrder: 'usage',
    maxVisibleActions: 8,
  };
  private initialized: boolean = false;

  /**
   * 初始化管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await Promise.all([
        this.loadActions(),
        this.loadUsageStats(),
        this.loadPreferences(),
      ]);
      
      // 如果没有任何动作，加载默认预设
      if (this.actions.size === 0) {
        await this.loadDefaultPresets();
      }
      
      this.initialized = true;
      console.log('[QuickActionManager] Initialized with', this.actions.size, 'actions');
    } catch (error) {
      console.error('[QuickActionManager] Failed to initialize:', error);
    }
  }

  /**
   * 加载默认预设操作
   */
  private async loadDefaultPresets(): Promise<void> {
    const defaults = getDefaultPresets();
    for (const action of defaults) {
      this.actions.set(action.id, action);
    }
    await this.saveActions();
    console.log('[QuickActionManager] Loaded', defaults.length, 'default preset actions');
  }

  /**
   * 加载所有预设操作（用于重置或首次安装）
   */
  async loadAllPresets(): Promise<void> {
    for (const action of allPresets) {
      if (!this.actions.has(action.id)) {
        this.actions.set(action.id, action);
      }
    }
    await this.saveActions();
    console.log('[QuickActionManager] Loaded all preset actions, total:', this.actions.size);
  }

  // ==================== 数据加载/保存 ====================

  private async loadActions(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.QUICK_ACTIONS);
      if (stored) {
        const actions: QuickAction[] = JSON.parse(stored);
        this.actions = new Map(actions.map(a => [a.id, a]));
      }
    } catch (error) {
      console.error('[QuickActionManager] Failed to load actions:', error);
    }
  }

  private async saveActions(): Promise<void> {
    try {
      const actions = Array.from(this.actions.values());
      await AsyncStorage.setItem(STORAGE_KEYS.QUICK_ACTIONS, JSON.stringify(actions));
    } catch (error) {
      console.error('[QuickActionManager] Failed to save actions:', error);
    }
  }

  private async loadUsageStats(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ACTION_USAGE);
      if (stored) {
        const stats: ActionUsageStats[] = JSON.parse(stored);
        this.usageStats = new Map(stats.map(s => [s.actionId, s]));
      }
    } catch (error) {
      console.error('[QuickActionManager] Failed to load usage stats:', error);
    }
  }

  private async saveUsageStats(): Promise<void> {
    try {
      const stats = Array.from(this.usageStats.values());
      await AsyncStorage.setItem(STORAGE_KEYS.ACTION_USAGE, JSON.stringify(stats));
    } catch (error) {
      console.error('[QuickActionManager] Failed to save usage stats:', error);
    }
  }

  private async loadPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      if (stored) {
        this.preferences = { ...this.preferences, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[QuickActionManager] Failed to load preferences:', error);
    }
  }

  private async savePreferences(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(this.preferences));
    } catch (error) {
      console.error('[QuickActionManager] Failed to save preferences:', error);
    }
  }

  // ==================== 动作管理 ====================

  /**
   * 注册快捷操作
   */
  async registerAction(action: QuickAction): Promise<void> {
    await this.initialize();
    this.actions.set(action.id, action);
    await this.saveActions();
    console.log('[QuickActionManager] Registered action:', action.name);
  }

  /**
   * 批量注册快捷操作
   */
  async registerActions(actions: QuickAction[]): Promise<void> {
    await this.initialize();
    for (const action of actions) {
      this.actions.set(action.id, action);
    }
    await this.saveActions();
    console.log('[QuickActionManager] Registered', actions.length, 'actions');
  }

  /**
   * 移除快捷操作
   */
  async removeAction(actionId: string): Promise<boolean> {
    await this.initialize();
    const deleted = this.actions.delete(actionId);
    if (deleted) {
      await this.saveActions();
    }
    return deleted;
  }

  /**
   * 获取所有快捷操作
   */
  async getAllActions(): Promise<QuickAction[]> {
    await this.initialize();
    return Array.from(this.actions.values());
  }

  /**
   * 获取单个快捷操作
   */
  async getAction(actionId: string): Promise<QuickAction | undefined> {
    await this.initialize();
    return this.actions.get(actionId);
  }

  /**
   * 按类别获取快捷操作
   */
  async getActionsByCategory(category: ActionCategory): Promise<QuickAction[]> {
    await this.initialize();
    return Array.from(this.actions.values()).filter(a => a.category === category);
  }

  /**
   * 启用/禁用快捷操作
   */
  async setActionEnabled(actionId: string, enabled: boolean): Promise<boolean> {
    const action = this.actions.get(actionId);
    if (action) {
      action.enabled = enabled;
      await this.saveActions();
      return true;
    }
    return false;
  }

  // ==================== 动作执行 ====================

  /**
   * 执行快捷操作
   */
  async executeAction(actionId: string, currentScene?: SceneType): Promise<boolean> {
    await this.initialize();

    const action = this.actions.get(actionId);
    if (!action) {
      console.error('[QuickActionManager] Action not found:', actionId);
      return false;
    }

    if (!action.enabled) {
      console.warn('[QuickActionManager] Action is disabled:', actionId);
      return false;
    }

    console.log('[QuickActionManager] Executing action:', action.name);

    try {
      // 执行动作
      await this.performAction(action);

      // 更新使用统计
      this.updateUsageStats(actionId, currentScene);

      return true;
    } catch (error) {
      console.error('[QuickActionManager] Failed to execute action:', error);
      return false;
    }
  }

  /**
   * 执行动作的具体实现
   */
  private async performAction(action: QuickAction): Promise<void> {
    const { actionType, actionParams } = action;

    switch (actionType) {
      case 'system_setting':
        await this.performSystemSettingAction(actionParams);
        break;
      
      case 'app_launch':
        await this.performAppLaunchAction(actionParams);
        break;
      
      case 'deep_link':
        await this.performDeepLinkAction(actionParams);
        break;
      
      case 'composite':
        await this.performCompositeAction(actionParams);
        break;
      
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  private async performSystemSettingAction(params: Record<string, unknown>): Promise<void> {
    const { setting, value } = params;

    switch (setting) {
      case 'volume':
        if (typeof value === 'object') {
          await SystemSettingsController.setVolumes(value as Record<string, number>);
        }
        break;
      
      case 'brightness':
        if (typeof value === 'number') {
          await SystemSettingsController.setBrightness(value);
        }
        break;
      
      case 'doNotDisturb':
        if (typeof value === 'boolean') {
          await SystemSettingsController.setDoNotDisturb(value);
        } else if (typeof value === 'string') {
          await SystemSettingsController.setDoNotDisturb(true, value as 'priority' | 'alarms' | 'none');
        }
        break;
      
      case 'wifi':
        if (typeof value === 'boolean') {
          await SystemSettingsController.setWiFi(value);
        }
        break;
      
      case 'bluetooth':
        if (typeof value === 'boolean') {
          await SystemSettingsController.setBluetooth(value);
        }
        break;
    }
  }

  private async performAppLaunchAction(params: Record<string, unknown>): Promise<void> {
    const { packageName, deepLink } = params;
    
    if (typeof packageName !== 'string') {
      throw new Error('Package name is required');
    }

    if (deepLink && typeof deepLink === 'string') {
      await AppLaunchController.launchAppWithDeepLink(packageName, deepLink);
    } else {
      await AppLaunchController.launchApp(packageName);
    }
  }

  private async performDeepLinkAction(params: Record<string, unknown>): Promise<void> {
    const { shortcutId, uri } = params;
    
    // 检查是否为导航操作，如果是则动态构建带坐标的 URI
    const finalUri = await this.buildNavigationUri(shortcutId as string, uri as string);
    
    if (finalUri) {
      await AppLaunchController.openDeepLink(finalUri);
    } else if (shortcutId && typeof shortcutId === 'string') {
      await AppLaunchController.launchShortcut(shortcutId);
    } else if (uri && typeof uri === 'string') {
      await AppLaunchController.openDeepLink(uri);
    } else {
      throw new Error('Shortcut ID or URI is required');
    }
  }

  /**
   * 为导航操作构建带坐标的 URI
   * 如果用户设置了家庭/公司地址，使用实际坐标
   */
  private async buildNavigationUri(shortcutId?: string, fallbackUri?: string): Promise<string | null> {
    await preferenceManager.initialize();

    // 检查是否为回家导航
    if (shortcutId === 'amap_home' || fallbackUri?.includes('dname=家')) {
      const homeAddress = preferenceManager.getHomeAddress();
      if (homeAddress && homeAddress.latitude && homeAddress.longitude) {
        // 使用实际坐标构建 URI
        return `androidamap://route?sourceApplication=SceneLens&sname=我的位置&dlat=${homeAddress.latitude}&dlon=${homeAddress.longitude}&dname=${encodeURIComponent(homeAddress.name || '家')}&dev=0&t=0`;
      }
      console.log('[QuickActionManager] Home address not configured, using fallback URI');
    }

    // 检查是否为去公司导航
    if (shortcutId === 'amap_work' || shortcutId === 'amap_office' || fallbackUri?.includes('dname=公司')) {
      const workAddress = preferenceManager.getWorkAddress();
      if (workAddress && workAddress.latitude && workAddress.longitude) {
        return `androidamap://route?sourceApplication=SceneLens&sname=我的位置&dlat=${workAddress.latitude}&dlon=${workAddress.longitude}&dname=${encodeURIComponent(workAddress.name || '公司')}&dev=0&t=0`;
      }
      console.log('[QuickActionManager] Work address not configured, using fallback URI');
    }

    // 不是导航操作或没有配置地址，返回 null 使用默认处理
    return null;
  }

  private async performCompositeAction(params: Record<string, unknown>): Promise<void> {
    const { steps } = params;
    
    if (!Array.isArray(steps)) {
      throw new Error('Steps array is required for composite action');
    }

    for (const step of steps) {
      const { type, params: stepParams, delay } = step as {
        type: string;
        params: Record<string, unknown>;
        delay?: number;
      };

      switch (type) {
        case 'system_setting':
          await this.performSystemSettingAction(stepParams);
          break;
        case 'app_launch':
          await this.performAppLaunchAction(stepParams);
          break;
        case 'deep_link':
          await this.performDeepLinkAction(stepParams);
          break;
      }

      if (delay && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // ==================== 使用统计 ====================

  private updateUsageStats(actionId: string, currentScene?: SceneType): void {
    const stats = this.usageStats.get(actionId) || {
      actionId,
      totalUsage: 0,
      lastUsed: 0,
      usageByScene: {} as Record<SceneType, number>,
      usageByTime: {},
    };

    stats.totalUsage++;
    stats.lastUsed = Date.now();

    // 按场景统计
    if (currentScene) {
      stats.usageByScene[currentScene] = (stats.usageByScene[currentScene] || 0) + 1;
    }

    // 按时间段统计
    const hour = new Date().getHours();
    const timeSlot = this.getTimeSlot(hour);
    stats.usageByTime[timeSlot] = (stats.usageByTime[timeSlot] || 0) + 1;

    this.usageStats.set(actionId, stats);
    this.saveUsageStats();
  }

  private getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 9) return 'early_morning';
    if (hour >= 9 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 14) return 'lunch';
    if (hour >= 14 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 21) return 'evening';
    if (hour >= 21 || hour < 6) return 'night';
    return 'unknown';
  }

  // ==================== 智能推荐 ====================

  /**
   * 获取推荐的快捷操作
   */
  async getRecommendedActions(
    currentScene: SceneType,
    limit: number = 4
  ): Promise<QuickAction[]> {
    await this.initialize();

    const enabledActions = Array.from(this.actions.values())
      .filter(a => a.enabled && !this.preferences.hiddenActions.includes(a.id));

    // 优先显示收藏的动作
    const favorites = enabledActions.filter(a => 
      this.preferences.favoriteActions.includes(a.id)
    );

    // 根据场景和使用频率排序
    const scored = enabledActions
      .filter(a => !this.preferences.favoriteActions.includes(a.id))
      .map(action => {
        const stats = this.usageStats.get(action.id);
        let score = 0;

        // 场景相关性
        if (action.contextTriggers?.scenes.includes(currentScene)) {
          score += 10;
        }

        // 使用频率
        if (stats) {
          score += Math.min(stats.totalUsage, 20);
          
          // 场景使用历史
          if (stats.usageByScene[currentScene]) {
            score += Math.min(stats.usageByScene[currentScene] * 2, 10);
          }

          // 时间段使用历史
          const timeSlot = this.getTimeSlot(new Date().getHours());
          if (stats.usageByTime[timeSlot]) {
            score += Math.min(stats.usageByTime[timeSlot], 5);
          }
        }

        // 优先级
        score += action.priority || 0;

        return { action, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(item => item.action);

    // 合并收藏和推荐
    const result = [...favorites, ...scored].slice(0, limit);
    return result;
  }

  /**
   * 获取指定场景的快捷操作
   */
  async getActionsForScene(scene: SceneType): Promise<QuickAction[]> {
    await this.initialize();

    return Array.from(this.actions.values())
      .filter(a => 
        a.enabled && 
        a.contextTriggers?.scenes.includes(scene) &&
        !this.preferences.hiddenActions.includes(a.id)
      )
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  // ==================== 用户偏好 ====================

  /**
   * 添加收藏动作
   */
  async addFavorite(actionId: string): Promise<void> {
    if (!this.preferences.favoriteActions.includes(actionId)) {
      this.preferences.favoriteActions.push(actionId);
      await this.savePreferences();
    }
  }

  /**
   * 移除收藏动作
   */
  async removeFavorite(actionId: string): Promise<void> {
    const index = this.preferences.favoriteActions.indexOf(actionId);
    if (index >= 0) {
      this.preferences.favoriteActions.splice(index, 1);
      await this.savePreferences();
    }
  }

  /**
   * 隐藏动作
   */
  async hideAction(actionId: string): Promise<void> {
    if (!this.preferences.hiddenActions.includes(actionId)) {
      this.preferences.hiddenActions.push(actionId);
      await this.savePreferences();
    }
  }

  /**
   * 取消隐藏动作
   */
  async unhideAction(actionId: string): Promise<void> {
    const index = this.preferences.hiddenActions.indexOf(actionId);
    if (index >= 0) {
      this.preferences.hiddenActions.splice(index, 1);
      await this.savePreferences();
    }
  }

  /**
   * 获取收藏的动作
   */
  async getFavoriteActions(): Promise<QuickAction[]> {
    await this.initialize();
    return this.preferences.favoriteActions
      .map(id => this.actions.get(id))
      .filter((a): a is QuickAction => !!a);
  }

  /**
   * 设置排序方式
   */
  async setSortOrder(order: 'usage' | 'recent' | 'alphabetical'): Promise<void> {
    this.preferences.sortOrder = order;
    await this.savePreferences();
  }
}

// ==================== 单例导出 ====================

export const quickActionManager = new QuickActionManager();

export default quickActionManager;
