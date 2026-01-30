/**
 * usePermissions Hook
 * 
 * 提供权限管理的 React Hook 封装
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  permissionManager, 
  PermissionType, 
  PermissionStatus,
  PermissionCheckResult,
  BatchPermissionResult,
  PERMISSION_GROUPS,
} from '../utils/PermissionManager';

export interface UsePermissionsReturn {
  /** 权限状态映射 */
  permissions: Map<PermissionType, PermissionCheckResult>;
  /** 是否正在检查权限 */
  checking: boolean;
  /** 是否正在请求权限 */
  requesting: boolean;
  /** 错误信息 */
  error: string | null;
  /** 检查单个权限 */
  checkPermission: (permission: PermissionType) => Promise<PermissionCheckResult>;
  /** 批量检查权限 */
  checkPermissions: (permissions: PermissionType[]) => Promise<Map<PermissionType, PermissionCheckResult>>;
  /** 请求单个权限 */
  requestPermission: (permission: PermissionType) => Promise<PermissionStatus>;
  /** 批量请求权限 */
  requestPermissions: (permissions: PermissionType[]) => Promise<BatchPermissionResult>;
  /** 请求所有必需权限 */
  requestRequiredPermissions: () => Promise<BatchPermissionResult>;
  /** 打开应用设置 */
  openSettings: () => Promise<void>;
  /** 打开特定权限设置 */
  openPermissionSettings: (permission: PermissionType) => Promise<void>;
  /** 刷新所有权限状态 */
  refreshAll: () => Promise<void>;
  /** 检查是否所有必需权限已授权 */
  allRequiredGranted: boolean;
}

/**
 * 权限管理 Hook
 * 
 * @param autoCheck 是否自动检查指定权限
 */
export function usePermissions(
  autoCheck?: PermissionType[]
): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<Map<PermissionType, PermissionCheckResult>>(new Map());
  const [checking, setChecking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allRequiredGranted, setAllRequiredGranted] = useState(false);

  // 检查是否所有必需权限已授权
  const checkAllRequiredGranted = useCallback((perms: Map<PermissionType, PermissionCheckResult>) => {
    const requiredGroups = PERMISSION_GROUPS.filter(g => g.required);
    const requiredPermissions = requiredGroups.flatMap(g => g.permissions);
    
    const allGranted = requiredPermissions.every(p => {
      const result = perms.get(p);
      return result?.status === PermissionStatus.GRANTED;
    });
    
    setAllRequiredGranted(allGranted);
  }, []);

  // 初始化时自动检查指定权限
  useEffect(() => {
    const init = async () => {
      await permissionManager.initialize();
      
      if (autoCheck && autoCheck.length > 0) {
        setChecking(true);
        try {
          const results = await permissionManager.checkPermissions(autoCheck);
          setPermissions(results);
          checkAllRequiredGranted(results);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setChecking(false);
        }
      }
    };

    init();
  }, []);

  const checkPermission = useCallback(async (permission: PermissionType): Promise<PermissionCheckResult> => {
    setChecking(true);
    setError(null);
    
    try {
      const result = await permissionManager.checkPermission(permission);
      setPermissions(prev => {
        const newMap = new Map(prev);
        newMap.set(permission, result);
        checkAllRequiredGranted(newMap);
        return newMap;
      });
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setChecking(false);
    }
  }, [checkAllRequiredGranted]);

  const checkPermissions = useCallback(async (perms: PermissionType[]): Promise<Map<PermissionType, PermissionCheckResult>> => {
    setChecking(true);
    setError(null);
    
    try {
      const results = await permissionManager.checkPermissions(perms);
      setPermissions(prev => {
        const newMap = new Map(prev);
        results.forEach((value, key) => newMap.set(key, value));
        checkAllRequiredGranted(newMap);
        return newMap;
      });
      return results;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setChecking(false);
    }
  }, [checkAllRequiredGranted]);

  const requestPermission = useCallback(async (permission: PermissionType): Promise<PermissionStatus> => {
    setRequesting(true);
    setError(null);
    
    try {
      const status = await permissionManager.requestPermission(permission);
      // 重新检查该权限以获取最新状态
      const result = await permissionManager.checkPermission(permission);
      setPermissions(prev => {
        const newMap = new Map(prev);
        newMap.set(permission, result);
        checkAllRequiredGranted(newMap);
        return newMap;
      });
      return status;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setRequesting(false);
    }
  }, [checkAllRequiredGranted]);

  const requestPermissions = useCallback(async (perms: PermissionType[]): Promise<BatchPermissionResult> => {
    setRequesting(true);
    setError(null);
    
    try {
      const batchResult = await permissionManager.requestPermissions(perms);
      // 重新检查所有权限以获取最新状态
      const results = await permissionManager.checkPermissions(perms);
      setPermissions(prev => {
        const newMap = new Map(prev);
        results.forEach((value, key) => newMap.set(key, value));
        checkAllRequiredGranted(newMap);
        return newMap;
      });
      return batchResult;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setRequesting(false);
    }
  }, [checkAllRequiredGranted]);

  const requestRequiredPermissions = useCallback(async (): Promise<BatchPermissionResult> => {
    setRequesting(true);
    setError(null);
    
    try {
      const batchResult = await permissionManager.requestRequiredPermissions();
      // 重新检查必需权限以获取最新状态
      const requiredGroups = PERMISSION_GROUPS.filter(g => g.required);
      const requiredPermissions = requiredGroups.flatMap(g => g.permissions);
      const results = await permissionManager.checkPermissions(requiredPermissions);
      setPermissions(prev => {
        const newMap = new Map(prev);
        results.forEach((value, key) => newMap.set(key, value));
        checkAllRequiredGranted(newMap);
        return newMap;
      });
      return batchResult;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setRequesting(false);
    }
  }, [checkAllRequiredGranted]);

  const openSettings = useCallback(async () => {
    await permissionManager.openAppSettings();
  }, []);

  const openPermissionSettings = useCallback(async (permission: PermissionType) => {
    await permissionManager.openSpecificSettings(permission);
  }, []);

  const refreshAll = useCallback(async () => {
    const allPermissionTypes = Object.values(PermissionType);
    await checkPermissions(allPermissionTypes);
  }, [checkPermissions]);

  return {
    permissions,
    checking,
    requesting,
    error,
    checkPermission,
    checkPermissions,
    requestPermission,
    requestPermissions,
    requestRequiredPermissions,
    openSettings,
    openPermissionSettings,
    refreshAll,
    allRequiredGranted,
  };
}

export default usePermissions;
