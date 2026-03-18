import React, { useEffect } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Banner,
  Button,
  Card,
  Chip,
  Divider,
  List,
  MD3Colors,
  ProgressBar,
  Text,
  useTheme,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePermissionStore } from '../stores';
import type { PermissionStatus, PermissionType } from '../stores';
import {
  permissionManager,
  PermissionStatus as RuntimePermissionStatus,
  PermissionType as RuntimePermissionType,
} from '../utils/PermissionManager';

const GUIDE_PERMISSION_MAP: Record<PermissionType, RuntimePermissionType> = {
  LOCATION: RuntimePermissionType.LOCATION_FINE,
  ACTIVITY_RECOGNITION: RuntimePermissionType.ACTIVITY_RECOGNITION,
  USAGE_STATS: RuntimePermissionType.USAGE_STATS,
  CAMERA: RuntimePermissionType.CAMERA,
  MICROPHONE: RuntimePermissionType.MICROPHONE,
  NOTIFICATIONS: RuntimePermissionType.NOTIFICATIONS,
  DO_NOT_DISTURB: RuntimePermissionType.NOTIFICATION_POLICY,
};

function toGuidePermissionStatus(
  status: RuntimePermissionStatus
): 'granted' | 'denied' | 'not_requested' {
  switch (status) {
    case RuntimePermissionStatus.GRANTED:
      return 'granted';
    case RuntimePermissionStatus.UNDETERMINED:
      return 'not_requested';
    default:
      return 'denied';
  }
}

const PERMISSION_ICONS: Record<PermissionType, string> = {
  LOCATION: 'map-marker-radius',
  ACTIVITY_RECOGNITION: 'run-fast',
  USAGE_STATS: 'chart-bar',
  CAMERA: 'camera',
  MICROPHONE: 'microphone',
  NOTIFICATIONS: 'bell-ring',
  DO_NOT_DISTURB: 'bell-cancel',
};

const PERMISSION_COLORS: Record<PermissionType, string> = {
  LOCATION: '#1976D2',
  ACTIVITY_RECOGNITION: '#E65100',
  USAGE_STATS: '#424242',
  CAMERA: '#7B1FA2',
  MICROPHONE: '#C2185B',
  NOTIFICATIONS: '#F57C00',
  DO_NOT_DISTURB: '#455A64',
};

const PERMISSION_NAMES: Record<PermissionType, string> = {
  LOCATION: '位置信息',
  ACTIVITY_RECOGNITION: '身体活动',
  USAGE_STATS: '使用情况访问',
  CAMERA: '相机',
  MICROPHONE: '麦克风',
  NOTIFICATIONS: '通知',
  DO_NOT_DISTURB: '勿扰模式',
};

export const PermissionGuideScreen: React.FC = () => {
  const theme = useTheme();

  const {
    permissions,
    isCheckingPermissions,
    setPermissionStatus,
    setPermissionLastRequested,
    setIsCheckingPermissions,
    getRequiredPermissions,
  } = usePermissionStore();

  const permissionList = Array.from(permissions.values());
  const requiredPermissions = getRequiredPermissions();
  const grantedRequiredPermissions = requiredPermissions.filter(
    permission => permission.status === 'granted'
  );
  const allRequiredGranted =
    requiredPermissions.length > 0 &&
    requiredPermissions.every(permission => permission.status === 'granted');
  const progressValue =
    requiredPermissions.length > 0
      ? grantedRequiredPermissions.length / requiredPermissions.length
      : 0;

  const checkPermission = async (type: PermissionType) => {
    try {
      const result = await permissionManager.checkPermission(GUIDE_PERMISSION_MAP[type]);
      setPermissionStatus(type, toGuidePermissionStatus(result.status));
    } catch (error) {
      console.error(`Failed to check ${type} permission:`, error);
      setPermissionStatus(type, 'unknown');
    }
  };

  const checkAllPermissions = async () => {
    setIsCheckingPermissions(true);
    try {
      for (const type of permissions.keys()) {
        await checkPermission(type);
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  const requestPermission = async (type: PermissionType) => {
    setPermissionLastRequested(type, Date.now());

    try {
      const runtimePermission = GUIDE_PERMISSION_MAP[type];
      const requestStatus = await permissionManager.requestPermission(runtimePermission);
      const result = await permissionManager.checkPermission(runtimePermission);
      const isGranted = result.status === RuntimePermissionStatus.GRANTED;

      setPermissionStatus(type, toGuidePermissionStatus(result.status));

      if (isGranted) {
        Alert.alert('成功', '权限已授予，或已打开系统设置。');
        return;
      }

      if (
        requestStatus === RuntimePermissionStatus.PERMANENTLY_DENIED ||
        result.status === RuntimePermissionStatus.PERMANENTLY_DENIED
      ) {
        await permissionManager.openSpecificSettings(runtimePermission);
        Alert.alert('提示', '请在系统设置中完成权限配置。');
        return;
      }

      if (requestStatus === RuntimePermissionStatus.REQUIRES_SETTINGS) {
        Alert.alert('提示', '请在系统设置中完成权限配置。');
        return;
      }

      Alert.alert('提示', '权限被拒绝，部分功能可能无法使用。');
    } catch (error) {
      console.error(`Request ${type} permission failed:`, error);
      Alert.alert('错误', '请求权限失败。');
    }
  };

  useEffect(() => {
    void checkAllPermissions();
  }, []);

  const getStatusChip = (status: PermissionStatus) => {
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
            已授权
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
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
              style={[
                styles.progressChip,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
              textStyle={{ color: theme.colors.onPrimaryContainer }}
            >
              {grantedRequiredPermissions.length}/{requiredPermissions.length}
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
              所有数据仅在本地处理，不会上传到云端
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
              位置信息使用粗定位，减少不必要的精度暴露
            </Text>
          </View>
          <View style={styles.privacyItem}>
            <Icon name="cancel" size={16} color="#2E7D32" />
            <Text variant="bodySmall" style={styles.privacyText}>
              您可以随时在系统设置中撤回权限
            </Text>
          </View>
        </View>
      </Banner>

      <Card mode="elevated" style={styles.permissionsCard}>
        <Card.Content style={styles.permissionsCardContent}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            权限列表
          </Text>

          {permissionList.map((permission, index) => (
            <View key={permission.type}>
              <List.Item
                title={PERMISSION_NAMES[permission.type]}
                description={permission.description}
                left={(props) => (
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor: `${PERMISSION_COLORS[permission.type]}20`,
                      },
                    ]}
                  >
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
                        style={[
                          styles.requiredChip,
                          { backgroundColor: theme.colors.errorContainer },
                        ]}
                        textStyle={{
                          color: theme.colors.onErrorContainer,
                          fontSize: 10,
                        }}
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

              {index < permissionList.length - 1 && (
                <Divider style={styles.divider} />
              )}
            </View>
          ))}
        </Card.Content>
      </Card>

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
