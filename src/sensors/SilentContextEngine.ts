/**
 * SilentContextEngine - 静默场景感知引擎
 * 
 * 职责：在低功耗前提下，持续收集时间、位置、运动状态、前台 App 等信号，
 * 输出基础场景推断。
 * 
 * Requirements: 需求 1.1, 1.2, 1.3
 */

import type {
  ContextSignal,
  SilentContext,
  SceneType,
  SignalType,
} from '../types';
import sceneBridge from '../core/SceneBridge';

/**
 * 采样间隔配置（毫秒）
 */
interface SamplingIntervals {
  location: number;      // 位置采样间隔
  motion: number;        // 运动状态采样间隔
  wifi: number;          // Wi-Fi 采样间隔
  foregroundApp: number; // 前台应用采样间隔
}

/**
 * 场景得分映射
 */
type SceneScores = Map<SceneType, number>;

/**
 * 静默场景感知引擎
 */
export class SilentContextEngine {
  /**
   * 采样间隔配置
   * 根据需求 1.4，控制采样频率为 5-10 分钟一次以节省电量
   */
  private samplingIntervals: SamplingIntervals = {
    location: 5 * 60 * 1000,      // 5分钟
    motion: 30 * 1000,            // 30秒
    wifi: 2 * 60 * 1000,          // 2分钟
    foregroundApp: 10 * 1000,     // 10秒
  };

  /**
   * 上次采样时间缓存
   */
  private lastSampleTime: Map<SignalType, number> = new Map();

  /**
   * 信号缓存
   */
  private signalCache: Map<SignalType, ContextSignal> = new Map();

  /**
   * 获取当前场景上下文
   * Requirements: 需求 1.2 - 在 50ms 内完成场景判定
   * 
   * @returns 场景上下文，包含场景类型、置信度和信号列表
   */
  async getContext(): Promise<SilentContext> {
    const startTime = Date.now();
    const signals: ContextSignal[] = [];

    // 时间信号（始终可用，无需权限）
    signals.push(this.getTimeSignal());

    // 位置信号（如果有权限且到达采样时间）
    try {
      if (await this.shouldSample('LOCATION')) {
        const locationSignal = await this.getLocationSignal();
        if (locationSignal) {
          signals.push(locationSignal);
          this.updateCache('LOCATION', locationSignal);
        }
      } else {
        // 使用缓存的位置信号
        const cached = this.signalCache.get('LOCATION');
        if (cached) {
          signals.push(cached);
        }
      }
    } catch (error) {
      console.warn('Failed to get location signal:', error);
    }

    // Wi-Fi 信号
    try {
      if (await this.shouldSample('WIFI')) {
        const wifiSignal = await this.getWiFiSignal();
        if (wifiSignal) {
          signals.push(wifiSignal);
          this.updateCache('WIFI', wifiSignal);
        }
      } else {
        const cached = this.signalCache.get('WIFI');
        if (cached) {
          signals.push(cached);
        }
      }
    } catch (error) {
      console.warn('Failed to get WiFi signal:', error);
    }

    // 运动状态信号
    try {
      if (await this.shouldSample('MOTION')) {
        const motionSignal = await this.getMotionSignal();
        if (motionSignal) {
          signals.push(motionSignal);
          this.updateCache('MOTION', motionSignal);
        }
      } else {
        const cached = this.signalCache.get('MOTION');
        if (cached) {
          signals.push(cached);
        }
      }
    } catch (error) {
      console.warn('Failed to get motion signal:', error);
    }

    // 前台应用信号
    try {
      if (await this.shouldSample('FOREGROUND_APP')) {
        const appSignal = await this.getForegroundAppSignal();
        if (appSignal) {
          signals.push(appSignal);
          this.updateCache('FOREGROUND_APP', appSignal);
        }
      } else {
        const cached = this.signalCache.get('FOREGROUND_APP');
        if (cached) {
          signals.push(cached);
        }
      }
    } catch (error) {
      console.warn('Failed to get foreground app signal:', error);
    }

    // 场景推断
    const result = this.inferScene(signals);

    const duration = Date.now() - startTime;
    console.log(`Scene inference completed in ${duration}ms`);

    return result;
  }

  /**
   * 获取时间信号
   * Requirements: 需求 2.1 - 识别工作日/周末、早高峰/晚高峰时段
   * 
   * @returns 时间信号
   */
  getTimeSignal(): ContextSignal {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const isWeekday = day >= 1 && day <= 5;

    let timeValue = 'UNKNOWN';
    let weight = 0.6;

    if (isWeekday) {
      if (hour >= 7 && hour < 9.5) {
        timeValue = 'MORNING_RUSH';
        weight = 0.7;
      } else if (hour >= 17 && hour < 19.5) {
        timeValue = 'EVENING_RUSH';
        weight = 0.7;
      } else if (hour >= 9 && hour < 17) {
        timeValue = 'WORK_HOURS';
        weight = 0.6;
      } else if (hour >= 19 && hour < 24) {
        timeValue = 'EVENING';
        weight = 0.5;
      } else if (hour >= 23 || hour < 7) {
        timeValue = 'NIGHT';
        weight = 0.6;
      }
    } else {
      if (hour >= 23 || hour < 7) {
        timeValue = 'NIGHT';
        weight = 0.6;
      } else {
        timeValue = 'WEEKEND';
        weight = 0.4;
      }
    }

    return {
      type: 'TIME',
      value: timeValue,
      weight,
      timestamp: Date.now(),
    };
  }

  /**
   * 获取位置信号
   * Requirements: 需求 2.1（位置判断）
   * 
   * @returns 位置信号或 null
   */
  private async getLocationSignal(): Promise<ContextSignal | null> {
    try {
      const location = await sceneBridge.getCurrentLocation();
      
      // 简单的位置分类逻辑
      // 在实际应用中，应该与用户配置的地理围栏进行匹配
      // 这里提供基础的占位符实现
      
      // TODO: 实现与 GeoFence 的匹配逻辑
      // 目前返回一个通用的位置信号
      return {
        type: 'LOCATION',
        value: 'UNKNOWN_LOCATION',
        weight: 0.5,
        timestamp: Date.now(),
      };
    } catch (error) {
      // 权限未授予或其他错误
      return null;
    }
  }

  /**
   * 获取 Wi-Fi 信号
   * Requirements: 需求 5.1（到家场景 Wi-Fi 判断）
   * 
   * @returns Wi-Fi 信号或 null
   */
  private async getWiFiSignal(): Promise<ContextSignal | null> {
    try {
      const wifi = await sceneBridge.getConnectedWiFi();
      
      if (!wifi || !wifi.ssid) {
        return null;
      }

      // 简单的 Wi-Fi 分类逻辑
      // 在实际应用中，应该与用户配置的家庭/办公室 Wi-Fi 进行匹配
      // 这里提供基础的启发式规则
      
      let locationHint = 'UNKNOWN_WIFI';
      let weight = 0.7;

      const ssidLower = wifi.ssid.toLowerCase();
      
      // 检测常见的家庭 Wi-Fi 命名模式
      if (ssidLower.includes('home') || 
          ssidLower.includes('家') || 
          ssidLower.includes('house')) {
        locationHint = 'HOME';
        weight = 0.9;
      } 
      // 检测常见的办公室 Wi-Fi 命名模式
      else if (ssidLower.includes('office') || 
               ssidLower.includes('work') || 
               ssidLower.includes('公司') ||
               ssidLower.includes('corp')) {
        locationHint = 'OFFICE';
        weight = 0.9;
      }

      return {
        type: 'WIFI',
        value: locationHint,
        weight,
        timestamp: Date.now(),
      };
    } catch (error) {
      // 权限未授予或其他错误
      return null;
    }
  }

  /**
   * 获取运动状态信号
   * Requirements: 需求 2.1（通勤运动状态）
   * 
   * @returns 运动状态信号或 null
   */
  private async getMotionSignal(): Promise<ContextSignal | null> {
    try {
      const motion = await sceneBridge.getMotionState();
      
      if (!motion) {
        return null;
      }

      // 运动状态权重
      let weight = 0.6;
      
      // 根据运动状态调整权重
      switch (motion) {
        case 'WALKING':
          weight = 0.7;
          break;
        case 'VEHICLE':
          weight = 0.8;
          break;
        case 'RUNNING':
          weight = 0.7;
          break;
        case 'STILL':
          weight = 0.5;
          break;
      }

      return {
        type: 'MOTION',
        value: motion,
        weight,
        timestamp: Date.now(),
      };
    } catch (error) {
      // 权限未授予或其他错误
      return null;
    }
  }

  /**
   * 获取前台应用信号
   * 
   * @returns 前台应用信号或 null
   */
  private async getForegroundAppSignal(): Promise<ContextSignal | null> {
    try {
      const packageName = await sceneBridge.getForegroundApp();
      
      // 根据应用包名推断场景
      let sceneHint = 'UNKNOWN';
      let weight = 0.3;

      if (packageName.includes('music') || packageName.includes('spotify')) {
        sceneHint = 'COMMUTE_OR_LEISURE';
        weight = 0.4;
      } else if (packageName.includes('zoom') || packageName.includes('meeting')) {
        sceneHint = 'OFFICE';
        weight = 0.5;
      } else if (packageName.includes('study') || packageName.includes('learn')) {
        sceneHint = 'STUDY';
        weight = 0.5;
      }

      return {
        type: 'FOREGROUND_APP',
        value: sceneHint,
        weight,
        timestamp: Date.now(),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 场景推断 - 简单加权投票
   * Requirements: 需求 1.3 - 输出场景标签和置信度
   * 
   * @param signals 信号列表
   * @returns 场景上下文
   */
  private inferScene(signals: ContextSignal[]): SilentContext {
    const sceneScores: SceneScores = new Map();

    // 遍历所有信号，累加场景得分
    for (const signal of signals) {
      const scenes = this.signalToScenes(signal);
      for (const [scene, score] of scenes) {
        const currentScore = sceneScores.get(scene) || 0;
        sceneScores.set(scene, currentScore + score * signal.weight);
      }
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

    // 归一化置信度到 0-1 范围
    // 假设最大可能得分为所有信号权重之和
    const maxPossibleScore = signals.reduce((sum, s) => sum + s.weight, 0);
    const confidence = maxPossibleScore > 0 
      ? Math.min(maxScore / maxPossibleScore, 1.0)
      : 0;

    return {
      timestamp: Date.now(),
      context: bestScene,
      confidence,
      signals,
    };
  }

  /**
   * 将信号映射到可能的场景及其得分
   * 
   * @param signal 上下文信号
   * @returns 场景得分映射
   */
  private signalToScenes(signal: ContextSignal): Map<SceneType, number> {
    const scenes: Map<SceneType, number> = new Map();

    switch (signal.type) {
      case 'TIME':
        this.mapTimeToScenes(signal.value, scenes);
        break;
      case 'LOCATION':
        this.mapLocationToScenes(signal.value, scenes);
        break;
      case 'MOTION':
        this.mapMotionToScenes(signal.value, scenes);
        break;
      case 'WIFI':
        this.mapWiFiToScenes(signal.value, scenes);
        break;
      case 'FOREGROUND_APP':
        this.mapAppToScenes(signal.value, scenes);
        break;
      default:
        break;
    }

    return scenes;
  }

  /**
   * 时间信号到场景的映射
   */
  private mapTimeToScenes(timeValue: string, scenes: SceneScores): void {
    switch (timeValue) {
      case 'MORNING_RUSH':
      case 'EVENING_RUSH':
        scenes.set('COMMUTE', 1.0);
        break;
      case 'WORK_HOURS':
        scenes.set('OFFICE', 0.8);
        scenes.set('STUDY', 0.3);
        break;
      case 'EVENING':
        scenes.set('HOME', 0.6);
        scenes.set('STUDY', 0.5);
        break;
      case 'NIGHT':
        scenes.set('SLEEP', 0.8);
        scenes.set('HOME', 0.7);
        break;
      case 'WEEKEND':
        scenes.set('HOME', 0.5);
        break;
      default:
        scenes.set('UNKNOWN', 0.1);
        break;
    }
  }

  /**
   * 位置信号到场景的映射
   */
  private mapLocationToScenes(locationValue: string, scenes: SceneScores): void {
    switch (locationValue) {
      case 'HOME':
        scenes.set('HOME', 1.0);
        scenes.set('SLEEP', 0.3);
        break;
      case 'OFFICE':
        scenes.set('OFFICE', 1.0);
        break;
      case 'SUBWAY_STATION':
        scenes.set('COMMUTE', 1.0);
        break;
      case 'AIRPORT':
      case 'TRAIN_STATION':
        scenes.set('TRAVEL', 1.0);
        break;
      default:
        break;
    }
  }

  /**
   * 运动状态到场景的映射
   */
  private mapMotionToScenes(motionValue: string, scenes: SceneScores): void {
    switch (motionValue) {
      case 'WALKING':
        scenes.set('COMMUTE', 0.6);
        break;
      case 'VEHICLE':
        scenes.set('COMMUTE', 0.8);
        scenes.set('TRAVEL', 0.5);
        break;
      case 'STILL':
        scenes.set('OFFICE', 0.5);
        scenes.set('HOME', 0.5);
        scenes.set('STUDY', 0.5);
        break;
      default:
        break;
    }
  }

  /**
   * Wi-Fi 信号到场景的映射
   */
  private mapWiFiToScenes(wifiValue: string, scenes: SceneScores): void {
    // Wi-Fi SSID 通常需要用户配置
    // 这里提供基本的映射逻辑
    if (wifiValue.includes('HOME')) {
      scenes.set('HOME', 1.0);
    } else if (wifiValue.includes('OFFICE')) {
      scenes.set('OFFICE', 1.0);
    }
  }

  /**
   * 前台应用到场景的映射
   */
  private mapAppToScenes(appValue: string, scenes: SceneScores): void {
    switch (appValue) {
      case 'COMMUTE_OR_LEISURE':
        scenes.set('COMMUTE', 0.4);
        break;
      case 'OFFICE':
        scenes.set('OFFICE', 0.5);
        break;
      case 'STUDY':
        scenes.set('STUDY', 0.5);
        break;
      default:
        break;
    }
  }

  /**
   * 判断是否应该进行采样
   * 
   * @param signalType 信号类型
   * @returns 是否应该采样
   */
  private async shouldSample(signalType: SignalType): Promise<boolean> {
    const lastTime = this.lastSampleTime.get(signalType) || 0;
    const now = Date.now();
    
    let interval: number;
    switch (signalType) {
      case 'LOCATION':
        interval = this.samplingIntervals.location;
        break;
      case 'MOTION':
        interval = this.samplingIntervals.motion;
        break;
      case 'WIFI':
        interval = this.samplingIntervals.wifi;
        break;
      case 'FOREGROUND_APP':
        interval = this.samplingIntervals.foregroundApp;
        break;
      default:
        return true;
    }

    return (now - lastTime) >= interval;
  }

  /**
   * 更新信号缓存和采样时间
   * 
   * @param signalType 信号类型
   * @param signal 信号数据
   */
  private updateCache(signalType: SignalType, signal: ContextSignal): void {
    this.signalCache.set(signalType, signal);
    this.lastSampleTime.set(signalType, Date.now());
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.signalCache.clear();
    this.lastSampleTime.clear();
  }
}

/**
 * 导出单例实例
 */
export const silentContextEngine = new SilentContextEngine();

