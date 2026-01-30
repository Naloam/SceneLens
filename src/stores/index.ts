export { useSceneStore } from './sceneStore';
export type { SceneHistory } from './sceneStore';

export { useAppPreferenceStore } from './appPreferenceStore';

export { usePermissionStore } from './permissionStore';
export type { PermissionType, PermissionStatus, PermissionInfo } from './permissionStore';

export { useSettingsStore, themeColors } from './settingsStore';
export type { AppSettings, ThemeColor, NotificationStyle, DetectionInterval } from './settingsStore';

export { storageManager } from './storageManager';
export { geoFenceManager } from './geoFenceManager';

// AI 模型统计
export { useMLStatsStore } from './mlStatsStore';
export type { InferenceRecord, ModelInferenceStats, DailyStats } from './mlStatsStore';
