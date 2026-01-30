/**
 * PredictionCard - 预测卡片组件
 * 
 * 显示场景预测、出发提醒等预测性信息
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Surface, IconButton } from 'react-native-paper';
import { contextPredictor } from '../../prediction/ContextPredictor';
import { getSceneColor, getSceneContainerColor } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { SceneType } from '../../types';
import type { ScenePrediction, DepartureReminder } from '../../prediction/types';

// ==================== 场景配置 ====================

const sceneIcons: Record<SceneType, string> = {
  COMMUTE: '🚇',
  OFFICE: '🏢',
  HOME: '🏠',
  STUDY: '📚',
  SLEEP: '😴',
  TRAVEL: '✈️',
  UNKNOWN: '❓',
};

const sceneLabels: Record<SceneType, string> = {
  COMMUTE: '通勤',
  OFFICE: '办公室',
  HOME: '家',
  STUDY: '学习',
  SLEEP: '睡眠',
  TRAVEL: '出行',
  UNKNOWN: '未知',
};

// ==================== Props 定义 ====================

export interface PredictionCardProps {
  currentScene: SceneType;
  onPredictionTap?: (prediction: ScenePrediction) => void;
  onDepartureReminderTap?: (reminder: DepartureReminder) => void;
}

// ==================== 组件实现 ====================

export const PredictionCard: React.FC<PredictionCardProps> = ({
  currentScene,
  onPredictionTap,
  onDepartureReminderTap,
}) => {
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<ScenePrediction | null>(null);
  const [departureReminder, setDepartureReminder] = useState<DepartureReminder | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 加载预测数据
  const loadPredictions = useCallback(async () => {
    setLoading(true);
    try {
      await contextPredictor.initialize();
      
      // 获取下一场景预测
      const nextScene = await contextPredictor.predictTimeToNextScene(currentScene);
      setPrediction(nextScene);
      
      // 获取出发提醒
      const reminder = await contextPredictor.shouldRemindDeparture(currentScene);
      setDepartureReminder(reminder.shouldRemind ? reminder : null);
      
    } catch (error) {
      console.error('[PredictionCard] Failed to load predictions:', error);
    } finally {
      setLoading(false);
    }
  }, [currentScene]);

  useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  // 刷新预测
  const handleRefresh = useCallback(() => {
    loadPredictions();
  }, [loadPredictions]);

  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content>
        {/* 标题栏 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.headerIcon}>🔮</Text>
            <Text variant="titleMedium" style={styles.headerTitle}>
              智能预测
            </Text>
          </View>
          <IconButton
            icon={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            onPress={() => setExpanded(!expanded)}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" />
            <Text variant="bodySmall" style={styles.loadingText}>
              分析中...
            </Text>
          </View>
        ) : !prediction && !departureReminder ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text variant="bodyMedium" style={styles.emptyTitle}>
              正在学习您的习惯
            </Text>
            <Text variant="bodySmall" style={styles.emptyText}>
              使用几天后，这里将显示智能预测和出发提醒
            </Text>
          </View>
        ) : (
          <View>
            {/* 出发提醒 - 优先显示 */}
            {departureReminder && (
              <Surface style={styles.reminderSurface} elevation={1}>
                <View style={styles.reminderContent}>
                  <Text style={styles.reminderIcon}>⏰</Text>
                  <View style={styles.reminderTextContainer}>
                    <Text variant="titleSmall" style={styles.reminderTitle}>
                      出发提醒
                    </Text>
                    <Text variant="bodySmall" style={styles.reminderMessage}>
                      {departureReminder.message}
                    </Text>
                  </View>
                </View>
                {onDepartureReminderTap && (
                  <Button 
                    mode="contained-tonal" 
                    compact 
                    onPress={() => onDepartureReminderTap(departureReminder)}
                    style={styles.reminderButton}
                  >
                    查看
                  </Button>
                )}
              </Surface>
            )}

            {/* 场景预测 */}
            {prediction && (
              <Surface 
                style={[
                  styles.predictionSurface,
                  { backgroundColor: getSceneContainerColor(prediction.sceneType) }
                ]} 
                elevation={0}
              >
                <View style={styles.predictionContent}>
                  <View style={styles.predictionLeft}>
                    <Text style={styles.predictionIcon}>
                      {sceneIcons[prediction.sceneType]}
                    </Text>
                    <View style={styles.predictionTextContainer}>
                      <Text variant="bodyMedium" style={styles.predictionLabel}>
                        预计 {prediction.minutesUntil} 分钟后
                      </Text>
                      <Text variant="titleMedium" style={styles.predictionScene}>
                        进入{sceneLabels[prediction.sceneType]}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.predictionRight}>
                    <Text variant="bodySmall" style={styles.predictionTime}>
                      {prediction.predictedTime}
                    </Text>
                    <Text variant="labelSmall" style={styles.predictionConfidence}>
                      置信度 {(prediction.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
                {onPredictionTap && (
                  <Button 
                    mode="text" 
                    compact 
                    onPress={() => onPredictionTap(prediction)}
                    style={styles.predictionButton}
                  >
                    详情
                  </Button>
                )}
              </Surface>
            )}

            {/* 展开时显示更多信息 */}
            {expanded && (
              <View style={styles.expandedContent}>
                <Text variant="labelSmall" style={styles.expandedLabel}>
                  预测统计
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      通勤估计
                    </Text>
                    <Text variant="titleSmall" style={styles.statValue}>
                      {contextPredictor.getStats().commuteEstimate} 分钟
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      时间模式
                    </Text>
                    <Text variant="titleSmall" style={styles.statValue}>
                      {contextPredictor.getStats().timePatternStats.totalPatterns} 个
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      行为模式
                    </Text>
                    <Text variant="titleSmall" style={styles.statValue}>
                      {contextPredictor.getStats().behaviorStats.totalPatterns} 个
                    </Text>
                  </View>
                </View>
                <Button 
                  mode="outlined" 
                  compact 
                  onPress={handleRefresh}
                  style={styles.refreshButton}
                  icon="refresh"
                >
                  刷新预测
                </Button>
              </View>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

// ==================== 样式 ====================

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  headerTitle: {
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  loadingText: {
    marginLeft: spacing.sm,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
  },
  reminderSurface: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: '#FFF3E0',
  },
  reminderContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reminderIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  reminderTextContainer: {
    flex: 1,
  },
  reminderTitle: {
    fontWeight: '600',
    color: '#E65100',
  },
  reminderMessage: {
    color: '#F57C00',
    marginTop: 2,
  },
  reminderButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
  },
  predictionSurface: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  predictionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  predictionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  predictionIcon: {
    fontSize: 32,
    marginRight: spacing.sm,
  },
  predictionTextContainer: {
    flex: 1,
  },
  predictionLabel: {
    color: '#666',
  },
  predictionScene: {
    fontWeight: '600',
  },
  predictionRight: {
    alignItems: 'flex-end',
  },
  predictionTime: {
    fontWeight: '600',
    fontSize: 18,
  },
  predictionConfidence: {
    color: '#666',
  },
  predictionButton: {
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  expandedContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  expandedLabel: {
    color: '#666',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
  },
  statValue: {
    fontWeight: '600',
  },
  refreshButton: {
    alignSelf: 'center',
  },
});

export default PredictionCard;
