/**
 * 快捷操作预设索引
 * 
 * @module quickactions/presets
 */

export {
  paymentPresets,
  wechatPayAction,
  alipayAction,
  alipayScanAction,
  wechatScanAction,
  transitCodeAction,
  healthCodeAction,
  unionPayAction,
} from './payment';

export {
  navigationPresets,
  amapNavigationAction,
  amapHomeNavigationAction,
  amapOfficeNavigationAction,
  baiduMapNavigationAction,
  tencentMapNavigationAction,
  didiTaxiAction,
  trainManagerAction,
  ctripAction,
  helloAction,
  meituanBikeAction,
} from './navigation';

export {
  communicationPresets,
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
} from './communication';

import { paymentPresets } from './payment';
import { navigationPresets } from './navigation';
import { communicationPresets } from './communication';
import type { QuickAction, ActionCategory } from '../../types/automation';

/**
 * 所有预设快捷操作
 */
export const allPresets: QuickAction[] = [
  ...paymentPresets,
  ...navigationPresets,
  ...communicationPresets,
];

/**
 * 按类别获取预设
 */
export function getPresetsByCategory(category: ActionCategory): QuickAction[] {
  switch (category) {
    case 'payment':
      return paymentPresets;
    case 'navigation':
      return navigationPresets;
    case 'communication':
      return communicationPresets;
    default:
      return [];
  }
}

/**
 * 获取新用户推荐的默认预设
 */
export function getDefaultPresets(): QuickAction[] {
  return [
    // 支付相关
    ...paymentPresets.slice(0, 3),
    // 导航相关
    ...navigationPresets.slice(0, 3),
    // 通讯相关
    ...communicationPresets.slice(0, 2),
  ];
}

export default allPresets;
