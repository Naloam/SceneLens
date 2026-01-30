/**
 * MLPredictionDetailCard - AI 模型预测详情卡片
 * 
 * 展示图像分类和音频分类模型的详细预测结果，包括：
 * - 预测标签及置信度分布
 * - 图像/音频来源标识
 * - 标签到场景的映射关系
 * - 预测结果可视化（条形图）
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Card,
  Text,
  Surface,
  Chip,
  IconButton,
  ProgressBar,
  Divider,
  Button,
} from 'react-native-paper';
import { spacing } from '../../theme/spacing';
import type { Prediction, SceneType } from '../../types';

/**
 * 图像标签到场景的映射（与 UnifiedSceneAnalyzer 保持一致）
 */
const IMAGE_LABEL_TO_SCENE: Record<string, SceneType[]> = {
  'indoor_office': ['OFFICE'],
  'indoor_home': ['HOME', 'SLEEP'],
  'outdoor_street': ['COMMUTE', 'TRAVEL'],
  'outdoor_park': ['HOME', 'STUDY'],
  'transport_subway': ['COMMUTE'],
  'transport_bus': ['COMMUTE'],
  'transport_car': ['COMMUTE', 'TRAVEL'],
  'restaurant': ['HOME'],
  'gym': ['STUDY'],
  'library': ['STUDY'],
};

/**
 * 音频标签到场景的映射
 */
const AUDIO_LABEL_TO_SCENE: Record<string, SceneType[]> = {
  'silence': ['SLEEP', 'STUDY', 'HOME'],
  'speech': ['OFFICE', 'HOME'],
  'music': ['COMMUTE', 'HOME', 'STUDY'],
  'traffic': ['COMMUTE', 'TRAVEL'],
  'nature': ['HOME', 'TRAVEL'],
  'machinery': ['OFFICE', 'COMMUTE'],
  'crowd': ['COMMUTE', 'TRAVEL'],
  'indoor_quiet': ['HOME', 'STUDY', 'OFFICE'],
  'outdoor_busy': ['COMMUTE', 'TRAVEL'],
};

/**
 * 标签中文名称映射
 */
const LABEL_DISPLAY_NAMES: Record<string, string> = {
  // 图像标签
  'indoor_office': '室内办公室',
  'indoor_home': '室内家居',
  'outdoor_street': '户外街道',
  'outdoor_park': '户外公园',
  'transport_subway': '地铁交通',
  'transport_bus': '公交出行',
  'transport_car': '私家车',
  'restaurant': '餐厅',
  'gym': '健身房',
  'library': '图书馆',
  // 音频标签
  'silence': '安静环境',
  'speech': '人声对话',
  'music': '音乐',
  'traffic': '交通噪音',
  'nature': '自然声音',
  'machinery': '机械声',
  'crowd': '人群嘈杂',
  'indoor_quiet': '室内安静',
  'outdoor_busy': '户外繁忙',
};

/**
 * 场景中文名称
 */
const SCENE_DISPLAY_NAMES: Record<SceneType, string> = {
  COMMUTE: '通勤',
  OFFICE: '办公',
  HOME: '居家',
  STUDY: '学习',
  SLEEP: '休息',
  TRAVEL: '出行',
  UNKNOWN: '未知',
};

/**
 * 场景图标
 */
const SCENE_ICONS: Record<SceneType, string> = {
  COMMUTE: '🚇',
  OFFICE: '🏢',
  HOME: '🏠',
  STUDY: '📚',
  SLEEP: '😴',
  TRAVEL: '✈️',
  UNKNOWN: '❓',
};

export interface MLPredictionDetailCardProps {
  /** 预测结果数组 */
  predictions: Prediction[];
  /** 推理耗时（毫秒） */
  inferenceTimeMs?: number;
  /** 分析时间戳 */
  timestamp?: number;
  /** 是否展开显示全部 */
  initialExpanded?: boolean;
  /** 点击查看详情回调 */
  onViewDetails?: () => void;
}

export const MLPredictionDetailCard: React.FC<MLPredictionDetailCardProps> = ({
  predictions,
  inferenceTimeMs,
  timestamp,
  initialExpanded = false,
  onViewDetails,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);

  // 分离图像和音频预测
  const { imagePredictions, audioPredictions } = useMemo(() => {
    const image: Prediction[] = [];
    const audio: Prediction[] = [];

    predictions.forEach(pred => {
      if (pred.label.startsWith('image:')) {
        image.push({
          ...pred,
          label: pred.label.replace('image:', ''),
        });
      } else if (pred.label.startsWith('audio:')) {
        audio.push({
          ...pred,
          label: pred.label.replace('audio:', ''),
        });
      } else {
        // 尝试根据标签判断来源
        if (IMAGE_LABEL_TO_SCENE[pred.label]) {
          image.push(pred);
        } else if (AUDIO_LABEL_TO_SCENE[pred.label]) {
          audio.push(pred);
        }
      }
    });

    return { imagePredictions: image, audioPredictions: audio };
  }, [predictions]);

  // 计算场景投票分布
  const sceneVotes = useMemo(() => {
    const votes: Map<SceneType, { score: number; sources: string[] }> = new Map();

    // 图像投票
    imagePredictions.forEach(pred => {
      const scenes = IMAGE_LABEL_TO_SCENE[pred.label] || [];
      scenes.forEach(scene => {
        const current = votes.get(scene) || { score: 0, sources: [] };
        current.score += pred.score * 0.5;
        current.sources.push(`📷 ${LABEL_DISPLAY_NAMES[pred.label] || pred.label}`);
        votes.set(scene, current);
      });
    });

    // 音频投票
    audioPredictions.forEach(pred => {
      const scenes = AUDIO_LABEL_TO_SCENE[pred.label] || [];
      scenes.forEach(scene => {
        const current = votes.get(scene) || { score: 0, sources: [] };
        current.score += pred.score * 0.5;
        current.sources.push(`🎤 ${LABEL_DISPLAY_NAMES[pred.label] || pred.label}`);
        votes.set(scene, current);
      });
    });

    // 归一化并排序
    const maxScore = Math.max(...Array.from(votes.values()).map(v => v.score), 0.01);
    return Array.from(votes.entries())
      .map(([scene, data]) => ({
        scene,
        score: data.score / maxScore,
        sources: data.sources,
      }))
      .sort((a, b) => b.score - a.score);
  }, [imagePredictions, audioPredictions]);

  if (predictions.length === 0) {
    return null;
  }

  const topImagePred = imagePredictions[0];
  const topAudioPred = audioPredictions[0];

  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content>
        {/* 标题栏 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.headerIcon}>🤖</Text>
            <Text variant="titleMedium" style={styles.headerTitle}>
              AI 预测详情
            </Text>
          </View>
          <IconButton
            icon={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            onPress={() => setExpanded(!expanded)}
          />
        </View>

        {/* 简要信息 */}
        <View style={styles.summaryRow}>
          {topImagePred && (
            <Chip icon="camera" style={styles.summaryChip} compact>
              {LABEL_DISPLAY_NAMES[topImagePred.label] || topImagePred.label}
            </Chip>
          )}
          {topAudioPred && (
            <Chip icon="microphone" style={styles.summaryChip} compact>
              {LABEL_DISPLAY_NAMES[topAudioPred.label] || topAudioPred.label}
            </Chip>
          )}
          {inferenceTimeMs !== undefined && (
            <Chip icon="timer-outline" style={styles.summaryChip} compact>
              {inferenceTimeMs}ms
            </Chip>
          )}
        </View>

        {/* 场景投票分布 */}
        <View style={styles.section}>
          <Text variant="labelMedium" style={styles.sectionTitle}>
            场景投票分布
          </Text>
          {sceneVotes.slice(0, expanded ? undefined : 3).map(({ scene, score, sources }) => (
            <View key={scene} style={styles.voteItem}>
              <View style={styles.voteHeader}>
                <Text style={styles.voteIcon}>{SCENE_ICONS[scene]}</Text>
                <Text variant="bodyMedium" style={styles.voteLabel}>
                  {SCENE_DISPLAY_NAMES[scene]}
                </Text>
                <Text variant="bodySmall" style={styles.voteScore}>
                  {(score * 100).toFixed(0)}%
                </Text>
              </View>
              <ProgressBar
                progress={score}
                style={styles.progressBar}
                color={score > 0.6 ? '#4CAF50' : score > 0.3 ? '#FF9800' : '#9E9E9E'}
              />
              {expanded && (
                <Text variant="bodySmall" style={styles.voteSources}>
                  来源: {sources.join(', ')}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* 展开时显示详细预测 */}
        {expanded && (
          <>
            <Divider style={styles.divider} />

            {/* 图像分类详情 */}
            {imagePredictions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionIcon}>📷</Text>
                  <Text variant="titleSmall" style={styles.sectionTitle}>
                    图像分类结果
                  </Text>
                </View>
                <Surface style={styles.predictionList} elevation={0}>
                  {imagePredictions.slice(0, 5).map((pred, index) => (
                    <View key={index} style={styles.predictionItem}>
                      <Text variant="bodyMedium" style={styles.predictionLabel}>
                        {LABEL_DISPLAY_NAMES[pred.label] || pred.label}
                      </Text>
                      <View style={styles.predictionScore}>
                        <ProgressBar
                          progress={pred.score}
                          style={styles.smallProgressBar}
                          color="#2196F3"
                        />
                        <Text variant="bodySmall" style={styles.scoreText}>
                          {(pred.score * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </Surface>
              </View>
            )}

            {/* 音频分类详情 */}
            {audioPredictions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionIcon}>🎤</Text>
                  <Text variant="titleSmall" style={styles.sectionTitle}>
                    音频分类结果
                  </Text>
                </View>
                <Surface style={styles.predictionList} elevation={0}>
                  {audioPredictions.slice(0, 5).map((pred, index) => (
                    <View key={index} style={styles.predictionItem}>
                      <Text variant="bodyMedium" style={styles.predictionLabel}>
                        {LABEL_DISPLAY_NAMES[pred.label] || pred.label}
                      </Text>
                      <View style={styles.predictionScore}>
                        <ProgressBar
                          progress={pred.score}
                          style={styles.smallProgressBar}
                          color="#9C27B0"
                        />
                        <Text variant="bodySmall" style={styles.scoreText}>
                          {(pred.score * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </Surface>
              </View>
            )}

            {/* 标签映射说明 */}
            <View style={styles.mappingInfo}>
              <Text variant="bodySmall" style={styles.mappingText}>
                💡 AI 模型将场景特征（图像/音频）映射到预定义场景类型，
                多个特征投票确定最终场景
              </Text>
            </View>

            {/* 时间戳 */}
            {timestamp && (
              <Text variant="bodySmall" style={styles.timestamp}>
                分析时间: {new Date(timestamp).toLocaleString('zh-CN')}
              </Text>
            )}
          </>
        )}

        {/* 查看详情按钮 */}
        {onViewDetails && (
          <Button
            mode="text"
            onPress={onViewDetails}
            style={styles.detailButton}
            icon="arrow-right"
            contentStyle={styles.detailButtonContent}
          >
            查看完整分析
          </Button>
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
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  summaryChip: {
    backgroundColor: '#F5F5F5',
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
    color: '#666',
    marginBottom: spacing.xs,
  },
  voteItem: {
    marginBottom: spacing.sm,
  },
  voteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  voteIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  voteLabel: {
    flex: 1,
    fontWeight: '500',
  },
  voteScore: {
    color: '#666',
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  voteSources: {
    color: '#888',
    marginTop: 2,
    fontSize: 11,
  },
  divider: {
    marginVertical: spacing.md,
  },
  predictionList: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: spacing.sm,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  predictionLabel: {
    flex: 1,
    minWidth: 80,
  },
  predictionScore: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  smallProgressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  scoreText: {
    width: 45,
    textAlign: 'right',
    color: '#666',
    fontSize: 11,
  },
  mappingInfo: {
    backgroundColor: '#E3F2FD',
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  mappingText: {
    color: '#1565C0',
    lineHeight: 18,
  },
  timestamp: {
    color: '#999',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  detailButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
  detailButtonContent: {
    flexDirection: 'row-reverse',
  },
});

export default MLPredictionDetailCard;
