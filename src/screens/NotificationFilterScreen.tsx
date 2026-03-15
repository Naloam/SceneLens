/**
 * NotificationFilterScreen - 智能通知过滤设置页面
 * 
 * 配置场景策略、应用黑白名单、VIP联系人等
 */

/**
 * NotificationFilterScreen - 智能通知过滤设置
 * * 功能描述:
 * - 核心开关与学习模式控制
 * - 过滤拦截统计数据展示
 * - 各场景最低通知优先级策略配置
 * - 黑/白名单应用包名管理
 * - VIP 联系人免打扰放行配置
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
  Surface,
  useTheme,
} from 'react-native-paper';
import { smartNotificationFilter } from '../notifications/SmartNotificationFilter';
import { spacing, borderRadius } from '../theme/spacing';
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
  CRITICAL: '#DC2626',
  HIGH: '#EA580C',
  MEDIUM: '#D97706',
  LOW: '#16A34A',
  MINIMAL: '#9CA3AF',
};

const urgencyLevels: UrgencyLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'MINIMAL'];

// ==================== 组件实现 ====================

export const NotificationFilterScreen: React.FC = () => {
  const theme = useTheme();
  const ultraLightBg = theme.colors.primary + '0A'; // 生成约4%透明度的极淡主题色

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
      
    } catch (error) {
      console.error('[NotificationFilterScreen] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 切换总开关
  const handleToggleEnabled = useCallback(async (value: boolean) => {
    setEnabled(value);
    if (value) {
      smartNotificationFilter.enable();
    } else {
      smartNotificationFilter.disable();
    }
  }, []);

  // 切换学习模式
  const handleToggleLearning = useCallback(async (value: boolean) => {
    setLearningMode(value);
    if (value) {
      smartNotificationFilter.enableLearningMode();
    } else {
      smartNotificationFilter.disableLearningMode();
    }
  }, []);

  // 场景策略编辑触发
  const handleScenePress = useCallback((scene: SceneType) => {
    setSelectedScene(scene);
    setPolicyDialogVisible(true);
  }, []);

  // 保存场景策略
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

  // 添加 VIP 联系人
  const handleAddVip = useCallback(async () => {
    const contact = vipInput.trim();
    if (!contact) return;
    
    await smartNotificationFilter.addVipContact(contact);
    setVipContacts(prev => [...prev, contact]);
    
    setVipInput('');
    setAddVipDialogVisible(false);
  }, [vipInput]);

  // 移除 VIP 联系人
  const handleRemoveVip = useCallback(async (contact: string) => {
    await smartNotificationFilter.removeVipContact(contact);
    setVipContacts(prev => prev.filter(c => c !== contact));
  }, []);

  // 清除过滤历史
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

  // 加载态渲染
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.primary }]}>
          正在加载配置...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 主开关配置区 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.cardContent}>
          <List.Item
            title="启用智能通知过滤"
            titleStyle={styles.listItemTitle}
            description="根据场景自动过滤不重要的通知"
            descriptionStyle={styles.listItemDesc}
            left={props => <List.Icon {...props} icon="filter" color={theme.colors.primary} />}
            right={() => (
              <Switch 
                value={enabled} 
                onValueChange={handleToggleEnabled}
                color={theme.colors.primary}
              />
            )}
            style={styles.listItemPadding}
          />
          <Divider style={styles.divider} />
          <List.Item
            title="学习模式"
            titleStyle={styles.listItemTitle}
            description="记录您对通知的处理方式以优化过滤"
            descriptionStyle={styles.listItemDesc}
            left={props => <List.Icon {...props} icon="brain" color={theme.colors.primary} />}
            right={() => (
              <Switch 
                value={learningMode} 
                onValueChange={handleToggleLearning}
                disabled={!enabled}
                color={theme.colors.primary}
              />
            )}
            style={styles.listItemPadding}
          />
        </Card.Content>
      </Card>

      {/* 统计信息区 */}
      {stats && (
        <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              过滤统计
            </Text>
            <View style={styles.statsGrid}>
              <Surface style={[styles.statItem, { backgroundColor: ultraLightBg }]} elevation={0}>
                <Text variant="headlineMedium" style={[styles.statValue, { color: theme.colors.primary }]}>
                  {stats.totalFiltered}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>已过滤</Text>
              </Surface>
              
              <Surface style={[styles.statItem, { backgroundColor: ultraLightBg }]} elevation={0}>
                <Text variant="headlineMedium" style={[styles.statValue, { color: theme.colors.primary }]}>
                  {stats.totalPassed}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>已放行</Text>
              </Surface>
              
              <Surface style={[styles.statItem, { backgroundColor: ultraLightBg }]} elevation={0}>
                <Text variant="headlineMedium" style={[styles.statValue, { color: theme.colors.primary }]}>
                  {stats.filterRate.toFixed(0)}%
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>过滤率</Text>
              </Surface>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* 场景策略配置区 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            场景策略
          </Text>
          <Text variant="bodySmall" style={styles.sectionDesc}>
            设置每个场景下允许的最低通知优先级
          </Text>
          
          {(['SLEEP', 'STUDY', 'OFFICE', 'COMMUTE', 'HOME', 'TRAVEL'] as SceneType[]).map((scene, index, arr) => (
            <React.Fragment key={scene}>
              <List.Item
                title={`${sceneIcons[scene]} ${sceneLabels[scene]}`}
                titleStyle={styles.listItemTitle}
                description={`只允许 ${urgencyLabels[scenePolicies[scene]]} 及以上`}
                descriptionStyle={styles.listItemDesc}
                onPress={() => handleScenePress(scene)}
                right={() => (
                  <View style={styles.pillContainer}>
                    <View style={[styles.customPill, { backgroundColor: urgencyColors[scenePolicies[scene]] + '1A' }]}>
                      <Text style={{ color: urgencyColors[scenePolicies[scene]], fontSize: 12, fontWeight: '800' }}>
                        {urgencyLabels[scenePolicies[scene]]}
                      </Text>
                    </View>
                  </View>
                )}
                style={styles.listItemPadding}
              />
              {index < arr.length - 1 && <Divider style={{ opacity: 0.3 }} />}
            </React.Fragment>
          ))}
        </Card.Content>
      </Card>

      {/* 应用管理区 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            应用管理
          </Text>
          
          {/* 黑名单模块 */}
          <Text variant="labelMedium" style={styles.subTitle}>
            黑名单 (始终过滤)
          </Text>
          <View style={styles.chipContainer}>
            {blacklist.length === 0 ? (
              <Text variant="bodySmall" style={styles.emptyText}>暂无应用</Text>
            ) : (
              blacklist.map((app) => (
                <Chip 
                  key={app}
                  onClose={() => handleRemoveApp(app, 'blacklist')}
                  style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant }]}
                  textStyle={styles.chipText}
                >
                  {app}
                </Chip>
              ))
            )}
            <Chip 
              icon="plus" 
              onPress={() => { setListType('blacklist'); setAddAppDialogVisible(true); }}
              style={[styles.addChip, { backgroundColor: theme.colors.primaryContainer }]}
              textStyle={{ color: theme.colors.primary, fontWeight: '700' }}
            >
              添加应用
            </Chip>
          </View>

          <Divider style={{ marginVertical: 16, opacity: 0.3 }} />

          {/* 白名单模块 */}
          <Text variant="labelMedium" style={styles.subTitle}>
            白名单 (始终放行)
          </Text>
          <View style={styles.chipContainer}>
            {whitelist.length === 0 ? (
              <Text variant="bodySmall" style={styles.emptyText}>暂无应用</Text>
            ) : (
              whitelist.map((app) => (
                <Chip 
                  key={app}
                  onClose={() => handleRemoveApp(app, 'whitelist')}
                  style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant }]}
                  textStyle={styles.chipText}
                >
                  {app}
                </Chip>
              ))
            )}
            <Chip 
              icon="plus" 
              onPress={() => { setListType('whitelist'); setAddAppDialogVisible(true); }}
              style={[styles.addChip, { backgroundColor: theme.colors.primaryContainer }]}
              textStyle={{ color: theme.colors.primary, fontWeight: '700' }}
            >
              添加应用
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* VIP 联系人配置区 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            VIP 联系人
          </Text>
          <Text variant="bodySmall" style={styles.sectionDesc}>
            来自 VIP 联系人的通知将始终无视场景被放行
          </Text>
          
          <View style={styles.chipContainer}>
            {vipContacts.length === 0 ? (
              <Text variant="bodySmall" style={styles.emptyText}>暂无 VIP 联系人</Text>
            ) : (
              vipContacts.map((contact) => (
                <Chip 
                  key={contact}
                  icon="star"
                  onClose={() => handleRemoveVip(contact)}
                  style={[styles.chip, { backgroundColor: '#FEF3C7' }]}
                  textStyle={{ color: '#D97706', fontWeight: '600' }}
                >
                  {contact}
                </Chip>
              ))
            )}
            <Chip 
              icon="plus" 
              onPress={() => setAddVipDialogVisible(true)}
              style={[styles.addChip, { backgroundColor: theme.colors.primaryContainer }]}
              textStyle={{ color: theme.colors.primary, fontWeight: '700' }}
            >
              添加联系人
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* 底部危险操作区 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { marginBottom: 40, backgroundColor: theme.colors.surface }]}>
        <Card.Content style={{ padding: 12 }}>
          <Button 
            mode="text" 
            onPress={handleClearHistory}
            icon="delete"
            textColor={theme.colors.error}
            style={{ borderRadius: borderRadius.lg }}
          >
            清除过滤历史记录
          </Button>
        </Card.Content>
      </Card>

      {/* 所有弹窗区域 */}
      <Portal>
        {/* 策略选择对话框 */}
        <Dialog 
          visible={policyDialogVisible} 
          onDismiss={() => setPolicyDialogVisible(false)}
          style={[styles.dialogBase, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={styles.dialogTitle}>
            {selectedScene && `${sceneIcons[selectedScene]} ${sceneLabels[selectedScene]} 策略`}
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView contentContainerStyle={styles.dialogScrollContent}>
              <Text variant="bodyMedium" style={{ marginBottom: 16, opacity: 0.7 }}>
                选择此场景下允许通知打扰的最低优先级：
              </Text>
              
              {urgencyLevels.map((level) => (
                <List.Item
                  key={level}
                  title={urgencyLabels[level]}
                  titleStyle={{ fontWeight: '700', color: theme.colors.onSurface }}
                  description={getUrgencyDescription(level)}
                  descriptionStyle={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}
                  onPress={() => handlePolicyChange(level)}
                  left={() => (
                    <View style={{ justifyContent: 'center', marginRight: 12 }}>
                      <View style={[styles.urgencyDot, { backgroundColor: urgencyColors[level] }]} />
                    </View>
                  )}
                  right={() => 
                    selectedScene && scenePolicies[selectedScene] === level ? (
                      <List.Icon icon="check" color={theme.colors.primary} />
                    ) : null
                  }
                  style={{ paddingVertical: 4 }}
                />
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>

        {/* 添加应用对话框 */}
        <Dialog 
          visible={addAppDialogVisible} 
          onDismiss={() => setAddAppDialogVisible(false)}
          style={[styles.dialogBase, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={styles.dialogTitle}>
            添加到{listType === 'blacklist' ? '黑名单' : '白名单'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="应用包名"
              value={appInput}
              onChangeText={setAppInput}
              placeholder="例如：com.example.app"
              mode="outlined"
              style={styles.dialogInput}
              outlineColor={theme.colors.outlineVariant}
              activeOutlineColor={theme.colors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setAddAppDialogVisible(false)} textColor={theme.colors.onSurfaceVariant} style={styles.dialogButton}>取消</Button>
            <Button mode="contained" onPress={handleAddApp} buttonColor={theme.colors.primary} style={styles.dialogButton}>添加</Button>
          </Dialog.Actions>
        </Dialog>

        {/* 添加 VIP 联系人对话框 */}
        <Dialog 
          visible={addVipDialogVisible} 
          onDismiss={() => setAddVipDialogVisible(false)}
          style={[styles.dialogBase, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={styles.dialogTitle}>添加联系人</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="联系人标识"
              value={vipInput}
              onChangeText={setVipInput}
              placeholder="电话号码或联系人名称"
              mode="outlined"
              style={styles.dialogInput}
              outlineColor={theme.colors.outlineVariant}
              activeOutlineColor={theme.colors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setAddVipDialogVisible(false)} textColor={theme.colors.onSurfaceVariant} style={styles.dialogButton}>取消</Button>
            <Button mode="contained" onPress={handleAddVip} buttonColor={theme.colors.primary} style={styles.dialogButton}>添加</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

// 获取优先级辅助描述
function getUrgencyDescription(level: UrgencyLevel): string {
  switch (level) {
    case 'CRITICAL': return '仅允许紧急通知 (来电、紧急警报)';
    case 'HIGH': return '允许重要通知 (消息、日程)';
    case 'MEDIUM': return '允许一般通知 (常规更新)';
    case 'LOW': return '允许大多数通知';
    case 'MINIMAL': return '允许所有通知 (完全不拦截)';
    default: return '';
  }
}

// ==================== 样式表 ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontWeight: '700',
  },
  card: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
  },
  cardContent: {
    padding: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionDesc: {
    opacity: 0.6,
    marginBottom: 16,
    lineHeight: 18,
  },
  subTitle: {
    fontWeight: '700',
    opacity: 0.7,
    marginBottom: 12,
  },
  
  // 列表样式复用
  listItemPadding: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  listItemTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  listItemDesc: {
    opacity: 0.6,
    marginTop: 2,
    fontSize: 12,
  },
  divider: {
    marginVertical: 4,
    opacity: 0.3,
  },
  
  // 统计网格
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  statValue: {
    fontWeight: '900',
  },
  statLabel: {
    opacity: 0.6,
    fontWeight: '600',
    marginTop: 4,
  },

  // 防切字策略胶囊
  pillContainer: {
    justifyContent: 'center',
    paddingLeft: 8,
  },
  customPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  // 标签区
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addChip: {
    borderRadius: 8,
  },
  emptyText: {
    opacity: 0.5,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  
  // 弹窗规范
  dialogBase: {
    borderRadius: borderRadius.xl,
  },
  dialogTitle: {
    fontWeight: '800',
    textAlign: 'center',
    paddingTop: 20,
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  dialogScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  urgencyDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dialogInput: {
    marginBottom: 8,
  },
  dialogActions: {
    padding: 16,
    paddingTop: 0,
  },
  dialogButton: {
    borderRadius: 12,
  },
});

export default NotificationFilterScreen;