/**
 * 置信度进度条组件
 * 可视化显示场景检测置信度，支持动画和颜色动态变化
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { getConfidenceColor } from '../../theme/colors';

export interface ConfidenceBarProps {
  /** 置信度值 (0-1) */
  confidence: number;
  /** 是否显示百分比文字 */
  showPercentage?: boolean;
  /** 是否启用动画 */
  animated?: boolean;
  /** 动画时长（毫秒） */
  animationDuration?: number;
  /** 样式 */
  style?: any;
  /** 进度条高度 */
  height?: number;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  confidence,
  showPercentage = true,
  animated = true,
  animationDuration = 800,
  style,
  height = 8,
}) => {
  const theme = useTheme();
  const progressAnim = useRef(new Animated.Value(0)).current;

  // 根据置信度获取颜色
  const getColor = () => {
    return getConfidenceColor(confidence);
  };

  // 获取置信度等级
  const getLevel = () => {
    if (confidence >= 0.7) return '高';
    if (confidence >= 0.4) return '中';
    return '低';
  };

  useEffect(() => {
    if (animated) {
      Animated.timing(progressAnim, {
        toValue: confidence,
        duration: animationDuration,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(confidence);
    }
  }, [confidence, animated, animationDuration]);

  const percentage = Math.round(confidence * 100);
  const color = getColor();
  const level = getLevel();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.barContainer, { height }]}>
        <View style={[styles.backgroundBar, { height, borderRadius: height / 2 }]} />
        <Animated.View
          style={[
            styles.progressBar,
            {
              height,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: color,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>

      {showPercentage && (
        <View style={styles.labelContainer}>
          <Text style={[styles.percentage, { color }]}>
            {percentage}%
          </Text>
          <Text style={[styles.level, { color: theme.colors.onSurfaceVariant }]}>
            置信度{level}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  backgroundBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#E0E0E0',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  percentage: {
    fontSize: 18,
    fontWeight: '700',
  },
  level: {
    fontSize: 12,
    marginLeft: 8,
  },
});

export default ConfidenceBar;
