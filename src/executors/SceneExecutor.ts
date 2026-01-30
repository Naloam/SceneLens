import { Action } from '../rules';
import SceneBridge from '../core/SceneBridge';
import { appDiscoveryEngine } from '../discovery';
import { notificationManager } from '../notifications/NotificationManager';
import { deepLinkManager } from '../utils/deepLinkManager';

/**
 * 执行结果
 */
export interface ExecutionResult {
  action: Action;
  success: boolean;
  error?: string;
  duration: number;
}

/**
 * 场景执行器
 * 负责执行规则引擎生成的动作列表
 * 优化应用启动速度，使用 Deep Link 管理器
 */
export class SceneExecutor {
  private isInitialized = false;

  /**
   * 初始化执行器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await deepLinkManager.initialize();
    this.isInitialized = true;
  }

  /**
   * 执行动作列表
   */
  async execute(actions: Action[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const action of actions) {
      const startTime = Date.now();
      try {
        await this.executeSingle(action);
        results.push({
          action,
          success: true,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          action,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * 执行单个动作
   */
  private async executeSingle(action: Action): Promise<void> {
    switch (action.target) {
      case 'system':
        return this.executeSystemAction(action);

      case 'app':
        return this.executeAppAction(action);

      case 'notification':
        return this.executeNotification(action);

      default:
        throw new Error(`Unknown action target: ${action.target}`);
    }
  }

  /**
   * 执行系统动作
   */
  private async executeSystemAction(action: Action): Promise<void> {
    switch (action.action) {
      case 'setDoNotDisturb':
        await SceneBridge.setDoNotDisturb(
          action.params?.enable ?? false
        );
        break;

      case 'setBrightness':
        await SceneBridge.setBrightness(action.params?.level ?? 0.5);
        break;

      default:
        throw new Error(`Unknown system action: ${action.action}`);
    }
  }

  /**
   * 执行应用动作
   * 优化应用启动速度，使用 Deep Link 管理器
   * 实现三级降级策略：
   * 1. 尝试使用 Deep Link（最佳）
   * 2. 直接打开应用首页（次优）
   * 3. 提示用户手动操作（兜底）
   */
  private async executeAppAction(action: Action): Promise<void> {
    // 确保 Deep Link 管理器已初始化
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 解析意图为实际包名
    const packageName = action.intent
      ? await this.resolveIntent(action.intent)
      : action.params?.packageName;

    if (!packageName) {
      throw new Error('Cannot resolve app package name');
    }

    // 确定动作类型
    const appAction = this.extractAction(action);

    // 使用 Deep Link 管理器打开应用（已内置三级降级策略）
    const success = await deepLinkManager.openWithDeepLink(
      packageName,
      action.deepLink,
      appAction
    );

    if (success) {
      console.log(`[SceneExecutor] Successfully opened app: ${packageName}`);
      return;
    }

    // 如果 deep link 失败，尝试使用空 deepLink 再次尝试（会触发原生 launcher intent）
    console.warn(`[SceneExecutor] Deep link failed for ${packageName}, trying launch intent`);
    const fallbackSuccess = await SceneBridge.openAppWithDeepLink(packageName, undefined);
    if (fallbackSuccess) {
      console.log(`[SceneExecutor] Successfully opened app with launch intent: ${packageName}`);
      return;
    }

    // 兜底：提示用户手动操作
    throw new Error(`无法打开应用: ${packageName}`);
  }

  /**
   * 从动作中提取应用动作类型
   *
   * @param action 动作
   * @returns 应用动作类型
   */
  private extractAction(action: Action): string | undefined {
    const actionMap: Record<string, string> = {
      open_ticket_qr: 'open_ticket_qr',
      launch_with_playlist: 'launch_with_playlist',
      open_calendar: 'open_calendar',
      open_meeting: 'open_meeting',
      start_focus: 'start_focus',
    };

    return actionMap[action.action] ?? 'open_home';
  }

  /**
   * 执行通知动作
   */
  private async executeNotification(action: Action): Promise<void> {
    if (action.action === 'suggest') {
      await notificationManager.showSceneSuggestion({
        sceneType: action.params?.sceneType ?? 'COMMUTE',
        title: action.params?.title ?? '场景建议',
        body: action.params?.body ?? '',
        actions: [],
        confidence: action.params?.confidence ?? 0.7,
      });
      return;
    }

    // 兜底日志
    console.log('Notification action (fallback):', {
      title: action.params?.title,
      body: action.params?.body,
      mode: action.params?.mode,
    });
  }

  /**
   * 解析意图为包名
   * 将意图（如 TRANSIT_APP_TOP1）解析为实际包名
   */
  private async resolveIntent(intent: string): Promise<string | null> {
    try {
      if (!appDiscoveryEngine.isInitialized()) {
        await appDiscoveryEngine.initialize();
      }
      const resolved = appDiscoveryEngine.resolveIntent(intent);
      if (resolved) return resolved;
    } catch (error) {
      console.warn('AppDiscoveryEngine resolve failed, fallback to defaults', error);
    }

    const fallbackMap: Record<string, string> = {
      TRANSIT_APP_TOP1: 'com.eg.android.AlipayGphone',
      MUSIC_PLAYER_TOP1: 'com.netease.cloudmusic',
      CALENDAR_TOP1: 'com.android.calendar',
      MEETING_APP_TOP1: 'com.tencent.wework',
      STUDY_APP_TOP1: 'com.chaoxing.mobile', // 学习通
      STUDY_APP_TOP2: 'com.netease.edu.ucmooc', // 中国大学MOOC
      STUDY_APP_TOP3: 'camp.firefly.foresto', // Forest
      STUDY_APP_TOP4: 'com.fenbi.android.solar', // 猿题库
      STUDY_APP_TOP5: 'com.zhihu.android', // 知乎
      TRAVEL_APP_TOP1: 'com.MobileTicket',
      SMART_HOME_TOP1: 'com.xiaomi.smarthome',
      PAYMENT_APP_TOP1: 'com.eg.android.AlipayGphone',
      MAP_APP_TOP1: 'com.autonavi.minimap', // 高德地图
      MAP_APP_TOP2: 'com.baidu.BaiduMap', // 百度地图
      RIDE_SHARE_APP_TOP1: 'com.sdu.didi.psnger', // 滴滴出行
      SOCIAL_APP_TOP1: 'com.tencent.mm', // 微信
      SOCIAL_APP_TOP2: 'com.tencent.mobileqq', // QQ
    };
    return fallbackMap[intent] || null;
  }

  /**
   * 验证 Deep Link 有效性
   * 检查应用是否已安装且 Deep Link 是否可用
   */
  async validateDeepLink(packageName: string, deepLink: string): Promise<boolean> {
    try {
      // 检查应用是否已安装
      const isInstalled = await SceneBridge.isAppInstalled(packageName);
      if (!isInstalled) {
        console.warn(`App not installed: ${packageName}`);
        return false;
      }

      // 使用 validateDeepLink 方法验证 Deep Link
      const isValid = await SceneBridge.validateDeepLink(deepLink);
      return isValid;
    } catch (error) {
      console.warn(`Deep link validation failed for ${packageName}:`, error);
      return false;
    }
  }

  /**
   * 获取 Deep Link 配置
   * 从配置文件加载 Deep Link 映射表
   */
  async getDeepLinkConfig(): Promise<Record<string, any>> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const deeplinksConfig = require('../config/deeplinks.json');
      return deeplinksConfig.deeplinks || {};
    } catch (error) {
      console.warn('Failed to load deeplinks config:', error);
      return {};
    }
  }

  /**
   * 获取应用的 Deep Link
   * 根据包名和动作类型查找对应的 Deep Link
   */
  async getDeepLink(packageName: string, action?: string): Promise<string | null> {
    try {
      const config = await this.getDeepLinkConfig();

      // 遍历所有类别查找包名
      for (const category in config) {
        const apps = config[category];
        if (apps && apps[packageName]) {
          const deeplinks = apps[packageName].deeplinks;
          if (action) {
            // 查找指定动作的 Deep Link
            const matched = deeplinks.find((dl: any) => dl.action === action);
            if (matched) return matched.url;
          } else {
            // 返回第一个 Deep Link
            return deeplinks[0]?.url || null;
          }
        }
      }
      return null;
    } catch (error) {
      console.warn(`Failed to get deep link for ${packageName}:`, error);
      return null;
    }
  }

  /**
   * 定期健康检查 Deep Link
   * 验证常用应用的 Deep Link 是否仍然有效
   */
  async performHealthCheck(): Promise<{
    healthy: string[];
    unhealthy: Array<{ packageName: string; deepLink: string; error: string }>;
  }> {
    const healthy: string[] = [];
    const unhealthy: Array<{ packageName: string; deepLink: string; error: string }> = [];

    const criticalApps = [
      { packageName: 'com.eg.android.AlipayGphone', deepLink: 'alipays://platformapi/startapp?appId=200011235' },
      { packageName: 'com.netease.cloudmusic', deepLink: 'orpheus://' },
      { packageName: 'com.android.calendar', deepLink: 'content://com.android.calendar/events' },
    ];

    for (const app of criticalApps) {
      const isValid = await this.validateDeepLink(app.packageName, app.deepLink);
      if (isValid) {
        healthy.push(app.packageName);
      } else {
        unhealthy.push({
          packageName: app.packageName,
          deepLink: app.deepLink,
          error: 'Validation failed',
        });
      }
    }

    return { healthy, unhealthy };
  }
}
// 导出单例实例
export const sceneExecutor = new SceneExecutor();

export default SceneExecutor;