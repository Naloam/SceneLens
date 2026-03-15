/**
 * ModelStatusCard - AI 模型状态监控卡片 (主题动态适配版)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Surface, Button, IconButton, ActivityIndicator, Chip, useTheme } from 'react-native-paper';
import { ModelRunner } from '../../ml/ModelRunner';
import { spacing, borderRadius } from '../../theme/spacing';

interface ModelInfo { name: string; type: 'image' | 'audio'; loaded: boolean; loading: boolean; inputShape: string; outputShape: string; delegate?: string; labels: string[]; size?: string; }
interface InferenceStats { totalInferences: number; avgTimeMs: number; lastTimeMs: number; successRate: number; }

export interface ModelStatusCardProps { initialExpanded?: boolean; modelRunner?: ModelRunner; inferenceStats?: { image?: InferenceStats; audio?: InferenceStats; }; }

let sharedModelRunner: ModelRunner | null = null;
const getSharedModelRunner = (): ModelRunner => { if (!sharedModelRunner) { sharedModelRunner = new ModelRunner(); } return sharedModelRunner; };

export const ModelStatusCard: React.FC<ModelStatusCardProps> = ({ initialExpanded = false, modelRunner, inferenceStats }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [imageModelInfo, setImageModelInfo] = useState<ModelInfo>({ name: 'MobileNet V3 Small', type: 'image', loaded: false, loading: false, inputShape: '1×224×224×3', outputShape: '1×10', labels: ['indoor_office', 'indoor_home', 'outdoor_street', 'outdoor_park', 'transport_subway', 'transport_bus', 'transport_car', 'restaurant', 'gym', 'library'], size: '~2.5 MB' });
  const [audioModelInfo, setAudioModelInfo] = useState<ModelInfo>({ name: 'YAMNet Lite', type: 'audio', loaded: false, loading: false, inputShape: '1×16000', outputShape: '1×9', labels: ['silence', 'speech', 'music', 'traffic', 'nature', 'machinery', 'crowd', 'indoor_quiet', 'outdoor_busy'], size: '~1.8 MB' });

  const runner = modelRunner || getSharedModelRunner();

  const checkModelStatus = useCallback(() => {
    const modelInfo = runner.getModelInfo();
    setImageModelInfo(prev => ({ ...prev, loaded: runner.isImageModelLoaded(), delegate: modelInfo.image?.delegate }));
    setAudioModelInfo(prev => ({ ...prev, loaded: runner.isAudioModelLoaded(), delegate: modelInfo.audio?.delegate }));
  }, [runner]);

  useEffect(() => { checkModelStatus(); }, [checkModelStatus]);

  const loadImageModel = async () => { setImageModelInfo(prev => ({ ...prev, loading: true })); try { await runner.loadImageModel(); checkModelStatus(); } catch (e) {} finally { setImageModelInfo(prev => ({ ...prev, loading: false })); } };
  const loadAudioModel = async () => { setAudioModelInfo(prev => ({ ...prev, loading: true })); try { await runner.loadAudioModel(); checkModelStatus(); } catch (e) {} finally { setAudioModelInfo(prev => ({ ...prev, loading: false })); } };
  const unloadModels = () => { runner.unloadModels(); checkModelStatus(); };

  const renderModelItem = (info: ModelInfo, onLoad: () => void) => (
    <Surface style={[styles.modelItem, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
      <View style={styles.modelHeader}>
        <View style={styles.modelTitleRow}>
          <Text style={styles.modelIcon}>{info.type === 'image' ? '📷' : '🎤'}</Text>
          <View style={styles.modelTitleCol}>
            <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>{info.name}</Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>{info.size}</Text>
          </View>
        </View>
        <View style={styles.modelStatus}>
          {info.loading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : info.loaded ? (
            <Chip icon="check-circle" style={{ backgroundColor: theme.colors.primaryContainer }} textStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 11, fontWeight: '600' }} compact>已加载</Chip>
          ) : <Button mode="contained-tonal" compact onPress={onLoad}>加载</Button>}
        </View>
      </View>
      {expanded && (
        <View style={styles.modelDetails}>
          <View style={styles.detailRow}><Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>输入形状</Text><Text variant="labelSmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>{info.inputShape}</Text></View>
          <View style={styles.detailRow}><Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>输出形状</Text><Text variant="labelSmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>{info.outputShape}</Text></View>
          {info.delegate && <View style={styles.detailRow}><Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>加速后端</Text><Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>{info.delegate}</Text></View>}
        </View>
      )}
    </Surface>
  );

  return (
    <Card mode="elevated" elevation={1} style={[styles.card, { borderRadius: borderRadius.xl, backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.header}>
          <Text variant="titleMedium" style={[styles.headerTitle, { color: theme.colors.onSurfaceVariant }]}>🧠 端侧推理引擎</Text>
          <View style={styles.headerActions}>
            {(imageModelInfo.loaded || audioModelInfo.loaded) && <Button mode="text" onPress={unloadModels} compact labelStyle={{ color: theme.colors.error }}>释放内存</Button>}
            <IconButton icon={expanded ? 'chevron-up' : 'chevron-down'} size={22} iconColor={theme.colors.onSurfaceVariant} onPress={() => setExpanded(!expanded)} style={{ margin: 0 }} />
          </View>
        </View>

        <View style={styles.quickStatus}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>引擎状态：</Text>
          <Text variant="labelMedium" style={{ color: (imageModelInfo.loaded && audioModelInfo.loaded) ? theme.colors.primary : theme.colors.onSurfaceVariant, fontWeight: '700', marginLeft: spacing.xs }}>
            {imageModelInfo.loaded && audioModelInfo.loaded ? '全量感知就绪' : imageModelInfo.loaded || audioModelInfo.loaded ? '部分模块在线' : '休眠中'}
          </Text>
        </View>

        <View style={styles.modelList}>
          {renderModelItem(imageModelInfo, loadImageModel)}
          {renderModelItem(audioModelInfo, loadAudioModel)}
        </View>

        {expanded && (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Surface style={[styles.techNote, { backgroundColor: theme.colors.secondaryContainer }]} elevation={0}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer, lineHeight: 18 }}>
                💡 当前使用 TensorFlow Lite 引擎在设备本地运行，保护隐私的同时提供毫秒级响应。
              </Text>
            </Surface>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {},
  cardContent: { padding: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  headerTitle: { fontWeight: '600', letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  quickStatus: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  modelList: { gap: spacing.sm },
  modelItem: { borderRadius: borderRadius.lg, padding: spacing.md },
  modelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modelTitleRow: { flexDirection: 'row', alignItems: 'center' },
  modelIcon: { fontSize: 24, marginRight: spacing.sm },
  modelTitleCol: { justifyContent: 'center' },
  modelStatus: { alignItems: 'flex-end' },
  modelDetails: { marginTop: spacing.md, gap: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  techNote: { padding: spacing.md, borderRadius: borderRadius.lg },
});
export default ModelStatusCard;