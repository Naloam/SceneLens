/**
 * SceneSuggestionCard - 场景执行建议包卡片组件
 *
 * 用于展示场景执行建议包，包括：
 * - 检测要点
 * - 系统调整项
 * - 应用启动项
 * - 一键操作按钮
 * - 降级说明
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Card,
  Text,
  List,
  Button,
  Divider,
  Surface,
  Chip,
  IconButton,
  ProgressBar,
} from 'react-native-paper';
import type { SceneSuggestionPackage, OneTapAction, SuggestionExecutionResult } from '../../types';
import { sceneSuggestionManager } from '../../services/SceneSuggestionManager';
import { notificationManager } from '../../notifications/NotificationManager';
import { spacing } from '../../theme/spacing';

/**
 * 组件属性
 */
export interface SceneSuggestionCardProps {
  /** 场景执行建议包 */
  scenePackage: SceneSuggestionPackage;
  /** 置信度（可选，用于显示进度条） */
  confidence?: number;
  /** 是否显示详细信息（默认展开） */
  expanded?: boolean;
  /** 执行完成回调 */
  onExecutionComplete?: (result: SuggestionExecutionResult) => void;
  /** 样式 */
  style?: any;
  /** 是否隐藏检测要点 */
  hideHighlights?: boolean;
  /** 是否隐藏降级说明 */
  hideFallbackNotes?: boolean;
}

/**
 * 场景图标映射（使用 emoji）
 */
const sceneIcons: Record<string, string> = {
  COMMUTE: '🚇',
  OFFICE: '🏢',
  HOME: '🏠',
  MEETING: '📅',
  STUDY: '📚',
  SLEEP: '😴',
  TRAVEL: '✈️',
  UNKNOWN: '❓',
};

/**
 * 操作图标映射
 */
const actionIcons: Record<string, string> = {
  execute: 'check-circle',
  skip: 'close-circle',
  snooze: 'clock-outline',
  dismiss: 'cancel',
};

export const SceneSuggestionCard: React.FC<SceneSuggestionCardProps> = ({
  scenePackage,
  confidence,
  expanded: initialExpanded = true,
  onExecutionComplete,
  style,
  hideHighlights = false,
  hideFallbackNotes = true,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [executing, setExecuting] = useState(false);
  const [executedActionId, setExecutedActionId] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  /**
   * 处理一键操作
   */
  const handleAction = async (action: OneTapAction) => {
    setExecuting(true);
    setExecutedActionId(action.id);

    try {
      const result = await sceneSuggestionManager.executeSuggestion(
        scenePackage.sceneId,
        action.id,
        {
          showProgress: true,
          autoFallback: true,
        }
      );

      // 计算实际成功的操作数量
      const successCount = result.executedActions.filter(a => a.success).length;
      const totalAttempted = result.executedActions.length;
      const totalActions = totalAttempted + result.skippedActions.length;

      // 显示执行结果通知
      await notificationManager.showSuggestionExecutionResult(
        scenePackage,
        result.success,
        successCount,
        totalActions,
        result.skippedActions.length
      );

      // 如果应用了降级策略，显示降级说明
      if (result.fallbackApplied && !hideFallbackNotes) {
        setShowFallback(true);
      }

      // 触发回调
      onExecutionComplete?.(result);
    } catch (error) {
      console.error('[SceneSuggestionCard] 执行失败:', error);
    } finally {
      setExecuting(false);
    }
  };

  /**
   * 获取操作按钮样式
   */
  const getButtonMode = (action: OneTapAction): 'contained' | 'outlined' | 'text' => {
    if (action.type === 'primary') return 'contained';
    if (action.type === 'secondary') return 'outlined';
    return 'text';
  };

  /**
   * 渲染检测要点
   */
  const renderHighlights = () => {
    if (hideHighlights || scenePackage.detectionHighlights.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          检测要点
        </Text>
        <View style={styles.highlightsContainer}>
          {scenePackage.detectionHighlights.map((highlight, index) => (
            <View key={index} style={styles.highlightItem}>
              <Chip
                mode="flat"
                textStyle={styles.highlightText}
                style={styles.highlightChip}
                icon="check-circle"
              >
                {highlight}
              </Chip>
            </View>
          ))}
        </View>
      </View>
    );
  };

  /**
   * 渲染系统调整项
   */
  const renderSystemAdjustments = () => {
    if (scenePackage.systemAdjustments.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          系统调整
        </Text>
        {scenePackage.systemAdjustments.map((adjustment) => (
          <List.Item
            key={adjustment.id}
            title={adjustment.label}
            description={adjustment.description}
            left={(props) => <List.Icon {...props} icon="cog" />}
            style={styles.listItem}
          />
        ))}
      </View>
    );
  };

  /**
   * 渲染应用启动项
   */
  const renderAppLaunches = () => {
    if (scenePackage.appLaunches.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          应用启动
        </Text>
        {scenePackage.appLaunches.map((appLaunch) => (
          <List.Item
            key={appLaunch.id}
            title={appLaunch.label}
            description={appLaunch.description}
            left={(props) => <List.Icon {...props} icon="application" />}
            style={styles.listItem}
          />
        ))}
      </View>
    );
  };

  /**
   * 渲染降级说明
   */
  const renderFallbackNotes = () => {
    if (hideFallbackNotes || !showFallback || scenePackage.fallbackNotes.length === 0) {
      return null;
    }

    return (
      <Surface style={styles.fallbackSurface} elevation={0}>
        <Text variant="titleSmall" style={styles.fallbackTitle}>
          ⚠️ 部分功能不可用
        </Text>
        {scenePackage.fallbackNotes.map((note, index) => (
          <View key={index} style={styles.fallbackNoteItem}>
            <Text variant="bodySmall" style={styles.fallbackNoteText}>
              • {note.message}
            </Text>
          </View>
        ))}
      </Surface>
    );
  };

  /**
   * 渲染置信度进度条
   */
  const renderConfidenceBar = () => {
    if (confidence === undefined) {
      return null;
    }

    return (
      <View style={styles.confidenceContainer}>
        <View style={styles.confidenceHeader}>
          <Text variant="bodySmall" style={styles.confidenceLabel}>
            置信度
          </Text>
          <Text variant="bodySmall" style={styles.confidenceValue}>
            {(confidence * 100).toFixed(0)}%
          </Text>
        </View>
        <ProgressBar
          progress={confidence}
          color={scenePackage.color}
          style={styles.confidenceBar}
        />
      </View>
    );
  };

  return (
    <Card mode="elevated" style={[styles.card, style]}>
      <Card.Content>
        {/* 卡片头部 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Surface style={[styles.iconContainer, { backgroundColor: `${scenePackage.color}20` }]} elevation={0}>
              <Text style={styles.icon}>
                {sceneIcons[scenePackage.sceneId] || sceneIcons.UNKNOWN}
              </Text>
            </Surface>
            <View style={styles.headerInfo}>
              <Text variant="titleLarge" style={styles.title}>
                {scenePackage.displayName}模式
              </Text>
              {confidence !== undefined && (
                <Text variant="bodySmall" style={styles.subtitle}>
                  已为您准备相关操作
                </Text>
              )}
            </View>
          </View>
          <IconButton
            icon={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            onPress={() => setExpanded(!expanded)}
            style={styles.expandButton}
          />
        </View>

        {/* 置信度进度条 */}
        {renderConfidenceBar()}

        {/* 展开内容 */}
        {expanded && (
          <View style={styles.expandedContent}>
            {/* 检测要点 */}
            {renderHighlights()}

            {/* 系统调整项 */}
            {renderSystemAdjustments()}

            {/* 应用启动项 */}
            {renderAppLaunches()}

            {/* 降级说明 */}
            {renderFallbackNotes()}
          </View>
        )}

        <Divider style={styles.divider} />

        {/* 一键操作按钮 */}
        <View style={styles.actionsContainer}>
          {scenePackage.oneTapActions.map((action) => {
            const isExecuting = executing && executedActionId === action.id;
            const isPrimaryAction = action.id === scenePackage.oneTapActions[0]?.id;

            return (
              <Button
                key={action.id}
                mode={getButtonMode(action)}
                onPress={() => handleAction(action)}
                loading={isExecuting}
                disabled={executing && !isExecuting}
                style={[
                  styles.actionButton,
                  isPrimaryAction ? styles.primaryButton : styles.secondaryButton,
                ]}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                icon={actionIcons[action.action] || 'check-circle'}
              >
                {action.label}
              </Button>
            );
          })}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 24,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    color: '#666',
    marginTop: 2,
  },
  expandButton: {
    margin: 0,
  },
  confidenceContainer: {
    marginBottom: spacing.md,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  confidenceLabel: {
    color: '#666',
  },
  confidenceValue: {
    fontWeight: '600',
  },
  confidenceBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  expandedContent: {
    marginTop: spacing.sm,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: '#424242',
  },
  highlightsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  highlightItem: {
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  highlightChip: {
    backgroundColor: '#E8F4FD',
    height: 28,
  },
  highlightText: {
    fontSize: 12,
    color: '#1976D2',
  },
  listItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
  },
  fallbackSurface: {
    backgroundColor: '#FFF4E5',
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  fallbackTitle: {
    fontWeight: '600',
    color: '#E65100',
    marginBottom: spacing.xs,
  },
  fallbackNoteItem: {
    marginTop: spacing.xs,
  },
  fallbackNoteText: {
    color: '#BF360C',
  },
  divider: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  primaryButton: {
    flex: 2,
  },
  secondaryButton: {
    flex: 1,
  },
  buttonContent: {
    paddingVertical: 4,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SceneSuggestionCard;
