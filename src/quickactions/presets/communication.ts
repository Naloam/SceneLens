/**
 * 通讯快捷操作预设
 * 
 * @module quickactions/presets
 */

import type { QuickAction } from '../../types/automation';

/**
 * 微信快捷操作
 */
export const wechatAction: QuickAction = {
  id: 'wechat',
  name: '微信',
  description: '打开微信',
  icon: 'message-circle',
  category: 'communication',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.tencent.mm',
  },
  contextTriggers: {
    scenes: ['HOME', 'OFFICE', 'COMMUTE'],
    timeRanges: [],
  },
  enabled: true,
  priority: 8,
};

/**
 * 微信发消息快捷操作
 */
export const wechatMessageAction: QuickAction = {
  id: 'wechat_message',
  name: '微信消息',
  description: '快速发送微信消息',
  icon: 'message-square',
  category: 'communication',
  actionType: 'deep_link',
  actionParams: {
    uri: 'weixin://',
  },
  contextTriggers: {
    scenes: ['HOME', 'OFFICE'],
    timeRanges: [],
  },
  enabled: true,
  priority: 7,
};

/**
 * QQ 快捷操作
 */
export const qqAction: QuickAction = {
  id: 'qq',
  name: 'QQ',
  description: '打开 QQ',
  icon: 'message-circle',
  category: 'communication',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.tencent.mobileqq',
  },
  contextTriggers: {
    scenes: ['HOME', 'OFFICE'],
    timeRanges: [],
  },
  enabled: true,
  priority: 6,
};

/**
 * 钉钉快捷操作
 */
export const dingtalkAction: QuickAction = {
  id: 'dingtalk',
  name: '钉钉',
  description: '打开钉钉',
  icon: 'briefcase',
  category: 'communication',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.alibaba.android.rimet',
  },
  contextTriggers: {
    scenes: ['OFFICE'],
    timeRanges: [
      { start: '08:00', end: '20:00' },
    ],
  },
  enabled: true,
  priority: 8,
};

/**
 * 企业微信快捷操作
 */
export const weworkAction: QuickAction = {
  id: 'wework',
  name: '企业微信',
  description: '打开企业微信',
  icon: 'briefcase',
  category: 'communication',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.tencent.wework',
  },
  contextTriggers: {
    scenes: ['OFFICE'],
    timeRanges: [
      { start: '08:00', end: '20:00' },
    ],
  },
  enabled: true,
  priority: 8,
};

/**
 * 飞书快捷操作
 */
export const larkAction: QuickAction = {
  id: 'lark',
  name: '飞书',
  description: '打开飞书',
  icon: 'briefcase',
  category: 'communication',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.ss.android.lark',
  },
  contextTriggers: {
    scenes: ['OFFICE'],
    timeRanges: [
      { start: '08:00', end: '20:00' },
    ],
  },
  enabled: true,
  priority: 7,
};

/**
 * 电话拨号快捷操作
 */
export const phoneDialerAction: QuickAction = {
  id: 'phone_dialer',
  name: '拨打电话',
  description: '打开电话拨号盘',
  icon: 'phone',
  category: 'communication',
  actionType: 'deep_link',
  actionParams: {
    uri: 'tel:',
  },
  contextTriggers: {
    scenes: ['HOME', 'OFFICE', 'UNKNOWN'],
    timeRanges: [],
  },
  enabled: true,
  priority: 9,
};

/**
 * 短信快捷操作
 */
export const smsAction: QuickAction = {
  id: 'sms',
  name: '发短信',
  description: '打开短信应用',
  icon: 'message-square',
  category: 'communication',
  actionType: 'deep_link',
  actionParams: {
    uri: 'sms:',
  },
  contextTriggers: {
    scenes: ['HOME', 'OFFICE'],
    timeRanges: [],
  },
  enabled: true,
  priority: 6,
};

/**
 * 邮箱快捷操作
 */
export const emailAction: QuickAction = {
  id: 'email',
  name: '邮箱',
  description: '打开邮箱应用',
  icon: 'mail',
  category: 'communication',
  actionType: 'deep_link',
  actionParams: {
    uri: 'mailto:',
  },
  contextTriggers: {
    scenes: ['OFFICE'],
    timeRanges: [
      { start: '08:00', end: '20:00' },
    ],
  },
  enabled: true,
  priority: 5,
};

/**
 * Telegram 快捷操作
 */
export const telegramAction: QuickAction = {
  id: 'telegram',
  name: 'Telegram',
  description: '打开 Telegram',
  icon: 'send',
  category: 'communication',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'org.telegram.messenger',
  },
  contextTriggers: {
    scenes: ['HOME'],
    timeRanges: [],
  },
  enabled: true,
  priority: 5,
};

/**
 * WhatsApp 快捷操作
 */
export const whatsappAction: QuickAction = {
  id: 'whatsapp',
  name: 'WhatsApp',
  description: '打开 WhatsApp',
  icon: 'message-circle',
  category: 'communication',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.whatsapp',
  },
  contextTriggers: {
    scenes: ['HOME'],
    timeRanges: [],
  },
  enabled: true,
  priority: 5,
};

/**
 * 通讯快捷操作集合
 */
export const communicationPresets: QuickAction[] = [
  wechatAction,
  wechatMessageAction,
  qqAction,
  dingtalkAction,
  weworkAction,
  larkAction,
  phoneDialerAction,
  smsAction,
  emailAction,
  telegramAction,
  whatsappAction,
];

export default communicationPresets;
