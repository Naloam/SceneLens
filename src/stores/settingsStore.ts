/**
 * 设置状态管理 Store
 * * 负责管理应用全局配置、外观主题及数据导出逻辑
 */

import { create } from 'zustand';
import { storageManager } from './storageManager';

/**
 * 主题颜色定义
 * 保留原始四色：blue, purple, green, orange
 * 新增糖果四色：pink, mint, sky, lavender
 */
export type ThemeColor =
  | 'blue'
  | 'purple'
  | 'green'
  | 'orange'
  | 'pink'
  | 'mint'
  | 'sky'
  | 'lavender';

export type NotificationStyle = 
  | 'basic' 
  | 'detailed';

export type DetectionInterval = 
  5 | 10 | 15;

export interface AppSettings {
  darkMode: boolean;
  themeColor: ThemeColor;
  sceneNotificationsEnabled: boolean;
  notificationStyle: NotificationStyle;
  autoDetectionEnabled: boolean;
  detectionInterval: DetectionInterval;
  confidenceThreshold: number;
  historyLimit: number;
}

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
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
 * 主题颜色详细映射
 */
export const themeColors: Record<
  ThemeColor, 
  { primary: string; light: string; dark: string }
> = {
  blue: { 
    primary: '#007AFF', 
    light: '#4DA3FF', 
    dark: '#0056B3' 
  },
  purple: { 
    primary: '#AF52DE', 
    light: '#C77DEB', 
    dark: '#8A3BB3' 
  },
  green: { 
    primary: '#34C759', 
    light: '#5DD47D', 
    dark: '#248A3D' 
  },
  orange: { 
    primary: '#FF9500', 
    light: '#FFAD33', 
    dark: '#CC7700' 
  },
  pink: { 
    primary: '#FF85A1', 
    light: '#FFB3C1', 
    dark: '#FB6F92' 
  },
  mint: { 
    primary: '#72EFDD', 
    light: '#94FBAB', 
    dark: '#56CFE1' 
  },
  sky: { 
    primary: '#8ECAE6', 
    light: '#BDE0FE', 
    dark: '#219EBC' 
  },
  lavender: { 
    primary: '#B79CED', 
    light: '#DEC9E9', 
    dark: '#957FEF' 
  },
};

const SETTINGS_STORAGE_KEY = 'app_settings';

async function loadSettingsFromStorage(): Promise<AppSettings> {
  try {
    const storedData = storageManager['storage'].getString(SETTINGS_STORAGE_KEY);
    if (storedData) {
      const parsed = JSON.parse(storedData);
      if (parsed.themeColor && !themeColors[parsed.themeColor as ThemeColor]) {
        parsed.themeColor = 'blue';
      }
      return { 
        ...defaultSettings, 
        ...parsed 
      };
    }
  } catch (error) {
    console.warn('Failed to load settings from storage:', error);
  }
  return { ...defaultSettings };
}

async function saveSettingsToStorage(settings: AppSettings): Promise<void> {
  try {
    const data = JSON.stringify(settings);
    storageManager['storage'].set(SETTINGS_STORAGE_KEY, data);
  } catch (error) {
    console.error('Failed to save settings to storage:', error);
    throw error;
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...defaultSettings },
  isLoading: false,
  setSettings: (settings) => {
    set({ settings });
    saveSettingsToStorage(settings).catch(console.error);
  },
  updateSettings: (updates) => {
    const newSettings = { 
      ...get().settings, 
      ...updates 
    };
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
      const sceneHistory = await storageManager.loadSceneHistory();
      const userConfig = await storageManager.getUserConfig();
      const appPrefs = await storageManager.loadAppPreferences();
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        settings: get().settings,
        userConfig,
        sceneHistory: sceneHistory.slice(-100),
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
      await storageManager.cleanupOldSceneHistory(0);
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
      set({ 
        settings: { ...defaultSettings }, 
        isLoading: false 
      });
    }
  },
  saveSettings: async () => {
    await saveSettingsToStorage(get().settings);
  },
}));