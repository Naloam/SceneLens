import { PersonalizationManager } from '../PersonalizationManager';

const memoryStore = new Map<string, string>();

jest.mock('../../../stores/storageManager', () => ({
  storageManager: {
    getString: jest.fn((key: string) => memoryStore.get(key) ?? ''),
    set: jest.fn((key: string, value: string) => {
      memoryStore.set(key, value);
    }),
    delete: jest.fn((key: string) => {
      memoryStore.delete(key);
    }),
  },
}));

describe('PersonalizationManager online learning', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('boosts successful actions and decays old signals', async () => {
    const manager = new PersonalizationManager();
    await manager.initialize();
    await manager.setOnlineLearningEnabled(true);

    for (let i = 0; i < 3; i++) {
      await manager.recordActionOutcome('COMMUTE', 'actionA', true);
    }

    const boostRecent = (manager as any).getActionLearningBoost('COMMUTE', 'actionA') as number;
    expect(boostRecent).toBeGreaterThan(0);

    const map = (manager as any).actionLearning as Map<string, any>;
    const key = 'COMMUTE:actionA';
    const record = map.get(key);
    const decayedRecent = (manager as any).getDecayedLearningRecord(record) as { attempts: number };
    record.lastUpdated = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days old
    map.set(key, record);
    const decayedAged = (manager as any).getDecayedLearningRecord(record) as { attempts: number };
    expect(decayedAged.attempts).toBeLessThan(decayedRecent.attempts);

    const boostAged = (manager as any).getActionLearningBoost('COMMUTE', 'actionA') as number;
    expect(boostAged).toBeGreaterThanOrEqual(0);
  });

  it('supports disable and clear for online learning data', async () => {
    const manager = new PersonalizationManager();
    await manager.initialize();
    await manager.setOnlineLearningEnabled(false);

    await manager.recordActionOutcome('STUDY', 'focus', true);
    const disabledBoost = (manager as any).getActionLearningBoost('STUDY', 'focus') as number;
    expect(disabledBoost).toBe(0);

    await manager.setOnlineLearningEnabled(true);
    await manager.recordActionOutcome('STUDY', 'focus', true);
    const enabledBoost = (manager as any).getActionLearningBoost('STUDY', 'focus') as number;
    expect(enabledBoost).toBeGreaterThan(0);

    await manager.clearOnlineLearningData();
    const afterClearBoost = (manager as any).getActionLearningBoost('STUDY', 'focus') as number;
    expect(afterClearBoost).toBe(0);
  });
});
