/**
 * 预测引擎模块
 * 
 * 提供时间模式分析、行为模式发现和上下文预测能力
 * 
 * @module prediction
 */

// 类型导出
export * from './types';

// 时间模式引擎
export { TimePatternEngine, timePatternEngine } from './TimePatternEngine';
export type { default as TimePatternEngineType } from './TimePatternEngine';

// 行为分析器
export { BehaviorAnalyzer, behaviorAnalyzer } from './BehaviorAnalyzer';
export type { default as BehaviorAnalyzerType } from './BehaviorAnalyzer';

// 上下文预测器
export { ContextPredictor, contextPredictor } from './ContextPredictor';
export type { default as ContextPredictorType } from './ContextPredictor';
