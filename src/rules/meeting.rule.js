// 会议场景规则
const meetingRule = {
  id: 'RULE_MEETING',
  priority: 'HIGH',
  mode: 'ONE_TAP',
  enabled: true,
  conditions: [
    // 修复时间值格式，匹配 SilentContextEngine 生成的格式
    { type: 'time', value: 'MORNING_WEEKDAY', weight: 0.5 },
    { type: 'time', value: 'AFTERNOON_WEEKDAY', weight: 0.5 },
    { type: 'time', value: 'LUNCH_WEEKDAY', weight: 0.3 },
    { type: 'location', value: 'OFFICE', weight: 0.7 },
    { type: 'motion', value: 'STILL', weight: 0.3 },
  ],
  actions: [
    {
      target: 'system',
      action: 'setDoNotDisturb',
      params: {
        enable: true,
        allowCalls: false,
      },
    },
    {
      target: 'app',
      intent: 'MEETING_APP_TOP1',
      action: 'launch',
      params: {
        meeting: 'next',
      },
    },
    {
      target: 'app',
      intent: 'CALENDAR_TOP1',
      action: 'open_events',
    },
    {
      target: 'notification',
      action: 'suggest',
      params: {
        title: '会议模式已准备',
        body: '即将开始的会议已准备好',
        mode: 'ONE_TAP',
      },
    },
  ],
};

module.exports = [meetingRule];
