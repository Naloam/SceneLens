import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, IconButton, Surface, Button, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { spacing, borderRadius } from '../../theme/spacing';
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
  const theme = useTheme();

  return (
    <Card 
      mode="elevated" 
      elevation={1} // 恢复标准层级
      style={[styles.card, { borderRadius: borderRadius.xl, backgroundColor: theme.colors.surface }]}
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.headerRow}>
          <Text variant="titleMedium" style={{ fontWeight: '600', color: theme.colors.onSurfaceVariant }}>
             当前位置
          </Text>
          <View style={styles.actionsRow}>
            <Button mode="text" compact onPress={() => navigation.navigate('LocationConfig' as never)} labelStyle={{ fontSize: 12, color: theme.colors.primary }}>
              配置
            </Button>
            <IconButton icon="refresh" size={20} iconColor={theme.colors.primary} onPress={onRefresh} disabled={isRefreshingLocation} style={styles.refreshIconButton} />
          </View>
        </View>

        {currentLocation ? (
          <Surface style={[styles.locationInfo, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
            <View style={styles.compactDataRow}>
              <View style={styles.latLonGroup}>
                <Text style={{ fontSize: 13, color: theme.colors.primary }}>
                  纬度 <Text style={{ fontWeight: '800' }}>{currentLocation.latitude.toFixed(4)}</Text>
                </Text>
                <Text style={{ fontSize: 13, color: theme.colors.primary, marginLeft: 12 }}>
                  经度 <Text style={{ fontWeight: '800' }}>{currentLocation.longitude.toFixed(4)}</Text>
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.colors.primary, opacity: 0.7 }}>
                ±{currentLocation.accuracy.toFixed(0)}m
              </Text>
            </View>
          </Surface>
        ) : (
          <Surface style={[styles.locationInfoEmpty, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
            <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant }}>
              正在感知当前位置...
            </Text>
          </Surface>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    // 移除所有阴影和外边距
  },
  cardContent: {
    padding: spacing.md, // 恢复标准边距
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  refreshIconButton: { margin: 0 },
  locationInfo: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  locationInfoEmpty: { padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  compactDataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  latLonGroup: { flexDirection: 'row' },
});

export default LocationCard;