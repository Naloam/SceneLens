/**
 * AppDiscoveryEngine - 应用发现引擎
 * 
 * 职责：
 * - 扫描已安装应用
 * - 学习用户偏好
 * - 为规则引擎提供「意图 → 应用」的映射
 * 
 * Requirements: 需求 9.2, 9.4, 9.6
 */

import sceneBridge from '../core/SceneBridge';
import type {
  AppInfo,
  AppCategory,
  AppPreference,
  UsageStats,
} from '../types';

/**
 * 应用发现引擎类
 */
export class AppDiscoveryEngine {
  private preferences: Map<AppCategory, AppPreference> = new Map();
  private apps: AppInfo[] = [];
  private initialized: boolean = false;

  /**
   * 初始化应用发现引擎
   * 扫描已安装应用、分类、获取使用统计、计算偏好
   */
  async initialize(): Promise<void> {
    try {
      console.log('[AppDiscoveryEngine] Initializing...');

      // 1. 扫描已安装应用
      const rawApps = await sceneBridge.getInstalledApps();
      console.log(`[AppDiscoveryEngine] Found ${rawApps.length} installed apps`);

      // 2. 分类应用
      this.apps = rawApps.map(app => ({
        ...app,
        category: this.detectCategory(app),
      }));

      const categorizedApps = this.categorizeApps(this.apps);
      console.log('[AppDiscoveryEngine] Apps categorized:', 
        Array.from(categorizedApps.entries()).map(([cat, apps]) => 
          `${cat}: ${apps.length}`
        ).join(', ')
      );

      // 3. 获取使用统计（需要权限）
      let usageStats: UsageStats[] = [];
      try {
        usageStats = await sceneBridge.getUsageStats(30);
        console.log(`[AppDiscoveryEngine] Got usage stats for ${usageStats.length} apps`);
      } catch (error) {
        console.warn('[AppDiscoveryEngine] Failed to get usage stats:', error);
        // 继续执行，但没有使用统计数据
      }

      // 4. 计算偏好
      for (const [category, apps] of categorizedApps) {
        const ranked = this.rankAppsByUsage(apps, usageStats);
        this.preferences.set(category, {
          category,
          topApps: ranked.slice(0, 3).map(a => a.packageName),
          lastUpdated: Date.now(),
        });
      }

      this.initialized = true;
      console.log('[AppDiscoveryEngine] Initialization complete');
    } catch (error) {
      console.error('[AppDiscoveryEngine] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 检测应用类别
   * 基于包名和应用名的启发式规则
   * 
   * @param app 应用信息
   * @returns 应用类别
   */
  detectCategory(app: AppInfo): AppCategory {
    const packageName = app.packageName.toLowerCase();
    const appName = app.appName.toLowerCase();

    // 音乐播放器
    if (
      packageName.includes('music') ||
      packageName.includes('spotify') ||
      packageName.includes('netease') ||
      packageName.includes('qqmusic') ||
      packageName.includes('kugou') ||
      packageName.includes('kuwo') ||
      appName.includes('music') ||
      appName.includes('音乐') ||
      appName.includes('spotify')
    ) {
      return 'MUSIC_PLAYER';
    }

    // 交通出行
    if (
      packageName.includes('metro') ||
      packageName.includes('transit') ||
      packageName.includes('subway') ||
      packageName.includes('didi') ||
      packageName.includes('uber') ||
      packageName.includes('12306') ||
      (packageName.includes('alipay') && appName.includes('乘车')) ||
      appName.includes('地铁') ||
      appName.includes('公交') ||
      appName.includes('出行') ||
      appName.includes('打车')
    ) {
      return 'TRANSIT_APP';
    }

    // 支付应用
    if (
      packageName.includes('alipay') ||
      packageName.includes('wechat') ||
      packageName.includes('pay') ||
      appName.includes('支付宝') ||
      appName.includes('微信支付')
    ) {
      return 'PAYMENT_APP';
    }

    // 会议应用
    if (
      packageName.includes('zoom') ||
      packageName.includes('teams') ||
      packageName.includes('meeting') ||
      packageName.includes('webex') ||
      packageName.includes('dingtalk') ||
      packageName.includes('feishu') ||
      packageName.includes('wechat.work') ||
      appName.includes('zoom') ||
      appName.includes('会议') ||
      appName.includes('钉钉') ||
      appName.includes('飞书') ||
      appName.includes('企业微信')
    ) {
      return 'MEETING_APP';
    }

    // 学习应用
    if (
      packageName.includes('study') ||
      packageName.includes('learn') ||
      packageName.includes('education') ||
      packageName.includes('duolingo') ||
      packageName.includes('anki') ||
      packageName.includes('notion') ||
      packageName.includes('evernote') ||
      appName.includes('学习') ||
      appName.includes('教育') ||
      appName.includes('笔记')
    ) {
      return 'STUDY_APP';
    }

    // 智能家居
    if (
      packageName.includes('smarthome') ||
      packageName.includes('xiaomi.smarthome') ||
      packageName.includes('huawei.smarthome') ||
      packageName.includes('homekit') ||
      appName.includes('智能家居') ||
      appName.includes('米家') ||
      appName.includes('小米智能')
    ) {
      return 'SMART_HOME';
    }

    // 日历
    if (
      packageName.includes('calendar') ||
      appName.includes('日历') ||
      appName.includes('calendar')
    ) {
      return 'CALENDAR';
    }

    // 默认类别
    return 'OTHER';
  }

  /**
   * 将应用按类别分组
   * 
   * @param apps 应用列表
   * @returns 按类别分组的应用
   */
  private categorizeApps(apps: AppInfo[]): Map<AppCategory, AppInfo[]> {
    const result = new Map<AppCategory, AppInfo[]>();

    for (const app of apps) {
      const category = app.category;
      if (!result.has(category)) {
        result.set(category, []);
      }
      result.get(category)!.push(app);
    }

    return result;
  }

  /**
   * 根据使用统计对应用进行排序
   * 
   * @param apps 应用列表
   * @param usageStats 使用统计
   * @returns 排序后的应用列表
   */
  private rankAppsByUsage(apps: AppInfo[], usageStats: UsageStats[]): AppInfo[] {
    // 创建使用统计的映射
    const statsMap = new Map<string, UsageStats>();
    for (const stat of usageStats) {
      statsMap.set(stat.packageName, stat);
    }

    // 计算每个应用的得分
    const appsWithScore = apps.map(app => {
      const stats = statsMap.get(app.packageName);
      if (!stats) {
        return { app, score: 0 };
      }

      // 综合考虑使用时长和启动次数
      // 使用时长权重 0.6，启动次数权重 0.4
      const timeScore = stats.totalTimeInForeground / (1000 * 60 * 60); // 转换为小时
      const launchScore = stats.launchCount;
      const score = timeScore * 0.6 + launchScore * 0.4;

      return { app, score };
    });

    // 按得分降序排序
    appsWithScore.sort((a, b) => b.score - a.score);

    return appsWithScore.map(item => item.app);
  }

  /**
   * 解析意图为实际包名
   * 将意图（如 TRANSIT_APP_TOP1）解析为实际包名
   * 
   * @param intent 意图字符串
   * @returns 包名，如果无法解析则返回 null
   */
  resolveIntent(intent: string): string | null {
    // 解析意图格式：CATEGORY_TOP1, CATEGORY_TOP2, etc.
    const match = intent.match(/^(\w+)_TOP(\d+)$/);
    if (!match) {
      console.warn(`[AppDiscoveryEngine] Invalid intent format: ${intent}`);
      return null;
    }

    const [, category, index] = match;
    const pref = this.preferences.get(category as AppCategory);
    if (!pref) {
      console.warn(`[AppDiscoveryEngine] No preference found for category: ${category}`);
      return null;
    }

    const idx = parseInt(index) - 1;
    const packageName = pref.topApps[idx];
    
    if (!packageName) {
      console.warn(`[AppDiscoveryEngine] No app found at index ${index} for category ${category}`);
      return null;
    }

    return packageName;
  }

  /**
   * 获取某个类别的首选应用
   * 
   * @param category 应用类别
   * @returns 应用偏好
   */
  getPreference(category: AppCategory): AppPreference | undefined {
    return this.preferences.get(category);
  }

  /**
   * 获取所有偏好
   * 
   * @returns 所有应用偏好
   */
  getAllPreferences(): Map<AppCategory, AppPreference> {
    return new Map(this.preferences);
  }

  /**
   * 获取所有应用
   * 
   * @returns 所有应用列表
   */
  getAllApps(): AppInfo[] {
    return [...this.apps];
  }

  /**
   * 获取某个类别的所有应用
   * 
   * @param category 应用类别
   * @returns 该类别的应用列表
   */
  getAppsByCategory(category: AppCategory): AppInfo[] {
    return this.apps.filter(app => app.category === category);
  }

  /**
   * 检查是否已初始化
   * 
   * @returns 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 手动设置某个类别的首选应用
   * 用于用户自定义偏好
   * 
   * @param category 应用类别
   * @param packageNames 包名列表
   */
  setPreference(category: AppCategory, packageNames: string[]): void {
    this.preferences.set(category, {
      category,
      topApps: packageNames,
      lastUpdated: Date.now(),
    });
  }
}

// 导出单例实例
export const appDiscoveryEngine = new AppDiscoveryEngine();

export default appDiscoveryEngine;
