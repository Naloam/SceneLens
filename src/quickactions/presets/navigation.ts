/**
 * 导航快捷操作预设
 * 
 * @module quickactions/presets
 */

import type { QuickAction } from '../../types/automation';

/**
 * 高德地图导航快捷操作
 */
export const amapNavigationAction: QuickAction = {
  id: 'amap_navigation',
  name: '高德导航',
  description: '打开高德地图开始导航',
  icon: 'navigation',
  category: 'navigation',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.autonavi.minimap',
  },
  contextTriggers: {
    scenes: ['COMMUTE', 'UNKNOWN'],
    timeRanges: [],
  },
  enabled: true,
  priority: 8,
};

/**
 * 高德地图回家导航
 * 注意：使用 route 模式（路线规划）而非 navi 模式（直接导航）
 * 这样即使没有预设地址，也能打开地图让用户选择目的地
 */
export const amapHomeNavigationAction: QuickAction = {
  id: 'amap_home',
  name: '导航回家',
  description: '使用高德地图导航回家（需要在设置中配置家庭地址）',
  icon: 'home',
  category: 'navigation',
  actionType: 'deep_link',
  actionParams: {
    // 使用 shortcutId 引用 AppLaunchController 中的配置
    shortcutId: 'amap_home',
    // 备用直接 URI - 打开高德地图路线规划
    uri: 'androidamap://route?sourceApplication=SceneLens&sname=我的位置&dname=家&dev=0&t=0',
  },
  contextTriggers: {
    scenes: ['UNKNOWN', 'COMMUTE'],
    timeRanges: [
      { start: '17:00', end: '22:00' },
    ],
  },
  enabled: true,
  priority: 9,
};

/**
 * 高德地图去公司导航
 */
export const amapOfficeNavigationAction: QuickAction = {
  id: 'amap_office',
  name: '导航去公司',
  description: '使用高德地图导航去公司（需要在设置中配置公司地址）',
  icon: 'briefcase',
  category: 'navigation',
  actionType: 'deep_link',
  actionParams: {
    shortcutId: 'amap_work',
    uri: 'androidamap://route?sourceApplication=SceneLens&sname=我的位置&dname=公司&dev=0&t=0',
  },
  contextTriggers: {
    scenes: ['HOME', 'UNKNOWN'],
    timeRanges: [
      { start: '07:00', end: '10:00' },
    ],
  },
  enabled: true,
  priority: 9,
};

/**
 * 百度地图导航快捷操作
 */
export const baiduMapNavigationAction: QuickAction = {
  id: 'baidumap_navigation',
  name: '百度导航',
  description: '打开百度地图开始导航',
  icon: 'navigation',
  category: 'navigation',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.baidu.BaiduMap',
  },
  contextTriggers: {
    scenes: ['COMMUTE', 'UNKNOWN'],
    timeRanges: [],
  },
  enabled: true,
  priority: 7,
};

/**
 * 腾讯地图导航快捷操作
 */
export const tencentMapNavigationAction: QuickAction = {
  id: 'qqmap_navigation',
  name: '腾讯导航',
  description: '打开腾讯地图开始导航',
  icon: 'navigation',
  category: 'navigation',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.tencent.map',
  },
  contextTriggers: {
    scenes: ['COMMUTE', 'UNKNOWN'],
    timeRanges: [],
  },
  enabled: true,
  priority: 6,
};

/**
 * 滴滴打车快捷操作
 */
export const didiTaxiAction: QuickAction = {
  id: 'didi_taxi',
  name: '滴滴打车',
  description: '快速打开滴滴打车',
  icon: 'car',
  category: 'navigation',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.sdu.didi.psnger',
  },
  contextTriggers: {
    scenes: ['UNKNOWN', 'COMMUTE'],
    timeRanges: [],
  },
  enabled: true,
  priority: 8,
};

/**
 * 高铁管家快捷操作
 */
export const trainManagerAction: QuickAction = {
  id: 'train_manager',
  name: '高铁管家',
  description: '打开高铁管家查看车票',
  icon: 'train',
  category: 'navigation',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.gtgj.view',
  },
  contextTriggers: {
    scenes: ['COMMUTE', 'TRAVEL'],
    timeRanges: [],
  },
  enabled: true,
  priority: 6,
};

/**
 * 携程旅行快捷操作
 */
export const ctripAction: QuickAction = {
  id: 'ctrip',
  name: '携程旅行',
  description: '打开携程查看行程',
  icon: 'plane',
  category: 'navigation',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'ctrip.android.view',
  },
  contextTriggers: {
    scenes: ['TRAVEL', 'COMMUTE'],
    timeRanges: [],
  },
  enabled: true,
  priority: 5,
};

/**
 * 共享单车（哈啰）快捷操作
 */
export const helloAction: QuickAction = {
  id: 'hellobike',
  name: '哈啰单车',
  description: '打开哈啰出行扫码骑车',
  icon: 'bicycle',
  category: 'navigation',
  actionType: 'deep_link',
  actionParams: {
    shortcutId: 'hellobike_scan',
    uri: 'hellobike://scan',
  },
  contextTriggers: {
    scenes: ['UNKNOWN', 'COMMUTE'],
    timeRanges: [
      { start: '06:00', end: '23:00' },
    ],
  },
  enabled: true,
  priority: 7,
};

/**
 * 共享单车（美团）快捷操作
 */
export const meituanBikeAction: QuickAction = {
  id: 'meituan_bike',
  name: '美团单车',
  description: '打开美团扫码骑车',
  icon: 'bicycle',
  category: 'navigation',
  actionType: 'app_launch',
  actionParams: {
    packageName: 'com.meituan.bike',
  },
  contextTriggers: {
    scenes: ['UNKNOWN', 'COMMUTE'],
    timeRanges: [
      { start: '06:00', end: '23:00' },
    ],
  },
  enabled: true,
  priority: 6,
};

/**
 * 导航快捷操作集合
 */
export const navigationPresets: QuickAction[] = [
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
];

export default navigationPresets;
