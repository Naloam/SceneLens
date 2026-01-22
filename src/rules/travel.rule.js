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
  ],
  actions: [
    {
      target: 'app',
      intent: 'TRAVEL_APP_TOP1',
      action: 'open_ticket',
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
        body: '祝您旅途愉快',
        mode: 'ONE_TAP',
      },
    },
  ],
};

module.exports = [travelRule];
