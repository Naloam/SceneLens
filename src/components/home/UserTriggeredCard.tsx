/**
 * UserTriggeredCard - 用户触发识别卡片组件
 */

import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Card, IconButton, Surface, Button, ActivityIndicator } from 'react-native-paper';
import { spacing } from '../../theme/spacing';
import type { TriggeredContext } from '../../types';

export interface UserTriggeredCardProps {
  isAnalyzing: boolean;
  triggeredResult: TriggeredContext | null;
  volumeKeyEnabled: boolean;
  shortcutEnabled: boolean;
  onAnalyze: () => void;
  onToggleVolumeKey: () => void;
  onToggleShortcut: () => void;
  onAcceptResult: (result: TriggeredContext) => void;
}

export const UserTriggeredCard: React.FC<UserTriggeredCardProps> = ({
  isAnalyzing,
  triggeredResult,
  volumeKeyEnabled,
  shortcutEnabled,
  onAnalyze,
  onToggleVolumeKey,
  onToggleShortcut,
  onAcceptResult,
}) => {
  const showHelpDialog = () => {
    Alert.alert(
      '用户触发识别',
      '通过双击音量键或点击桌面快捷方式，快速识别当前场景。\n\n' +
      '• 音量键双击：快速触发\n' +
      '• 桌面快捷方式：一键识别\n' +
      '• 使用相机和麦克风进行精确识别',
      [{ text: '确定' }]
    );
  };

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content>
        <View style={styles.headerRow}>
          <Text variant="titleLarge" style={styles.cardTitle}>
            🎯 用户触发识别
          </Text>
          <IconButton
            icon={isAnalyzing ? "loading" : "information-outline"}
            size={20}
            onPress={showHelpDialog}
          />
        </View>

        {isAnalyzing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text variant="bodyMedium" style={styles.loadingText}>
              正在识别场景...
            </Text>
          </View>
        ) : triggeredResult ? (
          <View style={styles.triggeredResultContainer}>
            <Surface style={styles.resultBox} elevation={0}>
              <Text variant="titleMedium" style={styles.resultTitle}>
                识别结果
              </Text>
              {triggeredResult.predictions.slice(0, 3).map((pred, index) => (
                <View key={index} style={styles.predictionRow}>
                  <Text variant="bodyMedium" style={styles.predictionLabel}>
                    {index + 1}. {pred.label}
                  </Text>
                  <Text variant="bodyMedium" style={styles.predictionScore}>
                    {(pred.score * 100).toFixed(1)}%
                  </Text>
                </View>
              ))}
            </Surface>

            <View style={styles.triggerButtonsRow}>
              <Button
                mode="outlined"
                onPress={onAnalyze}
                style={styles.triggerButton}
                icon="refresh"
              >
                重新识别
              </Button>
              <Button
                mode="contained"
                onPress={() => onAcceptResult(triggeredResult)}
                style={styles.triggerButton}
                icon="check"
              >
                接受结果
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.triggerControls}>
            <View style={styles.triggerControlItem}>
              <View style={styles.triggerControlHeader}>
                <Text variant="bodyLarge" style={styles.triggerControlLabel}>
                  🔊 音量键双击
                </Text>
                <Text
                  variant="labelSmall"
                  style={[
                    styles.triggerStatusBadge,
                    { backgroundColor: volumeKeyEnabled ? '#4CAF50' : '#9E9E9E' },
                  ]}
                >
                  {volumeKeyEnabled ? '已启用' : '已禁用'}
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.triggerControlDescription}>
                双击音量键快速触发场景识别
              </Text>
              <Button
                mode={volumeKeyEnabled ? 'outlined' : 'contained'}
                onPress={onToggleVolumeKey}
                style={styles.triggerControlButton}
                compact
              >
                {volumeKeyEnabled ? '禁用' : '启用'}
              </Button>
            </View>

            <View style={styles.triggerControlItem}>
              <View style={styles.triggerControlHeader}>
                <Text variant="bodyLarge" style={styles.triggerControlLabel}>
                  🔗 桌面快捷方式
                </Text>
                <Text
                  variant="labelSmall"
                  style={[
                    styles.triggerStatusBadge,
                    { backgroundColor: shortcutEnabled ? '#4CAF50' : '#9E9E9E' },
                  ]}
                >
                  {shortcutEnabled ? '已创建' : '未创建'}
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.triggerControlDescription}>
                在桌面添加快捷方式，一键识别场景
              </Text>
              <Button
                mode={shortcutEnabled ? 'outlined' : 'contained'}
                onPress={onToggleShortcut}
                style={styles.triggerControlButton}
                compact
              >
                {shortcutEnabled ? '删除' : '创建'}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  triggeredResultContainer: {
    gap: spacing.md,
  },
  resultBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  resultTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  predictionLabel: {
    flex: 1,
  },
  predictionScore: {
    fontWeight: '600',
    color: '#1976D2',
  },
  triggerButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  triggerButton: {
    flex: 1,
  },
  triggerControls: {
    gap: spacing.md,
  },
  triggerControlItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  triggerControlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  triggerControlLabel: {
    fontWeight: '600',
  },
  triggerStatusBadge: {
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '600',
  },
  triggerControlDescription: {
    color: '#666',
    marginBottom: spacing.sm,
  },
  triggerControlButton: {
    alignSelf: 'flex-start',
  },
});

export default UserTriggeredCard;
