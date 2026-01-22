// 学习场景规则
const studyRule = {
  id: 'RULE_STUDY',
  priority: 'MEDIUM',
  mode: 'ONE_TAP',
  enabled: true,
  conditions: [
    // 修复时间值格式，匹配 SilentContextEngine 生成的格式
    { type: 'time', value: 'NIGHT_WEEKDAY', weight: 0.4 },
    { type: 'time', value: 'NIGHT_WEEKEND', weight: 0.5 },
    { type: 'location', value: 'HOME', weight: 0.4 },
    { type: 'location', value: 'LIBRARY', weight: 0.8 },
    { type: 'motion', value: 'STILL', weight: 0.3 },
  ],
  actions: [
    {
      target: 'system',
      action: 'setDoNotDisturb',
      params: {
        enable: true,
        allowCalls: true,
      },
    },
    {
      target: 'app',
      intent: 'STUDY_APP_TOP1',
      action: 'launch',
    },
    {
      target: 'app',
      intent: 'MUSIC_PLAYER_TOP1',
      action: 'launch_with_playlist',
      params: {
        playlist: 'focus',
      },
    },
    {
      target: 'notification',
      action: 'suggest',
      params: {
        title: '学习模式已准备',
        body: '专注学习时间',
        mode: 'ONE_TAP',
      },
    },
  ],
};

module.exports = [studyRule];
