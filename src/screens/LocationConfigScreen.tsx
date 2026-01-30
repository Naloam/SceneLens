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
      // 初始化地理围栏管理器
      await geoFenceManager.initialize();

      // 加载现有围栏
      const allFences = geoFenceManager.getAllGeoFences();

      // 更新围栏配置
      const updatedConfigs = { ...fenceConfigs };
      for (const fence of allFences) {
        const type = fence.type as FenceConfigType;
        if (type in updatedConfigs) {
          updatedConfigs[type].fence = fence;
        }
      }
      setFenceConfigs(updatedConfigs);

      // 获取当前位置
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
      Alert.alert('成功', '位置已更新');
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
        // 更新现有围栏
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
        // 创建新围栏
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

      // 刷新静默引擎的地理配置
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
    if (!config.fence) {
      return;
    }

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

              // 刷新静默引擎的地理配置
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
   * 更新围栏半径（滑块滑动时更新本地状态）
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
    
    // 如果已有围栏，预填充坐标
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
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      return { valid: false, error: '请输入有效的数字' };
    }
    
    if (latNum < -90 || latNum > 90) {
      return { valid: false, error: '纬度范围: -90 到 90' };
    }
    
    if (lngNum < -180 || lngNum > 180) {
      return { valid: false, error: '经度范围: -180 到 180' };
    }
    
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
        // 更新现有围栏
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
        // 创建新围栏
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

      // 刷新静默引擎的地理配置
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

    // 地图应用的 deeplink 配置
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
      {
        name: 'Google Maps',
        deeplink: `geo:${lat},${lng}?q=${lat},${lng}`,
        package: 'com.google.android.apps.maps',
        webUrl: `https://www.google.com/maps?q=${lat},${lng}`,
      },
    ];

    // 显示地图应用选择对话框
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
                // 尝试打开网页版
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
   * 从剪贴板粘贴坐标
   */
  const pasteFromClipboard = async () => {
    try {
      // React Native 需要使用 @react-native-clipboard/clipboard 包
      // 这里提供一个简化的提示
      Alert.alert(
        '粘贴坐标',
        '请在输入框中长按粘贴坐标。\n\n支持的格式：\n• 39.9042, 116.4074\n• 39.9042,116.4074\n• 纬度：39.9042 经度：116.4074',
        [{ text: '知道了' }]
      );
    } catch (error) {
      console.error('粘贴失败:', error);
    }
  };

  /**
   * 解析粘贴的坐标字符串
   */
  const parseCoordinateString = (text: string): { lat: string; lng: string } | null => {
    // 尝试匹配常见的坐标格式
    const patterns = [
      /(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/,  // 39.9042, 116.4074
      /纬度[：:]\s*(-?\d+\.?\d*)\s*经度[：:]\s*(-?\d+\.?\d*)/,
      /lat[：:]\s*(-?\d+\.?\d*)\s*lng[：:]\s*(-?\d+\.?\d*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return { lat: match[1], lng: match[2] };
      }
    }

    return null;
  };

  /**
   * 保存围栏半径（滑块停止时保存到存储）
   */
  const handleSliderComplete = useCallback(async (type: FenceConfigType, value: number) => {
    const config = fenceConfigs[type];
    if (!config.fence) {
      return;
    }

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
        console.log(`[LocationConfigScreen] 围栏半径已更新: ${type} -> ${roundedValue}m`);
      }
    } catch (error) {
      console.error('更新半径失败:', error);
      Alert.alert('错误', '更新围栏半径失败');
    }
  }, [fenceConfigs]);

  /**
   * 更新围栏半径（旧方法，保留兼容性）
   */
  const updateFenceRadius = async (type: FenceConfigType, radius: number) => {
    await handleSliderComplete(type, radius);
  };

  /**
   * 渲染围栏卡片
   */
  const renderFenceCard = (type: FenceConfigType) => {
    const config = fenceConfigs[type];
    const isSelected = selectedTab === type;

    return (
      <Card
        key={type}
        mode={isSelected ? 'elevated' : 'outlined'}
        style={[
          styles.fenceCard,
          isSelected && styles.selectedFenceCard,
        ]}
      >
        <Card.Content>
          <View style={styles.fenceHeader}>
            <View style={styles.fenceHeaderLeft}>
              <Text style={styles.fenceIcon}>{config.icon}</Text>
              <View>
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
            />
          </View>

          {config.fence ? (
            <View style={styles.fenceDetails}>
              <Divider style={styles.divider} />
              <Text variant="bodyMedium" style={styles.fenceDetailTitle}>
                已设置围栏
              </Text>
              <Text variant="bodySmall">名称: {config.fence.name}</Text>
              <Text variant="bodySmall">
                位置: {config.fence.latitude.toFixed(6)}, {config.fence.longitude.toFixed(6)}
              </Text>

              {/* 半径滑块 */}
              <View style={styles.radiusContainer}>
                <View style={styles.radiusHeader}>
                  <Text variant="bodyMedium">围栏半径</Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                    {sliderValues[type]} 米
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
                  maximumTrackTintColor={theme.colors.surfaceVariant}
                  thumbTintColor={theme.colors.primary}
                  style={styles.slider}
                />
                <View style={styles.sliderLabels}>
                  <Text variant="bodySmall" style={styles.sliderLabel}>50m</Text>
                  <Text variant="bodySmall" style={styles.sliderLabel}>500m</Text>
                </View>
              </View>

              <View style={styles.fenceActions}>
                <Button
                  mode="outlined"
                  onPress={() => setCurrentLocationAsFence(type)}
                  disabled={!currentLocation || isLoading}
                  icon="crosshairs-gps"
                  style={styles.actionButton}
                  compact
                >
                  当前位置
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => openManualInput(type)}
                  disabled={isLoading}
                  icon="pencil"
                  style={styles.actionButton}
                  compact
                >
                  手动输入
                </Button>
              </View>
              <View style={styles.fenceActions}>
                <Button
                  mode="outlined"
                  onPress={() => openMapForLocationPick(type)}
                  disabled={isLoading}
                  icon="map-search"
                  style={styles.actionButton}
                  compact
                >
                  从地图选择
                </Button>
                <Button
                  mode="text"
                  onPress={() => deleteFence(type)}
                  disabled={isLoading}
                  icon="delete"
                  textColor={theme.colors.error}
                  compact
                >
                  删除
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.noFenceContainer}>
              <Text variant="bodyMedium" style={styles.noFenceText}>
                尚未设置{config.displayName}
              </Text>
              <View style={styles.setupButtonsRow}>
                <Button
                  mode="contained"
                  onPress={() => setCurrentLocationAsFence(type)}
                  disabled={!currentLocation || isLoading}
                  icon="crosshairs-gps"
                  style={styles.setupButton}
                  compact
                >
                  当前位置
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => openManualInput(type)}
                  disabled={isLoading}
                  icon="pencil"
                  style={styles.setupButton}
                  compact
                >
                  手动输入
                </Button>
              </View>
              <Button
                mode="text"
                onPress={() => openMapForLocationPick(type)}
                disabled={isLoading}
                icon="map-search"
                style={{ marginTop: 8 }}
              >
                从地图应用选择位置
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  if (isLoading && !fenceConfigs.HOME.fence && !fenceConfigs.OFFICE.fence) {
    return (
      <Surface style={styles.loadingContainer} elevation={0}>
        <View style={styles.loadingContent}>
          <Text variant="bodyLarge" style={{ color: theme.colors.primary }}>
            正在加载位置配置...
          </Text>
          <ProgressBar indeterminate style={styles.progressBar} />
        </View>
      </Surface>
    );
  }

  const currentConfig = fenceConfigs[selectedTab];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 标题区域 */}
      <Surface style={styles.header} elevation={1}>
        <Text variant="headlineMedium" style={styles.title}>
          位置配置
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          设置常用的地理位置，用于智能场景识别
        </Text>
      </Surface>

      {/* 当前位置信息卡片 */}
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              📍 当前位置
            </Text>
            <Button
              mode="text"
              onPress={refreshLocation}
              disabled={isRefreshing}
              icon="refresh"
              compact
            >
              刷新
            </Button>
          </View>

          {currentLocation ? (
            <Surface style={styles.locationInfo} elevation={0}>
              <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                纬度: {currentLocation.latitude.toFixed(6)}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                经度: {currentLocation.longitude.toFixed(6)}
              </Text>
              <Text variant="bodySmall" style={styles.locationAccuracy}>
                精度: ±{currentLocation.accuracy.toFixed(0)}米
              </Text>
            </Surface>
          ) : (
            <Text variant="bodyMedium" style={styles.noLocationText}>
              无法获取当前位置，请检查位置权限
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* 围栏配置卡片列表 */}
      <Text variant="titleLarge" style={styles.sectionTitle}>
        地理围栏配置
      </Text>
      {(Object.keys(fenceConfigs) as FenceConfigType[]).map(renderFenceCard)}

      {/* 说明卡片 */}
      <Card mode="outlined" style={[styles.card, styles.infoCard]}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.infoTitle}>
            💡 使用说明
          </Text>
          <Divider style={styles.divider} />
          <Text variant="bodyMedium" style={styles.infoText}>
            • 地理围栏用于识别您所在的地点，自动触发相应的场景
          </Text>
          <Text variant="bodyMedium" style={styles.infoText}>
            • 围栏半径决定了触发范围，建议根据实际情况调整
          </Text>
          <Text variant="bodyMedium" style={styles.infoText}>
            • 支持从地图应用选择位置或手动输入经纬度
          </Text>
          <Text variant="bodyMedium" style={styles.infoText}>
            • 位置信息仅在本地使用，不会上传到服务器
          </Text>
        </Card.Content>
      </Card>

      {/* 底部间距 */}
      <View style={styles.bottomSpacer} />

      {/* 手动输入坐标对话框 */}
      <Portal>
        <Modal
          visible={showManualInput}
          onDismiss={() => setShowManualInput(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={styles.modalTitle}>
                手动输入坐标
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setShowManualInput(false)}
              />
            </View>
            
            <Text variant="bodyMedium" style={styles.modalSubtitle}>
              设置 {fenceConfigs[manualInputType]?.displayName} 的位置坐标
            </Text>

            <TextInput
              label="纬度 (Latitude)"
              value={manualLatitude}
              onChangeText={setManualLatitude}
              keyboardType="numeric"
              placeholder="例如：39.9042"
              style={styles.input}
              mode="outlined"
              right={<TextInput.Affix text="°" />}
            />

            <TextInput
              label="经度 (Longitude)"
              value={manualLongitude}
              onChangeText={setManualLongitude}
              keyboardType="numeric"
              placeholder="例如：116.4074"
              style={styles.input}
              mode="outlined"
              right={<TextInput.Affix text="°" />}
            />

            <Text variant="bodySmall" style={styles.coordinateHint}>
              💡 提示：可以从地图应用中获取精确坐标，格式为"纬度, 经度"
            </Text>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => openMapForLocationPick(manualInputType)}
                icon="map-search"
                style={styles.modalButton}
              >
                从地图获取
              </Button>
              <Button
                mode="contained"
                onPress={saveManualCoordinates}
                disabled={!manualLatitude || !manualLongitude || isLoading}
                loading={isLoading}
                icon="check"
                style={styles.modalButton}
              >
                保存
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>
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
  progressBar: {
    marginTop: 16,
    width: 200,
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
  locationInfo: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
  },
  locationAccuracy: {
    marginTop: 4,
    opacity: 0.7,
  },
  noLocationText: {
    textAlign: 'center',
    paddingVertical: 16,
    opacity: 0.6,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  fenceCard: {
    marginBottom: 12,
  },
  selectedFenceCard: {
    borderColor: '#6750A4',
    borderWidth: 2,
  },
  fenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fenceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fenceIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  fenceName: {
    fontWeight: '600',
  },
  fenceDescription: {
    marginTop: 2,
    opacity: 0.7,
  },
  fenceDetails: {
    marginTop: 8,
  },
  fenceDetailTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 8,
  },
  radiusContainer: {
    marginTop: 12,
  },
  radiusHeader: {
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
  fenceActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
  noFenceContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noFenceText: {
    marginBottom: 12,
    opacity: 0.6,
  },
  setButton: {
    minWidth: 150,
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
    lineHeight: 22,
    marginBottom: 4,
  },
  bottomSpacer: {
    height: 32,
  },
  // 新增样式
  setupButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  setupButton: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontWeight: '700',
  },
  modalSubtitle: {
    opacity: 0.7,
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  coordinateHint: {
    opacity: 0.6,
    marginBottom: 20,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});

export default LocationConfigScreen;
