/**
 * 快捷操作模块导出
 * 
 * 提供快捷操作的管理器、预设和类型定义
 * 
 * @module quickactions
 */

// 管理器
export { QuickActionManager, quickActionManager } from './QuickActionManager';

// 预设
export {
  allPresets,
  getPresetsByCategory,
  getDefaultPresets,
  paymentPresets,
  navigationPresets,
  communicationPresets,
} from './presets';
