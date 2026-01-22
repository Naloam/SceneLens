/**
 * HomeScreen - 主屏幕重构版本
 * 使用 React Native Paper 和 Material Design 3 规范
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  IconButton,
  ActivityIndicator,
  Surface,
  Divider,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useSceneStore } from '../stores';
import { silentContextEngine } from '../sensors';
import { notificationManager } from '../notifications';
import { runDiagnostics as runDiagnosticsUtil, formatDiagnosticsReport } from '../utils/diagnostics';
import { ruleEngine, SceneExecutor } from '../rules';
import { SceneBadge, ConfidenceBar, SignalChip } from '../components/ui';
import SceneSuggestionCard from '../components/ui/SceneSuggestionCard';
import { sceneSuggestionManager } from '../services/SceneSuggestionManager';
import { getSceneColor, getSceneContainerColor } from '../theme/colors';
import { spacing } from '../theme/spacing';
import sceneBridge from '../core/SceneBridge';
import type { SilentContext, Location, SceneSuggestionPackage, SuggestionExecutionResult } from '../types';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * 场景图标映射
 */
const sceneIcons: Record<string, string> = {
  COMMUTE: '🚇',
  OFFICE: '🏢',
  HOME: '🏠',
  STUDY: '📚',
  SLEEP: '😴',
  TRAVEL: '✈️',
  UNKNOWN: '❓',
};

/**
 * 场景描述映射
 */
const sceneDescriptions: Record<string, string> = {
  COMMUTE: '检测到你在通勤路上',
  OFFICE: '检测到你在办公环境',
  HOME: '检测到你在家里',
  STUDY: '检测到学习氛围',
  SLEEP: '检测到睡眠场景',
  TRAVEL: '检测到旅行场景',
  UNKNOWN: '场景识别中...',
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const {
    currentContext,
    isDetecting,
    detectionError,
    history,
    setCurrentContext,
    setIsDetecting,
    setDetectionError,
    addToHistory,
    getRecentHistory,
  } = useSceneStore();

  const [refreshing, setRefreshing] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [detailDialogVisible, setDetailDialogVisible] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [sceneSuggestion, setSceneSuggestion] = useState<SceneSuggestionPackage | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    await initializeNotifications();
    await initializeRuleEngine();
    await initializeSceneSuggestionManager();
    await getCurrentLocation();
    await detectScene();
  };

  const initializeNotifications = async () => {
    const success = await notificationManager.initialize();
    if (!success) {
      console.warn('[HomeScreen] Failed to initialize notifications');
    }
  };

  const initializeSceneSuggestionManager = async () => {
    try {
      await sceneSuggestionManager.initialize();
      console.log('[HomeScreen] SceneSuggestionManager initialized');
    } catch (error) {
      console.warn('[HomeScreen] Failed to initialize SceneSuggestionManager:', error);
    }
  };

  const initializeRuleEngine = async () => {
    try {
      await ruleEngine.loadRules();
      console.log('[HomeScreen] Rule engine initialized with', ruleEngine.getRules().length, 'rules');
    } catch (error) {
      console.error('[HomeScreen] Failed to initialize rule engine:', error);
    }
  };

  const detectScene = async () => {
    setIsDetecting(true);
    setDetectionError(null);
    setSceneSuggestion(null);

    try {
      const context = await silentContextEngine.getContext();
      setCurrentContext(context);

      // Add to history
      addToHistory({
        sceneType: context.context,
        timestamp: Date.now(),
        confidence: context.confidence,
        triggered: false,
        userAction: null,
      });

      // 获取场景建议包
      await loadSceneSuggestion(context);

      // 执行场景动作
      await executeSceneActions(context);

      // Show notification if confidence is high enough
      if (context.confidence > 0.5) {
        await showSceneSuggestion(context);
      }
    } catch (error) {
      console.error('[HomeScreen] Scene detection error:', error);
      setDetectionError((error as Error).message);
    } finally {
      setIsDetecting(false);
    }
  };

  /**
   * 加载场景建议包
   */
  const loadSceneSuggestion = async (context: SilentContext) => {
    setLoadingSuggestion(true);
    try {
      const suggestion = await sceneSuggestionManager.getSuggestionByContext(context, {
        includeSystemAdjustments: true,
        includeAppLaunches: true,
        includeFallbackNotes: false,
        minConfidence: 0.3,
      });
      setSceneSuggestion(suggestion);
      console.log('[HomeScreen] Loaded scene suggestion:', suggestion?.sceneId);
    } catch (error) {
      console.warn('[HomeScreen] Failed to load scene suggestion:', error);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const executeSceneActions = async (context: SilentContext) => {
    try {
      const matchedRules = await ruleEngine.matchRules(context);

      if (matchedRules.length === 0) {
        console.log('[HomeScreen] No rules matched for context:', context.context);
        return;
      }

      console.log('[HomeScreen] Matched', matchedRules.length, 'rule(s)');

      const bestRule = matchedRules[0];
      console.log('[HomeScreen] Executing rule:', bestRule.rule.id, 'score:', bestRule.score);

      const executor = new SceneExecutor();
      const results = await executor.execute(bestRule.rule.actions);

      const successCount = results.filter(r => r.success).length;
      console.log('[HomeScreen] Execution results:', successCount, '/', results.length, 'actions succeeded');

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.warn('[HomeScreen] Failed actions:', failures);
      }
    } catch (error) {
      console.error('[HomeScreen] Error executing scene actions:', error);
    }
  };

  const showSceneSuggestion = async (context: SilentContext) => {
    const sceneNames: Record<string, string> = {
      COMMUTE: '通勤模式',
      OFFICE: '办公模式',
      HOME: '到家模式',
      STUDY: '学习模式',
      SLEEP: '睡前模式',
      TRAVEL: '出行模式',
      UNKNOWN: '未知场景',
    };

    await notificationManager.showSceneSuggestion({
      sceneType: context.context,
      title: `检测到${sceneNames[context.context]}`,
      body: `置信度: ${(context.confidence * 100).toFixed(0)}%`,
      actions: [],
      confidence: context.confidence,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await detectScene();
    setRefreshing(false);
  };

  const runDiagnostics = async () => {
    setDiagnosing(true);
    try {
      const report = await runDiagnosticsUtil();
      const message = formatDiagnosticsReport(report);
      Alert.alert('诊断报告', message, [{ text: '确定' }]);
    } catch (error) {
      Alert.alert('诊断失败', `运行诊断时出错: ${(error as Error).message}`);
    } finally {
      setDiagnosing(false);
    }
  };

  const showHistoryDetail = (item: any) => {
    setSelectedHistoryItem(item);
    setDetailDialogVisible(true);
  };

  /**
   * 获取当前位置
   */
  const getCurrentLocation = async () => {
    try {
      const location = await sceneBridge.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.warn('获取当前位置失败:', error);
    }
  };

  /**
   * 刷新位置
   */
  const refreshLocation = async () => {
    setIsRefreshingLocation(true);
    try {
      const location = await sceneBridge.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.warn('刷新位置失败:', error);
    } finally {
      setIsRefreshingLocation(false);
    }
  };

  /**
   * 执行场景建议
   * 根据当前场景匹配规则并执行相应动作
   */
  const executeSceneSuggestions = async () => {
    if (!currentContext) {
      Alert.alert('提示', '请先进行场景检测');
      return;
    }

    try {
      // 匹配规则
      const matchedRules = await ruleEngine.matchRules(currentContext);

      if (matchedRules.length === 0) {
        Alert.alert('提示', `当前场景(${currentContext.context})暂无可用建议`);
        return;
      }

      const bestRule = matchedRules[0];
      console.log('[HomeScreen] Executing suggestions:', bestRule.rule.id, 'score:', bestRule.score);

      // 执行动作
      const executor = new SceneExecutor();
      await executor.initialize();

      const results = await executor.execute(bestRule.rule.actions);

      // 统计执行结果
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (failCount === 0) {
        Alert.alert(
          '执行成功',
          `已完成 ${successCount} 项建议操作`,
          [{ text: '确定' }]
        );
      } else {
        Alert.alert(
          '部分完成',
          `成功 ${successCount} 项，失败 ${failCount} 项`,
          [{ text: '确定' }]
        );
      }

      // 记录到历史
      addToHistory({
        sceneType: currentContext.context,
        timestamp: Date.now(),
        confidence: currentContext.confidence,
        triggered: true,
        userAction: 'accept',
      });
    } catch (error) {
      console.error('[HomeScreen] Execute suggestions failed:', error);
      Alert.alert(
        '执行失败',
        `执行建议时出错: ${(error as Error).message}`,
        [{ text: '确定' }]
      );
    }
  };

  /**
   * 处理场景建议包执行完成
   */
  const handleSuggestionExecutionComplete = (result: SuggestionExecutionResult) => {
    console.log('[HomeScreen] Suggestion execution complete:', result);

    // 记录到历史
    addToHistory({
      sceneType: result.sceneId,
      timestamp: Date.now(),
      confidence: currentContext?.confidence ?? 0.7,
      triggered: true,
      userAction: result.success ? 'accept' : 'cancel',
    });

    // 显示执行结果提示
    const successCount = result.executedActions.filter(a => a.success).length;
    const totalCount = result.executedActions.length;

    if (result.success && result.fallbackApplied) {
      Alert.alert(
        '执行完成',
        `已完成 ${successCount} 项操作（部分功能已降级）`,
        [{ text: '确定' }]
      );
    } else if (result.success) {
      Alert.alert(
        '执行成功',
        `已完成 ${successCount} 项操作`,
        [{ text: '确定' }]
      );
    } else {
      Alert.alert(
        '执行失败',
        `${successCount}/${totalCount} 项操作成功`,
        [{ text: '确定' }]
      );
    }
  };

  const recentHistory = getRecentHistory(5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* 头部 */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          SceneLens
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          场景感知助手
        </Text>
        <Button
          mode="contained"
          onPress={runDiagnostics}
          disabled={diagnosing}
          loading={diagnosing}
          icon="magnify"
          style={styles.diagnoseButton}
          compact
        >
          诊断
        </Button>
      </View>

      {/* 当前位置卡片 */}
      <Card mode="elevated" style={styles.sceneCard}>
        <Card.Content>
          <View style={styles.cardHeaderRow}>
            <Text variant="titleLarge" style={styles.cardTitle}>
              📍 当前位置
            </Text>
            <IconButton
              icon="refresh"
              size={20}
              onPress={refreshLocation}
              disabled={isRefreshingLocation}
              style={styles.refreshIconButton}
            />
          </View>

          {currentLocation ? (
            <Surface style={styles.locationInfo} elevation={0}>
              <Text variant="bodyMedium" style={styles.locationLabel}>
                纬度: <Text style={styles.locationValue}>{currentLocation.latitude.toFixed(6)}</Text>
              </Text>
              <Text variant="bodyMedium" style={styles.locationLabel}>
                经度: <Text style={styles.locationValue}>{currentLocation.longitude.toFixed(6)}</Text>
              </Text>
              <Text variant="bodySmall" style={styles.locationAccuracy}>
                精度: ±{currentLocation.accuracy.toFixed(0)}米
              </Text>
            </Surface>
          ) : (
            <Surface style={styles.locationInfoEmpty} elevation={0}>
              <Text variant="bodyMedium" style={styles.noLocationText}>
                正在获取位置...
              </Text>
            </Surface>
          )}

          <Button
            mode="outlined"
            onPress={() => navigation.navigate('LocationConfig' as never)}
            icon="cog"
            style={styles.locationConfigButton}
          >
            位置配置
          </Button>
        </Card.Content>
      </Card>

      {/* 主场景卡片 */}
      <Card mode="elevated" style={styles.sceneCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            当前场景
          </Text>

          {isDetecting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <Text variant="bodyMedium" style={styles.loadingText}>
                正在检测场景...
              </Text>
            </View>
          ) : detectionError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>❌ {detectionError}</Text>
              <Button mode="contained" onPress={detectScene}>
                重试
              </Button>
            </View>
          ) : currentContext ? (
            <View>
              {/* 场景图标和名称 */}
              <View style={styles.sceneHeader}>
                <Surface
                  style={[
                    styles.sceneIconContainer,
                    { backgroundColor: getSceneContainerColor(currentContext.context) },
                  ]}
                  elevation={0}
                >
                  <Text style={styles.sceneIcon}>
                    {sceneIcons[currentContext.context] || sceneIcons.UNKNOWN}
                  </Text>
                </Surface>
                <View style={styles.sceneInfo}>
                  <Text variant="headlineMedium" style={styles.sceneName}>
                    {currentContext.context}
                  </Text>
                  <Text variant="bodyMedium" style={styles.sceneDescription}>
                    {sceneDescriptions[currentContext.context] || sceneDescriptions.UNKNOWN}
                  </Text>
                </View>
              </View>

              {/* 置信度进度条 */}
              <View style={styles.confidenceSection}>
                <ConfidenceBar
                  confidence={currentContext.confidence}
                  animated
                  showPercentage
                />
              </View>

              {/* 信号源芯片 */}
              <View style={styles.signalsSection}>
                <View style={styles.signalsHeader}>
                  <Text variant="titleSmall" style={styles.signalsTitle}>
                    信号源
                  </Text>
                  <Button
                    mode="text"
                    onPress={() => {
                      navigation.navigate('LocationConfig' as never);
                    }}
                    compact
                    style={styles.configButton}
                    labelStyle={styles.configButtonLabel}
                  >
                    配置位置
                  </Button>
                </View>
                <View style={styles.signalsList}>
                  {currentContext.signals.map((signal, index) => (
                    <SignalChip key={index} signal={signal} showWeight />
                  ))}
                </View>
              </View>

              {/* 操作按钮 */}
              <View style={styles.actionsSection}>
                <Button
                  mode="outlined"
                  onPress={detectScene}
                  disabled={isDetecting}
                  style={styles.actionButton}
                  icon="refresh"
                >
                  刷新场景
                </Button>
                <Button
                  mode="contained"
                  onPress={executeSceneSuggestions}
                  disabled={!currentContext}
                  style={styles.actionButton}
                  icon="play"
                >
                  执行建议
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text variant="bodyMedium">点击下方按钮开始检测场景</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 场景执行建议包卡片 */}
      {sceneSuggestion && (
        <SceneSuggestionCard
          scenePackage={sceneSuggestion}
          confidence={currentContext?.confidence}
          onExecutionComplete={handleSuggestionExecutionComplete}
        />
      )}

      {/* 场景历史列表 */}
      {recentHistory.length > 0 && (
        <Card mode="outlined" style={styles.historyCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              场景历史
            </Text>
            {recentHistory.map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <Surface
                    style={[
                      styles.historyIcon,
                      { backgroundColor: getSceneContainerColor(item.sceneType) },
                    ]}
                    elevation={0}
                  >
                    <Text style={styles.historyIconText}>
                      {sceneIcons[item.sceneType] || sceneIcons.UNKNOWN}
                    </Text>
                  </Surface>
                  <View style={styles.historyInfo}>
                    <Text variant="titleMedium">{item.sceneType}</Text>
                    <Text variant="bodySmall" style={styles.historyTime}>
                      {new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyRight}>
                  <Text
                    variant="labelLarge"
                    style={{
                      color: getSceneColor(item.sceneType),
                    }}
                  >
                    {(item.confidence * 100).toFixed(0)}%
                  </Text>
                  <IconButton
                    icon="chevron-right"
                    size={20}
                    onPress={() => showHistoryDetail(item)}
                  />
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: spacing.xs,
    color: '#666',
  },
  diagnoseButton: {
    marginTop: spacing.md,
  },
  sceneCard: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  refreshIconButton: {
    margin: 0,
  },
  locationInfo: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#E8F4FD',
    marginBottom: 16,
  },
  locationInfoEmpty: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 16,
  },
  locationLabel: {
    marginBottom: 4,
    color: '#424242',
  },
  locationValue: {
    fontWeight: '600',
    color: '#1976D2',
  },
  locationAccuracy: {
    marginTop: 8,
    opacity: 0.7,
  },
  noLocationText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  locationConfigButton: {
    borderColor: '#E0E0E0',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  errorText: {
    color: '#B3261E',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  sceneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sceneIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sceneIcon: {
    fontSize: 36,
  },
  sceneInfo: {
    flex: 1,
  },
  sceneName: {
    fontWeight: '700',
  },
  sceneDescription: {
    marginTop: spacing.xs,
    color: '#666',
  },
  confidenceSection: {
    marginBottom: spacing.lg,
  },
  signalsSection: {
    marginBottom: spacing.lg,
  },
  signalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  signalsTitle: {
    fontWeight: '600',
  },
  configButton: {
    marginLeft: -8,
  },
  configButtonLabel: {
    fontSize: 12,
    color: '#6750A4',
  },
  signalsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  historyCard: {
    marginBottom: spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  historyIconText: {
    fontSize: 20,
  },
  historyInfo: {
    flex: 1,
  },
  historyTime: {
    color: '#666',
    marginTop: 2,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default HomeScreen;
