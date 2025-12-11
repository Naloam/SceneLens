import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAppPreferenceStore, useSceneStore } from '../stores';
import { appDiscoveryEngine } from '../discovery';
import type { AppCategory } from '../types';

export const SceneConfigScreen: React.FC = () => {
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
  } = useAppPreferenceStore();

  const { autoModeScenes, toggleAutoModeForScene, isAutoModeEnabledForScene } =
    useSceneStore();

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
      console.error('Failed to initialize app discovery:', error);
      Alert.alert('错误', '无法加载应用列表');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryName = (category: AppCategory): string => {
    const names: Record<AppCategory, string> = {
      MUSIC_PLAYER: '音乐播放器',
      TRANSIT_APP: '乘车码/交通',
      PAYMENT_APP: '支付应用',
      MEETING_APP: '会议应用',
      STUDY_APP: '学习应用',
      SMART_HOME: '智能家居',
      CALENDAR: '日历应用',
      OTHER: '其他',
    };
    return names[category] || category;
  };

  const getSceneForCategory = (category: AppCategory): string => {
    const sceneMap: Record<AppCategory, string> = {
      MUSIC_PLAYER: '通勤场景',
      TRANSIT_APP: '通勤场景',
      PAYMENT_APP: '通用',
      MEETING_APP: '会议场景',
      STUDY_APP: '学习场景',
      SMART_HOME: '到家场景',
      CALENDAR: '会议场景',
      OTHER: '通用',
    };
    return sceneMap[category] || '通用';
  };

  const renderCategoryCard = (category: AppCategory) => {
    const topApps = getTopAppsForCategory(category);
    if (topApps.length === 0 && category === 'OTHER') {
      return null;
    }

    return (
      <View key={category} style={styles.categoryCard}>
        <View style={styles.categoryHeader}>
          <View>
            <Text style={styles.categoryName}>{getCategoryName(category)}</Text>
            <Text style={styles.categoryScene}>{getSceneForCategory(category)}</Text>
          </View>
        </View>

        <View style={styles.appsContainer}>
          {topApps.slice(0, 3).map((packageName, index) => {
            const app = getAppByPackageName(packageName);
            if (!app) return null;

            return (
              <View key={packageName} style={styles.appItem}>
                <View style={styles.appRank}>
                  <Text style={styles.appRankText}>{index + 1}</Text>
                </View>
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>{app.appName}</Text>
                  <Text style={styles.appPackage} numberOfLines={1}>
                    {app.packageName}
                  </Text>
                </View>
              </View>
            );
          })}

          {topApps.length === 0 && (
            <Text style={styles.noAppsText}>暂无应用</Text>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>正在加载应用列表...</Text>
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
      <View style={styles.header}>
        <Text style={styles.title}>场景配置</Text>
        <Text style={styles.subtitle}>选择各场景的首选应用</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          💡 系统已根据您的使用习惯自动选择了最常用的应用。您可以在这里查看和调整。
        </Text>
      </View>

      {categories.map(renderCategoryCard)}

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>统计信息</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>已安装应用</Text>
          <Text style={styles.statsValue}>{allApps.length}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>已分类应用</Text>
          <Text style={styles.statsValue}>
            {Array.from(preferences.values()).reduce(
              (sum, pref) => sum + pref.topApps.length,
              0
            )}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>应用类别</Text>
          <Text style={styles.statsValue}>{preferences.size}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={initializeAppDiscovery}
      >
        <Text style={styles.refreshButtonText}>🔄 重新扫描应用</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 16,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categoryScene: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  appsContainer: {
    gap: 8,
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  appRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appRankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  appPackage: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  noAppsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statsLabel: {
    fontSize: 14,
    color: '#666',
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 32,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
