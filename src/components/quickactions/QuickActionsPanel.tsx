/**
 * QuickActionsPanel - 快捷操作面板组件
 * 
 * 显示场景相关的快捷操作按钮，支持网格和列表布局
 * 
 * @module components/quickactions
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  useColorScheme,
} from 'react-native';
import type { SceneType } from '../../types';
import type { QuickAction, ActionCategory } from '../../types/automation';
import { quickActionManager } from '../../quickactions/QuickActionManager';

// ==================== 类型定义 ====================

export interface QuickActionsPanelProps {
  /**
   * 当前场景类型
   */
  currentScene: SceneType;
  
  /**
   * 最大显示数量
   */
  maxActions?: number;
  
  /**
   * 布局模式
   */
  layout?: 'grid' | 'list' | 'compact';
  
  /**
   * 筛选类别
   */
  filterCategory?: ActionCategory;
  
  /**
   * 是否显示标题
   */
  showTitle?: boolean;
  
  /**
   * 标题文本
   */
  title?: string;
  
  /**
   * 动作执行回调
   */
  onActionExecuted?: (action: QuickAction, success: boolean) => void;
  
  /**
   * 更多按钮点击回调
   */
  onMorePress?: () => void;
  
  /**
   * 自定义样式
   */
  style?: object;
}

// ==================== 颜色配置 ====================

interface ThemeColors {
  primary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
}

const lightColors: ThemeColors = {
  primary: '#2196F3',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#212121',
  textSecondary: '#757575',
};

const darkColors: ThemeColors = {
  primary: '#64B5F6',
  background: '#121212',
  surface: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
};

// ==================== 图标映射 ====================

const ICON_MAP: Record<string, string> = {
  'credit-card': '💳',
  'qrcode': '📷',
  'bus': '🚌',
  'shield': '🛡️',
  'navigation': '🧭',
  'home': '🏠',
  'briefcase': '💼',
  'car': '🚗',
  'train': '🚄',
  'plane': '✈️',
  'bicycle': '🚲',
  'message-circle': '💬',
  'message-square': '📝',
  'phone': '📞',
  'mail': '📧',
  'send': '📨',
  'settings': '⚙️',
  'volume': '🔊',
  'wifi': '📶',
  'bluetooth': '📡',
  'default': '⚡',
};

// ==================== 子组件 ====================

interface ActionButtonProps {
  action: QuickAction;
  layout: 'grid' | 'list' | 'compact';
  onPress: () => void;
  isLoading: boolean;
  colors: ThemeColors;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  action,
  layout,
  onPress,
  isLoading,
  colors,
}) => {
  const icon = ICON_MAP[action.icon] || ICON_MAP.default;
  
  if (layout === 'compact') {
    return (
      <TouchableOpacity
        style={[styles.compactButton, { backgroundColor: colors.surface }]}
        onPress={onPress}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.compactIcon}>{icon}</Text>
        )}
        <Text 
          style={[styles.compactLabel, { color: colors.text }]} 
          numberOfLines={1}
        >
          {action.name}
        </Text>
      </TouchableOpacity>
    );
  }
  
  if (layout === 'list') {
    return (
      <TouchableOpacity
        style={[styles.listButton, { backgroundColor: colors.surface }]}
        onPress={onPress}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <View style={styles.listIconContainer}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.listIcon}>{icon}</Text>
          )}
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listLabel, { color: colors.text }]}>
            {action.name}
          </Text>
          {action.description && (
            <Text 
              style={[styles.listDescription, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {action.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }
  
  // Grid layout (default)
  return (
    <TouchableOpacity
      style={[styles.gridButton, { backgroundColor: colors.surface }]}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <Text style={styles.gridIcon}>{icon}</Text>
      )}
      <Text 
        style={[styles.gridLabel, { color: colors.text }]} 
        numberOfLines={2}
      >
        {action.name}
      </Text>
    </TouchableOpacity>
  );
};

// ==================== 主组件 ====================

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  currentScene,
  maxActions = 8,
  layout = 'grid',
  filterCategory,
  showTitle = true,
  title = '快捷操作',
  onActionExecuted,
  onMorePress,
  style,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // 加载快捷操作
  useEffect(() => {
    loadActions();
  }, [currentScene, filterCategory, maxActions]);

  const loadActions = useCallback(async () => {
    setLoading(true);
    try {
      let result: QuickAction[];
      
      if (filterCategory) {
        result = await quickActionManager.getActionsByCategory(filterCategory);
      } else {
        result = await quickActionManager.getRecommendedActions(currentScene, maxActions);
      }
      
      setActions(result.slice(0, maxActions));
    } catch (error) {
      console.error('[QuickActionsPanel] Failed to load actions:', error);
    } finally {
      setLoading(false);
    }
  }, [currentScene, filterCategory, maxActions]);

  // 执行动作
  const handleActionPress = useCallback(async (action: QuickAction) => {
    setExecutingAction(action.id);
    
    try {
      const success = await quickActionManager.executeAction(action.id, currentScene);
      onActionExecuted?.(action, success);
    } catch (error) {
      console.error('[QuickActionsPanel] Action execution failed:', error);
      onActionExecuted?.(action, false);
    } finally {
      setExecutingAction(null);
    }
  }, [currentScene, onActionExecuted]);

  // 渲染内容
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (actions.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            暂无可用的快捷操作
          </Text>
        </View>
      );
    }

    if (layout === 'grid') {
      return (
        <View style={styles.gridContainer}>
          {actions.map(action => (
            <ActionButton
              key={action.id}
              action={action}
              layout={layout}
              onPress={() => handleActionPress(action)}
              isLoading={executingAction === action.id}
              colors={colors}
            />
          ))}
        </View>
      );
    }

    if (layout === 'compact') {
      return (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.compactContainer}
        >
          {actions.map(action => (
            <ActionButton
              key={action.id}
              action={action}
              layout={layout}
              onPress={() => handleActionPress(action)}
              isLoading={executingAction === action.id}
              colors={colors}
            />
          ))}
        </ScrollView>
      );
    }

    // List layout
    return (
      <View style={styles.listContainer}>
        {actions.map(action => (
          <ActionButton
            key={action.id}
            action={action}
            layout={layout}
            onPress={() => handleActionPress(action)}
            isLoading={executingAction === action.id}
            colors={colors}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, style]}>
      {showTitle && (
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {onMorePress && (
            <TouchableOpacity onPress={onMorePress}>
              <Text style={[styles.moreButton, { color: colors.primary }]}>
                更多
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {renderContent()}
    </View>
  );
};

// ==================== 样式 ====================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 4;
const GRID_GAP = 12;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - 32 - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  moreButton: {
    fontSize: 14,
  },
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  
  // Grid layout
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -GRID_GAP / 2,
  },
  gridButton: {
    width: GRID_ITEM_WIDTH,
    height: GRID_ITEM_WIDTH + 20,
    margin: GRID_GAP / 2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  gridIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  gridLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  
  // Compact layout
  compactContainer: {
    paddingVertical: 4,
  },
  compactButton: {
    width: 72,
    height: 72,
    marginRight: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  compactIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  compactLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  
  // List layout
  listContainer: {
    gap: 8,
  },
  listButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  listIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listIcon: {
    fontSize: 22,
  },
  listContent: {
    flex: 1,
  },
  listLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  listDescription: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default QuickActionsPanel;
