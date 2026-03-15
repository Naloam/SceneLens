/**
 * PermissionsScreen - 权限管理页面
 * 
 * 显示所有权限状态，允许用户管理权限
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  List,
  Button,
  Chip,
  Divider,
  Banner,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { usePermissions } from '../hooks/usePermissions';
import { 
  permissionManager,
  PermissionType, 
  PermissionStatus,
  PERMISSION_GROUPS as PM_GROUPS,
} from '../utils/PermissionManager';
import { spacing } from '../theme/spacing';

// ==================== 权限配置 ====================

const PERMISSION_GROUPS = [
  {
    title: '核心权限',
    description: '这些权限对于应用正常运行至关重要',
    permissions: [
      PermissionType.LOCATION_FINE, 
      PermissionType.ACTIVITY_RECOGNITION, 
      PermissionType.NOTIFICATIONS
    ],
  },
  {
    title: '增强功能',
    description: '这些权限可以提升使用体验',
    permissions: [
      PermissionType.LOCATION_BACKGROUND, 
      PermissionType.CALENDAR_READ
    ],
  },
  {
    title: '自动化权限',
    description: '这些权限用于场景自动化功能',
    permissions: [
      PermissionType.WRITE_SETTINGS, 
      PermissionType.NOTIFICATION_POLICY, 
      PermissionType.USAGE_STATS
    ],
  },
];

const STATUS_COLORS: Record<PermissionStatus, string> = {
  [PermissionStatus.GRANTED]: '#4CAF50',
  [PermissionStatus.DENIED]: '#F44336',
  [PermissionStatus.PERMANENTLY_DENIED]: '#F44336',
  [PermissionStatus.UNDETERMINED]: '#9E9E9E',
  [PermissionStatus.REQUIRES_SETTINGS]: '#FF9800',
  [PermissionStatus.UNAVAILABLE]: '#9E9E9E',
};

const STATUS_LABELS: Record<PermissionStatus, string> = {
  [PermissionStatus.GRANTED]: '已授权',
  [PermissionStatus.DENIED]: '已拒绝',
  [PermissionStatus.PERMANENTLY_DENIED]: '永久拒绝',
  [PermissionStatus.UNDETERMINED]: '未请求',
  [PermissionStatus.REQUIRES_SETTINGS]: '需手动开启',
  [PermissionStatus.UNAVAILABLE]: '不可用',
};

// ==================== 组件 ====================

export const PermissionsScreen: React.FC = () => {
  const theme = useTheme();
  const {
    permissions,
    checking,
    requesting,
    requestPermission,
    requestRequiredPermissions,
    openBlockedSettings,
    refreshAll,
  } = usePermissions();

  const [refreshing, setRefreshing] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const handleRequestPermission = async (permission: PermissionType) => {
    const status = await requestPermission(permission);
    
    if (status === PermissionStatus.REQUIRES_SETTINGS || status === PermissionStatus.PERMANENTLY_DENIED) {
      // 使用 OPPO 优化跳转：在 ColorOS 14.0.1+ 上直接跳转权限管理页并高亮受阻权限
      await openBlockedSettings(permission);
    }
  };

  const handleRequestAll = async () => {
    await requestRequiredPermissions();
  };

  const getPermissionIcon = (permission: PermissionType): string => {
    const icons: Record<PermissionType, string> = {
      [PermissionType.LOCATION_FINE]: 'map-marker',
      [PermissionType.LOCATION_COARSE]: 'map-marker-outline',
      [PermissionType.LOCATION_BACKGROUND]: 'map-marker-radius',
      [PermissionType.CALENDAR_READ]: 'calendar',
      [PermissionType.CALENDAR_WRITE]: 'calendar-edit',
      [PermissionType.ACTIVITY_RECOGNITION]: 'run',
      [PermissionType.WRITE_SETTINGS]: 'cog',
      [PermissionType.NOTIFICATION_POLICY]: 'bell-off',
      [PermissionType.USAGE_STATS]: 'chart-bar',
      [PermissionType.CAMERA]: 'camera',
      [PermissionType.MICROPHONE]: 'microphone',
      [PermissionType.NOTIFICATIONS]: 'bell',
      [PermissionType.STORAGE_READ]: 'folder',
      [PermissionType.STORAGE_WRITE]: 'folder-edit',
    };
    return icons[permission] || 'help-circle';
  };

  const renderPermissionItem = (permission: PermissionType) => {
    const title = permissionManager.getPermissionTitle(permission);
    const description = permissionManager.getPermissionMessage(permission);
    const result = permissions.get(permission);
    const statusValue = result?.status || PermissionStatus.UNDETERMINED;
    const isGranted = statusValue === PermissionStatus.GRANTED;

    return (
      <List.Item
        key={permission}
        title={title}
        description={description}
        descriptionNumberOfLines={2}
        left={props => (
          <List.Icon 
            {...props} 
            icon={getPermissionIcon(permission)}
            color={STATUS_COLORS[statusValue]}
          />
        )}
        right={() => (
          <View style={styles.rightContainer}>
            <Chip
              mode="flat"
              textStyle={{ fontSize: 12 }}
              style={[
                styles.statusChip,
                { backgroundColor: STATUS_COLORS[statusValue] + '20' },
              ]}
            >
              {STATUS_LABELS[statusValue]}
            </Chip>
            {!isGranted && (
              <Button
                mode="text"
                compact
                onPress={() => handleRequestPermission(permission)}
                loading={requesting}
                disabled={requesting}
              >
                {statusValue === PermissionStatus.REQUIRES_SETTINGS || 
                 statusValue === PermissionStatus.PERMANENTLY_DENIED ? '设置' : '授权'}
              </Button>
            )}
          </View>
        )}
        style={styles.listItem}
      />
    );
  };

  const renderPermissionGroup = (group: typeof PERMISSION_GROUPS[0], index: number) => {
    const grantedCount = group.permissions.filter(
      p => permissions.get(p)?.status === PermissionStatus.GRANTED
    ).length;

    return (
      <Card key={index} style={styles.groupCard}>
        <Card.Title
          title={group.title}
          subtitle={`${grantedCount}/${group.permissions.length} 已授权`}
          right={() => (
            <Text 
              style={[
                styles.progressText,
                { color: grantedCount === group.permissions.length ? '#4CAF50' : '#FF9800' },
              ]}
            >
              {Math.round((grantedCount / group.permissions.length) * 100)}%
            </Text>
          )}
        />
        <Card.Content>
          <Text variant="bodySmall" style={styles.groupDescription}>
            {group.description}
          </Text>
          <Divider style={styles.divider} />
          {group.permissions.map(renderPermissionItem)}
        </Card.Content>
      </Card>
    );
  };

  // 计算总体进度
  const allPermissions = PERMISSION_GROUPS.flatMap(g => g.permissions);
  const grantedTotal = allPermissions.filter(
    p => permissions.get(p)?.status === PermissionStatus.GRANTED
  ).length;
  const totalProgress = Math.round((grantedTotal / allPermissions.length) * 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* 顶部 Banner */}
      {showBanner && totalProgress < 100 && (
        <Banner
          visible={showBanner}
          actions={[
            {
              label: '稍后',
              onPress: () => setShowBanner(false),
            },
            {
              label: '一键授权',
              onPress: handleRequestAll,
            },
          ]}
          icon="shield-check"
        >
          为了获得最佳体验，建议授予所有必要权限。当前已授权 {totalProgress}%。
        </Banner>
      )}

      {/* 加载指示器 */}
      {checking && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>检查权限状态...</Text>
        </View>
      )}

      {/* 总体进度卡片 */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text variant="headlineMedium" style={{ color: '#4CAF50' }}>
                {grantedTotal}
              </Text>
              <Text variant="bodySmall">已授权</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="headlineMedium" style={{ color: '#FF9800' }}>
                {allPermissions.length - grantedTotal}
              </Text>
              <Text variant="bodySmall">待授权</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
                {totalProgress}%
              </Text>
              <Text variant="bodySmall">完成度</Text>
            </View>
          </View>
        </Card.Content>
        <Card.Actions>
          <Button 
            mode="contained" 
            onPress={handleRequestAll}
            loading={requesting}
            disabled={requesting || totalProgress === 100}
            icon="shield-check"
          >
            {totalProgress === 100 ? '全部已授权' : '一键授权必要权限'}
          </Button>
        </Card.Actions>
      </Card>

      {/* 权限分组列表 */}
      {PERMISSION_GROUPS.map(renderPermissionGroup)}

      {/* 底部提示 */}
      <Card style={styles.noteCard}>
        <Card.Content>
          <Text variant="bodySmall" style={styles.noteText}>
            💡 提示：某些权限（如"修改系统设置"、"勿扰模式"）需要在系统设置中手动开启。
            点击"设置"按钮可以直接跳转到对应的设置页面。
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: '#666',
  },
  summaryCard: {
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  groupCard: {
    marginBottom: spacing.md,
  },
  groupDescription: {
    color: '#666',
    marginBottom: spacing.sm,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  listItem: {
    paddingVertical: spacing.xs,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusChip: {
    height: 28,
  },
  progressText: {
    marginRight: spacing.md,
    fontWeight: 'bold',
  },
  noteCard: {
    backgroundColor: '#FFF8E1',
  },
  noteText: {
    color: '#795548',
  },
});

export default PermissionsScreen;
