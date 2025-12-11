import { create } from 'zustand';
import type { AppInfo, AppPreference, AppCategory } from '../types';

interface AppPreferenceState {
  // App data
  allApps: AppInfo[];
  preferences: Map<AppCategory, AppPreference>;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAllApps: (apps: AppInfo[]) => void;
  setPreferences: (preferences: Map<AppCategory, AppPreference>) => void;
  updatePreference: (category: AppCategory, preference: AppPreference) => void;
  setTopAppForCategory: (category: AppCategory, packageName: string, position: number) => void;
  getTopAppsForCategory: (category: AppCategory) => string[];
  getAppByPackageName: (packageName: string) => AppInfo | undefined;
  setIsInitialized: (initialized: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  allApps: [],
  preferences: new Map<AppCategory, AppPreference>(),
  isInitialized: false,
  isLoading: false,
  error: null,
};

export const useAppPreferenceStore = create<AppPreferenceState>((set, get) => ({
  ...initialState,

  setAllApps: (apps) => set({ allApps: apps }),

  setPreferences: (preferences) => set({ preferences }),

  updatePreference: (category, preference) =>
    set((state) => {
      const newPreferences = new Map(state.preferences);
      newPreferences.set(category, preference);
      return { preferences: newPreferences };
    }),

  setTopAppForCategory: (category, packageName, position) =>
    set((state) => {
      const preference = state.preferences.get(category);
      if (!preference) {
        return state;
      }

      const newTopApps = [...preference.topApps];
      
      // Remove the package if it exists elsewhere
      const existingIndex = newTopApps.indexOf(packageName);
      if (existingIndex !== -1) {
        newTopApps.splice(existingIndex, 1);
      }

      // Insert at the specified position
      newTopApps.splice(position, 0, packageName);

      const newPreference: AppPreference = {
        ...preference,
        topApps: newTopApps.slice(0, 3), // Keep only top 3
        lastUpdated: Date.now(),
      };

      const newPreferences = new Map(state.preferences);
      newPreferences.set(category, newPreference);

      return { preferences: newPreferences };
    }),

  getTopAppsForCategory: (category) => {
    const state = get();
    const preference = state.preferences.get(category);
    return preference?.topApps || [];
  },

  getAppByPackageName: (packageName) => {
    const state = get();
    return state.allApps.find((app) => app.packageName === packageName);
  },

  setIsInitialized: (initialized) => set({ isInitialized: initialized }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
