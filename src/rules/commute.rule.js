// 通勤场景规则
const commuteRule = {
  id: 'RULE_COMMUTE',
  priority: 'HIGH',
  mode: 'ONE_TAP',
  enabled: true,
  conditions: [
    { type: 'time', value: 'MORNING_RUSH_WEEKDAY', weight: 0.6 },
    { type: 'time', value: 'EVENING_RUSH_WEEKDAY', weight: 0.6 },
    { type: 'motion', value: 'WALKING', weight: 0.4 },
    { type: 'motion', value: 'VEHICLE', weight: 0.5 },
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
      intent: 'TRANSIT_APP_TOP1',
      action: 'open_ticket_qr',
      deepLink: 'alipays://platformapi/startapp?appId=200011235',
    },
    {
      target: 'app',
      intent: 'MUSIC_PLAYER_TOP1',
      action: 'launch_with_playlist',
      params: {
        playlist: 'commute',
      },
    },
    {
      target: 'notification',
      action: 'suggest',
      params: {
        title: '通勤模式已准备',
        body: '一键打开乘车码和音乐',
        mode: 'ONE_TAP',
      },
    },
  ],
};

module.exports = [commuteRule];
