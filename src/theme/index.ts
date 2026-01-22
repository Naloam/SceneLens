/**
 * 主题系统入口 - 导出所有主题配置
 */

import {
  MD3LightTheme,
  MD3DarkTheme,
} from 'react-native-paper';
import {
  primaryColors,
  secondaryColors,
  functionalColors,
  sceneColors,
  getSceneColor,
  getSceneContainerColor,
  getConfidenceColor,
} from './colors';
import { typography } from './typography';
import { spacing, borderRadius, elevation, iconSize, padding, size } from './spacing';

/**
 * 自定义浅色主题
 */
export const lightTheme = {
  ...MD3LightTheme,
  ...typography,

  // 主色调
  colors: {
    ...MD3LightTheme.colors,
    primary: primaryColors.primary,
    onPrimary: primaryColors.onPrimary,
    primaryContainer: primaryColors.primaryContainer,
    onPrimaryContainer: primaryColors.onPrimaryContainer,

    secondary: secondaryColors.secondary,
    onSecondary: secondaryColors.onSecondary,
    secondaryContainer: secondaryColors.secondaryContainer,
    onSecondaryContainer: secondaryColors.onSecondaryContainer,

    error: functionalColors.error,
    onError: functionalColors.onError,
    errorContainer: functionalColors.errorContainer,
    onErrorContainer: functionalColors.onErrorContainer,

    // 背景色
    background: '#F5F5F5',
    onBackground: '#191C1E',
    surface: '#FFFFFF',
    onSurface: '#191C1E',

    // 场景色彩（扩展）
    ...sceneColors,
  },
};

/**
 * 自定义深色主题
 */
export const darkTheme = {
  ...MD3DarkTheme,
  ...typography,

  colors: {
    ...MD3DarkTheme.colors,
    primary: primaryColors.primary,
    onPrimary: primaryColors.onPrimary,
    primaryContainer: primaryColors.primaryContainer,
    onPrimaryContainer: primaryColors.onPrimaryContainer,

    secondary: secondaryColors.secondary,
    onSecondary: secondaryColors.onSecondary,
    secondaryContainer: secondaryColors.secondaryContainer,
    onSecondaryContainer: secondaryColors.onSecondaryContainer,

    error: functionalColors.error,
    onError: functionalColors.onError,

    background: '#121212',
    onBackground: '#E2E2E2',
    surface: '#1E1E1E',
    onSurface: '#E2E2E2',

    // 场景色彩（扩展）
    ...sceneColors,
  },
};

/**
 * 导出所有主题常量和工具函数
 */
export const theme = {
  colors: {
    primary: primaryColors,
    secondary: secondaryColors,
    functional: functionalColors,
    scene: sceneColors,
    getSceneColor,
    getSceneContainerColor,
    getConfidenceColor,
  },
  spacing,
  borderRadius,
  elevation,
  iconSize,
  padding,
  size,
};

export default lightTheme;
