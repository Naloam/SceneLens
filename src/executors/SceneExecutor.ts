import { Action } from '../rules';
import SceneBridge from '../core/SceneBridge';
import { appDiscoveryEngine } from '../discovery';
import { notificationManager } from '../notifications/NotificationManager';

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
 */
export class SceneExecutor {
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
   * 实现三级降级策略：
   * 1. 尝试使用 Deep Link（最佳）
   * 2. 直接打开应用首页（次优）
   * 3. 提示用户手动操作（兜底）
   */
  private async executeAppAction(action: Action): Promise<void> {
    // 解析意图为实际包名
    const packageName = action.intent
      ? await this.resolveIntent(action.intent)
      : action.params?.packageName;

    if (!packageName) {
      throw new Error('Cannot resolve app package name');
    }

    // 三级降级策略
    // 1. 尝试使用 Deep Link（最佳）
    if (action.deepLink) {
      try {
        const success = await SceneBridge.openAppWithDeepLink(packageName, action.deepLink);
        if (success) {
          console.log(`Successfully opened app with deep link: ${packageName}`);
          return;
        }
      } catch (error) {
        console.warn(`Deep link failed for ${packageName}, trying fallback`, error);
      }
    }

    // 2. 直接打开应用首页（次优）
    try {
      const success = await SceneBridge.openAppWithDeepLink(packageName);
      if (success) {
        console.log(`Successfully opened app home: ${packageName}`);
        return;
      }
    } catch (error) {
      console.warn(`Failed to open app home for ${packageName}`, error);
    }

    // 3. 提示用户手动操作（兜底）
    throw new Error(`无法打开应用: ${packageName}`);
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
    };
    return fallbackMap[intent] || null;
  }
}
