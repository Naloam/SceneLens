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
   * 兜底候选包名，用于各类别缺省时的填充
   */
  private readonly fallbackCandidates: Record<AppCategory, string[]> = {
    MUSIC_PLAYER: ['com.netease.cloudmusic', 'com.tencent.qqmusic', 'com.spotify.music'],
    TRANSIT_APP: ['com.eg.android.AlipayGphone', 'com.sdu.didi.psnger', 'com.autonavi.minimap', 'com.baidu.BaiduMap', 'com.tencent.map'],
    PAYMENT_APP: ['com.eg.android.AlipayGphone', 'com.tencent.mm'],
    MEETING_APP: ['com.tencent.wework', 'com.tencent.wemeet.app', 'com.ss.android.lark', 'us.zoom.videomeetings', 'com.microsoft.teams'],
    STUDY_APP: ['com.duolingo', 'com.yc.seed', 'com.tencent.edu', 'com.youdao.dict'],
    SMART_HOME: ['com.xiaomi.smarthome', 'com.yeelight.cherry', 'com.tuya.smart'],
    CALENDAR: ['com.android.calendar', 'com.google.android.calendar', 'com.tencent.qcalendar'],
    OTHER: [],
  };

  /**
   * 初始化应用发现引擎
   * 扫描已安装应用、分类、获取使用统计、计算偏好
   */
  async initialize(): Promise<void> {
    try {
      console.log('[AppDiscoveryEngine] Initializing...');

      // 1. 扫描已安装应用
      let rawApps: AppInfo[] = [];

      try {
        rawApps = await sceneBridge.getInstalledApps();
        console.log(`[AppDiscoveryEngine] Found ${rawApps.length} installed apps`);
      } catch (error) {
        console.warn('[AppDiscoveryEngine] getInstalledApps failed, using fallback dataset:', error);
        rawApps = [];
      }

      // 如果原生层暂未返回数据或调用失败，使用兜底样本，确保 UI 有内容可展示
      if (!rawApps || rawApps.length === 0) {
        console.warn('[AppDiscoveryEngine] Installed app list is empty, using fallback dataset');
        rawApps = this.getFallbackApps();
      }

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

      // 5. 为缺失类别填充兜底应用（优先已安装，否则用示例包名）
      this.fillMissingCategoriesWithFallbacks(rawApps);

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

    // 音乐播放器 - 扩展关键词
    if (
      packageName.includes('music') ||
      packageName.includes('spotify') ||
      packageName.includes('netease') ||
      packageName.includes('qqmusic') ||
      packageName.includes('kugou') ||
      packageName.includes('kuwo') ||
      packageName.includes('migu') ||
      packageName.includes('joyose') ||
      packageName.includes('kgmusic') ||
      packageName.includes('melon') ||
      appName.includes('music') ||
      appName.includes('音乐') ||
      appName.includes('spotify') ||
      appName.includes('网易云') ||
      appName.includes('酷狗') ||
      appName.includes('酷我') ||
      appName.includes('咪咕') ||
      appName.includes('汽水') ||
      appName.includes('千千') ||
      appName.includes('荔枝') ||
      appName.includes('喜马拉雅')
    ) {
      return 'MUSIC_PLAYER';
    }

    // 交通出行 - 扩展关键词
    if (
      packageName.includes('metro') ||
      packageName.includes('transit') ||
      packageName.includes('subway') ||
      packageName.includes('didi') ||
      packageName.includes('uber') ||
      packageName.includes('12306') ||
      packageName.includes('ctrip') ||
      packageName.includes('qunar') ||
      packageName.includes('tuniu') ||
      packageName.includes('map') ||
      packageName.includes('amap') ||
      packageName.includes('baidu') ||
      packageName.includes('tencent') && packageName.includes('map') ||
      packageName.includes('gaode') ||
      packageName.includes('navinfo') ||
      packageName.includes('alipay') && appName.includes('乘车') ||
      appName.includes('地铁') ||
      appName.includes('公交') ||
      appName.includes('出行') ||
      appName.includes('打车') ||
      appName.includes('地图') ||
      appName.includes('乘车') ||
      appName.includes('火车') ||
      appName.includes('高铁') ||
      appName.includes('携程') ||
      appName.includes('去哪儿') ||
      appName.includes('途牛') ||
      appName.includes('航旅')
    ) {
      return 'TRANSIT_APP';
    }

    // 支付应用 - 扩展中国支付应用
    if (
      packageName.includes('alipay') ||
      packageName.includes('wechat') ||
      packageName.includes('tenpay') ||
      packageName.includes('pay') ||
      packageName.includes('unionpay') ||
      packageName.includes('cloudpay') ||
      appName.includes('支付宝') ||
      appName.includes('微信支付') ||
      appName.includes('云闪付') ||
      appName.includes('银联') ||
      appName.includes('钱包')
    ) {
      return 'PAYMENT_APP';
    }

    // 会议应用 - 扩展关键词，增加更多中国会议应用
    if (
      packageName.includes('zoom') ||
      packageName.includes('teams') ||
      packageName.includes('meeting') ||
      packageName.includes('webex') ||
      packageName.includes('dingtalk') ||
      packageName.includes('feishu') ||
      packageName.includes('lark') ||
      packageName.includes('wework') ||
      packageName.includes('tencent') && (packageName.includes('meeting') || packageName.includes('conference') || packageName.includes('voov')) ||
      packageName.includes('qixin') ||
      packageName.includes('linknow') ||
      packageName.includes('vmos') ||
      packageName.includes('meebox') ||
      appName.includes('zoom') ||
      appName.includes('teams') ||
      appName.includes('会议') ||
      appName.includes('钉钉') ||
      appName.includes('飞书') ||
      appName.includes('企业微信') ||
      appName.includes('腾讯会议') ||
      appName.includes('voov') ||
      appName.includes('随心') ||
      appName.includes('七辛') ||
      appName.includes('会易') ||
      appName.includes('瞩目') ||
      appName.includes('全时')
    ) {
      return 'MEETING_APP';
    }

    // 学习应用 - 扩展关键词，增加更多中国学习应用
    if (
      packageName.includes('study') ||
      packageName.includes('learn') ||
      packageName.includes('education') ||
      packageName.includes('duolingo') ||
      packageName.includes('anki') ||
      packageName.includes('notion') ||
      packageName.includes('evernote') ||
      packageName.includes('yinxiang') ||
      packageName.includes('moji') ||
      packageName.includes('bear') ||
      packageName.includes('flomo') ||
      packageName.includes('wiz') ||
      packageName.includes('knowledge') ||
      packageName.includes('course') ||
      packageName.includes('tutor') ||
      packageName.includes('dictionary') ||
      packageName.includes('word') ||
      packageName.includes('quiz') ||
      packageName.includes('flashcard') ||
      packageName.includes('yd') || // 有道
      packageName.includes('lesson') ||
      packageName.includes('homework') ||
      appName.includes('学习') ||
      appName.includes('教育') ||
      appName.includes('笔记') ||
      appName.includes('墨墨') ||
      appName.includes('notion') ||
      appName.includes('anki') ||
      appName.includes('flomo') ||
      appName.includes('为知') ||
      appName.includes('印象笔记') ||
      appName.includes('有道') ||
      appName.includes('百词斩') ||
      appName.includes('扇贝') ||
      appName.includes('可可') ||
      appName.includes('作业帮') ||
      appName.includes('小猿') ||
      appName.includes('题霸') ||
      appName.includes('单词') ||
      appName.includes('背单词') ||
      appName.includes('课程') ||
      appName.includes('网课')
    ) {
      return 'STUDY_APP';
    }

    // 智能家居 - 扩展关键词
    if (
      packageName.includes('smarthome') ||
      packageName.includes('xiaomi.smarthome') ||
      packageName.includes('huawei.smarthome') ||
      packageName.includes('homekit') ||
      packageName.includes('tuya') ||
      packageName.includes('yeelight') ||
      packageName.includes('miot') ||
      packageName.includes('ijia') ||
      packageName.includes('orvibo') ||
      packageName.includes('aqara') ||
      appName.includes('智能家居') ||
      appName.includes('米家') ||
      appName.includes('小米智能') ||
      appName.includes('涂鸦') ||
      appName.includes('yeelight') ||
      appName.includes('绿米') ||
      appName.includes('欧瑞博')
    ) {
      return 'SMART_HOME';
    }

    // 日历 - 扩展关键词，增加中国日历应用
    if (
      packageName.includes('calendar') ||
      packageName.includes('calendars') ||
      packageName.includes('schedule') ||
      packageName.includes('agenda') ||
      packageName.includes('qcalendar') || // 腾讯日历
      packageName.includes('miui') && appName.includes('日历') || // 小米日历
      packageName.includes('hw') && packageName.includes('calendar') || // 华为日历
      packageName.includes('coloros') && packageName.includes('calendar') || // OPPO日历
      packageName.includes('flyme') && packageName.includes('calendar') || // 魅族日历
      packageName.includes('vivo') && packageName.includes('calendar') || // vivo日历
      packageName.includes('time') || // 黄历类应用
      packageName.includes('almanac') ||
      appName.includes('日历') ||
      appName.includes('calendar') ||
      appName.includes('日程') ||
      appName.includes('时间') ||
      appName.includes('黄历') ||
      appName.includes('万年历') ||
      appName.includes('闹钟')
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
      const launchScore = stats.launchCount ?? 0;
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

  /**
   * 在分类结果缺失时，用已安装应用中的“已知包名列表”填充默认 Top1
   */
  private fillMissingCategoriesWithFallbacks(installed: AppInfo[]): void {
    const installedSet = new Set(installed.map(a => a.packageName));
    const categories: AppCategory[] = ['MUSIC_PLAYER', 'TRANSIT_APP', 'MEETING_APP', 'STUDY_APP', 'SMART_HOME', 'CALENDAR', 'PAYMENT_APP'];

    for (const cat of categories) {
      const pref = this.preferences.get(cat);
      if (pref && pref.topApps.length > 0) continue;

      const candidates = this.fallbackCandidates[cat] || [];
      const foundInstalled = candidates.find(pkg => installedSet.has(pkg));

      // 优先使用已安装的候选；若没有，也用第一个兜底包名填充，至少让 UI 可选
      const chosen = foundInstalled ?? candidates[0];
      if (chosen) {
        console.log(`[AppDiscoveryEngine] Fallback set for ${cat}: ${chosen}${foundInstalled ? ' (installed)' : ' (not installed)'}`);
        this.preferences.set(cat, {
          category: cat,
          topApps: [chosen],
          lastUpdated: Date.now(),
        });
      }
    }
  }

  /**
   * 当原生扫描返回空结果时使用的兜底应用数据，便于场景配置页展示
   */
  private getFallbackApps(): AppInfo[] {
    return [
      {
        packageName: 'com.eg.android.AlipayGphone',
        appName: '支付宝·乘车码',
        category: 'TRANSIT_APP',
        icon: '',
        isSystemApp: false,
      },
      {
        packageName: 'com.autonavi.minimap',
        appName: '高德地图',
        category: 'TRANSIT_APP',
        icon: '',
        isSystemApp: false,
      },
      {
        packageName: 'com.netease.cloudmusic',
        appName: '网易云音乐',
        category: 'MUSIC_PLAYER',
        icon: '',
        isSystemApp: false,
      },
      {
        packageName: 'com.tencent.wework',
        appName: '企业微信',
        category: 'MEETING_APP',
        icon: '',
        isSystemApp: false,
      },
      {
        packageName: 'com.microsoft.teams',
        appName: 'Microsoft Teams',
        category: 'MEETING_APP',
        icon: '',
        isSystemApp: false,
      },
      {
        packageName: 'com.xiaomi.smarthome',
        appName: '米家',
        category: 'SMART_HOME',
        icon: '',
        isSystemApp: false,
      },
      {
        packageName: 'com.android.calendar',
        appName: '系统日历',
        category: 'CALENDAR',
        icon: '',
        isSystemApp: false,
      },
      {
        packageName: 'com.duolingo',
        appName: '多邻国',
        category: 'STUDY_APP',
        icon: '',
        isSystemApp: false,
      },
    ];
  }
}

// 导出单例实例
export const appDiscoveryEngine = new AppDiscoveryEngine();

export default appDiscoveryEngine;
