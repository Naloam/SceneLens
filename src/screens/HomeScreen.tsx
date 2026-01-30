/**
 * HomeScreen - 主屏幕重构版本
 * 使用 React Native Paper 和 Material Design 3 规范
 * 使用自定义 Hooks 和子组件实现关注点分离
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Button,
  Dialog,
  Portal,
} from 'react-native-paper';
import { useSceneStore } from '../stores';
import { useShallow } from 'zustand/react/shallow';
import { sceneSuggestionManager } from '../services/SceneSuggestionManager';
import { predictiveTrigger } from '../core/PredictiveTrigger';
import { feedbackProcessor } from '../learning/FeedbackProcessor';
import { spacing } from '../theme/spacing';
import SceneSuggestionCard from '../components/ui/SceneSuggestionCard';
import { QuickActionsPanel } from '../components/quickactions/QuickActionsPanel';

// Hooks
import {
  useSceneDetection,
  useUserTriggeredAnalysis,
  useLocation,
  useDiagnostics,
} from '../hooks';

// 子组件
import {
  LocationCard,
  UserTriggeredCard,
  MainSceneCard,
  HistoryCard,
  SuggestionDialog,
  SceneSelector,
  PredictionCard,
  FeedbackReportCard,
} from '../components/home';

import type { SceneSuggestionPackage, SuggestionExecutionResult, SceneHistory, TriggeredContext, SceneType } from '../types';

export const HomeScreen: React.FC = () => {
  // ============ Hooks ============
  // 使用 useShallow 避免选择器返回新对象导致的无限循环
  const { getRecentHistory, addToHistory, setManualScene, isManualMode } = useSceneStore(
    useShallow(state => ({
      getRecentHistory: state.getRecentHistory,
      addToHistory: state.addToHistory,
      setManualScene: state.setManualScene,
      isManualMode: state.isManualMode,
    }))
  );

  // 场景检测
  const {
    isDetecting,
    detectionError,
    currentContext,
    sceneSuggestion,
    loadingSuggestion,
    detectScene,
    loadSceneSuggestion,
    executeSuggestion,
  } = useSceneDetection();

  // 用户触发分析
  const {
    isAnalyzing,
    triggeredResult,
    volumeKeyEnabled,
    shortcutEnabled,
    analyze: handleUserTriggeredAnalysis,
    toggleVolumeKeyListener,
    toggleDesktopShortcut,
    handleFeedback,
  } = useUserTriggeredAnalysis();

  // 位置管理
  const {
    currentLocation,
    isRefreshingLocation,
    getCurrentLocation,
    refreshLocation,
  } = useLocation();

  // 诊断工具
  const { diagnosing, runDiagnostics } = useDiagnostics();

  // ============ 本地状态 ============
  const [refreshing, setRefreshing] = useState(false);
  const [detailDialogVisible, setDetailDialogVisible] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<SceneHistory | null>(null);

  // 建议弹窗状态
  const [suggestionDialogVisible, setSuggestionDialogVisible] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<SceneSuggestionPackage | null>(null);
  const [executingSuggestion, setExecutingSuggestion] = useState(false);

  // 场景选择器状态
  const [sceneSelectorVisible, setSceneSelectorVisible] = useState(false);

  // ============ 初始化 ============
  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    await getCurrentLocation();
    await detectScene();
  };

  /**
   * 监听场景变化，自动加载新建议
   * 当手动切换场景时，需要清除旧建议并加载新建议
   */
  useEffect(() => {
    if (currentContext) {
      // 延迟一小段时间以确保 store 更新完成
      const timer = setTimeout(() => {
        loadSceneSuggestion(currentContext);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentContext, loadSceneSuggestion]);

  // ============ 事件处理 ============
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await detectScene();
    setRefreshing(false);
  }, [detectScene]);

  const showHistoryDetail = useCallback((item: SceneHistory) => {
    setSelectedHistoryItem(item);
    setDetailDialogVisible(true);
  }, []);

  /**
   * 执行场景建议
   */
  const executeSceneSuggestions = useCallback(async () => {
    if (!currentContext) {
      Alert.alert('提示', '请先进行场景检测');
      return;
    }

    // 使用已加载的场景建议包
    let suggestion = sceneSuggestion;
    if (!suggestion) {
      try {
        suggestion = await sceneSuggestionManager.getSuggestionByContext(currentContext, {
          includeSystemAdjustments: true,
          includeAppLaunches: true,
          includeFallbackNotes: true,
          minConfidence: 0.3,
        });
      } catch (error) {
        console.warn('[HomeScreen] Failed to load scene suggestion:', error);
        Alert.alert('提示', '加载建议失败，请重试');
        return;
      }
    }

    if (!suggestion) {
      Alert.alert('提示', `当前场景(${currentContext.context})暂无可用建议`);
      return;
    }

    setPendingSuggestion(suggestion);
    setSuggestionDialogVisible(true);
  }, [currentContext, sceneSuggestion]);

  /**
   * 确认执行建议
   */
  const confirmExecuteSuggestion = useCallback(async () => {
    if (!pendingSuggestion) return;

    setExecutingSuggestion(true);

    try {
      const result = await sceneSuggestionManager.executeSuggestion(
        pendingSuggestion.sceneId,
        'execute',
        {
          showProgress: true,
          autoFallback: true,
        }
      );

      setSuggestionDialogVisible(false);
      setPendingSuggestion(null);

      handleSuggestionExecutionComplete(result);
    } catch (error) {
      console.error('[HomeScreen] Execute suggestion failed:', error);
      Alert.alert(
        '执行失败',
        `执行建议时出错: ${(error as Error).message}`,
        [{ text: '确定' }]
      );
    } finally {
      setExecutingSuggestion(false);
    }
  }, [pendingSuggestion]);

  /**
   * 取消执行建议
   */
  const cancelExecuteSuggestion = useCallback(() => {
    setSuggestionDialogVisible(false);
    setPendingSuggestion(null);

    if (currentContext) {
      addToHistory({
        sceneType: currentContext.context,
        timestamp: Date.now(),
        confidence: currentContext.confidence,
        triggered: true,
        userAction: 'cancel',
      });
    }
  }, [currentContext, addToHistory]);

  /**
   * 处理场景建议包执行完成
   */
  const handleSuggestionExecutionComplete = useCallback((result: SuggestionExecutionResult) => {
    console.log('[HomeScreen] Suggestion execution complete:', result);

    addToHistory({
      sceneType: result.sceneId,
      timestamp: Date.now(),
      confidence: currentContext?.confidence ?? 0.7,
      triggered: true,
      userAction: result.success ? 'accept' : 'cancel',
    });

    predictiveTrigger.recordFeedback(result.sceneId, result.success ? 'accept' : 'cancel');
    
    // 记录到反馈处理器（Phase 3）
    feedbackProcessor.recordFeedback(
      {
        id: result.sceneId,
        type: 'SCENE_ACTION',
        scene: (result.sceneId as SceneType) || 'UNKNOWN',
        title: '场景建议',
        content: `执行 ${result.executedActions.length} 项操作`,
        confidence: currentContext?.confidence ?? 0.7,
      },
      result.success ? 'ACCEPT' : 'IGNORE'
    );

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
  }, [currentContext, addToHistory]);

  /**
   * 处理用户触发结果接受
   */
  const handleAcceptResult = useCallback((result: TriggeredContext) => {
    handleFeedback(result, 'accept');
  }, [handleFeedback]);

  /**
   * 手动选择场景
   */
  const handleSceneSelect = useCallback((sceneType: SceneType) => {
    // 清除旧的建议
    setPendingSuggestion(null);
    setSuggestionDialogVisible(false);
    
    // 设置新的手动场景，这会触发 currentContext 变化
    setManualScene(sceneType);
    
    // 记录到历史
    addToHistory({
      sceneType,
      timestamp: Date.now(),
      confidence: 1.0,
      triggered: true,
      userAction: 'accept',
    });
    
    // 关闭选择器
    setSceneSelectorVisible(false);
  }, [setManualScene, addToHistory]);

  const recentHistory = getRecentHistory(5);

  // ============ 渲染 ============
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
      <LocationCard
        currentLocation={currentLocation}
        isRefreshingLocation={isRefreshingLocation}
        onRefresh={refreshLocation}
      />

      {/* 用户触发识别卡片 */}
      <UserTriggeredCard
        isAnalyzing={isAnalyzing}
        triggeredResult={triggeredResult}
        volumeKeyEnabled={volumeKeyEnabled}
        shortcutEnabled={shortcutEnabled}
        onAnalyze={handleUserTriggeredAnalysis}
        onToggleVolumeKey={toggleVolumeKeyListener}
        onToggleShortcut={toggleDesktopShortcut}
        onAcceptResult={handleAcceptResult}
      />

      {/* 主场景卡片 */}
      <MainSceneCard
        currentContext={currentContext}
        isDetecting={isDetecting}
        detectionError={detectionError}
        isManualMode={isManualMode}
        onDetect={detectScene}
        onExecuteSuggestions={executeSceneSuggestions}
        onSwitchScene={() => setSceneSelectorVisible(true)}
      />

      {/* 智能预测卡片（Phase 3） */}
      <PredictionCard
        currentScene={currentContext?.context || 'UNKNOWN'}
        onPredictionTap={(prediction) => {
          console.log('[HomeScreen] Prediction tapped:', prediction);
        }}
        onDepartureReminderTap={(reminder) => {
          console.log('[HomeScreen] Departure reminder tapped:', reminder);
          Alert.alert('出发提醒', reminder.message);
        }}
      />

      {/* 场景执行建议包卡片 */}
      {sceneSuggestion && (
        <SceneSuggestionCard
          scenePackage={sceneSuggestion}
          confidence={currentContext?.confidence}
          onExecutionComplete={handleSuggestionExecutionComplete}
        />
      )}

      {/* 快捷操作面板 */}
      <QuickActionsPanel
        currentScene={currentContext?.context || 'UNKNOWN'}
        maxActions={6}
        layout="grid"
        showTitle={true}
        title="快捷操作"
        onActionExecuted={(action, success) => {
          console.log('[HomeScreen] Quick action executed:', action.id, success);
        }}
      />

      {/* 场景历史列表 */}
      <HistoryCard
        history={recentHistory}
        onShowDetail={showHistoryDetail}
      />

      {/* 学习报告卡片（Phase 3） */}
      <FeedbackReportCard
        onViewDetails={() => {
          console.log('[HomeScreen] View feedback report details');
        }}
      />

      {/* 建议弹窗 */}
      <SuggestionDialog
        visible={suggestionDialogVisible}
        suggestion={pendingSuggestion}
        triggeredResult={triggeredResult}
        executing={executingSuggestion}
        onConfirm={confirmExecuteSuggestion}
        onCancel={cancelExecuteSuggestion}
      />

      {/* 场景选择器 */}
      <SceneSelector
        visible={sceneSelectorVisible}
        currentScene={currentContext?.context || null}
        onSelect={handleSceneSelect}
        onDismiss={() => setSceneSelectorVisible(false)}
      />

      {/* 历史详情弹窗 */}
      <Portal>
        <Dialog
          visible={detailDialogVisible}
          onDismiss={() => setDetailDialogVisible(false)}
        >
          <Dialog.Title>场景详情</Dialog.Title>
          <Dialog.Content>
            {selectedHistoryItem && (
              <View>
                <Text variant="bodyMedium">
                  场景类型: {selectedHistoryItem.sceneType}
                </Text>
                <Text variant="bodyMedium">
                  置信度: {(selectedHistoryItem.confidence * 100).toFixed(0)}%
                </Text>
                <Text variant="bodyMedium">
                  时间: {new Date(selectedHistoryItem.timestamp).toLocaleString('zh-CN')}
                </Text>
                <Text variant="bodyMedium">
                  触发方式: {selectedHistoryItem.triggered ? '手动' : '自动'}
                </Text>
                {selectedHistoryItem.userAction && (
                  <Text variant="bodyMedium">
                    用户操作: {selectedHistoryItem.userAction}
                  </Text>
                )}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDetailDialogVisible(false)}>关闭</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
});

export default HomeScreen;
