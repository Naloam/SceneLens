/**
 * ModelStatusCard - AI 模型状态监控卡片
 * 
 * 展示端侧 AI 模型的运行状态，包括：
 * - 模型加载状态（图像/音频）
 * - 模型规格信息
 * - 推理性能统计
 * - 内存使用情况
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Card,
  Text,
  Surface,
  Button,
  IconButton,
  ProgressBar,
  Divider,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { ModelRunner } from '../../ml/ModelRunner';
import { spacing } from '../../theme/spacing';

/**
 * 模型信息接口
 */
interface ModelInfo {
  name: string;
  type: 'image' | 'audio';
  loaded: boolean;
  loading: boolean;
  inputShape: string;
  outputShape: string;
  delegate?: string;
  labels: string[];
  size?: string;
}

/**
 * 推理统计
 */
interface InferenceStats {
  totalInferences: number;
  avgTimeMs: number;
  lastTimeMs: number;
  successRate: number;
}

export interface ModelStatusCardProps {
  /** 初始展开状态 */
  initialExpanded?: boolean;
  /** 模型运行器实例（可选，默认创建新实例） */
  modelRunner?: ModelRunner;
  /** 推理统计数据 */
  inferenceStats?: {
    image?: InferenceStats;
    audio?: InferenceStats;
  };
}

// 单例模型运行器（用于状态监控）
let sharedModelRunner: ModelRunner | null = null;

const getSharedModelRunner = (): ModelRunner => {
  if (!sharedModelRunner) {
    sharedModelRunner = new ModelRunner();
  }
  return sharedModelRunner;
};

export const ModelStatusCard: React.FC<ModelStatusCardProps> = ({
  initialExpanded = false,
  modelRunner,
  inferenceStats,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [imageModelInfo, setImageModelInfo] = useState<ModelInfo>({
    name: 'MobileNet V3 Small',
    type: 'image',
    loaded: false,
    loading: false,
    inputShape: '1×224×224×3',
    outputShape: '1×10',
    labels: [
      'indoor_office', 'indoor_home', 'outdoor_street', 'outdoor_park',
      'transport_subway', 'transport_bus', 'transport_car',
      'restaurant', 'gym', 'library'
    ],
    size: '~2.5 MB',
  });
  const [audioModelInfo, setAudioModelInfo] = useState<ModelInfo>({
    name: 'YAMNet Lite',
    type: 'audio',
    loaded: false,
    loading: false,
    inputShape: '1×16000',
    outputShape: '1×9',
    labels: [
      'silence', 'speech', 'music', 'traffic', 'nature',
      'machinery', 'crowd', 'indoor_quiet', 'outdoor_busy'
    ],
    size: '~1.8 MB',
  });

  const runner = modelRunner || getSharedModelRunner();

  // 检查模型加载状态
  const checkModelStatus = useCallback(() => {
    const modelInfo = runner.getModelInfo();
    
    setImageModelInfo(prev => ({
      ...prev,
      loaded: runner.isImageModelLoaded(),
      delegate: modelInfo.image?.delegate,
    }));

    setAudioModelInfo(prev => ({
      ...prev,
      loaded: runner.isAudioModelLoaded(),
      delegate: modelInfo.audio?.delegate,
    }));
  }, [runner]);

  useEffect(() => {
    checkModelStatus();
  }, [checkModelStatus]);

  // 加载图像模型
  const loadImageModel = async () => {
    setImageModelInfo(prev => ({ ...prev, loading: true }));
    try {
      await runner.loadImageModel();
      checkModelStatus();
    } catch (error) {
      console.error('Failed to load image model:', error);
    } finally {
      setImageModelInfo(prev => ({ ...prev, loading: false }));
    }
  };

  // 加载音频模型
  const loadAudioModel = async () => {
    setAudioModelInfo(prev => ({ ...prev, loading: true }));
    try {
      await runner.loadAudioModel();
      checkModelStatus();
    } catch (error) {
      console.error('Failed to load audio model:', error);
    } finally {
      setAudioModelInfo(prev => ({ ...prev, loading: false }));
    }
  };

  // 卸载所有模型
  const unloadModels = () => {
    runner.unloadModels();
    checkModelStatus();
  };

  // 渲染模型状态项
  const renderModelItem = (info: ModelInfo, onLoad: () => void) => (
    <Surface style={styles.modelItem} elevation={0}>
      <View style={styles.modelHeader}>
        <View style={styles.modelTitleRow}>
          <Text style={styles.modelIcon}>
            {info.type === 'image' ? '📷' : '🎤'}
          </Text>
          <View style={styles.modelTitleCol}>
            <Text variant="titleSmall" style={styles.modelName}>
              {info.name}
            </Text>
            <Text variant="bodySmall" style={styles.modelSize}>
              {info.size}
            </Text>
          </View>
        </View>
        <View style={styles.modelStatus}>
          {info.loading ? (
            <ActivityIndicator size="small" />
          ) : info.loaded ? (
            <Chip
              icon="check-circle"
              style={styles.loadedChip}
              textStyle={styles.loadedChipText}
              compact
            >
              已加载
            </Chip>
          ) : (
            <Button mode="contained-tonal" compact onPress={onLoad}>
              加载
            </Button>
          )}
        </View>
      </View>

      {/* 模型详情 */}
      {expanded && (
        <View style={styles.modelDetails}>
          <View style={styles.detailRow}>
            <Text variant="bodySmall" style={styles.detailLabel}>
              输入形状:
            </Text>
            <Text variant="bodySmall" style={styles.detailValue}>
              {info.inputShape}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="bodySmall" style={styles.detailLabel}>
              输出形状:
            </Text>
            <Text variant="bodySmall" style={styles.detailValue}>
              {info.outputShape}
            </Text>
          </View>
          {info.delegate && (
            <View style={styles.detailRow}>
              <Text variant="bodySmall" style={styles.detailLabel}>
                加速后端:
              </Text>
              <Text variant="bodySmall" style={styles.detailValue}>
                {info.delegate}
              </Text>
            </View>
          )}
          <View style={styles.labelsRow}>
            <Text variant="bodySmall" style={styles.detailLabel}>
              支持标签:
            </Text>
            <Text variant="bodySmall" style={styles.labelsText}>
              {info.labels.join(', ')}
            </Text>
          </View>
        </View>
      )}
    </Surface>
  );

  // 渲染推理统计
  const renderInferenceStats = (type: 'image' | 'audio', stats?: InferenceStats) => {
    if (!stats) {
      return (
        <Text variant="bodySmall" style={styles.noStatsText}>
          暂无推理数据
        </Text>
      );
    }

    return (
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text variant="titleMedium" style={styles.statValue}>
            {stats.totalInferences}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            总推理次数
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="titleMedium" style={styles.statValue}>
            {stats.avgTimeMs.toFixed(0)}ms
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            平均耗时
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="titleMedium" style={styles.statValue}>
            {(stats.successRate * 100).toFixed(0)}%
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            成功率
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content>
        {/* 标题栏 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.headerIcon}>🧠</Text>
            <Text variant="titleMedium" style={styles.headerTitle}>
              AI 模型状态
            </Text>
          </View>
          <View style={styles.headerActions}>
            {(imageModelInfo.loaded || audioModelInfo.loaded) && (
              <Button
                mode="text"
                onPress={unloadModels}
                compact
                style={styles.unloadButton}
              >
                卸载
              </Button>
            )}
            <IconButton
              icon={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              onPress={() => setExpanded(!expanded)}
            />
          </View>
        </View>

        {/* 快速状态概览 */}
        <View style={styles.quickStatus}>
          <View style={styles.quickStatusItem}>
            <Text style={styles.quickStatusIcon}>📷</Text>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: imageModelInfo.loaded ? '#4CAF50' : '#9E9E9E' }
              ]}
            />
          </View>
          <View style={styles.quickStatusItem}>
            <Text style={styles.quickStatusIcon}>🎤</Text>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: audioModelInfo.loaded ? '#4CAF50' : '#9E9E9E' }
              ]}
            />
          </View>
          <Text variant="bodySmall" style={styles.quickStatusText}>
            {imageModelInfo.loaded && audioModelInfo.loaded
              ? '双模型就绪'
              : imageModelInfo.loaded || audioModelInfo.loaded
              ? '部分就绪'
              : '未加载'}
          </Text>
        </View>

        {/* 模型列表 */}
        <View style={styles.modelList}>
          {renderModelItem(imageModelInfo, loadImageModel)}
          {renderModelItem(audioModelInfo, loadAudioModel)}
        </View>

        {/* 展开时显示推理统计 */}
        {expanded && (
          <>
            <Divider style={styles.divider} />
            
            <View style={styles.section}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                📊 推理统计
              </Text>

              <View style={styles.statsSection}>
                <Text variant="labelMedium" style={styles.statsLabel}>
                  图像分类
                </Text>
                {renderInferenceStats('image', inferenceStats?.image)}
              </View>

              <View style={styles.statsSection}>
                <Text variant="labelMedium" style={styles.statsLabel}>
                  音频分类
                </Text>
                {renderInferenceStats('audio', inferenceStats?.audio)}
              </View>
            </View>

            {/* 技术说明 */}
            <Surface style={styles.techNote} elevation={0}>
              <Text variant="bodySmall" style={styles.techNoteText}>
                💡 模型使用 TensorFlow Lite 运行，支持 CPU/GPU 加速。
                图像模型识别场景类型，音频模型识别环境声音，
                两者结合提供更准确的场景判断。
              </Text>
            </Surface>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unloadButton: {
    marginRight: -spacing.xs,
  },
  quickStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  quickStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  quickStatusIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quickStatusText: {
    color: '#666',
    marginLeft: 'auto',
  },
  modelList: {
    gap: spacing.sm,
  },
  modelItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: spacing.md,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modelIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  modelTitleCol: {
    justifyContent: 'center',
  },
  modelName: {
    fontWeight: '600',
  },
  modelSize: {
    color: '#666',
    fontSize: 11,
  },
  modelStatus: {
    alignItems: 'flex-end',
  },
  loadedChip: {
    backgroundColor: '#E8F5E9',
  },
  loadedChipText: {
    color: '#2E7D32',
    fontSize: 11,
  },
  modelDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  detailLabel: {
    color: '#666',
  },
  detailValue: {
    fontWeight: '500',
  },
  labelsRow: {
    marginTop: spacing.xs,
  },
  labelsText: {
    color: '#888',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  divider: {
    marginVertical: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  statsSection: {
    marginBottom: spacing.md,
  },
  statsLabel: {
    color: '#666',
    marginBottom: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '700',
    color: '#1976D2',
  },
  statLabel: {
    color: '#666',
    fontSize: 11,
  },
  noStatsText: {
    color: '#999',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  techNote: {
    backgroundColor: '#FFF8E1',
    padding: spacing.sm,
    borderRadius: 8,
  },
  techNoteText: {
    color: '#F57F17',
    lineHeight: 18,
  },
});

export default ModelStatusCard;
