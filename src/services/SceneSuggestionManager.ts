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
  SuggestionExecutedAction,
  SuggestionExecutionResult,
  SystemAdjustment,
  AppLaunch,
  SilentContext,
} from '../types';
import { SceneLensError, ErrorCode } from '../types';
import { sceneExecutor } from '../executors/SceneExecutor';
import { appDiscoveryEngine } from '../discovery';
import SceneBridge from '../core/SceneBridge';
import { SystemSettingsController } from '../automation/SystemSettingsController';
import { resolveDoNotDisturbSettings } from '../automation/systemSettingTransforms';
import type { VolumeStreamType } from '../types/automation';
import { storageManager } from '../stores/storageManager';
import { 
  dynamicSuggestionService, 
  DynamicSuggestionPackage,
  TimeOfDay,
} from './DynamicSuggestionService';
import {
  deriveSuggestionExecutionStatus,
  summarizeSuggestionExecution,
} from '../utils/suggestionExecution';

// 应用名称（用于权限提示）
const APP_NAME = 'SceneLens';
const RESPONSE_HISTORY_KEY = 'scene_suggestion_response_history';
const MAX_RESPONSE_HISTORY = 500;

function resolveVolumeParams(
  params: Record<string, any> | undefined
): { streamType: VolumeStreamType; levelPercent: number } {
  const rawLevel = typeof params?.level === 'number' ? params.level : 50;
  const levelPercent = rawLevel <= 1 ? Math.round(rawLevel * 100) : Math.round(rawLevel);
  const rawStream = typeof params?.streamType === 'string' ? params.streamType.toLowerCase() : 'media';
  const streamType: VolumeStreamType = ['media', 'ring', 'notification', 'alarm', 'system'].includes(rawStream)
    ? (rawStream as VolumeStreamType)
    : 'media';

  return {
    streamType,
    levelPercent: Math.max(0, Math.min(100, levelPercent)),
  };
}

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
  /**
   * 是否启用动态建议（AI增强）
   */
  enableDynamicSuggestions?: boolean;
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
  private initializationPromise: Promise<void> | null = null;
  /** 动态建议缓存 */
  private dynamicSuggestionCache: Map<SceneType, {
    suggestion: DynamicSuggestionPackage;
    expireAt: number;
  }> = new Map();
  /** 动态建议缓存时间（毫秒） */
  private readonly DYNAMIC_CACHE_TTL = 5 * 60 * 1000; // 5分钟

  /**
   * 初始化建议包管理器
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.performInitialize();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async performInitialize(): Promise<void> {
    await this.loadConfig();
    await sceneExecutor.initialize();
    await dynamicSuggestionService.initialize();
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

    // 如果启用动态建议，返回增强后的建议
    if (options.enableDynamicSuggestions) {
      const dynamicSuggestion = await this.getDynamicSuggestion(sceneType, scene);
      if (dynamicSuggestion) {
        return this.convertDynamicToStatic(dynamicSuggestion, scene);
      }
    }

    return this.filterSceneContent(scene, options);
  }

  /**
   * 获取动态建议（带缓存）
   */
  async getDynamicSuggestion(
    sceneType: SceneType,
    baseScene?: SceneSuggestionPackage
  ): Promise<DynamicSuggestionPackage | null> {
    // 检查缓存
    const cached = this.dynamicSuggestionCache.get(sceneType);
    if (cached && cached.expireAt > Date.now()) {
      console.log(`[SceneSuggestionManager] 使用缓存的动态建议: ${sceneType}`);
      return cached.suggestion;
    }

    // 获取基础场景配置
    let scene = baseScene;
    if (!scene) {
      const config = await this.loadConfig();
      scene = config.scenes.find(s => s.sceneId === sceneType) || undefined;
    }

    if (!scene) {
      return null;
    }

    try {
      // 生成动态建议
      const dynamicSuggestion = await dynamicSuggestionService.generateDynamicSuggestions(
        sceneType,
        {
          systemAdjustments: scene.systemAdjustments,
          appLaunches: scene.appLaunches,
          oneTapActions: scene.oneTapActions,
        }
      );

      // 更新缓存
      this.dynamicSuggestionCache.set(sceneType, {
        suggestion: dynamicSuggestion,
        expireAt: Date.now() + this.DYNAMIC_CACHE_TTL,
      });

      console.log(`[SceneSuggestionManager] 生成动态建议: ${sceneType}`, {
        timeOfDay: dynamicSuggestion.context.timeOfDay,
        personalizedNotes: dynamicSuggestion.personalizedNotes,
      });

      return dynamicSuggestion;
    } catch (error) {
      console.error(`[SceneSuggestionManager] 生成动态建议失败:`, error);
      return null;
    }
  }

  /**
   * 将动态建议转换为静态格式（保持接口兼容）
   */
  private convertDynamicToStatic(
    dynamic: DynamicSuggestionPackage,
    baseScene: SceneSuggestionPackage
  ): SceneSuggestionPackage {
    return {
      ...baseScene,
      systemAdjustments: dynamic.systemAdjustments.map(adj => ({
        id: adj.id,
        label: adj.label,
        description: `${adj.description} (${adj.reason})`,
        action: adj.action,
        params: adj.params,
      })),
      appLaunches: dynamic.appLaunches.map(launch => ({
        id: launch.id,
        label: launch.label,
        description: `${launch.description} - ${launch.reason}`,
        intent: launch.intent,
        action: launch.action,
        deepLink: launch.deepLink,
        params: launch.params,
        fallbackAction: launch.fallbackAction,
      })),
      oneTapActions: dynamic.oneTapActions,
      // 添加个性化说明到 detectionHighlights
      detectionHighlights: [
        ...dynamic.personalizedNotes,
        ...baseScene.detectionHighlights,
      ],
      // 🚀 添加动态建议字段
      dynamicNotes: dynamic.personalizedNotes,
      dynamicGreeting: this.getSceneGreeting(dynamic.sceneType),
      dynamicTip: this.getSceneTip(dynamic.sceneType),
    };
  }

  /**
   * 获取场景的个性化问候语
   */
  getSceneGreeting(sceneType: SceneType): string {
    return dynamicSuggestionService.getGreeting(sceneType);
  }

  /**
   * 获取场景的个性化提示
   */
  getSceneTip(sceneType: SceneType): string {
    return dynamicSuggestionService.getTip(sceneType);
  }

  /**
   * 获取当前时间段
   */
  getCurrentTimeOfDay(): TimeOfDay {
    return dynamicSuggestionService.getTimeOfDay();
  }

  /**
   * 清除动态建议缓存
   */
  clearDynamicCache(): void {
    this.dynamicSuggestionCache.clear();
    console.log('[SceneSuggestionManager] 动态建议缓存已清除');
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

      // Only execute the explicit one-tap action the UI selected.
      const action = scene.oneTapActions.find(a => a.id === actionId);
      if (!action) {
        throw new SceneLensError(
          ErrorCode.APP_NOT_FOUND,
          `Action not found: ${actionId}`,
          true
        );
      }

      const result = await this.executeAction(scene, action, options);
      await this.recordResponse({
        sceneId: sceneType,
        actionId: action.id,
        actionType: action.action as OneTapActionKind,
        timestamp: Date.now(),
      });

      return {
        sceneId: sceneType,
        success: result.success,
        status: result.status,
        executedActions: result.executedActions,
        skippedActions: result.skippedActions,
        fallbackApplied: result.fallbackApplied,
        summary: result.summary,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[SceneSuggestionManager] 执行场景建议失败:`, error);
      return {
        sceneId: sceneType,
        success: false,
        status: 'failed',
        executedActions: [],
        skippedActions: [],
        fallbackApplied: false,
        summary: summarizeSuggestionExecution([], 0),
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
    status: SuggestionExecutionResult['status'];
    executedActions: SuggestionExecutedAction[];
    skippedActions: string[];
    fallbackApplied: boolean;
    summary: SuggestionExecutionResult['summary'];
  }> {
    const executedActions: SuggestionExecutedAction[] = [];
    const skippedActions: string[] = [];
    let fallbackApplied = false;
    const allowFallback = options.autoFallback === true;

    // 检查权限状态
    const permissionStatus = await this.checkPermissions();

    // 处理不同的操作类型
    switch (action.action) {
      case 'execute_all':
        // 执行所有系统调整和应用启动
        for (const adjustment of scene.systemAdjustments) {
          const result = await this.executeSystemAdjustment(adjustment, permissionStatus);
          executedActions.push(result);
          if (!result.success) {
            if (!allowFallback) {
              return {
                success: false,
                status: 'failed',
                executedActions,
                skippedActions,
                fallbackApplied,
                summary: summarizeSuggestionExecution(executedActions, skippedActions.length),
              };
            }

            fallbackApplied = true;
          }
        }

        for (const appLaunch of scene.appLaunches) {
          const result = await this.executeAppLaunch(appLaunch, allowFallback);
          executedActions.push(result);
          if (result.usedFallback) {
            fallbackApplied = true;
          }

          if (!result.success && !allowFallback) {
            return {
              success: false,
              status: 'failed',
              executedActions,
              skippedActions,
              fallbackApplied,
              summary: summarizeSuggestionExecution(executedActions, skippedActions.length),
            };
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

    const summary = summarizeSuggestionExecution(executedActions, skippedActions.length);
    const status =
      action.action === 'dismiss'
        ? 'dismissed'
        : action.action === 'snooze'
          ? 'snoozed'
          : deriveSuggestionExecutionStatus(summary);

    // 判断整体是否成功（至少有一个动作达到可用状态，或者操作类型是 dismiss/snooze）
    const success =
      action.action === 'dismiss' ||
      action.action === 'snooze' ||
      summary.automatedCount > 0 ||
      summary.needsUserInputCount > 0;

    return { success, status, executedActions, skippedActions, fallbackApplied, summary };
  }

  /**
   * 执行系统调整
   */
  private async executeSystemAdjustment(
    adjustment: SystemAdjustment,
    permissionStatus: PermissionStatus
  ): Promise<SuggestionExecutedAction> {
    try {
      // 记录执行信息
      console.log(`[SceneSuggestionManager] 执行系统调整: ${adjustment.action} - ${adjustment.label}`);

      if (adjustment.action === 'setDoNotDisturb' && !permissionStatus.hasDoNotDisturbPermission) {
        return {
          type: 'system',
          description: adjustment.label,
          success: false,
          completionStatus: 'failed',
          error: 'Do Not Disturb permission not granted',
        };
      }

      if (
        (adjustment.action === 'setBrightness' || adjustment.action === 'setVolume') &&
        !permissionStatus.hasWriteSettingsPermission
      ) {
        return {
          type: 'system',
          description: adjustment.label,
          success: false,
          completionStatus: 'failed',
          error: 'Write settings permission not granted',
        };
      }

      if (adjustment.action === 'setWakeLock' && !permissionStatus.hasWakeLockPermission) {
        return {
          type: 'system',
          description: adjustment.label,
          success: false,
          completionStatus: 'failed',
          error: 'Wake lock permission not granted',
        };
      }
      
      let result: any = null;
      let error: string | null = null;

      // 尝试执行系统操作
      try {
        switch (adjustment.action) {
          case 'setDoNotDisturb': {
            const { enabled, mode } = resolveDoNotDisturbSettings(adjustment.params);
            const success = await SystemSettingsController.setDoNotDisturb(enabled, mode);
            if (!success) {
              throw new Error(`勿扰模式设置失败: enabled=${enabled}, mode=${mode}`);
            }
            result = { enabled, mode };
            console.log(`[SceneSuggestionManager] ✓ 勿扰模式已${enabled ? '开启' : '关闭'} (${mode})`);
            
            // 如果权限不足，记录警告信息
            if (!permissionStatus.hasDoNotDisturbPermission) {
              console.warn(`[SceneSuggestionManager] ⚠ 勿扰模式权限不足，但已尝试执行。用户需要在系统设置中授予权限。`);
            }
            break;
          }

          case 'setBrightness': {
            const level = adjustment.params?.level ?? 0.5;
            const success = await SystemSettingsController.setBrightness(level);
            if (!success) {
              throw new Error(`亮度设置失败: ${level}`);
            }
            result = { level };
            console.log(`[SceneSuggestionManager] ✓ 亮度已调整为 ${level}`);
            
            // 如果权限不足，记录警告信息
            if (!permissionStatus.hasWriteSettingsPermission) {
              console.warn(`[SceneSuggestionManager] ⚠ 系统设置权限不足，但已尝试执行。用户需要在系统设置中授予权限。`);
            }
            break;
          }

          case 'setWakeLock':
            result = await SceneBridge.setWakeLock(
              adjustment.params?.enable ?? false,
              adjustment.params?.timeout ?? 300000
            );
            console.log(`[SceneSuggestionManager] ✓ 唤醒锁已${adjustment.params?.enable ? '开启' : '关闭'}`);
            break;

          case 'setVolume':
            {
              const { streamType, levelPercent } = resolveVolumeParams(adjustment.params);
              const success = await SystemSettingsController.setVolume(streamType, levelPercent);
              if (!success) {
                throw new Error(`音量设置失败: ${streamType}=${levelPercent}%`);
              }
              console.log(`[SceneSuggestionManager] ✓ 音量已设置: ${streamType}=${levelPercent}%`);
            }
            break;

          default:
            console.warn(`[SceneSuggestionManager] ⚠ 未知的系统操作: ${adjustment.action}`);
            error = `未知的系统操作: ${adjustment.action}`;
        }
      } catch (executeError) {
        // 捕获执行时的错误
        error = executeError instanceof Error ? executeError.message : String(executeError);
        console.warn(`[SceneSuggestionManager] ⚠ 系统调整执行异常 (${adjustment.action}): ${error}`);
        
        // 检查是否是权限相关的错误
        if (error.includes('Write settings') || error.includes('not allowed')) {
          console.warn(`[SceneSuggestionManager] 这是权限问题。用户需要在"系统设置 > 应用 > ${APP_NAME} > 修改系统设置"中授予权限`);
        } else if (error.includes('Notification policy') || error.includes('DND')) {
          console.warn(`[SceneSuggestionManager] 这是勿扰模式权限问题。用户需要在"系统设置 > 应用 > ${APP_NAME} > 通知权限"中授予权限`);
        }
        
        console.warn('[SceneSuggestionManager] 系统调整执行失败');
      }

      const success = !error;
      return {
        type: 'system',
        description: adjustment.label,
        success,
        completionStatus: success ? 'automated' : 'failed',
        error: error ?? undefined,
      };
    } catch (error) {
      console.error(`[SceneSuggestionManager] ✗ 系统调整异常: ${adjustment.action}`, error);
      return {
        type: 'system',
        description: adjustment.label,
        success: false,
        completionStatus: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 执行应用启动
   */
  private async executeAppLaunch(
    appLaunch: AppLaunch,
    allowFallback: boolean
  ): Promise<SuggestionExecutedAction> {
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
          completionStatus: 'failed',
          error: `Unable to resolve package name: ${appLaunch.intent ?? 'unknown'}`,
        };
      }

      // 检查应用是否已安装
      const isInstalled = await SceneBridge.isAppInstalled(packageName);
      if (!isInstalled) {
        return {
          type: 'app',
          description: appLaunch.label,
          success: false,
          completionStatus: 'failed',
          error: `App not installed: ${packageName}`,
        };
      }

      const deepLink = appLaunch.deepLink?.trim() || undefined;

      if (deepLink) {
        const success = await SceneBridge.openAppWithDeepLink(packageName, deepLink);

        if (success) {
          return {
            type: 'app',
            description: appLaunch.label,
            success: true,
            completionStatus: 'needs_user_input',
          };
        }

        // Deep-link fallback should be opt-in only.
        if (!allowFallback) {
          return {
            type: 'app',
            description: appLaunch.label,
            success: false,
            completionStatus: 'failed',
            error: `Unable to open app deep link: ${packageName}`,
          };
        }
      }

      const fallbackSuccess = await SceneBridge.openAppWithDeepLink(packageName);
      if (fallbackSuccess) {
        return {
          type: 'app',
          description: `${appLaunch.label}（${appLaunch.fallbackAction ?? '仅打开应用首页'}）`,
          success: false,
          completionStatus: 'opened_app_home',
          usedFallback: true,
          error: deepLink
            ? `Deep link unavailable; opened app home only: ${packageName}`
            : `No verified deep link; opened app home only: ${packageName}`,
        };
      }

      return {
        type: 'app',
        description: appLaunch.label,
        success: false,
        completionStatus: 'failed',
        error: `Unable to open app: ${packageName}`,
      };
    } catch (error) {
      console.warn(`[SceneSuggestionManager] 应用启动异常:`, error);
      return {
        type: 'app',
        description: appLaunch.label,
        success: false,
        completionStatus: 'failed',
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
    try {
      // 尝试检查权限
      const [
        doNotDisturbResult,
        writeSettingsResult,
        wakeLockResult,
        calendarResult,
      ] = await Promise.allSettled([
        SceneBridge.checkDoNotDisturbPermission(),
        SceneBridge.checkWriteSettingsPermission(),
        SceneBridge.checkPermission('android.permission.WAKE_LOCK'),
        SceneBridge.hasCalendarPermission(),
      ]);

      // 从 Promise 结果中提取值
      const hasDoNotDisturbPermission = 
        doNotDisturbResult.status === 'fulfilled' ? doNotDisturbResult.value : false;
      const hasWriteSettingsPermission = 
        writeSettingsResult.status === 'fulfilled' ? writeSettingsResult.value : false;
      const hasWakeLockPermission = 
        wakeLockResult.status === 'fulfilled' ? wakeLockResult.value : false;
      const hasCalendarPermission = 
        calendarResult.status === 'fulfilled' ? calendarResult.value : false;

      console.log('[SceneSuggestionManager] 权限检查结果:', {
        hasDoNotDisturbPermission,
        hasWriteSettingsPermission,
        hasWakeLockPermission,
        hasCalendarPermission,
      });

      return {
        hasDoNotDisturbPermission,
        hasWriteSettingsPermission,
        hasWakeLockPermission,
        hasCalendarPermission,
      };
    } catch (error) {
      console.error('[SceneSuggestionManager] 检查权限异常，默认为无权限:', error);
      // 返回全部没有权限，让执行时降级处理
      return {
        hasDoNotDisturbPermission: false,
        hasWriteSettingsPermission: false,
        hasWakeLockPermission: false,
        hasCalendarPermission: false,
      };
    }
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
    console.log('[SceneSuggestionManager] 记录用户响应:', response);
    try {
      const existing = storageManager.getString(RESPONSE_HISTORY_KEY);
      const history: SuggestionResponse[] = existing ? JSON.parse(existing) : [];
      history.push(response);
      storageManager.set(
        RESPONSE_HISTORY_KEY,
        JSON.stringify(history.slice(-MAX_RESPONSE_HISTORY))
      );
    } catch (error) {
      console.warn('[SceneSuggestionManager] 保存用户响应失败:', error);
    }
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

// 导出类和单例实例
export { SceneSuggestionManagerClass as SceneSuggestionManager };
export const sceneSuggestionManager = new SceneSuggestionManagerClass();
export default sceneSuggestionManager;
