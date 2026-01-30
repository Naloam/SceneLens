/**
 * RuleEditorScreen - 自动化规则编辑器界面
 * 
 * 功能：
 * - 规则列表展示（已有规则）
 * - 新建规则向导
 * - 规则启用/禁用开关
 * - 规则测试功能
 * - 预设模板快速启用
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
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
  FAB,
  Surface,
  IconButton,
  SegmentedButtons,
  Searchbar,
  Banner,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ruleExecutor } from '../rules/engine/RuleExecutor';
import { 
  UIRuleBuilder, 
  CONDITION_OPTIONS, 
  ACTION_OPTIONS,
  SCENE_OPTIONS,
  MOTION_OPTIONS,
  getConditionDisplayText,
  getActionDisplayText,
  type ConditionDraft,
  type ActionDraft,
  type RuleDraft,
  type ValidationResult,
} from '../rules/RuleBuilder';
import {
  ALL_RULE_TEMPLATES,
  TEMPLATE_GROUPS,
  getRecommendedTemplates,
  createRuleFromTemplate,
  type RuleTemplate,
  type TemplateCategory,
} from '../rules/RuleTemplates';
import type { AutomationRule } from '../types/automation';
import type { SceneType } from '../types';
import { spacing } from '../theme/spacing';

// ==================== 类型定义 ====================

type RootStackParamList = {
  RuleEditor: undefined;
  Home: undefined;
  Settings: undefined;
};

type RuleEditorNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RuleEditor'>;

type ViewMode = 'rules' | 'templates';
type EditorMode = 'list' | 'create' | 'edit';

// ==================== 常量 ====================

const sceneLabels: Record<SceneType, string> = {
  COMMUTE: '通勤',
  OFFICE: '办公室',
  HOME: '家',
  STUDY: '学习',
  SLEEP: '睡眠',
  TRAVEL: '出行',
  UNKNOWN: '未知',
};

// ==================== 主组件 ====================

export const RuleEditorScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<RuleEditorNavigationProp>();

  // 状态
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('rules');
  const [editorMode, setEditorMode] = useState<EditorMode>('list');
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBanner, setShowBanner] = useState(true);

  // 编辑器状态
  const [ruleBuilder, setRuleBuilder] = useState<UIRuleBuilder | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // 对话框状态
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);
  const [conditionDialogVisible, setConditionDialogVisible] = useState(false);
  const [actionDialogVisible, setActionDialogVisible] = useState(false);
  const [templateDialogVisible, setTemplateDialogVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);

  // 加载规则
  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      await ruleExecutor.initialize();
      const loadedRules = await ruleExecutor.getRules();
      setRules(loadedRules);
    } catch (error) {
      console.error('[RuleEditorScreen] Failed to load rules:', error);
      Alert.alert('加载失败', '无法加载规则列表');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // 过滤规则
  const filteredRules = useMemo(() => {
    if (!searchQuery) return rules;
    const query = searchQuery.toLowerCase();
    return rules.filter(rule => 
      rule.name.toLowerCase().includes(query) ||
      rule.description?.toLowerCase().includes(query)
    );
  }, [rules, searchQuery]);

  // 过滤模板
  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return ALL_RULE_TEMPLATES;
    const query = searchQuery.toLowerCase();
    return ALL_RULE_TEMPLATES.filter(template => 
      template.name.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query) ||
      template.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  // ==================== 规则操作 ====================

  const handleToggleRule = useCallback(async (ruleId: string, enabled: boolean) => {
    try {
      await ruleExecutor.setRuleEnabled(ruleId, enabled);
      setRules(prev => prev.map(r => 
        r.id === ruleId ? { ...r, enabled } : r
      ));
    } catch (error) {
      console.error('[RuleEditorScreen] Failed to toggle rule:', error);
      Alert.alert('操作失败', '无法更改规则状态');
    }
  }, []);

  const handleDeleteRule = useCallback(async () => {
    if (!ruleToDelete) return;

    try {
      await ruleExecutor.removeRule(ruleToDelete);
      setRules(prev => prev.filter(r => r.id !== ruleToDelete));
      setDeleteDialogVisible(false);
      setRuleToDelete(null);
    } catch (error) {
      console.error('[RuleEditorScreen] Failed to delete rule:', error);
      Alert.alert('删除失败', '无法删除规则');
    }
  }, [ruleToDelete]);

  const confirmDeleteRule = useCallback((ruleId: string) => {
    setRuleToDelete(ruleId);
    setDeleteDialogVisible(true);
  }, []);

  // ==================== 编辑器操作 ====================

  const startCreateRule = useCallback(() => {
    const builder = new UIRuleBuilder();
    setRuleBuilder(builder);
    setRuleDraft(builder.getDraft());
    setEditorMode('create');
    setValidationResult(null);
  }, []);

  const startEditRule = useCallback((rule: AutomationRule) => {
    const builder = new UIRuleBuilder(rule);
    setRuleBuilder(builder);
    setRuleDraft(builder.getDraft());
    setSelectedRule(rule);
    setEditorMode('edit');
    setValidationResult(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setRuleBuilder(null);
    setRuleDraft(null);
    setSelectedRule(null);
    setEditorMode('list');
    setValidationResult(null);
  }, []);

  const updateDraft = useCallback((updates: Partial<RuleDraft>) => {
    if (!ruleBuilder) return;
    ruleBuilder.updateDraft(updates);
    setRuleDraft(ruleBuilder.getDraft());
    setValidationResult(null);
  }, [ruleBuilder]);

  const saveRule = useCallback(async () => {
    if (!ruleBuilder) return;

    const validation = ruleBuilder.validate();
    setValidationResult(validation);

    if (!validation.valid) {
      Alert.alert('验证失败', validation.errors.map(e => e.message).join('\n'));
      return;
    }

    try {
      const rule = ruleBuilder.build(selectedRule?.id);
      if (!rule) {
        Alert.alert('保存失败', '规则构建失败');
        return;
      }

      if (editorMode === 'edit' && selectedRule) {
        await ruleExecutor.updateRule(rule);
        setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
      } else {
        await ruleExecutor.addRule(rule);
        setRules(prev => [...prev, rule]);
      }

      cancelEdit();
      Alert.alert('保存成功', `规则"${rule.name}"已保存`);
    } catch (error) {
      console.error('[RuleEditorScreen] Failed to save rule:', error);
      Alert.alert('保存失败', '无法保存规则');
    }
  }, [ruleBuilder, selectedRule, editorMode, cancelEdit]);

  // ==================== 模板操作 ====================

  const handleTemplatePress = useCallback((template: RuleTemplate) => {
    setSelectedTemplate(template);
    setTemplateDialogVisible(true);
  }, []);

  const handleEnableTemplate = useCallback(async () => {
    if (!selectedTemplate) return;

    try {
      const rule = createRuleFromTemplate(selectedTemplate);
      await ruleExecutor.addRule(rule);
      setRules(prev => [...prev, rule]);
      setTemplateDialogVisible(false);
      setSelectedTemplate(null);
      setViewMode('rules');
      Alert.alert('启用成功', `规则"${rule.name}"已添加`);
    } catch (error) {
      console.error('[RuleEditorScreen] Failed to enable template:', error);
      Alert.alert('启用失败', '无法添加规则');
    }
  }, [selectedTemplate]);

  const handleEditTemplate = useCallback(() => {
    if (!selectedTemplate) return;

    const rule = createRuleFromTemplate(selectedTemplate);
    setTemplateDialogVisible(false);
    setSelectedTemplate(null);
    startEditRule(rule);
  }, [selectedTemplate, startEditRule]);

  // ==================== 测试规则 ====================

  const testRule = useCallback(async (rule: AutomationRule) => {
    // 模拟测试 - 显示规则将如何触发
    const conditionsText = rule.conditions.map(c => {
      if (c.type === 'scene') {
        const scene = SCENE_OPTIONS.find(s => s.value === c.value);
        return `场景: ${scene?.label || c.value}`;
      }
      if (c.type === 'time' && Array.isArray(c.value)) {
        return `时间: ${c.value[0]} - ${c.value[1]}`;
      }
      return `${c.type}: ${c.value}`;
    }).join(rule.conditionLogic === 'AND' ? ' 且 ' : ' 或 ');

    const actionsText = rule.actions.map(a => {
      return a.description || a.type;
    }).join('\n');

    Alert.alert(
      '规则测试',
      `触发条件：\n${conditionsText}\n\n执行动作：\n${actionsText}\n\n冷却时间：${rule.cooldown} 分钟`,
      [{ text: '确定' }]
    );
  }, []);

  // ==================== 渲染函数 ====================

  const renderRuleItem = useCallback(({ item: rule }: { item: AutomationRule }) => (
    <Card style={styles.ruleCard} mode="outlined">
      <Card.Content>
        <View style={styles.ruleHeader}>
          <View style={styles.ruleInfo}>
            <Text variant="titleMedium">{rule.name}</Text>
            {rule.description && (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {rule.description}
              </Text>
            )}
          </View>
          <Switch
            value={rule.enabled}
            onValueChange={(value) => handleToggleRule(rule.id, value)}
          />
        </View>

        <View style={styles.ruleMeta}>
          <Chip icon="flash" compact style={styles.chip}>
            优先级 {rule.priority}
          </Chip>
          {rule.cooldown > 0 && (
            <Chip icon="timer" compact style={styles.chip}>
              冷却 {rule.cooldown}分钟
            </Chip>
          )}
          <Chip icon="format-list-bulleted" compact style={styles.chip}>
            {rule.conditions.length} 条件
          </Chip>
          <Chip icon="play-box" compact style={styles.chip}>
            {rule.actions.length} 动作
          </Chip>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.ruleActions}>
          <Button 
            mode="text" 
            icon="play" 
            onPress={() => testRule(rule)}
            compact
          >
            测试
          </Button>
          <Button 
            mode="text" 
            icon="pencil" 
            onPress={() => startEditRule(rule)}
            compact
          >
            编辑
          </Button>
          <Button 
            mode="text" 
            icon="delete" 
            onPress={() => confirmDeleteRule(rule.id)}
            textColor={theme.colors.error}
            compact
          >
            删除
          </Button>
        </View>
      </Card.Content>
    </Card>
  ), [theme, handleToggleRule, testRule, startEditRule, confirmDeleteRule]);

  const renderTemplateItem = useCallback(({ item: template }: { item: RuleTemplate }) => (
    <Card 
      style={styles.templateCard} 
      mode="outlined"
      onPress={() => handleTemplatePress(template)}
    >
      <Card.Content>
        <View style={styles.templateHeader}>
          <Text style={styles.templateIcon}>{template.icon}</Text>
          <View style={styles.templateInfo}>
            <View style={styles.templateTitleRow}>
              <Text variant="titleMedium">{template.name}</Text>
              {template.recommended && (
                <Chip compact style={styles.recommendedChip}>推荐</Chip>
              )}
            </View>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {template.description}
            </Text>
          </View>
        </View>

        <View style={styles.tagContainer}>
          {template.tags.slice(0, 3).map(tag => (
            <Chip key={tag} compact style={styles.tagChip}>{tag}</Chip>
          ))}
        </View>
      </Card.Content>
    </Card>
  ), [theme, handleTemplatePress]);

  const renderConditionItem = useCallback((condition: ConditionDraft, index: number) => (
    <Surface key={condition.id} style={styles.conditionItem} elevation={1}>
      <View style={styles.conditionContent}>
        <Text variant="bodyMedium">{getConditionDisplayText(condition)}</Text>
      </View>
      <IconButton
        icon="close"
        size={20}
        onPress={() => {
          if (ruleBuilder) {
            ruleBuilder.removeCondition(condition.id);
            setRuleDraft(ruleBuilder.getDraft());
          }
        }}
      />
    </Surface>
  ), [ruleBuilder]);

  const renderActionItem = useCallback((action: ActionDraft, index: number) => (
    <Surface key={action.id} style={styles.actionItem} elevation={1}>
      <View style={styles.actionContent}>
        <Text variant="bodyMedium">{getActionDisplayText(action)}</Text>
      </View>
      <IconButton
        icon="close"
        size={20}
        onPress={() => {
          if (ruleBuilder) {
            ruleBuilder.removeAction(action.id);
            setRuleDraft(ruleBuilder.getDraft());
          }
        }}
      />
    </Surface>
  ), [ruleBuilder]);

  // ==================== 编辑器界面 ====================

  const renderEditor = () => {
    if (!ruleDraft) return null;

    return (
      <ScrollView style={styles.container}>
        <Card style={styles.editorCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              {editorMode === 'create' ? '新建规则' : '编辑规则'}
            </Text>

            {/* 基本信息 */}
            <TextInput
              label="规则名称"
              value={ruleDraft.name}
              onChangeText={(text) => updateDraft({ name: text })}
              style={styles.input}
              mode="outlined"
              error={validationResult?.errors.some(e => e.field === 'name')}
            />

            <TextInput
              label="描述（可选）"
              value={ruleDraft.description || ''}
              onChangeText={(text) => updateDraft({ description: text })}
              style={styles.input}
              mode="outlined"
              multiline
            />

            <Divider style={styles.sectionDivider} />

            {/* 条件 */}
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">触发条件</Text>
              <SegmentedButtons
                value={ruleDraft.conditionLogic}
                onValueChange={(value) => updateDraft({ conditionLogic: value as 'AND' | 'OR' })}
                buttons={[
                  { value: 'AND', label: '全部满足' },
                  { value: 'OR', label: '任一满足' },
                ]}
                style={styles.logicButtons}
              />
            </View>

            {ruleDraft.conditions.map(renderConditionItem)}

            <Button 
              mode="outlined" 
              icon="plus" 
              onPress={() => setConditionDialogVisible(true)}
              style={styles.addButton}
            >
              添加条件
            </Button>

            <Divider style={styles.sectionDivider} />

            {/* 动作 */}
            <Text variant="titleMedium" style={styles.sectionTitle}>执行动作</Text>

            {ruleDraft.actions.map(renderActionItem)}

            <Button 
              mode="outlined" 
              icon="plus" 
              onPress={() => setActionDialogVisible(true)}
              style={styles.addButton}
            >
              添加动作
            </Button>

            <Divider style={styles.sectionDivider} />

            {/* 高级设置 */}
            <Text variant="titleMedium" style={styles.sectionTitle}>高级设置</Text>

            <View style={styles.settingRow}>
              <Text variant="bodyMedium">优先级</Text>
              <View style={styles.priorityButtons}>
                {[1, 3, 5, 7, 9].map(p => (
                  <Chip
                    key={p}
                    selected={ruleDraft.priority === p}
                    onPress={() => updateDraft({ priority: p })}
                    style={styles.priorityChip}
                  >
                    {p}
                  </Chip>
                ))}
              </View>
            </View>

            <TextInput
              label="冷却时间（分钟）"
              value={String(ruleDraft.cooldown)}
              onChangeText={(text) => {
                const num = parseInt(text) || 0;
                updateDraft({ cooldown: Math.max(0, num) });
              }}
              style={styles.input}
              mode="outlined"
              keyboardType="number-pad"
            />

            <View style={styles.switchRow}>
              <Text variant="bodyMedium">启用规则</Text>
              <Switch
                value={ruleDraft.enabled}
                onValueChange={(value) => updateDraft({ enabled: value })}
              />
            </View>

            {/* 验证警告 */}
            {validationResult?.warnings.map((warning, index) => (
              <Banner
                key={index}
                visible={true}
                icon="alert"
                style={styles.warningBanner}
              >
                {warning.message}
              </Banner>
            ))}
          </Card.Content>
        </Card>

        {/* 操作按钮 */}
        <View style={styles.editorActions}>
          <Button 
            mode="outlined" 
            onPress={cancelEdit}
            style={styles.editorButton}
          >
            取消
          </Button>
          <Button 
            mode="contained" 
            onPress={saveRule}
            style={styles.editorButton}
          >
            保存
          </Button>
        </View>
      </ScrollView>
    );
  };

  // ==================== 列表界面 ====================

  const renderList = () => (
    <View style={styles.container}>
      {/* 搜索栏 */}
      <Searchbar
        placeholder="搜索规则或模板..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {/* 视图切换 */}
      <SegmentedButtons
        value={viewMode}
        onValueChange={(value) => setViewMode(value as ViewMode)}
        buttons={[
          { value: 'rules', label: `我的规则 (${rules.length})`, icon: 'format-list-checks' },
          { value: 'templates', label: '规则模板', icon: 'library' },
        ]}
        style={styles.viewToggle}
      />

      {/* 推荐横幅 */}
      {showBanner && viewMode === 'rules' && rules.length === 0 && (
        <Banner
          visible={true}
          actions={[
            { label: '查看推荐', onPress: () => setViewMode('templates') },
            { label: '忽略', onPress: () => setShowBanner(false) },
          ]}
          icon="lightbulb"
        >
          还没有规则？查看推荐模板，一键启用常用的自动化规则！
        </Banner>
      )}

      {/* 规则列表 */}
      {viewMode === 'rules' && (
        <FlatList
          data={filteredRules}
          renderItem={renderRuleItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text variant="bodyLarge" style={styles.emptyText}>
                {searchQuery ? '没有找到匹配的规则' : '暂无自动化规则'}
              </Text>
              {!searchQuery && (
                <Button 
                  mode="contained" 
                  onPress={startCreateRule}
                  style={styles.emptyButton}
                >
                  创建第一条规则
                </Button>
              )}
            </View>
          }
        />
      )}

      {/* 模板列表 */}
      {viewMode === 'templates' && (
        <FlatList
          data={filteredTemplates}
          renderItem={renderTemplateItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text variant="bodyLarge" style={styles.emptyText}>
                没有找到匹配的模板
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      {viewMode === 'rules' && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={startCreateRule}
          label="新建规则"
        />
      )}
    </View>
  );

  // ==================== 对话框 ====================

  const renderConditionDialog = () => (
    <Portal>
      <Dialog visible={conditionDialogVisible} onDismiss={() => setConditionDialogVisible(false)}>
        <Dialog.Title>添加条件</Dialog.Title>
        <Dialog.ScrollArea style={styles.dialogScrollArea}>
          <ScrollView>
            {CONDITION_OPTIONS.map(option => (
              <List.Item
                key={option.type}
                title={`${option.icon} ${option.label}`}
                description={option.description}
                onPress={() => {
                  if (ruleBuilder) {
                    const defaultValue = option.type === 'scene' ? 'HOME' 
                      : option.type === 'time' ? ['09:00', '18:00']
                      : option.defaultValue || '';
                    
                    ruleBuilder.addCondition({
                      type: option.type,
                      operator: option.operators[0]?.value || 'equals',
                      value: defaultValue,
                    });
                    setRuleDraft(ruleBuilder.getDraft());
                  }
                  setConditionDialogVisible(false);
                }}
              />
            ))}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={() => setConditionDialogVisible(false)}>取消</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  const renderActionDialog = () => (
    <Portal>
      <Dialog visible={actionDialogVisible} onDismiss={() => setActionDialogVisible(false)}>
        <Dialog.Title>添加动作</Dialog.Title>
        <Dialog.ScrollArea style={styles.dialogScrollArea}>
          <ScrollView>
            {ACTION_OPTIONS.map(option => (
              <List.Item
                key={option.type}
                title={`${option.icon} ${option.label}`}
                description={option.description}
                onPress={() => {
                  if (ruleBuilder) {
                    const defaultParams: Record<string, unknown> = {};
                    option.paramFields.forEach(field => {
                      if (field.defaultValue !== undefined) {
                        defaultParams[field.key] = field.defaultValue;
                      }
                    });
                    
                    ruleBuilder.addAction({
                      type: option.type,
                      params: defaultParams,
                      description: option.label,
                    });
                    setRuleDraft(ruleBuilder.getDraft());
                  }
                  setActionDialogVisible(false);
                }}
              />
            ))}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={() => setActionDialogVisible(false)}>取消</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  const renderTemplateDialog = () => (
    <Portal>
      <Dialog visible={templateDialogVisible} onDismiss={() => setTemplateDialogVisible(false)}>
        <Dialog.Title>{selectedTemplate?.name}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.templateDialogDesc}>
            {selectedTemplate?.description}
          </Text>
          <View style={styles.templateDialogTags}>
            {selectedTemplate?.tags.map(tag => (
              <Chip key={tag} compact style={styles.tagChip}>{tag}</Chip>
            ))}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setTemplateDialogVisible(false)}>取消</Button>
          <Button onPress={handleEditTemplate}>自定义后启用</Button>
          <Button mode="contained" onPress={handleEnableTemplate}>直接启用</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  const renderDeleteDialog = () => (
    <Portal>
      <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
        <Dialog.Title>删除规则</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">确定要删除这条规则吗？此操作无法撤销。</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setDeleteDialogVisible(false)}>取消</Button>
          <Button onPress={handleDeleteRule} textColor={theme.colors.error}>删除</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  // ==================== 主渲染 ====================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>加载规则...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {editorMode === 'list' ? renderList() : renderEditor()}
      
      {renderConditionDialog()}
      {renderActionDialog()}
      {renderTemplateDialog()}
      {renderDeleteDialog()}
    </View>
  );
};

// ==================== 样式 ====================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
  },
  viewToggle: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  
  // 规则卡片
  ruleCard: {
    marginBottom: 12,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ruleInfo: {
    flex: 1,
    marginRight: 16,
  },
  ruleMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  chip: {
    height: 28,
  },
  divider: {
    marginVertical: 12,
  },
  ruleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  // 模板卡片
  templateCard: {
    marginBottom: 12,
  },
  templateHeader: {
    flexDirection: 'row',
  },
  templateIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  templateInfo: {
    flex: 1,
  },
  templateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendedChip: {
    height: 24,
    backgroundColor: '#E8F5E9',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  tagChip: {
    height: 24,
  },

  // 空状态
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    opacity: 0.6,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 16,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },

  // 编辑器
  editorCard: {
    margin: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionDivider: {
    marginVertical: 20,
  },
  input: {
    marginBottom: 12,
  },
  logicButtons: {
    marginTop: 8,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  conditionContent: {
    flex: 1,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionContent: {
    flex: 1,
  },
  addButton: {
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    height: 32,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  warningBanner: {
    marginTop: 12,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  editorButton: {
    minWidth: 100,
  },

  // 对话框
  dialogScrollArea: {
    maxHeight: 400,
  },
  templateDialogDesc: {
    marginBottom: 12,
  },
  templateDialogTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

export default RuleEditorScreen;
