/**
 * AppDiscoveryEngine 单元测试
 *
 * 测试应用发现引擎的核心功能
 */

import { AppDiscoveryEngine } from '../AppDiscoveryEngine';
import { AppInfo, AppCategory, UsageStats } from '../../types';

// Mock SceneBridge
jest.mock('../../core/SceneBridge', () => ({
  __esModule: true,
  default: {
    getInstalledApps: jest.fn(),
    getUsageStats: jest.fn(),
  },
}));

import sceneBridge from '../../core/SceneBridge';

describe('AppDiscoveryEngine', () => {
  let engine: AppDiscoveryEngine;
  const mockApps: AppInfo[] = [
    {
      packageName: 'com.netease.cloudmusic',
      appName: '网易云音乐',
      category: 'MUSIC_PLAYER',
      icon: '',
      isSystemApp: false,
    },
    {
      packageName: 'com.tencent.qqmusic',
      appName: 'QQ音乐',
      category: 'MUSIC_PLAYER',
      icon: '',
      isSystemApp: false,
    },
    {
      packageName: 'com.eg.android.AlipayGphone',
      appName: '支付宝',
      category: 'TRANSIT_APP',
      icon: '',
      isSystemApp: false,
    },
    {
      packageName: 'com.tencent.wework',
      appName: '企业微信',
      category: 'MEETING_APP',
      icon: '',
      isSystemApp: false,
    },
    {
      packageName: 'com.duolingo',
      appName: '多邻国',
      category: 'STUDY_APP',
      icon: '',
      isSystemApp: false,
    },
    {
      packageName: 'com.xiaomi.smarthome',
      appName: '米家',
      category: 'SMART_HOME',
      icon: '',
      isSystemApp: false,
    },
  ];

  const mockUsageStats: UsageStats[] = [
    {
      packageName: 'com.netease.cloudmusic',
      totalTimeInForeground: 5 * 60 * 60 * 1000, // 5小时
      launchCount: 100,
      lastTimeUsed: Date.now(),
    },
    {
      packageName: 'com.tencent.qqmusic',
      totalTimeInForeground: 2 * 60 * 60 * 1000, // 2小时
      launchCount: 50,
      lastTimeUsed: Date.now() - 3600000,
    },
    {
      packageName: 'com.eg.android.AlipayGphone',
      totalTimeInForeground: 3 * 60 * 60 * 1000, // 3小时
      launchCount: 80,
      lastTimeUsed: Date.now() - 7200000,
    },
  ];

  beforeEach(() => {
    engine = new AppDiscoveryEngine();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('应该成功初始化并扫描应用', async () => {
      (sceneBridge.getInstalledApps as jest.Mock).mockResolvedValue(mockApps);
      (sceneBridge.getUsageStats as jest.Mock).mockResolvedValue(mockUsageStats);

      await engine.initialize();

      expect(engine.isInitialized()).toBe(true);
      expect(sceneBridge.getInstalledApps).toHaveBeenCalled();
      expect(sceneBridge.getUsageStats).toHaveBeenCalledWith(30);
    });

    it('应该在原生模块失败时使用兜底应用', async () => {
      (sceneBridge.getInstalledApps as jest.Mock).mockRejectedValue(new Error('Native module not available'));
      (sceneBridge.getUsageStats as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await engine.initialize();

      expect(engine.isInitialized()).toBe(true);
      // 应该有兜底应用
      const allApps = engine.getAllApps();
      expect(allApps.length).toBeGreaterThan(0);
    });

    it('应该在应用列表为空时使用兜底应用', async () => {
      (sceneBridge.getInstalledApps as jest.Mock).mockResolvedValue([]);
      (sceneBridge.getUsageStats as jest.Mock).mockResolvedValue([]);

      await engine.initialize();

      expect(engine.isInitialized()).toBe(true);
      const allApps = engine.getAllApps();
      expect(allApps.length).toBeGreaterThan(0);
    });

    it('应该根据使用统计对应用进行排序', async () => {
      (sceneBridge.getInstalledApps as jest.Mock).mockResolvedValue(mockApps);
      (sceneBridge.getUsageStats as jest.Mock).mockResolvedValue(mockUsageStats);

      await engine.initialize();

      // 检查音乐类应用的排序
      const musicApps = engine.getAppsByCategory('MUSIC_PLAYER');
      expect(musicApps[0].packageName).toBe('com.netease.cloudmusic'); // 使用时间最长
      expect(musicApps[1].packageName).toBe('com.tencent.qqmusic');
    });
  });

  describe('detectCategory', () => {
    it('应该正确识别音乐播放器', () => {
      const app: AppInfo = {
        packageName: 'com.spotify.music',
        appName: 'Spotify Music',
        category: 'OTHER',
        icon: '',
        isSystemApp: false,
      };

      const category = engine['detectCategory'](app);
      expect(category).toBe('MUSIC_PLAYER');
    });

    it('应该正确识别交通出行应用', () => {
      const app: AppInfo = {
        packageName: 'com.eg.android.AlipayGphone',
        appName: '支付宝',
        category: 'OTHER',
        icon: '',
        isSystemApp: false,
      };

      const category = engine['detectCategory'](app);
      expect(category).toBe('TRANSIT_APP');
    });

    it('应该正确识别会议应用', () => {
      const app: AppInfo = {
        packageName: 'com.tencent.wework',
        appName: '企业微信',
        category: 'OTHER',
        icon: '',
        isSystemApp: false,
      };

      const category = engine['detectCategory'](app);
      expect(category).toBe('MEETING_APP');
    });

    it('应该正确识别学习应用', () => {
      const app: AppInfo = {
        packageName: 'com.duolingo',
        appName: 'Duolingo',
        category: 'OTHER',
        icon: '',
        isSystemApp: false,
      };

      const category = engine['detectCategory'](app);
      expect(category).toBe('STUDY_APP');
    });

    it('应该正确识别智能家居应用', () => {
      const app: AppInfo = {
        packageName: 'com.xiaomi.smarthome',
        appName: '米家',
        category: 'OTHER',
        icon: '',
        isSystemApp: false,
      };

      const category = engine['detectCategory'](app);
      expect(category).toBe('SMART_HOME');
    });

    it('应该正确识别日历应用', () => {
      const app: AppInfo = {
        packageName: 'com.android.calendar',
        appName: '日历',
        category: 'OTHER',
        icon: '',
        isSystemApp: false,
      };

      const category = engine['detectCategory'](app);
      expect(category).toBe('CALENDAR');
    });

    it('应该对未知应用返回 OTHER', () => {
      const app: AppInfo = {
        packageName: 'com.unknown.app',
        appName: 'Unknown App',
        category: 'OTHER',
        icon: '',
        isSystemApp: false,
      };

      const category = engine['detectCategory'](app);
      expect(category).toBe('OTHER');
    });

    it('应该正确识别中文名称的应用', () => {
      const app: AppInfo = {
        packageName: 'com.test.app',
        appName: '网易云音乐',
        category: 'OTHER',
        icon: '',
        isSystemApp: false,
      };

      const category = engine['detectCategory'](app);
      expect(category).toBe('MUSIC_PLAYER');
    });
  });

  describe('resolveIntent', () => {
    beforeEach(async () => {
      (sceneBridge.getInstalledApps as jest.Mock).mockResolvedValue(mockApps);
      (sceneBridge.getUsageStats as jest.Mock).mockResolvedValue(mockUsageStats);
      await engine.initialize();
    });

    it('应该正确解析 TOP1 意图', () => {
      const packageName = engine.resolveIntent('MUSIC_PLAYER_TOP1');
      expect(packageName).toBe('com.netease.cloudmusic');
    });

    it('应该正确解析 TOP2 意图', () => {
      const packageName = engine.resolveIntent('MUSIC_PLAYER_TOP2');
      expect(packageName).toBe('com.tencent.qqmusic');
    });

    it('应该对无效意图格式返回 null', () => {
      const packageName = engine.resolveIntent('INVALID_INTENT');
      expect(packageName).toBeNull();
    });

    it('应该对不存在的类别返回 null', () => {
      const packageName = engine.resolveIntent('NONEXISTENT_CATEGORY_TOP1');
      expect(packageName).toBeNull();
    });

    it('应该对超出范围的索引返回 null', () => {
      const packageName = engine.resolveIntent('MUSIC_PLAYER_TOP10');
      expect(packageName).toBeNull();
    });
  });

  describe('getPreference', () => {
    beforeEach(async () => {
      (sceneBridge.getInstalledApps as jest.Mock).mockResolvedValue(mockApps);
      (sceneBridge.getUsageStats as jest.Mock).mockResolvedValue(mockUsageStats);
      await engine.initialize();
    });

    it('应该返回音乐类别的偏好', () => {
      const preference = engine.getPreference('MUSIC_PLAYER');

      expect(preference).toBeDefined();
      expect(preference?.category).toBe('MUSIC_PLAYER');
      expect(preference?.topApps).toContain('com.netease.cloudmusic');
    });

    it('应该对不存在的类别返回 undefined', () => {
      const preference = engine.getPreference('OTHER');

      // 'OTHER' 类别可能没有偏好
      expect(preference === undefined || preference?.topApps.length === 0).toBe(true);
    });
  });

  describe('getAllPreferences', () => {
    beforeEach(async () => {
      (sceneBridge.getInstalledApps as jest.Mock).mockResolvedValue(mockApps);
      (sceneBridge.getUsageStats as jest.Mock).mockResolvedValue(mockUsageStats);
      await engine.initialize();
    });

    it('应该返回所有类别的偏好', () => {
      const preferences = engine.getAllPreferences();

      expect(preferences.size).toBeGreaterThan(0);
    });
  });

  describe('getAllApps', () => {
    beforeEach(async () => {
      (sceneBridge.getInstalledApps as jest.Mock).mockResolvedValue(mockApps);
      (sceneBridge.getUsageStats as jest.Mock).mockResolvedValue(mockUsageStats);
      await engine.initialize();
    });

    it('应该返回所有应用', () => {
      const apps = engine.getAllApps();

      expect(apps.length).toBe(mockApps.length);
      expect(apps.every(app => app.category)).toBe(true);
    });
  });

  describe('getAppsByCategory', () => {
    beforeEach(async () => {
      (sceneBridge.getInstalledApps as jest.Mock).mockResolvedValue(mockApps);
      (sceneBridge.getUsageStats as jest.Mock).mockResolvedValue(mockUsageStats);
      await engine.initialize();
    });

    it('应该返回指定类别的应用', () => {
      const musicApps = engine.getAppsByCategory('MUSIC_PLAYER');

      expect(musicApps.length).toBe(2);
      expect(musicApps.every(app => app.category === 'MUSIC_PLAYER')).toBe(true);
    });

    it('应该对不存在的类别返回空数组', () => {
      const apps = engine.getAppsByCategory('OTHER' as AppCategory);

      expect(Array.isArray(apps)).toBe(true);
    });
  });

  describe('setPreference', () => {
    beforeEach(async () => {
      (sceneBridge.getInstalledApps as jest.Mock).mockResolvedValue(mockApps);
      (sceneBridge.getUsageStats as jest.Mock).mockResolvedValue(mockUsageStats);
      await engine.initialize();
    });

    it('应该手动设置应用偏好', () => {
      engine.setPreference('MUSIC_PLAYER', ['com.test.music']);

      const preference = engine.getPreference('MUSIC_PLAYER');
      expect(preference?.topApps).toEqual(['com.test.music']);
    });
  });

  describe('rankAppsByUsage', () => {
    it('应该根据使用统计对应用进行排序', () => {
      const apps: AppInfo[] = [
        {
          packageName: 'app1',
          appName: 'App 1',
          category: 'OTHER',
          icon: '',
          isSystemApp: false,
        },
        {
          packageName: 'app2',
          appName: 'App 2',
          category: 'OTHER',
          icon: '',
          isSystemApp: false,
        },
      ];

      const usageStats: UsageStats[] = [
        {
          packageName: 'app1',
          totalTimeInForeground: 1000,
          launchCount: 10,
          lastTimeUsed: Date.now(),
        },
        {
          packageName: 'app2',
          totalTimeInForeground: 5000,
          launchCount: 5,
          lastTimeUsed: Date.now(),
        },
      ];

      const ranked = engine['rankAppsByUsage'](apps, usageStats);

      // app2 应该排在前面（使用时间更长）
      expect(ranked[0].packageName).toBe('app2');
    });

    it('应该在没有使用统计时保持原始顺序', () => {
      const apps: AppInfo[] = [
        {
          packageName: 'app1',
          appName: 'App 1',
          category: 'OTHER',
          icon: '',
          isSystemApp: false,
        },
        {
          packageName: 'app2',
          appName: 'App 2',
          category: 'OTHER',
          icon: '',
          isSystemApp: false,
        },
      ];

      const ranked = engine['rankAppsByUsage'](apps, []);

      // 得分都为 0，应该保持稳定排序
      expect(ranked).toEqual(apps);
    });
  });
});
