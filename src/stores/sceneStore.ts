import { create } from 'zustand';
import type { SilentContext, SceneType, ContextSignal } from '../types';

export interface SceneHistory {
  sceneType: SceneType;
  timestamp: number;
  confidence: number;
  triggered: boolean;
  userAction: 'accept' | 'ignore' | 'cancel' | null;
}

interface SceneState {
  // Current scene context
  currentContext: SilentContext | null;
  isDetecting: boolean;
  lastDetectionTime: number | null;
  detectionError: string | null;
  isManualMode: boolean; // 是否为手动模式

  // Scene history
  history: SceneHistory[];
  maxHistorySize: number;

  // Auto mode settings
  autoModeEnabled: boolean;
  autoModeScenes: Set<SceneType>;

  // Actions
  setCurrentContext: (context: SilentContext) => void;
  setManualScene: (sceneType: SceneType) => void; // 手动设置场景
  setIsDetecting: (isDetecting: boolean) => void;
  setDetectionError: (error: string | null) => void;
  addToHistory: (historyItem: SceneHistory) => void;
  clearHistory: () => void;
  setAutoModeEnabled: (enabled: boolean) => void;
  toggleAutoModeForScene: (sceneType: SceneType) => void;
  isAutoModeEnabledForScene: (sceneType: SceneType) => boolean;
  getRecentHistory: (limit?: number) => SceneHistory[];
  reset: () => void;
}

const initialState = {
  currentContext: null,
  isDetecting: false,
  lastDetectionTime: null,
  detectionError: null,
  isManualMode: false,
  history: [],
  maxHistorySize: 100,
  autoModeEnabled: false,
  autoModeScenes: new Set<SceneType>(),
};

export const useSceneStore = create<SceneState>((set, get) => ({
  ...initialState,

  setCurrentContext: (context) =>
    set({
      currentContext: context,
      lastDetectionTime: Date.now(),
      detectionError: null,
      isManualMode: false, // 自动检测时重置手动模式
    }),

  setManualScene: (sceneType) =>
    set((state) => ({
      currentContext: {
        timestamp: Date.now(),
        context: sceneType,
        confidence: 1.0, // 手动选择置信度为 100%
        signals: [
          {
            type: 'MANUAL' as any,
            value: `USER_SELECTED_${sceneType}`,
            weight: 1.0,
            timestamp: Date.now(),
          },
        ],
      },
      lastDetectionTime: Date.now(),
      detectionError: null,
      isManualMode: true, // 标记为手动模式
    })),

  setIsDetecting: (isDetecting) => set({ isDetecting }),

  setDetectionError: (error) =>
    set({
      detectionError: error,
      isDetecting: false,
    }),

  addToHistory: (historyItem) =>
    set((state) => {
      const newHistory = [...state.history, historyItem];
      // Keep only the most recent items
      if (newHistory.length > state.maxHistorySize) {
        newHistory.shift();
      }
      return { history: newHistory };
    }),

  clearHistory: () => set({ history: [] }),

  setAutoModeEnabled: (enabled) => set({ autoModeEnabled: enabled }),

  toggleAutoModeForScene: (sceneType) =>
    set((state) => {
      const newAutoModeScenes = new Set(state.autoModeScenes);
      if (newAutoModeScenes.has(sceneType)) {
        newAutoModeScenes.delete(sceneType);
      } else {
        newAutoModeScenes.add(sceneType);
      }
      return { autoModeScenes: newAutoModeScenes };
    }),

  isAutoModeEnabledForScene: (sceneType) => {
    const state = get();
    return state.autoModeEnabled && state.autoModeScenes.has(sceneType);
  },

  getRecentHistory: (limit = 10) => {
    const state = get();
    return state.history.slice(-limit).reverse();
  },

  reset: () => set(initialState),
}));
