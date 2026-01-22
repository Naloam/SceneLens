/**
 * AppSelectionDialog - 应用选择对话框
 * 用于从已安装应用中选择并添加到分类中
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Dialog,
  Portal,
  TextInput,
  Checkbox,
  ActivityIndicator,
  Surface,
  Chip,
  Searchbar,
  Button,
} from 'react-native-paper';
import { useAppPreferenceStore } from '../../stores';
import { appDiscoveryEngine } from '../../discovery';
import type { AppInfo, AppCategory } from '../../types';

interface AppSelectionDialogProps {
  visible: boolean;
  category: AppCategory;
  categoryName: string;
  categoryIcon: string;
  onDismiss: () => void;
  onConfirm: (selectedApps: string[]) => void;
  maxSelection?: number;
  currentApps: string[];
  /** 如果不传或为 0，则不限制数量 */
}

export const AppSelectionDialog: React.FC<AppSelectionDialogProps> = ({
  visible,
  category,
  categoryName,
  categoryIcon,
  onDismiss,
  onConfirm,
  maxSelection = 3,
  currentApps,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [availableApps, setAvailableApps] = useState<AppInfo[]>([]);
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set(currentApps));
  const [isLoading, setIsLoading] = useState(false);

  const { allApps } = useAppPreferenceStore();

  // 预先计算可用应用，避免每次打开对话框时重新计算
  const availableAppsMemo = useMemo(() => {
    if (!allApps || allApps.length === 0) return [];

    // 过滤掉非应用项目（系统组件、插件等）
    const validApps = allApps.filter(app => {
      // 排除包名以以下开头的非应用项目
      const excludePrefixes = [
        'android',
        'com.android.',
        'com.google.android.',
        'com.android.providers',
      ];

      // 检查是否有有效的应用名称
      if (!app.appName || app.appName.trim().length === 0) {
        return false;
      }

      // 排除系统组件和插件
      for (const prefix of excludePrefixes) {
        if (app.packageName.startsWith(prefix) && app.isSystemApp) {
          // 系统应用但包名以这些开头，可能是系统组件
          // 但如果是真正的系统应用（如设置、日历等），应该保留
          if (app.packageName.includes('.provider') ||
              app.packageName.includes('.extension') ||
              app.packageName.includes('.plugin') ||
              app.packageName.includes('.service')) {
            return false;
          }
        }
      }

      return true;
    });

    // 获取该分类的应用
    const categoryApps = validApps.filter(app => app.category === category);

    // 获取其他分类中的应用
    const otherApps = validApps.filter(
      app => app.category === 'OTHER' || app.category === category
    );

    // 合并去重
    const allAvailableApps = [...categoryApps];
    for (const app of otherApps) {
      if (!allAvailableApps.find(a => a.packageName === app.packageName)) {
        allAvailableApps.push(app);
      }
    }

    // 按名称排序，便于快速浏览
    return allAvailableApps.sort((a, b) => a.appName.localeCompare(b.appName));
  }, [allApps, category]);

  useEffect(() => {
    if (visible) {
      // 直接使用预计算的应用列表，不再需要异步加载
      setAvailableApps(availableAppsMemo);
      setSelectedApps(new Set(currentApps));
      setSearchQuery('');
    }
  }, [visible, category, availableAppsMemo, currentApps]);

  /**
   * 加载可用应用（已废弃，改用 useMemo）
   */
  const loadAvailableApps = () => {
    setAvailableApps(availableAppsMemo);
  };

  /**
   * 切换应用选择状态
   */
  const toggleAppSelection = (packageName: string) => {
    const newSelected = new Set(selectedApps);

    if (newSelected.has(packageName)) {
      newSelected.delete(packageName);
    } else {
      // 如果设置了最大选择数量且大于 0，则检查限制
      if (maxSelection && maxSelection > 0 && newSelected.size >= maxSelection) {
        return; // 达到最大选择数量
      }
      newSelected.add(packageName);
    }

    setSelectedApps(newSelected);
  };

  /**
   * 过滤应用
   */
  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return availableApps;

    return availableApps.filter(app =>
      app.appName.toLowerCase().includes(query) ||
      app.packageName.toLowerCase().includes(query)
    );
  }, [availableApps, searchQuery]);

  // 记录选中顺序，避免在渲染时重复计算排名
  const selectionOrder = useMemo(() => {
    const order = new Map<string, number>();
    Array.from(selectedApps).forEach((pkg, idx) => order.set(pkg, idx + 1));
    return order;
  }, [selectedApps]);

  /**
   * 确认选择
   */
  const handleConfirm = () => {
    onConfirm(Array.from(selectedApps));
    onDismiss();
  };

  /**
   * 渲染应用项
   */
  const renderAppItem = useCallback(({ item }: { item: AppInfo }) => {
    const isSelected = selectedApps.has(item.packageName);
    const order = selectionOrder.get(item.packageName);

    // 如果设置了最大选择数量且大于 0，则检查是否可选
    const canSelect = !maxSelection || maxSelection === 0 || selectedApps.size < maxSelection || isSelected;

    return (
      <TouchableOpacity
        style={[
          styles.appItem,
          !canSelect && styles.appItemDisabled,
        ]}
        onPress={() => toggleAppSelection(item.packageName)}
        disabled={!canSelect}
      >
        <View style={styles.appItemLeft}>
          <Checkbox
            status={isSelected ? 'checked' : 'unchecked'}
            onPress={() => canSelect && toggleAppSelection(item.packageName)}
          />
          <View style={styles.appInfo}>
            <Text variant="bodyLarge" style={styles.appName}>
              {item.appName}
            </Text>
            <Text variant="bodySmall" style={styles.packageName}>
              {item.packageName}
            </Text>
          </View>
        </View>
        {isSelected && order && (
          <Chip mode="flat" textStyle={styles.rankText}>
            {order}
          </Chip>
        )}
      </TouchableOpacity>
    );
  }, [maxSelection, selectedApps, selectionOrder]);

  const selectionCount = selectedApps.size;

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={styles.dialog}
      >
        <Dialog.Title style={styles.dialogTitle}>
          <Text style={styles.categoryIcon}>{categoryIcon}</Text>
          选择 {categoryName} 应用
        </Dialog.Title>

        <Dialog.Content style={styles.dialogContent}>
          {/* 搜索框 */}
          <Searchbar
            placeholder="搜索应用"
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
            mode="bar"
          />

          {/* 选择计数 */}
          <Surface style={styles.selectionInfo} elevation={0}>
            <Text variant="bodyMedium">
              已选择 <Text style={styles.countText}>{selectionCount}</Text> {maxSelection && maxSelection > 0 ? `/ ${maxSelection}` : ''} 个应用
            </Text>
          </Surface>

          {/* 应用列表 */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <Text variant="bodyMedium" style={styles.loadingText}>
                正在加载应用列表...
              </Text>
            </View>
          ) : filteredApps.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="bodyMedium" style={styles.emptyText}>
                {searchQuery ? '没有找到匹配的应用' : '该分类暂无可用应用'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredApps}
              renderItem={renderAppItem}
              keyExtractor={(item) => item.packageName}
              style={styles.appList}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={6}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text variant="bodyMedium" style={styles.emptyText}>
                    {searchQuery ? '没有找到匹配的应用' : '暂无应用'}
                  </Text>
                </View>
              }
            />
          )}
        </Dialog.Content>

        <Dialog.Actions style={styles.dialogActions}>
          <View style={styles.actionsContainer}>
            <Text variant="bodySmall" style={styles.hintText}>
              拖动可调整优先级顺序
            </Text>
            <View style={styles.actionButtons}>
              <Button onPress={onDismiss} mode="outlined">
                取消
              </Button>
              <Button
                onPress={handleConfirm}
                mode="contained"
                disabled={selectionCount === 0}
              >
                确认 ({selectionCount})
              </Button>
            </View>
          </View>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
    borderRadius: 16,
  },
  dialogTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    fontSize: 24,
  },
  dialogContent: {
    maxHeight: 400,
  },
  searchbar: {
    marginBottom: 12,
  },
  selectionInfo: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginBottom: 12,
  },
  countText: {
    fontWeight: 'bold',
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.6,
  },
  appList: {
    maxHeight: 280,
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  appItemDisabled: {
    opacity: 0.5,
  },
  appItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appInfo: {
    marginLeft: 8,
    flex: 1,
  },
  appName: {
    fontWeight: '500',
  },
  packageName: {
    opacity: 0.6,
  },
  rankText: {
    fontWeight: 'bold',
  },
  dialogActions: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionsContainer: {
    width: '100%',
  },
  hintText: {
    opacity: 0.6,
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});

export default AppSelectionDialog;
