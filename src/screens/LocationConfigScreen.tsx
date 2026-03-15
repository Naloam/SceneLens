/**
 * LocationConfigScreen - 位置配置屏幕
 * 用于设置家、办公室、地铁站的地理围栏
 */

/**
 * LocationConfigScreen - 位置配置屏幕
 * 用于设置家、办公室、地铁站的地理围栏
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
  Keyboard,
} from 'react-native';
import {
  TextInput,
  Text,
  Card,
  Surface,
  Switch,
  Button,
  RadioButton,
  useTheme,
  Divider,
  ProgressBar,
  Portal,
  Modal,
  IconButton,
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { geoFenceManager } from '../stores';
import sceneBridge from '../core/SceneBridge';
import { silentContextEngine } from '../core/SilentContextEngine';
import type { GeoFence, Location, GeoFenceType } from '../types';
import { spacing, borderRadius } from '../theme/spacing';

type FenceConfigType = 'HOME' | 'OFFICE' | 'SUBWAY_STATION';

/**
 * 围栏配置接口
 */
interface FenceConfig {
  name: string;
  type: FenceConfigType;
  icon: string;
  displayName: string;
  description: string;
  defaultRadius: number;
  fence: GeoFence | null;
}

export const LocationConfigScreen: React.FC = () => {
  const theme = useTheme();
  const ultraLightBg = theme.colors.primary + '0A'; // 极淡的主题色背景

  // 状态管理
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [selectedTab, setSelectedTab] = useState<FenceConfigType>('HOME');

  // 手动输入相关状态
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [manualInputType, setManualInputType] = useState<FenceConfigType>('HOME');

  // 滑块临时值状态（避免频繁更新）
  const [sliderValues, setSliderValues] = useState<Record<FenceConfigType, number>>({
    HOME: 100,
    OFFICE: 200,
    SUBWAY_STATION: 150,
  });

  // 围栏配置
  const [fenceConfigs, setFenceConfigs] = useState<Record<FenceConfigType, FenceConfig>>({
    HOME: {
      name: '家',
      type: 'HOME',
      icon: '🏠',
      displayName: '家庭位置',
      description: '设置家的位置，用于识别回家场景和睡眠场景',
      defaultRadius: 100,
      fence: null,
    },
    OFFICE: {
      name: '办公室',
      type: 'OFFICE',
      icon: '🏢',
      displayName: '办公室位置',
      description: '设置办公室位置，用于识别办公场景和会议场景',
      defaultRadius: 200,
      fence: null,
    },
    SUBWAY_STATION: {
      name: '地铁站',
      type: 'SUBWAY_STATION',
      icon: '🚇',
      displayName: '常用地铁站',
      description: '设置常用地铁站位置，用于识别通勤场景',
      defaultRadius: 150,
      fence: null,
    },
  });

  useEffect(() => {
    initializeLocationConfig();
  }, []);

  // 同步滑块值到围栏配置
  useEffect(() => {
    const updatedSliderValues = { ...sliderValues };
    let hasChanges = false;
    
    for (const [type, config] of Object.entries(fenceConfigs)) {
      if (config.fence && config.fence.radius !== updatedSliderValues[type as FenceConfigType]) {
        updatedSliderValues[type as FenceConfigType] = config.fence.radius;
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      setSliderValues(updatedSliderValues);
    }
  }, [fenceConfigs]);

  /**
   * 初始化位置配置
   */
  const initializeLocationConfig = async () => {
    setIsLoading(true);
    try {
      await geoFenceManager.initialize();
      const allFences = geoFenceManager.getAllGeoFences();
      const updatedConfigs = { ...fenceConfigs };
      for (const fence of allFences) {
        const type = fence.type as FenceConfigType;
        if (type in updatedConfigs) {
          updatedConfigs[type].fence = fence;
        }
      }
      setFenceConfigs(updatedConfigs);

      try {
        const location = await sceneBridge.getCurrentLocation();
        setCurrentLocation(location);
      } catch (error) {
        console.warn('获取当前位置失败:', error);
      }
    } catch (error) {
      console.error('初始化位置配置失败:', error);
      Alert.alert('错误', '初始化位置配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 刷新当前位置
   */
  const refreshLocation = async () => {
    setIsRefreshing(true);
    try {
      const location = await sceneBridge.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.error('刷新位置失败:', error);
      Alert.alert('错误', '无法获取当前位置');
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * 设置当前位置为选定类型的围栏
   */
  const setCurrentLocationAsFence = async (type: FenceConfigType) => {
    if (!currentLocation) {
      Alert.alert('错误', '无法获取当前位置');
      return;
    }

    const config = fenceConfigs[type];

    try {
      setIsLoading(true);
      const existing = config.fence;

      if (existing) {
        const updated = await geoFenceManager.updateGeoFence(existing.id, {
          name: config.name,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radius: config.defaultRadius,
        });

        if (updated) {
          setFenceConfigs(prev => ({
            ...prev,
            [type]: { ...prev[type], fence: updated },
          }));
        }
      } else {
        const newFence = await geoFenceManager.createGeoFence(
          config.name,
          type,
          currentLocation.latitude,
          currentLocation.longitude,
          config.defaultRadius
        );

        setFenceConfigs(prev => ({
          ...prev,
          [type]: { ...prev[type], fence: newFence },
        }));
      }

      await silentContextEngine.refreshGeoConfiguration();
      Alert.alert('成功', `${config.displayName}已设置`);
    } catch (error) {
      console.error(`设置${config.displayName}失败:`, error);
      Alert.alert('错误', `设置${config.displayName}失败`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 删除围栏
   */
  const deleteFence = async (type: FenceConfigType) => {
    const config = fenceConfigs[type];
    if (!config.fence) return;

    Alert.alert(
      '确认删除',
      `确定要删除${config.displayName}吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await geoFenceManager.deleteGeoFence(config.fence!.id);

              setFenceConfigs(prev => ({
                ...prev,
                [type]: { ...prev[type], fence: null },
              }));

              await silentContextEngine.refreshGeoConfiguration();
              Alert.alert('成功', `${config.displayName}已删除`);
            } catch (error) {
              console.error(`删除${config.displayName}失败:`, error);
              Alert.alert('错误', `删除${config.displayName}失败`);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  /**
   * 更新围栏半径
   */
  const handleSliderChange = useCallback((type: FenceConfigType, value: number) => {
    setSliderValues(prev => ({
      ...prev,
      [type]: Math.round(value),
    }));
  }, []);

  /**
   * 打开手动输入对话框
   */
  const openManualInput = (type: FenceConfigType) => {
    const config = fenceConfigs[type];
    setManualInputType(type);
    
    if (config.fence) {
      setManualLatitude(config.fence.latitude.toFixed(6));
      setManualLongitude(config.fence.longitude.toFixed(6));
    } else if (currentLocation) {
      setManualLatitude(currentLocation.latitude.toFixed(6));
      setManualLongitude(currentLocation.longitude.toFixed(6));
    } else {
      setManualLatitude('');
      setManualLongitude('');
    }
    
    setShowManualInput(true);
  };

  /**
   * 验证经纬度输入
   */
  const validateCoordinates = (lat: string, lng: string): { valid: boolean; error?: string } => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) return { valid: false, error: '请输入有效的数字' };
    if (latNum < -90 || latNum > 90) return { valid: false, error: '纬度范围: -90 到 90' };
    if (lngNum < -180 || lngNum > 180) return { valid: false, error: '经度范围: -180 到 180' };
    
    return { valid: true };
  };

  /**
   * 保存手动输入的坐标
   */
  const saveManualCoordinates = async () => {
    const validation = validateCoordinates(manualLatitude, manualLongitude);
    if (!validation.valid) {
      Alert.alert('输入错误', validation.error);
      return;
    }

    const latitude = parseFloat(manualLatitude);
    const longitude = parseFloat(manualLongitude);
    const config = fenceConfigs[manualInputType];

    try {
      setIsLoading(true);
      Keyboard.dismiss();

      if (config.fence) {
        const updated = await geoFenceManager.updateGeoFence(config.fence.id, {
          latitude,
          longitude,
        });

        if (updated) {
          setFenceConfigs(prev => ({
            ...prev,
            [manualInputType]: { ...prev[manualInputType], fence: updated },
          }));
        }
      } else {
        const newFence = await geoFenceManager.createGeoFence(
          config.name,
          manualInputType,
          latitude,
          longitude,
          config.defaultRadius
        );

        setFenceConfigs(prev => ({
          ...prev,
          [manualInputType]: { ...prev[manualInputType], fence: newFence },
        }));
      }

      await silentContextEngine.refreshGeoConfiguration();
      setShowManualInput(false);
      Alert.alert('成功', `${config.displayName}位置已更新`);
    } catch (error) {
      console.error('保存坐标失败:', error);
      Alert.alert('错误', '保存位置失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 打开地图应用选择位置
   */
  const openMapForLocationPick = async (type: FenceConfigType) => {
    const config = fenceConfigs[type];
    const lat = config.fence?.latitude ?? currentLocation?.latitude ?? 39.9042;
    const lng = config.fence?.longitude ?? currentLocation?.longitude ?? 116.4074;

    const mapApps = [
      {
        name: '高德地图',
        deeplink: `androidamap://viewMap?sourceApplication=SceneLens&lat=${lat}&lon=${lng}&dev=0`,
        package: 'com.autonavi.minimap',
        webUrl: `https://uri.amap.com/marker?position=${lng},${lat}&name=选择位置`,
      },
      {
        name: '百度地图',
        deeplink: `baidumap://map/marker?location=${lat},${lng}&title=选择位置&content=SceneLens&src=com.scenelens`,
        package: 'com.baidu.BaiduMap',
        webUrl: `https://api.map.baidu.com/marker?location=${lat},${lng}&title=选择位置&output=html`,
      },
      {
        name: '腾讯地图',
        deeplink: `qqmap://map/marker?marker=coord:${lat},${lng};title:选择位置`,
        package: 'com.tencent.map',
        webUrl: `https://apis.map.qq.com/uri/v1/marker?marker=coord:${lat},${lng};title:选择位置`,
      },
    ];

    Alert.alert(
      '选择地图应用',
      '请选择要打开的地图应用来选择位置。\n\n提示：选择位置后，请复制坐标并使用"手动输入"功能填入。',
      [
        ...mapApps.map(app => ({
          text: app.name,
          onPress: async () => {
            try {
              const canOpen = await Linking.canOpenURL(app.deeplink);
              if (canOpen) {
                await Linking.openURL(app.deeplink);
              } else {
                await Linking.openURL(app.webUrl);
              }
            } catch (error) {
              console.error(`打开${app.name}失败:`, error);
              Alert.alert('提示', `无法打开${app.name}，请确保已安装该应用`);
            }
          },
        })),
        { text: '取消', style: 'cancel' },
      ]
    );
  };

  /**
   * 保存围栏半径
   */
  const handleSliderComplete = useCallback(async (type: FenceConfigType, value: number) => {
    const config = fenceConfigs[type];
    if (!config.fence) return;

    try {
      const roundedValue = Math.round(value);
      const updated = await geoFenceManager.updateGeoFence(config.fence.id, {
        radius: roundedValue,
      });

      if (updated) {
        setFenceConfigs(prev => ({
          ...prev,
          [type]: { ...prev[type], fence: updated },
        }));
      }
    } catch (error) {
      console.error('更新半径失败:', error);
      Alert.alert('错误', '更新围栏半径失败');
    }
  }, [fenceConfigs]);


  /**
   * 渲染围栏卡片
   */
  const renderFenceCard = (type: FenceConfigType) => {
    const config = fenceConfigs[type];
    const isSelected = selectedTab === type;

    return (
      <Card
        key={type}
        // 👉 核心修复：彻底废弃 outlined 灰色边框，统一使用 elevated 白底阴影
        mode="elevated"
        elevation={1}
        style={[
          styles.fenceCard,
          { backgroundColor: theme.colors.surface },
          // 👉 选中时，不再用生硬的粗线，而是使用主题色的柔和边框
          isSelected && { borderColor: theme.colors.primary, borderWidth: 2 }
        ]}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.fenceHeader}>
            <View style={styles.fenceHeaderLeft}>
              <Text style={styles.fenceIcon}>{config.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium" style={styles.fenceName}>
                  {config.displayName}
                </Text>
                <Text variant="bodySmall" style={styles.fenceDescription}>
                  {config.description}
                </Text>
              </View>
            </View>
            <RadioButton
              value={type}
              status={isSelected ? 'checked' : 'unchecked'}
              onPress={() => setSelectedTab(type)}
              color={theme.colors.primary}
            />
          </View>

          {config.fence ? (
            <View style={styles.fenceDetails}>
              <Divider style={styles.divider} />
              <View style={styles.fenceDetailRow}>
                 <Text variant="bodyMedium" style={{ fontWeight: '700' }}>已设置</Text>
                 <Text variant="bodySmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                   {config.fence.latitude.toFixed(5)}, {config.fence.longitude.toFixed(5)}
                 </Text>
              </View>

              {/* 半径滑块 */}
              <Surface style={[styles.radiusContainer, { backgroundColor: theme.colors.surfaceVariant, opacity: 0.8 }]} elevation={0}>
                <View style={styles.radiusHeader}>
                  <Text variant="bodyMedium" style={{ fontWeight: '600' }}>围栏触发半径</Text>
                  <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: '800' }}>
                    {sliderValues[type]} m
                  </Text>
                </View>
                <Slider
                  value={sliderValues[type]}
                  onValueChange={(value) => handleSliderChange(type, value)}
                  onSlidingComplete={(value) => handleSliderComplete(type, value)}
                  minimumValue={50}
                  maximumValue={500}
                  step={10}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.outlineVariant}
                  thumbTintColor={theme.colors.primary}
                  style={styles.slider}
                />
              </Surface>

              <View style={styles.fenceActions}>
                <Button mode="contained-tonal" onPress={() => setCurrentLocationAsFence(type)} disabled={!currentLocation || isLoading} icon="crosshairs-gps" style={styles.actionButton} labelStyle={{ fontSize: 13 }}>当前位置</Button>
                <Button mode="contained-tonal" onPress={() => openManualInput(type)} disabled={isLoading} icon="pencil" style={styles.actionButton} labelStyle={{ fontSize: 13 }}>手动输入</Button>
              </View>
              <View style={styles.fenceActions}>
                <Button mode="text" onPress={() => openMapForLocationPick(type)} disabled={isLoading} icon="map-search" style={styles.actionButton}>地图选择</Button>
                <Button mode="text" onPress={() => deleteFence(type)} disabled={isLoading} icon="delete" textColor={theme.colors.error} style={styles.actionButton}>删除</Button>
              </View>
            </View>
          ) : (
            <View style={styles.noFenceContainer}>
              <Text variant="bodyMedium" style={styles.noFenceText}>尚未设置{config.displayName}</Text>
              <View style={styles.setupButtonsRow}>
                <Button mode="contained" buttonColor={theme.colors.primary} onPress={() => setCurrentLocationAsFence(type)} disabled={!currentLocation || isLoading} icon="crosshairs-gps" style={styles.setupButton}>设为当前</Button>
                <Button mode="contained-tonal" onPress={() => openManualInput(type)} disabled={isLoading} icon="pencil" style={styles.setupButton}>手动输入</Button>
              </View>
              <Button mode="text" onPress={() => openMapForLocationPick(type)} disabled={isLoading} icon="map-search" style={{ marginTop: 4 }}>从地图应用选择位置</Button>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  if (isLoading && !fenceConfigs.HOME.fence && !fenceConfigs.OFFICE.fence) {
    return (
      <View style={styles.loadingContainer}>
        <Text variant="bodyLarge" style={{ color: theme.colors.primary, fontWeight: '600' }}>正在加载配置...</Text>
        <ProgressBar indeterminate style={styles.progressBar} color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.contentContainer}>
      
      {/* 顶部标题区域：采用超淡色块包裹 */}
      <Surface style={[styles.header, { backgroundColor: ultraLightBg }]} elevation={0}>
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>位置配置</Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>设置常用的地理位置，用于智能场景识别</Text>
      </Surface>

      {/* 当前位置卡片：大圆角 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.cardTitle}>📍 当前位置</Text>
            <Button mode="text" onPress={refreshLocation} disabled={isRefreshing} icon="refresh" compact>刷新</Button>
          </View>

          {currentLocation ? (
            <Surface style={[styles.locationInfo, { backgroundColor: ultraLightBg }]} elevation={0}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                 <View>
                    <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>{currentLocation.latitude.toFixed(5)}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.primary, opacity: 0.7 }}>纬度</Text>
                 </View>
                 <View>
                    <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>{currentLocation.longitude.toFixed(5)}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.primary, opacity: 0.7 }}>经度</Text>
                 </View>
                 <View>
                    <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>±{currentLocation.accuracy.toFixed(0)}m</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.primary, opacity: 0.7 }}>精度</Text>
                 </View>
              </View>
            </Surface>
          ) : (
            <Text variant="bodyMedium" style={styles.noLocationText}>无法获取当前位置，请检查位置权限</Text>
          )}
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>地理围栏配置</Text>
      {(Object.keys(fenceConfigs) as FenceConfigType[]).map(renderFenceCard)}

      {/* 说明卡片：抛弃直边框，融入大圆角 */}
      <Card mode="elevated" elevation={0} style={[styles.card, { backgroundColor: '#F0FDF4' }]}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium" style={styles.infoTitle}>💡 使用说明</Text>
          <View style={{ gap: 6, marginTop: 8 }}>
            <Text style={styles.infoText}>• 地理围栏用于识别您所在的地点，自动触发场景</Text>
            <Text style={styles.infoText}>• 围栏半径决定了触发范围，建议根据实际情况调整</Text>
            <Text style={styles.infoText}>• 支持从地图应用选择位置或手动输入经纬度</Text>
            <Text style={styles.infoText}>• 位置信息仅在本地使用，不会上传到服务器</Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.bottomSpacer} />

      {/* 手动输入弹窗 */}
      <Portal>
        <Modal
          visible={showManualInput}
          onDismiss={() => setShowManualInput(false)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>手动输入</Text>
              <IconButton icon="close" size={24} onPress={() => setShowManualInput(false)} />
            </View>
            
            <Text variant="bodyMedium" style={styles.modalSubtitle}>设置 {fenceConfigs[manualInputType]?.displayName} 的坐标</Text>

            <TextInput label="纬度 (Latitude)" value={manualLatitude} onChangeText={setManualLatitude} keyboardType="numeric" style={styles.input} mode="outlined" />
            <TextInput label="经度 (Longitude)" value={manualLongitude} onChangeText={setManualLongitude} keyboardType="numeric" style={styles.input} mode="outlined" />

            <View style={styles.modalActions}>
              <Button mode="text" onPress={() => openMapForLocationPick(manualInputType)} icon="map-search" style={styles.modalButton}>从地图获取</Button>
              <Button mode="contained" onPress={saveManualCoordinates} disabled={!manualLatitude || !manualLongitude || isLoading} loading={isLoading} style={styles.modalButton}>保存</Button>
            </View>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progressBar: { marginTop: 16, width: 200, borderRadius: 4 },
  
  // 👉 核心修复：整体全部使用 borderRadius.xl
  header: { padding: 20, marginBottom: 16, borderRadius: borderRadius.xl },
  title: { fontWeight: '800' },
  subtitle: { marginTop: 4, fontWeight: '600' },
  
  card: { marginBottom: 16, borderRadius: borderRadius.xl },
  cardContent: { padding: 20 }, // 内部放宽边距
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontWeight: '800' },
  
  locationInfo: { padding: 16, borderRadius: 16 },
  noLocationText: { textAlign: 'center', paddingVertical: 16, opacity: 0.6 },
  
  sectionTitle: { fontWeight: '800', marginBottom: 16, marginLeft: 4 },
  
  fenceCard: { marginBottom: 16, borderRadius: borderRadius.xl, borderWidth: 0 },
  fenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  fenceHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 },
  fenceIcon: { fontSize: 32, marginRight: 16 },
  fenceName: { fontWeight: '800', fontSize: 18 },
  fenceDescription: { marginTop: 4, opacity: 0.6, lineHeight: 18 },
  
  fenceDetails: { marginTop: 16 },
  fenceDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  divider: { marginVertical: 12, opacity: 0.5 },
  
  radiusContainer: { padding: 16, borderRadius: 16, marginTop: 4 },
  radiusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  slider: { width: '100%', height: 40 },
  
  fenceActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionButton: { flex: 1, borderRadius: 12 },
  
  noFenceContainer: { alignItems: 'center', paddingVertical: 20 },
  noFenceText: { marginBottom: 16, opacity: 0.6, fontWeight: '600' },
  setupButtonsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  setupButton: { flex: 1, borderRadius: 12 },
  
  infoTitle: { fontWeight: '800', color: '#166534', marginBottom: 4 },
  infoText: { color: '#15803D', lineHeight: 24, fontWeight: '600' },
  bottomSpacer: { height: 40 },
  
  modalContainer: { margin: 20, borderRadius: borderRadius.xl, overflow: 'hidden' },
  modalContent: { padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontWeight: '800' },
  modalSubtitle: { opacity: 0.6, marginBottom: 20 },
  input: { marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  modalButton: { flex: 1, borderRadius: 12 },
});

export default LocationConfigScreen;