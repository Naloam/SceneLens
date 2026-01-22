/**
 * 间距系统 - 基于 8px 网格的 Material Design 规范
 */

/**
 * 间距常量（单位：dp）
 */
export const spacing = {
  xs: 4,    // 0.5rem - 最小间距
  sm: 8,    // 1rem   - 小间距
  md: 16,   // 2rem   - 中等间距（默认）
  lg: 24,   // 3rem   - 大间距
  xl: 32,   // 4rem   - 超大间距
  xxl: 48,  // 6rem   - 特大间距
};

/**
 * 圆角半径
 */
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999, // 圆形
};

/**
 * 阴影层级（Elevation）
 */
export const elevation = {
  level0: 0,
  level1: 1,
  level2: 2,
  level3: 3,
  level4: 4,
  level5: 5,
};

/**
 * 图标尺寸
 */
export const iconSize = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
};

/**
 * 应用内边距
 */
export const padding = {
  screen: spacing.md,           // 屏幕边距
  card: spacing.md,             // 卡片内边距
  button: {
    horizontal: spacing.lg,     // 按钮水平内边距
    vertical: spacing.sm,       // 按钮垂直内边距
  },
  input: spacing.md,            // 输入框内边距
};

/**
 * 组件尺寸
 */
export const size = {
  button: {
    height: 40,
    icon: 24,
  },
  card: {
    minWidth: 160,
    maxWidth: 400,
  },
  avatar: {
    small: 32,
    medium: 48,
    large: 64,
  },
  chip: {
    height: 32,
  },
};
