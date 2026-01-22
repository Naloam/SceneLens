/**
 * 场景徽章组件
 * 显示场景类型的胶囊徽章，带场景专属配色和图标
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';
import { SceneType } from '../../types';
import { getSceneColor } from '../../theme/colors';

export interface SceneBadgeProps {
  /** 场景类型 */
  scene: SceneType;
  /** 尺寸变体 */
  size?: 'small' | 'medium' | 'large';
  /** 样式 */
  style?: any;
}

/**
 * 场景类型图标映射
 */
const sceneIcons: Record<SceneType, string> = {
  COMMUTE: 'train-subway',
  OFFICE: 'office-building',
  HOME: 'home',
  STUDY: 'book-open-variant',
  SLEEP: 'moon-waning-crescent',
  TRAVEL: 'airplane',
  UNKNOWN: 'help-circle',
};

/**
 * 场景类型中文映射
 */
const sceneLabels: Record<SceneType, string> = {
  COMMUTE: '通勤',
  OFFICE: '办公',
  HOME: '到家',
  STUDY: '学习',
  SLEEP: '睡前',
  TRAVEL: '出行',
  UNKNOWN: '未知',
};

/**
 * 尺寸配置
 */
const sizeConfig = {
  small: { height: 24, fontSize: 11, iconSize: 14 },
  medium: { height: 32, fontSize: 13, iconSize: 18 },
  large: { height: 40, fontSize: 15, iconSize: 22 },
};

export const SceneBadge: React.FC<SceneBadgeProps> = ({
  scene,
  size = 'medium',
  style,
}) => {
  const theme = useTheme();
  const sceneColor = getSceneColor(scene);
  const config = sizeConfig[size];

  return (
    <Chip
      style={[
        styles.chip,
        { height: config.height, backgroundColor: `${sceneColor}20` },
        style,
      ]}
      textStyle={[
        styles.text,
        { fontSize: config.fontSize, color: sceneColor },
      ]}
      icon={() => (
        <View style={styles.iconContainer}>
          {/* TODO: 集成 MaterialCommunityIcons */}
          {/* <Icon
            name={sceneIcons[scene]}
            size={config.iconSize}
            color={sceneColor}
          /> */}
        </View>
      )}
    >
      {sceneLabels[scene]}
    </Chip>
  );
};

const styles = StyleSheet.create({
  chip: {
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  text: {
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  iconContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SceneBadge;
