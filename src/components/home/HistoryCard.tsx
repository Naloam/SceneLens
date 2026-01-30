/**
 * HistoryCard - 场景历史卡片组件
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, IconButton, Surface } from 'react-native-paper';
import { getSceneColor, getSceneContainerColor } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { SceneHistory } from '../../types';

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

export interface HistoryCardProps {
  history: SceneHistory[];
  onShowDetail: (item: SceneHistory) => void;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({
  history,
  onShowDetail,
}) => {
  if (history.length === 0) {
    return null;
  }

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content>
        <Text variant="titleLarge" style={styles.cardTitle}>
          场景历史
        </Text>
        {history.map((item, index) => (
          <View key={index} style={styles.historyItem}>
            <View style={styles.historyLeft}>
              <Surface
                style={[
                  styles.historyIcon,
                  { backgroundColor: getSceneContainerColor(item.sceneType) },
                ]}
                elevation={0}
              >
                <Text style={styles.historyIconText}>
                  {sceneIcons[item.sceneType] || sceneIcons.UNKNOWN}
                </Text>
              </Surface>
              <View style={styles.historyInfo}>
                <Text variant="titleMedium">{item.sceneType}</Text>
                <Text variant="bodySmall" style={styles.historyTime}>
                  {new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
            <View style={styles.historyRight}>
              <Text
                variant="labelLarge"
                style={{
                  color: getSceneColor(item.sceneType),
                }}
              >
                {(item.confidence * 100).toFixed(0)}%
              </Text>
              <IconButton
                icon="chevron-right"
                size={20}
                onPress={() => onShowDetail(item)}
              />
            </View>
          </View>
        ))}
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
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  historyIconText: {
    fontSize: 20,
  },
  historyInfo: {
    flex: 1,
  },
  historyTime: {
    color: '#666',
    marginTop: 2,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default HistoryCard;
