/**
 * SceneConfigScreen - 场景配置屏幕（重构版本）
 * 使用 React Native Paper 和 Material Design 3 规范
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  IconButton,
  ActivityIndicator,
  Divider,
  Chip,
  Banner,
} from 'react-native-paper';
import { ScrollView as RNScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAppPreferenceStore } from '../stores';
import { appDiscoveryEngine } from '../discovery';
import { AppListItem, AppSelectionDialog } from '../components/ui';
import { spacing } from '../theme/spacing';
import type { AppCategory } from '../types';
import sceneBridge from '../core/SceneBridge';

type SceneConfigScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SceneConfig'>;

/**
 * 应用类别图标映射
 */
const categoryIcons: Record<AppCategory, string> = {
  MUSIC_PLAYER: '🎵',
  TRANSIT_APP: '🚇',
  PAYMENT_APP: '💳',
  MEETING_APP: '📅',
  STUDY_APP: '📚',
  SMART_HOME: '🏠',
  CALENDAR: '📆',
  OTHER: '📦',
};

/**
 * 应用类别名称映射
 */
const categoryNames: Record<AppCategory, string> = {
  MUSIC_PLAYER: '音乐播放器',
  TRANSIT_APP: '交通出行',
  PAYMENT_APP: '支付应用',
  MEETING_APP: '会议应用',
  STUDY_APP: '学习应用',
  SMART_HOME: '智能家居',
  CALENDAR: '日历应用',
  OTHER: '其他',
};

/**
 * 应用类别场景关联
 */
const categoryScenes: Record<AppCategory, string> = {
  MUSIC_PLAYER: '通勤场景',
  TRANSIT_APP: '通勤场景',
  PAYMENT_APP: '通用',
  MEETING_APP: '会议场景',
  STUDY_APP: '学习场景',
  SMART_HOME: '到家场景',
  CALENDAR: '会议场景',
  OTHER: '通用',
};

export const SceneConfigScreen: React.FC = () => {
  const navigation = useNavigation<SceneConfigScreenNavigationProp>();
  const {
    allApps,
    preferences,
    isInitialized,
    isLoading,
    setAllApps,
    setPreferences,
    setIsInitialized,
    setIsLoading,
    getTopAppsForCategory,
    getAppByPackageName,
    updatePreference,
  } = useAppPreferenceStore();

  const [expandedCategories, setExpandedCategories] = useState<Set<AppCategory>>(
    new Set(['MUSIC_PLAYER', 'TRANSIT_APP', 'MEETING_APP'])
  );

  // 应用选择对话框状态
  const [appSelectionVisible, setAppSelectionVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | null>(null);

  useEffect(() => {
    if (!isInitialized) {
      initializeAppDiscovery();
    }
  }, [isInitialized]);

  const initializeAppDiscovery = async () => {
    setIsLoading(true);
    try {
      await appDiscoveryEngine.initialize();
      const apps = appDiscoveryEngine.getAllApps();
      const prefs = appDiscoveryEngine.getAllPreferences();
      setAllApps(apps);
      setPreferences(prefs);
      setIsInitialized(true);
    } catch (error) {
      console.error('[SceneConfig] Failed to initialize app discovery:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategoryExpansion = (category: AppCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const hasNoApps = allApps.length === 0;
  const totalCategorizedApps = Array.from(preferences.values()).reduce(
    (sum, pref) => sum + pref.topApps.length,
    0
  );

  /**
   * 打开应用选择对话框
   */
  const openAppSelection = (category: AppCategory) => {
    setSelectedCategory(category);
    setAppSelectionVisible(true);
  };

  /**
   * 确认应用选择
   */
  const handleAppSelectionConfirm = async (selectedApps: string[]) => {
    if (!selectedCategory) return;

    try {
      const { storageManager } = await import('../stores/storageManager');

      const updatedPreference = {
        category: selectedCategory,
        topApps: selectedApps,
        lastUpdated: Date.now(),
      };

      updatePreference(selectedCategory, updatedPreference);

      // 保存到存储
      const allPreferences = useAppPreferenceStore.getState().preferences;
      allPreferences.set(selectedCategory, updatedPreference);
      await storageManager.saveAppPreferences(allPreferences);

      console.log(`[SceneConfig] Updated ${selectedCategory} apps:`, selectedApps);
    } catch (error) {
      console.error('保存应用偏好失败:', error);
    }
  };

  /**
   * 启动应用
   */
  const handleLaunchApp = async (packageName: string) => {
    try {
      console.log(`[SceneConfig] Attempting to launch app: ${packageName}`);

      // 直接尝试启动，让 native 端检查应用是否安装
      const success = await sceneBridge.openAppWithDeepLink(packageName, null);
      if (success) {
        console.log(`[SceneConfig] Launched app: ${packageName}`);
      } else {
        Alert.alert(
          '启动失败',
          `无法打开应用\n\n包名: ${packageName}\n\n可能原因:\n1. 应用没有启动器界面\n2. 应用已被卸载\n3. 系统权限限制`,
          [{ text: '确定' }]
        );
        console.warn(`[SceneConfig] Failed to launch app ${packageName}: openAppWithDeepLink returned false`);
      }
    } catch (error: any) {
      console.error(`[SceneConfig] Failed to launch app ${packageName}:`, error);

      // 处理不同的错误类型
      if (error?.message?.includes('ERR_APP_NOT_FOUND')) {
        Alert.alert(
          '应用未找到',
          `应用未安装: ${packageName}\n\n请确认应用已正确安装`,
          [{ text: '确定' }]
        );
      } else {
        Alert.alert(
          '启动失败',
          `打开应用时出错:\n\n${error?.message || '未知错误'}`,
          [{ text: '确定' }]
        );
      }
    }
  };

  /**
   * 渲染应用类别卡片
   */
  const renderCategoryCard = (category: AppCategory) => {
    const topApps = getTopAppsForCategory(category);
    const isExpanded = expandedCategories.has(category);
    const scene = categoryScenes[category];

    if (topApps.length === 0 && category === 'OTHER') {
      return null;
    }

    return (
      <Card key={category} mode="outlined" style={styles.categoryCard}>
        {/* 类别头部 */}
        <View style={styles.categoryHeader}>
          <View style={styles.categoryHeaderLeft}>
            <Text style={styles.categoryIcon}>{categoryIcons[category]}</Text>
            <View>
              <Text variant="titleMedium" style={styles.categoryName}>
                {categoryNames[category]}
              </Text>
              <Text variant="bodySmall" style={styles.categoryScene}>
                {scene}
              </Text>
            </View>
          </View>
          <IconButton
            icon={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            onPress={() => toggleCategoryExpansion(category)}
          />
        </View>

        {/* 展开的应用列表 */}
        {isExpanded && (
          <View style={styles.appsList}>
            {topApps.length > 0 ? (
              <RNScrollView
                style={styles.appsScrollView}
                nestedScrollEnabled
                scrollEnabled={topApps.length > 3}
              >
                {topApps.map((packageName, index) => {
                  const app = getAppByPackageName(packageName);
                  if (!app) return null;

                  return (
                    <AppListItem
                      key={packageName}
                      app={app}
                      rank={index + 1}
                      selectionMode="none"
                      onPress={() => handleLaunchApp(packageName)}
                    />
                  );
                })}
              </RNScrollView>
            ) : (
              <View style={styles.noAppsContainer}>
                <Text variant="bodyMedium" style={styles.noAppsText}>
                  暂无应用
                </Text>
                <Button
                  mode="outlined"
                  compact
                  style={styles.addButton}
                  icon="plus"
                  onPress={() => openAppSelection(category)}
                >
                  添加应用
                </Button>
              </View>
            )}

            {/* 添加更多应用按钮 */}
            {topApps.length > 0 && (
              <Button
                mode="text"
                onPress={() => openAppSelection(category)}
                style={styles.addMoreButton}
                labelStyle={styles.addMoreLabel}
                icon="plus-circle-outline"
              >
                {topApps.length > 3 ? `添加更多应用 (已添加${topApps.length}个)` : '添加更多应用'}
              </Button>
            )}
          </View>
        )}
      </Card>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          正在加载应用列表...
        </Text>
      </View>
    );
  }

  const categories: AppCategory[] = [
    'MUSIC_PLAYER',
    'TRANSIT_APP',
    'MEETING_APP',
    'STUDY_APP',
    'SMART_HOME',
    'CALENDAR',
    'PAYMENT_APP',
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 标题区域 */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          场景配置
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          选择各场景的首选应用
        </Text>
      </View>

      {/* 信息卡片 */}
      <Banner
        visible
        icon="information"
        style={styles.infoBanner}
      >
        系统已根据您的使用习惯自动选择了最常用的应用。您可以在这里查看和调整。
      </Banner>

      {/* 权限警告 */}
      {hasNoApps && (
        <Banner
          visible
          icon="alert-circle"
          style={[styles.warningBanner, styles.marginBottom]}
          actions={[
            {
              label: '前往权限引导',
              onPress: () => navigation.navigate('PermissionGuide' as never),
            },
          ]}
        >
          未获取到已安装应用。请确认已授予应用列表或使用情况权限，或稍后点击重新扫描。
        </Banner>
      )}

      {/* 场景配置快捷入口 */}
      <Card mode="elevated" style={styles.sceneConfigCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.sceneConfigTitle}>
            🎯 场景配置
          </Text>
          <Text variant="bodyMedium" style={styles.sceneConfigDescription}>
            配置特定场景的详细设置
          </Text>

          <Button
            mode="contained"
            onPress={() => navigation.navigate('MeetingConfig' as never)}
            style={styles.meetingConfigButton}
            contentStyle={styles.meetingConfigButtonContent}
          >
            <View style={styles.meetingConfigButtonLeft}>
              <Text style={styles.meetingConfigIcon}>📅</Text>
            </View>
            <View style={styles.meetingConfigButtonText}>
              <Text variant="labelLarge" style={styles.meetingConfigButtonTitle}>
                会议场景配置
              </Text>
              <Text variant="bodySmall" style={styles.meetingConfigButtonSubtitle}>
                设置办公室位置和日历权限
              </Text>
            </View>
          </Button>
        </Card.Content>
      </Card>

      {/* 应用类别卡片列表 */}
      {categories.map(renderCategoryCard)}

      {/* 统计信息卡片 */}
      <Card mode="outlined" style={styles.statsCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.statsTitle}>
            统计信息
          </Text>

          <View style={styles.statsRow}>
            <Text variant="bodyMedium" style={styles.statsLabel}>
              已安装应用
            </Text>
            <Chip mode="flat" textStyle={styles.statsChipText}>
              {allApps.length}
            </Chip>
          </View>

          <Divider style={styles.statsDivider} />

          <View style={styles.statsRow}>
            <Text variant="bodyMedium" style={styles.statsLabel}>
              已分类应用
            </Text>
            <Chip mode="flat" textStyle={styles.statsChipText}>
              {totalCategorizedApps}
            </Chip>
          </View>

          <Divider style={styles.statsDivider} />

          <View style={styles.statsRow}>
            <Text variant="bodyMedium" style={styles.statsLabel}>
              应用类别
            </Text>
            <Chip mode="flat" textStyle={styles.statsChipText}>
              {preferences.size}
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* 重新扫描按钮 */}
      <Button
        mode="contained"
        onPress={initializeAppDiscovery}
        icon="refresh"
        style={styles.refreshButton}
        contentStyle={styles.refreshButtonContent}
      >
        重新扫描应用
      </Button>

      {/* 应用选择对话框 */}
      {selectedCategory && (
        <AppSelectionDialog
          visible={appSelectionVisible}
          category={selectedCategory}
          categoryName={categoryNames[selectedCategory]}
          categoryIcon={categoryIcons[selectedCategory]}
          onDismiss={() => setAppSelectionVisible(false)}
          onConfirm={handleAppSelectionConfirm}
          maxSelection={0}
          currentApps={getTopAppsForCategory(selectedCategory)}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  infoBanner: {
    marginBottom: spacing.md,
  },
  warningBanner: {
    backgroundColor: '#FFF4E5',
  },
  marginBottom: {
    marginBottom: spacing.md,
  },
  sceneConfigCard: {
    marginBottom: spacing.lg,
  },
  sceneConfigTitle: {
    fontWeight: '700',
  },
  sceneConfigDescription: {
    marginTop: spacing.xs,
  },
  meetingConfigButton: {
    marginTop: spacing.md,
  },
  meetingConfigButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: spacing.xs,
  },
  meetingConfigButtonLeft: {
    marginRight: spacing.md,
  },
  meetingConfigIcon: {
    fontSize: 28,
  },
  meetingConfigButtonText: {
    flex: 1,
  },
  meetingConfigButtonTitle: {
    fontWeight: '600',
  },
  meetingConfigButtonSubtitle: {
    marginTop: 2,
  },
  categoryCard: {
    marginBottom: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  categoryName: {
    fontWeight: '600',
  },
  categoryScene: {
    marginTop: 2,
  },
  appsList: {
    marginTop: spacing.sm,
  },
  appsScrollView: {
    maxHeight: 300,
  },
  noAppsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  noAppsText: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  addButton: {
    borderColor: '#E0E0E0',
  },
  addMoreButton: {
    marginTop: spacing.sm,
  },
  addMoreLabel: {
    marginLeft: spacing.xs,
  },
  statsCard: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  statsTitle: {
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  statsLabel: {
    flex: 1,
  },
  statsChipText: {
    fontWeight: '700',
  },
  statsDivider: {
    marginVertical: spacing.xs,
  },
  refreshButton: {
    marginTop: spacing.md,
  },
  refreshButtonContent: {
    paddingVertical: spacing.sm,
  },
});

export default SceneConfigScreen;
