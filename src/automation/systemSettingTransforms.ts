import type { DoNotDisturbMode } from '../types/automation';

export function resolveDoNotDisturbSettings(
  params?: Record<string, any>
): { enabled: boolean; mode: DoNotDisturbMode } {
  const enabled = params?.enable ?? true;

  if (!enabled) {
    return { enabled: false, mode: 'all' };
  }

  const explicitMode = typeof params?.mode === 'string' ? params.mode.toLowerCase() : undefined;
  if (explicitMode === 'priority' || explicitMode === 'alarms' || explicitMode === 'none') {
    return { enabled: true, mode: explicitMode };
  }

  if (params?.allowAlarms) {
    return { enabled: true, mode: 'alarms' };
  }

  if (params?.allowCalls || (Array.isArray(params?.whitelist) && params.whitelist.length > 0)) {
    return { enabled: true, mode: 'priority' };
  }

  return { enabled: true, mode: 'none' };
}
