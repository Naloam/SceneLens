jest.mock('../../core/SceneBridge', () => ({
  __esModule: true,
  default: {
    openAppWithDeepLink: jest.fn(),
    validateDeepLink: jest.fn(),
    isAppInstalled: jest.fn(),
  },
}));

jest.mock('../../discovery', () => ({
  appDiscoveryEngine: {
    isInitialized: jest.fn(() => true),
    initialize: jest.fn(() => Promise.resolve()),
    resolveIntent: jest.fn((intent: string) => {
      const mapping: Record<string, string> = {
        CALENDAR_TOP1: 'com.android.calendar',
        TRANSIT_APP_TOP1: 'com.eg.android.AlipayGphone',
        MUSIC_PLAYER_TOP1: 'com.netease.cloudmusic',
        SMART_HOME_TOP1: 'com.xiaomi.smarthome',
        STUDY_APP_TOP1: 'camp.firefly.foresto',
        TRAVEL_APP_TOP1: 'com.MobileTicket',
      };
      return mapping[intent] ?? null;
    }),
  },
}));

jest.mock('../../notifications/NotificationManager', () => ({
  notificationManager: {
    showSceneSuggestion: jest.fn(() => Promise.resolve('notification-id')),
    showExecutionResult: jest.fn(() => Promise.resolve('notification-id')),
    showSystemNotification: jest.fn(() => Promise.resolve('notification-id')),
  },
}));

jest.mock('../../automation/SystemSettingsController', () => ({
  SystemSettingsController: {
    setDoNotDisturb: jest.fn(() => Promise.resolve(true)),
    setBrightness: jest.fn(() => Promise.resolve(true)),
    setVolume: jest.fn(() => Promise.resolve(true)),
  },
}));

const mockedGetDeepLink = jest.fn((packageName: string, action?: string) => {
  if (packageName === 'com.android.calendar' && action === 'open_events') {
    return 'content://com.android.calendar/events';
  }

  if (packageName === 'com.xiaomi.smarthome' && action === 'open_home') {
    return 'mihome://';
  }

  if (packageName === 'com.MobileTicket') {
    return 'cn.12306.mobile://';
  }

  // These intentionally emulate DeepLinkManager's broad first-healthy fallback.
  if (packageName === 'com.eg.android.AlipayGphone') {
    return 'alipays://platformapi/startapp?appId=200011235';
  }

  if (packageName === 'com.netease.cloudmusic') {
    return 'orpheus://';
  }

  if (packageName === 'camp.firefly.foresto') {
    return 'forest://';
  }

  return null;
});

jest.mock('../../utils/deepLinkManager', () => ({
  deepLinkManager: {
    initialize: jest.fn(() => Promise.resolve()),
    getConfig: jest.fn((packageName: string) => {
      if (packageName === 'com.eg.android.AlipayGphone') {
        return {
          packageName,
          appName: 'Alipay',
          deepLinks: [
            {
              action: 'open_ticket_qr',
              url: 'alipays://platformapi/startapp?appId=200011235',
              priority: 1,
            },
            {
              action: 'transit_bus',
              url: 'alipays://platformapi/startapp?appId=20000023',
              priority: 2,
            },
          ],
        };
      }

      if (packageName === 'com.android.calendar') {
        return {
          packageName,
          appName: 'Calendar',
          deepLinks: [
            {
              action: 'open_events',
              url: 'content://com.android.calendar/events',
              priority: 1,
            },
          ],
        };
      }

      if (packageName === 'com.netease.cloudmusic') {
        return {
          packageName,
          appName: 'NetEase Music',
          deepLinks: [
            {
              action: 'open_player',
              url: 'orpheus://',
              priority: 1,
            },
            {
              action: 'play_music',
              url: 'music://',
              priority: 2,
            },
          ],
        };
      }

      if (packageName === 'com.xiaomi.smarthome') {
        return {
          packageName,
          appName: 'Mi Home',
          deepLinks: [
            {
              action: 'open_home',
              url: 'mihome://',
              priority: 1,
            },
          ],
        };
      }

      if (packageName === 'camp.firefly.foresto') {
        return {
          packageName,
          appName: 'Forest',
          deepLinks: [
            {
              action: 'open_focus',
              url: 'forest://',
              priority: 1,
            },
          ],
        };
      }

      if (packageName === 'com.MobileTicket') {
        return {
          packageName,
          appName: '12306',
          deepLinks: [
            {
              action: 'open_ticket_qr',
              url: 'cn.12306.mobile://',
              priority: 1,
            },
          ],
        };
      }

      return undefined;
    }),
    getDeepLink: mockedGetDeepLink,
  },
}));

import sceneBridge from '../../core/SceneBridge';
import { deepLinkManager } from '../../utils/deepLinkManager';
import { SceneExecutor } from '../SceneExecutor';

describe('SceneExecutor authenticity semantics', () => {
  let executor: SceneExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new SceneExecutor();
  });

  it('marks smart home launch as opened_app_home instead of success', async () => {
    (sceneBridge.openAppWithDeepLink as jest.Mock).mockResolvedValue(true);

    const [result] = await executor.execute([
      {
        target: 'app',
        intent: 'SMART_HOME_TOP1',
        action: 'launch',
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.completionStatus).toBe('opened_app_home');
    expect(result.error).toContain('Opened app home only');
    expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledWith(
      'com.xiaomi.smarthome',
      'mihome://'
    );
  });

  it('marks legacy travel ticket deep link as needs_user_input on target-page open', async () => {
    (sceneBridge.openAppWithDeepLink as jest.Mock).mockResolvedValue(true);

    const [result] = await executor.execute([
      {
        target: 'app',
        intent: 'TRAVEL_APP_TOP1',
        action: 'open_ticket',
        deepLink: 'cn12306://jump?action=checkticket',
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.completionStatus).toBe('needs_user_input');
    expect(result.error).toBeUndefined();
    expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledWith(
      'com.MobileTicket',
      'cn12306://jump?action=checkticket'
    );
  });

  it('keeps playlist launch at opened_app_home when no exact music deep link exists', async () => {
    (sceneBridge.openAppWithDeepLink as jest.Mock).mockResolvedValue(true);

    const [result] = await executor.execute([
      {
        target: 'app',
        intent: 'MUSIC_PLAYER_TOP1',
        action: 'launch_with_playlist',
        params: {
          playlist: 'relax',
        },
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.completionStatus).toBe('opened_app_home');
    expect((deepLinkManager.getDeepLink as jest.Mock)).not.toHaveBeenCalledWith(
      'com.netease.cloudmusic',
      'launch_with_playlist'
    );
    expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledTimes(1);
    expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledWith(
      'com.netease.cloudmusic',
      undefined
    );
  });

  it('keeps study-app launch at opened_app_home when only focus deep link exists', async () => {
    (sceneBridge.openAppWithDeepLink as jest.Mock).mockResolvedValue(true);

    const [result] = await executor.execute([
      {
        target: 'app',
        intent: 'STUDY_APP_TOP1',
        action: 'launch',
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.completionStatus).toBe('opened_app_home');
    expect((deepLinkManager.getDeepLink as jest.Mock)).not.toHaveBeenCalledWith(
      'camp.firefly.foresto',
      'open_home'
    );
    expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledTimes(1);
    expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledWith(
      'camp.firefly.foresto',
      undefined
    );
  });

  it('keeps travel map open at opened_app_home when transit app lacks exact map deep link', async () => {
    (sceneBridge.openAppWithDeepLink as jest.Mock).mockResolvedValue(true);

    const [result] = await executor.execute([
      {
        target: 'app',
        intent: 'TRANSIT_APP_TOP1',
        action: 'open_map',
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.completionStatus).toBe('opened_app_home');
    expect((deepLinkManager.getDeepLink as jest.Mock)).not.toHaveBeenCalledWith(
      'com.eg.android.AlipayGphone',
      'open_map'
    );
    expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledTimes(1);
    expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledWith(
      'com.eg.android.AlipayGphone',
      undefined
    );
  });

  it('marks office calendar open_events as needs_user_input on target-page open', async () => {
    (sceneBridge.openAppWithDeepLink as jest.Mock).mockResolvedValue(true);

    const [result] = await executor.execute([
      {
        target: 'app',
        intent: 'CALENDAR_TOP1',
        action: 'open_events',
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.completionStatus).toBe('needs_user_input');
    expect(result.error).toBeUndefined();
    expect((deepLinkManager.getDeepLink as jest.Mock)).toHaveBeenCalledWith(
      'com.android.calendar',
      'open_events'
    );
    expect(sceneBridge.openAppWithDeepLink).toHaveBeenCalledWith(
      'com.android.calendar',
      'content://com.android.calendar/events'
    );
  });
});
