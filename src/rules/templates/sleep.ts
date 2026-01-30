/**
 * 睡眠场景规则模板
 * 
 * @module rules/templates
 */

import { RuleBuilder, conditions, actions } from '../engine/RuleBuilder';
import type { AutomationRule } from '../../types/automation';

/**
 * 睡前准备规则
 * - 触发: 晚上22:00-23:00，手机静止
 * - 动作: 降低亮度、开启夜间模式、减少音量
 */
export const bedtimePrepareRule = new RuleBuilder('bedtime_prepare')
  .setName('睡前准备')
  .setDescription('睡前自动降低亮度和音量')
  .setPriority(7)
  .setCooldown(120)
  .when(conditions.timeBetween('22:00', '23:00'))
  .and(conditions.motionState('STILL'))
  .then(actions.setSystemSetting('brightness', 20))
  .then(actions.setSystemSetting('volume', { ring: 20, media: 10 }))
  .then(actions.showNotification('睡前模式', '已降低亮度和音量，准备休息'))
  .build();

/**
 * 深度睡眠规则
 * - 触发: 凌晨0:00-6:00
 * - 动作: 开启完全勿扰、最低亮度
 */
export const deepSleepRule = new RuleBuilder('deep_sleep')
  .setName('深度睡眠')
  .setDescription('深夜自动开启勿扰模式')
  .setPriority(9)
  .setCooldown(360) // 6小时冷却
  .when(conditions.timeBetween('00:00', '06:00'))
  .then(actions.setSystemSetting('doNotDisturb', 'alarms')) // 只允许闹钟
  .then(actions.setSystemSetting('brightness', 5))
  .then(actions.setSystemSetting('volume', { ring: 0, notification: 0, media: 0 }))
  .build();

/**
 * 周末睡懒觉规则
 */
export const weekendSleepInRule = new RuleBuilder('weekend_sleep_in')
  .setName('周末睡懒觉')
  .setDescription('周末早上延长勿扰时间')
  .setPriority(8)
  .setCooldown(360)
  .when(conditions.timeBetween('06:00', '09:00'))
  .and(conditions.dayOfWeekIn([0, 6])) // 周六周日
  .and(conditions.motionState('STILL'))
  .then(actions.setSystemSetting('doNotDisturb', 'alarms'))
  .then(actions.setSystemSetting('brightness', 10))
  .build();

/**
 * 起床规则
 * - 触发: 早上6:00-8:00，检测到活动
 * - 动作: 恢复正常设置
 */
export const wakeUpRule = new RuleBuilder('wake_up')
  .setName('起床恢复')
  .setDescription('起床后恢复正常设置')
  .setPriority(8)
  .setCooldown(60)
  .when(conditions.timeBetween('06:00', '08:00'))
  .and(conditions.dayOfWeekIn([1, 2, 3, 4, 5]))
  .and(conditions.motionState('WALKING'))
  .then(actions.setSystemSetting('doNotDisturb', false))
  .then(actions.setSystemSetting('brightness', 50))
  .then(actions.setSystemSetting('volume', { ring: 70, notification: 60 }))
  .then(actions.showNotification('早安', '勿扰模式已关闭，祝您愉快的一天！'))
  .build();

/**
 * 午休规则
 */
export const napTimeRule = new RuleBuilder('nap_time')
  .setName('午休模式')
  .setDescription('午休时间降低打扰')
  .setPriority(6)
  .setCooldown(60)
  .when(conditions.timeBetween('12:00', '14:00'))
  .and(conditions.motionState('STILL'))
  .then(actions.setSystemSetting('doNotDisturb', 'priority'))
  .then(actions.setSystemSetting('volume', { ring: 30 }))
  .build();

/**
 * 充电睡眠规则
 */
export const chargingSleepRule = new RuleBuilder('charging_sleep')
  .setName('充电睡眠')
  .setDescription('夜间充电时优化设置')
  .setPriority(5)
  .setCooldown(480)
  .when(conditions.timeBetween('22:00', '06:00'))
  .and(conditions.batteryCharging(true))
  .then(actions.setSystemSetting('screenTimeout', 15000)) // 15秒
  .build();

/**
 * 睡眠模板集合
 */
export const sleepTemplates: AutomationRule[] = [
  bedtimePrepareRule,
  deepSleepRule,
  weekendSleepInRule,
  wakeUpRule,
  napTimeRule,
  chargingSleepRule,
];

/**
 * 创建自定义睡眠规则
 */
export function createCustomSleepRule(options: {
  id: string;
  name: string;
  bedtime: string;
  wakeTime: string;
  dndMode?: 'priority' | 'alarms' | 'none';
  brightness?: number;
  allowWeekendSleepIn?: boolean;
}): AutomationRule[] {
  const {
    id,
    name,
    bedtime,
    wakeTime,
    dndMode = 'alarms',
    brightness = 10,
    allowWeekendSleepIn = true,
  } = options;

  const rules: AutomationRule[] = [];

  // 睡眠规则
  rules.push(
    new RuleBuilder(`${id}_sleep`)
      .setName(`${name} - 睡眠`)
      .setDescription(`自定义睡眠规则: ${bedtime} 开始`)
      .setPriority(8)
      .setCooldown(360)
      .when(conditions.timeBetween(bedtime, wakeTime))
      .then(actions.setSystemSetting('doNotDisturb', dndMode))
      .then(actions.setSystemSetting('brightness', brightness))
      .build()
  );

  // 起床规则
  rules.push(
    new RuleBuilder(`${id}_wake`)
      .setName(`${name} - 起床`)
      .setDescription(`自定义起床规则: ${wakeTime}`)
      .setPriority(8)
      .setCooldown(60)
      .when(conditions.timeBetween(wakeTime, addHours(wakeTime, 1)))
      .and(conditions.dayOfWeekIn([1, 2, 3, 4, 5]))
      .then(actions.setSystemSetting('doNotDisturb', false))
      .then(actions.setSystemSetting('brightness', 50))
      .build()
  );

  // 周末延长
  if (allowWeekendSleepIn) {
    rules.push(
      new RuleBuilder(`${id}_weekend`)
        .setName(`${name} - 周末`)
        .setDescription('周末延长睡眠时间')
        .setPriority(7)
        .setCooldown(360)
        .when(conditions.dayOfWeekIn([0, 6]))
        .and(conditions.timeBetween(wakeTime, addHours(wakeTime, 2)))
        .then(actions.setSystemSetting('doNotDisturb', dndMode))
        .build()
    );
  }

  return rules;
}

/**
 * 辅助函数：给时间加小时
 */
function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  let newHour = h + hours;
  if (newHour >= 24) newHour -= 24;
  return `${String(newHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default sleepTemplates;
