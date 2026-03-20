/**
 * LocationCard - 位置信息卡片组件
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, IconButton, Surface, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { spacing } from '../../theme/spacing';
import type { Location } from '../../types';

export interface LocationCardProps {
  currentLocation: Location | null;
  isRefreshingLocation: boolean;
  onRefresh: () => void;
}

export const LocationCard: React.FC<LocationCardProps> = ({
  currentLocation,
  isRefreshingLocation,
  onRefresh,
}) => {
  const navigation = useNavigation();

  const resolveAgeMs = (location: Location): number => {
    if (typeof location.ageMs === 'number' && Number.isFinite(location.ageMs)) {
      return Math.max(0, location.ageMs);
    }

    return Math.max(0, Date.now() - location.timestamp);
  };

  const formatAge = (location: Location): string => {
    const ageMs = resolveAgeMs(location);
    if (ageMs < 60_000) {
      return '刚刚更新';
    }

    const ageMinutes = Math.round(ageMs / 60_000);
    if (ageMinutes < 60) {
      return `${ageMinutes} 分钟前`;
    }

    const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1);
    return `${ageHours} 小时前`;
  };

  const formatSource = (location: Location): string => {
    switch (location.source) {
      case 'current':
        return '即时定位';
      case 'foreground_service':
        return '后台前台服务';
      case 'last_known':
        return '缓存定位';
      default:
        return location.provider || '未知来源';
    }
  };

  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content>
        <View style={styles.headerRow}>
          <Text variant="titleLarge" style={styles.cardTitle}>
            📍 当前位置
          </Text>
          <IconButton
            icon="refresh"
            size={20}
            onPress={onRefresh}
            disabled={isRefreshingLocation}
            style={styles.refreshIconButton}
          />
        </View>

        {currentLocation ? (
          <Surface style={styles.locationInfo} elevation={0}>
            <Text variant="bodyMedium" style={styles.locationLabel}>
              纬度: <Text style={styles.locationValue}>{currentLocation.latitude.toFixed(6)}</Text>
            </Text>
            <Text variant="bodyMedium" style={styles.locationLabel}>
              经度: <Text style={styles.locationValue}>{currentLocation.longitude.toFixed(6)}</Text>
            </Text>
            <Text variant="bodySmall" style={styles.locationAccuracy}>
              精度: ±{currentLocation.accuracy.toFixed(0)}米
            </Text>
            <Text variant="bodySmall" style={styles.locationMeta}>
              来源: {formatSource(currentLocation)}
            </Text>
            <Text variant="bodySmall" style={styles.locationMeta}>
              时效: {currentLocation.isStale ? '已过期' : '新鲜'} · {formatAge(currentLocation)}
            </Text>
          </Surface>
        ) : (
          <Surface style={styles.locationInfoEmpty} elevation={0}>
            <Text variant="bodyMedium" style={styles.noLocationText}>
              正在获取位置...
            </Text>
          </Surface>
        )}

        <Button
          mode="outlined"
          onPress={() => navigation.navigate('LocationConfig' as never)}
          icon="cog"
          style={styles.locationConfigButton}
        >
          位置配置
        </Button>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  refreshIconButton: {
    margin: 0,
  },
  locationInfo: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#E8F4FD',
    marginBottom: 16,
  },
  locationInfoEmpty: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 16,
  },
  locationLabel: {
    marginBottom: 4,
    color: '#424242',
  },
  locationValue: {
    fontWeight: '600',
    color: '#1976D2',
  },
  locationAccuracy: {
    marginTop: 8,
    opacity: 0.7,
  },
  locationMeta: {
    marginTop: 4,
    opacity: 0.72,
  },
  noLocationText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  locationConfigButton: {
    borderColor: '#E0E0E0',
  },
});

export default LocationCard;
