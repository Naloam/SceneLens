import {
  RuleBuilder,
  conditions,
  actions,
  type ActionInput,
  type ConditionInput,
} from '../../../rules/engine/RuleBuilder';

describe('RuleBuilder', () => {
  let builder: RuleBuilder;

  beforeEach(() => {
    builder = new RuleBuilder();
  });

  it('requires a rule name before build', () => {
    expect(() =>
      builder
        .when({ type: 'scene', operator: 'equals', value: 'OFFICE' })
        .then({ type: 'notification', params: { title: 'Hi', body: 'Body' } })
        .build()
    ).toThrow('Rule name is required');
  });

  it('requires at least one condition and one action', () => {
    expect(() => builder.name('No conditions').build()).toThrow(
      'At least one condition is required'
    );

    expect(() =>
      new RuleBuilder()
        .name('No actions')
        .when({ type: 'scene', operator: 'equals', value: 'HOME' })
        .build()
    ).toThrow('At least one action is required');
  });

  it('builds a complete automation rule', () => {
    const condition: ConditionInput = {
      type: 'time',
      operator: 'between',
      value: ['09:00', '18:00'],
    };
    const action: ActionInput = {
      type: 'system_setting',
      params: { doNotDisturb: 'priority' },
      description: 'Enable focus mode',
    };

    const rule = builder
      .name('Office focus')
      .description('Apply workday focus settings')
      .when({ type: 'scene', operator: 'equals', value: 'OFFICE' })
      .and(condition)
      .then(action)
      .withPriority(8)
      .withCooldown(30)
      .build();

    expect(rule.name).toBe('Office focus');
    expect(rule.conditions).toHaveLength(2);
    expect(rule.actions).toHaveLength(1);
    expect(rule.priority).toBe(8);
    expect(rule.cooldown).toBe(30);
    expect(rule.createdAt).toBeDefined();
  });

  it('clamps priority to the supported range', () => {
    const low = new RuleBuilder()
      .name('Low')
      .when({ type: 'scene', operator: 'equals', value: 'HOME' })
      .then({ type: 'notification', params: { title: 'Low', body: 'Low' } })
      .withPriority(0)
      .build();

    const high = new RuleBuilder()
      .name('High')
      .when({ type: 'scene', operator: 'equals', value: 'HOME' })
      .then({ type: 'notification', params: { title: 'High', body: 'High' } })
      .withPriority(99)
      .build();

    expect(low.priority).toBe(1);
    expect(high.priority).toBe(10);
  });

  it('supports the helper namespaces for conditions and actions', () => {
    const rule = new RuleBuilder()
      .name('Commute helper rule')
      .when(conditions.sceneIs('COMMUTE'))
      .and(conditions.timeBetween('07:00', '09:30'))
      .then(actions.launchApp('com.eg.android.AlipayGphone'))
      .build();

    expect(rule.conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'scene', value: 'COMMUTE' }),
        expect.objectContaining({ type: 'time', value: ['07:00', '09:30'] }),
      ])
    );
    expect(rule.actions[0]).toEqual(
      expect.objectContaining({
        type: 'app_launch',
        params: expect.objectContaining({ packageName: 'com.eg.android.AlipayGphone' }),
      })
    );
  });

  it('rebuilds from an existing rule using RuleBuilder.from', () => {
    const original = new RuleBuilder()
      .name('Original')
      .when({ type: 'scene', operator: 'equals', value: 'HOME' })
      .then({ type: 'notification', params: { title: 'Home', body: 'Arrived' } })
      .build();

    const cloned = RuleBuilder.from(original)
      .description('Updated copy')
      .then({ type: 'log', params: { message: 'cloned' } })
      .build();

    expect(cloned.name).toBe('Original');
    expect(cloned.description).toBe('Updated copy');
    expect(cloned.actions).toHaveLength(2);
    expect(cloned.conditions).toHaveLength(1);
  });
});
