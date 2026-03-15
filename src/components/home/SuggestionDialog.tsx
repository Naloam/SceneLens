/**
 * SuggestionDialog - 场景建议弹窗组件
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Dialog, Portal, Button, Surface, List, useTheme } from 'react-native-paper';
import { spacing, borderRadius } from '../../theme/spacing';
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
  const theme = useTheme();
  // 极淡主题色背景，约 4% 透明度
  const ultraLightBg = theme.colors.primary + '0A';

  if (!suggestion) {
    return null;
  }

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onCancel}
        // 👉 核心修复 1：强行白底消灭紫灰遮罩，统一家族式大圆角
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
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
              <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.onSurface }}>
                {suggestion.displayName}模式
              </Text>
              <Text variant="bodyMedium" style={styles.dialogSubtitle}>
                已为您准备相关操作
              </Text>
            </View>
          </View>
        </Dialog.Title>

        <Dialog.ScrollArea style={styles.dialogScrollArea}>
          {/* 👉 核心修复 2：由 ScrollView 内部接管排版，强制留出 24px 的呼吸边距 */}
          <ScrollView contentContainerStyle={styles.scrollContent}>
            
            {/* AI 识别结果 */}
            {triggeredResult && triggeredResult.predictions.length > 0 && (
              <View style={styles.dialogSection}>
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  🤖 AI 识别结果
                </Text>
                <Surface style={[styles.infoBox, { backgroundColor: ultraLightBg }]} elevation={0}>
                  {triggeredResult.predictions.slice(0, 3).map((pred, index) => (
                    <View key={index} style={styles.dialogPredictionItem}>
                      <Text variant="bodyMedium" style={{ flex: 1, color: theme.colors.onSurface, fontWeight: '500' }}>
                        {index + 1}. {pred.label.replace(/^(image:|audio:)/, '')}
                      </Text>
                      <Text variant="bodyMedium" style={{ fontWeight: '700', color: theme.colors.primary }}>
                        {(pred.score * 100).toFixed(1)}%
                      </Text>
                    </View>
                  ))}
                </Surface>
              </View>
            )}

            {/* 检测要点 - 包装在淡色背景中 */}
            {suggestion.detectionHighlights.length > 0 && (
              <View style={styles.dialogSection}>
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  检测要点
                </Text>
                <Surface style={[styles.infoBox, { backgroundColor: ultraLightBg }]} elevation={0}>
                  {suggestion.detectionHighlights.map((highlight, index) => (
                    <View key={index} style={styles.dialogHighlightItem}>
                      <Text style={[styles.dialogHighlightBullet, { color: theme.colors.primary }]}>•</Text>
                      <Text variant="bodyMedium" style={styles.dialogHighlightText}>
                        {highlight}
                      </Text>
                    </View>
                  ))}
                </Surface>
              </View>
            )}

            {/* 系统调整项 - 采用浅灰色层级包裹 */}
            {suggestion.systemAdjustments.length > 0 && (
              <View style={styles.dialogSection}>
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  系统调整
                </Text>
                {suggestion.systemAdjustments.map((adjustment) => (
                  <Surface key={adjustment.id} style={[styles.itemBox, { backgroundColor: theme.colors.surfaceVariant, opacity: 0.8 }]} elevation={0}>
                    <List.Icon icon="cog" color={theme.colors.onSurfaceVariant} style={styles.listIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.onSurface, marginBottom: 2 }}>{adjustment.label}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>{adjustment.description}</Text>
                    </View>
                  </Surface>
                ))}
              </View>
            )}

            {/* 应用启动项 - 采用浅灰色层级包裹 */}
            {suggestion.appLaunches.length > 0 && (
              <View style={styles.dialogSection}>
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  应用启动
                </Text>
                {suggestion.appLaunches.map((appLaunch) => (
                  <Surface key={appLaunch.id} style={[styles.itemBox, { backgroundColor: theme.colors.surfaceVariant, opacity: 0.8 }]} elevation={0}>
                    <List.Icon icon="application" color={theme.colors.onSurfaceVariant} style={styles.listIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.onSurface, marginBottom: 2 }}>{appLaunch.label}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>{appLaunch.description}</Text>
                    </View>
                  </Surface>
                ))}
              </View>
            )}
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions style={styles.dialogActions}>
          <Button
            onPress={onCancel}
            disabled={executing}
            textColor={theme.colors.onSurfaceVariant}
            style={styles.actionButton}
          >
            取消
          </Button>
          <Button
            onPress={onConfirm}
            loading={executing}
            disabled={executing}
            mode="contained"
            buttonColor={theme.colors.primary}
            style={[styles.actionButton, { paddingHorizontal: 8 }]}
          >
            ✓ 执行
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  // 👉 弹窗圆角对齐首页卡片的 borderRadius.xl (这里硬编码 28 避免你那边 spacing 配置不同)
  dialog: {
    maxHeight: '85%',
    borderRadius: 28,
  },
  dialogTitle: {
    paddingBottom: 24,
    paddingTop: 24,
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
    marginRight: 16,
  },
  dialogIcon: {
    fontSize: 24,
  },
  dialogTitleText: {
    flex: 1,
  },
  dialogSubtitle: {
    color: '#666',
    marginTop: 4,
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
    borderTopWidth: 0, // 隐藏默认的分割线更显高级
    borderBottomWidth: 0,
  },
  scrollContent: {
    paddingHorizontal: 24, // 👈 解决贴边的致命武器
    paddingBottom: 16,
  },
  dialogSection: {
    marginBottom: 20,
  },
  dialogSectionTitle: {
    fontWeight: '700',
    marginBottom: 10,
    color: '#424242',
    opacity: 0.6,
  },
  
  // 👉 新增的层级包裹块
  infoBox: {
    padding: 16,
    borderRadius: 16,
  },
  itemBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  listIcon: {
    margin: 0,
    marginRight: 12,
  },
  
  dialogPredictionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dialogHighlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  dialogHighlightBullet: {
    marginRight: 8,
    fontWeight: '900',
  },
  dialogHighlightText: {
    flex: 1,
    lineHeight: 20,
    color: '#333',
  },
  dialogActions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    gap: 8,
  },
  actionButton: {
    borderRadius: 12,
  },
});

export default SuggestionDialog;