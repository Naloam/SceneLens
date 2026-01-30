/**
 * 规则引擎模块导出
 * 
 * @module rules/engine
 */

export { RuleBuilder, conditions, actions } from './RuleBuilder';
export { RuleExecutor, ruleExecutor } from './RuleExecutor';
export type { ExecutionContext } from './RuleExecutor';
