/**
 * useLocation - 位置管理自定义 Hook
 * 
 * 负责：
 * - 获取当前位置
 * - 刷新位置
 */

import { useState, useCallback } from 'react';
import sceneBridge from '../core/SceneBridge';
import type { Location } from '../types';

export interface UseLocationReturn {
  currentLocation: Location | null;
  isRefreshingLocation: boolean;
  getCurrentLocation: () => Promise<void>;
  refreshLocation: () => Promise<void>;
}

export function useLocation(): UseLocationReturn {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);

  const getCurrentLocation = useCallback(async () => {
    try {
      const location = await sceneBridge.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.warn('[useLocation] 获取当前位置失败:', error);
    }
  }, []);

  const refreshLocation = useCallback(async () => {
    setIsRefreshingLocation(true);
    try {
      const location = await sceneBridge.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.warn('[useLocation] 刷新位置失败:', error);
    } finally {
      setIsRefreshingLocation(false);
    }
  }, []);

  return {
    currentLocation,
    isRefreshingLocation,
    getCurrentLocation,
    refreshLocation,
  };
}

export default useLocation;
