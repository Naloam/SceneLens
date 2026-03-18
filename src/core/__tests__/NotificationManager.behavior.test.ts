const emitMock = jest.fn();
const setNotificationCategoryAsyncMock = jest.fn(async () => undefined);
const setNotificationChannelAsyncMock = jest.fn(async () => undefined);
const scheduleNotificationAsyncMock = jest.fn(async () => 'mock-id');
const getPermissionsAsyncMock = jest.fn(async () => ({ status: 'granted' }));
const requestPermissionsAsyncMock = jest.fn(async () => ({ status: 'granted' }));

jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    emit: emitMock,
  },
  Platform: {
    OS: 'android',
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { HIGH: 1, DEFAULT: 2, LOW: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getPermissionsAsync: getPermissionsAsyncMock,
  requestPermissionsAsync: requestPermissionsAsyncMock,
  setNotificationChannelAsync: setNotificationChannelAsyncMock,
  setNotificationCategoryAsync: setNotificationCategoryAsyncMock,
  scheduleNotificationAsync: scheduleNotificationAsyncMock,
  dismissNotificationAsync: jest.fn(async () => undefined),
  dismissAllNotificationsAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  DEFAULT_ACTION_IDENTIFIER: 'default',
}));

import { notificationManager } from '../../notifications/NotificationManager';
import {
  mapOneTapActionKindToProcessorFeedback,
  mapOneTapActionKindToUserFeedback,
} from '../../utils/suggestionFeedback';
import type { SceneSuggestionPackage } from '../../types';

describe('NotificationManager behavior', () => {
  const scenePackage: SceneSuggestionPackage = {
    sceneId: 'HOME',
    displayName: 'Home',
    icon: 'home',
    color: '#10B981',
    detectionHighlights: ['At home'],
    systemAdjustments: [],
    appLaunches: [],
    oneTapActions: [
      {
        id: 'execute',
        label: 'Do it',
        description: 'Execute all actions',
        type: 'primary',
        action: 'execute_all',
      },
      {
        id: 'later',
        label: 'Later',
        description: 'Snooze this suggestion',
        type: 'secondary',
        action: 'snooze',
        params: {
          delayMs: 900000,
        },
      },
    ],
    fallbackNotes: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    notificationManager.cleanup();
    getPermissionsAsyncMock.mockResolvedValue({ status: 'granted' });
    requestPermissionsAsyncMock.mockResolvedValue({ status: 'granted' });
  });

  it('registers categories during initialization on android', async () => {
    await expect(notificationManager.initialize()).resolves.toBe(true);

    expect(setNotificationCategoryAsyncMock).toHaveBeenCalledWith(
      'scene_suggestion',
      expect.any(Array)
    );
    expect(setNotificationCategoryAsyncMock).toHaveBeenCalledWith(
      'auto_mode_upgrade',
      expect.any(Array)
    );
  });

  it('uses scene-specific categories and action metadata for suggestion packages', async () => {
    await notificationManager.showSceneSuggestionPackage({
      scenePackage,
      confidence: 0.86,
      actions: scenePackage.oneTapActions,
    });

    expect(setNotificationCategoryAsyncMock).toHaveBeenCalledWith(
      'scene_suggestion_HOME',
      expect.arrayContaining([
        expect.objectContaining({ identifier: 'execute' }),
        expect.objectContaining({ identifier: 'later' }),
      ])
    );
    expect(scheduleNotificationAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          categoryIdentifier: 'scene_suggestion_HOME',
          data: expect.objectContaining({
            sceneType: 'HOME',
            actions: ['execute', 'later'],
            actionKinds: {
              execute: 'execute_all',
              later: 'snooze',
            },
          }),
        }),
        trigger: null,
      })
    );
  });

  it('emits selected one-tap actions with action metadata from notification responses', () => {
    (notificationManager as any).handleNotificationResponse({
      actionIdentifier: 'later',
      notification: {
        request: {
          content: {
            data: {
              sceneId: 'HOME',
              actions: ['execute', 'later'],
              actionKinds: {
                execute: 'execute_all',
                later: 'snooze',
              },
            },
          },
        },
      },
    });

    expect(emitMock).toHaveBeenCalledWith(
      'SceneNotificationExecute',
      expect.objectContaining({
        sceneType: 'HOME',
        actionId: 'later',
        actionKind: 'snooze',
      })
    );
  });
});

describe('suggestion feedback mapping', () => {
  it('maps one-tap actions to scene history feedback', () => {
    expect(mapOneTapActionKindToUserFeedback('execute_all', true)).toBe('accept');
    expect(mapOneTapActionKindToUserFeedback('execute_all', false)).toBe('cancel');
    expect(mapOneTapActionKindToUserFeedback('snooze', true)).toBe('ignore');
    expect(mapOneTapActionKindToUserFeedback('dismiss', true)).toBe('cancel');
  });

  it('maps one-tap actions to feedback processor semantics', () => {
    expect(mapOneTapActionKindToProcessorFeedback('execute_all', true)).toBe('ACCEPT');
    expect(mapOneTapActionKindToProcessorFeedback('execute_all', false)).toBe('DISMISS');
    expect(mapOneTapActionKindToProcessorFeedback('snooze', true)).toBe('IGNORE');
    expect(mapOneTapActionKindToProcessorFeedback('dismiss', true)).toBe('DISMISS');
  });
});
