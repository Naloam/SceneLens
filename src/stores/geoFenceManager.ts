/**
 * GeoFence Manager - 地理围栏管理器
 * 
 * 提供地理围栏的创建、保存、加载和位置判断功能
 */

import type { 
  GeoFence, 
  GeoFenceType, 
  Location 
} from '../types';
import { StorageKeys } from '../types';
import { storageManager } from './storageManager';

/**
 * 地理围栏管理器类
 */
class GeoFenceManagerClass {
  private geoFences: Map<string, GeoFence> = new Map();
  private initialized = false;

  /**
   * 初始化地理围栏管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.loadGeoFences();
    this.initialized = true;
  }

  /**
   * 创建地理围栏
   */
  async createGeoFence(
    name: string,
    type: GeoFenceType,
    latitude: number,
    longitude: number,
    radius: number,
    wifiSSID?: string
  ): Promise<GeoFence> {
    const geoFence: GeoFence = {
      id: this.generateId(),
      name,
      type,
      latitude,
      longitude,
      radius,
      wifiSSID,
    };

    this.geoFences.set(geoFence.id, geoFence);
    await this.saveGeoFences();
    
    return geoFence;
  }

  /**
   * 更新地理围栏
   */
  async updateGeoFence(id: string, updates: Partial<Omit<GeoFence, 'id'>>): Promise<GeoFence | null> {
    const existing = this.geoFences.get(id);
    if (!existing) return null;

    const updated: GeoFence = {
      ...existing,
      ...updates,
    };

    this.geoFences.set(id, updated);
    await this.saveGeoFences();
    
    return updated;
  }

  /**
   * 删除地理围栏
   */
  async deleteGeoFence(id: string): Promise<boolean> {
    const deleted = this.geoFences.delete(id);
    if (deleted) {
      await this.saveGeoFences();
    }
    return deleted;
  }

  /**
   * 获取地理围栏
   */
  getGeoFence(id: string): GeoFence | null {
    return this.geoFences.get(id) || null;
  }

  /**
   * 获取所有地理围栏
   */
  getAllGeoFences(): GeoFence[] {
    return Array.from(this.geoFences.values());
  }

  /**
   * 根据类型获取地理围栏
   */
  getGeoFencesByType(type: GeoFenceType): GeoFence[] {
    return this.getAllGeoFences().filter(fence => fence.type === type);
  }

  /**
   * 判断位置是否在地理围栏内
   */
  isLocationInGeoFence(location: Location, geoFenceId: string): boolean {
    const geoFence = this.geoFences.get(geoFenceId);
    if (!geoFence) return false;

    const distance = this.calculateDistance(
      location.latitude,
      location.longitude,
      geoFence.latitude,
      geoFence.longitude
    );

    return distance <= geoFence.radius;
  }

  /**
   * 查找位置所在的所有地理围栏
   */
  findGeoFencesForLocation(location: Location): GeoFence[] {
    const result: GeoFence[] = [];
    
    for (const geoFence of this.geoFences.values()) {
      if (this.isLocationInGeoFence(location, geoFence.id)) {
        result.push(geoFence);
      }
    }
    
    return result;
  }

  /**
   * 查找最近的地理围栏
   */
  findNearestGeoFence(location: Location): { geoFence: GeoFence; distance: number } | null {
    let nearest: { geoFence: GeoFence; distance: number } | null = null;
    
    for (const geoFence of this.geoFences.values()) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        geoFence.latitude,
        geoFence.longitude
      );
      
      if (!nearest || distance < nearest.distance) {
        nearest = { geoFence, distance };
      }
    }
    
    return nearest;
  }

  /**
   * 根据 Wi-Fi SSID 查找地理围栏
   */
  findGeoFenceByWiFi(ssid: string): GeoFence[] {
    return this.getAllGeoFences().filter(fence => fence.wifiSSID === ssid);
  }

  /**
   * 检查位置是否在特定类型的围栏内
   */
  isLocationInFenceType(location: Location, type: GeoFenceType): boolean {
    const fences = this.getGeoFencesByType(type);
    return fences.some(fence => this.isLocationInGeoFence(location, fence.id));
  }

  /**
   * 获取默认地理围栏（如果不存在则创建）
   */
  async getOrCreateDefaultGeoFences(): Promise<GeoFence[]> {
    const existing = this.getAllGeoFences();
    const defaults: GeoFence[] = [];

    // 检查是否已有 HOME 类型的围栏
    if (!existing.some(f => f.type === 'HOME')) {
      const home = await this.createGeoFence(
        '家',
        'HOME',
        0, // 需要用户设置实际坐标
        0,
        100 // 默认100米半径
      );
      defaults.push(home);
    }

    // 检查是否已有 OFFICE 类型的围栏
    if (!existing.some(f => f.type === 'OFFICE')) {
      const office = await this.createGeoFence(
        '办公室',
        'OFFICE',
        0, // 需要用户设置实际坐标
        0,
        200 // 默认200米半径
      );
      defaults.push(office);
    }

    return defaults;
  }

  /**
   * 保存地理围栏到存储
   */
  private async saveGeoFences(): Promise<void> {
    try {
      const data = Array.from(this.geoFences.entries());
      const geoFencesJson = JSON.stringify(data);
      
      // 使用 storageManager 的内部存储实例
      const storage = (storageManager as any).storage;
      storage.set(StorageKeys.GEO_FENCES, geoFencesJson);
    } catch (error) {
      console.error('Failed to save geo fences:', error);
      throw error;
    }
  }

  /**
   * 从存储加载地理围栏
   */
  private async loadGeoFences(): Promise<void> {
    try {
      // 使用 storageManager 的内部存储实例
      const storage = (storageManager as any).storage;
      const geoFencesJson = storage.getString(StorageKeys.GEO_FENCES);
      
      if (geoFencesJson) {
        const data = JSON.parse(geoFencesJson);
        this.geoFences = new Map(data);
      }
    } catch (error) {
      console.warn('Failed to load geo fences:', error);
      this.geoFences = new Map();
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `geofence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 计算两点之间的距离（米）
   * 使用 Haversine 公式
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // 地球半径（米）
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 清除所有地理围栏
   */
  async clearAllGeoFences(): Promise<void> {
    this.geoFences.clear();
    await this.saveGeoFences();
  }

  /**
   * 获取地理围栏统计信息
   */
  getGeoFenceStats(): {
    total: number;
    byType: Record<GeoFenceType, number>;
  } {
    const stats = {
      total: this.geoFences.size,
      byType: {
        HOME: 0,
        OFFICE: 0,
        SUBWAY_STATION: 0,
        CUSTOM: 0,
      } as Record<GeoFenceType, number>,
    };

    for (const fence of this.geoFences.values()) {
      stats.byType[fence.type]++;
    }

    return stats;
  }

  /**
   * 验证地理围栏数据
   */
  validateGeoFence(geoFence: Partial<GeoFence>): string[] {
    const errors: string[] = [];

    if (!geoFence.name || geoFence.name.trim().length === 0) {
      errors.push('围栏名称不能为空');
    }

    if (!geoFence.type) {
      errors.push('围栏类型不能为空');
    }

    if (typeof geoFence.latitude !== 'number' || 
        geoFence.latitude < -90 || geoFence.latitude > 90) {
      errors.push('纬度必须在 -90 到 90 之间');
    }

    if (typeof geoFence.longitude !== 'number' || 
        geoFence.longitude < -180 || geoFence.longitude > 180) {
      errors.push('经度必须在 -180 到 180 之间');
    }

    if (typeof geoFence.radius !== 'number' || 
        geoFence.radius <= 0 || geoFence.radius > 10000) {
      errors.push('半径必须在 1 到 10000 米之间');
    }

    return errors;
  }
}

// 导出单例实例
export const geoFenceManager = new GeoFenceManagerClass();

// 默认导出类
export default GeoFenceManagerClass;