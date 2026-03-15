/**
 * FeedbackReportCard - 反馈报告卡片 (主题动态适配版)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, Surface, ActivityIndicator, IconButton, useTheme } from 'react-native-paper';
import { feedbackProcessor } from '../../learning/FeedbackProcessor';
import { spacing, borderRadius } from '../../theme/spacing';
import type { PersonalizationReport, FeedbackInsight } from '../../learning/FeedbackProcessor';
import type { SceneType } from '../../types';

export interface FeedbackReportCardProps { onViewDetails?: () => void; }
interface ScenePreference { scene: SceneType; acceptRate: number; count: number; }

export const FeedbackReportCard: React.FC<FeedbackReportCardProps> = ({ onViewDetails }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<PersonalizationReport | null>(null);
  const [insights, setInsights] = useState<FeedbackInsight[]>([]);
  const [scenePreferences, setScenePreferences] = useState<ScenePreference[]>([]);
  const [expanded, setExpanded] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await feedbackProcessor.initialize();
      const personalizationReport = feedbackProcessor.getPersonalizationReport();
      setReport(personalizationReport);
      const prefs: ScenePreference[] = [];
      if (personalizationReport.byScene) {
        for (const [scene, stats] of Object.entries(personalizationReport.byScene)) {
          if (stats) prefs.push({ scene: scene as SceneType, acceptRate: stats.acceptRate, count: stats.total });
        }
      }
      setScenePreferences(prefs.sort((a, b) => b.acceptRate - a.acceptRate));
      setInsights(feedbackProcessor.getInsights().slice(0, 3));
    } catch (error) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const hasEnoughData = report && report.overview.totalFeedback >= 5;

  return (
    <Card mode="elevated" elevation={1} style={[styles.card, { borderRadius: borderRadius.xl, backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.header}>
          <Text variant="titleMedium" style={[styles.headerTitle, { color: theme.colors.onSurfaceVariant }]}>📊 AI 偏好学习</Text>
          <IconButton icon={expanded ? 'chevron-up' : 'chevron-down'} size={22} iconColor={theme.colors.onSurfaceVariant} onPress={() => setExpanded(!expanded)} style={styles.iconButton} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : !hasEnoughData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🌱</Text>
            <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>算法正在成长</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7, textAlign: 'center' }}>提供更多反馈以解锁个性化洞察 ({report?.overview.totalFeedback || 0}/5)</Text>
          </View>
        ) : (
          <View style={styles.contentSection}>
            <View style={styles.statsGrid}>
              <Surface style={[styles.statBox, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>建议采纳率</Text>
                <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: '800', marginTop: 4 }}>{(report.overview.acceptRate * 100).toFixed(0)}%</Text>
              </Surface>
              <Surface style={[styles.statBox, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>互动总次数</Text>
                <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: '800', marginTop: 4 }}>{report.overview.totalFeedback}</Text>
              </Surface>
            </View>

            {scenePreferences.length > 0 && (
              <View style={styles.preferencesSection}>
                <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: '600', marginBottom: spacing.xs }}>高频场景偏好</Text>
                <View style={styles.preferencesRow}>
                  {scenePreferences.slice(0, 3).map((pref) => (
                    <Surface key={pref.scene} style={[styles.preferenceChip, { backgroundColor: theme.colors.secondaryContainer }]} elevation={0}>
                      <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer, fontWeight: '600' }}>
                        {getSceneLabel(pref.scene)} · {(pref.acceptRate * 100).toFixed(0)}%
                      </Text>
                    </Surface>
                  ))}
                </View>
              </View>
            )}

            {expanded && (
              <View style={styles.expandedContent}>
                {insights.length > 0 && (
                  <View style={styles.insightsSection}>
                    <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: '600', marginBottom: spacing.sm }}>最新洞察</Text>
                    {insights.map((insight, index) => (
                      <View key={index} style={styles.insightItem}>
                        <Text style={styles.insightIcon}>{getInsightIcon(insight.type)}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flex: 1, lineHeight: 18 }}>{insight.description}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {onViewDetails && <Button mode="contained-tonal" compact onPress={onViewDetails} style={styles.detailsButton}>查阅完整深度报告</Button>}
              </View>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

function getSceneLabel(scene: string): string { const labels: Record<string, string> = { COMMUTE: '🚇 通勤', OFFICE: '🏢 办公', HOME: '🏠 家', STUDY: '📚 学习', SLEEP: '😴 睡眠', TRAVEL: '✈️ 出行', UNKNOWN: '❓ 未知' }; return labels[scene] || scene; }
function getInsightIcon(type: string): string { const icons: Record<string, string> = { POSITIVE: '✅', NEGATIVE: '⚠️', PATTERN: '📈', SUGGESTION: '💡' }; return icons[type] || '💡'; }

const styles = StyleSheet.create({
  card: {},
  cardContent: { padding: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  headerTitle: { fontWeight: '600', letterSpacing: 0.5 },
  iconButton: { margin: 0 },
  loadingContainer: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 36, marginBottom: spacing.sm },
  contentSection: { gap: spacing.sm },
  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  statBox: { flex: 1, padding: spacing.md, borderRadius: borderRadius.lg },
  preferencesSection: { marginTop: spacing.xs },
  preferencesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preferenceChip: { borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  expandedContent: { marginTop: spacing.xs },
  insightsSection: { backgroundColor: 'rgba(0,0,0,0.02)', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md },
  insightItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  insightIcon: { fontSize: 16, marginRight: spacing.sm },
  detailsButton: { borderRadius: borderRadius.lg },
});
export default FeedbackReportCard;