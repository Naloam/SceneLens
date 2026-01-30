/**
 * 智能建议服务模块导出
 */

// 类型导出
export type {
  // 上下文类型
  AggregatedContext,
  TimeContext,
  ImageContext,
  AudioContext,
  LocationContext,
  CalendarContext,
  DeviceContext,
  UserContext,
  SceneContext,
  
  // 建议类型
  SmartSuggestion,
  SmartAction,
  SmartActionType,
  SmartActionGroup,
  ConfidenceLevel,
  
  // 模板类型
  SubSceneDefinition,
  SceneTemplateConfig,
  TemplateSlot,
  SlotFillerConfig,
  SuggestionTemplate,
  
  // 个性化类型
  PersonalizationFactors,
  ToneStyle,
  VerbosityLevel,
  
  // 其他类型
  TimeOfDayType,
  EnvironmentType,
  SoundEnvironment,
  TransportMode,
  LabelScore,
  UpcomingEvent,
  AlternativeScene,
  FeedbackHistoryStats,
  UsagePatterns,
} from './types';

// 核心组件导出
export { ContextAggregator, contextAggregator } from './ContextAggregator';
export { TextGenerator, textGenerator } from './TextGenerator';
export { ActionReasonGenerator, actionReasonGenerator } from './ActionReasonGenerator';
export type { ActionType } from './ActionReasonGenerator';
export { PersonalizationManager, personalizationManager } from './PersonalizationManager';
export type { UserPreferences } from './PersonalizationManager';
export { SmartSuggestionEngine, smartSuggestionEngine } from './SmartSuggestionEngine';

// 重新导入并默认导出智能建议引擎
import { smartSuggestionEngine as engine } from './SmartSuggestionEngine';
export default engine;
