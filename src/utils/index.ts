/**
 * Utils 工具模块索引
 *
 * 导出所有工具类和辅助函数
 */

export { CacheManager, SceneCacheKeyBuilder, sceneCache, ruleCache, appCache } from './cacheManager';
export { DeepLinkManager, deepLinkManager } from './deepLinkManager';
export { ErrorHandler, FallbackManager, errorHandler, fallbackManager } from './errorHandler';
export * from './diagnostics';
export { 
  PermissionManager, 
  permissionManager, 
  PermissionType, 
  PermissionStatus,
  PERMISSION_GROUPS,
} from './PermissionManager';
export type { 
  PermissionGroup,
  PermissionCheckResult, 
  BatchPermissionResult 
} from './PermissionManager';
