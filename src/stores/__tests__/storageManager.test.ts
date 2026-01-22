/**
 * StorageManager 测试
 */

import { storageManager } from '../storageManager';
import type { AppCategory, AppPreference, SceneHistory } from '../../types';

describe('StorageManager', () => {
  beforeEach(async () => {
    // 清除所有数据
    await storageManager.clearAllData();
  });

  describe('App Preferences', () => {
    it('should save and load app preferences', async () => {
      const preferences = new Map<AppCategory, AppPreference>();
      preferences.set('MUSIC_PLAYER', {
        category: 'MUSIC_PLAYER',
        topApps: ['com.spotify.music', 'com.netease.cloudmusic'],
        lastUpdated: Date.now(),
      });
      preferences.set('TRANSIT_APP', {
        category: 'TRANSIT_APP',
        topApps: ['com.alipay.android.app'],
        lastUpdated: Date.now(),
      });

      // 保存偏好
      await storageManager.saveAppPreferences(preferences);

      // 加载偏好
      const loaded = await storageManager.loadAppPreferences();

      expect(loaded.size).toBe(2);
      expect(loaded.get('MUSIC_PLAYER')?.topApps).toEqual(['com.spotify.music', 'com.netease.cloudmusic']);
      expect(loaded.get('TRANSIT_APP')?.topApps).toEqual(['com.alipay.android.app']);
    });

    it('should return empty map when no preferences exist', async () => {
      const loaded = await storageManager.loadAppPreferences();
      expect(loaded.size).toBe(0);
    });
  });

  describe('Scene History', () => {
    it('should record and load scene history', async () => {
      const history1: SceneHistory = {
        sceneType: 'COMMUTE',
        timestamp: Date.now(),
        confidence: 0.8,
        triggered: true,
        userAction: 'accept',
      };

      const history2: SceneHistory = {
        sceneType: 'HOME',
        timestamp: Date.now() + 1000,
        confidence: 0.9,
        triggered: false,
        userAction: null,
      };

      // 记录历史
      await storageManager.recordSceneHistory(history1);
      await storageManager.recordSceneHistory(history2);

      // 加载历史
      const loaded = await storageManager.loadSceneHistory();

      expect(loaded.length).toBe(2);
      expect(loaded[0].sceneType).toBe('COMMUTE');
      expect(loaded[1].sceneType).toBe('HOME');
    });

    it('should limit history to 1000 records', async () => {
      // 添加 1001 条记录
      for (let i = 0; i < 1001; i++) {
        const history: SceneHistory = {
          sceneType: 'COMMUTE',
          timestamp: Date.now() + i,
          confidence: 0.8,
          triggered: false,
          userAction: null,
        };
        await storageManager.recordSceneHistory(history);
      }

      const loaded = await storageManager.loadSceneHistory();
      expect(loaded.length).toBe(1000);
    });

    it('should get scene history by type', async () => {
      const commuteHistory: SceneHistory = {
        sceneType: 'COMMUTE',
        timestamp: Date.now(),
        confidence: 0.8,
        triggered: true,
        userAction: 'accept',
      };

      const homeHistory: SceneHistory = {
        sceneType: 'HOME',
        timestamp: Date.now() + 1000,
        confidence: 0.9,
        triggered: false,
        userAction: null,
      };

      await storageManager.recordSceneHistory(commuteHistory);
      await storageManager.recordSceneHistory(homeHistory);

      const commuteRecords = await storageManager.getSceneHistoryByType('COMMUTE');
      expect(commuteRecords.length).toBe(1);
      expect(commuteRecords[0].sceneType).toBe('COMMUTE');

      const homeRecords = await storageManager.getSceneHistoryByType('HOME');
      expect(homeRecords.length).toBe(1);
      expect(homeRecords[0].sceneType).toBe('HOME');
    });

    it('should get recent scene history', async () => {
      const now = Date.now();
      
      // 添加多条记录，时间戳不同
      for (let i = 0; i < 5; i++) {
        const history: SceneHistory = {
          sceneType: 'COMMUTE',
          timestamp: now + i * 1000,
          confidence: 0.8,
          triggered: false,
          userAction: null,
        };
        await storageManager.recordSceneHistory(history);
      }

      const recent = await storageManager.getRecentSceneHistory(3);
      expect(recent.length).toBe(3);
      
      // 应该按时间戳降序排列
      expect(recent[0].timestamp).toBeGreaterThan(recent[1].timestamp);
      expect(recent[1].timestamp).toBeGreaterThan(recent[2].timestamp);
    });

    it('should cleanup old scene history', async () => {
      const now = Date.now();
      const oldTime = now - (31 * 24 * 60 * 60 * 1000); // 31天前
      const recentTime = now - (1 * 24 * 60 * 60 * 1000); // 1天前

      // 添加旧记录
      const oldHistory: SceneHistory = {
        sceneType: 'COMMUTE',
        timestamp: oldTime,
        confidence: 0.8,
        triggered: false,
        userAction: null,
      };

      // 添加新记录
      const recentHistory: SceneHistory = {
        sceneType: 'HOME',
        timestamp: recentTime,
        confidence: 0.9,
        triggered: false,
        userAction: null,
      };

      await storageManager.recordSceneHistory(oldHistory);
      await storageManager.recordSceneHistory(recentHistory);

      // 清理30天前的记录
      await storageManager.cleanupOldSceneHistory(30);

      const remaining = await storageManager.loadSceneHistory();
      expect(remaining.length).toBe(1);
      expect(remaining[0].sceneType).toBe('HOME');
    });
  });

  describe('Storage Info', () => {
    it('should return storage info', () => {
      const info = storageManager.getStorageInfo();
      expect(info).toHaveProperty('hasMMKV');
      expect(info).toHaveProperty('storageType');
      expect(typeof info.hasMMKV).toBe('boolean');
      expect(typeof info.storageType).toBe('string');
    });
  });
});