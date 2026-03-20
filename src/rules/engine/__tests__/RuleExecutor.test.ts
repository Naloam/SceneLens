jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../notifications/NotificationManager', () => ({
  notificationManager: {
    showSceneSuggestion: jest.fn().mockResolvedValue('scene-notification-id'),
    showExecutionResult: jest.fn().mockResolvedValue('execution-notification-id'),
    showSystemNotification: jest.fn().mockResolvedValue('system-notification-id'),
  },
}));

jest.mock('../../../automation/SystemSettingsController', () => ({
  SystemSettingsController: {
    setDoNotDisturb: jest.fn().mockResolvedValue(true),
    setBrightness: jest.fn().mockResolvedValue(true),
    setVolumes: jest.fn().mockResolvedValue(true),
    setWiFi: jest.fn().mockResolvedValue({ success: true }),
    setBluetooth: jest.fn().mockResolvedValue({ success: true }),
    setScreenTimeout: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../../automation/AppLaunchController', () => ({
  AppLaunchController: {
    launchApp: jest.fn().mockResolvedValue(true),
    launchAppWithDeepLink: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../../quickactions/QuickActionManager', () => ({
  quickActionManager: {
    executeActionDetailed: jest.fn(),
  },
}));

import { RuleExecutor } from '../RuleExecutor';
import { notificationManager } from '../../../notifications/NotificationManager';
import { quickActionManager } from '../../../quickactions/QuickActionManager';
import type { AutomationRule } from '../../../types/automation';
import type { SceneType } from '../../../types';

function createRule(params: Record<string, unknown>): AutomationRule {
  return {
    id: 'rule_notification',
    name: 'Notification Rule',
    enabled: true,
    conditions: [],
    actions: [
      {
        type: 'notification',
        params,
      },
    ],
    conditionLogic: 'AND',
    priority: 5,
    cooldown: 0,
    createdAt: Date.now(),
  };
}

function createContext(sceneType: SceneType = 'OFFICE') {
  return {
    sceneType,
    timestamp: Date.now(),
  };
}

describe('RuleExecutor notification actions', () => {
  let executor: RuleExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new RuleExecutor();
  });

  it('routes scene suggestion notifications through NotificationManager', async () => {
    const rule = createRule({
      notificationType: 'scene_suggestion',
      sceneType: 'COMMUTE',
      title: 'Commute',
      body: 'Open transit tools',
      confidence: 0.88,
    });

    const result = await executor.executeRule(rule, createContext('COMMUTE'));

    expect(notificationManager.showSceneSuggestion).toHaveBeenCalledWith({
      sceneType: 'COMMUTE',
      title: 'Commute',
      body: 'Open transit tools',
      actions: [],
      confidence: 0.88,
    });
    expect(result.success).toBe(true);
    expect(result.executedActions[0]?.success).toBe(true);
  });

  it('routes execution result notifications through NotificationManager', async () => {
    const rule = createRule({
      notificationType: 'execution_result',
      sceneType: 'HOME',
      success: false,
      message: 'Failed to apply home profile',
    });

    const result = await executor.executeRule(rule, createContext('HOME'));

    expect(notificationManager.showExecutionResult).toHaveBeenCalledWith(
      'HOME',
      false,
      'Failed to apply home profile'
    );
    expect(result.success).toBe(true);
    expect(result.executedActions[0]?.success).toBe(true);
  });

  it('routes generic notifications through NotificationManager', async () => {
    const rule = createRule({
      title: 'Rule triggered',
      body: 'A background rule has completed.',
    });

    const result = await executor.executeRule(rule, createContext());

    expect(notificationManager.showSystemNotification).toHaveBeenCalledWith(
      'Rule triggered',
      'A background rule has completed.'
    );
    expect(result.success).toBe(true);
    expect(result.executedActions[0]?.success).toBe(true);
  });
});

describe('RuleExecutor quick actions', () => {
  let executor: RuleExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new RuleExecutor();
  });

  it('routes quick actions through QuickActionManager with scene context', async () => {
    const rule = createRule({ actionId: 'wechat_pay' });
    rule.actions = [
      {
        type: 'quick_action',
        params: { actionId: 'wechat_pay' },
      },
    ];
    (quickActionManager.executeActionDetailed as jest.Mock).mockResolvedValue({
      success: true,
      actionId: 'wechat_pay',
      status: 'success',
      duration: 12,
      timestamp: Date.now(),
    });

    const result = await executor.executeRule(rule, createContext('COMMUTE'));

    expect(quickActionManager.executeActionDetailed).toHaveBeenCalledWith('wechat_pay', 'COMMUTE');
    expect(result.success).toBe(true);
    expect(result.executedActions[0]?.success).toBe(true);
  });

  it('surfaces quick action permission failures in execution results', async () => {
    const rule = createRule({ actionId: 'brightness_action' });
    rule.actions = [
      {
        type: 'quick_action',
        params: { actionId: 'brightness_action' },
      },
    ];
    (quickActionManager.executeActionDetailed as jest.Mock).mockResolvedValue({
      success: false,
      actionId: 'brightness_action',
      status: 'permission_required',
      permission: 'write_settings',
      error: 'Permission required: write_settings',
      duration: 8,
      timestamp: Date.now(),
    });

    const result = await executor.executeRule(rule, createContext('HOME'));

    expect(result.success).toBe(false);
    expect(result.executedActions[0]?.success).toBe(false);
    expect(result.executedActions[0]?.error).toContain('write_settings');
  });
});
