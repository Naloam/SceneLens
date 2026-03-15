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
  Divider,
  Banner,
  ActivityIndicator,
  Surface,
  useTheme,
} from 'react-native-paper';
import { usePermissions } from '../hooks/usePermissions';
import { 
  permissionManager,
  PermissionType, 
  PermissionStatus,
  PERMISSION_GROUPS as PM_GROUPS,
} from '../utils/PermissionManager';
import { spacing, borderRadius } from '../theme/spacing';

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
  [PermissionStatus.GRANTED]: '#16A34A', // 更现代的绿色
  [PermissionStatus.DENIED]: '#DC2626', // 更现代的红色
  [PermissionStatus.PERMANENTLY_DENIED]: '#DC2626',
  [PermissionStatus.UNDETERMINED]: '#9CA3AF', // 更柔和的灰色
  [PermissionStatus.REQUIRES_SETTINGS]: '#EA580C', // 更活泼的橙色
  [PermissionStatus.UNAVAILABLE]: '#9CA3AF',
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
  const ultraLightBg = theme.colors.primary + '0A'; // 极淡主题色背景

  const {
    permissions,
    checking,
    requesting,
    requestPermission,
    requestRequiredPermissions,
    openPermissionSettings,
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
      await openPermissionSettings(permission);
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
        titleStyle={{ fontWeight: '700', fontSize: 15, color: theme.colors.onSurface }}
        description={description}
        descriptionStyle={{ opacity: 0.7, marginTop: 2, lineHeight: 18 }}
        descriptionNumberOfLines={2}
        left={props => (
          <List.Icon 
            {...props} 
            icon={getPermissionIcon(permission)}
            color={STATUS_COLORS[statusValue]}
            style={{ marginLeft: 8, marginRight: 16, alignSelf: 'center' }} 
          />
        )}
        
        right={() => (
          <View style={styles.rightContainer}>
            {/* 修复：使用无高度限制的 View 代替 Chip，靠 padding 撑开，绝不切字 */}
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[statusValue] + '1A' }]}>
              <Text style={{ color: STATUS_COLORS[statusValue], fontSize: 11, fontWeight: '800' }}>
                {STATUS_LABELS[statusValue]}
              </Text>
            </View>
            
            {!isGranted && (
              <Button
                mode="contained-tonal"
                compact
                onPress={() => handleRequestPermission(permission)}
                loading={requesting}
                disabled={requesting}
                buttonColor={theme.colors.primaryContainer}
                textColor={theme.colors.primary}
                style={{ borderRadius: 999, marginLeft: 8 }}
                labelStyle={{ fontSize: 12, fontWeight: '700', marginHorizontal: 12 }}
              >
                {statusValue === PermissionStatus.REQUIRES_SETTINGS || 
                 statusValue === PermissionStatus.PERMANENTLY_DENIED ? '去设置' : '授权'}
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
    const isAllGranted = grantedCount === group.permissions.length;

    return (
      <Card key={index} mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.colors.onSurface }}>
              {group.title}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              {group.description}
            </Text>
          </View>
          <Surface style={[styles.progressBadge, { backgroundColor: isAllGranted ? '#DCFCE7' : '#FFF7ED' }]} elevation={0}>
             <Text style={{ fontWeight: '800', fontSize: 12, color: isAllGranted ? '#16A34A' : '#EA580C' }}>
               {grantedCount}/{group.permissions.length} 已授权
             </Text>
          </Surface>
        </View>
        
        <Card.Content style={{ paddingHorizontal: 8 }}>
          {group.permissions.map((p, i) => (
            <React.Fragment key={p}>
              {renderPermissionItem(p)}
              {i < group.permissions.length - 1 && <Divider style={{ opacity: 0.4 }} />}
            </React.Fragment>
          ))}
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
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} />
      }
    >
      {/* 顶部 Banner 换成柔和的背景卡片 */}
      {showBanner && totalProgress < 100 && (
        <Surface style={[styles.bannerCard, { backgroundColor: ultraLightBg }]} elevation={0}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <List.Icon icon="shield-alert" color={theme.colors.primary} style={{ margin: 0, marginRight: 12 }} />
            <Text style={{ flex: 1, color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
              为了获得最佳体验，建议授予所有必要权限。当前已授权 {totalProgress}%。
            </Text>
          </View>
          <View style={styles.bannerActions}>
            <Button mode="text" onPress={() => setShowBanner(false)} textColor={theme.colors.onSurfaceVariant} style={{ borderRadius: 999 }}>稍后</Button>
            <Button mode="contained" onPress={handleRequestAll} buttonColor={theme.colors.primary} style={{ borderRadius: 999, paddingHorizontal: 8 }}>一键授权</Button>
          </View>
        </Surface>
      )}

      {/* 加载指示器 */}
      {checking && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.primary }]}>检查权限状态...</Text>
        </View>
      )}

      {/* 总体进度卡片 */}
      <Card mode="elevated" elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text variant="headlineMedium" style={{ color: '#16A34A', fontWeight: '900' }}>
                {grantedTotal}
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.6, fontWeight: '700' }}>已授权</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="headlineMedium" style={{ color: '#EA580C', fontWeight: '900' }}>
                {allPermissions.length - grantedTotal}
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.6, fontWeight: '700' }}>待授权</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: '900' }}>
                {totalProgress}%
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.6, fontWeight: '700' }}>完成度</Text>
            </View>
          </View>
          
          <Button 
            mode="contained" 
            onPress={handleRequestAll}
            loading={requesting}
            disabled={requesting || totalProgress === 100}
            icon={totalProgress === 100 ? "check-decagram" : "shield-check"}
            style={{ borderRadius: borderRadius.lg, marginTop: 12 }}
            contentStyle={{ height: 48 }}
          >
            {totalProgress === 100 ? '全部已授权' : '一键授权必要权限'}
          </Button>
        </Card.Content>
      </Card>

      {/* 权限分组列表 */}
      {PERMISSION_GROUPS.map(renderPermissionGroup)}

      {/* 底部提示卡片 - 采用极淡主题色，告别生硬黄底 */}
      <Card mode="elevated" elevation={0} style={[styles.card, { backgroundColor: theme.colors.primaryContainer, opacity: 0.8 }]}>
        <Card.Content>
          <Text variant="titleSmall" style={{ fontWeight: '800', color: theme.colors.primary, marginBottom: 8 }}>
            💡 权限提示
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.primary, lineHeight: 18, fontWeight: '600' }}>
            某些高级权限（如"修改系统设置"、"勿扰模式"）无法一键请求，需要在系统设置中手动开启。点击"去设置"按钮可以直接跳转。
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
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: 60,
  },
  
  card: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 12,
  },
  
  bannerCard: {
    padding: 20,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  bannerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontWeight: '700',
  },
  
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
  },
  summaryItem: {
    alignItems: 'center',
  },
  
  progressBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 12,
  },
  
  listItem: {
    paddingVertical: spacing.sm,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'center',
  },
});

export default PermissionsScreen;