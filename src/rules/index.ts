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

// UI 规则构建器
export {
  UIRuleBuilder,
  CONDITION_OPTIONS,
  ACTION_OPTIONS,
  SCENE_OPTIONS,
  MOTION_OPTIONS,
  getConditionDisplayText,
  getActionDisplayText,
  createQuickRule,
  RuleBuilderCore,
} from './RuleBuilder';
export type {
  ConditionOption,
  OperatorOption,
  ActionOption,
  ParamField,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  RuleDraft,
  ConditionDraft,
  ActionDraft,
  ConditionInput,
  ActionInput,
} from './RuleBuilder';

// 规则模板库
export {
  ALL_RULE_TEMPLATES,
  TEMPLATE_GROUPS,
  workTemplates as uiWorkTemplates,
  homeTemplates,
  commuteTemplates as uiCommuteTemplates,
  sleepTemplates as uiSleepTemplates,
  healthTemplates,
  getTemplatesByCategory as getUITemplatesByCategory,
  getRecommendedTemplates as getUIRecommendedTemplates,
  getTemplateById,
  searchTemplatesByTag,
  getTemplatesForScene,
  createRuleFromTemplate,
  createRecommendedRules,
  getCategoryInfo,
} from './RuleTemplates';
export type {
  TemplateCategory,
  RuleTemplate,
  TemplateGroup,
} from './RuleTemplates';

// 自然语言解析器
export {
  NaturalLanguageParser,
  naturalLanguageParser,
  NATURAL_LANGUAGE_TEMPLATES,
} from './NaturalLanguageParser';
export type {
  ParseResult,
  ParsedCondition,
  ParsedAction,
  InputSuggestion,
} from './NaturalLanguageParser';