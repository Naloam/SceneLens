import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { TextInput, Text, Card, Surface, Switch, Button, RadioButton, useTheme, Divider } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { geoFenceManager } from '../stores';
import { useAppPreferenceStore } from '../stores';
import sceneBridge from '../core/SceneBridge';
import { silentContextEngine } from '../core/SilentContextEngine';
import type { GeoFence, Location, AppInfo, AppCategory } from '../types';

/**
 * 会议场景配置屏幕 - Material Design 3 版本
 *
 * 功能：
 * - 配置日历权限（开关 + 测试按钮）
 * - 设置办公室位置（TextInput + Slider 半径调节）
 * - 选择首选日历应用（Radio.Group 单选列表）
 * - 场景说明（Outlined 卡片 + 检查清单）
 */
export const MeetingConfigScreen: React.FC = () => {
  const theme = useTheme();

  // 状态管理
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [officeGeoFence, setOfficeGeoFence] = useState<GeoFence | null>(null);
  const [officeName, setOfficeName] = useState('办公室');
  const [officeRadius, setOfficeRadius] = useState(200);
  const [calendarPermissionGranted, setCalendarPermissionGranted] = useState(false);
  const [calendarApps, setCalendarApps] = useState<AppInfo[]>([]);
  const [selectedCalendarApp, setSelectedCalendarApp] = useState<string | null>(null);

  const { getTopAppsForCategory, getAppByPackageName, updatePreference } = useAppPreferenceStore();

  useEffect(() => {
    initializeMeetingConfig();
  }, []);

  /**
   * 初始化会议配置
   * - 加载地理围栏
   * - 检查日历权限
   * - 获取日历应用列表
   * - 获取当前位置
   */
  const initializeMeetingConfig = async () => {
    setIsLoading(true);
    try {
      // 初始化地理围栏管理器
      await geoFenceManager.initialize();

      // 检查是否已有办公室围栏 - 使用 getAllGeoFences 和 filter
      const allFences = geoFenceManager.getAllGeoFences();
      const existingOffice = allFences.filter(f => f.type === 'OFFICE')[0];
      if (existingOffice) {
        setOfficeGeoFence(existingOffice);
        setOfficeName(existingOffice.name);
        setOfficeRadius(existingOffice.radius);
      }

      // 检查日历权限
      const hasCalendarPermission = await sceneBridge.hasCalendarPermission();
      setCalendarPermissionGranted(hasCalendarPermission);

      // 获取日历应用
      const calendarApps = getTopAppsForCategory('CALENDAR');
      const apps = calendarApps.map(packageName => getAppByPackageName(packageName)).filter(Boolean) as AppInfo[];
      setCalendarApps(apps);

      if (apps.length > 0 && !selectedCalendarApp) {
        setSelectedCalendarApp(apps[0].packageName);
      }

      // 获取当前位置
      try {
        const location = await sceneBridge.getCurrentLocation();
        setCurrentLocation(location);
      } catch (error) {
        console.warn('获取当前位置失败:', error);
      }
    } catch (error) {
      console.error('初始化会议配置失败:', error);
      Alert.alert('错误', '初始化会议配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 请求日历权限
   */
  const requestCalendarPermission = async () => {
    try {
      const granted = await sceneBridge.requestCalendarPermission();
      setCalendarPermissionGranted(granted);

      if (!granted) {
        Alert.alert(
          '权限被拒绝',
          '需要日历权限来检测会议事件。请在设置中手动开启权限。',
          [{ text: '知道了' }]
        );
      }
    } catch (error) {
      console.error('请求日历权限失败:', error);
      Alert.alert('错误', '请求日历权限失败');
    }
  };

  /**
   * 设置当前位置为办公室
   */
  const setCurrentLocationAsOffice = async () => {
    if (!currentLocation) {
      Alert.alert('错误', '无法获取当前位置');
      return;
    }

    try {
      setIsLoading(true);

      if (officeGeoFence) {
        // 更新现有围栏
        await geoFenceManager.updateGeoFence(officeGeoFence.id, {
          name: officeName,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radius: officeRadius,
        });
      } else {
        // 创建新围栏
        const newFence = await geoFenceManager.createGeoFence(
          officeName,
          'OFFICE',
          currentLocation.latitude,
          currentLocation.longitude,
          officeRadius
        );
        setOfficeGeoFence(newFence);
      }

      // 刷新静默引擎的地理配置
      await silentContextEngine.refreshGeoConfiguration();

      Alert.alert('成功', '办公室位置已设置');
    } catch (error) {
      console.error('设置办公室位置失败:', error);
      Alert.alert('错误', '设置办公室位置失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 更新首选日历应用
   */
  const updateSelectedCalendarApp = async (packageName: string) => {
    setSelectedCalendarApp(packageName);

    try {
      const currentPreference = useAppPreferenceStore.getState().preferences.get('CALENDAR');

      const updatedPreference = {
        category: 'CALENDAR' as AppCategory,
        topApps: [packageName, ...(currentPreference?.topApps.filter(app => app !== packageName) || [])].slice(0, 3),
        lastUpdated: Date.now(),
      };

      updatePreference('CALENDAR', updatedPreference);

      // 保存到存储
      const { storageManager } = await import('../stores/storageManager');
      const allPreferences = useAppPreferenceStore.getState().preferences;
      allPreferences.set('CALENDAR', updatedPreference);
      await storageManager.saveAppPreferences(allPreferences);

    } catch (error) {
      console.error('保存日历应用偏好失败:', error);
    }
  };

  /**
   * 测试会议检测
   */
  const testMeetingDetection = async () => {
    // 重新检查权限状态
    const hasPermission = await sceneBridge.hasCalendarPermission();

    if (!hasPermission) {
      Alert.alert(
        '权限未授予',
        '需要日历权限来检测会议事件。请点击下方的开关授予权限。',
        [{ text: '知道了' }]
      );
      setCalendarPermissionGranted(false);
      return;
    }

    // 更新状态
    if (!calendarPermissionGranted) {
      setCalendarPermissionGranted(true);
    }

    try {
      setIsLoading(true);

      // 获取未来1小时的日历事件
      const events = await sceneBridge.getUpcomingEvents(1);

      if (events.length === 0) {
        Alert.alert('测试结果', '未来1小时内没有会议事件');
      } else {
        const eventTitles = events.map(e => e.title).join('\n');
        Alert.alert(
          '测试结果',
          `检测到 ${events.length} 个会议事件：\n\n${eventTitles}`
        );
      }
    } catch (error) {
      console.error('测试会议检测失败:', error);
      Alert.alert('错误', `测试会议检测失败: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Surface style={styles.loadingContainer} elevation={0}>
        <View style={styles.loadingContent}>
          <Text variant="bodyLarge" style={{ color: theme.colors.primary }}>
            正在加载会议配置...
          </Text>
        </View>
      </Surface>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 标题区域 */}
      <Surface style={styles.header} elevation={1}>
        <Text variant="headlineMedium" style={styles.title}>
          会议场景配置
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          设置办公室位置和首选日历应用
        </Text>
      </Surface>

      {/* 日历权限配置卡片 */}
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              📅 日历权限
            </Text>
            <Switch
              value={calendarPermissionGranted}
              onValueChange={requestCalendarPermission}
            />
          </View>
          <Text variant="bodyMedium" style={styles.cardDescription}>
            需要日历权限来检测即将开始的会议事件
          </Text>

          {calendarPermissionGranted && (
            <Button
              mode="contained"
              onPress={testMeetingDetection}
              icon="magnify"
              style={styles.testButton}
              contentStyle={styles.testButtonContent}
            >
              测试会议检测
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* 办公室位置配置卡片 */}
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            🏢 办公室位置
          </Text>
          <Text variant="bodyMedium" style={styles.cardDescription}>
            设置办公室的地理围栏，用于会议场景识别
          </Text>

          {/* 围栏名称输入 */}
          <TextInput
            label="围栏名称"
            value={officeName}
            onChangeText={setOfficeName}
            mode="outlined"
            style={styles.input}
            placeholder="输入办公室名称"
          />

          {/* 半径滑块 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderHeader}>
              <Text variant="bodyMedium">围栏半径</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                {officeRadius} 米
              </Text>
            </View>
            <Slider
              value={officeRadius}
              onValueChange={setOfficeRadius}
              minimumValue={50}
              maximumValue={1000}
              step={10}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.surfaceVariant}
              thumbTintColor={theme.colors.primary}
              style={styles.slider}
            />
            <View style={styles.sliderLabels}>
              <Text variant="bodySmall" style={styles.sliderLabel}>50m</Text>
              <Text variant="bodySmall" style={styles.sliderLabel}>1000m</Text>
            </View>
          </View>

          {/* 当前位置信息 */}
          {currentLocation && (
            <Surface style={styles.locationInfo} elevation={0}>
              <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                📍 当前位置
              </Text>
              <Text variant="bodySmall" style={styles.locationText}>
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </Text>
              <Text variant="bodySmall" style={styles.locationAccuracy}>
                精度: ±{currentLocation.accuracy.toFixed(0)}米
              </Text>
            </Surface>
          )}

          {/* 设置/更新按钮 */}
          <Button
            mode="contained"
            onPress={setCurrentLocationAsOffice}
            disabled={!currentLocation}
            icon="map-marker"
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
          >
            {officeGeoFence ? '更新办公室位置' : '设置当前位置为办公室'}
          </Button>

          {/* 当前围栏信息 */}
          {officeGeoFence && (
            <Surface style={styles.fenceInfo} elevation={0}>
              <Text variant="titleSmall" style={styles.fenceInfoTitle}>
                当前办公室围栏
              </Text>
              <Divider style={styles.divider} />
              <Text variant="bodyMedium">名称: {officeGeoFence.name}</Text>
              <Text variant="bodyMedium">
                位置: {officeGeoFence.latitude.toFixed(6)}, {officeGeoFence.longitude.toFixed(6)}
              </Text>
              <Text variant="bodyMedium">半径: {officeGeoFence.radius}米</Text>
            </Surface>
          )}
        </Card.Content>
      </Card>

      {/* 首选日历应用卡片 */}
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            📱 首选日历应用
          </Text>
          <Text variant="bodyMedium" style={styles.cardDescription}>
            选择会议场景中要打开的日历应用
          </Text>

          {calendarApps.length > 0 ? (
            <RadioButton.Group
              onValueChange={updateSelectedCalendarApp}
              value={selectedCalendarApp || ''}
            >
              {calendarApps.map((app) => (
                <RadioButton.Item
                  key={app.packageName}
                  label={app.appName}
                  value={app.packageName}
                  mode="android"
                  position="leading"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                />
              ))}
            </RadioButton.Group>
          ) : (
            <Text variant="bodyMedium" style={styles.noAppsText}>
              未检测到日历应用。请确保已安装日历应用并重新扫描。
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* 场景说明卡片 */}
      <Card mode="outlined" style={[styles.card, styles.infoCard]}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.infoTitle}>
            💡 会议场景说明
          </Text>
          <Divider style={styles.divider} />
          <Text variant="bodyMedium" style={styles.infoText}>
            会议场景会在以下条件满足时触发：
          </Text>

          <View style={styles.checklist}>
            <View style={styles.checklistItem}>
              <Text style={styles.checklistBullet}>✓</Text>
              <Text variant="bodyMedium" style={styles.checklistText}>
                工作日的工作时间（9:00-18:00）
              </Text>
            </View>
            <View style={styles.checklistItem}>
              <Text style={styles.checklistBullet}>✓</Text>
              <Text variant="bodyMedium" style={styles.checklistText}>
                位于办公室围栏内
              </Text>
            </View>
            <View style={styles.checklistItem}>
              <Text style={styles.checklistBullet}>✓</Text>
              <Text variant="bodyMedium" style={styles.checklistText}>
                日历中有即将开始的会议（未来30分钟内）
              </Text>
            </View>
            <View style={styles.checklistItem}>
              <Text style={styles.checklistBullet}>✓</Text>
              <Text variant="bodyMedium" style={styles.checklistText}>
                设备处于静止状态
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />
          <Text variant="bodyMedium" style={styles.infoNote}>
            触发后会自动开启勿扰模式并打开日历应用。
          </Text>
        </Card.Content>
      </Card>

      {/* 底部间距 */}
      <View style={styles.bottomSpacer} />
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
    backgroundColor: '#F5F5F5',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.7,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '600',
  },
  cardDescription: {
    opacity: 0.7,
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    marginBottom: 16,
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    opacity: 0.6,
  },
  locationInfo: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    marginBottom: 16,
  },
  locationText: {
    marginTop: 4,
  },
  locationAccuracy: {
    marginTop: 4,
    opacity: 0.7,
  },
  actionButton: {
    marginBottom: 16,
  },
  actionButtonContent: {
    paddingVertical: 8,
  },
  testButton: {
    marginTop: 8,
  },
  testButtonContent: {
    paddingVertical: 6,
  },
  fenceInfo: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  fenceInfoTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 8,
  },
  radioItem: {
    paddingVertical: 4,
  },
  radioLabel: {
    fontWeight: '500',
  },
  radioDescription: {
    fontSize: 12,
    opacity: 0.6,
  },
  noAppsText: {
    textAlign: 'center',
    paddingVertical: 16,
    opacity: 0.6,
  },
  infoCard: {
    backgroundColor: '#E8F5E9',
    borderColor: '#81C784',
  },
  infoTitle: {
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  infoText: {
    color: '#2E7D32',
    marginBottom: 12,
  },
  checklist: {
    marginVertical: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  checklistBullet: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginRight: 8,
    fontSize: 16,
  },
  checklistText: {
    flex: 1,
    color: '#2E7D32',
    lineHeight: 20,
  },
  infoNote: {
    color: '#2E7D32',
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 32,
  },
});
