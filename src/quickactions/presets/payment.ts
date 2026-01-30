/**
 * 支付快捷操作预设
 * 
 * @module quickactions/presets
 */

import type { QuickAction } from '../../types/automation';

/**
 * 微信支付快捷操作
 */
export const wechatPayAction: QuickAction = {
  id: 'wechat_pay',
  name: '微信支付',
  description: '快速打开微信付款码',
  icon: 'credit-card',
  category: 'payment',
  actionType: 'deep_link',
  actionParams: {
    shortcutId: 'wechat_pay',
    uri: 'weixin://scanqrcode',
  },
  contextTriggers: {
    scenes: ['UNKNOWN'],
    timeRanges: [
      { start: '07:00', end: '22:00' },
    ],
  },
  enabled: true,
  priority: 9,
};

/**
 * 支付宝支付快捷操作
 */
export const alipayAction: QuickAction = {
  id: 'alipay_pay',
  name: '支付宝支付',
  description: '快速打开支付宝付款码',
  icon: 'credit-card',
  category: 'payment',
  actionType: 'deep_link',
  actionParams: {
    shortcutId: 'alipay_pay',
    uri: 'alipays://platformapi/startapp?appId=20000056',
  },
  contextTriggers: {
    scenes: ['UNKNOWN'],
    timeRanges: [
      { start: '07:00', end: '22:00' },
    ],
  },
  enabled: true,
  priority: 9,
};

/**
 * 支付宝扫码快捷操作
 */
export const alipayScanAction: QuickAction = {
  id: 'alipay_scan',
  name: '支付宝扫码',
  description: '快速打开支付宝扫一扫',
  icon: 'qrcode',
  category: 'payment',
  actionType: 'deep_link',
  actionParams: {
    shortcutId: 'alipay_scan',
    uri: 'alipays://platformapi/startapp?appId=10000007',
  },
  contextTriggers: {
    scenes: ['UNKNOWN'],
    timeRanges: [
      { start: '07:00', end: '22:00' },
    ],
  },
  enabled: true,
  priority: 8,
};

/**
 * 微信扫码快捷操作
 */
export const wechatScanAction: QuickAction = {
  id: 'wechat_scan',
  name: '微信扫码',
  description: '快速打开微信扫一扫',
  icon: 'qrcode',
  category: 'payment',
  actionType: 'deep_link',
  actionParams: {
    shortcutId: 'wechat_scan',
    uri: 'weixin://scanqrcode',
  },
  contextTriggers: {
    scenes: ['UNKNOWN'],
    timeRanges: [
      { start: '07:00', end: '22:00' },
    ],
  },
  enabled: true,
  priority: 8,
};

/**
 * 乘车码快捷操作（支付宝）
 */
export const transitCodeAction: QuickAction = {
  id: 'transit_code',
  name: '乘车码',
  description: '快速打开支付宝乘车码',
  icon: 'bus',
  category: 'payment',
  actionType: 'deep_link',
  actionParams: {
    shortcutId: 'alipay_transit',
    uri: 'alipays://platformapi/startapp?appId=200011235',
  },
  contextTriggers: {
    scenes: ['COMMUTE', 'UNKNOWN'],
    timeRanges: [
      { start: '06:00', end: '23:00' },
    ],
  },
  enabled: true,
  priority: 9,
};

/**
 * 健康码快捷操作
 */
export const healthCodeAction: QuickAction = {
  id: 'health_code',
  name: '健康码',
  description: '快速打开支付宝健康码',
  icon: 'shield',
  category: 'payment',
  actionType: 'deep_link',
  actionParams: {
    shortcutId: 'alipay_health',
    uri: 'alipays://platformapi/startapp?appId=2021001107664144',
  },
  contextTriggers: {
    scenes: ['COMMUTE', 'UNKNOWN'],
    timeRanges: [],
  },
  enabled: true,
  priority: 7,
};

/**
 * 银联云闪付快捷操作
 */
export const unionPayAction: QuickAction = {
  id: 'unionpay',
  name: '云闪付',
  description: '快速打开银联云闪付',
  icon: 'credit-card',
  category: 'payment',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.unionpay',
  },
  contextTriggers: {
    scenes: ['UNKNOWN'],
    timeRanges: [
      { start: '07:00', end: '22:00' },
    ],
  },
  enabled: true,
  priority: 6,
};

/**
 * 支付快捷操作集合
 */
export const paymentPresets: QuickAction[] = [
  wechatPayAction,
  alipayAction,
  alipayScanAction,
  wechatScanAction,
  transitCodeAction,
  healthCodeAction,
  unionPayAction,
];

export default paymentPresets;
