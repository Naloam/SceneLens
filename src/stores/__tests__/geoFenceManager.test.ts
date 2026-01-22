/**
 * GeoFenceManager 测试
 */

import { geoFenceManager } from '../geoFenceManager';
import type { Location } from '../../types';

describe('GeoFenceManager', () => {
  beforeEach(async () => {
    // 清除所有地理围栏
    await geoFenceManager.clearAllGeoFences();
    // 重新初始化
    await geoFenceManager.initialize();
  });

  describe('GeoFence CRUD Operations', () => {
    it('should create a geo fence', async () => {
      const geoFence = await geoFenceManager.createGeoFence(
        '测试围栏',
        'HOME',
        39.9042,
        116.4074,
        100
      );

      expect(geoFence.name).toBe('测试围栏');
      expect(geoFence.type).toBe('HOME');
      expect(geoFence.latitude).toBe(39.9042);
      expect(geoFence.longitude).toBe(116.4074);
      expect(geoFence.radius).toBe(100);
      expect(geoFence.id).toBeTruthy();
    });

    it('should update a geo fence', async () => {
      const geoFence = await geoFenceManager.createGeoFence(
        '测试围栏',
        'HOME',
        39.9042,
        116.4074,
        100
      );

      const updated = await geoFenceManager.updateGeoFence(geoFence.id, {
        name: '更新的围栏',
        radius: 200,
      });

      expect(updated?.name).toBe('更新的围栏');
      expect(updated?.radius).toBe(200);
      expect(updated?.type).toBe('HOME'); // 未更新的字段保持不变
    });

    it('should delete a geo fence', async () => {
      const geoFence = await geoFenceManager.createGeoFence(
        '测试围栏',
        'HOME',
        39.9042,
        116.4074,
        100
      );

      const deleted = await geoFenceManager.deleteGeoFence(geoFence.id);
      expect(deleted).toBe(true);

      const retrieved = geoFenceManager.getGeoFence(geoFence.id);
      expect(retrieved).toBeNull();
    });

    it('should get geo fence by id', async () => {
      const geoFence = await geoFenceManager.createGeoFence(
        '测试围栏',
        'HOME',
        39.9042,
        116.4074,
        100
      );

      const retrieved = geoFenceManager.getGeoFence(geoFence.id);
      expect(retrieved?.name).toBe('测试围栏');
    });

    it('should get all geo fences', async () => {
      await geoFenceManager.createGeoFence('围栏1', 'HOME', 39.9042, 116.4074, 100);
      await geoFenceManager.createGeoFence('围栏2', 'OFFICE', 39.9142, 116.4174, 200);

      const all = geoFenceManager.getAllGeoFences();
      expect(all.length).toBe(2);
    });

    it('should get geo fences by type', async () => {
      await geoFenceManager.createGeoFence('家', 'HOME', 39.9042, 116.4074, 100);
      await geoFenceManager.createGeoFence('办公室', 'OFFICE', 39.9142, 116.4174, 200);
      await geoFenceManager.createGeoFence('家2', 'HOME', 39.9242, 116.4274, 150);

      const homeFences = geoFenceManager.getGeoFencesByType('HOME');
      expect(homeFences.length).toBe(2);

      const officeFences = geoFenceManager.getGeoFencesByType('OFFICE');
      expect(officeFences.length).toBe(1);
    });
  });

  describe('Location Detection', () => {
    it('should detect if location is in geo fence', async () => {
      // 创建一个围栏（天安门广场附近）
      const geoFence = await geoFenceManager.createGeoFence(
        '天安门',
        'CUSTOM',
        39.9042,
        116.4074,
        100 // 100米半径
      );

      // 测试围栏内的位置
      const insideLocation: Location = {
        latitude: 39.9045, // 很接近
        longitude: 116.4076,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const isInside = geoFenceManager.isLocationInGeoFence(insideLocation, geoFence.id);
      expect(isInside).toBe(true);

      // 测试围栏外的位置
      const outsideLocation: Location = {
        latitude: 39.9142, // 距离较远
        longitude: 116.4174,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const isOutside = geoFenceManager.isLocationInGeoFence(outsideLocation, geoFence.id);
      expect(isOutside).toBe(false);
    });

    it('should find geo fences for location', async () => {
      // 创建两个重叠的围栏
      await geoFenceManager.createGeoFence('围栏1', 'HOME', 39.9042, 116.4074, 200);
      await geoFenceManager.createGeoFence('围栏2', 'OFFICE', 39.9045, 116.4076, 150);

      const location: Location = {
        latitude: 39.9044,
        longitude: 116.4075,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const fences = geoFenceManager.findGeoFencesForLocation(location);
      expect(fences.length).toBe(2);
    });

    it('should find nearest geo fence', async () => {
      await geoFenceManager.createGeoFence('近的', 'HOME', 39.9042, 116.4074, 100);
      await geoFenceManager.createGeoFence('远的', 'OFFICE', 39.9142, 116.4174, 100);

      const location: Location = {
        latitude: 39.9040,
        longitude: 116.4070,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const nearest = geoFenceManager.findNearestGeoFence(location);
      expect(nearest?.geoFence.name).toBe('近的');
      expect(nearest?.distance).toBeLessThan(100);
    });

    it('should find geo fence by WiFi SSID', async () => {
      await geoFenceManager.createGeoFence(
        '家',
        'HOME',
        39.9042,
        116.4074,
        100,
        'MyHomeWiFi'
      );
      await geoFenceManager.createGeoFence(
        '办公室',
        'OFFICE',
        39.9142,
        116.4174,
        200,
        'OfficeWiFi'
      );

      const homeFences = geoFenceManager.findGeoFenceByWiFi('MyHomeWiFi');
      expect(homeFences.length).toBe(1);
      expect(homeFences[0].name).toBe('家');

      const officeFences = geoFenceManager.findGeoFenceByWiFi('OfficeWiFi');
      expect(officeFences.length).toBe(1);
      expect(officeFences[0].name).toBe('办公室');
    });

    it('should check if location is in fence type', async () => {
      await geoFenceManager.createGeoFence('家', 'HOME', 39.9042, 116.4074, 100);
      await geoFenceManager.createGeoFence('办公室', 'OFFICE', 39.9142, 116.4174, 200);

      const homeLocation: Location = {
        latitude: 39.9045,
        longitude: 116.4076,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const isInHome = geoFenceManager.isLocationInFenceType(homeLocation, 'HOME');
      expect(isInHome).toBe(true);

      const isInOffice = geoFenceManager.isLocationInFenceType(homeLocation, 'OFFICE');
      expect(isInOffice).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate geo fence data', () => {
      const validFence = {
        name: '测试围栏',
        type: 'HOME' as const,
        latitude: 39.9042,
        longitude: 116.4074,
        radius: 100,
      };

      const errors = geoFenceManager.validateGeoFence(validFence);
      expect(errors.length).toBe(0);
    });

    it('should return validation errors for invalid data', () => {
      const invalidFence = {
        name: '',
        type: undefined,
        latitude: 200, // 无效纬度
        longitude: -200, // 无效经度
        radius: -50, // 无效半径
      };

      const errors = geoFenceManager.validateGeoFence(invalidFence);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('名称'))).toBe(true);
      expect(errors.some(e => e.includes('类型'))).toBe(true);
      expect(errors.some(e => e.includes('纬度'))).toBe(true);
      expect(errors.some(e => e.includes('经度'))).toBe(true);
      expect(errors.some(e => e.includes('半径'))).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should get geo fence statistics', async () => {
      await geoFenceManager.createGeoFence('家1', 'HOME', 39.9042, 116.4074, 100);
      await geoFenceManager.createGeoFence('家2', 'HOME', 39.9142, 116.4174, 100);
      await geoFenceManager.createGeoFence('办公室', 'OFFICE', 39.9242, 116.4274, 200);

      const stats = geoFenceManager.getGeoFenceStats();
      expect(stats.total).toBe(3);
      expect(stats.byType.HOME).toBe(2);
      expect(stats.byType.OFFICE).toBe(1);
      expect(stats.byType.SUBWAY_STATION).toBe(0);
      expect(stats.byType.CUSTOM).toBe(0);
    });
  });
});