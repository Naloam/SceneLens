/**
 * 工作场景规则模板
 * 
 * @module rules/templates
 */

import { RuleBuilder, conditions, actions } from '../engine/RuleBuilder';
import type { AutomationRule } from '../../types/automation';

/**
 * 工作开始规则
 * - 触发: 工作日 9:00-10:00，到达办公室
 * - 动作: 静音、开启工作模式
 */
export const workStartRule = new RuleBuilder('work_start')
  .setName('工作开始')
  .setDescription('到达办公室自动开启工作模式')
  .setPriority(8)
  .setCooldown(120)
  .when(conditions.timeBetween('09:00', '10:00'))
  .and(conditions.dayOfWeekIn([1, 2, 3, 4, 5]))
  .and(conditions.sceneIs('office'))
  .then(actions.setSystemSetting('volume', { ring: 10, notification: 20, media: 30 }))
  .then(actions.setSystemSetting('doNotDisturb', 'priority'))
  .then(actions.showNotification('工作模式', '已开启工作模式，专注工作'))
  .build();

/**
 * 深度工作规则
 * - 触发: 工作日上午，办公室场景
 * - 动作: 完全勿扰，最小化干扰
 */
export const deepWorkRule = new RuleBuilder('deep_work')
  .setName('深度工作')
  .setDescription('上午集中精力工作时最小化干扰')
  .setPriority(7)
  .setCooldown(60)
  .when(conditions.timeBetween('10:00', '12:00'))
  .and(conditions.dayOfWeekIn([1, 2, 3, 4, 5]))
  .and(conditions.sceneIs('office'))
  .then(actions.setSystemSetting('doNotDisturb', 'priority'))
  .then(actions.setSystemSetting('volume', { ring: 0, notification: 10 }))
  .build();

/**
 * 午餐时间规则
 */
export const lunchTimeRule = new RuleBuilder('lunch_time')
  .setName('午餐时间')
  .setDescription('午餐时间放松设置')
  .setPriority(6)
  .setCooldown(60)
  .when(conditions.timeBetween('11:30', '13:30'))
  .and(conditions.dayOfWeekIn([1, 2, 3, 4, 5]))
  .then(actions.setSystemSetting('doNotDisturb', false))
  .then(actions.setSystemSetting('volume', { ring: 50, notification: 40 }))
  .build();

/**
 * 下午工作规则
 */
export const afternoonWorkRule = new RuleBuilder('afternoon_work')
  .setName('下午工作')
  .setDescription('下午工作时段设置')
  .setPriority(6)
  .setCooldown(120)
  .when(conditions.timeBetween('14:00', '18:00'))
  .and(conditions.dayOfWeekIn([1, 2, 3, 4, 5]))
  .and(conditions.sceneIs('office'))
  .then(actions.setSystemSetting('volume', { ring: 20, notification: 30 }))
  .then(actions.setSystemSetting('brightness', 60))
  .build();

/**
 * 会议模式规则
 */
export const meetingModeRule = new RuleBuilder('meeting_mode')
  .setName('会议模式')
  .setDescription('会议期间完全静音')
  .setPriority(9)
  .setCooldown(30)
  .when(conditions.sceneIs('meeting'))
  .then(actions.setSystemSetting('doNotDisturb', 'none'))
  .then(actions.setSystemSetting('volume', { ring: 0, notification: 0, media: 0 }))
  .then(actions.showNotification('会议模式', '已开启会议模式，所有通知已静音'))
  .build();

/**
 * 下班规则
 */
export const workEndRule = new RuleBuilder('work_end')
  .setName('下班')
  .setDescription('下班后恢复正常设置')
  .setPriority(7)
  .setCooldown(60)
  .when(conditions.timeBetween('18:00', '19:00'))
  .and(conditions.dayOfWeekIn([1, 2, 3, 4, 5]))
  .then(actions.setSystemSetting('doNotDisturb', false))
  .then(actions.setSystemSetting('volume', { ring: 70, notification: 60, media: 50 }))
  .then(actions.showNotification('下班时间', '辛苦一天了！工作模式已关闭'))
  .build();

/**
 * 办公室 WiFi 连接规则
 */
export const officeWiFiRule = new RuleBuilder('office_wifi')
  .setName('办公室 WiFi')
  .setDescription('连接办公室 WiFi 时自动进入工作模式')
  .setPriority(8)
  .setCooldown(60)
  .when(conditions.wifiConnected('Office-WiFi')) // 需要用户配置
  .and(conditions.dayOfWeekIn([1, 2, 3, 4, 5]))
  .then(actions.setSystemSetting('volume', { ring: 10 }))
  .then(actions.setSystemSetting('doNotDisturb', 'priority'))
  .build();

/**
 * 工作应用规则
 * 当打开工作相关应用时自动调整
 */
export const workAppRule = new RuleBuilder('work_app')
  .setName('工作应用')
  .setDescription('使用工作应用时减少干扰')
  .setPriority(6)
  .setCooldown(15)
  .when(conditions.appInForeground('com.tencent.wework')) // 企业微信
  .or(conditions.appInForeground('com.alibaba.android.rimet')) // 钉钉
  .or(conditions.appInForeground('com.microsoft.teams'))
  .then(actions.setSystemSetting('doNotDisturb', 'priority'))
  .build();

/**
 * 工作模板集合
 */
export const workTemplates: AutomationRule[] = [
  workStartRule,
  deepWorkRule,
  lunchTimeRule,
  afternoonWorkRule,
  meetingModeRule,
  workEndRule,
  officeWiFiRule,
  workAppRule,
];

/**
 * 创建自定义工作规则
 */
export function createCustomWorkRule(options: {
  id: string;
  name: string;
  workStartTime: string;
  workEndTime: string;
  workDays?: number[];
  officeWiFi?: string;
  enableDND?: boolean;
  silentRing?: boolean;
}): AutomationRule[] {
  const {
    id,
    name,
    workStartTime,
    workEndTime,
    workDays = [1, 2, 3, 4, 5],
    officeWiFi,
    enableDND = true,
    silentRing = true,
  } = options;

  const rules: AutomationRule[] = [];

  // 工作开始规则
  rules.push(
    new RuleBuilder(`${id}_start`)
      .setName(`${name} - 开始`)
      .setDescription(`工作时间开始: ${workStartTime}`)
      .setPriority(8)
      .setCooldown(120)
      .when(conditions.timeBetween(workStartTime, addMinutes(workStartTime, 60)))
      .and(conditions.dayOfWeekIn(workDays))
      .then(actions.setSystemSetting('volume', { ring: silentRing ? 10 : 50 }))
      .then(actions.setSystemSetting('doNotDisturb', enableDND ? 'priority' : false))
      .build()
  );

  // 工作结束规则
  rules.push(
    new RuleBuilder(`${id}_end`)
      .setName(`${name} - 结束`)
      .setDescription(`工作时间结束: ${workEndTime}`)
      .setPriority(7)
      .setCooldown(60)
      .when(conditions.timeBetween(workEndTime, addMinutes(workEndTime, 60)))
      .and(conditions.dayOfWeekIn(workDays))
      .then(actions.setSystemSetting('doNotDisturb', false))
      .then(actions.setSystemSetting('volume', { ring: 70 }))
      .build()
  );

  // WiFi 规则
  if (officeWiFi) {
    rules.push(
      new RuleBuilder(`${id}_wifi`)
        .setName(`${name} - WiFi`)
        .setDescription(`连接 ${officeWiFi} 时启用工作模式`)
        .setPriority(8)
        .setCooldown(60)
        .when(conditions.wifiConnected(officeWiFi))
        .and(conditions.dayOfWeekIn(workDays))
        .then(actions.setSystemSetting('volume', { ring: silentRing ? 10 : 50 }))
        .build()
    );
  }

  return rules;
}

/**
 * 辅助函数：给时间加分钟
 */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  let newMinutes = m + minutes;
  let newHour = h;
  
  while (newMinutes >= 60) {
    newMinutes -= 60;
    newHour++;
  }
  if (newHour >= 24) newHour -= 24;
  
  return `${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

export default workTemplates;
