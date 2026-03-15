/**
 * UserTriggeredCard - 用户触发识别卡片组件 (主题动态适配版)
 */
import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { 
  Text, 
  Card, 
  IconButton, 
  Surface, 
  Button, 
  ActivityIndicator, 
  useTheme 
} from 'react-native-paper';
import { spacing, borderRadius } from '../../theme/spacing';
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
  const theme = useTheme();

  const showHelpDialog = () => {
    Alert.alert(
      '用户触发识别',
      '通过双击音量键或点击桌面快捷方式，快速识别当前场景。\n\n• 音量键双击：快速触发\n• 桌面快捷方式：一键识别\n• 使用相机和麦克风进行精确识别',
      [{ text: '确定' }]
    );
  };

  return (
    <Card 
      mode="elevated" 
      elevation={1} 
      style={[
        styles.card, 
        { 
          borderRadius: borderRadius.xl, 
          backgroundColor: theme.colors.surface 
        }
      ]}
    >
      <Card.Content style={styles.cardContent}>
        
        <View style={styles.headerRow}>
          <Text 
            variant="titleMedium" 
            style={[styles.cardTitle, { color: theme.colors.onSurfaceVariant }]}
          >
           🎯 手动触发感知
          </Text>
          <IconButton 
            icon={isAnalyzing ? "loading" : "information-outline"} 
            size={22} 
            iconColor={theme.colors.onSurfaceVariant} 
            onPress={showHelpDialog} 
            style={styles.iconButton} 
          />
        </View>

        {isAnalyzing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text 
              variant="bodyMedium" 
              style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}
            >
              正在感知环境细节...
            </Text>
          </View>
        ) : triggeredResult ? (
          <View style={styles.triggeredResultContainer}>
            <Surface 
              style={[
                styles.resultBox, 
                { backgroundColor: theme.colors.secondaryContainer }
              ]} 
              elevation={0}
            >
              <Text 
                variant="titleSmall" 
                style={[styles.resultTitle, { color: theme.colors.onSecondaryContainer }]}
              >
                感知结果分析
              </Text>
              {triggeredResult.predictions.slice(0, 3).map((pred, index) => (
                <View key={index} style={styles.predictionRow}>
                  <Text 
                    variant="bodyMedium" 
                    style={{ color: theme.colors.onSecondaryContainer, flex: 1 }}
                  >
                    {index + 1}. {pred.label}
                  </Text>
                  <Text 
                    variant="titleMedium" 
                    style={{ color: theme.colors.primary, fontWeight: '700' }}
                  >
                    {(pred.score * 100).toFixed(1)}%
                  </Text>
                </View>
              ))}
            </Surface>
            
            <View style={styles.triggerButtonsRow}>
              <Button 
                mode="contained-tonal" 
                onPress={onAnalyze} 
                style={styles.triggerButton} 
                contentStyle={{ height: 48 }}
              >
                重新感知
              </Button>
              <Button 
                mode="contained" 
                onPress={() => onAcceptResult(triggeredResult)} 
                style={styles.triggerButton} 
                contentStyle={{ height: 48 }}
              >
                确认采纳
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.triggerControls}>
            <Surface 
              style={[
                styles.triggerControlItem, 
                { backgroundColor: theme.colors.surfaceVariant }
              ]} 
              elevation={0}
            >
              <View style={styles.triggerControlHeader}>
                <Text 
                  variant="titleSmall" 
                  style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}
                >
                  🔊 音量键双击
                </Text>
                <Surface 
                  style={[
                    styles.triggerStatusBadge, 
                    { 
                      backgroundColor: volumeKeyEnabled 
                        ? theme.colors.primaryContainer 
                        : theme.colors.elevation.level3 
                    }
                  ]} 
                  elevation={0}
                >
                  <Text 
                    variant="labelSmall" 
                    style={{ 
                      color: volumeKeyEnabled 
                        ? theme.colors.onPrimaryContainer 
                        : theme.colors.onSurfaceVariant, 
                      fontWeight: '700' 
                    }}
                  >
                    {volumeKeyEnabled ? '已启用' : '已禁用'}
                  </Text>
                </Surface>
              </View>
              <Text 
                variant="bodySmall" 
                style={{ 
                  color: theme.colors.onSurfaceVariant, 
                  marginBottom: spacing.md, 
                  opacity: 0.8 
                }}
              >
                息屏状态下快速触发场景识别
              </Text>
              <Button 
                mode={volumeKeyEnabled ? 'outlined' : 'contained-tonal'} 
                onPress={onToggleVolumeKey} 
                compact
              >
                {volumeKeyEnabled ? '停用此功能' : '开启便捷触发'}
              </Button>
            </Surface>

            <Surface 
              style={[
                styles.triggerControlItem, 
                { backgroundColor: theme.colors.surfaceVariant }
              ]} 
              elevation={0}
            >
              <View style={styles.triggerControlHeader}>
                <Text 
                  variant="titleSmall" 
                  style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}
                >
                  🔗 桌面快捷方式
                </Text>
                <Surface 
                  style={[
                    styles.triggerStatusBadge, 
                    { 
                      backgroundColor: shortcutEnabled 
                        ? theme.colors.primaryContainer 
                        : theme.colors.elevation.level3 
                    }
                  ]} 
                  elevation={0}
                >
                  <Text 
                    variant="labelSmall" 
                    style={{ 
                      color: shortcutEnabled 
                        ? theme.colors.onPrimaryContainer 
                        : theme.colors.onSurfaceVariant, 
                      fontWeight: '700' 
                    }}
                  >
                    {shortcutEnabled ? '已创建' : '未创建'}
                  </Text>
                </Surface>
              </View>
              <Text 
                variant="bodySmall" 
                style={{ 
                  color: theme.colors.onSurfaceVariant, 
                  marginBottom: spacing.md, 
                  opacity: 0.8 
                }}
              >
                在桌面点击图标一键执行识别
              </Text>
              <Button 
                mode={shortcutEnabled ? 'outlined' : 'contained-tonal'} 
                onPress={onToggleShortcut} 
                compact
              >
                {shortcutEnabled ? '移除快捷方式' : '添加到桌面'}
              </Button>
            </Surface>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {},
  cardContent: { 
    padding: spacing.md 
  },
  cardTitle: { 
    fontWeight: '600', 
    letterSpacing: 0.5 
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.md 
  },
  iconButton: { 
    margin: 0 
  },
  loadingContainer: { 
    alignItems: 'center', 
    paddingVertical: spacing.xl, 
    gap: spacing.md 
  },
  loadingText: { 
    textAlign: 'center' 
  },
  triggeredResultContainer: { 
    gap: spacing.md 
  },
  resultBox: { 
    padding: spacing.md, 
    borderRadius: borderRadius.lg, 
    gap: spacing.xs 
  },
  resultTitle: { 
    marginBottom: spacing.xs 
  },
  predictionRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 4 
  },
  triggerButtonsRow: { 
    flexDirection: 'row', 
    gap: spacing.sm 
  },
  triggerButton: { 
    flex: 1, 
    borderRadius: borderRadius.lg 
  },
  triggerControls: { 
    gap: spacing.sm 
  },
  triggerControlItem: { 
    padding: spacing.md, 
    borderRadius: borderRadius.lg 
  },
  triggerControlHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.xs 
  },
  triggerStatusBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: borderRadius.sm 
  },
});

export default UserTriggeredCard;