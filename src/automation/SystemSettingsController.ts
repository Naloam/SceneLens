/**
 * SystemSettingsController - 系统设置控制器
 * 
 * 提供对 Android 系统设置的 TypeScript 封装：
 * - 音量控制（媒体/铃声/通知/闹钟）
 * - 亮度调节
 * - 勿扰模式切换
 * - WiFi/蓝牙开关
 * - 屏幕超时设置
 * 
 * @module automation
 */

import { NativeModules } from 'react-native';
import type { SceneType } from '../types';
import type {
  VolumeStreamType,
  VolumeInfo,
  VolumeSettings,
  BrightnessSettings,
  DoNotDisturbMode,
  DoNotDisturbSettings,
  WiFiStatus,
  BluetoothStatus,
  SystemState,
  SceneSystemSettings,
  SettingsOperationResult,
  BatchSettingsResult,
  DEFAULT_SCENE_PRESETS,
} from '../types/automation';

// ==================== 原生模块接口 ====================

interface SystemSettingsNativeModule {
  // 音量控制
  setVolume(streamType: string, level: number): Promise<{
    streamType: string;
    level: number;
    actualVolume: number;
    maxVolume: number;
    success: boolean;
  }>;
  getVolume(streamType: string): Promise<{
    streamType: string;
    level: number;
    currentVolume: number;
    maxVolume: number;
  }>;
  getAllVolumes(): Promise<Record<string, VolumeInfo>>;
  
  // 亮度控制
  setBrightness(level: number, autoMode: boolean): Promise<{
    level: number;
    autoMode: boolean;
    success: boolean;
    error?: string;
  }>;
  getBrightness(): Promise<{
    level: number;
    rawValue: number;
    autoMode: boolean;
  }>;
  
  // 勿扰模式
  setDoNotDisturb(enabled: boolean, mode: string | null): Promise<{
    enabled: boolean;
    mode: string;
    filter: number;
    success: boolean;
    error?: string;
  }>;
  getDoNotDisturbStatus(): Promise<{
    enabled: boolean;
    mode: string;
    filter: number;
    hasPermission: boolean;
  }>;
  checkDoNotDisturbPermission(): Promise<boolean>;
  openDoNotDisturbSettings(): Promise<boolean>;
  
  // WiFi 控制
  setWiFi(enabled: boolean): Promise<{
    enabled: boolean;
    success: boolean;
    error?: string;
    message?: string;
    settingsOpened?: boolean;
  }>;
  getWiFiStatus(): Promise<WiFiStatus>;
  openWiFiSettings(): Promise<boolean>;
  
  // 蓝牙控制
  setBluetooth(enabled: boolean): Promise<{
    enabled: boolean;
    success: boolean;
    error?: string;
    message?: string;
    settingsOpened?: boolean;
  }>;
  getBluetoothStatus(): Promise<BluetoothStatus>;
  openBluetoothSettings(): Promise<boolean>;
  
  // 屏幕超时
  setScreenTimeout(seconds: number): Promise<{
    seconds: number;
    milliseconds: number;
    success: boolean;
    error?: string;
  }>;
  getScreenTimeout(): Promise<{
    seconds: number;
    milliseconds: number;
  }>;
  
  // 权限
  checkWriteSettingsPermission(): Promise<boolean>;
  openWriteSettingsSettings(): Promise<boolean>;
  checkBluetoothPermission(): Promise<boolean>;
  requestBluetoothPermission(): Promise<boolean>;
  
  // 批量操作
  applySettings(settings: Record<string, unknown>): Promise<BatchSettingsResult>;
  getSystemState(): Promise<SystemState>;
}

const { SystemSettings } = NativeModules;
const isNativeModuleAvailable = !!SystemSettings;

// ==================== Fallback 实现 ====================

const fallbackModule: SystemSettingsNativeModule = {
  async setVolume(streamType: string, level: number) {
    console.warn('[SystemSettings] Native module not available');
    return { streamType, level, actualVolume: 0, maxVolume: 100, success: false };
  },
  async getVolume(streamType: string) {
    return { streamType, level: 50, currentVolume: 8, maxVolume: 15 };
  },
  async getAllVolumes() {
    return {
      media: { level: 50, current: 8, max: 15 },
      ring: { level: 100, current: 15, max: 15 },
      notification: { level: 100, current: 15, max: 15 },
      alarm: { level: 100, current: 15, max: 15 },
    };
  },
  async setBrightness(level: number, autoMode: boolean) {
    console.warn('[SystemSettings] Native module not available');
    return { level, autoMode, success: false, error: 'NATIVE_MODULE_NOT_AVAILABLE' };
  },
  async getBrightness() {
    return { level: 50, rawValue: 128, autoMode: false };
  },
  async setDoNotDisturb(enabled: boolean, mode: string | null) {
    console.warn('[SystemSettings] Native module not available');
    return { enabled, mode: mode || 'none', filter: 0, success: false, error: 'NATIVE_MODULE_NOT_AVAILABLE' };
  },
  async getDoNotDisturbStatus() {
    return { enabled: false, mode: 'all', filter: 4, hasPermission: false };
  },
  async checkDoNotDisturbPermission() {
    return false;
  },
  async openDoNotDisturbSettings() {
    return false;
  },
  async setWiFi(enabled: boolean) {
    console.warn('[SystemSettings] Native module not available');
    return { enabled, success: false, error: 'NATIVE_MODULE_NOT_AVAILABLE' };
  },
  async getWiFiStatus() {
    return { enabled: false };
  },
  async openWiFiSettings() {
    return false;
  },
  async setBluetooth(enabled: boolean) {
    console.warn('[SystemSettings] Native module not available');
    return { enabled, success: false, error: 'NATIVE_MODULE_NOT_AVAILABLE' };
  },
  async getBluetoothStatus() {
    return { supported: true, enabled: false };
  },
  async openBluetoothSettings() {
    return false;
  },
  async setScreenTimeout(seconds: number) {
    console.warn('[SystemSettings] Native module not available');
    return { seconds, milliseconds: seconds * 1000, success: false, error: 'NATIVE_MODULE_NOT_AVAILABLE' };
  },
  async getScreenTimeout() {
    return { seconds: 60, milliseconds: 60000 };
  },
  async checkWriteSettingsPermission() {
    return false;
  },
  async openWriteSettingsSettings() {
    return false;
  },
  async checkBluetoothPermission() {
    return false;
  },
  async requestBluetoothPermission() {
    return false;
  },
  async applySettings() {
    console.warn('[SystemSettings] Native module not available');
    return { results: {}, success: false, hasErrors: true };
  },
  async getSystemState() {
    return {
      volume: { media: 50, ring: 100, notification: 100, alarm: 100 },
      brightness: { level: 50, autoMode: false },
      doNotDisturb: { enabled: false, mode: 'all' as DoNotDisturbMode },
      wifi: { enabled: false },
      bluetooth: { supported: true, enabled: false },
      screenTimeout: 60,
      permissions: {
        writeSettings: false,
        notificationPolicy: false,
        bluetoothConnect: false,
      },
    };
  },
};

const nativeModule: SystemSettingsNativeModule = SystemSettings ?? fallbackModule;

// ==================== 导出接口 ====================

/**
 * 检查原生模块是否可用
 */
export function isSystemSettingsAvailable(): boolean {
  return isNativeModuleAvailable;
}

// ==================== 音量控制 ====================

/**
 * 设置指定类型的音量
 * @param streamType 音量类型: 'media' | 'ring' | 'notification' | 'alarm' | 'system'
 * @param level 音量级别 (0-100)
 */
export async function setVolume(streamType: VolumeStreamType, level: number): Promise<boolean> {
  try {
    const result = await nativeModule.setVolume(streamType, Math.round(level));
    return result.success;
  } catch (error) {
    console.error(`[SystemSettings] Failed to set ${streamType} volume:`, error);
    return false;
  }
}

/**
 * 获取指定类型的音量
 * @param streamType 音量类型
 */
export async function getVolume(streamType: VolumeStreamType): Promise<number> {
  try {
    const result = await nativeModule.getVolume(streamType);
    return result.level;
  } catch (error) {
    console.error(`[SystemSettings] Failed to get ${streamType} volume:`, error);
    return 50;
  }
}

/**
 * 获取所有音量设置
 */
export async function getAllVolumes(): Promise<VolumeSettings> {
  try {
    const result = await nativeModule.getAllVolumes();
    return {
      media: result.media?.level ?? 50,
      ring: result.ring?.level ?? 100,
      notification: result.notification?.level ?? 100,
      alarm: result.alarm?.level ?? 100,
      system: result.system?.level ?? 50,
    };
  } catch (error) {
    console.error('[SystemSettings] Failed to get all volumes:', error);
    return { media: 50, ring: 100, notification: 100, alarm: 100 };
  }
}

/**
 * 批量设置音量
 * @param settings 音量设置
 */
export async function setVolumes(settings: VolumeSettings): Promise<boolean> {
  try {
    let allSuccess = true;
    const entries = Object.entries(settings) as [VolumeStreamType, number][];
    
    for (const [streamType, level] of entries) {
      if (level !== undefined) {
        const success = await setVolume(streamType, level);
        if (!success) allSuccess = false;
      }
    }
    
    return allSuccess;
  } catch (error) {
    console.error('[SystemSettings] Failed to set volumes:', error);
    return false;
  }
}

// ==================== 亮度控制 ====================

/**
 * 设置屏幕亮度
 * @param level 亮度级别 (0-100)
 * @param autoMode 是否启用自动亮度
 */
export async function setBrightness(level: number, autoMode: boolean = false): Promise<boolean> {
  try {
    const result = await nativeModule.setBrightness(Math.round(level), autoMode);
    return result.success;
  } catch (error) {
    console.error('[SystemSettings] Failed to set brightness:', error);
    return false;
  }
}

/**
 * 获取当前亮度设置
 */
export async function getBrightness(): Promise<BrightnessSettings> {
  try {
    const result = await nativeModule.getBrightness();
    return {
      level: result.level,
      autoMode: result.autoMode,
    };
  } catch (error) {
    console.error('[SystemSettings] Failed to get brightness:', error);
    return { level: 50, autoMode: false };
  }
}

// ==================== 勿扰模式 ====================

/**
 * 设置勿扰模式
 * @param enabled 是否启用
 * @param mode 勿扰模式: 'all' | 'priority' | 'alarms' | 'none'
 */
export async function setDoNotDisturb(
  enabled: boolean, 
  mode: DoNotDisturbMode = 'none'
): Promise<boolean> {
  try {
    const result = await nativeModule.setDoNotDisturb(enabled, mode);
    return result.success;
  } catch (error) {
    console.error('[SystemSettings] Failed to set DND:', error);
    return false;
  }
}

/**
 * 获取勿扰模式状态
 */
export async function getDoNotDisturbStatus(): Promise<DoNotDisturbSettings & { hasPermission: boolean }> {
  try {
    const result = await nativeModule.getDoNotDisturbStatus();
    return {
      enabled: result.enabled,
      mode: result.mode as DoNotDisturbMode,
      hasPermission: result.hasPermission,
    };
  } catch (error) {
    console.error('[SystemSettings] Failed to get DND status:', error);
    return { enabled: false, mode: 'all', hasPermission: false };
  }
}

/**
 * 检查勿扰模式权限
 */
export async function checkDoNotDisturbPermission(): Promise<boolean> {
  try {
    return await nativeModule.checkDoNotDisturbPermission();
  } catch (error) {
    console.error('[SystemSettings] Failed to check DND permission:', error);
    return false;
  }
}

/**
 * 打开勿扰模式设置页面
 */
export async function openDoNotDisturbSettings(): Promise<boolean> {
  try {
    return await nativeModule.openDoNotDisturbSettings();
  } catch (error) {
    console.error('[SystemSettings] Failed to open DND settings:', error);
    return false;
  }
}

// ==================== WiFi 控制 ====================

/**
 * 设置 WiFi 状态
 * @param enabled 是否启用
 * @returns 操作结果（Android 10+ 会自动打开设置页面）
 */
export async function setWiFi(enabled: boolean): Promise<SettingsOperationResult> {
  try {
    const result = await nativeModule.setWiFi(enabled);
    return {
      success: result.success,
      error: result.error,
      settingsOpened: result.settingsOpened,
    };
  } catch (error) {
    console.error('[SystemSettings] Failed to set WiFi:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 获取 WiFi 状态
 */
export async function getWiFiStatus(): Promise<WiFiStatus> {
  try {
    return await nativeModule.getWiFiStatus();
  } catch (error) {
    console.error('[SystemSettings] Failed to get WiFi status:', error);
    return { enabled: false };
  }
}

/**
 * 打开 WiFi 设置页面
 */
export async function openWiFiSettings(): Promise<boolean> {
  try {
    return await nativeModule.openWiFiSettings();
  } catch (error) {
    console.error('[SystemSettings] Failed to open WiFi settings:', error);
    return false;
  }
}

// ==================== 蓝牙控制 ====================

/**
 * 设置蓝牙状态
 * @param enabled 是否启用
 * @returns 操作结果
 */
export async function setBluetooth(enabled: boolean): Promise<SettingsOperationResult> {
  try {
    const result = await nativeModule.setBluetooth(enabled);
    return {
      success: result.success,
      error: result.error,
      settingsOpened: result.settingsOpened,
    };
  } catch (error) {
    console.error('[SystemSettings] Failed to set Bluetooth:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 获取蓝牙状态
 */
export async function getBluetoothStatus(): Promise<BluetoothStatus> {
  try {
    return await nativeModule.getBluetoothStatus();
  } catch (error) {
    console.error('[SystemSettings] Failed to get Bluetooth status:', error);
    return { supported: false, enabled: false };
  }
}

/**
 * 打开蓝牙设置页面
 */
export async function openBluetoothSettings(): Promise<boolean> {
  try {
    return await nativeModule.openBluetoothSettings();
  } catch (error) {
    console.error('[SystemSettings] Failed to open Bluetooth settings:', error);
    return false;
  }
}

/**
 * 检查蓝牙权限 (Android 12+)
 */
export async function checkBluetoothPermission(): Promise<boolean> {
  try {
    return await nativeModule.checkBluetoothPermission();
  } catch (error) {
    console.error('[SystemSettings] Failed to check Bluetooth permission:', error);
    return false;
  }
}

/**
 * 请求蓝牙权限
 */
export async function requestBluetoothPermission(): Promise<boolean> {
  try {
    return await nativeModule.requestBluetoothPermission();
  } catch (error) {
    console.error('[SystemSettings] Failed to request Bluetooth permission:', error);
    return false;
  }
}

// ==================== 屏幕超时 ====================

/**
 * 设置屏幕超时时间
 * @param seconds 超时秒数
 */
export async function setScreenTimeout(seconds: number): Promise<boolean> {
  try {
    const result = await nativeModule.setScreenTimeout(Math.round(seconds));
    return result.success;
  } catch (error) {
    console.error('[SystemSettings] Failed to set screen timeout:', error);
    return false;
  }
}

/**
 * 获取屏幕超时时间
 */
export async function getScreenTimeout(): Promise<number> {
  try {
    const result = await nativeModule.getScreenTimeout();
    return result.seconds;
  } catch (error) {
    console.error('[SystemSettings] Failed to get screen timeout:', error);
    return 60;
  }
}

// ==================== 权限管理 ====================

/**
 * 检查系统写入权限
 */
export async function checkWriteSettingsPermission(): Promise<boolean> {
  try {
    return await nativeModule.checkWriteSettingsPermission();
  } catch (error) {
    console.error('[SystemSettings] Failed to check write settings permission:', error);
    return false;
  }
}

/**
 * 打开系统写入权限设置页面
 */
export async function openWriteSettingsSettings(): Promise<boolean> {
  try {
    return await nativeModule.openWriteSettingsSettings();
  } catch (error) {
    console.error('[SystemSettings] Failed to open write settings:', error);
    return false;
  }
}

// ==================== 批量操作 ====================

/**
 * 获取完整的系统状态
 */
export async function getSystemState(): Promise<SystemState> {
  try {
    return await nativeModule.getSystemState();
  } catch (error) {
    console.error('[SystemSettings] Failed to get system state:', error);
    return fallbackModule.getSystemState();
  }
}

/**
 * 应用场景系统设置
 * @param sceneType 场景类型
 * @param settings 可选的自定义设置，会覆盖默认预设
 */
export async function applySceneSettings(
  sceneType: SceneType,
  settings?: Partial<SceneSystemSettings>
): Promise<BatchSettingsResult> {
  try {
    // 获取默认预设
    const { DEFAULT_SCENE_PRESETS } = await import('../types/automation');
    const defaultSettings = DEFAULT_SCENE_PRESETS[sceneType] || {};
    
    // 合并设置
    const mergedSettings: SceneSystemSettings = {
      ...defaultSettings,
      ...settings,
    };
    
    // 转换为原生模块期望的格式
    const nativeSettings: Record<string, unknown> = {};
    
    if (mergedSettings.volume) {
      nativeSettings.volume = mergedSettings.volume;
    }
    if (mergedSettings.brightness !== undefined) {
      nativeSettings.brightness = mergedSettings.brightness;
    }
    if (mergedSettings.autoBrightness !== undefined) {
      nativeSettings.autoBrightness = mergedSettings.autoBrightness;
    }
    if (mergedSettings.doNotDisturb !== undefined) {
      nativeSettings.doNotDisturb = mergedSettings.doNotDisturb;
    }
    if (mergedSettings.screenTimeout !== undefined) {
      nativeSettings.screenTimeout = mergedSettings.screenTimeout;
    }
    
    // 调用原生批量设置
    const result = await nativeModule.applySettings(nativeSettings);
    
    // 处理 WiFi 和蓝牙（这些需要单独处理）
    if (mergedSettings.wifi !== undefined) {
      const wifiResult = await setWiFi(mergedSettings.wifi);
      result.results.wifi = wifiResult.success;
      if (!wifiResult.success) result.hasErrors = true;
    }
    
    if (mergedSettings.bluetooth !== undefined) {
      const btResult = await setBluetooth(mergedSettings.bluetooth);
      result.results.bluetooth = btResult.success;
      if (!btResult.success) result.hasErrors = true;
    }
    
    console.log(`[SystemSettings] Applied ${sceneType} scene settings:`, result);
    return result;
  } catch (error) {
    console.error('[SystemSettings] Failed to apply scene settings:', error);
    return { results: {}, success: false, hasErrors: true };
  }
}

/**
 * 重置为默认设置
 */
export async function resetToDefault(): Promise<BatchSettingsResult> {
  const defaultSettings: SceneSystemSettings = {
    volume: { media: 50, ring: 100, notification: 100, alarm: 100 },
    brightness: 50,
    autoBrightness: false,
    doNotDisturb: false,
    screenTimeout: 60,
  };
  
  return applySceneSettings('UNKNOWN', defaultSettings);
}

// ==================== 默认导出 ====================

export const SystemSettingsController = {
  // 状态检查
  isAvailable: isSystemSettingsAvailable,
  
  // 音量
  setVolume,
  getVolume,
  getAllVolumes,
  setVolumes,
  
  // 亮度
  setBrightness,
  getBrightness,
  
  // 勿扰模式
  setDoNotDisturb,
  getDoNotDisturbStatus,
  checkDoNotDisturbPermission,
  openDoNotDisturbSettings,
  
  // WiFi
  setWiFi,
  getWiFiStatus,
  openWiFiSettings,
  
  // 蓝牙
  setBluetooth,
  getBluetoothStatus,
  openBluetoothSettings,
  checkBluetoothPermission,
  requestBluetoothPermission,
  
  // 屏幕超时
  setScreenTimeout,
  getScreenTimeout,
  
  // 权限
  checkWriteSettingsPermission,
  openWriteSettingsSettings,
  
  // 批量操作
  getSystemState,
  applySceneSettings,
  resetToDefault,
};

export default SystemSettingsController;
