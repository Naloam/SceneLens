/**
 * SceneConfigScreen - 场景配置屏幕（重构版本）
 * 使用 React Native Paper 和 Material Design 3 规范
 */

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
  Banner,
  Surface,
  List,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { ScrollView as RNScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAppPreferenceStore } from '../stores';
import { appDiscoveryEngine } from '../discovery';
import { AppListItem, AppSelectionDialog } from '../components/ui';
import { spacing, borderRadius } from '../theme/spacing';
import type { AppCategory } from '../types';
import sceneBridge from '../core/SceneBridge';

type SceneConfigScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SceneConfig'>;

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
  const theme = useTheme();
  // 极淡的主题色背景
  const ultraLightBg = theme.colors.primary + '0A';

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

  const openAppSelection = (category: AppCategory) => {
    setSelectedCategory(category);
    setAppSelectionVisible(true);
  };

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
      const allPreferences = useAppPreferenceStore.getState().preferences;
      allPreferences.set(selectedCategory, updatedPreference);
      await storageManager.saveAppPreferences(allPreferences);
    } catch (error) {
      console.error('保存应用偏好失败:', error);
    }
  };

  const handleLaunchApp = async (packageName: string) => {
    try {
      const success = await sceneBridge.openAppWithDeepLink(packageName, undefined);
      if (!success) {
        Alert.alert('启动失败', `无法打开应用\n\n包名: ${packageName}`, [{ text: '确定' }]);
      }
    } catch (error: any) {
      if (error?.message?.includes('ERR_APP_NOT_FOUND')) {
        Alert.alert('应用未找到', `应用未安装: ${packageName}`, [{ text: '确定' }]);
      } else {
        Alert.alert('启动失败', `打开应用时出错:\n\n${error?.message || '未知错误'}`, [{ text: '确定' }]);
      }
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={[styles.loadingText, { color: theme.colors.primary }]}>
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
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.contentContainer}>
      
      {/* 顶部提示横幅 - 高级淡淡背景 */}
      <Surface style={[styles.banner, { backgroundColor: ultraLightBg }]} elevation={0}>
        <IconButton icon="information" iconColor={theme.colors.primary} size={24} style={{ margin: 0, marginRight: 8 }} />
        <Text style={{ flex: 1, color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
          系统已根据您的使用习惯自动选定了最常用的应用。您可以在这里查看和调整。
        </Text>
      </Surface>

      {/* 权限警告保留 */}
      {hasNoApps && (
        <Banner
          visible
          icon="alert-circle"
          style={[styles.warningBanner, { marginBottom: spacing.md, borderRadius: borderRadius.lg }]}
          actions={[{ label: '前往权限引导', onPress: () => navigation.navigate('PermissionGuide' as never) }]}
        >
          未获取到已安装应用。请确认已授予应用列表或使用情况权限，或稍后点击重新扫描。
        </Banner>
      )}

      {/* 会议场景配置入口 - 完美还原设计图的蓝色块 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.colors.onSurface }}>🎯 场景配置</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>配置特定场景的详细设置</Text>
        </View>

        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <TouchableRipple 
            onPress={() => navigation.navigate('MeetingConfig' as never)}
            style={{ borderRadius: borderRadius.lg, overflow: 'hidden' }}
          >
            <Surface style={[styles.highlightBox, { backgroundColor: theme.colors.primary }]} elevation={0}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.dateBox}>
                  <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: '800' }}>JUL</Text>
                  <Text style={{ fontSize: 16, color: theme.colors.primary, fontWeight: '900' }}>17</Text>
                </View>
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={{ color: theme.colors.onPrimary, fontWeight: '700', fontSize: 16 }}>会议场景配置</Text>
                  <Text style={{ color: theme.colors.onPrimary, opacity: 0.8, fontSize: 12, marginTop: 2 }}>设置办公室位置和首选日历</Text>
                </View>
                <List.Icon icon="chevron-right" color={theme.colors.onPrimary} />
              </View>
            </Surface>
          </TouchableRipple>
        </View>
      </Card>

      {/* 真实应用分类手风琴列表 - 全部包在同一个卡片中 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { paddingVertical: 8, backgroundColor: theme.colors.surface }]}>
        {categories.map((category, index) => {
          const topApps = getTopAppsForCategory(category);
          const isExpanded = expandedCategories.has(category);
          const scene = categoryScenes[category];

          if (topApps.length === 0 && category === 'OTHER') return null;

          return (
            <React.Fragment key={category}>
              <List.Accordion
                title={categoryNames[category]}
                description={scene}
                titleStyle={{ fontWeight: '700', color: theme.colors.primary }}
                left={() => <Text style={{ fontSize: 24, marginHorizontal: 16, alignSelf: 'center' }}>{categoryIcons[category]}</Text>}
                expanded={isExpanded}
                onPress={() => toggleCategoryExpansion(category)}
                style={{ backgroundColor: 'transparent' }}
              >
                {topApps.length > 0 ? (
                  <View style={{ paddingLeft: 16 }}>
                    {topApps.map((packageName, i) => {
                      const app = getAppByPackageName(packageName);
                      if (!app) return null;
                      return (
                        <AppListItem
                          key={packageName}
                          app={app}
                          rank={i + 1}
                          selectionMode="none"
                          onPress={() => handleLaunchApp(packageName)}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>暂无应用</Text>
                  </View>
                )}
                
                {/* 添加应用按钮 */}
                <Button 
                  mode="text" 
                  icon="plus-circle-outline" 
                  textColor={theme.colors.primary} 
                  onPress={() => openAppSelection(category)}
                  style={{ marginVertical: 8 }}
                >
                  {topApps.length > 0 ? `添加更多应用` : `添加应用`}
                </Button>
              </List.Accordion>
              
              {/* 不是最后一个才显示分割线 */}
              {index < categories.length - 1 && <Divider style={{ opacity: 0.2 }} />}
            </React.Fragment>
          );
        })}
      </Card>

      {/* 底部统计信息与刷新按钮 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.colors.onSurface }}>统计信息</Text>
        </View>
        <List.Item title="已安装应用" right={() => <Surface style={[styles.statBadge, { backgroundColor: ultraLightBg }]} elevation={0}><Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{allApps.length}</Text></Surface>} />
        <Divider style={{ opacity: 0.2 }} />
        <List.Item title="已分类应用" right={() => <Surface style={[styles.statBadge, { backgroundColor: ultraLightBg }]} elevation={0}><Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{totalCategorizedApps}</Text></Surface>} />
        <Divider style={{ opacity: 0.2 }} />
        <List.Item title="应用类别" right={() => <Surface style={[styles.statBadge, { backgroundColor: ultraLightBg }]} elevation={0}><Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{preferences.size}</Text></Surface>} />
        
        <View style={{ padding: spacing.md }}>
          <Button 
            mode="contained" 
            icon="refresh" 
            onPress={initializeAppDiscovery} 
            style={{ borderRadius: borderRadius.lg }} 
            contentStyle={{ height: 48 }}
          >
            重新扫描应用
          </Button>
        </View>
      </Card>

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
  container: { flex: 1 },
  contentContainer: { padding: spacing.md, paddingBottom: 60 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontWeight: '600' },
  banner: { flexDirection: 'row', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, alignItems: 'center' },
  warningBanner: { backgroundColor: '#FFF4E5' },
  card: { borderRadius: borderRadius.xl, marginBottom: spacing.md },
  cardHeader: { padding: spacing.md },
  highlightBox: { padding: spacing.md, borderRadius: borderRadius.lg },
  dateBox: { backgroundColor: '#fff', borderRadius: borderRadius.md, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  statBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: borderRadius.md, alignSelf: 'center' },
});

export default SceneConfigScreen;