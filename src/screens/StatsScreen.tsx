/**
 * StatsScreen - 统计页面
 * 使用 React Native Paper 和 Material Design 3 规范
 * 展示场景检测统计、最常检测场景排行榜和应用使用统计
 */

import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import {
  Text,
  Card,
  Surface,
  List,
  SegmentedButtons,
  useTheme,
  ProgressBar,
} from 'react-native-paper';
import { useSceneStore, SceneHistory } from '../stores';
import { useShallow } from 'zustand/react/shallow';
import { getSceneColor, getSceneContainerColor } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { SceneType } from '../types';

/**
 * 时间筛选类型
 */
type TimeFilter = 'today' | 'week' | 'month';

/**
 * 场景统计数据
 */
interface SceneStats {
  sceneType: SceneType;
  count: number;
  percentage: number;
}

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

/**
 * 场景名称映射
 */
const sceneNames: Record<string, string> = {
  COMMUTE: '通勤',
  OFFICE: '办公',
  HOME: '在家',
  STUDY: '学习',
  SLEEP: '睡前',
  TRAVEL: '出行',
  UNKNOWN: '未知',
};

export const StatsScreen: React.FC = () => {
  const theme = useTheme();
  const { history } = useSceneStore(
    useShallow(state => ({ history: state.history }))
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');

  /**
   * 根据时间筛选过滤历史记录
   */
  const filteredHistory = useMemo(() => {
    const now = Date.now();
    const startTimeMap = {
      today: now - 24 * 60 * 60 * 1000, // 24小时内
      week: now - 7 * 24 * 60 * 60 * 1000, // 7天内
      month: now - 30 * 24 * 60 * 60 * 1000, // 30天内
    };

    const startTime = startTimeMap[timeFilter];
    return history.filter(item => item.timestamp >= startTime);
  }, [history, timeFilter]);

  /**
   * 计算场景统计数据
   */
  const sceneStats = useMemo(() => {
    const total = filteredHistory.length;
    if (total === 0) return [];

    const counts: Record<string, number> = {};
    filteredHistory.forEach(item => {
      counts[item.sceneType] = (counts[item.sceneType] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([sceneType, count]) => ({
        sceneType: sceneType as SceneType,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredHistory]);

  /**
   * 获取前 3 名最常检测的场景
   */
  const topScenes = useMemo(() => {
    return sceneStats.slice(0, 3);
  }, [sceneStats]);

  /**
   * 计算应用使用统计（基于场景历史中触发的应用）
   * 这里模拟数据，实际应该从 appPreferenceStore 获取
   */
  const appUsageStats = useMemo(() => {
    // 模拟数据：不同场景下的应用使用情况
    return [
      { category: '通勤应用', percentage: 0.75, color: '#FF6B6B' },
      { category: '办公应用', percentage: 0.60, color: '#4ECDC4' },
      { category: '学习应用', percentage: 0.45, color: '#F38181' },
      { category: '娱乐应用', percentage: 0.30, color: '#AA96DA' },
    ];
  }, []);

  /**
   * 获取时间筛选标签
   */
  const getTimeFilterLabel = (filter: TimeFilter): string => {
    const labels = {
      today: '今日',
      week: '本周',
      month: '本月',
    };
    return labels[filter];
  };

  /**
   * 获取场景检测总次数
   */
  const getTotalDetections = () => {
    return filteredHistory.length;
  };

  /**
   * 获取平均置信度
   */
  const getAverageConfidence = () => {
    if (filteredHistory.length === 0) return 0;
    const sum = filteredHistory.reduce((acc, item) => acc + item.confidence, 0);
    return sum / filteredHistory.length;
  };

  /**
   * 渲染场景分布进度条
   */
  const renderSceneDistribution = () => {
    if (sceneStats.length === 0) {
      return (
        <Text variant="bodyMedium" style={styles.emptyText}>
          暂无数据
        </Text>
      );
    }

    return (
      <View style={styles.distributionContainer}>
        {sceneStats.map((stat) => (
          <View key={stat.sceneType} style={styles.distributionItem}>
            <View style={styles.distributionHeader}>
              <View style={styles.distributionLeft}>
                <Text style={styles.sceneIcon}>
                  {sceneIcons[stat.sceneType]}
                </Text>
                <Text variant="bodyMedium" style={styles.sceneName}>
                  {sceneNames[stat.sceneType]}
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.distributionCount}>
                {stat.count}次 ({stat.percentage.toFixed(1)}%)
              </Text>
            </View>
            <ProgressBar
              progress={stat.percentage / 100}
              color={getSceneColor(stat.sceneType)}
              style={styles.progressBar}
            />
          </View>
        ))}
      </View>
    );
  };

  /**
   * 渲染排行榜项目
   */
  const renderLeaderboardItem = (stat: SceneStats, index: number) => {
    const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // 金、银、铜
    const rankIcon = ['🥇', '🥈', '🥉'][index];

    return (
      <List.Item
        key={stat.sceneType}
        title={sceneNames[stat.sceneType]}
        description={`检测 ${stat.count} 次 · 占比 ${stat.percentage.toFixed(1)}%`}
        left={() => (
          <View style={styles.rankContainer}>
            <Text style={styles.rankIcon}>{rankIcon}</Text>
          </View>
        )}
        right={() => (
          <View
            style={[
              styles.sceneBadge,
              { backgroundColor: getSceneContainerColor(stat.sceneType) },
            ]}
          >
            <Text style={styles.sceneBadgeText}>
              {sceneIcons[stat.sceneType]}
            </Text>
          </View>
        )}
        style={styles.leaderboardItem}
      />
    );
  };

  /**
   * 渲染应用使用统计（环形进度条模拟）
   */
  const renderAppUsageStats = () => {
    return (
      <View style={styles.appUsageContainer}>
        {appUsageStats.map((app) => (
          <View key={app.category} style={styles.appUsageItem}>
            <View style={styles.appUsageHeader}>
              <Text variant="bodyMedium" style={styles.appUsageCategory}>
                {app.category}
              </Text>
              <Text
                variant="bodySmall"
                style={[styles.appUsagePercentage, { color: app.color }]}
              >
                {(app.percentage * 100).toFixed(0)}%
              </Text>
            </View>
            <ProgressBar
              progress={app.percentage}
              color={app.color}
              style={styles.appUsageBar}
            />
          </View>
        ))}
      </View>
    );
  };

  const averageConfidence = getAverageConfidence();
  const totalDetections = getTotalDetections();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 头部标题 */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          统计数据
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          场景检测与应用使用分析
        </Text>
      </View>

      {/* 时间筛选器 */}
      <Surface style={styles.filterContainer} elevation={1}>
        <SegmentedButtons
          value={timeFilter}
          onValueChange={(value) => setTimeFilter(value as TimeFilter)}
          buttons={[
            { value: 'today', label: getTimeFilterLabel('today') },
            { value: 'week', label: getTimeFilterLabel('week') },
            { value: 'month', label: getTimeFilterLabel('month') },
          ]}
          style={styles.segmentedButtons}
        />
      </Surface>

      {/* 概览卡片 */}
      <Card mode="outlined" style={styles.overviewCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            概览
          </Text>
          <View style={styles.overviewContent}>
            <View style={styles.overviewItem}>
              <Text variant="headlineSmall" style={styles.overviewValue}>
                {totalDetections}
              </Text>
              <Text variant="bodyMedium" style={styles.overviewLabel}>
                检测次数
              </Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text
                variant="headlineSmall"
                style={[
                  styles.overviewValue,
                  { color: getConfidenceColor(averageConfidence) },
                ]}
              >
                {(averageConfidence * 100).toFixed(0)}%
              </Text>
              <Text variant="bodyMedium" style={styles.overviewLabel}>
                平均置信度
              </Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text variant="headlineSmall" style={styles.overviewValue}>
                {sceneStats.length}
              </Text>
              <Text variant="bodyMedium" style={styles.overviewLabel}>
                场景类型
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* 场景分布卡片 */}
      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            场景分布
          </Text>
          {renderSceneDistribution()}
        </Card.Content>
      </Card>

      {/* 最常检测场景排行榜 */}
      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            最常检测场景
          </Text>
          {topScenes.length > 0 ? (
            topScenes.map((stat, index) => renderLeaderboardItem(stat, index))
          ) : (
            <Text variant="bodyMedium" style={styles.emptyText}>
              暂无数据
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* 应用使用统计 */}
      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            应用使用统计
          </Text>
          <Text variant="bodySmall" style={styles.cardSubtitle}>
            基于场景检测的应用启动频率
          </Text>
          {renderAppUsageStats()}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

/**
 * 获取置信度颜色
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return '#386A20'; // 绿色
  if (confidence >= 0.4) return '#7D5700'; // 黄色
  return '#B3261E'; // 红色
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: spacing.xs,
    color: '#666',
  },
  filterContainer: {
    marginBottom: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
  },
  segmentedButtons: {
    paddingVertical: spacing.sm,
  },
  overviewCard: {
    marginBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  cardSubtitle: {
    marginBottom: spacing.sm,
    color: '#666',
  },
  overviewContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  overviewItem: {
    alignItems: 'center',
    flex: 1,
  },
  overviewValue: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  overviewLabel: {
    color: '#666',
  },
  overviewDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  distributionContainer: {
    gap: spacing.md,
  },
  distributionItem: {
    gap: spacing.xs,
  },
  distributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distributionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sceneIcon: {
    fontSize: 20,
  },
  sceneName: {
    fontWeight: '600',
  },
  distributionCount: {
    color: '#666',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F0F0F0',
  },
  leaderboardItem: {
    paddingVertical: spacing.xs,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankIcon: {
    fontSize: 24,
  },
  sceneBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneBadgeText: {
    fontSize: 20,
  },
  appUsageContainer: {
    gap: spacing.md,
  },
  appUsageItem: {
    gap: spacing.xs,
  },
  appUsageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appUsageCategory: {
    fontWeight: '600',
  },
  appUsagePercentage: {
    fontWeight: '700',
  },
  appUsageBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: spacing.xl,
  },
});

export default StatsScreen;
