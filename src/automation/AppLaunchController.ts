/**
 * AppLaunchController - 应用启动控制器
 * 
 * 提供应用启动和管理能力：
 * - 启动指定应用
 * - 通过 Deep Link 启动应用
 * - 获取已安装应用列表
 * - 检测应用是否安装/运行
 * 
 * @module automation
 */

import { sceneBridge } from '../core/SceneBridge';
import type { AppInfo } from '../types';
import type { DeepLinkConfig, InstalledAppInfo, AppRecommendation } from '../types/automation';

// ==================== 常用应用 Deep Link 配置 ====================

/**
 * 预设的深度链接快捷配置
 */
export const DEEP_LINK_SHORTCUTS: Record<string, DeepLinkConfig> = {
  // 支付类
  wechat_pay: {
    packageName: 'com.tencent.mm',
    deepLink: 'weixin://pay',
    fallback: 'weixin://',
    description: '微信支付',
  },
  wechat_scan: {
    packageName: 'com.tencent.mm',
    deepLink: 'weixin://scanqrcode',
    fallback: 'weixin://',
    description: '微信扫一扫',
  },
  alipay_pay: {
    packageName: 'com.eg.android.AlipayGphone',
    deepLink: 'alipays://platformapi/startapp?appId=20000056',
    fallback: 'alipays://',
    description: '支付宝付款码',
  },
  alipay_scan: {
    packageName: 'com.eg.android.AlipayGphone',
    deepLink: 'alipays://platformapi/startapp?appId=10000007',
    fallback: 'alipays://',
    description: '支付宝扫一扫',
  },
  
  // 出行类
  amap_home: {
    packageName: 'com.autonavi.minimap',
    deepLink: 'androidamap://navi?sourceApplication=scenelens&poiname=家',
    fallback: 'androidamap://',
    description: '高德导航回家',
  },
  amap_work: {
    packageName: 'com.autonavi.minimap',
    deepLink: 'androidamap://navi?sourceApplication=scenelens&poiname=公司',
    fallback: 'androidamap://',
    description: '高德导航去公司',
  },
  baidu_map: {
    packageName: 'com.baidu.BaiduMap',
    deepLink: 'baidumap://map/navi',
    fallback: 'baidumap://',
    description: '百度地图导航',
  },
  didi: {
    packageName: 'com.sdu.didi.psnger',
    deepLink: 'diditaxi://',
    fallback: 'diditaxi://',
    description: '滴滴出行',
  },
  
  // 通讯类
  wechat: {
    packageName: 'com.tencent.mm',
    deepLink: 'weixin://',
    description: '微信',
  },
  qq: {
    packageName: 'com.tencent.mobileqq',
    deepLink: 'mqq://',
    description: 'QQ',
  },
  dingtalk: {
    packageName: 'com.alibaba.android.rimet',
    deepLink: 'dingtalk://',
    description: '钉钉',
  },
  feishu: {
    packageName: 'com.ss.android.lark',
    deepLink: 'lark://',
    description: '飞书',
  },
  
  // 音乐类
  netease_music: {
    packageName: 'com.netease.cloudmusic',
    deepLink: 'orpheus://song/play',
    fallback: 'orpheus://',
    description: '网易云音乐',
  },
  qq_music: {
    packageName: 'com.tencent.qqmusic',
    deepLink: 'qqmusic://',
    description: 'QQ音乐',
  },
  kugou_music: {
    packageName: 'com.kugou.android',
    deepLink: 'kugoumusic://',
    description: '酷狗音乐',
  },
  
  // 视频类
  bilibili: {
    packageName: 'tv.danmaku.bili',
    deepLink: 'bilibili://',
    description: '哔哩哔哩',
  },
  douyin: {
    packageName: 'com.ss.android.ugc.aweme',
    deepLink: 'snssdk1128://',
    description: '抖音',
  },
  
  // 工具类
  calendar: {
    packageName: 'com.google.android.calendar',
    deepLink: 'content://com.android.calendar/time',
    description: '日历',
  },
};

// ==================== 应用启动功能 ====================

/**
 * 启动指定应用
 * @param packageName 应用包名
 * @returns 是否成功启动
 */
export async function launchApp(packageName: string): Promise<boolean> {
  try {
    const result = await sceneBridge.openAppWithDeepLink(packageName);
    console.log(`[AppLaunch] Launched ${packageName}: ${result}`);
    return result;
  } catch (error) {
    console.error(`[AppLaunch] Failed to launch ${packageName}:`, error);
    return false;
  }
}

/**
 * 通过 Deep Link 启动应用
 * @param packageName 应用包名
 * @param deepLink Deep Link URL
 * @returns 是否成功启动
 */
export async function launchAppWithDeepLink(
  packageName: string, 
  deepLink: string
): Promise<boolean> {
  try {
    const result = await sceneBridge.openAppWithDeepLink(packageName, deepLink);
    console.log(`[AppLaunch] Launched ${packageName} with deepLink ${deepLink}: ${result}`);
    return result;
  } catch (error) {
    console.error(`[AppLaunch] Failed to launch ${packageName} with deepLink:`, error);
    return false;
  }
}

/**
 * 通过预设快捷方式启动应用
 * @param shortcutId 快捷方式 ID (如 'wechat_pay', 'alipay_scan')
 * @returns 是否成功启动
 */
export async function launchShortcut(shortcutId: string): Promise<boolean> {
  const config = DEEP_LINK_SHORTCUTS[shortcutId];
  if (!config) {
    console.warn(`[AppLaunch] Unknown shortcut: ${shortcutId}`);
    return false;
  }
  
  // 先检查应用是否安装
  const installed = await isAppInstalled(config.packageName);
  if (!installed) {
    console.warn(`[AppLaunch] App not installed: ${config.packageName}`);
    return false;
  }
  
  // 尝试使用 deepLink 启动
  let success = await launchAppWithDeepLink(config.packageName, config.deepLink);
  
  // 如果失败且有 fallback，尝试 fallback
  if (!success && config.fallback) {
    console.log(`[AppLaunch] Trying fallback for ${shortcutId}`);
    success = await launchAppWithDeepLink(config.packageName, config.fallback);
  }
  
  // 如果仍然失败，尝试直接启动应用
  if (!success) {
    console.log(`[AppLaunch] Trying direct launch for ${shortcutId}`);
    success = await launchApp(config.packageName);
  }
  
  return success;
}

// ==================== 应用信息查询 ====================

/**
 * 检查应用是否已安装
 * @param packageName 应用包名
 */
export async function isAppInstalled(packageName: string): Promise<boolean> {
  try {
    return await sceneBridge.isAppInstalled(packageName);
  } catch (error) {
    console.error(`[AppLaunch] Failed to check app installed:`, error);
    return false;
  }
}

/**
 * 验证 Deep Link 是否有效
 * @param deepLink Deep Link URL
 */
export async function validateDeepLink(deepLink: string): Promise<boolean> {
  try {
    return await sceneBridge.validateDeepLink(deepLink);
  } catch (error) {
    console.error(`[AppLaunch] Failed to validate deepLink:`, error);
    return false;
  }
}

/**
 * 获取已安装应用列表
 */
export async function getInstalledApps(): Promise<InstalledAppInfo[]> {
  try {
    const apps = await sceneBridge.getInstalledApps();
    return apps.map((app: AppInfo) => ({
      packageName: app.packageName,
      appName: app.appName,
      isSystemApp: app.isSystemApp,
      category: app.category,
      icon: app.icon,
    }));
  } catch (error) {
    console.error(`[AppLaunch] Failed to get installed apps:`, error);
    return [];
  }
}

/**
 * 获取前台应用包名
 */
export async function getForegroundApp(): Promise<string> {
  try {
    return await sceneBridge.getForegroundApp();
  } catch (error) {
    console.error(`[AppLaunch] Failed to get foreground app:`, error);
    return '';
  }
}

/**
 * 检查应用是否在前台运行
 * @param packageName 应用包名
 */
export async function isAppInForeground(packageName: string): Promise<boolean> {
  try {
    const foreground = await getForegroundApp();
    return foreground === packageName;
  } catch (error) {
    console.error(`[AppLaunch] Failed to check app foreground:`, error);
    return false;
  }
}

// ==================== 批量操作 ====================

/**
 * 批量检查应用安装状态
 * @param packageNames 应用包名列表
 */
export async function checkAppsInstalled(
  packageNames: string[]
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  
  await Promise.all(
    packageNames.map(async (packageName) => {
      results[packageName] = await isAppInstalled(packageName);
    })
  );
  
  return results;
}

/**
 * 获取可用的预设快捷方式
 * 只返回已安装应用的快捷方式
 */
export async function getAvailableShortcuts(): Promise<DeepLinkConfig[]> {
  const shortcuts = Object.values(DEEP_LINK_SHORTCUTS);
  const packageNames = [...new Set(shortcuts.map(s => s.packageName))];
  const installedStatus = await checkAppsInstalled(packageNames);
  
  return shortcuts.filter(s => installedStatus[s.packageName]);
}

/**
 * 按类别获取可用的快捷方式
 */
export async function getShortcutsByCategory(): Promise<{
  payment: DeepLinkConfig[];
  navigation: DeepLinkConfig[];
  communication: DeepLinkConfig[];
  music: DeepLinkConfig[];
  video: DeepLinkConfig[];
  tools: DeepLinkConfig[];
}> {
  const available = await getAvailableShortcuts();
  
  const categorize = (keywords: string[]): DeepLinkConfig[] => {
    return available.filter(s => 
      keywords.some(k => s.description?.includes(k) || Object.keys(DEEP_LINK_SHORTCUTS).find(key => DEEP_LINK_SHORTCUTS[key] === s)?.includes(k))
    );
  };
  
  return {
    payment: available.filter(s => 
      s.description?.includes('支付') || s.description?.includes('扫')
    ),
    navigation: available.filter(s => 
      s.description?.includes('导航') || s.description?.includes('出行') || s.description?.includes('地图')
    ),
    communication: available.filter(s => 
      ['微信', 'QQ', '钉钉', '飞书'].some(k => s.description?.includes(k)) && 
      !s.description?.includes('支付') && !s.description?.includes('扫')
    ),
    music: available.filter(s => s.description?.includes('音乐')),
    video: available.filter(s => 
      ['哔哩哔哩', '抖音'].some(k => s.description?.includes(k))
    ),
    tools: available.filter(s => s.description?.includes('日历')),
  };
}

// ==================== 智能推荐 ====================

/**
 * 根据场景获取推荐应用
 * @param sceneType 场景类型
 * @param limit 返回数量限制
 */
export async function getRecommendedAppsForScene(
  sceneType: string,
  limit: number = 5
): Promise<AppRecommendation[]> {
  // 场景-应用关联配置
  const sceneAppRelevance: Record<string, { packageName: string; score: number; reason: string }[]> = {
    COMMUTE: [
      { packageName: 'com.eg.android.AlipayGphone', score: 0.9, reason: '乘车码支付' },
      { packageName: 'com.tencent.mm', score: 0.8, reason: '扫码出行' },
      { packageName: 'com.netease.cloudmusic', score: 0.7, reason: '通勤听歌' },
      { packageName: 'com.autonavi.minimap', score: 0.6, reason: '路况导航' },
    ],
    OFFICE: [
      { packageName: 'com.alibaba.android.rimet', score: 0.9, reason: '工作沟通' },
      { packageName: 'com.ss.android.lark', score: 0.8, reason: '协作办公' },
      { packageName: 'com.tencent.wework', score: 0.8, reason: '企业微信' },
      { packageName: 'com.microsoft.office.outlook', score: 0.7, reason: '邮件处理' },
    ],
    HOME: [
      { packageName: 'tv.danmaku.bili', score: 0.8, reason: '休闲娱乐' },
      { packageName: 'com.ss.android.ugc.aweme', score: 0.7, reason: '刷视频' },
      { packageName: 'com.tencent.mm', score: 0.6, reason: '社交聊天' },
    ],
    STUDY: [
      { packageName: 'com.netease.cloudmusic', score: 0.6, reason: '学习背景音乐' },
      { packageName: 'com.youdao.dict', score: 0.7, reason: '查词学习' },
    ],
    SLEEP: [
      { packageName: 'com.netease.cloudmusic', score: 0.5, reason: '助眠音乐' },
    ],
    TRAVEL: [
      { packageName: 'com.autonavi.minimap', score: 0.9, reason: '旅途导航' },
      { packageName: 'com.baidu.BaiduMap', score: 0.8, reason: '地图查询' },
      { packageName: 'com.eg.android.AlipayGphone', score: 0.7, reason: '旅途支付' },
    ],
  };
  
  const relevantApps = sceneAppRelevance[sceneType] || [];
  const recommendations: AppRecommendation[] = [];
  
  for (const app of relevantApps) {
    if (recommendations.length >= limit) break;
    
    const installed = await isAppInstalled(app.packageName);
    if (installed) {
      // 尝试获取应用名称
      const apps = await getInstalledApps();
      const appInfo = apps.find(a => a.packageName === app.packageName);
      
      recommendations.push({
        packageName: app.packageName,
        appName: appInfo?.appName || app.packageName.split('.').pop() || '',
        score: app.score,
        reason: app.reason,
      });
    }
  }
  
  return recommendations;
}

// ==================== 直接打开 URI ====================

/**
 * 直接打开 URI/深度链接
 * @param uri 要打开的 URI
 * @returns 是否成功
 */
export async function openDeepLink(uri: string): Promise<boolean> {
  try {
    const { Linking } = require('react-native');
    const canOpen = await Linking.canOpenURL(uri);
    
    if (canOpen) {
      await Linking.openURL(uri);
      return true;
    }
    
    console.warn(`[AppLaunch] Cannot open URI: ${uri}`);
    return false;
  } catch (error) {
    console.error(`[AppLaunch] Failed to open deep link:`, error);
    return false;
  }
}

// ==================== 默认导出 ====================

export const AppLaunchController = {
  // 启动功能
  launchApp,
  launchAppWithDeepLink,
  launchShortcut,
  openDeepLink,
  
  // 查询功能
  isAppInstalled,
  validateDeepLink,
  getInstalledApps,
  getForegroundApp,
  isAppInForeground,
  
  // 批量操作
  checkAppsInstalled,
  getAvailableShortcuts,
  getShortcutsByCategory,
  
  // 智能推荐
  getRecommendedAppsForScene,
  
  // 预设配置
  DEEP_LINK_SHORTCUTS,
};

export default AppLaunchController;
