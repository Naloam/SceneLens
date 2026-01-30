/**
 * 规则模板索引
 * 
 * 提供预定义的场景规则模板
 * 
 * @module rules/templates
 */

export {
  commuteTemplates,
  morningCommuteRule,
  eveningCommuteRule,
  publicTransitRule,
  walkingCommuteRule,
  arrivedAtDestinationRule,
  createCustomCommuteRule,
} from './commute';

export {
  sleepTemplates,
  bedtimePrepareRule,
  deepSleepRule,
  weekendSleepInRule,
  wakeUpRule,
  napTimeRule,
  chargingSleepRule,
  createCustomSleepRule,
} from './sleep';

export {
  workTemplates,
  workStartRule,
  deepWorkRule,
  lunchTimeRule,
  afternoonWorkRule,
  meetingModeRule,
  workEndRule,
  officeWiFiRule,
  workAppRule,
  createCustomWorkRule,
} from './work';

import { commuteTemplates, morningCommuteRule } from './commute';
import { sleepTemplates, deepSleepRule, wakeUpRule } from './sleep';
import { workTemplates, workStartRule, workEndRule, meetingModeRule } from './work';
import type { AutomationRule } from '../../types/automation';

/**
 * 所有预定义模板
 */
export const allTemplates: AutomationRule[] = [
  ...commuteTemplates,
  ...sleepTemplates,
  ...workTemplates,
];

/**
 * 按类别获取模板
 */
export function getTemplatesByCategory(category: 'commute' | 'sleep' | 'work'): AutomationRule[] {
  switch (category) {
    case 'commute':
      return commuteTemplates;
    case 'sleep':
      return sleepTemplates;
    case 'work':
      return workTemplates;
    default:
      return [];
  }
}

/**
 * 获取推荐的初始模板
 * 返回一组适合新用户的基础规则
 */
export function getRecommendedTemplates(): AutomationRule[] {
  return [
    // 基础睡眠规则
    deepSleepRule,
    wakeUpRule,
    // 基础工作规则
    workStartRule,
    workEndRule,
    meetingModeRule,
    // 基础通勤规则
    morningCommuteRule,
  ];
}

export default allTemplates;
