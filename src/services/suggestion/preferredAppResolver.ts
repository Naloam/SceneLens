import type { AppCategory } from '../../types';
import { useAppPreferenceStore } from '../../stores/appPreferenceStore';

export function getPreferredAppName(category: AppCategory, fallback: string): string {
  const { getTopAppsForCategory, getAppByPackageName } = useAppPreferenceStore.getState();
  const preferredPackage = getTopAppsForCategory(category)[0];

  if (!preferredPackage) {
    return fallback;
  }

  return getAppByPackageName(preferredPackage)?.appName?.trim() || fallback;
}
