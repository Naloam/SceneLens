jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

jest.mock('../../../automation/SystemSettingsController', () => ({
  SystemSettingsController: {
    setVolumes: jest.fn().mockResolvedValue(undefined),
    setBrightness: jest.fn().mockResolvedValue(undefined),
    setDoNotDisturb: jest.fn().mockResolvedValue(undefined),
    setWiFi: jest.fn().mockResolvedValue(undefined),
    setBluetooth: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../automation/AppLaunchController', () => ({
  AppLaunchController: {
    launchApp: jest.fn().mockResolvedValue(undefined),
    launchAppWithDeepLink: jest.fn().mockResolvedValue(undefined),
    openDeepLink: jest.fn().mockResolvedValue(undefined),
    launchShortcut: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../learning/PreferenceManager', () => ({
  preferenceManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getHomeAddress: jest.fn(() => null),
    getWorkAddress: jest.fn(() => null),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppLaunchController } from '../../../automation/AppLaunchController';
import { QuickActionManager } from '../../../quickactions/QuickActionManager';
import type { QuickAction } from '../../../types/automation';

function createAction(overrides: Partial<QuickAction> = {}): QuickAction {
  return {
    id: 'custom_action',
    name: 'Custom Action',
    description: 'Launch a custom app',
    icon: 'rocket',
    category: 'custom',
    actionType: 'app_launch',
    actionParams: {
      packageName: 'com.example.app',
    },
    contextTriggers: {
      scenes: ['HOME'],
    },
    enabled: true,
    priority: 5,
    ...overrides,
  };
}

describe('QuickActionManager', () => {
  let manager: QuickActionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    manager = new QuickActionManager();
  });

  it('loads default presets on first initialization', async () => {
    await manager.initialize();

    const actions = await manager.getAllActions();

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some(action => action.category === 'payment')).toBe(true);
  });

  it('registers, fetches, and removes custom actions', async () => {
    const action = createAction();

    await manager.registerAction(action);

    expect(await manager.getAction(action.id)).toMatchObject({
      id: action.id,
      name: action.name,
    });

    expect(await manager.removeAction(action.id)).toBe(true);
    expect(await manager.getAction(action.id)).toBeUndefined();
  });

  it('filters actions by scene', async () => {
    const homeAction = createAction({ id: 'home_action' });
    const officeAction = createAction({
      id: 'office_action',
      contextTriggers: { scenes: ['OFFICE'] },
    });

    await manager.registerActions([homeAction, officeAction]);

    const homeActions = await manager.getActionsForScene('HOME');
    const officeActions = await manager.getActionsForScene('OFFICE');

    expect(homeActions.some(action => action.id === 'home_action')).toBe(true);
    expect(homeActions.some(action => action.id === 'office_action')).toBe(false);
    expect(officeActions.some(action => action.id === 'office_action')).toBe(true);
  });

  it('manages favorites and hidden actions through current preference APIs', async () => {
    const action = createAction({ id: 'favorite_action' });

    await manager.registerAction(action);
    await manager.addFavorite(action.id);

    const favorites = await manager.getFavoriteActions();
    expect(favorites.map(item => item.id)).toContain(action.id);

    await manager.hideAction(action.id);

    const recommended = await manager.getRecommendedActions('HOME');
    expect(recommended.some(item => item.id === action.id)).toBe(false);
  });

  it('executes registered actions and records usage', async () => {
    const action = createAction({ id: 'launch_action' });

    await manager.registerAction(action);

    await expect(manager.executeAction(action.id, 'HOME')).resolves.toBe(true);
    expect(AppLaunchController.launchApp).toHaveBeenCalledWith('com.example.app');
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('returns false for missing actions', async () => {
    await expect(manager.executeAction('missing_action')).resolves.toBe(false);
  });

  it('filters by category using stored actions', async () => {
    await manager.initialize();

    const paymentActions = await manager.getActionsByCategory('payment');

    expect(paymentActions.length).toBeGreaterThan(0);
    expect(paymentActions.every(action => action.category === 'payment')).toBe(true);
  });
});
