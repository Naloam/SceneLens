// 睡眠场景规则
const sleepRule = {
  id: 'RULE_SLEEP',
  priority: 'HIGH',
  mode: 'AUTO',
  enabled: true,
  conditions: [
    { type: 'time', value: 'LATE_NIGHT', weight: 0.9 },
    { type: 'location', value: 'HOME', weight: 0.5 },
    { type: 'motion', value: 'STILL', weight: 0.3 },
  ],
  actions: [
    {
      target: 'system',
      action: 'setDoNotDisturb',
      params: {
        enable: true,
        allowCalls: false,
        whitelist: ['emergency_contacts'],
      },
    },
    {
      target: 'system',
      action: 'setBrightness',
      params: {
        level: 0.1,
      },
    },
    {
      target: 'notification',
      action: 'suggest',
      params: {
        title: '晚安',
        body: '已开启睡眠模式',
        mode: 'AUTO',
      },
    },
  ],
};

module.exports = [sleepRule];
