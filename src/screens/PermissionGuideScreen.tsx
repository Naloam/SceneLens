import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { usePermissionStore } from '../stores';
import { sceneBridge } from '../core/SceneBridge';
import type { PermissionType } from '../stores';

export const PermissionGuideScreen: React.FC = () => {
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

  const checkAllPermissions = async () => {
    setIsCheckingPermissions(true);
    try {
      // Check each permission
      for (const [type, info] of permissions) {
        await checkPermission(type);
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);
    } finally {
      setIsCheckingPermissions(false);
    }
  };

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
          // Check notification permission
          hasPermission = true; // Assume granted for now
          break;
        default:
          hasPermission = false;
      }

      setPermissionStatus(type, hasPermission ? 'granted' : 'denied');
    } catch (error) {
      console.error(`Failed to check ${type} permission:`, error);
      setPermissionStatus(type, 'unknown');
    }
  };

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
      console.error(`Failed to request ${type} permission:`, error);
      Alert.alert('错误', '请求权限失败');
    }
  };

  const getPermissionIcon = (type: PermissionType): string => {
    const icons: Record<PermissionType, string> = {
      LOCATION: '📍',
      ACTIVITY_RECOGNITION: '🚶',
      USAGE_STATS: '📊',
      CAMERA: '📷',
      MICROPHONE: '🎤',
      NOTIFICATIONS: '🔔',
      DO_NOT_DISTURB: '🔕',
    };
    return icons[type] || '❓';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'granted':
        return '#4CAF50';
      case 'denied':
        return '#F44336';
      case 'not_requested':
        return '#FF9800';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'granted':
        return '已授予';
      case 'denied':
        return '已拒绝';
      case 'not_requested':
        return '未请求';
      default:
        return '未知';
    }
  };

  const requiredPermissions = getRequiredPermissions();
  const grantedPermissions = getAllGrantedPermissions();
  const allRequiredGranted =
    requiredPermissions.length > 0 &&
    requiredPermissions.every((p) => p.status === 'granted');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>权限管理</Text>
        <Text style={styles.subtitle}>
          SceneLens 需要以下权限来提供场景感知服务
        </Text>
      </View>

      {/* Progress Card */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>权限授予进度</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  (grantedPermissions.length / requiredPermissions.length) * 100
                }%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {grantedPermissions.length} / {requiredPermissions.length} 已授予
        </Text>
        {allRequiredGranted && (
          <Text style={styles.successText}>✅ 所有必需权限已授予</Text>
        )}
      </View>

      {/* Privacy Notice */}
      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>🔒 隐私承诺</Text>
        <Text style={styles.privacyText}>
          • 所有数据仅在本地处理，不上传到云端{'\n'}
          • 相机和麦克风仅在您主动触发时使用{'\n'}
          • 位置信息使用粗定位（精度约100米）{'\n'}
          • 您可以随时撤销权限
        </Text>
      </View>

      {/* Permission List */}
      <View style={styles.permissionsContainer}>
        {Array.from(permissions.values()).map((permission) => (
          <View key={permission.type} style={styles.permissionCard}>
            <View style={styles.permissionHeader}>
              <Text style={styles.permissionIcon}>
                {getPermissionIcon(permission.type)}
              </Text>
              <View style={styles.permissionInfo}>
                <View style={styles.permissionTitleRow}>
                  <Text style={styles.permissionName}>
                    {permission.type.replace(/_/g, ' ')}
                  </Text>
                  {permission.isRequired && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>必需</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.permissionDescription}>
                  {permission.description}
                </Text>
              </View>
            </View>

            <View style={styles.permissionFooter}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(permission.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {getStatusText(permission.status)}
                </Text>
              </View>

              {permission.status !== 'granted' && (
                <TouchableOpacity
                  style={styles.requestButton}
                  onPress={() => requestPermission(permission.type)}
                >
                  <Text style={styles.requestButtonText}>请求权限</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={checkAllPermissions}
        disabled={isCheckingPermissions}
      >
        <Text style={styles.refreshButtonText}>
          {isCheckingPermissions ? '检查中...' : '🔄 刷新权限状态'}
        </Text>
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
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  privacyCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 13,
    color: '#2E7D32',
    lineHeight: 20,
  },
  permissionsContainer: {
    gap: 12,
  },
  permissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  permissionHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  permissionIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  permissionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  requiredBadge: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  permissionDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  permissionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requestButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  requestButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
