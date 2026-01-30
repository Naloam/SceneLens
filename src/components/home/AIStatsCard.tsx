/**
 * AIStatsCard - AI 模型使用统计卡片
 * 
 * 在统计页面展示 AI 模型的使用统计，包括：
 * - 总推理次数（图像/音频）
 * - 平均置信度
 * - 标签分布图表
 * - 日推理趋势
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import {
  Card,
  Text,
  Surface,
  SegmentedButtons,
  ProgressBar,
  Divider,
  IconButton,
} from 'react-native-paper';
import { useMLStatsStore } from '../../stores/mlStatsStore';
import { useShallow } from 'zustand/react/shallow';
import { spacing } from '../../theme/spacing';

const { width: screenWidth } = Dimensions.get('window');

/**
 * 标签中文名称
 */
const LABEL_NAMES: Record<string, string> = {
  // 图像
  'indoor_office': '办公室',
  'indoor_home': '家居',
  'outdoor_street': '街道',
  'outdoor_park': '公园',
  'transport_subway': '地铁',
  'transport_bus': '公交',
  'transport_car': '汽车',
  'restaurant': '餐厅',
  'gym': '健身房',
  'library': '图书馆',
  // 音频
  'silence': '安静',
  'speech': '人声',
  'music': '音乐',
  'traffic': '交通',
  'nature': '自然',
  'machinery': '机械',
  'crowd': '人群',
  'indoor_quiet': '室内静',
  'outdoor_busy': '户外闹',
};

export interface AIStatsCardProps {
  /** 时间范围筛选 */
  timeFilter?: 'today' | 'week' | 'month';
}

export const AIStatsCard: React.FC<AIStatsCardProps> = ({
  timeFilter = 'week',
}) => {
  const [selectedType, setSelectedType] = useState<'all' | 'image' | 'audio'>('all');
  const [expanded, setExpanded] = useState(false);

  const {
    imageStats,
    audioStats,
    getLabelDistribution,
    getAverageConfidence,
    getTotalInferences,
    getDailyStats,
  } = useMLStatsStore(
    useShallow(state => ({
      imageStats: state.imageStats,
      audioStats: state.audioStats,
      getLabelDistribution: state.getLabelDistribution,
      getAverageConfidence: state.getAverageConfidence,
      getTotalInferences: state.getTotalInferences,
      getDailyStats: state.getDailyStats,
    }))
  );

  // 计算总体统计
  const totalInferences = getTotalInferences();
  const avgConfidence = getAverageConfidence();
  
  // 获取标签分布
  const imageLabelDist = useMemo(() => getLabelDistribution('image'), [imageStats]);
  const audioLabelDist = useMemo(() => getLabelDistribution('audio'), [audioStats]);

  // 获取日统计
  const dailyStats = useMemo(() => {
    const days = timeFilter === 'today' ? 1 : timeFilter === 'week' ? 7 : 30;
    return getDailyStats(days);
  }, [timeFilter, getDailyStats]);

  // 计算成功率
  const imageSuccessRate = imageStats.totalInferences > 0 
    ? imageStats.successCount / imageStats.totalInferences 
    : 0;
  const audioSuccessRate = audioStats.totalInferences > 0 
    ? audioStats.successCount / audioStats.totalInferences 
    : 0;

  // 渲染标签分布
  const renderLabelDistribution = (
    distribution: Array<{ label: string; count: number; percentage: number }>,
    color: string
  ) => {
    if (distribution.length === 0) {
      return (
        <Text variant="bodySmall" style={styles.emptyText}>
          暂无数据
        </Text>
      );
    }

    return distribution.slice(0, 5).map(({ label, count, percentage }) => (
      <View key={label} style={styles.labelItem}>
        <View style={styles.labelHeader}>
          <Text variant="bodySmall" style={styles.labelName}>
            {LABEL_NAMES[label] || label}
          </Text>
          <Text variant="bodySmall" style={styles.labelCount}>
            {count}次 ({(percentage * 100).toFixed(0)}%)
          </Text>
        </View>
        <ProgressBar
          progress={percentage}
          style={styles.labelBar}
          color={color}
        />
      </View>
    ));
  };

  // 渲染日统计趋势（简化的条形图）
  const renderDailyTrend = () => {
    if (dailyStats.length === 0) {
      return (
        <Text variant="bodySmall" style={styles.emptyText}>
          暂无趋势数据
        </Text>
      );
    }

    const maxInferences = Math.max(
      ...dailyStats.map(d => d.imageInferences + d.audioInferences),
      1
    );

    return (
      <View style={styles.trendContainer}>
        {dailyStats.map((day, index) => {
          const total = day.imageInferences + day.audioInferences;
          const height = (total / maxInferences) * 60;
          const imageHeight = (day.imageInferences / maxInferences) * 60;
          const audioHeight = (day.audioInferences / maxInferences) * 60;

          return (
            <View key={day.date} style={styles.trendBar}>
              <View style={styles.barStack}>
                <View
                  style={[
                    styles.barSegment,
                    { height: audioHeight, backgroundColor: '#9C27B0' }
                  ]}
                />
                <View
                  style={[
                    styles.barSegment,
                    { height: imageHeight, backgroundColor: '#2196F3' }
                  ]}
                />
              </View>
              <Text variant="labelSmall" style={styles.trendLabel}>
                {day.date.slice(-2)}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (totalInferences === 0) {
    return (
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🤖</Text>
            <Text variant="titleMedium" style={styles.headerTitle}>
              AI 模型统计
            </Text>
          </View>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text variant="bodyMedium" style={styles.emptyTitle}>
              暂无 AI 使用数据
            </Text>
            <Text variant="bodySmall" style={styles.emptyDesc}>
              使用场景识别功能后，这里将显示 AI 模型的使用统计
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content>
        {/* 标题栏 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.headerIcon}>🤖</Text>
            <Text variant="titleMedium" style={styles.headerTitle}>
              AI 模型统计
            </Text>
          </View>
          <IconButton
            icon={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            onPress={() => setExpanded(!expanded)}
          />
        </View>

        {/* 总体统计 */}
        <View style={styles.summaryRow}>
          <Surface style={styles.summaryItem} elevation={0}>
            <Text variant="headlineSmall" style={styles.summaryValue}>
              {totalInferences}
            </Text>
            <Text variant="bodySmall" style={styles.summaryLabel}>
              总推理次数
            </Text>
          </Surface>
          <Surface style={styles.summaryItem} elevation={0}>
            <Text variant="headlineSmall" style={styles.summaryValue}>
              {(avgConfidence * 100).toFixed(0)}%
            </Text>
            <Text variant="bodySmall" style={styles.summaryLabel}>
              平均置信度
            </Text>
          </Surface>
          <Surface style={styles.summaryItem} elevation={0}>
            <Text variant="headlineSmall" style={styles.summaryValue}>
              {imageStats.avgDuration > 0 
                ? `${imageStats.avgDuration.toFixed(0)}ms`
                : '-'}
            </Text>
            <Text variant="bodySmall" style={styles.summaryLabel}>
              平均耗时
            </Text>
          </Surface>
        </View>

        {/* 模型分类切换 */}
        <SegmentedButtons
          value={selectedType}
          onValueChange={(value) => setSelectedType(value as any)}
          buttons={[
            { value: 'all', label: '全部' },
            { value: 'image', label: `📷 ${imageStats.totalInferences}` },
            { value: 'audio', label: `🎤 ${audioStats.totalInferences}` },
          ]}
          style={styles.segmentedButtons}
        />

        {/* 分模型统计 */}
        {(selectedType === 'all' || selectedType === 'image') && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📷</Text>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                图像分类
              </Text>
              <Text variant="bodySmall" style={styles.successRate}>
                成功率 {(imageSuccessRate * 100).toFixed(0)}%
              </Text>
            </View>
            {renderLabelDistribution(imageLabelDist, '#2196F3')}
          </View>
        )}

        {(selectedType === 'all' || selectedType === 'audio') && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>🎤</Text>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                音频分类
              </Text>
              <Text variant="bodySmall" style={styles.successRate}>
                成功率 {(audioSuccessRate * 100).toFixed(0)}%
              </Text>
            </View>
            {renderLabelDistribution(audioLabelDist, '#9C27B0')}
          </View>
        )}

        {/* 展开时显示趋势 */}
        {expanded && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                📈 使用趋势
              </Text>
              {renderDailyTrend()}
              <View style={styles.trendLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
                  <Text variant="bodySmall">图像</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#9C27B0' }]} />
                  <Text variant="bodySmall">音频</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: spacing.sm,
    marginHorizontal: 4,
  },
  summaryValue: {
    fontWeight: '700',
    color: '#1976D2',
  },
  summaryLabel: {
    color: '#666',
    fontSize: 11,
  },
  segmentedButtons: {
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  sectionTitle: {
    fontWeight: '600',
    flex: 1,
  },
  successRate: {
    color: '#4CAF50',
  },
  labelItem: {
    marginBottom: spacing.xs,
  },
  labelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  labelName: {
    fontWeight: '500',
  },
  labelCount: {
    color: '#666',
    fontSize: 11,
  },
  labelBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  divider: {
    marginVertical: spacing.md,
  },
  trendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 80,
    paddingTop: spacing.sm,
  },
  trendBar: {
    alignItems: 'center',
    flex: 1,
  },
  barStack: {
    width: 16,
    justifyContent: 'flex-end',
  },
  barSegment: {
    width: '100%',
    borderRadius: 2,
    marginTop: 1,
  },
  trendLabel: {
    marginTop: 4,
    color: '#666',
    fontSize: 10,
  },
  trendLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    color: '#666',
    textAlign: 'center',
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});

export default AIStatsCard;
