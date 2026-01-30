/**
 * DeepLinkManager - Deep Link 优化管理器
 *
 * 职责：
 * - 从 deeplinks.json 加载配置
 * - 优化 Deep Link 解析
 * - 维护 Deep Link 健康状态
 *
 * Requirements: 需求 12.2（优化应用启动速度）
 */

import SceneBridge from '../core/SceneBridge';
import deeplinksConfig from '../config/deeplinks.json';

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
    description?: string;
    fallback?: string;
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
 * JSON 配置中的 Deep Link 条目
 */
interface JsonDeepLinkEntry {
  url: string;
  description: string;
  action: string;
  fallback?: string;
}

/**
 * JSON 配置中的应用配置
 */
interface JsonAppConfig {
  packageName: string;
  name: string;
  deeplinks: JsonDeepLinkEntry[];
}

/**
 * Deep Link 管理器类
 */
export class DeepLinkManager {
  private deepLinkConfigs: Map<string, DeepLinkConfig> = new Map();
  private healthCache: Map<string, HealthCheckResult> = new Map();
  private fallbackPackages: Record<string, string> = {};
  private isInitialized = false;

  /**
   * 初始化 Deep Link 管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[DeepLinkManager] Initializing...');

    // 从 deeplinks.json 加载配置
    this.loadFromJsonConfig();

    // 执行初始健康检查（异步执行，不阻塞初始化）
    this.performInitialHealthCheck().catch(error => {
      console.warn('[DeepLinkManager] Initial health check failed:', error);
    });

    this.isInitialized = true;
    console.log('[DeepLinkManager] Initialization complete');
  }

  /**
   * 从 deeplinks.json 加载配置
   */
  private loadFromJsonConfig(): void {
    const { deeplinks, fallbackPackages } = deeplinksConfig;

    // 保存回退包名配置
    this.fallbackPackages = fallbackPackages || {};

    // 解析各类别下的应用配置
    let totalApps = 0;

    Object.entries(deeplinks).forEach(([category, apps]) => {
      Object.entries(apps as Record<string, JsonAppConfig>).forEach(([appKey, appConfig]) => {
        const config = this.convertJsonToConfig(appConfig);
        this.deepLinkConfigs.set(config.packageName, config);
        totalApps++;
      });
    });

    console.log(`[DeepLinkManager] Loaded ${totalApps} app configs from deeplinks.json`);
  }

  /**
   * 将 JSON 配置转换为内部格式
   */
  private convertJsonToConfig(jsonConfig: JsonAppConfig): DeepLinkConfig {
    return {
      packageName: jsonConfig.packageName,
      appName: jsonConfig.name,
      deepLinks: jsonConfig.deeplinks.map((dl, index) => ({
        action: dl.action,
        url: dl.url,
        priority: index + 1, // 按顺序设置优先级
        description: dl.description,
        fallback: dl.fallback,
      })),
    };
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
          // 尝试使用 open_home 动作
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
   * 通过意图获取包名
   * 
   * @param intent 意图类型，如 TRANSIT_APP_TOP1
   * @returns 包名或 null
   */
  getPackageByIntent(intent: string): string | null {
    return this.fallbackPackages[intent] ?? null;
  }

  /**
   * 使用 Deep Link 打开应用
   *
   * @param packageName 包名
   * @param deepLink Deep Link URL（可选，会自动查找）
   * @param action 动作类型（可选）
   */
  async openWithDeepLink(
    packageName: string,
    deepLink?: string,
    action?: string
  ): Promise<boolean> {
    const url = deepLink ?? this.getDeepLink(packageName, action);
    if (!url) {
      console.warn(`[DeepLinkManager] No deep link found for ${packageName}`);
      return false;
    }

    console.log(`[DeepLinkManager] Opening ${packageName} with deep link: ${url}`);

    try {
      const result = await SceneBridge.openAppWithDeepLink(packageName, url);
      return result;
    } catch (error) {
      console.error(`[DeepLinkManager] Failed to open ${packageName}:`, error);
      // 标记为不健康
      this.markUnhealthy(packageName, url, String(error));
      return false;
    }
  }

  /**
   * 获取所有已配置的应用
   */
  getAllConfigs(): DeepLinkConfig[] {
    return Array.from(this.deepLinkConfigs.values());
  }

  /**
   * 获取指定类别的应用
   */
  getConfigsByCategory(category: string): DeepLinkConfig[] {
    const categoryApps = (deeplinksConfig.deeplinks as Record<string, Record<string, JsonAppConfig>>)[category];
    if (!categoryApps) {
      return [];
    }

    return Object.values(categoryApps)
      .map(appConfig => this.deepLinkConfigs.get(appConfig.packageName))
      .filter((config): config is DeepLinkConfig => config !== undefined);
  }

  /**
   * 检查应用是否已配置
   */
  hasConfig(packageName: string): boolean {
    return this.deepLinkConfigs.has(packageName);
  }

  /**
   * 获取应用配置
   */
  getConfig(packageName: string): DeepLinkConfig | undefined {
    return this.deepLinkConfigs.get(packageName);
  }

  /**
   * 执行初始健康检查
   */
  private async performInitialHealthCheck(): Promise<void> {
    console.log('[DeepLinkManager] Starting initial health check...');

    const configs = Array.from(this.deepLinkConfigs.values());
    const checkPromises: Promise<void>[] = [];

    for (const config of configs) {
      for (const dl of config.deepLinks) {
        checkPromises.push(
          this.checkDeepLinkHealth(config.packageName, dl.url).then(() => {})
        );
      }
    }

    // 限制并发数量
    const batchSize = 5;
    for (let i = 0; i < checkPromises.length; i += batchSize) {
      const batch = checkPromises.slice(i, i + batchSize);
      await Promise.all(batch);
    }

    console.log('[DeepLinkManager] Initial health check complete');
  }

  /**
   * 检查单个 Deep Link 的健康状态
   */
  private async checkDeepLinkHealth(packageName: string, deepLink: string): Promise<boolean> {
    const healthKey = this.getHealthKey(packageName, deepLink);

    try {
      // 检查应用是否安装
      const isInstalled = await SceneBridge.isAppInstalled(packageName);

      const result: HealthCheckResult = {
        packageName,
        deepLink,
        isHealthy: isInstalled,
        lastChecked: Date.now(),
      };

      if (!isInstalled) {
        result.error = 'App not installed';
      }

      this.healthCache.set(healthKey, result);
      return isInstalled;
    } catch (error) {
      const result: HealthCheckResult = {
        packageName,
        deepLink,
        isHealthy: false,
        error: String(error),
        lastChecked: Date.now(),
      };

      this.healthCache.set(healthKey, result);
      return false;
    }
  }

  /**
   * 标记 Deep Link 为不健康
   */
  private markUnhealthy(packageName: string, deepLink: string, error: string): void {
    const healthKey = this.getHealthKey(packageName, deepLink);
    this.healthCache.set(healthKey, {
      packageName,
      deepLink,
      isHealthy: false,
      error,
      lastChecked: Date.now(),
    });
  }

  /**
   * 生成健康检查缓存键
   */
  private getHealthKey(packageName: string, deepLink: string): string {
    return `${packageName}:${deepLink}`;
  }

  /**
   * 获取健康检查报告
   */
  getHealthReport(): HealthCheckResult[] {
    return Array.from(this.healthCache.values());
  }

  /**
   * 清除健康缓存
   */
  clearHealthCache(): void {
    this.healthCache.clear();
  }

  /**
   * 刷新所有健康状态
   */
  async refreshHealth(): Promise<void> {
    this.clearHealthCache();
    await this.performInitialHealthCheck();
  }
}

// 导出单例实例
export const deepLinkManager = new DeepLinkManager();

export default DeepLinkManager;
