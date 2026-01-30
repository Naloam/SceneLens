/**
 * Reflection 模块导出
 * 
 * 反思层：负责记录用户反馈并动态调整规则权重
 */

export { 
  FeedbackLogger, 
  feedbackLogger,
  type FeedbackRecord,
  type FeedbackStats,
  type FeedbackPattern,
} from './FeedbackLogger';

export { 
  WeightAdjuster, 
  weightAdjuster,
  type WeightConfig,
  type WeightAdjustmentRecord,
  type AdjustmentRecommendation,
} from './WeightAdjuster';
