/**
 * Storage Manager - 统一的存储管理器
 * 
 * 提供统一的存储接口，用于管理用户配置、场景历史等数据
 */

import type { 
  UserConfig, 
  SceneType, 
  AppCategory, 
  AppPreference, 
  SceneHistory 
} from '../types';
import { StorageKeys } from '../types';

/**
 * 简单的存储接口
 */
interface SimpleStorage {
  set(key: string, value: string): void;
  getString(key: string): string | undefined;
  clearAll(): void;
}

/**
 * 内存存储实现（用于测试和开发）
 */
class MemoryStorage implements SimpleStorage {
  private data: Map<string, string> = new Map();

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  getString(key: string): string | undefined {
    return this.data.get(key);
  }

  clearAll(): void {
    this.data.clear();
  }
}

/**
 * MMKV 存储实现
 */
class MMKVStorage implements SimpleStorage {
  private storage: any;

  constructor() {
    try {
      const { MMKV } = require('react-native-mmkv');
      this.storage = new MMKV({
        id: 'scenelens-storage',
        encryptionKey: 'scenelens-storage-key',
      });
    } catch (error) {
      console.warn('MMKV not available, using memory storage:', error);
      this.storage = new MemoryStorage();
    }
  }

  set(key: string, value: string): void {
    this.storage.set(key, value);
  }

  getString(key: string): string | undefined {
    return this.storage.getString(key);
  }

  clearAll(): void {
    if (this.storage.clearAll) {
      this.storage.clearAll();
    } else {
      // Fallback for memory storage
      this.storage.data?.clear();
    }
  }
}

/**
 * 存储管理器类
 */
class StorageManagerClass {
  private storage: SimpleStorage;

  constructor() {
    this.storage = new MMKVStorage();
  }

  /**
   * 获取用户配置
   */
  async getUserConfig(): Promise<UserConfig> {
    try {
      const configJson = this.storage.getString(StorageKeys.USER_CONFIG);
      if (configJson) {
        const config = JSON.parse(configJson);
        
        // 数据迁移：确保所有必需字段存在
        return {
          onboardingCompleted: config.onboardingCompleted ?? false,
          permissionsGranted: config.permissionsGranted ?? [],
          enabledScenes: config.enabledScenes ?? ['COMMUTE', 'HOME', 'OFFICE', 'STUDY', 'SLEEP', 'TRAVEL'],
          autoModeScenes: config.autoModeScenes ?? [],
        };
      }
    } catch (error) {
      console.warn('Failed to load user config:', error);
    }

    // 返回默认配置
    return {
      onboardingCompleted: false,
      permissionsGranted: [],
      enabledScenes: ['COMMUTE', 'HOME', 'OFFICE', 'STUDY', 'SLEEP', 'TRAVEL'],
      autoModeScenes: [],
    };
  }

  /**
   * 保存用户配置
   */
  async saveUserConfig(config: UserConfig): Promise<void> {
    try {
      const configJson = JSON.stringify(config);
      this.storage.set(StorageKeys.USER_CONFIG, configJson);
    } catch (error) {
      console.error('Failed to save user config:', error);
      throw error;
    }
  }

  /**
   * 检查场景是否启用自动模式
   */
  async isAutoModeEnabledForScene(sceneType: SceneType): Promise<boolean> {
    const config = await this.getUserConfig();
    return config.autoModeScenes.includes(sceneType);
  }

  /**
   * 为场景启用自动模式
   */
  async enableAutoModeForScene(sceneType: SceneType): Promise<void> {
    const config = await this.getUserConfig();
    
    if (!config.autoModeScenes.includes(sceneType)) {
      config.autoModeScenes.push(sceneType);
      await this.saveUserConfig(config);
    }
  }

  /**
   * 为场景禁用自动模式
   */
  async disableAutoModeForScene(sceneType: SceneType): Promise<void> {
    const config = await this.getUserConfig();
    
    const index = config.autoModeScenes.indexOf(sceneType);
    if (index > -1) {
      config.autoModeScenes.splice(index, 1);
      await this.saveUserConfig(config);
    }
  }

  /**
   * 切换场景的自动模式状态
   */
  async toggleAutoModeForScene(sceneType: SceneType): Promise<boolean> {
    const isEnabled = await this.isAutoModeEnabledForScene(sceneType);
    
    if (isEnabled) {
      await this.disableAutoModeForScene(sceneType);
      return false;
    } else {
      await this.enableAutoModeForScene(sceneType);
      return true;
    }
  }

  /**
   * 保存应用偏好
   */
  async saveAppPreferences(preferences: Map<AppCategory, AppPreference>): Promise<void> {
    try {
      const data = Array.from(preferences.entries());
      const preferencesJson = JSON.stringify(data);
      this.storage.set(StorageKeys.APP_PREFERENCES, preferencesJson);
    } catch (error) {
      console.error('Failed to save app preferences:', error);
      throw error;
    }
  }

  /**
   * 加载应用偏好
   */
  async loadAppPreferences(): Promise<Map<AppCategory, AppPreference>> {
    try {
      const preferencesJson = this.storage.getString(StorageKeys.APP_PREFERENCES);
      if (preferencesJson) {
        const data = JSON.parse(preferencesJson);
        return new Map(data);
      }
    } catch (error) {
      console.warn('Failed to load app preferences:', error);
    }
    
    // 返回空的 Map
    return new Map();
  }

  /**
   * 记录场景历史
   */
  async recordSceneHistory(history: SceneHistory): Promise<void> {
    try {
      const existing = await this.loadSceneHistory();
      existing.push(history);
      
      // 只保留最近 1000 条记录
      if (existing.length > 1000) {
        existing.shift();
      }
      
      const historyJson = JSON.stringify(existing);
      this.storage.set(StorageKeys.SCENE_HISTORY, historyJson);
    } catch (error) {
      console.error('Failed to record scene history:', error);
      throw error;
    }
  }

  /**
   * 加载场景历史
   */
  async loadSceneHistory(): Promise<SceneHistory[]> {
    try {
      const historyJson = this.storage.getString(StorageKeys.SCENE_HISTORY);
      if (historyJson) {
        return JSON.parse(historyJson);
      }
    } catch (error) {
      console.warn('Failed to load scene history:', error);
    }
    
    // 返回空数组
    return [];
  }

  /**
   * 获取特定场景的历史记录
   */
  async getSceneHistoryByType(sceneType: SceneType): Promise<SceneHistory[]> {
    const allHistory = await this.loadSceneHistory();
    return allHistory.filter(h => h.sceneType === sceneType);
  }

  /**
   * 获取最近的场景历史记录
   */
  async getRecentSceneHistory(limit: number = 10): Promise<SceneHistory[]> {
    const allHistory = await this.loadSceneHistory();
    return allHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 清除过期的场景历史记录
   */
  async cleanupOldSceneHistory(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const allHistory = await this.loadSceneHistory();
      
      const filteredHistory = allHistory.filter(h => h.timestamp > cutoffTime);
      
      const historyJson = JSON.stringify(filteredHistory);
      this.storage.set(StorageKeys.SCENE_HISTORY, historyJson);
    } catch (error) {
      console.error('Failed to cleanup old scene history:', error);
      throw error;
    }
  }

  /**
   * 获取所有启用自动模式的场景
   */
  async getAutoModeScenes(): Promise<SceneType[]> {
    const config = await this.getUserConfig();
    return config.autoModeScenes;
  }

  /**
   * 清除所有数据
   */
  async clearAllData(): Promise<void> {
    this.storage.clearAll();
  }

  /**
   * 获取存储统计信息
   */
  getStorageInfo(): {
    hasMMKV: boolean;
    storageType: string;
  } {
    const hasMMKV = this.storage.constructor.name !== 'MemoryStorage';
    
    return {
      hasMMKV,
      storageType: hasMMKV ? 'MMKV' : 'Memory',
    };
  }
}

// 导出单例实例
export const storageManager = new StorageManagerClass();

// 默认导出类
export default StorageManagerClass;