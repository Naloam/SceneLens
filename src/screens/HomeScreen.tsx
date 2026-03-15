/**
 * HomeScreen - 主屏幕重构版本
 * 使用 React Native Paper 和 Material Design 3 规范
 * 使用自定义 Hooks 和子组件实现关注点分离
 */

// src/screens/HomeScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Text, Button, Dialog, Portal, useTheme } from 'react-native-paper';
import { useSceneStore } from '../stores';
import { useShallow } from 'zustand/react/shallow';
import { sceneSuggestionManager } from '../services/SceneSuggestionManager';
import { predictiveTrigger } from '../core/PredictiveTrigger';
import { feedbackProcessor } from '../learning/FeedbackProcessor';
import { spacing, borderRadius } from '../theme/spacing';
import SceneSuggestionCard from '../components/ui/SceneSuggestionCard';
import { QuickActionsPanel } from '../components/quickactions/QuickActionsPanel';

// Hooks (移除了 useUserTriggeredAnalysis)
import { useSceneDetection, useLocation, useDiagnostics } from '../hooks';

// 子组件 (移除了放到 DataScreen 的卡片)
import {
  LocationCard,
  MainSceneCard,
  HistoryCard,
  SuggestionDialog,
  SceneSelector,
} from '../components/home';

import type { SceneSuggestionPackage, SuggestionExecutionResult, SceneHistory, SceneType } from '../types';

export const HomeScreen: React.FC = () => {
  const theme = useTheme();

  const { getRecentHistory, addToHistory, setManualScene, isManualMode } = useSceneStore(
    useShallow(state => ({
      getRecentHistory: state.getRecentHistory,
      addToHistory: state.addToHistory,
      setManualScene: state.setManualScene,
      isManualMode: state.isManualMode,
    }))
  );

  const {
    isDetecting,
    detectionError,
    currentContext,
    sceneSuggestion,
    loadSceneSuggestion,
    detectScene,
  } = useSceneDetection();

  const { currentLocation, isRefreshingLocation, getCurrentLocation, refreshLocation } = useLocation();
  const { diagnosing, runDiagnostics } = useDiagnostics();

  const [refreshing, setRefreshing] = useState(false);
  const [detailDialogVisible, setDetailDialogVisible] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<SceneHistory | null>(null);
  const [suggestionDialogVisible, setSuggestionDialogVisible] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<SceneSuggestionPackage | null>(null);
  const [executingSuggestion, setExecutingSuggestion] = useState(false);
  const [sceneSelectorVisible, setSceneSelectorVisible] = useState(false);

  useEffect(() => {
    getCurrentLocation();
    detectScene();
  }, []);

  useEffect(() => {
    if (currentContext) {
      const timer = setTimeout(() => loadSceneSuggestion(currentContext), 300);
      return () => clearTimeout(timer);
    }
  }, [currentContext, loadSceneSuggestion]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await detectScene();
    setRefreshing(false);
  }, [detectScene]);

  const showHistoryDetail = useCallback((item: SceneHistory) => {
    setSelectedHistoryItem(item);
    setDetailDialogVisible(true);
  }, []);

  const executeSceneSuggestions = useCallback(async () => {
    if (!currentContext) {
      Alert.alert('提示', '请先进行场景检测');
      return;
    }
    let suggestion = sceneSuggestion;
    if (!suggestion) {
      try {
        suggestion = await sceneSuggestionManager.getSuggestionByContext(currentContext, {
          includeSystemAdjustments: true, includeAppLaunches: true, includeFallbackNotes: true, minConfidence: 0.3,
        });
      } catch (error) {
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

  const confirmExecuteSuggestion = useCallback(async () => {
    if (!pendingSuggestion) return;
    setExecutingSuggestion(true);
    try {
      const result = await sceneSuggestionManager.executeSuggestion(pendingSuggestion.sceneId, 'execute', { showProgress: true, autoFallback: true });
      setSuggestionDialogVisible(false);
      setPendingSuggestion(null);
      handleSuggestionExecutionComplete(result);
    } catch (error) {
      Alert.alert('执行失败', `执行出错: ${(error as Error).message}`, [{ text: '确定' }]);
    } finally {
      setExecutingSuggestion(false);
    }
  }, [pendingSuggestion]);

  const cancelExecuteSuggestion = useCallback(() => {
    setSuggestionDialogVisible(false);
    setPendingSuggestion(null);
    if (currentContext) {
      addToHistory({ sceneType: currentContext.context, timestamp: Date.now(), confidence: currentContext.confidence, triggered: true, userAction: 'cancel' });
    }
  }, [currentContext, addToHistory]);

  const handleSuggestionExecutionComplete = useCallback((result: SuggestionExecutionResult) => {
    addToHistory({ sceneType: result.sceneId, timestamp: Date.now(), confidence: currentContext?.confidence ?? 0.7, triggered: true, userAction: result.success ? 'accept' : 'cancel' });
    predictiveTrigger.recordFeedback(result.sceneId, result.success ? 'accept' : 'cancel');
    feedbackProcessor.recordFeedback({ id: result.sceneId, type: 'SCENE_ACTION', scene: (result.sceneId as SceneType) || 'UNKNOWN', title: '场景建议', content: `执行 ${result.executedActions.length} 项操作`, confidence: currentContext?.confidence ?? 0.7 }, result.success ? 'ACCEPT' : 'IGNORE');
    const successCount = result.executedActions.filter(a => a.success).length;
    if (result.success && result.fallbackApplied) Alert.alert('执行完成', `已完成 ${successCount} 项操作（部分降级）`, [{ text: '确定' }]);
    else if (result.success) Alert.alert('执行成功', `已完成 ${successCount} 项操作`, [{ text: '确定' }]);
    else Alert.alert('执行失败', `${successCount}/${result.executedActions.length} 项成功`, [{ text: '确定' }]);
  }, [currentContext, addToHistory]);

  const handleSceneSelect = useCallback((sceneType: SceneType) => {
    setPendingSuggestion(null);
    setSuggestionDialogVisible(false);
    setManualScene(sceneType);
    addToHistory({ sceneType, timestamp: Date.now(), confidence: 1.0, triggered: true, userAction: 'accept' });
    setSceneSelectorVisible(false);
  }, [setManualScene, addToHistory]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.contentContainer} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}>
    <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          {/* 将 opacity 降到 0.45，让灰色更浅更低调 */}
          <Text style={[styles.title, { color: theme.colors.onSurfaceVariant, opacity: 0.45 }]}>
            SCENELENS
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurface }]}>
            智能场景感知助手
          </Text>
        </View>
        
        {/* 👇 暴力的阴影底座 View，强制渲染一圈阴影 👇 */}
        <View style={[styles.diagnoseButtonWrapper, { backgroundColor: theme.colors.surface }]}>
          <Button 
            mode="text" // 内部按钮用纯文本模式，背景交给外层的 View
            textColor={theme.colors.onSurface} // 强制黑色字 (深色模式下变白)
            onPress={runDiagnostics} 
            disabled={diagnosing} 
            loading={diagnosing} 
            icon="magnify" 
            labelStyle={{ fontWeight: '800', fontSize: 15 }} // 加粗文字提升质感
          >
            诊断
          </Button>
        </View>
      </View>

      <View style={styles.cardsContainer}>
        <LocationCard currentLocation={currentLocation} isRefreshingLocation={isRefreshingLocation} onRefresh={refreshLocation} />
        <MainSceneCard currentContext={currentContext} isDetecting={isDetecting} detectionError={detectionError} isManualMode={isManualMode} onDetect={detectScene} onExecuteSuggestions={executeSceneSuggestions} onSwitchScene={() => setSceneSelectorVisible(true)} />
        {sceneSuggestion && <SceneSuggestionCard scenePackage={sceneSuggestion} confidence={currentContext?.confidence} onExecutionComplete={handleSuggestionExecutionComplete} />}
        <QuickActionsPanel currentScene={currentContext?.context || 'UNKNOWN'} maxActions={6} layout="grid" showTitle={true} title="快捷操作" onActionExecuted={(action, success) => console.log('Action executed:', action.id, success)} />
        <HistoryCard history={getRecentHistory(5)} onShowDetail={showHistoryDetail} />
      </View>

      <SuggestionDialog visible={suggestionDialogVisible} suggestion={pendingSuggestion} triggeredResult={null} executing={executingSuggestion} onConfirm={confirmExecuteSuggestion} onCancel={cancelExecuteSuggestion} />
      <SceneSelector visible={sceneSelectorVisible} currentScene={currentContext?.context || null} onSelect={handleSceneSelect} onDismiss={() => setSceneSelectorVisible(false)} />

      <Portal>
        <Dialog visible={detailDialogVisible} onDismiss={() => setDetailDialogVisible(false)}>
          <Dialog.Title>场景详情</Dialog.Title>
          <Dialog.Content>
            {selectedHistoryItem && (
              <View>
                <Text>类型: {selectedHistoryItem.sceneType}</Text>
                <Text>置信度: {(selectedHistoryItem.confidence * 100).toFixed(0)}%</Text>
                <Text>时间: {new Date(selectedHistoryItem.timestamp).toLocaleString('zh-CN')}</Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions><Button onPress={() => setDetailDialogVisible(false)}>关闭</Button></Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: spacing.md, paddingBottom: 120 },
 header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', // 保持垂直居中对齐
    marginBottom: spacing.xl, 
    marginTop: 0,
  },
  headerTextContainer: { 
    flex: 1,
    justifyContent: 'center',
  },
  title: { 
    fontWeight: '700', 
    letterSpacing: 2, // 稍微拉开英文字母的间距，更有高级感
    fontSize: 16,     // 缩小字号
    marginBottom: 4,  // 给下方的大标题留出呼吸空间
  },
  subtitle: {
    fontWeight: '900', // 使用最粗的字重
    letterSpacing: -0.5, // 中文稍微收紧
    fontSize: 26,      // 放大字号，成为绝对的视觉核心
  },
  diagnoseButtonWrapper: { 
    borderRadius: 999, // 药丸形状
    // iOS 阴影：强制扩散，无方向偏移，形成一圈光晕一样的阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 0.15,
    shadowRadius: 8,    
    // Android 阴影：强制抬高 8 层
    elevation: 8,        
  },
  cardsContainer: { gap: spacing.lg }
});
export default HomeScreen;