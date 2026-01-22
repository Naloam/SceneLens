/**
 * 信号源芯片组件
 * 显示场景检测的信号源（时间、位置、运动等）
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';
import { ContextSignal } from '../../types';

export interface SignalChipProps {
  /** 信号数据 */
  signal: ContextSignal;
  /** 是否显示权重 */
  showWeight?: boolean;
  /** 是否可点击 */
  onPress?: () => void;
  /** 样式 */
  style?: any;
}

/**
 * 信号类型图标映射
 */
const signalIcons: Record<string, string> = {
  TIME: 'clock-outline',
  LOCATION: 'map-marker-outline',
  MOTION: 'walk-outline',
  WIFI: 'wifi-outline',
  FOREGROUND_APP: 'application-outline',
  CALENDAR: 'calendar-outline',
};

/**
 * 信号类型中文映射
 */
const signalLabels: Record<string, string> = {
  TIME: '时间',
  LOCATION: '位置',
  MOTION: '运动',
  WIFI: 'WiFi',
  FOREGROUND_APP: '应用',
  CALENDAR: '日历',
};

/**
 * 信号值格式化
 */
function formatSignalValue(type: string, value: string): string {
  switch (type) {
    case 'TIME':
      // 将 MORNING_RUSH_WEEKDAY 转换为 "早高峰 工作日"
      const parts = value.split('_');
      const periodMap: Record<string, string> = {
        'EARLY-MORNING': '早起',
        'MORNING-RUSH': '早高峰',
        'MORNING': '上午',
        'LUNCH': '午餐',
        'AFTERNOON': '下午',
        'EVENING-RUSH': '晚高峰',
        'NIGHT': '晚间',
        'LATE-NIGHT': '深夜',
      };
      const dayType = parts.includes('WEEKDAY') ? '工作日' : '周末';
      const period = periodMap[parts[0]] || parts[0];
      return `${period} ${dayType}`;

    case 'LOCATION':
      const locationMap: Record<string, string> = {
        'HOME': '家',
        'OFFICE': '办公室',
        'SUBWAY-STATION': '地铁站',
        'TRAIN-STATION': '火车站',
        'AIRPORT': '机场',
        'LIBRARY': '图书馆',
        'UNKNOWN': '未知',
      };
      return locationMap[value] || value;

    case 'MOTION':
      const motionMap: Record<string, string> = {
        'STILL': '静止',
        'WALKING': '步行',
        'RUNNING': '跑步',
        'VEHICLE': '乘车',
        'UNKNOWN': '未知',
      };
      return motionMap[value] || value;

    default:
      return value;
  }
}

export const SignalChip: React.FC<SignalChipProps> = ({
  signal,
  showWeight = true,
  onPress,
  style,
}) => {
  const theme = useTheme();

  const label = signalLabels[signal.type] || signal.type;
  const value = formatSignalValue(signal.type, signal.value);
  const weightPercent = Math.round(signal.weight * 100);

  return (
    <Chip
      mode="outlined"
      style={[styles.chip, style]}
      onPress={onPress}
      textStyle={styles.text}
    >
      <View style={styles.content}>
        <View style={styles.labelRow}>
          {/* TODO: 集成图标 */}
          <Text style={styles.label}>{label}:</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
        {showWeight && (
          <Text style={[styles.weight, { color: theme.colors.primary }]}>
            {weightPercent}%
          </Text>
        )}
      </View>
    </Chip>
  );
};

const styles = StyleSheet.create({
  chip: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
  },
  label: {
    fontWeight: '600',
    marginRight: 4,
  },
  value: {
    marginRight: 8,
  },
  weight: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
});

export default SignalChip;
