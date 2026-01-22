/**
 * 颜色系统 - Material Design 3 规范
 */

/**
 * 场景类型专属色彩
 */
export const sceneColors = {
  commute: '#FF6B6B',      // 通勤 - 红色
  office: '#4ECDC4',       // 办公 - 青绿色
  home: '#95E1D3',         // 到家 - 薄荷绿
  study: '#F38181',        // 学习 - 粉红色
  sleep: '#AA96DA',        // 睡眠 - 紫色
  travel: '#FCBAD3',       // 出行 - 浅粉色
  unknown: '#A8A8A8',      // 未知 - 灰色
};

/**
 * 场景容器色（浅色背景）
 */
export const sceneContainerColors = {
  commute: '#FFEBEE',
  office: '#E0F2F1',
  home: '#E8F5E9',
  study: '#FCE4EC',
  sleep: '#EDE7F6',
  travel: '#FCE4EC',
  unknown: '#F5F5F5',
};

/**
 * Material Design 3 主色调
 */
export const primaryColors = {
  primary: '#6750A4',           // Material You 紫色
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
};

/**
 * Material Design 3 次要色调
 */
export const secondaryColors = {
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
};

/**
 * 功能色彩
 */
export const functionalColors = {
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F2B8B5',
  onErrorContainer: '#410E0B',

  success: '#386A20',
  onSuccess: '#FFFFFF',
  successContainer: '#CFF6C5',
  onSuccessContainer: '#072C00',

  warning: '#7D5700',
  onWarning: '#FFFFFF',
  warningContainer: '#FDDF99',
  onWarningContainer: '#2A1800',

  info: '#0061A4',
  onInfo: '#FFFFFF',
  infoContainer: '#D1E4FF',
  onInfoContainer: '#001C38',
};

/**
 * 获取场景颜色
 */
export function getSceneColor(scene: string): string {
  const key = scene.toLowerCase() as keyof typeof sceneColors;
  return sceneColors[key] || sceneColors.unknown;
}

/**
 * 获取场景容器色
 */
export function getSceneContainerColor(scene: string): string {
  const key = scene.toLowerCase() as keyof typeof sceneContainerColors;
  return sceneContainerColors[key] || sceneContainerColors.unknown;
}

/**
 * 获取置信度颜色
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) {
    return functionalColors.success;    // 高置信度 - 绿色
  } else if (confidence >= 0.4) {
    return functionalColors.warning;    // 中置信度 - 黄色
  } else {
    return functionalColors.error;      // 低置信度 - 红色
  }
}
