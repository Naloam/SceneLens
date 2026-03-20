/**
 * 诊断工具 - 用于检查系统状态和权限
 */

import sceneBridge from '../core/SceneBridge';
import { Platform } from 'react-native';
import type { Location } from '../types';

export interface DiagnosticResult {
  category: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

export interface DiagnosticsReport {
  timestamp: number;
  platform: string;
  results: DiagnosticResult[];
}

/**
 * 运行完整的诊断（顺序执行，避免并发导致ANR）
 */
export async function runDiagnostics(): Promise<DiagnosticsReport> {
  const results: DiagnosticResult[] = [];

  // 顺序执行每个诊断检查，避免并发导致ANR
  results.push(await testNativeConnection());
  await sleep(100);

  results.push(await checkLocationPermission());
  await sleep(100);

  results.push(await checkBackgroundExecutionRuntime());
  await sleep(100);

  results.push(await checkBatteryOptimizationStatus());
  await sleep(100);

  results.push(await checkBackgroundPolicyStatus());
  await sleep(100);

  results.push(await checkCalendarPermission());
  await sleep(100);

  results.push(await checkUsageStatsPermission());
  await sleep(100);

  results.push(await checkActivityRecognitionPermission());
  await sleep(100);

  results.push(await testAppScanning());
  await sleep(100);

  results.push(await testLocationFetch());
  await sleep(100);

  results.push(await testWiFiFetch());
  await sleep(100);

  results.push(await testMotionState());
  await sleep(100);

  results.push(await testForegroundApp());

  return {
    timestamp: Date.now(),
    platform: Platform.OS,
    results,
  };
}

/**
 * 简单的延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试原生模块连接
 */
async function testNativeConnection(): Promise<DiagnosticResult> {
  try {
    const result = await sceneBridge.ping();
    return {
      category: '原生模块',
      status: 'PASS',
      message: '原生模块连接正常',
      details: result,
    };
  } catch (error) {
    return {
      category: '原生模块',
      status: 'FAIL',
      message: '无法连接原生模块',
      details: error,
    };
  }
}

/**
 * 检查位置权限
 */
async function checkLocationPermission(): Promise<DiagnosticResult> {
  try {
    const granted = await sceneBridge.hasLocationPermission();
    if (granted) {
      return {
        category: '位置权限',
        status: 'PASS',
        message: '位置权限已授予',
      };
    } else {
      return {
        category: '位置权限',
        status: 'FAIL',
        message: '位置权限未授予',
      };
    }
  } catch (error) {
    return {
      category: '位置权限',
      status: 'FAIL',
      message: '检查位置权限失败',
      details: error,
    };
  }
}

/**
 * 检查日历权限
 */
async function checkCalendarPermission(): Promise<DiagnosticResult> {
  try {
    const granted = await sceneBridge.hasCalendarPermission();
    if (granted) {
      return {
        category: '日历权限',
        status: 'PASS',
        message: '日历权限已授予',
      };
    } else {
      return {
        category: '日历权限',
        status: 'FAIL',
        message: '日历权限未授予',
      };
    }
  } catch (error) {
    return {
      category: '日历权限',
      status: 'FAIL',
      message: '检查日历权限失败',
      details: error,
    };
  }
}

/**
 * 检查使用统计权限
 */
async function checkUsageStatsPermission(): Promise<DiagnosticResult> {
  try {
    const granted = await sceneBridge.hasUsageStatsPermission();
    if (granted) {
      return {
        category: '使用统计权限',
        status: 'PASS',
        message: '使用统计权限已授予',
      };
    } else {
      return {
        category: '使用统计权限',
        status: 'WARN',
        message: '使用统计权限未授予 - 前台应用检测可能不可用',
      };
    }
  } catch (error) {
    return {
      category: '使用统计权限',
      status: 'WARN',
      message: '检查使用统计权限失败',
      details: error,
    };
  }
}

/**
 * 检查活动识别权限
 */
async function checkActivityRecognitionPermission(): Promise<DiagnosticResult> {
  try {
    const granted = await sceneBridge.hasActivityRecognitionPermission();
    if (granted) {
      return {
        category: '活动识别权限',
        status: 'PASS',
        message: '活动识别权限已授予',
      };
    } else {
      return {
        category: '活动识别权限',
        status: 'WARN',
        message: '活动识别权限未授予 - 运动状态检测可能不可用',
      };
    }
  } catch (error) {
    return {
      category: '活动识别权限',
      status: 'WARN',
      message: '检查活动识别权限失败',
      details: error,
    };
  }
}

/**
 * 测试应用扫描
 */
async function checkBackgroundExecutionRuntime(): Promise<DiagnosticResult> {
  if (Platform.OS !== 'android') {
    return {
      category: 'Native Background Runtime',
      status: 'WARN',
      message: 'Native background location service is only available on Android.',
    };
  }

  try {
    const status = await sceneBridge.getBackgroundLocationServiceStatus();
    const lastLocation = status.lastLocation;
    const executionPolicy = status.executionPolicy
      ? {
          batteryOptimizationIgnored: Boolean(status.executionPolicy.batteryOptimizationIgnored),
          backgroundRestricted: Boolean(status.executionPolicy.backgroundRestricted),
          powerSaveModeEnabled: Boolean(status.executionPolicy.powerSaveModeEnabled),
        }
      : null;
    const telemetry = {
      lastStartReason: status.telemetry?.lastStartReason ?? null,
      lastStartAt: status.telemetry?.lastStartAt ?? null,
      lastStopReason: status.telemetry?.lastStopReason ?? null,
      lastStopAt: status.telemetry?.lastStopAt ?? null,
      lastRecoveryReason: status.telemetry?.lastRecoveryReason ?? null,
      lastRecoveryAt: status.telemetry?.lastRecoveryAt ?? null,
      lastRecoveryScheduleAt: status.telemetry?.lastRecoveryScheduleAt ?? null,
      nextRecoveryDueAt: status.telemetry?.nextRecoveryDueAt ?? null,
      nextRecoveryKind: status.telemetry?.nextRecoveryKind ?? null,
      immediateWorkerState: status.telemetry?.immediateWorkerState ?? null,
      immediateWorkerRunAttemptCount:
        status.telemetry?.immediateWorkerRunAttemptCount ?? 0,
      periodicWorkerState: status.telemetry?.periodicWorkerState ?? null,
      periodicWorkerRunAttemptCount:
        status.telemetry?.periodicWorkerRunAttemptCount ?? 0,
      lastWorkerRunAt: status.telemetry?.lastWorkerRunAt ?? null,
      lastWorkerOutcome: status.telemetry?.lastWorkerOutcome ?? null,
      lastWorkerDetail: status.telemetry?.lastWorkerDetail ?? null,
      lastFailureReason: status.telemetry?.lastFailureReason ?? null,
      lastFailureAt: status.telemetry?.lastFailureAt ?? null,
      lastPolicyBlockerReason: status.telemetry?.lastPolicyBlockerReason ?? null,
      lastPolicyBlockerAt: status.telemetry?.lastPolicyBlockerAt ?? null,
      restartCount: status.telemetry?.restartCount ?? 0,
    };
    const details = {
      running: status.running,
      intervalMs: status.intervalMs,
      recoveryEnabled: status.recoveryEnabled,
      recoveryIntervalMs: status.recoveryIntervalMs,
      executionPolicy,
      lastLocation: lastLocation
        ? {
            latitude: lastLocation.latitude,
            longitude: lastLocation.longitude,
            accuracy: lastLocation.accuracy,
            source: lastLocation.source ?? 'unknown',
            provider: lastLocation.provider ?? 'unknown',
            timestamp: lastLocation.timestamp,
            ageMs:
              typeof lastLocation.ageMs === 'number'
                ? Math.max(0, lastLocation.ageMs)
                : Math.max(0, Date.now() - lastLocation.timestamp),
            isStale: Boolean(lastLocation.isStale),
          }
        : null,
      telemetry,
    };

    if (status.running) {
      const restartSuffix =
        telemetry.restartCount > 0
          ? ` Auto-restarted ${telemetry.restartCount} time(s).`
          : '';
      const policySuffix = describeExecutionPolicy(executionPolicy);
      return {
        category: 'Native Background Runtime',
        status: 'PASS',
        message: lastLocation
          ? `Native foreground service is active; last fix ${getLocationAgeLabel(lastLocation)}.${restartSuffix}${policySuffix}`
          : `Native foreground service is active.${restartSuffix}${policySuffix}`,
        details,
      };
    }

    if (status.recoveryEnabled) {
      const queueArmed = isRecoveryQueueArmed(telemetry);
      const scheduleSuffix = describeRecoverySchedule(telemetry);
      const queueSuffix = describeRecoveryQueue(telemetry);
      const policySuffix = describeExecutionPolicy(executionPolicy);
      const workerSuffix = telemetry.lastWorkerOutcome
        ? ` Last worker run: ${humanizeRuntimeReason(telemetry.lastWorkerOutcome, telemetry.lastWorkerDetail)}${formatRuntimeTimestampSuffix(telemetry.lastWorkerRunAt)}.`
        : '';
      const failureSuffix = telemetry.lastFailureReason
        ? ` Last failure: ${humanizeRuntimeReason(telemetry.lastFailureReason)}.`
        : '';
      const policyBlockerSuffix = telemetry.lastPolicyBlockerReason
        ? ` Last policy blocker: ${humanizePolicyBlockerReason(telemetry.lastPolicyBlockerReason)}${formatRuntimeTimestampSuffix(telemetry.lastPolicyBlockerAt)}.`
        : '';
      return {
        category: 'Native Background Runtime',
        status: queueArmed ? 'WARN' : 'FAIL',
        message: queueArmed
          ? `Foreground service is idle, but WorkManager recovery is armed.${scheduleSuffix}${queueSuffix}${policySuffix}${workerSuffix}${failureSuffix}${policyBlockerSuffix}`
          : `Foreground service is idle, but WorkManager recovery is enabled while the queue is not armed.${scheduleSuffix}${queueSuffix}${policySuffix}${workerSuffix}${failureSuffix}${policyBlockerSuffix}`,
        details,
      };
    }

    return {
      category: 'Native Background Runtime',
      status: 'WARN',
      message:
        `Native background chain is not active. The app may be in foreground or auto detection may be disabled.${describeExecutionPolicy(executionPolicy)}`,
      details,
    };
  } catch (error) {
    return {
      category: 'Native Background Runtime',
      status: 'FAIL',
      message: 'Failed to query native background runtime status.',
      details: error,
    };
  }
}

function getLocationAgeLabel(location: Location): string {
  const ageMs = resolveAgeMs(location.timestamp, location.ageMs);

  if (ageMs < 60_000) {
    return `${Math.max(1, Math.round(ageMs / 1000))}s ago`;
  }

  if (ageMs < 60 * 60 * 1000) {
    return `${Math.round(ageMs / 60_000)}m ago`;
  }

  return `${(ageMs / (60 * 60 * 1000)).toFixed(1)}h ago`;
}

function resolveAgeMs(timestamp: number, ageMs?: number): number {
  return typeof ageMs === 'number'
    ? Math.max(0, ageMs)
    : Math.max(0, Date.now() - timestamp);
}

function formatDurationCompact(durationMs: number): string {
  const safeDurationMs = Math.max(0, durationMs);
  if (safeDurationMs < 60_000) {
    return `${Math.max(1, Math.round(safeDurationMs / 1000))}s`;
  }

  if (safeDurationMs < 60 * 60 * 1000) {
    return `${Math.round(safeDurationMs / 60_000)}m`;
  }

  if (safeDurationMs < 24 * 60 * 60 * 1000) {
    return `${(safeDurationMs / (60 * 60 * 1000)).toFixed(1)}h`;
  }

  return `${Math.round(safeDurationMs / (24 * 60 * 60 * 1000))}d`;
}

function formatRuntimeTimestampSuffix(timestamp: number | null | undefined): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
    return '';
  }

  const ageMs = resolveAgeMs(timestamp);
  return ` / ${formatDurationCompact(ageMs)} ago`;
}

function describeRecoverySchedule(telemetry: {
  nextRecoveryDueAt: number | null;
  nextRecoveryKind: string | null;
}): string {
  if (telemetry.nextRecoveryKind === 'retry_pending') {
    return ' Retry is pending; WorkManager backoff controls the due time.';
  }

  if (
    typeof telemetry.nextRecoveryDueAt !== 'number' ||
    !Number.isFinite(telemetry.nextRecoveryDueAt) ||
    telemetry.nextRecoveryDueAt <= 0
  ) {
    return '';
  }

  const deltaMs = telemetry.nextRecoveryDueAt - Date.now();
  const kindLabel = telemetry.nextRecoveryKind === 'periodic'
    ? 'Next periodic recovery run'
    : 'Next recovery run';
  const durationLabel = formatDurationCompact(Math.abs(deltaMs));

  if (deltaMs >= 0) {
    return ` ${kindLabel} is due in ${durationLabel}.`;
  }

  return ` ${kindLabel} looks overdue by ${durationLabel}.`;
}

function describeRecoveryQueue(telemetry: {
  immediateWorkerState: string | null;
  immediateWorkerRunAttemptCount: number;
  periodicWorkerState: string | null;
  periodicWorkerRunAttemptCount: number;
}): string {
  const immediate = formatWorkStateSummary(
    telemetry.immediateWorkerState,
    telemetry.immediateWorkerRunAttemptCount,
  );
  const periodic = formatWorkStateSummary(
    telemetry.periodicWorkerState,
    telemetry.periodicWorkerRunAttemptCount,
  );

  return ` Queue: immediate ${immediate}; periodic ${periodic}.`;
}

function describeExecutionPolicy(executionPolicy: {
  batteryOptimizationIgnored: boolean;
  backgroundRestricted: boolean;
  powerSaveModeEnabled: boolean;
} | null): string {
  if (!executionPolicy) {
    return '';
  }

  const blockers: string[] = [];
  if (!executionPolicy.batteryOptimizationIgnored) {
    blockers.push('battery optimization active');
  }
  if (executionPolicy.backgroundRestricted) {
    blockers.push('app background restricted');
  }
  if (executionPolicy.powerSaveModeEnabled) {
    blockers.push('battery saver enabled');
  }

  return blockers.length > 0
    ? ` Policy: ${blockers.join('; ')}.`
    : ' Policy: no standard Android background restrictions detected.';
}

function formatWorkStateSummary(state: string | null, attempts: number): string {
  const normalizedState = state ?? 'none';
  return attempts > 0
    ? `${normalizedState} / attempts ${attempts}`
    : normalizedState;
}

function isRecoveryQueueArmed(telemetry: {
  immediateWorkerState: string | null;
  periodicWorkerState: string | null;
}): boolean {
  return isWorkStateActive(telemetry.immediateWorkerState)
    || isWorkStateActive(telemetry.periodicWorkerState);
}

function isWorkStateActive(state: string | null): boolean {
  return state === 'ENQUEUED' || state === 'RUNNING' || state === 'BLOCKED';
}

function humanizeRuntimeReason(
  reason: string | null | undefined,
  detail?: string | null
): string {
  if (!reason) {
    return 'unknown';
  }

  if (reason === 'manual') {
    return 'manual start';
  }

  if (reason === 'recovery_worker') {
    return 'recovery worker restart';
  }

  if (reason === 'system_restart') {
    return 'system service restart';
  }

  if (reason === 'explicit_stop') {
    return 'explicit stop request';
  }

  if (reason === 'missing_permission' || reason === 'missing_permissions') {
    return 'missing location permission';
  }

  if (reason === 'location_request_failed') {
    return 'location request failed';
  }

  if (reason === 'worker_missing_permissions') {
    return 'worker skipped because permissions are missing';
  }

  if (reason === 'worker_tick') {
    return 'recovery worker tick';
  }

  if (reason === 'boot_completed') {
    return 'device boot completed';
  }

  if (reason === 'package_replaced') {
    return 'app package replaced';
  }

  if (reason === 'task_removed') {
    return 'task removed from recents';
  }

  if (reason === 'worker_disabled') {
    return 'worker skipped because recovery is disabled';
  }

  if (reason === 'worker_already_running') {
    return 'worker skipped because service is already running';
  }

  if (reason === 'worker_restart_requested') {
    const intervalMinutes = detail ? Math.max(1, Math.round(Number(detail) / 60_000)) : null;
    return intervalMinutes
      ? `worker requested service restart (${intervalMinutes}m interval)`
      : 'worker requested service restart';
  }

  if (reason === 'worker_retry_scheduled') {
    return detail
      ? `worker scheduled retry (${detail})`
      : 'worker scheduled retry';
  }

  if (reason.startsWith('location_updates_start_failed:')) {
    return `location updates failed to start (${reason.split(':')[1] ?? 'unknown'})`;
  }

  if (reason.startsWith('location_request_exception:')) {
    return `location request exception (${reason.split(':')[1] ?? 'unknown'})`;
  }

  if (reason.startsWith('worker_restart_failed:')) {
    return `worker restart failed (${reason.split(':')[1] ?? 'unknown'})`;
  }

  return reason.replace(/_/g, ' ');
}

function humanizePolicyBlockerReason(reason: string | null | undefined): string {
  if (!reason) {
    return 'unknown';
  }

  const parts = reason
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return 'unknown';
  }

  const knownReasons: Record<string, string> = {
    battery_optimization_active: 'battery optimization active',
    background_restricted: 'app background restricted',
    power_save_mode_enabled: 'battery saver enabled',
  };

  return parts
    .map(part => knownReasons[part] ?? part.replace(/_/g, ' '))
    .join('; ');
}

async function checkBatteryOptimizationStatus(): Promise<DiagnosticResult> {
  if (Platform.OS !== 'android') {
    return {
      category: 'Battery Optimization',
      status: 'WARN',
      message: 'Battery optimization checks are only available on Android.',
    };
  }

  try {
    const ignored = await sceneBridge.isIgnoringBatteryOptimizations();
    return {
      category: 'Battery Optimization',
      status: ignored ? 'PASS' : 'WARN',
      message: ignored
        ? 'Battery optimization exemption is active.'
        : 'Battery optimization is still enabled; background detection may be throttled.',
      details: {
        ignored,
      },
    };
  } catch (error) {
    return {
      category: 'Battery Optimization',
      status: 'FAIL',
      message: 'Failed to query battery optimization status.',
      details: error,
    };
  }
}

async function checkBackgroundPolicyStatus(): Promise<DiagnosticResult> {
  if (Platform.OS !== 'android') {
    return {
      category: 'Background Policy',
      status: 'WARN',
      message: 'Background policy checks are only available on Android.',
    };
  }

  try {
    const [backgroundRestricted, powerSaveModeEnabled] = await Promise.all([
      sceneBridge.isBackgroundRestricted(),
      sceneBridge.isPowerSaveModeEnabled(),
    ]);

    if (!backgroundRestricted && !powerSaveModeEnabled) {
      return {
        category: 'Background Policy',
        status: 'PASS',
        message: 'No standard Android background restrictions are currently active.',
        details: {
          backgroundRestricted,
          powerSaveModeEnabled,
        },
      };
    }

    const reasons: string[] = [];
    if (backgroundRestricted) {
      reasons.push('app background restricted');
    }
    if (powerSaveModeEnabled) {
      reasons.push('system power saver enabled');
    }

    return {
      category: 'Background Policy',
      status: 'WARN',
      message: `Background execution may be limited: ${reasons.join('; ')}.`,
      details: {
        backgroundRestricted,
        powerSaveModeEnabled,
      },
    };
  } catch (error) {
    return {
      category: 'Background Policy',
      status: 'FAIL',
      message: 'Failed to query Android background policy restrictions.',
      details: error,
    };
  }
}

async function testAppScanning(): Promise<DiagnosticResult> {
  try {
    const apps = await sceneBridge.getInstalledApps();
    return {
      category: '应用扫描',
      status: apps.length > 0 ? 'PASS' : 'WARN',
      message: `扫描到 ${apps.length} 个应用`,
      details: {
        count: apps.length,
        sampleApps: apps.slice(0, 5).map((app: any) => app.packageName),
      },
    };
  } catch (error) {
    return {
      category: '应用扫描',
      status: 'FAIL',
      message: '应用扫描失败',
      details: error,
    };
  }
}

/**
 * 测试位置获取
 */
async function testLocationFetch(): Promise<DiagnosticResult> {
  try {
    const location = await sceneBridge.getCurrentLocation();
    if (location) {
      return {
        category: '位置获取',
        status: 'PASS',
        message: `成功获取位置: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        details: location,
      };
    } else {
      return {
        category: '位置获取',
        status: 'WARN',
        message: '无法获取位置 - 可能需要先请求权限',
      };
    }
  } catch (error) {
    return {
      category: '位置获取',
      status: 'FAIL',
      message: '位置获取失败',
      details: error,
    };
  }
}

/**
 * 测试WiFi获取
 */
async function testWiFiFetch(): Promise<DiagnosticResult> {
  try {
    const wifi = await sceneBridge.getConnectedWiFi();
    if (wifi) {
      return {
        category: 'WiFi获取',
        status: 'PASS',
        message: `已连接WiFi: ${wifi.ssid}`,
        details: wifi,
      };
    } else {
      return {
        category: 'WiFi获取',
        status: 'WARN',
        message: '未连接WiFi或无法获取WiFi信息',
      };
    }
  } catch (error) {
    return {
      category: 'WiFi获取',
      status: 'FAIL',
      message: 'WiFi获取失败',
      details: error,
    };
  }
}

/**
 * 测试运动状态
 */
async function testMotionState(): Promise<DiagnosticResult> {
  try {
    const motion = await sceneBridge.getMotionState();
    return {
      category: '运动状态',
      status: motion ? 'PASS' : 'WARN',
      message: `当前运动状态: ${motion || '未知'}`,
      details: { motion },
    };
  } catch (error) {
    return {
      category: '运动状态',
      status: 'FAIL',
      message: '获取运动状态失败',
      details: error,
    };
  }
}

/**
 * 测试前台应用
 */
async function testForegroundApp(): Promise<DiagnosticResult> {
  try {
    const app = await sceneBridge.getForegroundApp();
    if (app) {
      return {
        category: '前台应用',
        status: 'PASS',
        message: `前台应用: ${app}`,
        details: { packageName: app },
      };
    } else {
      return {
        category: '前台应用',
        status: 'WARN',
        message: '无法获取前台应用 - 可能需要使用统计权限',
      };
    }
  } catch (error) {
    return {
      category: '前台应用',
      status: 'FAIL',
      message: '获取前台应用失败',
      details: error,
    };
  }
}

/**
 * 格式化诊断报告
 */
export function formatDiagnosticsReport(report: DiagnosticsReport): string {
  let output = `=== SceneLens 诊断报告 ===\n`;
  output += `时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}\n`;
  output += `平台: ${report.platform}\n\n`;

  const grouped = report.results.reduce((acc, result) => {
    if (!acc[result.status]) {
      acc[result.status] = [];
    }
    acc[result.status].push(result);
    return acc;
  }, {} as Record<string, DiagnosticResult[]>);

  // 显示失败的项
  if (grouped.FAIL) {
    output += `❌ 失败的项目 (${grouped.FAIL.length}):\n`;
    grouped.FAIL.forEach(r => {
      output += `  - ${r.category}: ${r.message}\n`;
    });
    output += '\n';
  }

  // 显示警告的项
  if (grouped.WARN) {
    output += `⚠️  警告的项目 (${grouped.WARN.length}):\n`;
    grouped.WARN.forEach(r => {
      output += `  - ${r.category}: ${r.message}\n`;
    });
    output += '\n';
  }

  // 显示通过的项
  if (grouped.PASS) {
    output += `✅ 通过的项目 (${grouped.PASS.length}):\n`;
    grouped.PASS.forEach(r => {
      output += `  - ${r.category}: ${r.message}\n`;
      if (r.details && Object.keys(r.details).length > 0) {
        output += `    ${JSON.stringify(r.details, null, 2)}\n`;
      }
    });
  }

  return output;
}

export default {
  runDiagnostics,
  formatDiagnosticsReport,
};
