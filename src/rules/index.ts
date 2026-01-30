/**
 * 规则模块导出
 * 
 * @module rules
 */

export * from './RuleEngine';
export { SceneExecutor } from '../executors/SceneExecutor';

// 新规则引擎
export { RuleBuilder, conditions, actions } from './engine/RuleBuilder';
export { RuleExecutor, ruleExecutor } from './engine/RuleExecutor';
export type { ExecutionContext } from './engine/RuleExecutor';

// 规则模板
export {
  allTemplates,
  getTemplatesByCategory,
  getRecommendedTemplates,
  commuteTemplates,
  sleepTemplates,
  workTemplates,
  createCustomCommuteRule,
  createCustomSleepRule,
  createCustomWorkRule,
} from './templates';

