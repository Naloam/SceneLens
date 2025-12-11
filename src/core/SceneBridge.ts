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
}

const { SceneBridge } = NativeModules;

if (!SceneBridge) {
  throw new Error(
    'SceneBridge native module is not available. ' +
    'Make sure the native module is properly linked.'
  );
}

/**
 * SceneBridge 接口
 * 提供类型安全的原生模块调用
 */
export const sceneBridge: SceneBridgeNativeModule = SceneBridge;

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
