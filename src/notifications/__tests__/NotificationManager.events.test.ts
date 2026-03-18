const emitMock = jest.fn();

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
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'mock-id'),
  dismissNotificationAsync: jest.fn(async () => undefined),
  dismissAllNotificationsAsync: jest.fn(async () => undefined),
  DEFAULT_ACTION_IDENTIFIER: 'default',
}));

import { notificationManager } from '../NotificationManager';

describe('NotificationManager event bridge', () => {
  beforeEach(() => {
    emitMock.mockClear();
  });

  it('emits execute/dismiss/open events to DeviceEventEmitter', () => {
    (notificationManager as any).handleExecuteAction({ sceneType: 'COMMUTE' });
    (notificationManager as any).handleDismissAction({ sceneType: 'HOME' });
    (notificationManager as any).handleDefaultAction({ sceneType: 'OFFICE' });

    expect(emitMock).toHaveBeenCalledWith('SceneNotificationExecute', { sceneType: 'COMMUTE' });
    expect(emitMock).toHaveBeenCalledWith('SceneNotificationDismiss', { sceneType: 'HOME' });
    expect(emitMock).toHaveBeenCalledWith('SceneNotificationOpen', { sceneType: 'OFFICE' });
  });
});

