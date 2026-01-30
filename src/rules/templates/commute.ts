/**
 * 通勤场景规则模板
 * 
 * @module rules/templates
 */

import { RuleBuilder, conditions, actions } from '../engine/RuleBuilder';
import type { AutomationRule } from '../../types/automation';

/**
 * 早高峰通勤规则
 * - 触发: 工作日 7:00-9:00，检测到驾驶状态
 * - 动作: 打开导航、开启勿扰模式、设置媒体音量
 */
export const morningCommuteRule = new RuleBuilder('morning_commute')
  .setName('早高峰通勤')
  .setDescription('工作日早高峰自动开启导航和勿扰模式')
  .setPriority(8)
  .setCooldown(60) // 60分钟冷却
  .when(conditions.timeBetween('07:00', '09:00'))
  .and(conditions.dayOfWeekIn([1, 2, 3, 4, 5])) // 周一到周五
  .and(conditions.motionState('DRIVING'))
  .then(actions.setSystemSetting('doNotDisturb', 'priority'))
  .then(actions.setSystemSetting('volume', { media: 60 }))
  .then(actions.showNotification('通勤模式', '已开启勿扰模式，点击打开导航'))
  .build();

/**
 * 晚高峰通勤规则
 */
export const eveningCommuteRule = new RuleBuilder('evening_commute')
  .setName('晚高峰通勤')
  .setDescription('工作日晚高峰自动开启导航')
  .setPriority(8)
  .setCooldown(60)
  .when(conditions.timeBetween('17:00', '20:00'))
  .and(conditions.dayOfWeekIn([1, 2, 3, 4, 5]))
  .and(conditions.motionState('DRIVING'))
  .then(actions.setSystemSetting('doNotDisturb', 'priority'))
  .then(actions.setSystemSetting('volume', { media: 60 }))
  .then(actions.showNotification('通勤模式', '检测到驾驶状态，是否需要导航回家？'))
  .build();

/**
 * 公共交通通勤规则
 */
export const publicTransitRule = new RuleBuilder('public_transit_commute')
  .setName('公共交通通勤')
  .setDescription('乘坐公共交通时的自动设置')
  .setPriority(6)
  .setCooldown(30)
  .when(conditions.sceneIs('commute'))
  .and(conditions.motionState('IN_VEHICLE'))
  .then(actions.setSystemSetting('volume', { media: 30, ring: 10 }))
  .then(actions.setSystemSetting('brightness', 50))
  .build();

/**
 * 步行通勤规则
 */
export const walkingCommuteRule = new RuleBuilder('walking_commute')
  .setName('步行通勤')
  .setDescription('步行时保持适度的通知提醒')
  .setPriority(5)
  .setCooldown(30)
  .when(conditions.sceneIs('commute'))
  .and(conditions.motionState('WALKING'))
  .then(actions.setSystemSetting('volume', { ring: 70 }))
  .build();

/**
 * 到达目的地规则
 */
export const arrivedAtDestinationRule = new RuleBuilder('arrived_destination')
  .setName('到达目的地')
  .setDescription('到达目的地后恢复正常设置')
  .setPriority(7)
  .setCooldown(120)
  .when(conditions.sceneIs('office'))
  .or(conditions.sceneIs('home'))
  .then(actions.setSystemSetting('doNotDisturb', false))
  .then(actions.showNotification('已到达', '已关闭通勤模式'))
  .build();

/**
 * 通勤模板集合
 */
export const commuteTemplates: AutomationRule[] = [
  morningCommuteRule,
  eveningCommuteRule,
  publicTransitRule,
  walkingCommuteRule,
  arrivedAtDestinationRule,
];

/**
 * 创建自定义通勤规则
 * @param options 自定义选项
 */
export function createCustomCommuteRule(options: {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  workDays?: number[];
  enableDND?: boolean;
  enableNavigation?: boolean;
  mediaVolume?: number;
}): AutomationRule {
  const {
    id,
    name,
    startTime,
    endTime,
    workDays = [1, 2, 3, 4, 5],
    enableDND = true,
    enableNavigation = false,
    mediaVolume = 60,
  } = options;

  let builder = new RuleBuilder(id)
    .setName(name)
    .setDescription(`自定义通勤规则: ${startTime} - ${endTime}`)
    .setPriority(7)
    .setCooldown(60)
    .when(conditions.timeBetween(startTime, endTime))
    .and(conditions.dayOfWeekIn(workDays))
    .and(conditions.sceneIs('commute'));

  if (enableDND) {
    builder = builder.then(actions.setSystemSetting('doNotDisturb', 'priority'));
  }

  builder = builder.then(actions.setSystemSetting('volume', { media: mediaVolume }));

  if (enableNavigation) {
    builder = builder.then(actions.launchApp('com.autonavi.minimap')); // 高德地图
  }

  return builder.build();
}

export default commuteTemplates;
