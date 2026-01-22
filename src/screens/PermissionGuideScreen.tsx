import React, { useEffect } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Card,
  Text,
  Button,
  List,
  Divider,
  Chip,
  ProgressBar,
  Banner,
  Checkbox,
  Switch,
  useTheme,
  MD3Colors,
  IconButton,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePermissionStore } from '../stores';
import { sceneBridge } from '../core/SceneBridge';
import type { PermissionType } from '../stores';

/**
 * 权限图标映射
 */
const PERMISSION_ICONS: Record<PermissionType, string> = {
  LOCATION: 'map-marker-radius',
  ACTIVITY_RECOGNITION: 'run-fast',
  USAGE_STATS: 'chart-bar',
  CAMERA: 'camera',
  MICROPHONE: 'microphone',
  NOTIFICATIONS: 'bell-ring',
  DO_NOT_DISTURB: 'bell-cancel',
};

/**
 * 权限颜色映射（Material Design 3）
 */
const PERMISSION_COLORS: Record<PermissionType, string> = {
  LOCATION: '#1976D2',
  ACTIVITY_RECOGNITION: '#E65100',
  USAGE_STATS: '#424242',
  CAMERA: '#7B1FA2',
  MICROPHONE: '#C2185B',
  NOTIFICATIONS: '#F57C00',
  DO_NOT_DISTURB: '#455A64',
};

/**
 * 权限中文名称映射
 */
const PERMISSION_NAMES: Record<PermissionType, string> = {
  LOCATION: '位置信息',
  ACTIVITY_RECOGNITION: '身体活动',
  USAGE_STATS: '使用情况访问',
  CAMERA: '相机',
  MICROPHONE: '麦克风',
  NOTIFICATIONS: '通知',
  DO_NOT_DISTURB: '勿扰模式',
};

/**
 * 新版权限引导屏幕
 * 使用 React Native Paper 组件和 Material Design 3 规范
 */
export const PermissionGuideScreen: React.FC = () => {
  const theme = useTheme();

  const {
    permissions,
    isCheckingPermissions,
    setPermissionStatus,
    setPermissionLastRequested,
    setIsCheckingPermissions,
    getRequiredPermissions,
    getAllGrantedPermissions,
  } = usePermissionStore();

  useEffect(() => {
    checkAllPermissions();
  }, []);

  /**
   * 检查所有权限状态
   */
  const checkAllPermissions = async () => {
    setIsCheckingPermissions(true);
    try {
      for (const [type] of permissions) {
        await checkPermission(type);
      }
    } catch (error) {
      console.error('检查权限失败:', error);
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  /**
   * 检查单个权限状态
   */
  const checkPermission = async (type: PermissionType) => {
    try {
      let hasPermission = false;

      switch (type) {
        case 'LOCATION':
          hasPermission = await sceneBridge.hasLocationPermission();
          break;
        case 'ACTIVITY_RECOGNITION':
          hasPermission = await sceneBridge.hasActivityRecognitionPermission();
          break;
        case 'USAGE_STATS':
          hasPermission = await sceneBridge.hasUsageStatsPermission();
          break;
        case 'NOTIFICATIONS':
          hasPermission = true;
          break;
        default:
          hasPermission = false;
      }

      setPermissionStatus(type, hasPermission ? 'granted' : 'denied');
    } catch (error) {
      console.error(`检查 ${type} 权限失败:`, error);
      setPermissionStatus(type, 'unknown');
    }
  };

  /**
   * 请求权限
   */
  const requestPermission = async (type: PermissionType) => {
    setPermissionLastRequested(type, Date.now());

    try {
      let granted = false;

      switch (type) {
        case 'LOCATION':
          granted = await sceneBridge.requestLocationPermission();
          break;
        case 'ACTIVITY_RECOGNITION':
          granted = await sceneBridge.requestActivityRecognitionPermission();
          break;
        case 'USAGE_STATS':
          granted = await sceneBridge.requestUsageStatsPermission();
          Alert.alert(
            '使用情况访问权限',
            '请在设置中找到 SceneLens 并授予"使用情况访问"权限',
            [{ text: '知道了' }]
          );
          break;
        default:
          Alert.alert('提示', '该权限暂不支持请求');
          return;
      }

      setPermissionStatus(type, granted ? 'granted' : 'denied');

      if (granted) {
        Alert.alert('成功', '权限已授予');
      } else {
        Alert.alert('提示', '权限被拒绝，部分功能可能无法使用');
      }
    } catch (error) {
      console.error(`请求 ${type} 权限失败:`, error);
      Alert.alert('错误', '请求权限失败');
    }
  };

  /**
   * 获取状态对应的 Chip 样式
   */
  const getStatusChip = (status: string) => {
    switch (status) {
      case 'granted':
        return (
          <Chip
            icon="check-circle"
            mode="flat"
            compact
            style={styles.chip}
            textStyle={styles.chipText}
          >
            已授予
          </Chip>
        );
      case 'denied':
        return (
          <Chip
            icon="close-circle"
            mode="flat"
            compact
            style={[styles.chip, styles.chipDenied]}
            textStyle={styles.chipText}
          >
            已拒绝
          </Chip>
        );
      case 'not_requested':
        return (
          <Chip
            icon="alert-circle"
            mode="outlined"
            compact
            style={[styles.chip, styles.chipWarning]}
            textStyle={styles.chipText}
          >
            未请求
          </Chip>
        );
      default:
        return (
          <Chip
            icon="help-circle"
            mode="outlined"
            compact
            style={styles.chip}
            textStyle={styles.chipText}
          >
            未知
          </Chip>
        );
    }
  };

  /**
   * 获取是否所有必需权限已授予
   */
  const requiredPermissions = getRequiredPermissions();
  const grantedPermissions = getAllGrantedPermissions();
  const allRequiredGranted =
    requiredPermissions.length > 0 &&
    requiredPermissions.every((p) => p.status === 'granted');

  const progressValue =
    requiredPermissions.length > 0
      ? grantedPermissions.length / requiredPermissions.length
      : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 标题区域 */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          权限管理
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          SceneLens 需要以下权限来提供场景感知服务
        </Text>
      </View>

      {/* 进度卡片 */}
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <View style={styles.progressHeader}>
            <Text variant="titleMedium" style={styles.progressTitle}>
              权限授予进度
            </Text>
            <Chip
              mode="flat"
              compact
              icon="check"
              style={[styles.progressChip, { backgroundColor: theme.colors.primaryContainer }]}
              textStyle={{ color: theme.colors.onPrimaryContainer }}
            >
              {grantedPermissions.length}/{requiredPermissions.length}
            </Chip>
          </View>

          <ProgressBar
            progress={progressValue}
            color={theme.colors.primary}
            style={styles.progressBar}
          />

          {allRequiredGranted && (
            <View style={styles.successContainer}>
              <Icon
                name="check-circle"
                size={20}
                color={MD3Colors.primary50}
              />
              <Text
                variant="bodyMedium"
                style={[styles.successText, { color: MD3Colors.primary50 }]}
              >
                所有必需权限已授予
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 隐私承诺 Banner（浅绿色背景） */}
      <Banner
        visible
        icon={({ size }) => (
          <Icon name="shield-lock" size={size} color={MD3Colors.primary50} />
        )}
        style={[styles.privacyBanner, { backgroundColor: '#E8F5E9' }]}
      >
        <Text variant="bodyMedium" style={styles.privacyTitle}>
          隐私保护承诺
        </Text>
        <View style={styles.privacyList}>
          <View style={styles.privacyItem}>
            <Icon name="lock" size={16} color="#2E7D32" />
            <Text variant="bodySmall" style={styles.privacyText}>
              所有数据仅在本地处理，不上传到云端
            </Text>
          </View>
          <View style={styles.privacyItem}>
            <Icon name="camera-off" size={16} color="#2E7D32" />
            <Text variant="bodySmall" style={styles.privacyText}>
              相机和麦克风仅在您主动触发时使用
            </Text>
          </View>
          <View style={styles.privacyItem}>
            <Icon name="map-marker-radius" size={16} color="#2E7D32" />
            <Text variant="bodySmall" style={styles.privacyText}>
              位置信息使用粗定位（精度约100米）
            </Text>
          </View>
          <View style={styles.privacyItem}>
            <Icon name="cancel" size={16} color="#2E7D32" />
            <Text variant="bodySmall" style={styles.privacyText}>
              您可以随时撤销权限
            </Text>
          </View>
        </View>
      </Banner>

      {/* 权限列表 */}
      <Card mode="elevated" style={styles.permissionsCard}>
        <Card.Content style={styles.permissionsCardContent}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            权限列表
          </Text>

          {Array.from(permissions.values()).map((permission, index) => (
            <View key={permission.type}>
              <List.Item
                title={PERMISSION_NAMES[permission.type]}
                description={permission.description}
                left={(props) => (
                  <View style={[styles.iconContainer, { backgroundColor: PERMISSION_COLORS[permission.type] + '20' }]}>
                    <Icon
                      name={PERMISSION_ICONS[permission.type]}
                      size={24}
                      {...props}
                      color={PERMISSION_COLORS[permission.type]}
                    />
                  </View>
                )}
                right={() => (
                  <View style={styles.rightContainer}>
                    {permission.isRequired && (
                      <Chip
                        mode="flat"
                        compact
                        style={[styles.requiredChip, { backgroundColor: theme.colors.errorContainer }]}
                        textStyle={{ color: theme.colors.onErrorContainer, fontSize: 10 }}
                      >
                        必需
                      </Chip>
                    )}
                    {getStatusChip(permission.status)}
                  </View>
                )}
                style={styles.listItem}
              />

              {permission.status !== 'granted' && (
                <Button
                  mode="contained"
                  onPress={() => requestPermission(permission.type)}
                  style={styles.requestButton}
                  contentStyle={styles.requestButtonContent}
                  icon="key-plus"
                >
                  请求权限
                </Button>
              )}

              {index < Array.from(permissions.values()).length - 1 && (
                <Divider style={styles.divider} />
              )}
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* 刷新按钮 */}
      <Button
        mode="contained"
        onPress={checkAllPermissions}
        disabled={isCheckingPermissions}
        style={styles.refreshButton}
        contentStyle={styles.refreshButtonContent}
        icon="refresh"
        loading={isCheckingPermissions}
      >
        {isCheckingPermissions ? '检查中...' : '刷新权限状态'}
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    lineHeight: 20,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontWeight: '600',
  },
  progressChip: {
    height: 28,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  successText: {
    fontWeight: '600',
  },
  privacyBanner: {
    marginBottom: 16,
    borderRadius: 12,
  },
  privacyTitle: {
    fontWeight: '600',
    marginBottom: 12,
    color: '#1B5E20',
  },
  privacyList: {
    gap: 8,
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyText: {
    flex: 1,
    color: '#2E7D32',
    lineHeight: 18,
  },
  permissionsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  permissionsCardContent: {
    padding: 0,
  },
  sectionTitle: {
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  requiredChip: {
    height: 20,
    borderRadius: 4,
  },
  chip: {
    height: 28,
  },
  chipDenied: {
    backgroundColor: '#FFEBEE',
  },
  chipWarning: {
    backgroundColor: '#FFF3E0',
  },
  chipText: {
    fontSize: 12,
  },
  requestButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  requestButtonContent: {
    paddingVertical: 4,
  },
  divider: {
    marginLeft: 68,
    marginRight: 16,
  },
  refreshButton: {
    marginTop: 8,
  },
  refreshButtonContent: {
    paddingVertical: 8,
  },
});
