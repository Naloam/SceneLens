import sceneBridge, {
  type BackgroundExecutionPolicyStatus,
  type BackgroundLocationServiceStatus,
} from '../core/SceneBridge';
import {
  permissionManager,
  PermissionStatus,
  PermissionType,
} from '../utils/PermissionManager';

export interface BackgroundRuntimeRepairPlan {
  kind: 'permission' | 'battery_optimization' | 'battery_saver' | 'rearm';
  title: string;
  body: string;
  buttonLabel: string;
  permission?: PermissionType;
}

export interface BackgroundRuntimeRepairSignals {
  locationFineStatus?: PermissionStatus | null;
  locationBackgroundStatus?: PermissionStatus | null;
  batteryOptimizationStatus?: PermissionStatus | null;
  batteryOptimizationIgnored?: boolean | null;
  backgroundRestricted?: boolean | null;
  powerSaveModeEnabled?: boolean | null;
}

export interface RecentPolicyBlockerInsight {
  ageLabel: string;
  ageMs: number;
  causeText: string;
  formattedReason: string;
  reasonCodes: string[];
}

export const RECENT_POLICY_BLOCKER_WINDOW_MS = 10 * 60 * 1000;

const POLICY_BLOCKER_REASON_LABELS: Record<string, string> = {
  battery_optimization_active: 'battery optimization active',
  background_restricted: 'background restricted',
  power_save_mode_enabled: 'battery saver enabled',
};

const POLICY_BLOCKER_CAUSE_LABELS: Record<string, string> = {
  battery_optimization_active: 'battery optimization',
  background_restricted: 'app background restriction',
  power_save_mode_enabled: 'battery saver',
};

export function isWorkManagerStateActive(state: string | null | undefined): boolean {
  return state === 'ENQUEUED' || state === 'RUNNING' || state === 'BLOCKED';
}

export function formatWorkManagerState(
  state: string | null | undefined,
  attempts: number | null | undefined
): string {
  const normalizedState = state ?? 'none';
  const safeAttempts = typeof attempts === 'number' && Number.isFinite(attempts)
    ? Math.max(0, Math.round(attempts))
    : 0;

  return safeAttempts > 0
    ? `${normalizedState} / attempts ${safeAttempts}`
    : normalizedState;
}

export function shouldShowBackgroundRuntimeAlert(
  autoDetectionEnabled: boolean,
  status: BackgroundLocationServiceStatus | null
): boolean {
  if (!autoDetectionEnabled || !status || status.running || !status.recoveryEnabled) {
    return false;
  }

  return !isWorkManagerStateActive(status.telemetry.immediateWorkerState)
    && !isWorkManagerStateActive(status.telemetry.periodicWorkerState);
}

function isPermissionBlocked(status: PermissionStatus | null | undefined): boolean {
  return status === PermissionStatus.DENIED
    || status === PermissionStatus.PERMANENTLY_DENIED
    || status === PermissionStatus.REQUIRES_SETTINGS;
}

function isMissingPermissionReason(reason: string | null | undefined): boolean {
  return reason === 'missing_permission'
    || reason === 'missing_permissions'
    || reason === 'worker_missing_permissions';
}

function hasBatteryOptimizationPolicyReason(reason: string | null | undefined): boolean {
  return getPolicyBlockerReasonCodes(reason).includes('battery_optimization_active');
}

function hasBatterySaverPolicyReason(reason: string | null | undefined): boolean {
  const parts = getPolicyBlockerReasonCodes(reason);
  return parts.includes('background_restricted') || parts.includes('power_save_mode_enabled');
}

function getExecutionPolicySnapshot(
  status: BackgroundLocationServiceStatus | null
): BackgroundExecutionPolicyStatus | null {
  return status?.executionPolicy ?? null;
}

function getPolicyBlockerReasonCodes(reason: string | null | undefined): string[] {
  if (!reason) {
    return [];
  }

  return Array.from(new Set(
    reason
      .split('|')
      .map(part => part.trim())
      .filter(Boolean)
  ));
}

function mapPolicyBlockerLabels(
  reasonCodes: string[],
  labels: Record<string, string>
): string[] {
  return reasonCodes.map(code => labels[code] ?? code.replace(/_/g, ' '));
}

function joinNaturalLanguage(labels: string[]): string {
  if (labels.length === 0) {
    return 'unknown policy restriction';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function formatRelativeAge(ageMs: number): string {
  const safeAgeMs = Math.max(0, ageMs);
  if (safeAgeMs < 60_000) {
    return `${Math.max(1, Math.round(safeAgeMs / 1000))}s ago`;
  }

  if (safeAgeMs < 60 * 60 * 1000) {
    return `${Math.round(safeAgeMs / 60_000)}m ago`;
  }

  if (safeAgeMs < 24 * 60 * 60 * 1000) {
    return `${(safeAgeMs / (60 * 60 * 1000)).toFixed(1)}h ago`;
  }

  return `${Math.round(safeAgeMs / (24 * 60 * 60 * 1000))}d ago`;
}

function isBackgroundPolicyBlocked(
  backgroundRestricted: boolean | null | undefined,
  powerSaveModeEnabled: boolean | null | undefined
): boolean {
  return backgroundRestricted === true || powerSaveModeEnabled === true;
}

function isBackgroundPolicyClear(
  backgroundRestricted: boolean | null | undefined,
  powerSaveModeEnabled: boolean | null | undefined
): boolean {
  return backgroundRestricted === false && powerSaveModeEnabled === false;
}

function isBatteryOptimizationBlocked(
  batteryOptimizationIgnored: boolean | null | undefined,
  batteryOptimizationStatus: PermissionStatus | null | undefined
): boolean {
  return batteryOptimizationIgnored === false || isPermissionBlocked(batteryOptimizationStatus);
}

function isBatteryOptimizationClear(
  batteryOptimizationIgnored: boolean | null | undefined,
  batteryOptimizationStatus: PermissionStatus | null | undefined
): boolean {
  return batteryOptimizationIgnored === true
    || batteryOptimizationStatus === PermissionStatus.GRANTED;
}

function getBatterySaverRestrictionLabels(
  backgroundRestricted: boolean | null | undefined,
  powerSaveModeEnabled: boolean | null | undefined,
  lastPolicyBlockerReason: string | null | undefined
): string[] {
  const restrictions = new Set<string>();
  const reasonCodes = getPolicyBlockerReasonCodes(lastPolicyBlockerReason);

  if (backgroundRestricted || reasonCodes.includes('background_restricted')) {
    restrictions.add('app background restriction');
  }

  if (powerSaveModeEnabled || reasonCodes.includes('power_save_mode_enabled')) {
    restrictions.add('battery saver');
  }

  return Array.from(restrictions);
}

export function formatPolicyBlockerReason(reason: string | null | undefined): string {
  const reasonCodes = getPolicyBlockerReasonCodes(reason);
  if (reasonCodes.length === 0) {
    return 'unknown';
  }

  return mapPolicyBlockerLabels(reasonCodes, POLICY_BLOCKER_REASON_LABELS).join('; ');
}

export function getRecentPolicyBlockerInsight(
  status: BackgroundLocationServiceStatus | null,
  options: {
    now?: number;
    windowMs?: number;
  } = {}
): RecentPolicyBlockerInsight | null {
  const timestamp = status?.telemetry.lastPolicyBlockerAt ?? null;
  const reasonCodes = getPolicyBlockerReasonCodes(status?.telemetry.lastPolicyBlockerReason);
  if (
    typeof timestamp !== 'number'
    || !Number.isFinite(timestamp)
    || timestamp <= 0
    || reasonCodes.length === 0
  ) {
    return null;
  }

  const now = options.now ?? Date.now();
  const windowMs = options.windowMs ?? RECENT_POLICY_BLOCKER_WINDOW_MS;
  const ageMs = Math.max(0, now - timestamp);
  if (ageMs > windowMs) {
    return null;
  }

  return {
    ageLabel: formatRelativeAge(ageMs),
    ageMs,
    causeText: joinNaturalLanguage(
      mapPolicyBlockerLabels(reasonCodes, POLICY_BLOCKER_CAUSE_LABELS)
    ),
    formattedReason: formatPolicyBlockerReason(status?.telemetry.lastPolicyBlockerReason),
    reasonCodes,
  };
}

export function getBackgroundRuntimeRepairPlan(
  autoDetectionEnabled: boolean,
  status: BackgroundLocationServiceStatus | null,
  signals: BackgroundRuntimeRepairSignals = {}
): BackgroundRuntimeRepairPlan | null {
  if (!shouldShowBackgroundRuntimeAlert(autoDetectionEnabled, status)) {
    return null;
  }

  const executionPolicy = getExecutionPolicySnapshot(status);
  const backgroundRestricted =
    signals.backgroundRestricted ?? executionPolicy?.backgroundRestricted ?? null;
  const powerSaveModeEnabled =
    signals.powerSaveModeEnabled ?? executionPolicy?.powerSaveModeEnabled ?? null;
  const batteryOptimizationIgnored =
    signals.batteryOptimizationIgnored ?? executionPolicy?.batteryOptimizationIgnored ?? null;
  const lastPolicyBlockerReason = status?.telemetry.lastPolicyBlockerReason ?? null;
  const recentPolicyBlocker = getRecentPolicyBlockerInsight(status);
  const backgroundPolicyBlocked = isBackgroundPolicyBlocked(
    backgroundRestricted,
    powerSaveModeEnabled
  );
  const backgroundPolicyClear = isBackgroundPolicyClear(
    backgroundRestricted,
    powerSaveModeEnabled
  );
  const batteryOptimizationBlocked = isBatteryOptimizationBlocked(
    batteryOptimizationIgnored,
    signals.batteryOptimizationStatus
  );
  const batteryOptimizationClear = isBatteryOptimizationClear(
    batteryOptimizationIgnored,
    signals.batteryOptimizationStatus
  );
  const missingLocationPermission = isMissingPermissionReason(
    status?.telemetry.lastFailureReason
  ) || isPermissionBlocked(signals.locationFineStatus)
    || isPermissionBlocked(signals.locationBackgroundStatus);

  if (missingLocationPermission) {
    return {
      kind: 'permission',
      title: 'Location permission needs attention',
      body: 'The native recovery chain last failed because location access is missing or incomplete. Open location settings first; re-arming the queue alone will not keep the worker alive.',
      buttonLabel: 'Open location settings',
      permission: PermissionType.LOCATION_BACKGROUND,
    };
  }

  if (
    backgroundPolicyBlocked
    || (
      !backgroundPolicyClear
      && hasBatterySaverPolicyReason(lastPolicyBlockerReason)
    )
  ) {
    const restrictions = getBatterySaverRestrictionLabels(
      backgroundRestricted,
      powerSaveModeEnabled,
      lastPolicyBlockerReason
    );
    if (restrictions.length === 0) {
      restrictions.push('recent Android background policy restriction');
    }

    return {
      kind: 'battery_saver',
      title: 'Android background policy may block recovery',
      body: `Recovery is likely being throttled by ${restrictions.join(' and ')}. Open battery settings first or the service may stop again immediately.`,
      buttonLabel: 'Open battery settings',
    };
  }

  if (
    batteryOptimizationBlocked
    || (
      !batteryOptimizationClear
      && hasBatteryOptimizationPolicyReason(lastPolicyBlockerReason)
    )
  ) {
    return {
      kind: 'battery_optimization',
      title: 'Battery optimization may block recovery',
      body: 'SceneLens is still subject to battery optimization. Open the optimization settings first or WorkManager may be throttled again.',
      buttonLabel: 'Open battery optimization',
    };
  }

  if (recentPolicyBlocker && backgroundPolicyClear && batteryOptimizationClear) {
    return {
      kind: 'rearm',
      title: 'Recovery queue stopped after a recent policy block',
      body: `The current execution policy looks clear, but the last recovery attempt was blocked ${recentPolicyBlocker.ageLabel} by ${recentPolicyBlocker.causeText}. Re-arm the queue now that Android is no longer actively blocking recovery.`,
      buttonLabel: 'Re-arm recovery',
    };
  }

  return {
    kind: 'rearm',
    title: 'Recovery queue is not armed',
    body: 'Background recovery is enabled, but neither the immediate nor periodic WorkManager job is active.',
    buttonLabel: 'Re-arm recovery',
  };
}

export async function resolveBackgroundRuntimeRepairPlan(
  autoDetectionEnabled: boolean,
  status: BackgroundLocationServiceStatus | null
): Promise<BackgroundRuntimeRepairPlan | null> {
  if (!shouldShowBackgroundRuntimeAlert(autoDetectionEnabled, status)) {
    return null;
  }

  const [
    finePermission,
    backgroundPermission,
    batteryOptimizationPermission,
    backgroundRestricted,
    powerSaveModeEnabled,
  ] = await Promise.all([
    permissionManager.checkPermission(PermissionType.LOCATION_FINE).catch(() => null),
    permissionManager.checkPermission(PermissionType.LOCATION_BACKGROUND).catch(() => null),
    status?.executionPolicy
      ? Promise.resolve(null)
      : permissionManager.checkPermission(PermissionType.BATTERY_OPTIMIZATION).catch(() => null),
    status?.executionPolicy
      ? Promise.resolve(status.executionPolicy.backgroundRestricted)
      : sceneBridge.isBackgroundRestricted().catch(() => null),
    status?.executionPolicy
      ? Promise.resolve(status.executionPolicy.powerSaveModeEnabled)
      : sceneBridge.isPowerSaveModeEnabled().catch(() => null),
  ]);

  return getBackgroundRuntimeRepairPlan(autoDetectionEnabled, status, {
    locationFineStatus: finePermission?.status ?? null,
    locationBackgroundStatus: backgroundPermission?.status ?? null,
    batteryOptimizationStatus: batteryOptimizationPermission?.status ?? null,
    batteryOptimizationIgnored: status?.executionPolicy?.batteryOptimizationIgnored ?? null,
    backgroundRestricted,
    powerSaveModeEnabled,
  });
}

export async function performBackgroundRuntimeRepair(
  plan: BackgroundRuntimeRepairPlan,
  rearmRecovery: () => Promise<void>
): Promise<BackgroundRuntimeRepairPlan['kind']> {
  switch (plan.kind) {
    case 'permission':
      await permissionManager.openSpecificSettings(
        plan.permission ?? PermissionType.LOCATION_BACKGROUND
      );
      return plan.kind;

    case 'battery_optimization':
      await permissionManager.openSpecificSettings(PermissionType.BATTERY_OPTIMIZATION);
      return plan.kind;

    case 'battery_saver':
      if (!(await sceneBridge.openBatterySaverSettings())) {
        await permissionManager.openSpecificSettings(PermissionType.BATTERY_OPTIMIZATION);
      }
      return plan.kind;

    case 'rearm':
    default:
      await rearmRecovery();
      return 'rearm';
  }
}
