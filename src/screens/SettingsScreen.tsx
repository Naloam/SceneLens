/**
 * 设置页面
 *
 * 提供应用设置选项，包括外观、通知、高级设置和数据管理
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TouchableOpacity,
  Text,
} from 'react-native';
import {
  Card,
  List,
  Switch,
  RadioButton,
  TouchableRipple,
  useTheme,
  Divider,
  Portal,
  Dialog,
  Button,
  ActivityIndicator,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useSettingsStore, themeColors, type ThemeColor, type NotificationStyle, type DetectionInterval } from '../stores/settingsStore';
import { personalizationManager } from '../services/suggestion/PersonalizationManager';
import sceneBridge, {
  type BackgroundExecutionPolicyStatus,
  type BackgroundLocationServiceStatus,
  type BackgroundLocationServiceTelemetry,
} from '../core/SceneBridge';
import {
  formatPolicyBlockerReason,
  getRecentPolicyBlockerInsight,
  performBackgroundRuntimeRepair,
  resolveBackgroundRuntimeRepairPlan,
  shouldShowBackgroundRuntimeAlert,
  type BackgroundRuntimeRepairPlan,
} from './homeRuntimeAlert';
import {
  APP_VERSION,
  PRIVACY_POLICY_TEXT,
  SCENELENS_REPO_URL,
  buildFeedbackIssueUrl,
  exportDataWithBestEffortShare,
} from '../utils/settingsSupport';

/**
 * 颜色选择器组件
 */
const ColorPicker: React.FC<{
  selectedColor: ThemeColor;
  onSelectColor: (color: ThemeColor) => void;
}> = ({ selectedColor, onSelectColor }) => {
  const colors: ThemeColor[] = ['blue', 'purple', 'green', 'orange'];

  return (
    <View style={styles.colorPickerContainer}>
      {colors.map((color) => (
        <TouchableOpacity
          key={color}
          style={[
            styles.colorDot,
            { backgroundColor: themeColors[color].primary },
            selectedColor === color && styles.colorDotSelected,
          ]}
          onPress={() => onSelectColor(color)}
          activeOpacity={0.7}
        >
          {selectedColor === color && <View style={styles.colorDotCheck} />}
        </TouchableOpacity>
      ))}
    </View>
  );
};

/**
 * 单选按钮组组件
 */
interface RadioOption<T> {
  label: string;
  value: T;
  description?: string;
}

const RadioGroup: React.FC<{
  options: RadioOption<string | number>[];
  value: string | number;
  onChange: (value: any) => void;
}> = ({ options, value, onChange }) => {
  const theme = useTheme();

  return (
    <View style={styles.radioGroup}>
      {options.map((option, index) => (
        <View key={option.value.toString()}>
          <TouchableRipple onPress={() => onChange(option.value)}>
            <View style={styles.radioItem}>
              <View style={styles.radioContent}>
                <Text style={[styles.radioLabel, { color: theme.colors.onSurface }]}>
                  {option.label}
                </Text>
                {option.description && (
                  <Text style={[styles.radioDescription, { color: theme.colors.onSurfaceVariant }]}>
                    {option.description}
                  </Text>
                )}
              </View>
              <RadioButton
                value={option.value.toString()}
                status={value === option.value ? 'checked' : 'unchecked'}
                onPress={() => onChange(option.value)}
              />
            </View>
          </TouchableRipple>
          {index < options.length - 1 && <Divider />}
        </View>
      ))}
    </View>
  );
};

/**
 * 置信度滑块组件
 */
const ConfidenceSlider: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => {
  const theme = useTheme();
  const options = [30, 40, 50, 60, 70, 80, 90];

  return (
    <View style={styles.sliderSection}>
      <View style={styles.sliderHeader}>
        <View>
          <Text style={[styles.sliderTitle, { color: theme.colors.onSurface }]}>
            置信度阈值
          </Text>
          <Text style={[styles.sliderDescription, { color: theme.colors.onSurfaceVariant }]}>
            触发场景通知的最低置信度
          </Text>
        </View>
        <Text style={[styles.sliderValue, { color: theme.colors.primary }]}>
          {value}%
        </Text>
      </View>
      <View style={styles.sliderButtons}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.sliderButton,
              value === option && { backgroundColor: theme.colors.primary },
            ]}
            onPress={() => onChange(option)}
          >
            <Text
              style={[
                styles.sliderButtonText,
                value === option && { color: '#FFFFFF' },
              ]}
            >
              {option}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;
type RuntimeLocation = NonNullable<BackgroundLocationServiceStatus['lastLocation']>;
type RuntimeTelemetry = BackgroundLocationServiceTelemetry;

function resolveRuntimeLocationAgeMs(location: RuntimeLocation): number {
  if (typeof location.ageMs === 'number' && Number.isFinite(location.ageMs)) {
    return Math.max(0, location.ageMs);
  }

  return Math.max(0, Date.now() - location.timestamp);
}

function formatRuntimeLocationAge(location: RuntimeLocation): string {
  const ageMs = resolveRuntimeLocationAgeMs(location);
  if (ageMs < 60_000) {
    return `${Math.max(1, Math.round(ageMs / 1000))}s ago`;
  }

  if (ageMs < 60 * 60 * 1000) {
    return `${Math.round(ageMs / 60_000)}m ago`;
  }

  return `${(ageMs / (60 * 60 * 1000)).toFixed(1)}h ago`;
}

function formatRuntimeInterval(intervalMs: number): string {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return 'off';
  }

  if (intervalMs < 60_000) {
    return `${Math.round(intervalMs / 1000)}s`;
  }

  return `${Math.round(intervalMs / 60_000)}m`;
}

function formatRuntimeTimestamp(timestamp: number | null | undefined): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
    return 'never';
  }

  const ageMs = Math.max(0, Date.now() - timestamp);
  if (ageMs < 60_000) {
    return `${Math.max(1, Math.round(ageMs / 1000))}s ago`;
  }

  if (ageMs < 60 * 60 * 1000) {
    return `${Math.round(ageMs / 60_000)}m ago`;
  }

  if (ageMs < 24 * 60 * 60 * 1000) {
    return `${(ageMs / (60 * 60 * 1000)).toFixed(1)}h ago`;
  }

  return `${Math.round(ageMs / (24 * 60 * 60 * 1000))}d ago`;
}

function formatRuntimeDuration(durationMs: number): string {
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

function formatRuntimeReason(
  reason: string | null | undefined,
  detail?: string | null
): string {
  if (!reason) {
    return 'unknown';
  }

  const knownReasons: Record<string, string> = {
    manual: 'manual start',
    recovery_worker: 'recovery worker restart',
    system_restart: 'system service restart',
    explicit_stop: 'explicit stop',
    missing_permission: 'missing permission',
    missing_permissions: 'missing permission',
    location_request_failed: 'location request failed',
    worker_missing_permissions: 'worker blocked by missing permissions',
    worker_tick: 'worker tick',
    boot_completed: 'boot completed',
    package_replaced: 'package replaced',
    task_removed: 'task removed from recents',
    worker_disabled: 'worker disabled',
    worker_already_running: 'worker saw service already running',
  };

  if (knownReasons[reason]) {
    return knownReasons[reason];
  }

  if (reason.startsWith('location_updates_start_failed:')) {
    return `updates start failed (${reason.split(':')[1] ?? 'unknown'})`;
  }

  if (reason.startsWith('location_request_exception:')) {
    return `location request exception (${reason.split(':')[1] ?? 'unknown'})`;
  }

  if (reason.startsWith('worker_restart_failed:')) {
    return `worker restart failed (${reason.split(':')[1] ?? 'unknown'})`;
  }

  if (reason === 'worker_restart_requested') {
    const intervalMs = detail && Number.isFinite(Number(detail)) ? Number(detail) : null;
    if (intervalMs && intervalMs > 0) {
      return `worker requested restart (${Math.round(intervalMs / 60_000)}m interval)`;
    }
    return 'worker requested restart';
  }

  if (reason === 'worker_retry_scheduled') {
    return detail
      ? `worker scheduled retry (${detail})`
      : 'worker scheduled retry';
  }

  return reason.replace(/_/g, ' ');
}

function formatRecoveryScheduleKind(kind: string | null | undefined): string {
  if (!kind) {
    return 'unknown';
  }

  if (kind === 'immediate') {
    return 'immediate';
  }

  if (kind === 'periodic') {
    return 'periodic';
  }

  if (kind === 'retry_pending') {
    return 'retry pending';
  }

  return kind.replace(/_/g, ' ');
}

function formatWorkManagerState(
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

function getRuntimePolicyBlockers(
  executionPolicy: BackgroundExecutionPolicyStatus | null | undefined
): string[] {
  if (!executionPolicy) {
    return [];
  }

  const blockers: string[] = [];
  if (!executionPolicy.batteryOptimizationIgnored) {
    blockers.push('battery optimization active');
  }
  if (executionPolicy.backgroundRestricted) {
    blockers.push('background restricted');
  }
  if (executionPolicy.powerSaveModeEnabled) {
    blockers.push('battery saver on');
  }
  return blockers;
}

function formatRuntimeExecutionPolicy(
  executionPolicy: BackgroundExecutionPolicyStatus | null | undefined
): string {
  if (!executionPolicy) {
    return 'unknown';
  }

  const parts = [
    executionPolicy.batteryOptimizationIgnored
      ? 'battery optimization exempt'
      : 'battery optimization active',
    executionPolicy.backgroundRestricted
      ? 'background restricted'
      : 'background unrestricted',
    executionPolicy.powerSaveModeEnabled
      ? 'battery saver on'
      : 'battery saver off',
  ];

  return parts.join(' / ');
}

function formatRuntimePolicySummary(
  executionPolicy: BackgroundExecutionPolicyStatus | null | undefined
): string {
  const blockers = getRuntimePolicyBlockers(executionPolicy);
  return blockers.length > 0
    ? ` Policy blockers: ${blockers.join('; ')}.`
    : '';
}

function getRuntimeLastPolicyBlockerSummary(
  status: BackgroundLocationServiceStatus
): string {
  const lastPolicyBlockerReason = status.telemetry.lastPolicyBlockerReason;
  if (!lastPolicyBlockerReason) {
    return '';
  }

  const recentPolicyBlocker = getRecentPolicyBlockerInsight(status);
  if (recentPolicyBlocker && getRuntimePolicyBlockers(status.executionPolicy).length === 0) {
    return ` Recent recovery blocker: ${recentPolicyBlocker.formattedReason} (${recentPolicyBlocker.ageLabel}), but the current execution policy looks clear now.`;
  }

  const timestampLabel = formatRuntimeTimestamp(status.telemetry.lastPolicyBlockerAt);
  return timestampLabel !== 'never'
    ? ` Last policy blocker: ${formatPolicyBlockerReason(lastPolicyBlockerReason)} (${timestampLabel}).`
    : ` Last policy blocker: ${formatPolicyBlockerReason(lastPolicyBlockerReason)}.`;
}

function formatRuntimeEvent(
  timestamp: number | null | undefined,
  reason: string | null | undefined,
  detail?: string | null,
  emptyLabel = 'none'
): string {
  if (
    (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) &&
    !reason
  ) {
    return emptyLabel;
  }

  const parts: string[] = [];
  if (reason) {
    parts.push(formatRuntimeReason(reason, detail));
  }

  const timestampLabel = formatRuntimeTimestamp(timestamp);
  if (timestampLabel !== 'never') {
    parts.push(timestampLabel);
  }

  return parts.length > 0 ? parts.join(' / ') : emptyLabel;
}

function formatRecoveryDue(
  dueAt: number | null | undefined,
  kind: string | null | undefined
): string {
  if (kind === 'retry_pending') {
    return 'retry pending / WorkManager backoff';
  }

  const kindLabel = formatRecoveryScheduleKind(kind);
  if (typeof dueAt !== 'number' || !Number.isFinite(dueAt) || dueAt <= 0) {
    return kind ? `${kindLabel} / unknown` : 'none';
  }

  const deltaMs = dueAt - Date.now();
  const durationLabel = formatRuntimeDuration(Math.abs(deltaMs));
  return deltaMs >= 0
    ? `${kindLabel} / in ${durationLabel}`
    : `${kindLabel} / overdue by ${durationLabel}`;
}

function getBackgroundRuntimeSummary(
  autoDetectionEnabled: boolean,
  status: BackgroundLocationServiceStatus | null
): string {
  if (!autoDetectionEnabled) {
    return 'Auto detection is off, so the native background chain will stay idle.';
  }

  if (!status) {
    return 'Unable to read native background runtime state.';
  }

  const policySummary = formatRuntimePolicySummary(status.executionPolicy);
  const lastPolicyBlockerSummary = getRuntimeLastPolicyBlockerSummary(status);

  if (status.running) {
    return status.telemetry.restartCount > 0
      ? `Native foreground location service is active. Auto-restarted ${status.telemetry.restartCount} time(s).${policySummary}`
      : `Native foreground location service is active.${policySummary}`;
  }

  if (status.recoveryEnabled) {
    const queueLabel = `Queue: immediate ${formatWorkManagerState(
      status.telemetry.immediateWorkerState,
      status.telemetry.immediateWorkerRunAttemptCount
    )}; periodic ${formatWorkManagerState(
      status.telemetry.periodicWorkerState,
      status.telemetry.periodicWorkerRunAttemptCount
    )}.`;
    if (status.telemetry.lastFailureReason) {
      const dueLabel = formatRecoveryDue(
        status.telemetry.nextRecoveryDueAt,
        status.telemetry.nextRecoveryKind
      );
      return `Foreground service is idle, but recovery worker is armed. Next recovery: ${dueLabel}. ${queueLabel}${policySummary} Last failure: ${formatRuntimeReason(status.telemetry.lastFailureReason)}.${lastPolicyBlockerSummary}`;
    }

    if (status.telemetry.lastWorkerOutcome) {
      const dueLabel = formatRecoveryDue(
        status.telemetry.nextRecoveryDueAt,
        status.telemetry.nextRecoveryKind
      );
      return `Foreground service is idle, but recovery worker is armed. Next recovery: ${dueLabel}. ${queueLabel}${policySummary} Last worker run: ${formatRuntimeReason(status.telemetry.lastWorkerOutcome, status.telemetry.lastWorkerDetail)}.${lastPolicyBlockerSummary}`;
    }

    return `Foreground service is idle, but recovery worker is armed. Next recovery: ${formatRecoveryDue(
      status.telemetry.nextRecoveryDueAt,
      status.telemetry.nextRecoveryKind
    )}. ${queueLabel}${policySummary}${lastPolicyBlockerSummary}`;
  }

  return `Native chain is idle. Re-enter background or re-check blocked permissions.${policySummary}`;
}

/**
 * 主设置页面
 */
export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<SettingsNavigationProp>();
  const {
    settings,
    isLoading,
    toggleDarkMode,
    setThemeColor,
    toggleSceneNotifications,
    setNotificationStyle,
    toggleAutoDetection,
    setDetectionInterval,
    setConfidenceThreshold,
    resetSettings,
    exportData,
    clearHistory,
    loadSettings,
  } = useSettingsStore();

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showClearLearningDialog, setShowClearLearningDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearingLearning, setIsClearingLearning] = useState(false);
  const [onlineLearningEnabled, setOnlineLearningEnabled] = useState(true);
  const [learningHalfLifeDays, setLearningHalfLifeDays] = useState(14);
  const [backgroundRuntimeStatus, setBackgroundRuntimeStatus] = useState<BackgroundLocationServiceStatus | null>(null);
  const [backgroundRuntimeLoading, setBackgroundRuntimeLoading] = useState(false);
  const [backgroundRuntimeRepairing, setBackgroundRuntimeRepairing] = useState(false);
  const [backgroundRuntimeRepairPlan, setBackgroundRuntimeRepairPlan] =
    useState<BackgroundRuntimeRepairPlan | null>(null);

  const loadBackgroundRuntimeStatus = async () => {
    setBackgroundRuntimeLoading(true);
    try {
      const status = await sceneBridge.getBackgroundLocationServiceStatus();
      setBackgroundRuntimeStatus(status);
      setBackgroundRuntimeRepairPlan(
        await resolveBackgroundRuntimeRepairPlan(settings.autoDetectionEnabled, status)
      );
    } catch (error) {
      console.warn('[SettingsScreen] Failed to load native background runtime status:', error);
      setBackgroundRuntimeStatus(null);
      setBackgroundRuntimeRepairPlan(null);
    } finally {
      setBackgroundRuntimeLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadSettings();
      await personalizationManager.initialize();
      const learningConfig = personalizationManager.getOnlineLearningConfig();
      setOnlineLearningEnabled(learningConfig.enabled);
      setLearningHalfLifeDays(learningConfig.halfLifeDays);
      await loadBackgroundRuntimeStatus();
    };
    init();
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    loadBackgroundRuntimeStatus();
  }, [isLoading, settings.autoDetectionEnabled, settings.detectionInterval]);

  const handleToggleOnlineLearning = async (enabled: boolean) => {
    setOnlineLearningEnabled(enabled);
    await personalizationManager.setOnlineLearningEnabled(enabled);
  };

  const handleHalfLifeChange = async (days: number) => {
    setLearningHalfLifeDays(days);
    await personalizationManager.setLearningHalfLifeDays(days);
  };

  const rearmBackgroundRecovery = async () => {
    const desiredIntervalMs = Math.max(
      backgroundRuntimeStatus?.recoveryIntervalMs ?? settings.detectionInterval * 60 * 1000,
      60_000
    );

    await sceneBridge.configureBackgroundLocationRecovery(true, desiredIntervalMs);
    await loadBackgroundRuntimeStatus();
  };

  const handleRepairBackgroundRecovery = async () => {
    setBackgroundRuntimeRepairing(true);
    try {
      const repairKind = backgroundRuntimeRepairPlan
        ? await performBackgroundRuntimeRepair(
            backgroundRuntimeRepairPlan,
            rearmBackgroundRecovery
          )
        : (await rearmBackgroundRecovery(), 'rearm' as const);

      if (repairKind === 'rearm') {
        Alert.alert('Recovery re-armed', 'WorkManager recovery has been re-enqueued.');
      }
    } catch (error) {
      Alert.alert(
        'Recovery repair failed',
        `Unable to repair background recovery: ${(error as Error).message}`
      );
    } finally {
      setBackgroundRuntimeRepairing(false);
    }
  };

  const handleClearLearningData = async () => {
    setIsClearingLearning(true);
    try {
      await personalizationManager.clearOnlineLearningData();
      setShowClearLearningDialog(false);
      Alert.alert('成功', '在线学习数据已清空');
    } catch (error) {
      Alert.alert('清空失败', `无法清空在线学习数据：${(error as Error).message}`);
    } finally {
      setIsClearingLearning(false);
    }
  };

  /**
   * 导出数据
   */
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await exportData();
      const result = await exportDataWithBestEffortShare(data);

      const message =
        result.shareState === 'share_sheet_opened'
          ? `JSON 文件已导出到应用文档目录，并已拉起系统分享面板。\n\n文件名：${result.fileName}\n路径：${result.fileUri}\n\n是否真正发送成功，取决于您在分享面板中的后续操作。`
          : `JSON 文件已导出到应用文档目录，但当前未能拉起可用的分享面板。\n\n文件名：${result.fileName}\n路径：${result.fileUri}\n\n请稍后从系统文件管理器中继续分享该文件。`;

      Alert.alert('导出数据', message, [{ text: '确定', onPress: () => {} }]);
    } catch (error) {
      Alert.alert('导出失败', `无法导出数据：${(error as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * 清除历史记录
   */
  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await clearHistory();
      setShowClearDialog(false);
      Alert.alert('成功', '历史记录已清除');
    } catch (error) {
      Alert.alert('清除失败', `无法清除历史记录：${(error as Error).message}`);
    } finally {
      setIsClearing(false);
    }
  };

  /**
   * 重置所有设置
   */
  const handleResetSettings = async () => {
    try {
      resetSettings();
      await personalizationManager.resetOnlineLearningConfig();

      const learningConfig = personalizationManager.getOnlineLearningConfig();
      setOnlineLearningEnabled(learningConfig.enabled);
      setLearningHalfLifeDays(learningConfig.halfLifeDays);

      setShowResetDialog(false);
      Alert.alert('成功', '设置已重置为默认值');
    } catch (error) {
      Alert.alert('重置失败', `无法重置设置：${(error as Error).message}`);
    }
  };

  /**
   * 打开隐私政策
   */
  const openPrivacyPolicy = () => {
    Alert.alert('隐私政策', PRIVACY_POLICY_TEXT, [
      { text: '关闭', style: 'cancel' },
      { text: '权限说明', onPress: () => navigation.navigate('PermissionGuide') },
    ]);
  };

  /**
   * 开源源代码仓库
   */
  const openGitHubRepo = () => {
    Linking.openURL(SCENELENS_REPO_URL).catch(() => {
      Alert.alert('错误', '无法打开链接');
    });
  };

  /**
   * 发送反馈
   */
  const sendFeedback = () => {
    Linking.openURL(buildFeedbackIssueUrl()).catch(() => {
      Alert.alert('错误', '无法打开反馈页面');
    });
  };

  const notificationStyleOptions: RadioOption<NotificationStyle>[] = [
    {
      label: '基本样式',
      value: 'basic',
      description: '仅显示场景名称和基本操作',
    },
    {
      label: '详细样式',
      value: 'detailed',
      description: '显示场景详情、置信度和完整操作',
    },
  ];

  const intervalOptions: RadioOption<DetectionInterval>[] = [
    { label: '5 分钟', value: 5, description: '更频繁的检测，可能增加耗电' },
    { label: '10 分钟', value: 10, description: '平衡的检测频率' },
    { label: '15 分钟', value: 15, description: '较少的检测，更省电' },
  ];

  const halfLifeOptions: RadioOption<number>[] = [
    { label: '7 天', value: 7, description: '快速适应最近偏好变化' },
    { label: '14 天', value: 14, description: '平衡稳定性与适应性' },
    { label: '30 天', value: 30, description: '更稳定，减少短期波动影响' },
  ];

  const backgroundRuntimeSummary = getBackgroundRuntimeSummary(
    settings.autoDetectionEnabled,
    backgroundRuntimeStatus
  );
  const backgroundLastLocation = backgroundRuntimeStatus?.lastLocation ?? null;
  const backgroundRuntimeTelemetry: RuntimeTelemetry | null = backgroundRuntimeStatus?.telemetry ?? null;
  const backgroundRecoveryNeedsRepair = shouldShowBackgroundRuntimeAlert(
    settings.autoDetectionEnabled,
    backgroundRuntimeStatus
  );
  const backgroundRuntimeAlertTitle =
    backgroundRuntimeRepairPlan?.title ?? 'Recovery queue is not armed';
  const backgroundRuntimeAlertBody =
    backgroundRuntimeRepairPlan?.body
    ?? 'Background recovery is enabled, but neither the immediate nor periodic WorkManager job is active.';
  const backgroundRuntimeAlertButtonLabel =
    backgroundRuntimeRepairPlan?.buttonLabel ?? 'Re-arm recovery';

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 场景与自动化 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>场景与自动化</List.Subheader>

        <List.Item
          title="场景配置"
          description="配置各场景的首选应用和触发条件"
          left={(props) => <List.Icon {...props} icon="cog-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('SceneConfig')}
        />

        <Divider />

        <List.Item
          title="自动化规则"
          description="创建和管理场景触发的自动化规则"
          left={(props) => <List.Icon {...props} icon="robot" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('RuleEditor')}
        />

        <Divider />

        <List.Item
          title="位置配置"
          description="设置家、公司等常用位置的地理围栏"
          left={(props) => <List.Icon {...props} icon="map-marker" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('LocationConfig')}
        />

        <Divider />

        <List.Item
          title="会议场景配置"
          description="配置日历集成和会议检测规则"
          left={(props) => <List.Icon {...props} icon="calendar-clock" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('MeetingConfig')}
        />

        <Divider />

        <List.Item
          title="权限管理"
          description="管理应用所需的各项系统权限"
          left={(props) => <List.Icon {...props} icon="shield-check" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('Permissions')}
        />
      </Card>

      {/* 外观设置 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>外观设置</List.Subheader>

        <List.Item
          title="深色模式"
          description={settings.darkMode ? '已开启' : '已关闭'}
          left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
          right={() => <Switch value={settings.darkMode} onValueChange={toggleDarkMode} />}
        />

        <Divider />

        <View style={styles.colorPickerSection}>
          <View style={styles.colorPickerHeader}>
            <List.Icon icon="palette" />
            <Text style={[styles.colorPickerTitle, { color: theme.colors.onSurface }]}>
              主题颜色
            </Text>
          </View>
          <ColorPicker selectedColor={settings.themeColor} onSelectColor={setThemeColor} />
        </View>
      </Card>

      {/* 通知设置 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>通知设置</List.Subheader>

        <List.Item
          title="场景通知"
          description="检测到新场景时发送通知"
          left={(props) => <List.Icon {...props} icon="bell" />}
          right={() => (
            <Switch
              value={settings.sceneNotificationsEnabled}
              onValueChange={toggleSceneNotifications}
            />
          )}
        />

        {settings.sceneNotificationsEnabled && (
          <View>
            <Divider />
            <View style={styles.sectionContent}>
              <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                通知样式
              </Text>
              <RadioGroup
                options={notificationStyleOptions}
                value={settings.notificationStyle}
                onChange={setNotificationStyle}
              />
            </View>
          </View>
        )}
        
        <Divider />
        
        <List.Item
          title="智能通知过滤"
          description="根据场景自动过滤不重要的通知"
          left={(props) => <List.Icon {...props} icon="filter" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('NotificationFilter')}
        />
      </Card>

      {/* 高级设置 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>高级设置</List.Subheader>

        <List.Item
          title="自动检测"
          description="定期自动检测场景变化"
          left={(props) => <List.Icon {...props} icon="radar" />}
          right={() => (
            <Switch
              value={settings.autoDetectionEnabled}
              onValueChange={toggleAutoDetection}
            />
          )}
        />

        {settings.autoDetectionEnabled && (
          <View>
            <Divider />
            <View style={styles.sectionContent}>
              <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                检测间隔
              </Text>
              <RadioGroup
                options={intervalOptions}
                value={settings.detectionInterval}
                onChange={setDetectionInterval}
              />
            </View>
          </View>
        )}

        <Divider />

        <View style={styles.sectionContent}>
          <View style={styles.runtimeHeader}>
            <View style={styles.runtimeHeaderText}>
              <Text style={[styles.runtimeTitle, { color: theme.colors.onSurface }]}>
                Native Background Runtime
              </Text>
              <Text style={[styles.runtimeSummary, { color: theme.colors.onSurfaceVariant }]}>
                {backgroundRuntimeSummary}
              </Text>
            </View>
            <Button
              mode="text"
              compact
              onPress={loadBackgroundRuntimeStatus}
              loading={backgroundRuntimeLoading}
              disabled={backgroundRuntimeLoading}
            >
              Refresh
            </Button>
          </View>

          {backgroundRecoveryNeedsRepair && (
            <View
              style={[
                styles.runtimeAlert,
                {
                  backgroundColor: theme.dark ? 'rgba(255, 179, 71, 0.14)' : '#FFF4E5',
                  borderColor: theme.dark ? 'rgba(255, 179, 71, 0.4)' : '#F5C26B',
                },
              ]}
            >
              <View style={styles.runtimeAlertText}>
                <Text style={[styles.runtimeAlertTitle, { color: theme.colors.onSurface }]}>
                  {backgroundRuntimeAlertTitle}
                </Text>
                <Text style={[styles.runtimeAlertBody, { color: theme.colors.onSurfaceVariant }]}>
                  {backgroundRuntimeAlertBody}
                </Text>
              </View>
              <Button
                mode="contained-tonal"
                compact
                onPress={handleRepairBackgroundRecovery}
                loading={backgroundRuntimeRepairing}
                disabled={backgroundRuntimeRepairing || backgroundRuntimeLoading}
              >
                {backgroundRuntimeAlertButtonLabel}
              </Button>
            </View>
          )}

          <View
            style={[
              styles.runtimePanel,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Foreground service
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {backgroundRuntimeStatus?.running ? 'running' : 'stopped'}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Poll interval
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatRuntimeInterval(backgroundRuntimeStatus?.intervalMs ?? 0)}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Recovery worker
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {backgroundRuntimeStatus?.recoveryEnabled
                  ? `enabled / ${formatRuntimeInterval(backgroundRuntimeStatus.recoveryIntervalMs)}`
                  : 'disabled'}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Execution policy
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatRuntimeExecutionPolicy(backgroundRuntimeStatus?.executionPolicy)}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Last background fix
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {backgroundLastLocation
                  ? `${backgroundLastLocation.source ?? backgroundLastLocation.provider ?? 'unknown'} / ${formatRuntimeLocationAge(backgroundLastLocation)}${backgroundLastLocation.isStale ? ' / stale' : ''}`
                  : 'none'}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Accuracy
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {backgroundLastLocation
                  ? `${Math.round(backgroundLastLocation.accuracy)}m`
                  : 'n/a'}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Last start
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatRuntimeEvent(
                  backgroundRuntimeTelemetry?.lastStartAt,
                  backgroundRuntimeTelemetry?.lastStartReason
                )}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Last stop
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatRuntimeEvent(
                  backgroundRuntimeTelemetry?.lastStopAt,
                  backgroundRuntimeTelemetry?.lastStopReason
                )}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Last recovery trigger
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatRuntimeEvent(
                  backgroundRuntimeTelemetry?.lastRecoveryAt,
                  backgroundRuntimeTelemetry?.lastRecoveryReason
                )}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Last recovery schedule
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatRuntimeEvent(
                  backgroundRuntimeTelemetry?.lastRecoveryScheduleAt,
                  backgroundRuntimeTelemetry?.nextRecoveryKind
                )}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Next recovery due
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatRecoveryDue(
                  backgroundRuntimeTelemetry?.nextRecoveryDueAt,
                  backgroundRuntimeTelemetry?.nextRecoveryKind
                )}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Immediate work
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatWorkManagerState(
                  backgroundRuntimeTelemetry?.immediateWorkerState,
                  backgroundRuntimeTelemetry?.immediateWorkerRunAttemptCount
                )}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Periodic work
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatWorkManagerState(
                  backgroundRuntimeTelemetry?.periodicWorkerState,
                  backgroundRuntimeTelemetry?.periodicWorkerRunAttemptCount
                )}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Last worker run
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatRuntimeEvent(
                  backgroundRuntimeTelemetry?.lastWorkerRunAt,
                  backgroundRuntimeTelemetry?.lastWorkerOutcome,
                  backgroundRuntimeTelemetry?.lastWorkerDetail
                )}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Last failure
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatRuntimeEvent(
                  backgroundRuntimeTelemetry?.lastFailureAt,
                  backgroundRuntimeTelemetry?.lastFailureReason
                )}
              </Text>
            </View>

            <View style={styles.runtimeRow}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Last policy blocker
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {formatRuntimeEvent(
                  backgroundRuntimeTelemetry?.lastPolicyBlockerAt,
                  backgroundRuntimeTelemetry?.lastPolicyBlockerReason
                    ? formatPolicyBlockerReason(backgroundRuntimeTelemetry.lastPolicyBlockerReason)
                    : null
                )}
              </Text>
            </View>

            <View style={[styles.runtimeRow, styles.runtimeRowLast]}>
              <Text style={[styles.runtimeKey, { color: theme.colors.onSurfaceVariant }]}>
                Auto restarts
              </Text>
              <Text style={[styles.runtimeValue, { color: theme.colors.onSurface }]}>
                {backgroundRuntimeTelemetry?.restartCount ?? 0}
              </Text>
            </View>
          </View>
        </View>

        <Divider />

        <ConfidenceSlider
          value={settings.confidenceThreshold}
          onChange={setConfidenceThreshold}
        />

        <Divider />

        <List.Item
          title="在线学习"
          description="根据动作执行结果自动优化建议排序"
          left={(props) => <List.Icon {...props} icon="brain" />}
          right={() => (
            <Switch
              value={onlineLearningEnabled}
              onValueChange={handleToggleOnlineLearning}
            />
          )}
        />

        {onlineLearningEnabled && (
          <View>
            <Divider />
            <View style={styles.sectionContent}>
              <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                学习半衰期
              </Text>
              <RadioGroup
                options={halfLifeOptions}
                value={learningHalfLifeDays}
                onChange={handleHalfLifeChange}
              />
            </View>
          </View>
        )}
      </Card>

      {/* 数据设置 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>数据设置</List.Subheader>

        <List.Item
          title="导出数据"
          description="导出到应用文档目录，并尝试拉起系统分享"
          left={(props) => <List.Icon {...props} icon="download" />}
          onPress={handleExportData}
          disabled={isExporting}
        />

        <Divider />

        <List.Item
          title="清除历史"
          description="删除所有场景历史记录"
          left={(props) => <List.Icon {...props} icon="delete-sweep" />}
          onPress={() => setShowClearDialog(true)}
          disabled={isClearing}
        />

        <Divider />

        <List.Item
          title="清空在线学习数据"
          description="重置动作排序学习统计"
          left={(props) => <List.Icon {...props} icon="brain" />}
          onPress={() => setShowClearLearningDialog(true)}
          disabled={isClearingLearning}
        />

        <Divider />

        <List.Item
          title="重置设置"
          description="恢复所有设置为默认值"
          left={(props) => <List.Icon {...props} icon="restore" />}
          onPress={() => setShowResetDialog(true)}
          style={styles.dangerItem}
        />
      </Card>

      {/* 关于 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>关于</List.Subheader>

        <List.Item
          title="版本"
          description={APP_VERSION}
          left={(props) => <List.Icon {...props} icon="information" />}
        />

        <Divider />

        <List.Item
          title="隐私政策"
          description="查看本地处理、权限用途与数据清理方式"
          left={(props) => <List.Icon {...props} icon="shield-account" />}
          onPress={openPrivacyPolicy}
        />

        <Divider />

        <List.Item
          title="源代码"
          description="在 GitHub 上查看 Naloam/SceneLens"
          left={(props) => <List.Icon {...props} icon="github" />}
          onPress={openGitHubRepo}
        />

        <Divider />

        <List.Item
          title="发送反馈"
          description="通过 GitHub Issues 提交问题，并预填版本信息"
          left={(props) => <List.Icon {...props} icon="message-draw" />}
          onPress={sendFeedback}
        />
      </Card>

      {/* 确认重置对话框 */}
      <Portal>
        <Dialog visible={showResetDialog} onDismiss={() => setShowResetDialog(false)}>
          <Dialog.Title>重置设置</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurface }}>
              确定要将所有设置恢复为默认值吗？此操作无法撤销。
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowResetDialog(false)}>取消</Button>
            <Button onPress={handleResetSettings} mode="contained">
              确认重置
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 确认清除历史对话框 */}
      <Portal>
        <Dialog visible={showClearDialog} onDismiss={() => setShowClearDialog(false)}>
          <Dialog.Title>清除历史</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurface }}>
              确定要删除所有场景历史记录吗？此操作无法撤销。
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowClearDialog(false)}>取消</Button>
            <Button onPress={handleClearHistory} mode="contained" buttonColor="#FF3B30">
              确认清除
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={showClearLearningDialog} onDismiss={() => setShowClearLearningDialog(false)}>
          <Dialog.Title>清空在线学习数据</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurface }}>
              确定要清空在线学习统计吗？清空后将恢复默认动作排序。
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowClearLearningDialog(false)}>取消</Button>
            <Button onPress={handleClearLearningData} mode="contained" buttonColor="#FF3B30">
              确认清空
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
          SceneLens - 智能场景感知助手
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    paddingLeft: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  colorPickerSection: {
    padding: 16,
  },
  colorPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  colorPickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  colorDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#007AFF',
  },
  colorDotCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  sectionContent: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  radioGroup: {
    marginTop: 8,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  radioDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  sliderSection: {
    padding: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sliderTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  sliderDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  sliderValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sliderButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sliderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sliderButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  runtimeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  runtimeHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  runtimeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  runtimeSummary: {
    fontSize: 13,
    lineHeight: 18,
  },
  runtimeAlert: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  runtimeAlertText: {
    marginBottom: 10,
  },
  runtimeAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  runtimeAlertBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  runtimePanel: {
    borderRadius: 12,
    padding: 12,
  },
  runtimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  runtimeRowLast: {
    marginBottom: 0,
  },
  runtimeKey: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingRight: 12,
  },
  runtimeValue: {
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
  },
  dangerItem: {
    backgroundColor: '#FFF5F5',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
