/**
 * SuggestionDialog - 场景建议弹窗组件
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Dialog, Portal, Button, Surface, List } from 'react-native-paper';
import { spacing } from '../../theme/spacing';
import type { SceneSuggestionPackage, TriggeredContext } from '../../types';

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

export interface SuggestionDialogProps {
  visible: boolean;
  suggestion: SceneSuggestionPackage | null;
  triggeredResult: TriggeredContext | null;
  executing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SuggestionDialog: React.FC<SuggestionDialogProps> = ({
  visible,
  suggestion,
  triggeredResult,
  executing,
  onConfirm,
  onCancel,
}) => {
  if (!suggestion) {
    return null;
  }

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onCancel}
        style={styles.dialog}
      >
        <Dialog.Title style={styles.dialogTitle}>
          <View style={styles.dialogTitleRow}>
            <Surface
              style={[
                styles.dialogIconContainer,
                { backgroundColor: `${suggestion.color}20` }
              ]}
              elevation={0}
            >
              <Text style={styles.dialogIcon}>
                {sceneIcons[suggestion.sceneId] || sceneIcons.UNKNOWN}
              </Text>
            </Surface>
            <View style={styles.dialogTitleText}>
              <Text variant="titleLarge">{suggestion.displayName}模式</Text>
              <Text variant="bodyMedium" style={styles.dialogSubtitle}>
                已为您准备相关操作
              </Text>
            </View>
          </View>
        </Dialog.Title>

        <Dialog.ScrollArea style={styles.dialogScrollArea}>
          <ScrollView>
            {/* AI 识别结果 */}
            {triggeredResult && triggeredResult.predictions.length > 0 && (
              <View style={styles.dialogSection}>
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  🤖 AI 识别结果
                </Text>
                <Surface style={styles.aiResultBox} elevation={0}>
                  {triggeredResult.predictions.slice(0, 3).map((pred, index) => (
                    <View key={index} style={styles.dialogPredictionItem}>
                      <Text variant="bodyMedium" style={styles.dialogPredictionLabel}>
                        {index + 1}. {pred.label.replace(/^(image:|audio:)/, '')}
                      </Text>
                      <Text variant="bodyMedium" style={styles.dialogPredictionScore}>
                        {(pred.score * 100).toFixed(1)}%
                      </Text>
                    </View>
                  ))}
                </Surface>
              </View>
            )}

            {/* 检测要点 */}
            {suggestion.detectionHighlights.length > 0 && (
              <View style={styles.dialogSection}>
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  检测要点
                </Text>
                {suggestion.detectionHighlights.map((highlight, index) => (
                  <View key={index} style={styles.dialogHighlightItem}>
                    <Text style={styles.dialogHighlightBullet}>•</Text>
                    <Text variant="bodyMedium" style={styles.dialogHighlightText}>
                      {highlight}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* 系统调整项 */}
            {suggestion.systemAdjustments.length > 0 && (
              <View style={styles.dialogSection}>
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  系统调整
                </Text>
                {suggestion.systemAdjustments.map((adjustment) => (
                  <List.Item
                    key={adjustment.id}
                    title={adjustment.label}
                    description={adjustment.description}
                    left={(props) => <List.Icon {...props} icon="cog" />}
                    style={styles.dialogListItem}
                  />
                ))}
              </View>
            )}

            {/* 应用启动项 */}
            {suggestion.appLaunches.length > 0 && (
              <View style={styles.dialogSection}>
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  应用启动
                </Text>
                {suggestion.appLaunches.map((appLaunch) => (
                  <List.Item
                    key={appLaunch.id}
                    title={appLaunch.label}
                    description={appLaunch.description}
                    left={(props) => <List.Icon {...props} icon="application" />}
                    style={styles.dialogListItem}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions style={styles.dialogActions}>
          <Button
            onPress={onCancel}
            disabled={executing}
            mode="outlined"
          >
            取消
          </Button>
          <Button
            onPress={onConfirm}
            loading={executing}
            disabled={executing}
            mode="contained"
            icon="check"
          >
            执行
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
    borderRadius: 16,
  },
  dialogTitle: {
    paddingBottom: 0,
  },
  dialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dialogIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dialogIcon: {
    fontSize: 24,
  },
  dialogTitleText: {
    flex: 1,
  },
  dialogSubtitle: {
    color: '#666',
    marginTop: 2,
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
    maxHeight: 400,
  },
  dialogSection: {
    marginBottom: 16,
  },
  dialogSectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#424242',
  },
  aiResultBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F0F4FF',
    marginBottom: 8,
  },
  dialogPredictionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dialogPredictionLabel: {
    flex: 1,
  },
  dialogPredictionScore: {
    fontWeight: '600',
    color: '#1976D2',
  },
  dialogHighlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  dialogHighlightBullet: {
    marginRight: 8,
    color: '#666',
  },
  dialogHighlightText: {
    flex: 1,
    color: '#424242',
  },
  dialogListItem: {
    paddingHorizontal: 0,
  },
  dialogActions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
});

export default SuggestionDialog;
