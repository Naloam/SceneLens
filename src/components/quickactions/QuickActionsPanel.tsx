/**
 * QuickActionsPanel - 快捷操作面板组件
 * MD3 呼吸感升级版，全面接入全局主题
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, TouchableRipple, Card, useTheme } from 'react-native-paper';
import type { SceneType } from '../../types';
import type { QuickAction, ActionCategory } from '../../types/automation';
import { quickActionManager } from '../../quickactions/QuickActionManager';
import { spacing, borderRadius } from '../../theme/spacing';

const ICON_MAP: Record<string, string> = {
  'credit-card': '💳', 'qrcode': '📷', 'bus': '🚌', 'shield': '🛡️', 'navigation': '🧭', 'home': '🏠', 'briefcase': '💼',
  'car': '🚗', 'train': '🚄', 'plane': '✈️', 'bicycle': '🚲', 'message-circle': '💬', 'message-square': '📝',
  'phone': '📞', 'mail': '📧', 'send': '📨', 'settings': '⚙️', 'volume': '🔊', 'wifi': '📶', 'bluetooth': '📡', 'default': '⚡',
};

export interface QuickActionsPanelProps {
  currentScene: SceneType;
  maxActions?: number;
  layout?: 'grid' | 'list' | 'compact';
  filterCategory?: ActionCategory;
  showTitle?: boolean;
  title?: string;
  onActionExecuted?: (action: QuickAction, success: boolean) => void;
  onMorePress?: () => void;
  style?: object;
}

const ActionButton: React.FC<{ action: QuickAction; onPress: () => void; isLoading: boolean; theme: any }> = ({ action, onPress, isLoading, theme }) => {
  const icon = ICON_MAP[action.icon] || ICON_MAP.default;

  return (
    // 强制 33.333% 的外层容器，内部留白，形成完美网格
    <View style={styles.gridItemWrapper}>
      <TouchableRipple 
        style={[styles.gridButton, { backgroundColor: theme.colors.primaryContainer }]} 
        onPress={onPress} 
        disabled={isLoading} 
        borderless
      >
        <View style={styles.buttonInner}>
          {isLoading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Text style={styles.gridIcon}>{icon}</Text>}
          <Text style={[styles.gridLabel, { color: theme.colors.primary }]} numberOfLines={1}>{action.name}</Text>
        </View>
      </TouchableRipple>
    </View>
  );
};

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  currentScene, maxActions = 6, filterCategory, showTitle = true, title = '快捷操作', onActionExecuted, onMorePress, style,
}) => {
  const theme = useTheme();
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  useEffect(() => { loadActions(); }, [currentScene, filterCategory, maxActions]);

  const loadActions = useCallback(async () => {
    setLoading(true);
    try {
      let result = filterCategory ? await quickActionManager.getActionsByCategory(filterCategory) : await quickActionManager.getRecommendedActions(currentScene, maxActions);
      setActions(result.slice(0, 6)); // 锁定最大6个
    } catch (error) {} finally { setLoading(false); }
  }, [currentScene, filterCategory, maxActions]);

  const handleActionPress = useCallback(async (action: QuickAction) => {
    setExecutingAction(action.id);
    try {
      const success = await quickActionManager.executeAction(action.id, currentScene);
      onActionExecuted?.(action, success);
    } catch (error) { onActionExecuted?.(action, false); } finally { setExecutingAction(null); }
  }, [currentScene, onActionExecuted]);

  return (
    // 恢复与 HistoryCard 完全一致的 elevation={1} 和 borderRadius.xl
    <Card mode="elevated" elevation={1} style={[styles.card, { borderRadius: borderRadius.xl, backgroundColor: theme.colors.surface }, style]}>
      <Card.Content style={styles.cardContent}>
        {showTitle && (
          <View style={styles.header}>
            <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
            {onMorePress && (
              <TouchableRipple onPress={onMorePress} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.md }}>
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>更多</Text>
              </TouchableRipple>
            )}
          </View>
        )}
        
        {loading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
        ) : actions.length === 0 ? (
          <View style={styles.emptyContainer}><Text style={{ color: theme.colors.onSurfaceVariant }}>暂无可用的快捷操作</Text></View>
        ) : (
          <View style={styles.gridContainer}>
            {actions.map(action => <ActionButton key={action.id} action={action} onPress={() => handleActionPress(action)} isLoading={executingAction === action.id} theme={theme} />)}
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    // 移除所有外边距和暴力阴影，交给 HomeScreen 统一管理间距
  },
  cardContent: { 
    padding: spacing.md, // 恢复标准内边距
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontWeight: '600', letterSpacing: 0.5 },
  loadingContainer: { height: 100, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { height: 80, justifyContent: 'center', alignItems: 'center' },
  gridContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginHorizontal: -spacing.xs, // 抵消子组件的 padding，使得两端对齐
  },
  gridItemWrapper: {
    width: '33.333%', // 👈 绝对的三分之一宽度，天王老子来了也是一排三个
    padding: spacing.xs, // 元素之间的间距
  },
  gridButton: { 
    width: '100%', 
    aspectRatio: 1, 
    borderRadius: borderRadius.lg, // 内部按钮用适中的圆角
    overflow: 'hidden' 
  }, 
  buttonInner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 4 },
  gridIcon: { fontSize: 28, marginBottom: 8 },
  gridLabel: { fontSize: 13, textAlign: 'center', fontWeight: '600' },
});

export default QuickActionsPanel;