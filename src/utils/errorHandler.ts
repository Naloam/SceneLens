/**
 * ErrorHandler - 统一错误处理器
 *
 * 职责：
 * - 统一处理各类错误
 * - 提供降级方案
 * - 用户友好的错误提示
 *
 * Requirements: 需求 11.2（错误处理完善）
 */

import { SceneLensError, ErrorCode } from '../types';

/**
 * 错误处理结果
 */
export interface ErrorHandlingResult {
  shouldRetry: boolean;
  maxRetries?: number;
  userMessage: string;
  fallbackAction?: string;
  logToAnalytics: boolean;
}

/**
 * 错误统计
 */
interface ErrorStats {
  totalCount: number;
  errorCounts: Map<ErrorCode, number>;
  lastErrorTime: number;
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  private errorStats: ErrorStats = {
    totalCount: 0,
    errorCounts: new Map(),
    lastErrorTime: 0,
  };

  /**
   * 处理错误
   *
   * @param error 错误对象
   * @returns 错误处理结果
   */
  handle(error: unknown): ErrorHandlingResult {
    // 更新统计
    this.updateStats(error);

    // 处理 SceneLensError
    if (error instanceof SceneLensError) {
      return this.handleSceneLensError(error);
    }

    // 处理标准 Error
    if (error instanceof Error) {
      return this.handleStandardError(error);
    }

    // 处理未知错误类型
    return this.handleUnknownError(error);
  }

  /**
   * 处理 SceneLensError
   *
   * @param error SceneLensError
   * @returns 错误处理结果
   */
  private handleSceneLensError(error: SceneLensError): ErrorHandlingResult {
    switch (error.code) {
      case ErrorCode.PERMISSION_DENIED:
        return {
          shouldRetry: false,
          userMessage: '需要相关权限才能使用此功能。请前往设置页面授权。',
          fallbackAction: 'show_permission_guide',
          logToAnalytics: false,
        };

      case ErrorCode.PERMISSION_REQUIRED:
        return {
          shouldRetry: true,
          maxRetries: 1,
          userMessage: '需要授权才能继续，请允许相关权限。',
          fallbackAction: 'request_permission',
          logToAnalytics: false,
        };

      case ErrorCode.APP_NOT_FOUND:
        return {
          shouldRetry: false,
          userMessage: '未找到相关应用，请先安装该应用。',
          fallbackAction: 'open_app_store',
          logToAnalytics: false,
        };

      case ErrorCode.APP_LAUNCH_FAILED:
        return {
          shouldRetry: true,
          maxRetries: 2,
          userMessage: '应用启动失败，正在重试...',
          fallbackAction: 'show_app_manual_launch',
          logToAnalytics: true,
        };

      case ErrorCode.DEEP_LINK_INVALID:
        return {
          shouldRetry: true,
          maxRetries: 1,
          userMessage: '无法打开应用特定页面，已尝试打开应用首页。',
          fallbackAction: 'open_app_home',
          logToAnalytics: true,
        };

      case ErrorCode.MODEL_LOAD_FAILED:
        return {
          shouldRetry: true,
          maxRetries: 3,
          userMessage: '场景识别模型加载失败，正在重试...',
          fallbackAction: 'use_rule_based_only',
          logToAnalytics: true,
        };

      case ErrorCode.MODEL_INFERENCE_FAILED:
        return {
          shouldRetry: true,
          maxRetries: 2,
          userMessage: '场景识别失败，正在使用规则引擎...',
          fallbackAction: 'use_rule_based_only',
          logToAnalytics: true,
        };

      case ErrorCode.NETWORK_UNAVAILABLE:
        return {
          shouldRetry: true,
          maxRetries: 5,
          userMessage: '网络不可用，部分功能受限。',
          fallbackAction: 'use_offline_mode',
          logToAnalytics: false,
        };

      case ErrorCode.DATA_CORRUPTED:
        return {
          shouldRetry: false,
          userMessage: '数据损坏，请清除应用数据后重试。',
          fallbackAction: 'clear_data',
          logToAnalytics: true,
        };

      case ErrorCode.STORAGE_FULL:
        return {
          shouldRetry: false,
          userMessage: '存储空间不足，请清理设备存储。',
          fallbackAction: 'show_storage_settings',
          logToAnalytics: false,
        };

      case ErrorCode.SYSTEM_API_FAILED:
        return {
          shouldRetry: true,
          maxRetries: 2,
          userMessage: '系统功能暂时不可用。',
          fallbackAction: 'use_fallback_method',
          logToAnalytics: true,
        };

      case ErrorCode.DEVICE_NOT_SUPPORTED:
        return {
          shouldRetry: false,
          userMessage: '当前设备不支持此功能。',
          fallbackAction: 'disable_feature',
          logToAnalytics: true,
        };

      default:
        return {
          shouldRetry: error.recoverable,
          userMessage: error.message || '发生未知错误',
          logToAnalytics: true,
        };
    }
  }

  /**
   * 处理标准 Error
   *
   * @param error 标准错误
   * @returns 错误处理结果
   */
  private handleStandardError(error: Error): ErrorHandlingResult {
    const message = error.message.toLowerCase();

    // 根据错误消息推断错误类型
    if (message.includes('permission') || message.includes('授权') || message.includes('权限')) {
      return {
        shouldRetry: false,
        userMessage: '需要相关权限才能使用此功能。请前往设置页面授权。',
        fallbackAction: 'show_permission_guide',
        logToAnalytics: false,
      };
    }

    if (message.includes('network') || message.includes('网络') || message.includes('连接')) {
      return {
        shouldRetry: true,
        maxRetries: 3,
        userMessage: '网络连接失败，正在重试...',
        fallbackAction: 'use_offline_mode',
        logToAnalytics: false,
      };
    }

    if (message.includes('timeout') || message.includes('超时')) {
      return {
        shouldRetry: true,
        maxRetries: 2,
        userMessage: '操作超时，正在重试...',
        fallbackAction: 'show_timeout_message',
        logToAnalytics: true,
      };
    }

    // 默认处理
    return {
      shouldRetry: true,
      maxRetries: 1,
      userMessage: '操作失败，正在重试...',
      fallbackAction: 'show_generic_error',
      logToAnalytics: true,
    };
  }

  /**
   * 处理未知错误
   *
   * @param error 未知错误
   * @returns 错误处理结果
   */
  private handleUnknownError(error: unknown): ErrorHandlingResult {
    return {
      shouldRetry: false,
      userMessage: '发生未知错误，请重启应用。',
      fallbackAction: 'show_generic_error',
      logToAnalytics: true,
    };
  }

  /**
   * 更新错误统计
   *
   * @param error 错误对象
   */
  private updateStats(error: unknown): void {
    this.errorStats.totalCount++;
    this.errorStats.lastErrorTime = Date.now();

    if (error instanceof SceneLensError) {
      const count = this.errorStats.errorCounts.get(error.code) || 0;
      this.errorStats.errorCounts.set(error.code, count + 1);
    }
  }

  /**
   * 获取错误统计
   *
   * @returns 错误统计信息
   */
  getStats(): {
    totalCount: number;
    errorCounts: Record<string, number>;
    lastErrorTime: number;
  } {
    const errorCounts: Record<string, number> = {};
    for (const [code, count] of this.errorStats.errorCounts.entries()) {
      errorCounts[code] = count;
    }

    return {
      totalCount: this.errorStats.totalCount,
      errorCounts,
      lastErrorTime: this.errorStats.lastErrorTime,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.errorStats = {
      totalCount: 0,
      errorCounts: new Map(),
      lastErrorTime: 0,
    };
  }

  /**
   * 检查是否应该降级功能
   * 当同一错误连续发生多次时，建议降级
   *
   * @param code 错误码
   * @param threshold 阈值（默认3次）
   * @returns 是否应该降级
   */
  shouldFallback(code: ErrorCode, threshold: number = 3): boolean {
    const count = this.errorStats.errorCounts.get(code) || 0;
    return count >= threshold;
  }
}

/**
 * 降级管理器
 * 提供各种降级方案的具体实现
 */
export class FallbackManager {
  /**
   * 处理权限被拒绝
   *
   * @param permission 权限名称
   * @returns 用户提示
   */
  handlePermissionDenied(permission: string): string {
    const permissionMessages: Record<string, string> = {
      'LOCATION': '位置权限用于识别通勤、到家、出行等场景',
      'CAMERA': '相机权限用于精确识别当前环境（仅在您主动触发时）',
      'MICROPHONE': '麦克风权限用于环境音识别（仅在您主动触发时）',
      'PACKAGE_USAGE_STATS': '使用统计权限用于学习您的应用偏好',
      'ACTIVITY_RECOGNITION': '活动识别权限用于检测运动状态',
      'CALENDAR': '日历权限用于识别会议场景',
    };

    const baseMessage = permissionMessages[permission] || '此权限对于场景识别功能是必需的';
    return `${baseMessage}\n\n您可以前往设置页面手动授权。`;
  }

  /**
   * 处理应用未安装
   *
   * @param appName 应用名称
   * @returns 用户提示
   */
  handleAppNotFound(appName: string): string {
    return `未找到应用「${appName}」。\n\n您可以：\n1. 从应用商店安装该应用\n2. 在设置中选择其他应用`;
  }

  /**
   * 处理应用启动失败
   *
   * @param appName 应用名称
   * @returns 用户提示
   */
  handleAppLaunchFailed(appName: string): string {
    return `无法打开应用「${appName}」。\n\n请尝试：\n1. 手动打开应用\n2. 检查应用是否正常安装`;
  }

  /**
   * 处理模型推理失败
   *
   * @returns 用户提示
   */
  handleModelFailed(): string {
    return '场景识别功能暂时不可用，正在使用规则引擎。\n\n这不会影响基本功能的使用。';
  }

  /**
   * 处理网络不可用
   *
   * @returns 用户提示
   */
  handleNetworkUnavailable(): string {
    return '网络不可用，部分功能受限。\n\n场景识别功能仍可正常使用。';
  }

  /**
   * 处理数据损坏
   *
   * @returns 用户提示
   */
  handleDataCorrupted(): string {
    return '数据损坏，请清除应用数据后重试。\n\n您可以在设置页面找到"清除数据"选项。';
  }

  /**
   * 处理存储空间不足
   *
   * @returns 用户提示
   */
  handleStorageFull(): string {
    return '设备存储空间不足，请清理后重试。\n\n建议清理：\n1. 应用缓存\n2. 临时文件\n3. 不常用的应用';
  }

  /**
   * 处理设备不支持
   *
   * @param feature 功能名称
   * @returns 用户提示
   */
  handleDeviceNotSupported(feature: string): string {
    return `您的设备不支持「${feature}」功能。\n\n该功能需要特定的硬件或系统版本支持。`;
  }

  /**
   * 处理系统 API 失败
   *
   * @param apiName API 名称
   * @returns 用户提示
   */
  handleSystemApiFailed(apiName: string): string {
    return `系统功能「${apiName}」暂时不可用。\n\n正在使用替代方案，功能可能受限。`;
  }

  /**
   * 获取降级操作
   *
   * @param fallbackAction 降级操作标识
   * @returns 用户提示
   */
  getFallbackMessage(fallbackAction: string): string {
    const messages: Record<string, string> = {
      show_permission_guide: '需要授权才能继续',
      request_permission: '正在请求权限...',
      open_app_store: '正在打开应用商店...',
      show_app_manual_launch: '请手动打开应用',
      open_app_home: '已尝试打开应用首页',
      use_rule_based_only: '正在使用规则引擎...',
      use_offline_mode: '已切换到离线模式',
      clear_data: '请清除应用数据',
      show_storage_settings: '请检查设备存储',
      disable_feature: '该功能已被禁用',
      use_fallback_method: '正在使用替代方案...',
      show_timeout_message: '操作超时，请稍后重试',
      show_generic_error: '发生错误，请稍后重试',
    };

    return messages[fallbackAction] || '正在尝试恢复...';
  }
}

// 导出单例实例
export const errorHandler = new ErrorHandler();
export const fallbackManager = new FallbackManager();

export default {
  errorHandler,
  fallbackManager,
};
