/**
 * PredictionCard - 预测卡片组件 (主题动态适配版)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  ActivityIndicator, 
  Surface, 
  IconButton, 
  useTheme 
} from 'react-native-paper';
import { contextPredictor } from '../../prediction/ContextPredictor';
import { getSceneContainerColor } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import type { SceneType } from '../../types';
import type { ScenePrediction, DepartureReminder } from '../../prediction/types';

const sceneIcons: Record<SceneType, string> = { 
  COMMUTE: '🚇', 
  OFFICE: '🏢', 
  HOME: '🏠', 
  STUDY: '📚', 
  SLEEP: '😴', 
  TRAVEL: '✈️', 
  UNKNOWN: '❓' 
};

const sceneLabels: Record<SceneType, string> = { 
  COMMUTE: '通勤', 
  OFFICE: '办公室', 
  HOME: '家', 
  STUDY: '学习', 
  SLEEP: '睡眠', 
  TRAVEL: '出行', 
  UNKNOWN: '未知' 
};

export interface PredictionCardProps {
  currentScene: SceneType;
  onPredictionTap?: (prediction: ScenePrediction) => void;
  onDepartureReminderTap?: (reminder: DepartureReminder) => void;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ 
  currentScene, 
  onPredictionTap, 
  onDepartureReminderTap 
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<ScenePrediction | null>(null);
  const [departureReminder, setDepartureReminder] = useState<DepartureReminder | null>(null);
  const [expanded, setExpanded] = useState(false);

  const loadPredictions = useCallback(async () => {
    setLoading(true);
    try {
      await contextPredictor.initialize();
      setPrediction(await contextPredictor.predictTimeToNextScene(currentScene));
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
        <View style={styles.header}>
          <Text 
            variant="titleMedium" 
            style={[styles.headerTitle, { color: theme.colors.onSurfaceVariant }]}
          >
           🔮 行为模式预测
          </Text>
          <IconButton 
            icon={expanded ? 'chevron-up' : 'chevron-down'} 
            size={22} 
            iconColor={theme.colors.onSurfaceVariant} 
            onPress={() => setExpanded(!expanded)} 
            style={styles.iconButton} 
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text 
              variant="bodySmall" 
              style={{ color: theme.colors.onSurfaceVariant, marginTop: spacing.sm }}
            >
              正在分析历史习惯...
            </Text>
          </View>
        ) : !prediction && !departureReminder ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text 
              variant="titleSmall" 
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}
            >
              数据积累中
            </Text>
            <Text 
              variant="bodySmall" 
              style={{ 
                color: theme.colors.onSurfaceVariant, 
                opacity: 0.7, 
                textAlign: 'center' 
              }}
            >
              系统需要几天时间学习您的日常习惯以提供精准预测
            </Text>
          </View>
        ) : (
          <View style={styles.contentSection}>
            {departureReminder && (
              <Surface 
                style={[
                  styles.reminderSurface, 
                  { backgroundColor: theme.colors.tertiaryContainer }
                ]} 
                elevation={0}
              >
                <View style={styles.reminderContent}>
                  <Text style={styles.reminderIcon}>⏰</Text>
                  <View style={styles.reminderTextContainer}>
                    <Text 
                      variant="titleSmall" 
                      style={{ color: theme.colors.onTertiaryContainer, fontWeight: '700' }}
                    >
                      出发提醒
                    </Text>
                    <Text 
                      variant="bodySmall" 
                      style={{ 
                        color: theme.colors.onTertiaryContainer, 
                        marginTop: 2, 
                        opacity: 0.9 
                      }}
                    >
                      {departureReminder.message}
                    </Text>
                  </View>
                </View>
                {onDepartureReminderTap && (
                  <Button 
                    mode="text" 
                    compact 
                    onPress={() => onDepartureReminderTap(departureReminder)} 
                    labelStyle={{ color: theme.colors.tertiary }} 
                    style={{ alignSelf: 'flex-end' }}
                  >
                    处理
                  </Button>
                )}
              </Surface>
            )}

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
                      <Text 
                        variant="bodySmall" 
                        style={{ color: theme.colors.onSurfaceVariant, fontWeight: '500' }}
                      >
                        预计 {prediction.minutesUntil} 分钟后
                      </Text>
                      <Text 
                        variant="titleMedium" 
                        style={{ color: theme.colors.onSurface, fontWeight: '800', marginTop: 2 }}
                      >
                        进入 {sceneLabels[prediction.sceneType]}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.predictionRight}>
                    <Text 
                      variant="titleLarge" 
                      style={{ color: theme.colors.primary, fontWeight: '800' }}
                    >
                      {prediction.predictedTime}
                    </Text>
                    <Text 
                      variant="labelSmall" 
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      置信度 {(prediction.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              </Surface>
            )}

            {expanded && (
              <View style={styles.expandedContent}>
                <Text 
                  variant="labelSmall" 
                  style={[styles.expandedLabel, { color: theme.colors.primary }]}
                >
                  预测模型指标
                </Text>
                <View style={[styles.statsRow, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <View style={styles.statItem}>
                    <Text 
                      variant="bodySmall" 
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      通勤估计
                    </Text>
                    <Text 
                      variant="titleMedium" 
                      style={{ color: theme.colors.onSurface, fontWeight: '700' }}
                    >
                      {contextPredictor.getStats().commuteEstimate}m
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text 
                      variant="bodySmall" 
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      时间模式
                    </Text>
                    <Text 
                      variant="titleMedium" 
                      style={{ color: theme.colors.onSurface, fontWeight: '700' }}
                    >
                      {contextPredictor.getStats().timePatternStats.totalPatterns}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text 
                      variant="bodySmall" 
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      行为模式
                    </Text>
                    <Text 
                      variant="titleMedium" 
                      style={{ color: theme.colors.onSurface, fontWeight: '700' }}
                    >
                      {contextPredictor.getStats().behaviorStats.totalPatterns}
                    </Text>
                  </View>
                </View>
                <Button 
                  mode="contained-tonal" 
                  compact 
                  onPress={loadPredictions} 
                  style={styles.refreshButton} 
                  icon="refresh"
                >
                  重新分析
                </Button>
              </View>
            )}
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
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.xs 
  },
  headerTitle: { 
    fontWeight: '600', 
    letterSpacing: 0.5 
  },
  iconButton: { 
    margin: 0 
  },
  loadingContainer: { 
    alignItems: 'center', 
    paddingVertical: spacing.xl 
  },
  emptyContainer: { 
    alignItems: 'center', 
    paddingVertical: spacing.lg, 
    paddingHorizontal: spacing.xl 
  },
  emptyIcon: { 
    fontSize: 36, 
    marginBottom: spacing.sm 
  },
  contentSection: { 
    gap: spacing.sm 
  },
  reminderSurface: { 
    borderRadius: borderRadius.lg, 
    padding: spacing.md 
  },
  reminderContent: { 
    flexDirection: 'row', 
    alignItems: 'flex-start' 
  },
  reminderIcon: { 
    fontSize: 24, 
    marginRight: spacing.sm 
  },
  reminderTextContainer: { 
    flex: 1 
  },
  predictionSurface: { 
    borderRadius: borderRadius.lg, 
    padding: spacing.md 
  },
  predictionContent: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  predictionLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  predictionIcon: { 
    fontSize: 36, 
    marginRight: spacing.md 
  },
  predictionTextContainer: { 
    flex: 1 
  },
  predictionRight: { 
    alignItems: 'flex-end' 
  },
  expandedContent: { 
    marginTop: spacing.xs 
  },
  expandedLabel: { 
    marginBottom: spacing.xs, 
    fontWeight: '600' 
  },
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.lg, 
    marginBottom: spacing.md 
  },
  statItem: { 
    alignItems: 'center' 
  },
  refreshButton: { 
    alignSelf: 'center', 
    borderRadius: borderRadius.lg 
  },
});

export default PredictionCard;