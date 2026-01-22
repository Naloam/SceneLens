/**
 * SceneSuggestionManager - 场景执行建议包管理器
 *
 * 负责加载和管理场景执行建议包配置，为 UI 层提供场景建议数据，
 * 并与 SceneExecutor 配合执行用户选择的一键操作。
 */

import type {
  SceneType,
  SceneSuggestionPackage,
  SceneSuggestionsConfig,
  OneTapAction,
  OneTapActionKind,
  SuggestionResponse,
  SuggestionExecutionResult,
  SystemAdjustment,
  AppLaunch,
  SilentContext,
} from '../types';
import { SceneLensError, ErrorCode } from '../types';
import { sceneExecutor } from '../executors/SceneExecutor';
import { appDiscoveryEngine } from '../discovery';
import SceneBridge from '../core/SceneBridge';

/**
 * 建议包加载选项
 */
interface LoadOptions {
  /**
   * 是否强制重新加载（忽略缓存）
   */
  forceReload?: boolean;
}

/**
 * 建议包获取选项
 */
interface GetSuggestionOptions {
  /**
   * 是否包含系统调整项
   */
  includeSystemAdjustments?: boolean;
  /**
   * 是否包含应用启动项
   */
  includeAppLaunches?: boolean;
  /**
   * 是否包含降级说明
   */
  includeFallbackNotes?: boolean;
  /**
   * 置信度阈值（用于过滤低置信度的建议）
   */
  minConfidence?: number;
}

/**
 * 建议包执行选项
 */
interface ExecuteOptions {
  /**
   * 是否显示执行进度通知
   */
  showProgress?: boolean;
  /**
   * 是否在失败时自动降级
   */
  autoFallback?: boolean;
  /**
   * 超时时间（毫秒）
   */
  timeout?: number;
}

/**
 * 权限状态
 */
interface PermissionStatus {
  hasDoNotDisturbPermission: boolean;
  hasWriteSettingsPermission: boolean;
  hasWakeLockPermission: boolean;
  hasCalendarPermission: boolean;
}

class SceneSuggestionManagerClass {
  private config: SceneSuggestionsConfig | null = null;
  private isLoaded = false;
  private loadingPromise: Promise<SceneSuggestionsConfig> | null = null;

  /**
   * 初始化建议包管理器
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) {
      return;
    }
    await this.loadConfig();
    await sceneExecutor.initialize();
  }

  /**
   * 加载场景建议包配置
   */
  async loadConfig(options: LoadOptions = {}): Promise<SceneSuggestionsConfig> {
    // 如果已加载且不强制重新加载，直接返回缓存
    if (this.isLoaded && !options.forceReload && this.config) {
      return this.config;
    }

    // 如果正在加载，返回加载中的 Promise
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // 开始加载配置
    this.loadingPromise = this.performLoadConfig();

    try {
      this.config = await this.loadingPromise;
      this.isLoaded = true;
      return this.config;
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * 执行配置加载操作
   */
  private async performLoadConfig(): Promise<SceneSuggestionsConfig> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const configModule = require('../config/scene-suggestions.json');
      const config: SceneSuggestionsConfig = configModule;

      // 验证配置结构
      this.validateConfig(config);

      console.log(`[SceneSuggestionManager] 已加载场景建议包配置 v${config.version}，共 ${config.scenes.length} 个场景`);
      return config;
    } catch (error) {
      console.error('[SceneSuggestionManager] 加载配置失败:', error);
      throw new SceneLensError(
        ErrorCode.DATA_CORRUPTED,
        '加载场景建议包配置失败',
        true
      );
    }
  }

  /**
   * 验证配置结构
   */
  private validateConfig(config: SceneSuggestionsConfig): void {
    if (!config.version || !config.scenes || !Array.isArray(config.scenes)) {
      throw new SceneLensError(
        ErrorCode.DATA_CORRUPTED,
        '配置文件格式无效：缺少必要字段',
        true
      );
    }

    // 验证每个场景配置
    for (const scene of config.scenes) {
      if (!scene.sceneId || !scene.displayName || !scene.detectionHighlights) {
        throw new SceneLensError(
          ErrorCode.DATA_CORRUPTED,
          `场景配置无效：${scene.sceneId || '未知场景'}`,
          true
        );
      }
    }
  }

  /**
   * 获取所有场景的建议包
   */
  async getAllScenes(options: GetSuggestionOptions = {}): Promise<SceneSuggestionPackage[]> {
    const config = await this.loadConfig();

    let scenes = config.scenes;

    // 根据选项过滤内容
    if (!options.includeSystemAdjustments || !options.includeAppLaunches || !options.includeFallbackNotes) {
      scenes = scenes.map(scene => this.filterSceneContent(scene, options));
    }

    return scenes;
  }

  /**
   * 过滤场景内容
   */
  private filterSceneContent(
    scene: SceneSuggestionPackage,
    options: GetSuggestionOptions
  ): SceneSuggestionPackage {
    return {
      ...scene,
      systemAdjustments: options.includeSystemAdjustments !== false ? scene.systemAdjustments : [],
      appLaunches: options.includeAppLaunches !== false ? scene.appLaunches : [],
      fallbackNotes: options.includeFallbackNotes !== false ? scene.fallbackNotes : [],
    };
  }

  /**
   * 根据场景类型获取建议包
   */
  async getSuggestionBySceneType(
    sceneType: SceneType,
    options: GetSuggestionOptions = {}
  ): Promise<SceneSuggestionPackage | null> {
    const config = await this.loadConfig();
    const scene = config.scenes.find(s => s.sceneId === sceneType);

    if (!scene) {
      console.warn(`[SceneSuggestionManager] 未找到场景: ${sceneType}`);
      return null;
    }

    return this.filterSceneContent(scene, options);
  }

  /**
   * 根据静默上下文获取建议包
   */
  async getSuggestionByContext(
    context: SilentContext,
    options: GetSuggestionOptions = {}
  ): Promise<SceneSuggestionPackage | null> {
    // 检查置信度阈值
    if (options.minConfidence !== undefined && context.confidence < options.minConfidence) {
      console.log(`[SceneSuggestionManager] 置信度 ${context.confidence} 低于阈值 ${options.minConfidence}，跳过建议`);
      return null;
    }

    return this.getSuggestionBySceneType(context.context, options);
  }

  /**
   * 获取场景的检测要点
   */
  async getDetectionHighlights(sceneType: SceneType): Promise<string[]> {
    const scene = await this.getSuggestionBySceneType(sceneType);
    return scene?.detectionHighlights ?? [];
  }

  /**
   * 获取场景的一键操作列表
   */
  async getOneTapActions(sceneType: SceneType): Promise<OneTapAction[]> {
    const scene = await this.getSuggestionBySceneType(sceneType, {
      includeSystemAdjustments: true,
      includeAppLaunches: true,
    });
    return scene?.oneTapActions ?? [];
  }

  /**
   * 执行场景建议包
   */
  async executeSuggestion(
    sceneType: SceneType,
    actionId: string,
    options: ExecuteOptions = {}
  ): Promise<SuggestionExecutionResult> {
    const startTime = Date.now();

    try {
      // 获取场景配置
      const scene = await this.getSuggestionBySceneType(sceneType, {
        includeSystemAdjustments: true,
        includeAppLaunches: true,
        includeFallbackNotes: true,
      });

      if (!scene) {
        throw new SceneLensError(
          ErrorCode.APP_NOT_FOUND,
          `未找到场景配置: ${sceneType}`,
          true
        );
      }

      // 查找对应的操作
      const action = scene.oneTapActions.find(a => a.id === actionId);
      if (!action) {
        throw new SceneLensError(
          ErrorCode.APP_NOT_FOUND,
          `未找到操作: ${actionId}`,
          true
        );
      }

      // 处理不同的操作类型
      const result = await this.executeAction(scene, action, options);

      return {
        sceneId: sceneType,
        success: result.success,
        executedActions: result.executedActions,
        skippedActions: result.skippedActions,
        fallbackApplied: result.fallbackApplied,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[SceneSuggestionManager] 执行场景建议失败:`, error);
      return {
        sceneId: sceneType,
        success: false,
        executedActions: [],
        skippedActions: [],
        fallbackApplied: false,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 执行具体操作
   */
  private async executeAction(
    scene: SceneSuggestionPackage,
    action: OneTapAction,
    options: ExecuteOptions
  ): Promise<{
    success: boolean;
    executedActions: Array<{
      type: 'system' | 'app';
      description: string;
      success: boolean;
      error?: string;
    }>;
    skippedActions: string[];
    fallbackApplied: boolean;
  }> {
    const executedActions: Array<{
      type: 'system' | 'app';
      description: string;
      success: boolean;
      error?: string;
    }> = [];
    const skippedActions: string[] = [];
    let fallbackApplied = false;

    // 检查权限状态
    const permissionStatus = await this.checkPermissions();

    // 处理不同的操作类型
    switch (action.action) {
      case 'execute_all':
        // 执行所有系统调整和应用启动
        for (const adjustment of scene.systemAdjustments) {
          const result = await this.executeSystemAdjustment(adjustment, permissionStatus);
          executedActions.push(result);
          if (!result.success && options.autoFallback) {
            fallbackApplied = true;
          }
        }

        for (const appLaunch of scene.appLaunches) {
          const result = await this.executeAppLaunch(appLaunch);
          executedActions.push(result);
          if (!result.success && options.autoFallback) {
            fallbackApplied = true;
          }
        }
        break;

      case 'dismiss':
        // 不执行任何操作
        skippedActions.push('all');
        break;

      case 'snooze':
        // 延迟提醒（由调用者处理）
        console.log(`[SceneSuggestionManager] 延迟 ${action.params?.delayMs ?? 0}ms 后再次提醒`);
        skippedActions.push('snooze');
        break;
    }

    // 判断整体是否成功（至少有一个操作成功，或者操作类型是 dismiss/snooze）
    const success =
      action.action === 'dismiss' ||
      action.action === 'snooze' ||
      executedActions.some(a => a.success);

    return { success, executedActions, skippedActions, fallbackApplied };
  }

  /**
   * 执行系统调整
   */
  private async executeSystemAdjustment(
    adjustment: SystemAdjustment,
    permissionStatus: PermissionStatus
  ): Promise<{
    type: 'system';
    description: string;
    success: boolean;
    error?: string;
  }> {
    try {
      // 检查权限
      if (adjustment.action === 'setDoNotDisturb' && !permissionStatus.hasDoNotDisturbPermission) {
        return {
          type: 'system',
          description: adjustment.label,
          success: false,
          error: '缺少勿扰模式权限',
        };
      }

      if (adjustment.action === 'setBrightness' && !permissionStatus.hasWriteSettingsPermission) {
        return {
          type: 'system',
          description: adjustment.label,
          success: false,
          error: '缺少系统设置权限',
        };
      }

      if (adjustment.action === 'setWakeLock' && !permissionStatus.hasWakeLockPermission) {
        return {
          type: 'system',
          description: adjustment.label,
          success: false,
          error: '缺少唤醒锁权限',
        };
      }

      // 执行系统操作
      switch (adjustment.action) {
        case 'setDoNotDisturb':
          await SceneBridge.setDoNotDisturb(adjustment.params?.enable ?? false);
          break;

        case 'setBrightness':
          await SceneBridge.setBrightness(adjustment.params?.level ?? 0.5);
          break;

        case 'setWakeLock':
          await SceneBridge.setWakeLock(
            adjustment.params?.enable ?? false,
            adjustment.params?.timeout ?? 300000
          );
          break;

        default:
          throw new Error(`未知的系统操作: ${adjustment.action}`);
      }

      return {
        type: 'system',
        description: adjustment.label,
        success: true,
      };
    } catch (error) {
      return {
        type: 'system',
        description: adjustment.label,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 执行应用启动
   */
  private async executeAppLaunch(
    appLaunch: AppLaunch
  ): Promise<{
    type: 'app';
    description: string;
    success: boolean;
    error?: string;
  }> {
    try {
      // 解析意图为包名
      const packageName = appLaunch.intent
        ? await this.resolveIntent(appLaunch.intent)
        : undefined;

      if (!packageName) {
        return {
          type: 'app',
          description: appLaunch.label,
          success: false,
          error: '无法解析应用包名',
        };
      }

      // 检查应用是否已安装
      const isInstalled = await SceneBridge.isAppInstalled(packageName);
      if (!isInstalled) {
        return {
          type: 'app',
          description: appLaunch.label,
          success: false,
          error: '应用未安装',
        };
      }

      // 使用 Deep Link 打开应用
      const deepLink = appLaunch.deepLink;
      const success = await SceneBridge.openAppWithDeepLink(packageName, deepLink);

      if (success) {
        return {
          type: 'app',
          description: appLaunch.label,
          success: true,
        };
      }

      // 尝试降级：打开应用首页
      const fallbackSuccess = await SceneBridge.openAppWithDeepLink(packageName);
      if (fallbackSuccess) {
        return {
          type: 'app',
          description: `${appLaunch.label}（降级：${appLaunch.fallbackAction}）`,
          success: true,
        };
      }

      return {
        type: 'app',
        description: appLaunch.label,
        success: false,
        error: '无法打开应用',
      };
    } catch (error) {
      return {
        type: 'app',
        description: appLaunch.label,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 解析意图为包名
   */
  private async resolveIntent(intent: string): Promise<string | null> {
    try {
      if (!appDiscoveryEngine.isInitialized()) {
        await appDiscoveryEngine.initialize();
      }
      const resolved = appDiscoveryEngine.resolveIntent(intent);
      if (resolved) return resolved;
    } catch (error) {
      console.warn('[SceneSuggestionManager] AppDiscoveryEngine resolve failed, fallback to defaults', error);
    }

    // 使用 fallback 包名映射
    const fallbackMap: Record<string, string> = {
      TRANSIT_APP_TOP1: 'com.eg.android.AlipayGphone',
      MUSIC_PLAYER_TOP1: 'com.netease.cloudmusic',
      CALENDAR_TOP1: 'com.android.calendar',
      MEETING_APP_TOP1: 'com.ss.android.lark',
      STUDY_APP_TOP1: 'camp.firefly.foresto',
      TRAVEL_APP_TOP1: 'com.MobileTicket',
      SMART_HOME_TOP1: 'com.xiaomi.smarthome',
    };
    return fallbackMap[intent] || null;
  }

  /**
   * 检查权限状态
   */
  private async checkPermissions(): Promise<PermissionStatus> {
    const [
      hasDoNotDisturbPermission,
      hasWriteSettingsPermission,
      hasWakeLockPermission,
      hasCalendarPermission,
    ] = await Promise.all([
      SceneBridge.checkDoNotDisturbPermission(),
      SceneBridge.checkWriteSettingsPermission(),
      SceneBridge.checkPermission('android.permission.WAKE_LOCK'),
      SceneBridge.hasCalendarPermission(),
    ]);

    return {
      hasDoNotDisturbPermission,
      hasWriteSettingsPermission,
      hasWakeLockPermission,
      hasCalendarPermission,
    };
  }

  /**
   * 获取降级说明
   */
  async getFallbackNotes(sceneType: SceneType): Promise<string[]> {
    const scene = await this.getSuggestionBySceneType(sceneType, {
      includeFallbackNotes: true,
    });
    return scene?.fallbackNotes.map(note => note.message) ?? [];
  }

  /**
   * 记录用户响应
   */
  async recordResponse(response: SuggestionResponse): Promise<void> {
    // 这里可以集成到用户反馈系统
    console.log('[SceneSuggestionManager] 记录用户响应:', response);
    // TODO: 保存到持久存储
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<void> {
    this.isLoaded = false;
    this.config = null;
    await this.loadConfig({ forceReload: true });
  }

  /**
   * 获取配置版本
   */
  getConfigVersion(): string {
    return this.config?.version ?? 'unknown';
  }
}

// 导出单例
export const sceneSuggestionManager = new SceneSuggestionManagerClass();
export default sceneSuggestionManager;
