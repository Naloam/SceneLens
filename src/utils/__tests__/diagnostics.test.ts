import { runDiagnostics } from '../diagnostics';
import sceneBridge from '../../core/SceneBridge';

const buildTelemetry = (overrides: Partial<{
  lastStartReason: string | null;
  lastStartAt: number | null;
  lastStopReason: string | null;
  lastStopAt: number | null;
  lastRecoveryReason: string | null;
  lastRecoveryAt: number | null;
  lastRecoveryScheduleAt: number | null;
  nextRecoveryDueAt: number | null;
  nextRecoveryKind: string | null;
  immediateWorkerState: string | null;
  immediateWorkerRunAttemptCount: number;
  periodicWorkerState: string | null;
  periodicWorkerRunAttemptCount: number;
  lastWorkerRunAt: number | null;
  lastWorkerOutcome: string | null;
  lastWorkerDetail: string | null;
  lastFailureReason: string | null;
  lastFailureAt: number | null;
  lastPolicyBlockerReason: string | null;
  lastPolicyBlockerAt: number | null;
  restartCount: number;
}> = {}) => ({
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
  ...overrides,
});

describe('diagnostics background runtime telemetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports recovery failures when the foreground service is idle', async () => {
    (sceneBridge.getBackgroundLocationServiceStatus as jest.Mock).mockResolvedValue({
      running: false,
      intervalMs: 15 * 60 * 1000,
      recoveryEnabled: true,
      recoveryIntervalMs: 15 * 60 * 1000,
      executionPolicy: {
        batteryOptimizationIgnored: false,
        backgroundRestricted: true,
        powerSaveModeEnabled: false,
      },
      lastLocation: null,
      telemetry: buildTelemetry({
        lastRecoveryReason: 'worker_tick',
        lastRecoveryAt: Date.now() - 60_000,
        lastRecoveryScheduleAt: Date.now() - 60_000,
        nextRecoveryDueAt: Date.now() + 2 * 60_000,
        nextRecoveryKind: 'periodic',
        immediateWorkerState: 'ENQUEUED',
        immediateWorkerRunAttemptCount: 0,
        periodicWorkerState: 'ENQUEUED',
        periodicWorkerRunAttemptCount: 1,
        lastWorkerRunAt: Date.now() - 55_000,
        lastWorkerOutcome: 'worker_missing_permissions',
        lastFailureReason: 'worker_missing_permissions',
        lastFailureAt: Date.now() - 45_000,
        lastPolicyBlockerReason: 'battery_optimization_active|background_restricted',
        lastPolicyBlockerAt: Date.now() - 40_000,
        restartCount: 3,
      }),
    });

    const report = await runDiagnostics();
    const runtimeResult = report.results.find(result => result.category === 'Native Background Runtime');

    expect(runtimeResult).toBeDefined();
    expect(runtimeResult?.status).toBe('WARN');
    expect(runtimeResult?.message).toContain('Next periodic recovery run is due in');
    expect(runtimeResult?.message).toContain('Queue: immediate ENQUEUED; periodic ENQUEUED / attempts 1.');
    expect(runtimeResult?.message).toContain('Policy: battery optimization active; app background restricted.');
    expect(runtimeResult?.message).toContain('Last policy blocker: battery optimization active; app background restricted');
    expect(runtimeResult?.message).toContain('Last worker run');
    expect(runtimeResult?.message).toContain('Last failure');
    expect(runtimeResult?.details.telemetry.nextRecoveryKind).toBe('periodic');
    expect(runtimeResult?.details.telemetry.periodicWorkerState).toBe('ENQUEUED');
    expect(runtimeResult?.details.telemetry.restartCount).toBe(3);
    expect(runtimeResult?.details.executionPolicy).toEqual({
      batteryOptimizationIgnored: false,
      backgroundRestricted: true,
      powerSaveModeEnabled: false,
    });
    expect(runtimeResult?.details.telemetry.lastPolicyBlockerReason).toBe(
      'battery_optimization_active|background_restricted'
    );
    expect(runtimeResult?.details.telemetry.lastWorkerOutcome).toBe('worker_missing_permissions');
    expect(runtimeResult?.details.telemetry.lastFailureReason).toBe('worker_missing_permissions');
  });

  it('reports automatic restarts when the foreground service is running', async () => {
    (sceneBridge.getBackgroundLocationServiceStatus as jest.Mock).mockResolvedValue({
      running: true,
      intervalMs: 15 * 60 * 1000,
      recoveryEnabled: true,
      recoveryIntervalMs: 15 * 60 * 1000,
      lastLocation: {
        latitude: 31.2304,
        longitude: 121.4737,
        accuracy: 18,
        timestamp: Date.now() - 30_000,
        ageMs: 30_000,
        isStale: false,
        source: 'foreground_service',
        provider: 'fused',
      },
      telemetry: buildTelemetry({
        lastStartReason: 'recovery_worker',
        lastStartAt: Date.now() - 30_000,
        restartCount: 2,
      }),
    });

    const report = await runDiagnostics();
    const runtimeResult = report.results.find(result => result.category === 'Native Background Runtime');

    expect(runtimeResult).toBeDefined();
    expect(runtimeResult?.status).toBe('PASS');
    expect(runtimeResult?.message).toContain('Auto-restarted 2 time(s).');
  });

  it('fails diagnostics when recovery is enabled but no queue is armed', async () => {
    (sceneBridge.getBackgroundLocationServiceStatus as jest.Mock).mockResolvedValue({
      running: false,
      intervalMs: 15 * 60 * 1000,
      recoveryEnabled: true,
      recoveryIntervalMs: 15 * 60 * 1000,
      lastLocation: null,
      telemetry: buildTelemetry({
        nextRecoveryDueAt: Date.now() + 2 * 60 * 1000,
        nextRecoveryKind: 'periodic',
        immediateWorkerState: null,
        periodicWorkerState: 'CANCELLED',
      }),
    });

    const report = await runDiagnostics();
    const runtimeResult = report.results.find(result => result.category === 'Native Background Runtime');

    expect(runtimeResult).toBeDefined();
    expect(runtimeResult?.status).toBe('FAIL');
    expect(runtimeResult?.message).toContain('queue is not armed');
    expect(runtimeResult?.message).toContain('Queue: immediate none; periodic CANCELLED.');
  });
});
