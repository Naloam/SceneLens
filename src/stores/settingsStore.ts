/**
 * 设置状态管理 Store
 *
 * 管理应用设置，包括外观、通知、高级设置等
 */

import { create } from 'zustand';
import { storageManager } from './storageManager';

/**
 * 主题颜色
 */
export type ThemeColor =
  | 'blue'    // 默认蓝色
  | 'purple'  // 紫色
  | 'green'   // 绿色
  | 'orange'; // 橙色

/**
 * 通知样式
 */
export type NotificationStyle =
  | 'basic'   // 基本样式
  | 'detailed'; // 详细样式

/**
 * 检测间隔（分钟）
 */
export type DetectionInterval = 5 | 10 | 15;

/**
 * 应用设置
 */
export interface AppSettings {
  // 外观设置
  darkMode: boolean;
  themeColor: ThemeColor;

  // 通知设置
  sceneNotificationsEnabled: boolean;
  notificationStyle: NotificationStyle;

  // 高级设置
  autoDetectionEnabled: boolean;
  detectionInterval: DetectionInterval;
  confidenceThreshold: number; // 0-100

  // 数据设置
  historyLimit: number; // 历史记录保留天数
}

/**
 * 设置状态
 */
interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;

  // Actions
  setSettings: (settings: AppSettings) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  toggleDarkMode: () => void;
  setThemeColor: (color: ThemeColor) => void;
  toggleSceneNotifications: () => void;
  setNotificationStyle: (style: NotificationStyle) => void;
  toggleAutoDetection: () => void;
  setDetectionInterval: (interval: DetectionInterval) => void;
  setConfidenceThreshold: (threshold: number) => void;
  resetSettings: () => void;
  exportData: () => Promise<string>;
  clearHistory: () => Promise<void>;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

/**
 * 默认设置
 */
const defaultSettings: AppSettings = {
  darkMode: false,
  themeColor: 'blue',
  sceneNotificationsEnabled: true,
  notificationStyle: 'detailed',
  autoDetectionEnabled: false,
  detectionInterval: 10,
  confidenceThreshold: 60,
  historyLimit: 30,
};

/**
 * 主题颜色映射
 */
export const themeColors: Record<ThemeColor, { primary: string; light: string; dark: string }> = {
  blue: { primary: '#007AFF', light: '#4DA3FF', dark: '#0056B3' },
  purple: { primary: '#AF52DE', light: '#C77DEB', dark: '#8A3BB3' },
  green: { primary: '#34C759', light: '#5DD47D', dark: '#248A3D' },
  orange: { primary: '#FF9500', light: '#FFAD33', dark: '#CC7700' },
};

/**
 * 设置存储键
 */
const SETTINGS_STORAGE_KEY = 'app_settings';

/**
 * 从存储加载设置
 */
async function loadSettingsFromStorage(): Promise<AppSettings> {
  try {
    const storedData = storageManager['storage'].getString(SETTINGS_STORAGE_KEY);
    if (storedData) {
      const parsed = JSON.parse(storedData);
      // 合并默认设置，确保所有字段都存在
      return {
        ...defaultSettings,
        ...parsed,
      };
    }
  } catch (error) {
    console.warn('Failed to load settings from storage:', error);
  }
  return { ...defaultSettings };
}

/**
 * 保存设置到存储
 */
async function saveSettingsToStorage(settings: AppSettings): Promise<void> {
  try {
    const data = JSON.stringify(settings);
    storageManager['storage'].set(SETTINGS_STORAGE_KEY, data);
  } catch (error) {
    console.error('Failed to save settings to storage:', error);
    throw error;
  }
}

/**
 * 设置 Store
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...defaultSettings },
  isLoading: false,

  setSettings: (settings) => {
    set({ settings });
    saveSettingsToStorage(settings).catch(console.error);
  },

  updateSettings: (updates) => {
    const newSettings = { ...get().settings, ...updates };
    set({ settings: newSettings });
    saveSettingsToStorage(newSettings).catch(console.error);
  },

  toggleDarkMode: () => {
    const newDarkMode = !get().settings.darkMode;
    get().updateSettings({ darkMode: newDarkMode });
  },

  setThemeColor: (color) => {
    get().updateSettings({ themeColor: color });
  },

  toggleSceneNotifications: () => {
    const newEnabled = !get().settings.sceneNotificationsEnabled;
    get().updateSettings({ sceneNotificationsEnabled: newEnabled });
  },

  setNotificationStyle: (style) => {
    get().updateSettings({ notificationStyle: style });
  },

  toggleAutoDetection: () => {
    const newEnabled = !get().settings.autoDetectionEnabled;
    get().updateSettings({ autoDetectionEnabled: newEnabled });
  },

  setDetectionInterval: (interval) => {
    get().updateSettings({ detectionInterval: interval });
  },

  setConfidenceThreshold: (threshold) => {
    get().updateSettings({ confidenceThreshold: threshold });
  },

  resetSettings: () => {
    set({ settings: { ...defaultSettings } });
    saveSettingsToStorage(defaultSettings).catch(console.error);
  },

  exportData: async () => {
    try {
      // 导出所有数据
      const sceneHistory = await storageManager.loadSceneHistory();
      const userConfig = await storageManager.getUserConfig();
      const appPrefs = await storageManager.loadAppPreferences();

      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        settings: get().settings,
        userConfig,
        sceneHistory: sceneHistory.slice(-100), // 最近100条
        appPreferences: Array.from(appPrefs.entries()),
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  },

  clearHistory: async () => {
    try {
      await storageManager.cleanupOldSceneHistory(0); // 清除所有历史
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  },

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await loadSettingsFromStorage();
      set({ settings, isLoading: false });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ settings: { ...defaultSettings }, isLoading: false });
    }
  },

  saveSettings: async () => {
    await saveSettingsToStorage(get().settings);
  },
}));
