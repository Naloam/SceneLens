/**
 * 应用列表项组件
 * 显示应用信息、排名和选择状态
 */

import React from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import {
  List,
  IconButton,
  useTheme,
  Checkbox,
  RadioButton,
} from 'react-native-paper';
import { AppInfo } from '../../types';
import { spacing } from '../../theme/spacing';

export interface AppListItemProps {
  /** 应用信息 */
  app: AppInfo;
  /** 排名（1-3） */
  rank?: number;
  /** 是否选中 */
  selected?: boolean;
  /** 选择模式 */
  selectionMode?: 'checkbox' | 'radio' | 'none';
  /** 选择状态改变回调 */
  onSelectionChange?: (selected: boolean) => void;
  /** 删除回调 */
  onDelete?: () => void;
  /** 点击应用项回调（用于启动应用） */
  onPress?: () => void;
  /** 样式 */
  style?: any;
}

/**
 * 排名徽章颜色
 */
const rankColors = {
  1: '#FFD700', // 金色
  2: '#C0C0C0', // 银色
  3: '#CD7F32', // 铜色
};

export const AppListItem: React.FC<AppListItemProps> = ({
  app,
  rank,
  selected = false,
  selectionMode = 'none',
  onSelectionChange,
  onDelete,
  onPress,
  style,
}) => {
  const theme = useTheme();

  const renderRankBadge = () => {
    if (!rank || rank > 3) return null;

    return (
      <View
        style={[
          styles.rankBadge,
          { backgroundColor: rankColors[rank as keyof typeof rankColors] },
        ]}
      >
        <Text style={styles.rankText}>⭐ {rank}</Text>
      </View>
    );
  };

  const renderSelectionControl = () => {
    if (selectionMode === 'none') return null;

    const Control = selectionMode === 'checkbox' ? Checkbox.Android : RadioButton.Android;

    return (
      <Control
        value={app.packageName}
        status={selected ? 'checked' : 'unchecked'}
        onPress={() => onSelectionChange?.(!selected)}
      />
    );
  };

  const renderIcon = () => {
    if (app.icon) {
      return <Image source={{ uri: app.icon }} style={styles.icon} />;
    }

    // 默认图标（应用首字母）
    const initial = app.appName.charAt(0).toUpperCase();
    return (
      <View style={[styles.defaultIcon, { backgroundColor: theme.colors.primaryContainer }]}>
        <Text style={[styles.defaultIconText, { color: theme.colors.onPrimaryContainer }]}>
          {initial}
        </Text>
      </View>
    );
  };

  return (
    <List.Item
      style={[styles.container, style]}
      title={app.appName}
      description={app.packageName}
      left={(props) => (
        <View style={styles.leftContainer}>
          {renderSelectionControl()}
          {renderIcon()}
        </View>
      )}
      right={(props) => (
        <View style={styles.rightContainer}>
          {renderRankBadge()}
          {onDelete && (
            <IconButton
              icon="delete-outline"
              size={20}
              onPress={onDelete}
            />
          )}
        </View>
      )}
      onPress={() => {
        // 如果有 onPress 回调，优先执行（用于启动应用）
        if (onPress) {
          onPress();
        } else {
          // 否则执行选择状态改变
          onSelectionChange?.(!selected);
        }
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  defaultIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultIconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: spacing.sm,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default AppListItem;
