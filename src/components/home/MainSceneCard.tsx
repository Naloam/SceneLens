/**
 * MainSceneCard - 主场景卡片组件
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Surface } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { ConfidenceBar, SignalChip } from '../ui';
import { getSceneColor, getSceneContainerColor } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { SilentContext } from '../../types';

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

export interface MainSceneCardProps {
  currentContext: SilentContext | null;
  isDetecting: boolean;
  detectionError: string | null;
  isManualMode?: boolean;
  onDetect: () => void;
  onExecuteSuggestions: () => void;
  onSwitchScene: () => void;
}

export const MainSceneCard: React.FC<MainSceneCardProps> = ({
  currentContext,
  isDetecting,
  detectionError,
  isManualMode = false,
  onDetect,
  onExecuteSuggestions,
  onSwitchScene,
}) => {
  const navigation = useNavigation();

  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text variant="titleLarge" style={styles.cardTitle}>
            当前场景
          </Text>
          {isManualMode && (
            <Text variant="labelSmall" style={styles.manualBadge}>
              手动
            </Text>
          )}
        </View>

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
            <Button mode="contained" onPress={onDetect}>
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
                onPress={onSwitchScene}
                style={styles.actionButton}
                icon="swap-horizontal"
              >
                切换场景
              </Button>
              <Button
                mode="outlined"
                onPress={onDetect}
                disabled={isDetecting}
                style={styles.actionButton}
                icon="refresh"
              >
                自动检测
              </Button>
            </View>
            <View style={styles.actionsSection}>
              <Button
                mode="contained"
                onPress={onExecuteSuggestions}
                disabled={!currentContext}
                style={styles.fullWidthButton}
                icon="play"
              >
                执行建议
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text variant="bodyMedium">点击下方按钮开始检测场景</Text>
            <View style={styles.emptyActions}>
              <Button mode="contained" onPress={onDetect} icon="magnify">
                自动检测
              </Button>
              <Button mode="outlined" onPress={onSwitchScene} icon="swap-horizontal">
                手动选择
              </Button>
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    marginBottom: spacing.md,
    fontWeight: '700',
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
    marginBottom: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  fullWidthButton: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  manualBadge: {
    backgroundColor: '#6750A4',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '600',
  },
});

export default MainSceneCard;
