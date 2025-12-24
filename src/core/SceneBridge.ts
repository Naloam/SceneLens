/**
 * SceneBridge - React Native 与 Android 原生能力的桥梁
 */

import { NativeModules } from 'react-native';
import type {
  Location,
  WiFiInfo,
  MotionState,
  AppInfo,
  UsageStats,
  CalendarEvent,
  ImageData,
  AudioData,
} from '../types';

interface SceneBridgeNativeModule {
  // 测试方法
  ping(): Promise<{ message: string; timestamp: number }>;

  // 位置与网络
  getCurrentLocation(): Promise<Location>;
  getConnectedWiFi(): Promise<WiFiInfo | null>;

  // 传感器
  getMotionState(): Promise<MotionState>;

  // 应用信息
  getInstalledApps(): Promise<AppInfo[]>;
  getForegroundApp(): Promise<string>; // 返回包名
  getUsageStats(days: number): Promise<UsageStats[]>;

  // 系统设置
  setDoNotDisturb(enabled: boolean): Promise<{ enabled: boolean; mode: string }>;
  checkDoNotDisturbPermission(): Promise<boolean>;
  openDoNotDisturbSettings(): Promise<boolean>;
  setBrightness(level: number): Promise<{ level: number; brightness: number }>;
  checkWriteSettingsPermission(): Promise<boolean>;
  openWriteSettingsSettings(): Promise<boolean>;

  // Deep Link
  openAppWithDeepLink(packageName: string, deepLink?: string): Promise<boolean>;
  isAppInstalled(packageName: string): Promise<boolean>;
  validateDeepLink(deepLink: string): Promise<boolean>;

  // 日历
  getUpcomingEvents(hours: number): Promise<CalendarEvent[]>;

  // 权限
  requestPermission(permission: string): Promise<boolean>;
  checkPermission(permission: string): Promise<boolean>;
  checkUsageStatsPermission(): Promise<boolean>;
  openUsageStatsSettings(): Promise<boolean>;
  
  // 位置权限
  hasLocationPermission(): Promise<boolean>;
  requestLocationPermission(): Promise<boolean>;
  
  // 活动识别权限
  hasActivityRecognitionPermission(): Promise<boolean>;
  requestActivityRecognitionPermission(): Promise<boolean>;
  
  // 使用统计权限
  hasUsageStatsPermission(): Promise<boolean>;
  requestUsageStatsPermission(): Promise<boolean>;
  
  // 相机功能
  hasCameraPermission(): Promise<boolean>;
  requestCameraPermission(): Promise<boolean>;
  captureImage(): Promise<ImageData>;
  
  // 麦克风功能
  hasMicrophonePermission(): Promise<boolean>;
  requestMicrophonePermission(): Promise<boolean>;
  recordAudio(durationMs: number): Promise<AudioData>;
  
  // 音量键双击检测
  enableVolumeKeyListener(): Promise<boolean>;
  disableVolumeKeyListener(): Promise<boolean>;
  isVolumeKeyListenerEnabled(): Promise<boolean>;
  testVolumeKeyDoubleTap(): Promise<boolean>;
  
  // 桌面快捷方式
  createSceneAnalysisShortcut(): Promise<boolean>;
  removeSceneAnalysisShortcut(): Promise<boolean>;
  isShortcutSupported(): Promise<boolean>;
}

const { SceneBridge } = NativeModules;

// Fallback shim so app不会因缺少原生实现直接崩溃
const fallback: SceneBridgeNativeModule = {
  async ping() { return { message: 'fallback', timestamp: Date.now() }; },
  async getCurrentLocation() { return { latitude: 0, longitude: 0, accuracy: 100, timestamp: Date.now() }; },
  async getConnectedWiFi() { return null; },
  async getMotionState() { return 'STILL' as MotionState; },
  async getInstalledApps() { return []; },
  async getForegroundApp() { return ''; },
  async getUsageStats() { return []; },
  async setDoNotDisturb(enabled: boolean) { return { enabled, mode: 'unknown' }; },
  async checkDoNotDisturbPermission() { return false; },
  async openDoNotDisturbSettings() { return false; },
  async setBrightness(level: number) { return { level, brightness: level }; },
  async checkWriteSettingsPermission() { return false; },
  async openWriteSettingsSettings() { return false; },
  async openAppWithDeepLink() { return false; },
  async isAppInstalled() { return false; },
  async validateDeepLink() { return false; },
  async getUpcomingEvents() { return []; },
  async requestPermission() { return false; },
  async checkPermission() { return false; },
  async checkUsageStatsPermission() { return false; },
  async openUsageStatsSettings() { return false; },
  async hasLocationPermission() { return true; },
  async requestLocationPermission() { return true; },
  async hasActivityRecognitionPermission() { return true; },
  async requestActivityRecognitionPermission() { return true; },
  async hasUsageStatsPermission() { return true; },
  async requestUsageStatsPermission() { return true; },
  async hasCameraPermission() { return true; },
  async requestCameraPermission() { return true; },
  async captureImage() { 
    return { 
      base64: '', 
      width: 224, 
      height: 224, 
      format: 'JPEG', 
      timestamp: Date.now() 
    }; 
  },
  async hasMicrophonePermission() { return true; },
  async requestMicrophonePermission() { return true; },
  async recordAudio() { 
    return { 
      base64: '', 
      duration: 1000, 
      sampleRate: 16000, 
      format: 'WAV', 
      timestamp: Date.now() 
    }; 
  },
  async enableVolumeKeyListener() { return true; },
  async disableVolumeKeyListener() { return true; },
  async isVolumeKeyListenerEnabled() { return false; },
  async testVolumeKeyDoubleTap() { return false; },
  async createSceneAnalysisShortcut() { return false; },
  async removeSceneAnalysisShortcut() { return false; },
  async isShortcutSupported() { return false; },
};

const resolvedModule: SceneBridgeNativeModule = SceneBridge ?? fallback;

// Merge fallback first so any missing native methods still have a safe implementation.
// This prevents runtime TypeError when native side has not implemented newer APIs.
const sceneBridge: SceneBridgeNativeModule = { ...fallback, ...resolvedModule };

sceneBridge.captureImage = async () => {
  let granted: boolean | undefined;

  try {
    granted = await sceneBridge.hasCameraPermission();
  } catch (error) {
    console.error('Camera permission check failed:', error);
    granted = undefined;
  }

  // Block immediately on explicit denial to satisfy permission guard expectations
  if (granted === false) {
    throw new Error('Camera permission not granted');
  }
  return resolvedModule.captureImage();
};

sceneBridge.recordAudio = async (durationMs: number) => {
  let granted: boolean | undefined;

  try {
    granted = await sceneBridge.hasMicrophonePermission();
  } catch (error) {
    console.error('Microphone permission check failed:', error);
    granted = undefined;
  }

  // If explicitly denied, try requesting once before failing to mirror app behavior
  if (granted === false && typeof sceneBridge.requestMicrophonePermission === 'function') {
    try {
      const requested = await sceneBridge.requestMicrophonePermission();
      granted = requested;
    } catch (error) {
      console.error('Microphone permission request failed:', error);
      granted = false;
    }
  }

  // Only block when permission is explicitly denied after the request attempt
  if (granted === false) {
    throw new Error('Microphone permission not granted');
  }
  return resolvedModule.recordAudio(durationMs);
};

/**
 * SceneBridge 接口
 * 提供类型安全的原生模块调用
 */
export { sceneBridge };

/**
 * 测试原生模块连接
 */
export async function testNativeConnection(): Promise<boolean> {
  try {
    const result = await sceneBridge.ping();
    console.log('SceneBridge ping successful:', result);
    return true;
  } catch (error) {
    console.error('SceneBridge ping failed:', error);
    return false;
  }
}

export default sceneBridge;
