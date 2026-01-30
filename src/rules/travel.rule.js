// 出行场景规则
const travelRule = {
  id: 'RULE_TRAVEL',
  priority: 'HIGH',
  mode: 'ONE_TAP',
  enabled: true,
  conditions: [
    { type: 'location', value: 'TRAIN_STATION', weight: 0.9 },
    { type: 'location', value: 'AIRPORT', weight: 0.9 },
    { type: 'motion', value: 'VEHICLE', weight: 0.4 },
    { type: 'motion', value: 'WALKING', weight: 0.3 },
    // 新增：日历事件条件 - 出行行程
    { type: 'calendar', value: 'TRAVEL_IMMINENT', weight: 0.9 },
    { type: 'calendar', value: 'TRAVEL_SOON', weight: 0.7 },
    { type: 'calendar', value: 'TRAVEL_UPCOMING', weight: 0.5 },
  ],
  actions: [
    {
      target: 'system',
      action: 'setDoNotDisturb',
      params: {
        enable: true,
        allowCalls: true,
        whitelist: ['emergency_contacts'],
      },
    },
    {
      target: 'app',
      intent: 'TRAVEL_APP_TOP1',
      action: 'open_ticket',
      // 12306 Deep Link
      deepLink: 'cn12306://jump?action=checkticket',
    },
    {
      target: 'app',
      intent: 'TRANSIT_APP_TOP1',
      action: 'open_map',
    },
    {
      target: 'notification',
      action: 'suggest',
      params: {
        title: '出行模式',
        body: '祝您旅途愉快，一键查看行程',
        mode: 'ONE_TAP',
      },
    },
  ],
};

module.exports = [travelRule];
