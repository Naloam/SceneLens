/**
 * MainSceneCard - 主场景卡片组件
 * 番茄 Todo 极简同色系风格 (Monochromatic Style)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Surface, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { spacing, borderRadius } from '../../theme/spacing';
import type { SilentContext } from '../../types';

const sceneIcons: Record<string, string> = { COMMUTE: '🚇', OFFICE: '🏢', HOME: '🏠', STUDY: '📚', SLEEP: '😴', TRAVEL: '✈️', UNKNOWN: '❓' };
const sceneDescriptions: Record<string, string> = { COMMUTE: '检测到你在通勤路上', OFFICE: '检测到你在办公环境', HOME: '检测到你在家里', STUDY: '检测到学习氛围', SLEEP: '检测到睡眠场景', TRAVEL: '检测到旅行场景', UNKNOWN: '场景识别中...' };

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
  currentContext, isDetecting, detectionError, isManualMode = false,
  onDetect, onExecuteSuggestions, onSwitchScene,
}) => {
  const theme = useTheme();

  return (
    <Card mode="elevated" elevation={1} style={[styles.card, { borderRadius: borderRadius.xl, backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.cardContent}>
        
        <View style={styles.cardHeader}>
          <Text variant="titleMedium" style={[styles.cardTitle, { color: theme.colors.onSurfaceVariant }]}>当前场景</Text>
          {isManualMode && (
            <Surface style={[styles.manualBadge, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
              <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>手动模式</Text>
            </Surface>
          )}
        </View>

        {isDetecting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size={40} color={theme.colors.primary} />
            <Text variant="bodyMedium" style={[styles.loadingText, { color: theme.colors.primary }]}>正在感知环境细节...</Text>
          </View>
        ) : detectionError ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>❌ {detectionError}</Text>
            <Button mode="contained" buttonColor={theme.colors.errorContainer} textColor={theme.colors.error} onPress={onDetect} style={styles.pillButton}>重新检测</Button>
          </View>
        ) : currentContext ? (
          <View style={styles.contentSection}>
            
            <View style={styles.sceneHero}>
              <Surface style={[styles.sceneIconContainer, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                <Text style={styles.sceneIcon}>{sceneIcons[currentContext.context] || sceneIcons.UNKNOWN}</Text>
              </Surface>
              
              <View style={styles.sceneInfo}>
                <View style={styles.sceneNameRow}>
                  <Text variant="headlineSmall" style={[styles.sceneName, { color: theme.colors.onSurface }]}>
                    {currentContext.context}
                  </Text>
                  <Surface style={[styles.confidenceBadge, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: theme.colors.primary }}>
                      置信度 {(currentContext.confidence * 100).toFixed(0)}%
                    </Text>
                  </Surface>
                </View>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {sceneDescriptions[currentContext.context] || sceneDescriptions.UNKNOWN}
                </Text>
              </View>
            </View>

            <View style={styles.signalsList}>
              {currentContext.signals.map((signal, index) => (
                <View key={index} style={[styles.signalChip, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '700' }}>
                    {signal.type} {signal.weight > 0 ? `+${(signal.weight * 100).toFixed(0)}` : ''}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.actionsContainer}>
              <View style={styles.rowActions}>
                <Button mode="contained" buttonColor={theme.colors.primaryContainer} textColor={theme.colors.primary} onPress={onSwitchScene} style={styles.pillButton} contentStyle={styles.buttonContent} icon="swap-horizontal">切换</Button>
                <Button mode="contained" buttonColor={theme.colors.primaryContainer} textColor={theme.colors.primary} onPress={onDetect} disabled={isDetecting} style={styles.pillButton} contentStyle={styles.buttonContent} icon="refresh">重测</Button>
              </View>
              <Button mode="contained" onPress={onExecuteSuggestions} disabled={!currentContext} style={styles.pillButton} contentStyle={styles.primaryButtonContent} labelStyle={{ fontSize: 16, fontWeight: '700' }} icon="play">应用场景建议</Button>
            </View>
            
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.md }}>等待感知场景</Text>
            <View style={styles.emptyActions}><Button mode="contained" onPress={onDetect} icon="magnify" style={styles.pillButton}>立即检测</Button></View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { 
    // 删除了 marginHorizontal 和 marginBottom，让它和上下卡片完全等宽！
  },
  cardContent: { 
    padding: 20, // 增大了整体内边距，让卡片内部看起来更舒展
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.md // 增大了标题和下方内容的距离
  },
  cardTitle: { fontWeight: '600' },
  manualBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.md },
  loadingContainer: { alignItems: 'center', paddingVertical: 30, gap: spacing.md },
  loadingText: { fontWeight: '600' },
  errorContainer: { alignItems: 'center', paddingVertical: 30, gap: spacing.md },
  errorText: { fontWeight: '600', fontSize: 16 },
  
  contentSection: { width: '100%' },
  
  sceneHero: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: spacing.md, // 增加了横幅区域的上下呼吸空间
    marginBottom: spacing.md     // 增加了和下方信号标签的距离
  },
  sceneIconContainer: { 
    width: 68,  // 略微调大了图标容器
    height: 68, 
    borderRadius: 22, 
    alignItems: 'center', 
    justifyContent: 'center', 
  },
  sceneIcon: { fontSize: 34 },
  sceneInfo: { 
    flex: 1, 
    marginLeft: spacing.lg, // 拉开了图标和文字的距离
    justifyContent: 'center'
  },
  sceneNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4 // 稍微拉开标题和描述文字的距离
  },
  sceneName: { fontWeight: '900', letterSpacing: -0.5 },
  confidenceBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  
  signalsList: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10, // 增大了标签之间的间距
    marginBottom: spacing.lg // 大幅拉开了标签和底部按钮的距离
  },
  signalChip: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 999 
  },
  
  actionsContainer: { width: '100%', gap: spacing.md }, // 拉开了按钮之间的上下距离
  rowActions: { flexDirection: 'row', gap: spacing.md }, // 拉开了按钮之间的左右距离
  pillButton: { flex: 1, borderRadius: 999 }, 
  buttonContent: { height: 48 },
  primaryButtonContent: { height: 54 },
  emptyContainer: { alignItems: 'center', paddingVertical: 30 },
  emptyActions: { width: '100%' },
});
export default MainSceneCard;