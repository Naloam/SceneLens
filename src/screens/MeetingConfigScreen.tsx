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
import { spacing, borderRadius } from '../theme/spacing';
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
  const ultraLightBg = theme.colors.primary + '0A'; // 极淡的主题色背景

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

  const initializeMeetingConfig = async () => {
    setIsLoading(true);
    try {
      await geoFenceManager.initialize();
      const allFences = geoFenceManager.getAllGeoFences();
      const existingOffice = allFences.filter(f => f.type === 'OFFICE')[0];
      if (existingOffice) {
        setOfficeGeoFence(existingOffice);
        setOfficeName(existingOffice.name);
        setOfficeRadius(existingOffice.radius);
      }

      const hasCalendarPermission = await sceneBridge.hasCalendarPermission();
      setCalendarPermissionGranted(hasCalendarPermission);

      const calendarApps = getTopAppsForCategory('CALENDAR');
      const apps = calendarApps.map(packageName => getAppByPackageName(packageName)).filter(Boolean) as AppInfo[];
      setCalendarApps(apps);

      if (apps.length > 0 && !selectedCalendarApp) {
        setSelectedCalendarApp(apps[0].packageName);
      }

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

  const requestCalendarPermission = async () => {
    try {
      const granted = await sceneBridge.requestCalendarPermission();
      setCalendarPermissionGranted(granted);

      if (!granted) {
        Alert.alert('权限被拒绝', '需要日历权限来检测会议事件。请在设置中手动开启权限。', [{ text: '知道了' }]);
      }
    } catch (error) {
      console.error('请求日历权限失败:', error);
      Alert.alert('错误', '请求日历权限失败');
    }
  };

  const setCurrentLocationAsOffice = async () => {
    if (!currentLocation) {
      Alert.alert('错误', '无法获取当前位置');
      return;
    }

    try {
      setIsLoading(true);

      if (officeGeoFence) {
        await geoFenceManager.updateGeoFence(officeGeoFence.id, {
          name: officeName,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radius: officeRadius,
        });
      } else {
        const newFence = await geoFenceManager.createGeoFence(
          officeName,
          'OFFICE',
          currentLocation.latitude,
          currentLocation.longitude,
          officeRadius
        );
        setOfficeGeoFence(newFence);
      }

      await silentContextEngine.refreshGeoConfiguration();
      Alert.alert('成功', '办公室位置已设置');
    } catch (error) {
      console.error('设置办公室位置失败:', error);
      Alert.alert('错误', '设置办公室位置失败');
    } finally {
      setIsLoading(false);
    }
  };

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

      const { storageManager } = await import('../stores/storageManager');
      const allPreferences = useAppPreferenceStore.getState().preferences;
      allPreferences.set('CALENDAR', updatedPreference);
      await storageManager.saveAppPreferences(allPreferences);
    } catch (error) {
      console.error('保存日历应用偏好失败:', error);
    }
  };

  const testMeetingDetection = async () => {
    const hasPermission = await sceneBridge.hasCalendarPermission();
    if (!hasPermission) {
      Alert.alert('权限未授予', '需要日历权限来检测会议事件。请点击下方的开关授予权限。', [{ text: '知道了' }]);
      setCalendarPermissionGranted(false);
      return;
    }

    if (!calendarPermissionGranted) {
      setCalendarPermissionGranted(true);
    }

    try {
      setIsLoading(true);
      const events = await sceneBridge.getUpcomingEvents(1);
      if (events.length === 0) {
        Alert.alert('测试结果', '未来1小时内没有会议事件');
      } else {
        const eventTitles = events.map(e => e.title).join('\n');
        Alert.alert('测试结果', `检测到 ${events.length} 个会议事件：\n\n${eventTitles}`);
      }
    } catch (error) {
      console.error('测试会议检测失败:', error);
      Alert.alert('错误', `测试会议检测失败: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !officeGeoFence) {
    return (
      <View style={styles.loadingContainer}>
        <Text variant="bodyLarge" style={{ color: theme.colors.primary, fontWeight: '600' }}>正在加载配置...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.contentContainer}>
      
      {/* 顶部标题区域：采用超淡色块包裹 */}
      <Surface style={[styles.header, { backgroundColor: ultraLightBg }]} elevation={0}>
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>会议场景配置</Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>设置办公室位置和首选日历应用</Text>
      </Surface>

      {/* 日历权限配置卡片 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <Text style={{ fontSize: 24, marginRight: 12 }}>📅</Text>
               <Text variant="titleMedium" style={styles.cardTitle}>日历权限</Text>
            </View>
            <Switch value={calendarPermissionGranted} onValueChange={requestCalendarPermission} color={theme.colors.primary} />
          </View>
          <Text variant="bodyMedium" style={styles.cardDescription}>
            需要日历权限来检测即将开始的会议事件，从而自动触发会议模式。
          </Text>

          {calendarPermissionGranted && (
            <Button
              mode="contained-tonal"
              onPress={testMeetingDetection}
              icon="magnify"
              buttonColor={theme.colors.primaryContainer}
              textColor={theme.colors.primary}
              style={styles.testButton}
            >
              测试会议检测
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* 办公室位置配置卡片 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.cardContent}>
          <View style={[styles.cardHeader, { marginBottom: 16 }]}>
             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <Text style={{ fontSize: 24, marginRight: 12 }}>🏢</Text>
               <Text variant="titleMedium" style={styles.cardTitle}>办公室位置</Text>
             </View>
          </View>
          
          <TextInput
            label="围栏名称"
            value={officeName}
            onChangeText={setOfficeName}
            mode="outlined"
            style={styles.input}
            placeholder="输入办公室名称"
            outlineColor={theme.colors.outlineVariant}
            activeOutlineColor={theme.colors.primary}
          />

          <Surface style={[styles.radiusContainer, { backgroundColor: theme.colors.surfaceVariant, opacity: 0.8 }]} elevation={0}>
            <View style={styles.radiusHeader}>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>围栏半径</Text>
              <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: '800' }}>
                {officeRadius} m
              </Text>
            </View>
            <Slider
              value={officeRadius}
              onValueChange={setOfficeRadius}
              minimumValue={50}
              maximumValue={1000}
              step={10}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.outlineVariant}
              thumbTintColor={theme.colors.primary}
              style={styles.slider}
            />
          </Surface>

          {currentLocation && (
             <Surface style={[styles.locationInfo, { backgroundColor: ultraLightBg }]} elevation={0}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                 <View>
                    <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>📍 当前位置</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.primary, opacity: 0.8, marginTop: 4 }}>
                       {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                    </Text>
                 </View>
                 <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: '700', opacity: 0.8 }}>±{currentLocation.accuracy.toFixed(0)}m</Text>
               </View>
             </Surface>
          )}

          {officeGeoFence && (
             <Surface style={styles.fenceInfo} elevation={0}>
               <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: 8, color: theme.colors.onSurfaceVariant }}>当前已设置围栏</Text>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{officeGeoFence.name}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>半径 {officeGeoFence.radius}m</Text>
               </View>
             </Surface>
          )}

          <Button
            mode="contained"
            onPress={setCurrentLocationAsOffice}
            disabled={!currentLocation}
            icon="map-marker-check"
            style={styles.actionButton}
            contentStyle={{ height: 48 }}
          >
            {officeGeoFence ? '更新当前位置为办公室' : '设置当前位置为办公室'}
          </Button>
        </Card.Content>
      </Card>

      {/* 首选日历应用卡片 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.cardContent}>
          <View style={[styles.cardHeader, { marginBottom: 8 }]}>
             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <Text style={{ fontSize: 24, marginRight: 12 }}>📱</Text>
               <Text variant="titleMedium" style={styles.cardTitle}>首选日历应用</Text>
             </View>
          </View>
          <Text variant="bodyMedium" style={styles.cardDescription}>
            选择会议场景中自动打开的日历应用
          </Text>

          {calendarApps.length > 0 ? (
            <RadioButton.Group onValueChange={updateSelectedCalendarApp} value={selectedCalendarApp || ''}>
              {calendarApps.map((app) => (
                <Surface key={app.packageName} style={{ backgroundColor: selectedCalendarApp === app.packageName ? ultraLightBg : 'transparent', borderRadius: 12, marginBottom: 4 }} elevation={0}>
                  <RadioButton.Item
                    label={app.appName}
                    value={app.packageName}
                    mode="android"
                    position="leading"
                    color={theme.colors.primary}
                    labelStyle={{ fontWeight: selectedCalendarApp === app.packageName ? '700' : '500', color: theme.colors.onSurface }}
                    style={{ paddingVertical: 4 }}
                  />
                </Surface>
              ))}
            </RadioButton.Group>
          ) : (
            <Surface style={{ padding: 16, borderRadius: 12, backgroundColor: theme.colors.surfaceVariant, opacity: 0.7 }} elevation={0}>
              <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
                未检测到日历应用。请确保已安装并重新扫描。
              </Text>
            </Surface>
          )}
        </Card.Content>
      </Card>

      {/* 场景说明卡片 - 保留绿色，升级为无边框大圆角 */}
      <Card mode="elevated" elevation={0} style={[styles.card, { backgroundColor: '#F0FDF4' }]}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium" style={styles.infoTitle}>
            💡 会议场景说明
          </Text>
          <Text variant="bodyMedium" style={[styles.infoText, { marginBottom: 12 }]}>
            会议场景会在以下条件满足时触发：
          </Text>

          <View style={styles.checklist}>
            {['工作日的工作时间（9:00-18:00）', '位于办公室围栏内', '日历中有即将开始的会议', '设备处于静止状态'].map((text, i) => (
              <View key={i} style={styles.checklistItem}>
                <Text style={styles.checklistBullet}>✓</Text>
                <Text variant="bodyMedium" style={styles.checklistText}>{text}</Text>
              </View>
            ))}
          </View>

          <Divider style={[styles.divider, { backgroundColor: '#BBF7D0', marginVertical: 12 }]} />
          <Text variant="bodySmall" style={styles.infoNote}>
            触发后会自动开启勿扰模式并打开首选日历应用。
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { padding: 20, marginBottom: 16, borderRadius: borderRadius.xl },
  title: { fontWeight: '800' },
  subtitle: { marginTop: 4, fontWeight: '600' },
  
  card: { marginBottom: 16, borderRadius: borderRadius.xl },
  cardContent: { padding: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontWeight: '800' },
  cardDescription: { opacity: 0.7, marginBottom: 16, lineHeight: 20 },
  
  input: { marginBottom: 16 },
  
  radiusContainer: { padding: 16, borderRadius: 16, marginBottom: 16 },
  radiusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  slider: { width: '100%', height: 40 },
  
  locationInfo: { padding: 16, borderRadius: 16, marginBottom: 16 },
  fenceInfo: { padding: 16, borderRadius: 16, backgroundColor: '#F3F4F6', marginBottom: 16 },
  
  actionButton: { borderRadius: 12 },
  testButton: { borderRadius: 999 },
  
  infoTitle: { fontWeight: '800', color: '#166534', marginBottom: 8 },
  infoText: { color: '#15803D', fontWeight: '600' },
  checklist: { marginVertical: 4 },
  checklistItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  checklistBullet: { color: '#16A34A', fontWeight: '900', marginRight: 10, fontSize: 16 },
  checklistText: { flex: 1, color: '#15803D', lineHeight: 22, fontWeight: '600' },
  infoNote: { color: '#166534', fontStyle: 'italic', opacity: 0.8 },
  
  bottomSpacer: { height: 40 },
});

export default MeetingConfigScreen;