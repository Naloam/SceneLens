/**
 * FeedbackReportCard - 反馈报告卡片
 * 
 * 显示用户的个性化学习报告和反馈统计
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, Surface, ProgressBar, IconButton } from 'react-native-paper';
import { feedbackProcessor } from '../../learning/FeedbackProcessor';
import { spacing } from '../../theme/spacing';
import type { PersonalizationReport, FeedbackInsight } from '../../learning/FeedbackProcessor';
import type { SceneType } from '../../types';

// ==================== Props 定义 ====================

export interface FeedbackReportCardProps {
  onViewDetails?: () => void;
}

// ==================== 辅助类型 ====================

interface ScenePreference {
  scene: SceneType;
  acceptRate: number;
  count: number;
}

// ==================== 组件实现 ====================

export const FeedbackReportCard: React.FC<FeedbackReportCardProps> = ({
  onViewDetails,
}) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<PersonalizationReport | null>(null);
  const [insights, setInsights] = useState<FeedbackInsight[]>([]);
  const [scenePreferences, setScenePreferences] = useState<ScenePreference[]>([]);
  const [expanded, setExpanded] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await feedbackProcessor.initialize();
      
      const personalizationReport = feedbackProcessor.getPersonalizationReport();
      setReport(personalizationReport);
      
      // 从 byScene 构建 scenePreferences
      const prefs: ScenePreference[] = [];
      if (personalizationReport.byScene) {
        for (const [scene, stats] of Object.entries(personalizationReport.byScene)) {
          if (stats) {
            prefs.push({
              scene: scene as SceneType,
              acceptRate: stats.acceptRate,
              count: stats.total,
            });
          }
        }
      }
      setScenePreferences(prefs.sort((a, b) => b.acceptRate - a.acceptRate));
      
      const feedbackInsights = feedbackProcessor.getInsights();
      setInsights(feedbackInsights.slice(0, 3)); // 只显示前3个洞察
      
    } catch (error) {
      console.error('[FeedbackReportCard] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasEnoughData = report && report.overview.totalFeedback >= 5;

  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content>
        {/* 标题栏 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.headerIcon}>📊</Text>
            <Text variant="titleMedium" style={styles.headerTitle}>
              学习报告
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
            <ProgressBar indeterminate style={styles.progressBar} />
            <Text variant="bodySmall" style={styles.loadingText}>
              生成报告中...
            </Text>
          </View>
        ) : !hasEnoughData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📈</Text>
            <Text variant="bodyMedium" style={styles.emptyTitle}>
              数据收集中
            </Text>
            <Text variant="bodySmall" style={styles.emptyText}>
              需要更多反馈数据生成报告 ({report?.overview.totalFeedback || 0}/5)
            </Text>
          </View>
        ) : (
          <View>
            {/* 接受率统计 */}
            <Surface style={styles.statSurface} elevation={1}>
              <View style={styles.statContent}>
                <View style={styles.statItem}>
                  <Text variant="headlineMedium" style={styles.statValue}>
                    {(report.overview.acceptRate * 100).toFixed(0)}%
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    建议接受率
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text variant="headlineMedium" style={styles.statValue}>
                    {report.overview.totalFeedback}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    总反馈数
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text variant="headlineMedium" style={styles.statValue}>
                    {report.overview.avgResponseTime > 0 
                      ? `${(report.overview.avgResponseTime / 1000).toFixed(1)}s` 
                      : '-'}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    平均响应
                  </Text>
                </View>
              </View>
            </Surface>

            {/* 场景偏好 */}
            {scenePreferences.length > 0 && (
              <View style={styles.preferencesSection}>
                <Text variant="labelSmall" style={styles.sectionLabel}>
                  场景偏好
                </Text>
                <View style={styles.preferencesRow}>
                  {scenePreferences.slice(0, 3).map((pref) => (
                    <Surface key={pref.scene} style={styles.preferenceChip} elevation={0}>
                      <Text variant="bodySmall" style={styles.preferenceText}>
                        {getSceneLabel(pref.scene)} {(pref.acceptRate * 100).toFixed(0)}%
                      </Text>
                    </Surface>
                  ))}
                </View>
              </View>
            )}

            {/* 展开显示洞察 */}
            {expanded && insights.length > 0 && (
              <View style={styles.insightsSection}>
                <Text variant="labelSmall" style={styles.sectionLabel}>
                  最近洞察
                </Text>
                {insights.map((insight, index) => (
                  <View key={index} style={styles.insightItem}>
                    <Text style={styles.insightIcon}>
                      {getInsightIcon(insight.type)}
                    </Text>
                    <Text variant="bodySmall" style={styles.insightText}>
                      {insight.description}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* 操作按钮 */}
            {expanded && onViewDetails && (
              <Button 
                mode="outlined" 
                compact 
                onPress={onViewDetails}
                style={styles.detailsButton}
              >
                查看完整报告
              </Button>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

// ==================== 辅助函数 ====================

function getSceneLabel(scene: string): string {
  const labels: Record<string, string> = {
    COMMUTE: '🚇 通勤',
    OFFICE: '🏢 办公',
    HOME: '🏠 家',
    STUDY: '📚 学习',
    SLEEP: '😴 睡眠',
    TRAVEL: '✈️ 出行',
    UNKNOWN: '❓ 未知',
  };
  return labels[scene] || scene;
}

function getInsightIcon(type: string): string {
  const icons: Record<string, string> = {
    POSITIVE: '✅',
    NEGATIVE: '⚠️',
    PATTERN: '📈',
    SUGGESTION: '💡',
  };
  return icons[type] || '💡';
}

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
    paddingVertical: spacing.md,
  },
  progressBar: {
    marginBottom: spacing.sm,
  },
  loadingText: {
    textAlign: 'center',
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
  statSurface: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  statValue: {
    fontWeight: '700',
    color: '#1976D2',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  preferencesSection: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    color: '#666',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  preferencesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  preferenceChip: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  preferenceText: {
    color: '#1976D2',
  },
  insightsSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  insightIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  insightText: {
    flex: 1,
    color: '#333',
  },
  detailsButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
});

export default FeedbackReportCard;
