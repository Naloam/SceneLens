/**
 * SilentContextEngine - 静默感知引擎
 * 
 * 职责：在低功耗前提下，持续收集时间、位置、运动状态、前台 App 等信号，
 * 输出基础场景推断。
 */

import {
  ContextSignal,
  SilentContext,
  SceneType,
  SignalType,
  Location,
  WiFiInfo,
  MotionState,
} from '../types';
import { sceneBridge } from './SceneBridge';

/**
 * 时间段定义
 * 
 * 时段划分说明：
 * - EARLY_MORNING: 5:00-7:00 (早起时段)
 * - MORNING_RUSH: 7:00-9:30 工作日通勤高峰
 * - MORNING: 9:30-12:00 (上午工作/学习时段)
 * - LUNCH: 12:00-14:00 (午餐时段)
 * - AFTERNOON: 14:00-17:00 (下午工作/学习时段)
 * - EVENING_RUSH: 17:00-19:00 工作日通勤高峰
 * - NIGHT: 19:00-23:00 (晚间时段，适合学习/休闲)
 * - LATE_NIGHT: 23:00-5:00 (深夜/睡眠时段)
 */
type TimePeriod = 
  | 'EARLY_MORNING'   // 早起 5:00-7:00
  | 'MORNING_RUSH'    // 早高峰 7:00-9:30 (工作日通勤)
  | 'MORNING'         // 上午 9:30-12:00
  | 'LUNCH'           // 午餐 12:00-14:00
  | 'AFTERNOON'       // 下午 14:00-17:00
  | 'EVENING_RUSH'    // 晚高峰 17:00-19:00 (工作日通勤)
  | 'NIGHT'           // 晚间 19:00-23:00 (学习/休闲)
  | 'LATE_NIGHT';     // 深夜 23:00-5:00 (睡眠)

/**
 * 位置类型定义
 */
type LocationType = 
  | 'HOME'
  | 'OFFICE'
  | 'SUBWAY_STATION'
  | 'TRAIN_STATION'
  | 'AIRPORT'
  | 'LIBRARY'
  | 'UNKNOWN';

/**
 * 场景得分映射类型
 */
type SceneScoreMap = Map<SceneType, number>;

/**
 * 信号到场景的映射结果
 */
type SignalSceneMapping = Array<[SceneType, number]>;

/**
 * 采样间隔配置（毫秒）
 */
interface SamplingIntervals {
  location: number;
  motion: number;
  wifi: number;
  foregroundApp: number;
}

/**
 * 权限状态缓存
 */
interface PermissionCache {
  location: boolean | null;
  usageStats: boolean | null;
  lastChecked: number;
}

/**
 * SilentContextEngine 类
 * 
 * 静默感知引擎，负责收集各种上下文信号并推断当前场景
 */
export class SilentContextEngine {
  /**
   * 采样间隔配置
   */
  private readonly samplingIntervals: SamplingIntervals = {
    location: 5 * 60 * 1000,   // 5分钟
    motion: 30 * 1000,          // 30秒
    wifi: 2 * 60 * 1000,        // 2分钟
    foregroundApp: 10 * 1000,   // 10秒
  };

  /**
   * 权限状态缓存
   */
  private permissionCache: PermissionCache = {
    location: null,
    usageStats: null,
    lastChecked: 0,
  };

  /**
   * 权限缓存有效期（5分钟）
   */
  private readonly PERMISSION_CACHE_TTL = 5 * 60 * 1000;

  /**
   * 信号缓存
   */
  private signalCache: Map<SignalType, ContextSignal> = new Map();

  /**
   * 已知位置围栏（后续可从配置加载）
   */
  private geoFences: Map<LocationType, { latitude: number; longitude: number; radius: number }> = new Map();

  /**
   * 已知 WiFi SSID 映射
   */
  private knownWiFiMap: Map<string, LocationType> = new Map();

  constructor() {
    // 初始化默认围栏和 WiFi 映射（后续可从配置加载）
    this.initializeDefaults();
  }

  /**
   * 初始化默认配置
   */
  private initializeDefaults(): void {
    // 这些值后续应该从用户配置中加载
    // 目前设置为空，等待用户配置
  }

  /**
   * 获取当前上下文
   * 
   * @returns 静默上下文对象
   */
  async getContext(): Promise<SilentContext> {
    const signals: ContextSignal[] = [];

    // 时间信号（始终可用）
    signals.push(this.getTimeSignal());

    // 位置信号（如果有权限）
    if (await this.hasLocationPermission()) {
      const locationSignal = await this.getLocationSignal();
      if (locationSignal) {
        signals.push(locationSignal);
      }
    }

    // Wi-Fi 信号
    const wifiSignal = await this.getWiFiSignal();
    if (wifiSignal) {
      signals.push(wifiSignal);
    }

    // 运动状态
    const motionSignal = await this.getMotionSignal();
    if (motionSignal) {
      signals.push(motionSignal);
    }

    // 前台应用
    if (await this.hasUsageStatsPermission()) {
      const appSignal = await this.getForegroundAppSignal();
      if (appSignal) {
        signals.push(appSignal);
      }
    }

    // 场景推断
    return this.inferScene(signals);
  }

  /**
   * 获取时间信号
   * 
   * 根据当前时间生成时间上下文信号，包含：
   * - 时间段（MORNING_RUSH, EVENING_RUSH, NIGHT, LATE_NIGHT 等）
   * - 工作日/周末标识
   * 
   * 时间信号用于：
   * - 通勤场景识别（早晚高峰 + 工作日）
   * - 学习场景识别（晚间时段）
   * - 睡眠场景识别（深夜时段）
   * 
   * @returns 时间上下文信号
   */
  getTimeSignal(): ContextSignal {
    const now = new Date();
    const timePeriod = this.getTimePeriod(now);
    const isWeekday = this.isWeekday(now);

    // 根据时段和是否工作日调整权重
    // 通勤时段在工作日权重更高
    let weight = 0.7;
    if ((timePeriod === 'MORNING_RUSH' || timePeriod === 'EVENING_RUSH') && isWeekday) {
      weight = 0.85; // 工作日通勤时段权重更高
    } else if (timePeriod === 'LATE_NIGHT') {
      weight = 0.8; // 深夜时段权重较高（睡眠场景）
    } else if (timePeriod === 'NIGHT') {
      weight = 0.75; // 晚间时段权重中高（学习场景）
    }

    return {
      type: 'TIME',
      value: `${timePeriod}${isWeekday ? '_WEEKDAY' : '_WEEKEND'}`,
      weight,
      timestamp: now.getTime(),
    };
  }

  /**
   * 获取当前时间段
   * 
   * 时段划分：
   * - 05:00-07:00 → EARLY_MORNING (早起)
   * - 07:00-09:30 → MORNING_RUSH (早高峰，工作日通勤)
   * - 09:30-12:00 → MORNING (上午)
   * - 12:00-14:00 → LUNCH (午餐)
   * - 14:00-17:00 → AFTERNOON (下午)
   * - 17:00-19:00 → EVENING_RUSH (晚高峰，工作日通勤)
   * - 19:00-23:00 → NIGHT (晚间，学习/休闲)
   * - 23:00-05:00 → LATE_NIGHT (深夜，睡眠)
   * 
   * @param date 日期对象
   * @returns 时间段
   */
  private getTimePeriod(date: Date): TimePeriod {
    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeValue = hour * 60 + minute; // 转换为分钟数便于比较

    // 深夜时段: 23:00-05:00
    if (timeValue >= 23 * 60 || timeValue < 5 * 60) {
      return 'LATE_NIGHT';
    }
    // 早起时段: 05:00-07:00
    if (timeValue >= 5 * 60 && timeValue < 7 * 60) {
      return 'EARLY_MORNING';
    }
    // 早高峰: 07:00-09:30
    if (timeValue >= 7 * 60 && timeValue < 9 * 60 + 30) {
      return 'MORNING_RUSH';
    }
    // 上午: 09:30-12:00
    if (timeValue >= 9 * 60 + 30 && timeValue < 12 * 60) {
      return 'MORNING';
    }
    // 午餐: 12:00-14:00
    if (timeValue >= 12 * 60 && timeValue < 14 * 60) {
      return 'LUNCH';
    }
    // 下午: 14:00-17:00
    if (timeValue >= 14 * 60 && timeValue < 17 * 60) {
      return 'AFTERNOON';
    }
    // 晚高峰: 17:00-19:00
    if (timeValue >= 17 * 60 && timeValue < 19 * 60) {
      return 'EVENING_RUSH';
    }
    // 晚间: 19:00-23:00
    return 'NIGHT';
  }

  /**
   * 判断是否为工作日
   * 
   * @param date 日期对象
   * @returns 是否为工作日
   */
  private isWeekday(date: Date): boolean {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }

  /**
   * 获取位置信号
   * 
   * @returns 位置上下文信号或 null
   */
  private async getLocationSignal(): Promise<ContextSignal | null> {
    try {
      const location = await sceneBridge.getCurrentLocation();
      
      if (!location) {
        return null;
      }

      const locationType = this.classifyLocation(location);

      return {
        type: 'LOCATION',
        value: locationType,
        weight: 0.8, // 位置信号权重较高
        timestamp: Date.now(),
      };
    } catch (error) {
      console.warn('Failed to get location signal:', error);
      return null;
    }
  }

  /**
   * 分类位置
   * 
   * @param location 位置信息
   * @returns 位置类型
   */
  private classifyLocation(location: Location): LocationType {
    // 遍历已知围栏，检查是否在围栏内
    for (const [type, fence] of this.geoFences) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        fence.latitude,
        fence.longitude
      );

      if (distance <= fence.radius) {
        return type;
      }
    }

    return 'UNKNOWN';
  }

  /**
   * 计算两点之间的距离（米）
   * 使用 Haversine 公式
   * 
   * @param lat1 纬度1
   * @param lon1 经度1
   * @param lat2 纬度2
   * @param lon2 经度2
   * @returns 距离（米）
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // 地球半径（米）
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度转弧度
   * 
   * @param deg 角度
   * @returns 弧度
   */
  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * 获取 WiFi 信号
   * 
   * @returns WiFi 上下文信号或 null
   */
  private async getWiFiSignal(): Promise<ContextSignal | null> {
    try {
      const wifiInfo = await sceneBridge.getConnectedWiFi();
      
      if (!wifiInfo) {
        return null;
      }

      // 检查是否为已知 WiFi
      const locationType = this.knownWiFiMap.get(wifiInfo.ssid) || 'UNKNOWN';

      return {
        type: 'WIFI',
        value: locationType !== 'UNKNOWN' ? locationType : wifiInfo.ssid,
        weight: locationType !== 'UNKNOWN' ? 0.9 : 0.3, // 已知 WiFi 权重更高
        timestamp: Date.now(),
      };
    } catch (error) {
      console.warn('Failed to get WiFi signal:', error);
      return null;
    }
  }

  /**
   * 获取运动状态信号
   * 
   * @returns 运动状态上下文信号或 null
   */
  private async getMotionSignal(): Promise<ContextSignal | null> {
    try {
      const motionState = await sceneBridge.getMotionState();

      return {
        type: 'MOTION',
        value: motionState,
        weight: 0.5, // 运动状态权重中等
        timestamp: Date.now(),
      };
    } catch (error) {
      console.warn('Failed to get motion signal:', error);
      return null;
    }
  }

  /**
   * 获取前台应用信号
   * 
   * @returns 前台应用上下文信号或 null
   */
  private async getForegroundAppSignal(): Promise<ContextSignal | null> {
    try {
      const packageName = await sceneBridge.getForegroundApp();

      if (!packageName) {
        return null;
      }

      // 分类应用
      const appCategory = this.classifyApp(packageName);

      return {
        type: 'FOREGROUND_APP',
        value: appCategory,
        weight: 0.4, // 前台应用权重较低
        timestamp: Date.now(),
      };
    } catch (error) {
      console.warn('Failed to get foreground app signal:', error);
      return null;
    }
  }

  /**
   * 分类应用
   * 
   * @param packageName 包名
   * @returns 应用类别
   */
  private classifyApp(packageName: string): string {
    const lowerPackageName = packageName.toLowerCase();

    // 基于包名的启发式规则
    if (lowerPackageName.includes('music') || 
        lowerPackageName.includes('spotify') ||
        lowerPackageName.includes('netease')) {
      return 'MUSIC';
    }

    if (lowerPackageName.includes('metro') || 
        lowerPackageName.includes('transit') ||
        lowerPackageName.includes('subway')) {
      return 'TRANSIT';
    }

    if (lowerPackageName.includes('zoom') || 
        lowerPackageName.includes('teams') ||
        lowerPackageName.includes('meeting') ||
        lowerPackageName.includes('dingtalk')) {
      return 'MEETING';
    }

    if (lowerPackageName.includes('study') || 
        lowerPackageName.includes('learn') ||
        lowerPackageName.includes('education') ||
        lowerPackageName.includes('reader')) {
      return 'STUDY';
    }

    if (lowerPackageName.includes('smarthome') || 
        lowerPackageName.includes('mijia') ||
        lowerPackageName.includes('homekit')) {
      return 'SMART_HOME';
    }

    if (lowerPackageName.includes('calendar') || 
        lowerPackageName.includes('schedule')) {
      return 'CALENDAR';
    }

    if (lowerPackageName.includes('12306') || 
        lowerPackageName.includes('ctrip') ||
        lowerPackageName.includes('flight')) {
      return 'TRAVEL';
    }

    return 'OTHER';
  }

  /**
   * 推断场景
   * 
   * 使用加权投票算法，根据各信号推断最可能的场景
   * 
   * @param signals 上下文信号数组
   * @returns 静默上下文
   */
  inferScene(signals: ContextSignal[]): SilentContext {
    // 场景得分映射
    const sceneScores: SceneScoreMap = new Map();

    // 初始化所有场景得分为 0
    const allScenes: SceneType[] = ['COMMUTE', 'OFFICE', 'HOME', 'STUDY', 'SLEEP', 'TRAVEL', 'UNKNOWN'];
    for (const scene of allScenes) {
      sceneScores.set(scene, 0);
    }

    // 计算总权重
    let totalWeight = 0;

    // 遍历所有信号，累加场景得分
    for (const signal of signals) {
      const sceneMapping = this.signalToScenes(signal);
      
      for (const [scene, score] of sceneMapping) {
        const currentScore = sceneScores.get(scene) || 0;
        sceneScores.set(scene, currentScore + score * signal.weight);
      }

      totalWeight += signal.weight;
    }

    // 选择得分最高的场景
    let maxScore = 0;
    let bestScene: SceneType = 'UNKNOWN';

    for (const [scene, score] of sceneScores) {
      if (score > maxScore) {
        maxScore = score;
        bestScene = scene;
      }
    }

    // 计算置信度（归一化）
    const confidence = totalWeight > 0 ? Math.min(maxScore / totalWeight, 1.0) : 0;

    return {
      timestamp: Date.now(),
      context: bestScene,
      confidence,
      signals,
    };
  }

  /**
   * 将信号映射到场景
   * 
   * @param signal 上下文信号
   * @returns 场景得分映射数组
   */
  signalToScenes(signal: ContextSignal): SignalSceneMapping {
    const mapping: SignalSceneMapping = [];

    switch (signal.type) {
      case 'TIME':
        return this.timeSignalToScenes(signal.value);

      case 'LOCATION':
        return this.locationSignalToScenes(signal.value);

      case 'MOTION':
        return this.motionSignalToScenes(signal.value);

      case 'WIFI':
        return this.wifiSignalToScenes(signal.value);

      case 'FOREGROUND_APP':
        return this.appSignalToScenes(signal.value);

      default:
        return mapping;
    }
  }

  /**
   * 时间信号到场景映射
   * 
   * 将时间信号映射到可能的场景及其得分：
   * - MORNING_RUSH + 工作日 → 高概率通勤
   * - EVENING_RUSH + 工作日 → 高概率通勤
   * - NIGHT → 适合学习/休闲
   * - LATE_NIGHT → 高概率睡眠
   * 
   * @param timeValue 时间值（格式：PERIOD_WEEKDAY 或 PERIOD_WEEKEND）
   * @returns 场景得分映射
   */
  private timeSignalToScenes(timeValue: string): SignalSceneMapping {
    const mapping: SignalSceneMapping = [];

    // 解析时间信号
    const isWeekday = timeValue.includes('WEEKDAY');
    const period = timeValue.replace('_WEEKDAY', '').replace('_WEEKEND', '');

    switch (period) {
      case 'EARLY_MORNING':
        // 早起时段，可能在家或准备出门
        if (isWeekday) {
          mapping.push(['HOME', 0.5]);
          mapping.push(['COMMUTE', 0.3]);
        } else {
          mapping.push(['HOME', 0.7]);
        }
        break;

      case 'MORNING_RUSH':
        // 早高峰：工作日高概率通勤
        if (isWeekday) {
          mapping.push(['COMMUTE', 0.9]);
          mapping.push(['OFFICE', 0.1]);
        } else {
          mapping.push(['HOME', 0.6]);
          mapping.push(['TRAVEL', 0.2]);
        }
        break;

      case 'MORNING':
      case 'AFTERNOON':
        // 上午/下午：工作日在办公室，周末在家或学习
        if (isWeekday) {
          mapping.push(['OFFICE', 0.7]);
          mapping.push(['STUDY', 0.2]);
        } else {
          mapping.push(['HOME', 0.4]);
          mapping.push(['STUDY', 0.3]);
          mapping.push(['TRAVEL', 0.2]);
        }
        break;

      case 'LUNCH':
        // 午餐时段
        if (isWeekday) {
          mapping.push(['OFFICE', 0.5]);
          mapping.push(['HOME', 0.2]);
        } else {
          mapping.push(['HOME', 0.5]);
          mapping.push(['TRAVEL', 0.2]);
        }
        break;

      case 'EVENING_RUSH':
        // 晚高峰：工作日高概率通勤
        if (isWeekday) {
          mapping.push(['COMMUTE', 0.9]);
          mapping.push(['HOME', 0.1]);
        } else {
          mapping.push(['HOME', 0.4]);
          mapping.push(['TRAVEL', 0.3]);
        }
        break;

      case 'NIGHT':
        // 晚间时段：适合学习和休闲，在家概率高
        mapping.push(['HOME', 0.5]);
        mapping.push(['STUDY', 0.4]); // 学习场景得分提高
        if (!isWeekday) {
          mapping.push(['TRAVEL', 0.1]);
        }
        break;

      case 'LATE_NIGHT':
        // 深夜时段：高概率睡眠
        mapping.push(['SLEEP', 0.85]);
        mapping.push(['HOME', 0.15]);
        break;

      default:
        mapping.push(['UNKNOWN', 0.5]);
    }

    return mapping;
  }

  /**
   * 位置信号到场景映射
   * 
   * @param locationValue 位置值
   * @returns 场景得分映射
   */
  private locationSignalToScenes(locationValue: string): SignalSceneMapping {
    const mapping: SignalSceneMapping = [];

    switch (locationValue) {
      case 'HOME':
        mapping.push(['HOME', 0.9]);
        mapping.push(['SLEEP', 0.3]);
        mapping.push(['STUDY', 0.2]);
        break;

      case 'OFFICE':
        mapping.push(['OFFICE', 0.9]);
        break;

      case 'SUBWAY_STATION':
        mapping.push(['COMMUTE', 0.9]);
        break;

      case 'TRAIN_STATION':
      case 'AIRPORT':
        mapping.push(['TRAVEL', 0.9]);
        break;

      case 'LIBRARY':
        mapping.push(['STUDY', 0.9]);
        break;

      default:
        mapping.push(['UNKNOWN', 0.3]);
    }

    return mapping;
  }

  /**
   * 运动信号到场景映射
   * 
   * @param motionValue 运动状态值
   * @returns 场景得分映射
   */
  private motionSignalToScenes(motionValue: string): SignalSceneMapping {
    const mapping: SignalSceneMapping = [];

    switch (motionValue as MotionState) {
      case 'STILL':
        mapping.push(['OFFICE', 0.4]);
        mapping.push(['HOME', 0.4]);
        mapping.push(['STUDY', 0.3]);
        mapping.push(['SLEEP', 0.2]);
        break;

      case 'WALKING':
        mapping.push(['COMMUTE', 0.6]);
        mapping.push(['TRAVEL', 0.3]);
        break;

      case 'RUNNING':
        // 运动状态，暂时映射到未知
        mapping.push(['UNKNOWN', 0.5]);
        break;

      case 'VEHICLE':
        mapping.push(['COMMUTE', 0.7]);
        mapping.push(['TRAVEL', 0.5]);
        break;

      default:
        mapping.push(['UNKNOWN', 0.3]);
    }

    return mapping;
  }

  /**
   * WiFi 信号到场景映射
   * 
   * @param wifiValue WiFi 值（位置类型或 SSID）
   * @returns 场景得分映射
   */
  private wifiSignalToScenes(wifiValue: string): SignalSceneMapping {
    const mapping: SignalSceneMapping = [];

    // 如果是已知位置类型
    switch (wifiValue) {
      case 'HOME':
        mapping.push(['HOME', 0.9]);
        mapping.push(['SLEEP', 0.3]);
        break;

      case 'OFFICE':
        mapping.push(['OFFICE', 0.9]);
        break;

      case 'LIBRARY':
        mapping.push(['STUDY', 0.9]);
        break;

      default:
        // 未知 WiFi，提供较低的默认权重
        mapping.push(['UNKNOWN', 0.2]);
    }

    return mapping;
  }

  /**
   * 应用信号到场景映射
   * 
   * @param appCategory 应用类别
   * @returns 场景得分映射
   */
  private appSignalToScenes(appCategory: string): SignalSceneMapping {
    const mapping: SignalSceneMapping = [];

    switch (appCategory) {
      case 'MUSIC':
        // 音乐应用可能在多种场景下使用
        mapping.push(['COMMUTE', 0.4]);
        mapping.push(['HOME', 0.3]);
        mapping.push(['STUDY', 0.2]);
        break;

      case 'TRANSIT':
        mapping.push(['COMMUTE', 0.9]);
        break;

      case 'MEETING':
        mapping.push(['OFFICE', 0.8]);
        break;

      case 'STUDY':
        mapping.push(['STUDY', 0.8]);
        mapping.push(['HOME', 0.2]);
        break;

      case 'SMART_HOME':
        mapping.push(['HOME', 0.8]);
        break;

      case 'CALENDAR':
        mapping.push(['OFFICE', 0.5]);
        mapping.push(['HOME', 0.3]);
        break;

      case 'TRAVEL':
        mapping.push(['TRAVEL', 0.9]);
        break;

      default:
        mapping.push(['UNKNOWN', 0.2]);
    }

    return mapping;
  }

  /**
   * 检查是否有位置权限
   * 
   * @returns 是否有权限
   */
  private async hasLocationPermission(): Promise<boolean> {
    // 检查缓存
    if (this.isPermissionCacheValid() && this.permissionCache.location !== null) {
      return this.permissionCache.location;
    }

    try {
      const hasPermission = await sceneBridge.checkPermission('location');
      this.permissionCache.location = hasPermission;
      this.permissionCache.lastChecked = Date.now();
      return hasPermission;
    } catch (error) {
      console.warn('Failed to check location permission:', error);
      return false;
    }
  }

  /**
   * 检查是否有使用统计权限
   * 
   * @returns 是否有权限
   */
  private async hasUsageStatsPermission(): Promise<boolean> {
    // 检查缓存
    if (this.isPermissionCacheValid() && this.permissionCache.usageStats !== null) {
      return this.permissionCache.usageStats;
    }

    try {
      const hasPermission = await sceneBridge.checkPermission('usageStats');
      this.permissionCache.usageStats = hasPermission;
      this.permissionCache.lastChecked = Date.now();
      return hasPermission;
    } catch (error) {
      console.warn('Failed to check usage stats permission:', error);
      return false;
    }
  }

  /**
   * 检查权限缓存是否有效
   * 
   * @returns 缓存是否有效
   */
  private isPermissionCacheValid(): boolean {
    return Date.now() - this.permissionCache.lastChecked < this.PERMISSION_CACHE_TTL;
  }

  /**
   * 设置位置围栏
   * 
   * @param type 位置类型
   * @param latitude 纬度
   * @param longitude 经度
   * @param radius 半径（米）
   */
  setGeoFence(type: LocationType, latitude: number, longitude: number, radius: number): void {
    this.geoFences.set(type, { latitude, longitude, radius });
  }

  /**
   * 设置已知 WiFi 映射
   * 
   * @param ssid WiFi SSID
   * @param type 位置类型
   */
  setKnownWiFi(ssid: string, type: LocationType): void {
    this.knownWiFiMap.set(ssid, type);
  }

  /**
   * 清除所有配置
   */
  clearConfiguration(): void {
    this.geoFences.clear();
    this.knownWiFiMap.clear();
    this.signalCache.clear();
    this.permissionCache = {
      location: null,
      usageStats: null,
      lastChecked: 0,
    };
  }

  /**
   * 获取采样间隔配置
   * 
   * @returns 采样间隔配置
   */
  getSamplingIntervals(): SamplingIntervals {
    return { ...this.samplingIntervals };
  }
}

// 导出单例实例
export const silentContextEngine = new SilentContextEngine();

// 默认导出类
export default SilentContextEngine;
