import {
  RECENT_POLICY_BLOCKER_WINDOW_MS,
  getBackgroundRuntimeRepairPlan,
  getRecentPolicyBlockerInsight,
  shouldShowBackgroundRuntimeAlert,
} from '../homeRuntimeAlert';
import type { BackgroundLocationServiceStatus } from '../../core/SceneBridge';
import { PermissionStatus, PermissionType } from '../../utils/PermissionManager';

const buildStatus = (
  overrides: Partial<BackgroundLocationServiceStatus> = {}
): BackgroundLocationServiceStatus => ({
  running: false,
  intervalMs: 15 * 60 * 1000,
  recoveryEnabled: true,
  recoveryIntervalMs: 15 * 60 * 1000,
  lastLocation: null,
  telemetry: {
    lastStartReason: null,
    lastStartAt: null,
    lastStopReason: null,
    lastStopAt: null,
    lastRecoveryReason: null,
    lastRecoveryAt: null,
    lastRecoveryScheduleAt: null,
    nextRecoveryDueAt: null,
    nextRecoveryKind: null,
    immediateWorkerState: null,
    immediateWorkerRunAttemptCount: 0,
    periodicWorkerState: null,
    periodicWorkerRunAttemptCount: 0,
    lastWorkerRunAt: null,
    lastWorkerOutcome: null,
    lastWorkerDetail: null,
    lastFailureReason: null,
    lastFailureAt: null,
    lastPolicyBlockerReason: null,
    lastPolicyBlockerAt: null,
    restartCount: 0,
  },
  ...overrides,
});

describe('HomeScreen background runtime alert', () => {
  it('shows an alert when recovery is enabled but no queue is armed', () => {
    expect(shouldShowBackgroundRuntimeAlert(true, buildStatus())).toBe(true);
  });

  it('does not show an alert when recovery queue is active', () => {
    expect(
      shouldShowBackgroundRuntimeAlert(
        true,
        buildStatus({
          telemetry: {
            ...buildStatus().telemetry,
            immediateWorkerState: 'ENQUEUED',
          },
        })
      )
    ).toBe(false);
  });

  it('does not show an alert when auto detection is disabled', () => {
    expect(shouldShowBackgroundRuntimeAlert(false, buildStatus())).toBe(false);
  });

  it('routes missing permission failures to location settings', () => {
    const plan = getBackgroundRuntimeRepairPlan(
      true,
      buildStatus({
        telemetry: {
          ...buildStatus().telemetry,
          lastFailureReason: 'missing_permissions',
        },
      })
    );

    expect(plan).toMatchObject({
      kind: 'permission',
      permission: PermissionType.LOCATION_BACKGROUND,
      buttonLabel: 'Open location settings',
    });
  });

  it('routes battery optimization problems before re-arming the queue', () => {
    const plan = getBackgroundRuntimeRepairPlan(true, buildStatus(), {
      batteryOptimizationStatus: PermissionStatus.REQUIRES_SETTINGS,
    });

    expect(plan).toMatchObject({
      kind: 'battery_optimization',
      buttonLabel: 'Open battery optimization',
    });
  });

  it('routes Android background restrictions before re-arming the queue', () => {
    const plan = getBackgroundRuntimeRepairPlan(true, buildStatus(), {
      backgroundRestricted: true,
    });

    expect(plan).toMatchObject({
      kind: 'battery_saver',
      buttonLabel: 'Open battery settings',
    });
  });

  it('uses native execution policy snapshot before falling back to JS probes', () => {
    const plan = getBackgroundRuntimeRepairPlan(
      true,
      buildStatus({
        executionPolicy: {
          batteryOptimizationIgnored: false,
          backgroundRestricted: false,
          powerSaveModeEnabled: false,
        },
      })
    );

    expect(plan).toMatchObject({
      kind: 'battery_optimization',
      buttonLabel: 'Open battery optimization',
    });
  });

  it('can fall back to persisted policy blocker telemetry when live snapshot is unavailable', () => {
    const plan = getBackgroundRuntimeRepairPlan(
      true,
      buildStatus({
        executionPolicy: null,
        telemetry: {
          ...buildStatus().telemetry,
          lastPolicyBlockerReason: 'background_restricted|power_save_mode_enabled',
        },
      })
    );

    expect(plan).toMatchObject({
      kind: 'battery_saver',
      buttonLabel: 'Open battery settings',
    });
  });

  it('re-arms with recent policy blocker context after the live execution policy is clear again', () => {
    const plan = getBackgroundRuntimeRepairPlan(
      true,
      buildStatus({
        executionPolicy: {
          batteryOptimizationIgnored: true,
          backgroundRestricted: false,
          powerSaveModeEnabled: false,
        },
        telemetry: {
          ...buildStatus().telemetry,
          lastPolicyBlockerReason: 'background_restricted|power_save_mode_enabled',
          lastPolicyBlockerAt: Date.now() - 2 * 60 * 1000,
        },
      })
    );

    expect(plan).toMatchObject({
      kind: 'rearm',
      title: 'Recovery queue stopped after a recent policy block',
      buttonLabel: 'Re-arm recovery',
    });
    expect(plan?.body).toContain('current execution policy looks clear');
    expect(plan?.body).toContain('app background restriction');
    expect(plan?.body).toContain('battery saver');
  });

  it('exposes recent policy blocker insight with separate reasons', () => {
    const insight = getRecentPolicyBlockerInsight(
      buildStatus({
        telemetry: {
          ...buildStatus().telemetry,
          lastPolicyBlockerReason: 'background_restricted|power_save_mode_enabled',
          lastPolicyBlockerAt: Date.now() - 90_000,
        },
      })
    );

    expect(insight).toMatchObject({
      formattedReason: 'background restricted; battery saver enabled',
      causeText: 'app background restriction and battery saver',
      reasonCodes: ['background_restricted', 'power_save_mode_enabled'],
    });
  });

  it('falls back to the generic re-arm copy when the policy blocker is stale', () => {
    const plan = getBackgroundRuntimeRepairPlan(
      true,
      buildStatus({
        executionPolicy: {
          batteryOptimizationIgnored: true,
          backgroundRestricted: false,
          powerSaveModeEnabled: false,
        },
        telemetry: {
          ...buildStatus().telemetry,
          lastPolicyBlockerReason: 'background_restricted',
          lastPolicyBlockerAt: Date.now() - RECENT_POLICY_BLOCKER_WINDOW_MS - 60_000,
        },
      })
    );

    expect(plan).toMatchObject({
      kind: 'rearm',
      title: 'Recovery queue is not armed',
      buttonLabel: 'Re-arm recovery',
    });
  });

  it('falls back to re-arming when no blocking condition is detected', () => {
    const plan = getBackgroundRuntimeRepairPlan(true, buildStatus(), {
      locationFineStatus: PermissionStatus.GRANTED,
      locationBackgroundStatus: PermissionStatus.GRANTED,
      batteryOptimizationStatus: PermissionStatus.GRANTED,
      backgroundRestricted: false,
      powerSaveModeEnabled: false,
    });

    expect(plan).toMatchObject({
      kind: 'rearm',
      buttonLabel: 'Re-arm recovery',
    });
  });
});
