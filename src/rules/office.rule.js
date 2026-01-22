// 办公场景规则
const officeRule = {
  id: 'RULE_OFFICE',
  priority: 'HIGH',
  mode: 'SUGGEST_ONLY',
  enabled: true,
  conditions: [
    // 匹配 SilentContextEngine 生成的时间值格式
    { type: 'time', value: 'MORNING_WEEKDAY', weight: 0.5 },
    { type: 'time', value: 'AFTERNOON_WEEKDAY', weight: 0.5 },
    { type: 'time', value: 'LUNCH_WEEKDAY', weight: 0.3 },
    { type: 'location', value: 'OFFICE', weight: 0.7 },
    { type: 'motion', value: 'STILL', weight: 0.3 },
  ],
  actions: [
    {
      target: 'notification',
      action: 'suggest',
      params: {
        title: '办公场景',
        body: '检测到办公环境，是否需要专注模式？',
        mode: 'SUGGEST_ONLY',
      },
    },
    {
      target: 'app',
      intent: 'CALENDAR_TOP1',
      action: 'open_events',
    },
  ],
};

module.exports = [officeRule];
