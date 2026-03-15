/**
 * HistoryCard - 场景历史卡片组件
 * MD3 呼吸感升级版，去除多余线条
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, IconButton, Surface, TouchableRipple, useTheme } from 'react-native-paper';
import { getSceneColor, getSceneContainerColor } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import type { SceneHistory } from '../../types';

const sceneIcons: Record<string, string> = {
  COMMUTE: '🚇', OFFICE: '🏢', HOME: '🏠', STUDY: '📚', SLEEP: '😴', TRAVEL: '✈️', UNKNOWN: '❓',
};

export interface HistoryCardProps {
  history: SceneHistory[];
  onShowDetail: (item: SceneHistory) => void;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({ history, onShowDetail }) => {
  const theme = useTheme();

  if (history.length === 0) return null;

  return (
    <Card 
      mode="elevated" 
      elevation={1} 
      style={[styles.card, { borderRadius: borderRadius.xl, backgroundColor: theme.colors.surface }]}
    >
      <Card.Content style={styles.cardContent}>
        <Text variant="titleMedium" style={[styles.cardTitle, { color: theme.colors.onSurfaceVariant }]}>
          场景历史
        </Text>
        
        <View style={styles.historyList}>
          {history.map((item, index) => (
            <TouchableRipple 
              key={index} 
              onPress={() => onShowDetail(item)}
              style={styles.historyItemRipple}
              borderless
            >
              <View style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <Surface
                    style={[styles.historyIcon, { backgroundColor: getSceneContainerColor(item.sceneType) }]}
                    elevation={0}
                  >
                    <Text style={styles.historyIconText}>{sceneIcons[item.sceneType] || sceneIcons.UNKNOWN}</Text>
                  </Surface>
                  <View style={styles.historyInfo}>
                    <Text variant="titleMedium" style={{ fontWeight: '600' }}>{item.sceneType}</Text>
                    <Text variant="labelMedium" style={[styles.historyTime, { color: theme.colors.onSurfaceVariant }]}>
                      {new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.historyRight}>
                  <Surface 
                    style={[styles.confidenceBadge, { backgroundColor: getSceneContainerColor(item.sceneType) }]}
                    elevation={0}
                  >
                    <Text variant="labelSmall" style={{ color: getSceneColor(item.sceneType), fontWeight: '700' }}>
                      {(item.confidence * 100).toFixed(0)}%
                    </Text>
                  </Surface>
                  <IconButton icon="chevron-right" size={20} iconColor={theme.colors.onSurfaceVariant} style={{ margin: 0 }} />
                </View>
              </View>
            </TouchableRipple>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    // 移除 marginBottom
  },
  cardContent: {
    padding: spacing.md,
  },
  cardTitle: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  historyList: {
    gap: spacing.xs, // 使用空白来区分每一条记录，而不是用横线
  },
  historyItemRipple: {
    borderRadius: borderRadius.lg, // 点击时的水波纹也会有圆角
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyIcon: {
    width: 44, // 略微放大一点图标背景
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md, // 加大文字和图标的间距
  },
  historyIconText: {
    fontSize: 22,
  },
  historyInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  historyTime: {
    marginTop: 2,
    opacity: 0.8,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs, // 右侧元素的间距
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
});

export default HistoryCard;