// src/screens/DataScreen.tsx
import React from 'react';
import { ScrollView, StyleSheet, Alert, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { spacing } from '../theme/spacing';

// 只引入数据页需要的 Hooks
import {
  useUserTriggeredAnalysis,
  useSceneDetection,
} from '../hooks';

// 只引入数据页需要的卡片组件
import {
  UserTriggeredCard,
  PredictionCard,
  ModelStatusCard,
  FeedbackReportCard,
  MLPredictionDetailCard,
} from '../components/home';

import type { TriggeredContext } from '../types';

export const DataScreen: React.FC = () => {
  const theme = useTheme();

  // 获取当前场景上下文（用于预测卡片）
  const { currentContext } = useSceneDetection();

  // 获取用户触发分析的全部逻辑
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

  const handleAcceptResult = (result: TriggeredContext) => {
    handleFeedback(result, 'accept');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text variant="displaySmall" style={[styles.title, { color: theme.colors.onBackground }]}>
          数据与分析
        </Text>
        <Text variant="titleMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          模型预测与深度状态
        </Text>
      </View>

      <View style={styles.cardsContainer}>
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

        {/* AI 预测详情卡片 - 仅在有识别结果时展示 */}
        {triggeredResult && triggeredResult.predictions.length > 0 && (
          <MLPredictionDetailCard
            predictions={triggeredResult.predictions}
            timestamp={triggeredResult.timestamp}
            initialExpanded={false}
          />
        )}

        {/* 智能预测卡片 */}
        <PredictionCard
          currentScene={currentContext?.context || 'UNKNOWN'}
          onPredictionTap={(prediction) => {
            console.log('[DataScreen] Prediction tapped:', prediction);
          }}
          onDepartureReminderTap={(reminder) => {
            console.log('[DataScreen] Departure reminder tapped:', reminder);
            Alert.alert('出发提醒', reminder.message);
          }}
        />

        {/* AI 模型状态卡片 */}
        <ModelStatusCard initialExpanded={false} />

        {/* 学习报告卡片 */}
        <FeedbackReportCard
          onViewDetails={() => {
            console.log('[DataScreen] View feedback report details');
          }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: 120, // 防止被底部导航栏挡住
  },
  header: {
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  cardsContainer: {
    gap: spacing.lg,
  },
});