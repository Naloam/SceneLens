/**
 * NotificationFilterScreen - 智能通知过滤设置页面
 * 
 * 配置场景策略、应用黑白名单、VIP联系人等
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { 
  Text, 
  Card, 
  List, 
  Switch, 
  Button, 
  Chip, 
  Portal, 
  Dialog, 
  TextInput,
  ActivityIndicator,
  Divider,
  SegmentedButtons,
  Surface,
} from 'react-native-paper';
import { smartNotificationFilter } from '../notifications/SmartNotificationFilter';
import { spacing } from '../theme/spacing';
import type { SceneType } from '../types';
import type { 
  UrgencyLevel, 
  SceneNotificationPolicy, 
  NotificationFilterStats 
} from '../notifications/SmartNotificationFilter';

// ==================== 常量配置 ====================

const sceneLabels: Record<SceneType, string> = {
  COMMUTE: '通勤',
  OFFICE: '办公室',
  HOME: '家',
  STUDY: '学习',
  SLEEP: '睡眠',
  TRAVEL: '出行',
  UNKNOWN: '未知',
};

const sceneIcons: Record<SceneType, string> = {
  COMMUTE: '🚇',
  OFFICE: '🏢',
  HOME: '🏠',
  STUDY: '📚',
  SLEEP: '😴',
  TRAVEL: '✈️',
  UNKNOWN: '❓',
};

const urgencyLabels: Record<UrgencyLevel, string> = {
  CRITICAL: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
  MINIMAL: '最低',
};

const urgencyColors: Record<UrgencyLevel, string> = {
  CRITICAL: '#D32F2F',
  HIGH: '#F57C00',
  MEDIUM: '#FBC02D',
  LOW: '#4CAF50',
  MINIMAL: '#9E9E9E',
};

const urgencyLevels: UrgencyLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'MINIMAL'];

// ==================== 组件实现 ====================

export const NotificationFilterScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [learningMode, setLearningMode] = useState(true);
  const [scenePolicies, setScenePolicies] = useState<Record<SceneType, UrgencyLevel>>({
    COMMUTE: 'MEDIUM',
    OFFICE: 'MEDIUM',
    HOME: 'LOW',
    STUDY: 'MEDIUM',
    SLEEP: 'HIGH',
    TRAVEL: 'MEDIUM',
    UNKNOWN: 'LOW',
  });
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [vipContacts, setVipContacts] = useState<string[]>([]);
  const [stats, setStats] = useState<NotificationFilterStats | null>(null);
  
  // 对话框状态
  const [addAppDialogVisible, setAddAppDialogVisible] = useState(false);
  const [addVipDialogVisible, setAddVipDialogVisible] = useState(false);
  const [policyDialogVisible, setPolicyDialogVisible] = useState(false);
  const [selectedScene, setSelectedScene] = useState<SceneType | null>(null);
  const [appInput, setAppInput] = useState('');
  const [vipInput, setVipInput] = useState('');
  const [listType, setListType] = useState<'blacklist' | 'whitelist'>('blacklist');

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await smartNotificationFilter.initialize();
      
      const filterStats = smartNotificationFilter.getStats();
      setStats(filterStats);
      setEnabled(filterStats.isEnabled);
      setLearningMode(filterStats.learningModeEnabled);
      
      // 加载场景策略
      const policies: Record<SceneType, UrgencyLevel> = {} as Record<SceneType, UrgencyLevel>;
      const scenes: SceneType[] = ['COMMUTE', 'OFFICE', 'HOME', 'STUDY', 'SLEEP', 'TRAVEL', 'UNKNOWN'];
      scenes.forEach(scene => {
        const policy = smartNotificationFilter.getScenePolicy(scene);
        policies[scene] = policy?.minAllowedUrgency || 'LOW';
      });
      setScenePolicies(policies);
      
      // 加载应用列表（从stats中获取）
      // 注意：实际列表管理需要SmartNotificationFilter提供更多API
      
    } catch (error) {
      console.error('[NotificationFilterScreen] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 切换开关
  const handleToggleEnabled = useCallback(async (value: boolean) => {
    setEnabled(value);
    if (value) {
      smartNotificationFilter.enable();
    } else {
      smartNotificationFilter.disable();
    }
  }, []);

  const handleToggleLearning = useCallback(async (value: boolean) => {
    setLearningMode(value);
    if (value) {
      smartNotificationFilter.enableLearningMode();
    } else {
      smartNotificationFilter.disableLearningMode();
    }
  }, []);

  // 场景策略编辑
  const handleScenePress = useCallback((scene: SceneType) => {
    setSelectedScene(scene);
    setPolicyDialogVisible(true);
  }, []);

  const handlePolicyChange = useCallback(async (urgency: UrgencyLevel) => {
    if (!selectedScene) return;
    
    setScenePolicies(prev => ({
      ...prev,
      [selectedScene]: urgency,
    }));
    
    await smartNotificationFilter.setScenePolicy(selectedScene, {
      minAllowedUrgency: urgency,
    });
    
    setPolicyDialogVisible(false);
    setSelectedScene(null);
  }, [selectedScene]);

  // 添加应用到黑/白名单
  const handleAddApp = useCallback(async () => {
    const appId = appInput.trim();
    if (!appId) return;
    
    if (listType === 'blacklist') {
      await smartNotificationFilter.addToBlacklist(appId);
      setBlacklist(prev => [...prev, appId]);
    } else {
      await smartNotificationFilter.addToWhitelist(appId);
      setWhitelist(prev => [...prev, appId]);
    }
    
    setAppInput('');
    setAddAppDialogVisible(false);
  }, [appInput, listType]);

  // 移除应用
  const handleRemoveApp = useCallback(async (appId: string, fromList: 'blacklist' | 'whitelist') => {
    if (fromList === 'blacklist') {
      await smartNotificationFilter.removeFromBlacklist(appId);
      setBlacklist(prev => prev.filter(id => id !== appId));
    } else {
      await smartNotificationFilter.removeFromWhitelist(appId);
      setWhitelist(prev => prev.filter(id => id !== appId));
    }
  }, []);

  // 添加VIP联系人
  const handleAddVip = useCallback(async () => {
    const contact = vipInput.trim();
    if (!contact) return;
    
    await smartNotificationFilter.addVipContact(contact);
    setVipContacts(prev => [...prev, contact]);
    
    setVipInput('');
    setAddVipDialogVisible(false);
  }, [vipInput]);

  // 移除VIP联系人
  const handleRemoveVip = useCallback(async (contact: string) => {
    await smartNotificationFilter.removeVipContact(contact);
    setVipContacts(prev => prev.filter(c => c !== contact));
  }, []);

  // 清除历史
  const handleClearHistory = useCallback(() => {
    Alert.alert(
      '清除过滤历史',
      '确定要清除所有通知过滤历史吗？这不会影响您的设置。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '清除', 
          style: 'destructive',
          onPress: async () => {
            await smartNotificationFilter.clearHistory();
            loadData();
          }
        },
      ]
    );
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* 主开关 */}
      <Card style={styles.card}>
        <Card.Content>
          <List.Item
            title="启用智能通知过滤"
            description="根据场景自动过滤不重要的通知"
            left={props => <List.Icon {...props} icon="filter" />}
            right={() => (
              <Switch 
                value={enabled} 
                onValueChange={handleToggleEnabled}
              />
            )}
          />
          <Divider />
          <List.Item
            title="学习模式"
            description="记录您对通知的处理方式以优化过滤"
            left={props => <List.Icon {...props} icon="school" />}
            right={() => (
              <Switch 
                value={learningMode} 
                onValueChange={handleToggleLearning}
                disabled={!enabled}
              />
            )}
          />
        </Card.Content>
      </Card>

      {/* 统计信息 */}
      {stats && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              📊 过滤统计
            </Text>
            <View style={styles.statsGrid}>
              <Surface style={styles.statItem} elevation={1}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.totalFiltered}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  已过滤
                </Text>
              </Surface>
              <Surface style={styles.statItem} elevation={1}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.totalPassed}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  已放行
                </Text>
              </Surface>
              <Surface style={styles.statItem} elevation={1}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.filterRate.toFixed(0)}%
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  过滤率
                </Text>
              </Surface>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* 场景策略 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            🎯 场景策略
          </Text>
          <Text variant="bodySmall" style={styles.sectionDesc}>
            设置每个场景下允许的最低通知优先级
          </Text>
          
          {(['SLEEP', 'STUDY', 'OFFICE', 'COMMUTE', 'HOME', 'TRAVEL'] as SceneType[]).map((scene) => (
            <List.Item
              key={scene}
              title={`${sceneIcons[scene]} ${sceneLabels[scene]}`}
              description={`只允许 ${urgencyLabels[scenePolicies[scene]]} 及以上`}
              onPress={() => handleScenePress(scene)}
              right={() => (
                <Chip 
                  style={{ backgroundColor: urgencyColors[scenePolicies[scene]] + '20' }}
                  textStyle={{ color: urgencyColors[scenePolicies[scene]] }}
                >
                  {urgencyLabels[scenePolicies[scene]]}
                </Chip>
              )}
            />
          ))}
        </Card.Content>
      </Card>

      {/* 应用管理 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            📱 应用管理
          </Text>
          
          {/* 黑名单 */}
          <Text variant="labelMedium" style={styles.subTitle}>
            黑名单（始终过滤）
          </Text>
          <View style={styles.chipContainer}>
            {blacklist.length === 0 ? (
              <Text variant="bodySmall" style={styles.emptyText}>
                暂无应用
              </Text>
            ) : (
              blacklist.map((app) => (
                <Chip 
                  key={app}
                  onClose={() => handleRemoveApp(app, 'blacklist')}
                  style={styles.chip}
                >
                  {app}
                </Chip>
              ))
            )}
            <Chip 
              icon="plus" 
              onPress={() => { setListType('blacklist'); setAddAppDialogVisible(true); }}
              style={styles.addChip}
            >
              添加
            </Chip>
          </View>

          {/* 白名单 */}
          <Text variant="labelMedium" style={[styles.subTitle, { marginTop: spacing.md }]}>
            白名单（始终放行）
          </Text>
          <View style={styles.chipContainer}>
            {whitelist.length === 0 ? (
              <Text variant="bodySmall" style={styles.emptyText}>
                暂无应用
              </Text>
            ) : (
              whitelist.map((app) => (
                <Chip 
                  key={app}
                  onClose={() => handleRemoveApp(app, 'whitelist')}
                  style={styles.chip}
                >
                  {app}
                </Chip>
              ))
            )}
            <Chip 
              icon="plus" 
              onPress={() => { setListType('whitelist'); setAddAppDialogVisible(true); }}
              style={styles.addChip}
            >
              添加
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* VIP联系人 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            ⭐ VIP联系人
          </Text>
          <Text variant="bodySmall" style={styles.sectionDesc}>
            来自VIP联系人的通知将始终放行
          </Text>
          <View style={styles.chipContainer}>
            {vipContacts.length === 0 ? (
              <Text variant="bodySmall" style={styles.emptyText}>
                暂无VIP联系人
              </Text>
            ) : (
              vipContacts.map((contact) => (
                <Chip 
                  key={contact}
                  icon="star"
                  onClose={() => handleRemoveVip(contact)}
                  style={styles.chip}
                >
                  {contact}
                </Chip>
              ))
            )}
            <Chip 
              icon="plus" 
              onPress={() => setAddVipDialogVisible(true)}
              style={styles.addChip}
            >
              添加
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* 操作按钮 */}
      <Card style={[styles.card, { marginBottom: spacing.xl }]}>
        <Card.Content>
          <Button 
            mode="outlined" 
            onPress={handleClearHistory}
            icon="delete"
          >
            清除过滤历史
          </Button>
        </Card.Content>
      </Card>

      {/* 场景策略选择对话框 */}
      <Portal>
        <Dialog 
          visible={policyDialogVisible} 
          onDismiss={() => setPolicyDialogVisible(false)}
        >
          <Dialog.Title>
            {selectedScene && `${sceneIcons[selectedScene]} ${sceneLabels[selectedScene]} 策略`}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: spacing.md }}>
              选择此场景下允许的最低通知优先级：
            </Text>
            {urgencyLevels.map((level) => (
              <List.Item
                key={level}
                title={urgencyLabels[level]}
                description={getUrgencyDescription(level)}
                onPress={() => handlePolicyChange(level)}
                left={() => (
                  <View style={[styles.urgencyDot, { backgroundColor: urgencyColors[level] }]} />
                )}
                right={() => 
                  selectedScene && scenePolicies[selectedScene] === level ? (
                    <List.Icon icon="check" />
                  ) : null
                }
              />
            ))}
          </Dialog.Content>
        </Dialog>

        {/* 添加应用对话框 */}
        <Dialog 
          visible={addAppDialogVisible} 
          onDismiss={() => setAddAppDialogVisible(false)}
        >
          <Dialog.Title>
            添加到{listType === 'blacklist' ? '黑名单' : '白名单'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="应用包名"
              value={appInput}
              onChangeText={setAppInput}
              placeholder="例如：com.example.app"
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddAppDialogVisible(false)}>取消</Button>
            <Button onPress={handleAddApp}>添加</Button>
          </Dialog.Actions>
        </Dialog>

        {/* 添加VIP对话框 */}
        <Dialog 
          visible={addVipDialogVisible} 
          onDismiss={() => setAddVipDialogVisible(false)}
        >
          <Dialog.Title>添加VIP联系人</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="联系人标识"
              value={vipInput}
              onChangeText={setVipInput}
              placeholder="电话号码或联系人名称"
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddVipDialogVisible(false)}>取消</Button>
            <Button onPress={handleAddVip}>添加</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

// 获取优先级描述
function getUrgencyDescription(level: UrgencyLevel): string {
  switch (level) {
    case 'CRITICAL': return '仅允许紧急通知（来电、紧急警报）';
    case 'HIGH': return '允许重要通知（消息、日程）';
    case 'MEDIUM': return '允许一般通知（更新、推荐）';
    case 'LOW': return '允许大多数通知';
    case 'MINIMAL': return '允许所有通知';
  }
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: '#666',
  },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    color: '#666',
    marginBottom: spacing.md,
  },
  subTitle: {
    color: '#666',
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    minWidth: 80,
  },
  statValue: {
    fontWeight: '700',
    color: '#1976D2',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    marginBottom: spacing.xs,
  },
  addChip: {
    backgroundColor: '#E3F2FD',
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  urgencyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: spacing.md,
    marginTop: spacing.md,
  },
});

export default NotificationFilterScreen;
