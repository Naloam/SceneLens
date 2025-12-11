import { create } from 'zustand';

export type PermissionType =
  | 'LOCATION'
  | 'ACTIVITY_RECOGNITION'
  | 'USAGE_STATS'
  | 'CAMERA'
  | 'MICROPHONE'
  | 'NOTIFICATIONS'
  | 'DO_NOT_DISTURB';

export type PermissionStatus = 'granted' | 'denied' | 'not_requested' | 'unknown';

export interface PermissionInfo {
  type: PermissionType;
  status: PermissionStatus;
  lastRequested: number | null;
  lastChecked: number | null;
  isRequired: boolean;
  description: string;
}

interface PermissionState {
  // Permission statuses
  permissions: Map<PermissionType, PermissionInfo>;
  isCheckingPermissions: boolean;

  // Onboarding
  onboardingCompleted: boolean;
  currentOnboardingStep: number;

  // Actions
  setPermissionStatus: (type: PermissionType, status: PermissionStatus) => void;
  setPermissionLastRequested: (type: PermissionType, timestamp: number) => void;
  setPermissionLastChecked: (type: PermissionType, timestamp: number) => void;
  getPermissionStatus: (type: PermissionType) => PermissionStatus;
  isPermissionGranted: (type: PermissionType) => boolean;
  getAllGrantedPermissions: () => PermissionType[];
  getAllDeniedPermissions: () => PermissionType[];
  getRequiredPermissions: () => PermissionInfo[];
  setIsCheckingPermissions: (checking: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setCurrentOnboardingStep: (step: number) => void;
  reset: () => void;
}

const createInitialPermissions = (): Map<PermissionType, PermissionInfo> => {
  const permissions = new Map<PermissionType, PermissionInfo>();

  permissions.set('LOCATION', {
    type: 'LOCATION',
    status: 'not_requested',
    lastRequested: null,
    lastChecked: null,
    isRequired: true,
    description: '用于识别通勤、到家、出行等场景',
  });

  permissions.set('ACTIVITY_RECOGNITION', {
    type: 'ACTIVITY_RECOGNITION',
    status: 'not_requested',
    lastRequested: null,
    lastChecked: null,
    isRequired: true,
    description: '用于识别运动状态（步行、静止、乘车）',
  });

  permissions.set('USAGE_STATS', {
    type: 'USAGE_STATS',
    status: 'not_requested',
    lastRequested: null,
    lastChecked: null,
    isRequired: true,
    description: '用于学习您的应用使用习惯',
  });

  permissions.set('CAMERA', {
    type: 'CAMERA',
    status: 'not_requested',
    lastRequested: null,
    lastChecked: null,
    isRequired: false,
    description: '用于精确识别当前环境（仅在您主动触发时）',
  });

  permissions.set('MICROPHONE', {
    type: 'MICROPHONE',
    status: 'not_requested',
    lastRequested: null,
    lastChecked: null,
    isRequired: false,
    description: '用于识别环境音（仅在您主动触发时）',
  });

  permissions.set('NOTIFICATIONS', {
    type: 'NOTIFICATIONS',
    status: 'not_requested',
    lastRequested: null,
    lastChecked: null,
    isRequired: true,
    description: '用于推送场景建议通知',
  });

  permissions.set('DO_NOT_DISTURB', {
    type: 'DO_NOT_DISTURB',
    status: 'not_requested',
    lastRequested: null,
    lastChecked: null,
    isRequired: false,
    description: '用于自动开启勿扰模式',
  });

  return permissions;
};

const initialState = {
  permissions: createInitialPermissions(),
  isCheckingPermissions: false,
  onboardingCompleted: false,
  currentOnboardingStep: 0,
};

export const usePermissionStore = create<PermissionState>((set, get) => ({
  ...initialState,

  setPermissionStatus: (type, status) =>
    set((state) => {
      const newPermissions = new Map(state.permissions);
      const permission = newPermissions.get(type);
      if (permission) {
        newPermissions.set(type, {
          ...permission,
          status,
          lastChecked: Date.now(),
        });
      }
      return { permissions: newPermissions };
    }),

  setPermissionLastRequested: (type, timestamp) =>
    set((state) => {
      const newPermissions = new Map(state.permissions);
      const permission = newPermissions.get(type);
      if (permission) {
        newPermissions.set(type, {
          ...permission,
          lastRequested: timestamp,
        });
      }
      return { permissions: newPermissions };
    }),

  setPermissionLastChecked: (type, timestamp) =>
    set((state) => {
      const newPermissions = new Map(state.permissions);
      const permission = newPermissions.get(type);
      if (permission) {
        newPermissions.set(type, {
          ...permission,
          lastChecked: timestamp,
        });
      }
      return { permissions: newPermissions };
    }),

  getPermissionStatus: (type) => {
    const state = get();
    return state.permissions.get(type)?.status || 'unknown';
  },

  isPermissionGranted: (type) => {
    const state = get();
    return state.permissions.get(type)?.status === 'granted';
  },

  getAllGrantedPermissions: () => {
    const state = get();
    const granted: PermissionType[] = [];
    state.permissions.forEach((info, type) => {
      if (info.status === 'granted') {
        granted.push(type);
      }
    });
    return granted;
  },

  getAllDeniedPermissions: () => {
    const state = get();
    const denied: PermissionType[] = [];
    state.permissions.forEach((info, type) => {
      if (info.status === 'denied') {
        denied.push(type);
      }
    });
    return denied;
  },

  getRequiredPermissions: () => {
    const state = get();
    const required: PermissionInfo[] = [];
    state.permissions.forEach((info) => {
      if (info.isRequired) {
        required.push(info);
      }
    });
    return required;
  },

  setIsCheckingPermissions: (checking) => set({ isCheckingPermissions: checking }),

  setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),

  setCurrentOnboardingStep: (step) => set({ currentOnboardingStep: step }),

  reset: () => set(initialState),
}));
