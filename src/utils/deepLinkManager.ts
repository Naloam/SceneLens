/**
 * DeepLinkManager - Deep Link 优化管理器
 *
 * 职责：
 * - 预加载常用应用信息
 * - 优化 Deep Link 解析
 * - 维护 Deep Link 健康状态
 *
 * Requirements: 需求 12.2（优化应用启动速度）
 */

import SceneBridge from '../core/SceneBridge';
import { appCache, SceneCacheKeyBuilder } from './cacheManager';

/**
 * Deep Link 配置
 */
export interface DeepLinkConfig {
  packageName: string;
  appName: string;
  deepLinks: Array<{
    action: string;
    url: string;
    priority: number;
  }>;
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  packageName: string;
  deepLink: string;
  isHealthy: boolean;
  error?: string;
  lastChecked: number;
}

/**
 * Deep Link 管理器类
 */
export class DeepLinkManager {
  private deepLinkConfigs: Map<string, DeepLinkConfig> = new Map();
  private healthCache: Map<string, HealthCheckResult> = new Map();
  private isInitialized = false;

  /**
   * 初始化 Deep Link 管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[DeepLinkManager] Initializing...');

    // 加载内置 Deep Link 配置
    await this.loadBuiltInConfigs();

    // 执行初始健康检查（异步执行，不阻塞初始化）
    this.performInitialHealthCheck().catch(error => {
      console.warn('[DeepLinkManager] Initial health check failed:', error);
    });

    this.isInitialized = true;
    console.log('[DeepLinkManager] Initialization complete');
  }

  /**
   * 加载内置 Deep Link 配置
   */
  private async loadBuiltInConfigs(): Promise<void> {
    const builtInConfigs: DeepLinkConfig[] = [
      {
        packageName: 'com.eg.android.AlipayGphone',
        appName: '支付宝',
        deepLinks: [
          {
            action: 'open_ticket_qr',
            url: 'alipays://platformapi/startapp?appId=200011235',
            priority: 1,
          },
          {
            action: 'open_home',
            url: 'alipays://',
            priority: 2,
          },
        ],
      },
      {
        packageName: 'com.netease.cloudmusic',
        appName: '网易云音乐',
        deepLinks: [
          {
            action: 'launch_with_playlist',
            url: 'orpheus://playlist',
            priority: 1,
          },
          {
            action: 'open_home',
            url: 'orpheus://',
            priority: 2,
          },
        ],
      },
      {
        packageName: 'com.tencent.wework',
        appName: '企业微信',
        deepLinks: [
          {
            action: 'open_meeting',
            url: 'wxwork://',
            priority: 1,
          },
          {
            action: 'open_home',
            url: 'wxwork://',
            priority: 2,
          },
        ],
      },
      {
        packageName: 'com.android.calendar',
        appName: '系统日历',
        deepLinks: [
          {
            action: 'open_calendar',
            url: 'content://com.android.calendar/events',
            priority: 1,
          },
        ],
      },
      {
        packageName: 'com.xiaomi.smarthome',
        appName: '米家',
        deepLinks: [
          {
            action: 'open_home',
            url: 'mjhome://',
            priority: 1,
          },
        ],
      },
      {
        packageName: 'com.MobileTicket',
        appName: '铁路12306',
        deepLinks: [
          {
            action: 'open_ticket_qr',
            url: 'ctrip://train',
            priority: 1,
          },
          {
            action: 'open_home',
            url: 'mobileticket://',
            priority: 2,
          },
        ],
      },
      {
        packageName: 'camp.firefly.foresto',
        appName: 'Forest',
        deepLinks: [
          {
            action: 'start_focus',
            url: 'forest://focus',
            priority: 1,
          },
        ],
      },
    ];

    for (const config of builtInConfigs) {
      this.deepLinkConfigs.set(config.packageName, config);
    }

    console.log(`[DeepLinkManager] Loaded ${builtInConfigs.length} built-in configs`);
  }

  /**
   * 获取应用的 Deep Link
   *
   * @param packageName 包名
   * @param action 动作类型
   * @returns Deep Link URL 或 null
   */
  getDeepLink(packageName: string, action?: string): string | null {
    const config = this.deepLinkConfigs.get(packageName);
    if (!config) {
      return null;
    }

    if (action) {
      // 查找指定动作的 Deep Link
      const matched = config.deepLinks.find(dl => dl.action === action);
      if (matched) {
        // 检查健康状态
        const healthKey = this.getHealthKey(packageName, matched.url);
        const health = this.healthCache.get(healthKey);
        if (health && !health.isHealthy) {
          console.warn(`[DeepLinkManager] Deep link unhealthy, falling back: ${healthKey}`);
          // 尝试使用优先级较低的 Deep Link
          const fallback = config.deepLinks.find(dl => dl.action === 'open_home');
          return fallback?.url ?? null;
        }
        return matched.url;
      }
    }

    // 返回第一个可用的 Deep Link
    const firstHealthy = config.deepLinks.find(dl => {
      const healthKey = this.getHealthKey(packageName, dl.url);
      const health = this.healthCache.get(healthKey);
      return !health || health.isHealthy;
    });

    return firstHealthy?.url ?? config.deepLinks[0]?.url ?? null;
  }

  /**
   * 使用 Deep Link 打开应用
   *
   * @param packageName 包名
   * @param deepLink Deep Link URL（可选，会自动查找）
   * @param action 动作类型（可选）
   * @returns 是否成功
   */
  async openAppWithDeepLink(
    packageName: string,
    deepLink?: string,
    action?: string
  ): Promise<boolean> {
    try {
      // 检查应用是否已安装
      const isInstalled = await SceneBridge.isAppInstalled(packageName);
      if (!isInstalled) {
        console.warn(`[DeepLinkManager] App not installed: ${packageName}`);
        return false;
      }

      // 确定要使用的 Deep Link
      const targetLink = deepLink ?? this.getDeepLink(packageName, action);
      if (!targetLink) {
        console.warn(`[DeepLinkManager] No deep link found for ${packageName}`);
        return false;
      }

      // 尝试打开
      const success = await SceneBridge.openAppWithDeepLink(packageName, targetLink);
      if (success) {
        // 更新健康状态
        this.updateHealthStatus(packageName, targetLink, true);
        return true;
      }

      // 失败时更新健康状态
      this.updateHealthStatus(packageName, targetLink, false, 'Launch failed');

      // 尝试降级到首页
      if (action && action !== 'open_home') {
        const homeLink = this.getDeepLink(packageName, 'open_home');
        if (homeLink && homeLink !== targetLink) {
          console.log(`[DeepLinkManager] Falling back to home link for ${packageName}`);
          const fallbackSuccess = await SceneBridge.openAppWithDeepLink(packageName, homeLink);
          this.updateHealthStatus(packageName, homeLink, fallbackSuccess, fallbackSuccess ? undefined : 'Fallback failed');
          return fallbackSuccess;
        }
      }

      return false;
    } catch (error) {
      console.error(`[DeepLinkManager] Error opening app ${packageName}:`, error);
      if (deepLink) {
        this.updateHealthStatus(packageName, deepLink, false, error instanceof Error ? error.message : String(error));
      }
      return false;
    }
  }

  /**
   * 解析意图为包名（带缓存优化）
   *
   * @param intent 意图字符串
   * @returns 包名或 null
   */
  resolveIntentWithCache(intent: string): string | null {
    const cacheKey = SceneCacheKeyBuilder.buildAppIntentKey(intent);

    // 尝试从缓存获取
    const cached = appCache.get<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // 简单的意图解析
    const match = intent.match(/^(\w+)_TOP(\d+)$/);
    if (!match) {
      return null;
    }

    const [, category, index] = match;
    const idx = parseInt(index) - 1;

    // 兜底映射（可由 AppDiscoveryEngine 覆盖）
    const fallbackMap: Record<string, string[]> = {
      MUSIC_PLAYER: ['com.netease.cloudmusic', 'com.tencent.qqmusic'],
      TRANSIT_APP: ['com.eg.android.AlipayGphone', 'com.autonavi.minimap'],
      MEETING_APP: ['com.tencent.wework', 'com.ss.android.lark'],
      STUDY_APP: ['camp.firefly.foresto', 'com.duolingo'],
      CALENDAR: ['com.android.calendar', 'com.google.android.calendar'],
      SMART_HOME: ['com.xiaomi.smarthome', 'com.yeelight.cherry'],
      TRAVEL_APP: ['com.MobileTicket', 'com.ctrip.ctrip'],
      PAYMENT_APP: ['com.eg.android.AlipayGphone', 'com.tencent.mm'],
    };

    const candidates = fallbackMap[category];
    const packageName = candidates?.[idx] ?? null;

    // 缓存结果
    if (packageName) {
      appCache.set(cacheKey, packageName);
    }

    return packageName;
  }

  /**
   * 执行初始健康检查（异步）
   */
  private async performInitialHealthCheck(): Promise<void> {
    const criticalApps = [
      { packageName: 'com.eg.android.AlipayGphone', deepLink: 'alipays://platformapi/startapp?appId=200011235' },
      { packageName: 'com.netease.cloudmusic', deepLink: 'orpheus://' },
      { packageName: 'com.android.calendar', deepLink: 'content://com.android.calendar/events' },
    ];

    console.log('[DeepLinkManager] Performing initial health check...');

    for (const app of criticalApps) {
      try {
        const isValid = await this.validateDeepLink(app.deepLink);
        this.updateHealthStatus(app.packageName, app.deepLink, isValid);
      } catch (error) {
        console.warn(`[DeepLinkManager] Health check failed for ${app.packageName}:`, error);
        this.updateHealthStatus(app.packageName, app.deepLink, false, 'Validation failed');
      }
    }

    console.log('[DeepLinkManager] Initial health check complete');
  }

  /**
   * 验证 Deep Link 有效性
   *
   * @param deepLink Deep Link URL
   * @returns 是否有效
   */
  private async validateDeepLink(deepLink: string): Promise<boolean> {
    try {
      return await SceneBridge.validateDeepLink(deepLink);
    } catch (error) {
      console.warn(`[DeepLinkManager] Deep link validation failed:`, error);
      return false;
    }
  }

  /**
   * 更新健康状态
   *
   * @param packageName 包名
   * @param deepLink Deep Link URL
   * @param isHealthy 是否健康
   * @param error 错误信息（可选）
   */
  private updateHealthStatus(
    packageName: string,
    deepLink: string,
    isHealthy: boolean,
    error?: string
  ): void {
    const healthKey = this.getHealthKey(packageName, deepLink);
    this.healthCache.set(healthKey, {
      packageName,
      deepLink,
      isHealthy,
      error,
      lastChecked: Date.now(),
    });
  }

  /**
   * 生成健康检查缓存键
   *
   * @param packageName 包名
   * @param deepLink Deep Link URL
   * @returns 缓存键
   */
  private getHealthKey(packageName: string, deepLink: string): string {
    return `${packageName}_${deepLink}`;
  }

  /**
   * 获取健康检查统计
   *
   * @returns 健康检查结果数组
   */
  getHealthStats(): HealthCheckResult[] {
    return Array.from(this.healthCache.values());
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.healthCache.clear();
    console.log('[DeepLinkManager] Cache cleared');
  }
}

// 导出单例实例
export const deepLinkManager = new DeepLinkManager();

export default deepLinkManager;
