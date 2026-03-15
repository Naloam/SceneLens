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
import { View, StyleSheet } from 'react-native';
import { Card, Text, List, Button, Divider, Surface, IconButton, ProgressBar, useTheme } from 'react-native-paper';
import type { SceneSuggestionPackage, OneTapAction, SuggestionExecutionResult } from '../../types';
import { sceneSuggestionManager } from '../../services/SceneSuggestionManager';
import { notificationManager } from '../../notifications/NotificationManager';
import { spacing, borderRadius } from '../../theme/spacing';

const sceneIcons: Record<string, string> = { COMMUTE: '🚇', OFFICE: '🏢', HOME: '🏠', MEETING: '📅', STUDY: '📚', SLEEP: '😴', TRAVEL: '✈️', UNKNOWN: '❓' };
const actionIcons: Record<string, string> = { execute: 'check-circle', skip: 'close-circle', snooze: 'clock-outline', dismiss: 'cancel' };

export interface SceneSuggestionCardProps {
  scenePackage: SceneSuggestionPackage;
  confidence?: number;
  expanded?: boolean;
  onExecutionComplete?: (result: SuggestionExecutionResult) => void;
  style?: any;
  hideHighlights?: boolean;
  hideFallbackNotes?: boolean;
}

export const SceneSuggestionCard: React.FC<SceneSuggestionCardProps> = ({
  scenePackage, confidence, expanded: initialExpanded = true,
  onExecutionComplete, style, hideHighlights = false, hideFallbackNotes = true,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [executing, setExecuting] = useState(false);
  const [executedActionId, setExecutedActionId] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  const handleAction = async (action: OneTapAction) => {
    setExecuting(true);
    setExecutedActionId(action.id);
    try {
      const result = await sceneSuggestionManager.executeSuggestion(scenePackage.sceneId, action.id, { showProgress: true, autoFallback: true });
      const successCount = result.executedActions.filter(a => a.success).length;
      const totalActions = result.executedActions.length + result.skippedActions.length;
      await notificationManager.showSuggestionExecutionResult(scenePackage, result.success, successCount, totalActions, result.skippedActions.length);
      if (result.fallbackApplied && !hideFallbackNotes) setShowFallback(true);
      onExecutionComplete?.(result);
    } catch (error) {} finally { setExecuting(false); }
  };

  const getButtonMode = (action: OneTapAction) => {
    if (action.type === 'primary') return 'contained';
    if (action.type === 'secondary') return 'contained-tonal';
    return 'text';
  };

  const renderHighlights = () => {
    if (hideHighlights || scenePackage.detectionHighlights.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>感知要点</Text>
        <View style={styles.highlightsContainer}>
          {scenePackage.detectionHighlights.map((highlight, index) => (
            // 使用原生 View 替代 Chip，保证文本绝对居中，没有任何偏移
            <View key={index} style={[styles.highlightCustomChip, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '600' }}>✓ {highlight}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderSystemAdjustments = () => {
    if (scenePackage.systemAdjustments.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>系统调整</Text>
        {scenePackage.systemAdjustments.map((adjustment) => (
          <List.Item key={adjustment.id} title={adjustment.label} description={adjustment.description}
            titleStyle={{ color: theme.colors.onSurface, fontWeight: '600' }}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            left={(props) => <List.Icon {...props} icon="cog" color={theme.colors.primary} />}
            style={styles.listItem}
          />
        ))}
      </View>
    );
  };

  const renderAppLaunches = () => {
    if (scenePackage.appLaunches.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>应用启动</Text>
        {scenePackage.appLaunches.map((appLaunch) => (
          <List.Item key={appLaunch.id} title={appLaunch.label} description={appLaunch.description}
            titleStyle={{ color: theme.colors.onSurface, fontWeight: '600' }}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            left={(props) => <List.Icon {...props} icon="application" color={theme.colors.primary} />}
            style={styles.listItem}
          />
        ))}
      </View>
    );
  };

  const renderFallbackNotes = () => {
    if (hideFallbackNotes || !showFallback || scenePackage.fallbackNotes.length === 0) return null;
    return (
      <Surface style={[styles.fallbackSurface, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
        <Text variant="titleSmall" style={[styles.fallbackTitle, { color: theme.colors.error }]}>⚠️ 部分功能降级</Text>
        {scenePackage.fallbackNotes.map((note, index) => (
          <View key={index} style={styles.fallbackNoteItem}>
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>• {note.message}</Text>
          </View>
        ))}
      </Surface>
    );
  };

  return (
    <Card mode="elevated" elevation={1} style={[styles.card, { borderRadius: borderRadius.xl, backgroundColor: theme.colors.surface }, style]}>
      <Card.Content style={{ padding: spacing.md }}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Surface style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
              <Text style={styles.icon}>{sceneIcons[scenePackage.sceneId] || sceneIcons.UNKNOWN}</Text>
            </Surface>
            <View style={styles.headerInfo}>
              <Text variant="titleLarge" style={[styles.title, { color: theme.colors.primary }]}>{scenePackage.displayName}模式</Text>
              {confidence !== undefined && <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>场景建议已就绪</Text>}
            </View>
          </View>
          <IconButton icon={expanded ? 'chevron-up' : 'chevron-down'} size={24} iconColor={theme.colors.primary} onPress={() => setExpanded(!expanded)} style={styles.expandButton} />
        </View>

        {confidence !== undefined && (
          <View style={styles.confidenceContainer}>
            <View style={styles.confidenceHeader}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>匹配度</Text>
              <Text variant="bodySmall" style={{ fontWeight: '700', color: theme.colors.primary }}>{(confidence * 100).toFixed(0)}%</Text>
            </View>
            <ProgressBar progress={confidence} color={theme.colors.primary} style={[styles.confidenceBar, { backgroundColor: theme.colors.surfaceVariant }]} />
          </View>
        )}

        {expanded && (
          <View style={styles.expandedContent}>
            {renderHighlights()}
            {renderSystemAdjustments()}
            {renderAppLaunches()}
            {renderFallbackNotes()}
          </View>
        )}

        <View style={styles.actionsContainer}>
          {scenePackage.oneTapActions.map((action) => {
            const isExecuting = executing && executedActionId === action.id;
            const isPrimary = action.type === 'primary';
            return (
              <Button key={action.id} mode={getButtonMode(action)} onPress={() => handleAction(action)} loading={isExecuting} disabled={executing && !isExecuting}
                buttonColor={isPrimary ? theme.colors.primary : theme.colors.primaryContainer}
                textColor={isPrimary ? theme.colors.onPrimary : theme.colors.primary}
                style={[styles.actionButton, isPrimary ? styles.primaryButton : styles.secondaryButton]}
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
  card: {  marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  icon: { fontSize: 28 },
  headerInfo: { flex: 1 },
  title: { fontWeight: '800', letterSpacing: -0.5 },
  expandButton: { margin: 0 },
  confidenceContainer: { marginBottom: spacing.lg },
  confidenceHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  confidenceBar: { height: 8, borderRadius: 4 },
  expandedContent: { marginTop: spacing.xs, marginBottom: spacing.sm },
  section: { marginBottom: spacing.md },
  sectionTitle: { fontWeight: '700', marginBottom: spacing.sm },
  highlightsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  highlightCustomChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  listItem: { paddingVertical: 4, paddingHorizontal: 0 },
  fallbackSurface: { padding: spacing.md, borderRadius: 16, marginTop: spacing.sm },
  fallbackTitle: { fontWeight: '700', marginBottom: spacing.xs },
  fallbackNoteItem: { marginTop: 4 },
  actionsContainer: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  actionButton: { borderRadius: 999 },
  primaryButton: { flex: 2 },
  secondaryButton: { flex: 1 },
  buttonContent: { height: 54 },
  buttonLabel: { fontSize: 15, fontWeight: '700' },
});

export default SceneSuggestionCard;