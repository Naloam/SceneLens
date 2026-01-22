// 到家场景规则
const homeRule = {
  id: 'RULE_HOME',
  priority: 'MEDIUM',
  mode: 'ONE_TAP',
  enabled: true,
  conditions: [
    // 修复时间值格式，匹配 SilentContextEngine 生成的格式
    { type: 'location', value: 'HOME', weight: 0.8 },
    { type: 'wifi', value: 'HOME', weight: 0.9 },
    { type: 'time', value: 'EVENING_RUSH_WEEKDAY', weight: 0.5 },
    { type: 'time', value: 'NIGHT_WEEKDAY', weight: 0.3 },
    { type: 'time', value: 'NIGHT_WEEKEND', weight: 0.4 },
    { type: 'motion', value: 'STILL', weight: 0.2 },
  ],
  actions: [
    {
      target: 'app',
      intent: 'SMART_HOME_TOP1',
      action: 'launch',
    },
    {
      target: 'app',
      intent: 'MUSIC_PLAYER_TOP1',
      action: 'launch_with_playlist',
      params: {
        playlist: 'relax',
      },
    },
    {
      target: 'notification',
      action: 'suggest',
      params: {
        title: '欢迎回家',
        body: '智能家居已就绪',
        mode: 'ONE_TAP',
      },
    },
  ],
};

module.exports = [homeRule];
