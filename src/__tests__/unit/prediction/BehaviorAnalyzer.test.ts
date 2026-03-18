jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BehaviorAnalyzer } from '../../../prediction/BehaviorAnalyzer';
import type { BehaviorPattern } from '../../../prediction/types';
import type { SilentContext } from '../../../types';

const STORAGE_KEYS = {
  patterns: 'behavior_patterns',
  history: 'behavior_history',
  lastAnalysis: 'behavior_last_analysis',
};

function mockStorage(data: Partial<Record<string, string>> = {}): void {
  (AsyncStorage.multiGet as jest.Mock).mockImplementation(async (keys: string[]) =>
    keys.map(key => [key, data[key] ?? null])
  );
  (AsyncStorage.multiSet as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
}

function createEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const date = new Date();

  return {
    timestamp: date.getTime(),
    scene: 'OFFICE',
    app: 'com.dingtalk',
    hour: 9,
    dayOfWeek: 1,
    ...overrides,
  };
}

describe('BehaviorAnalyzer', () => {
  let analyzer: BehaviorAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage();
    analyzer = new BehaviorAnalyzer();
  });

  it('records behavior events and persists them', async () => {
    await analyzer.recordBehavior('HOME', 'com.tencent.mm');

    expect(AsyncStorage.multiSet).toHaveBeenCalled();
    expect(analyzer.getStats().totalEvents).toBe(1);
  });

  it('discovers scene-app patterns from repeated history', async () => {
    const history = Array.from({ length: 10 }, (_, index) =>
      createEvent({
        timestamp: Date.now() - index * 60_000,
        scene: 'OFFICE',
        app: 'com.dingtalk',
        hour: 9,
      })
    );

    mockStorage({
      [STORAGE_KEYS.history]: JSON.stringify(history),
      [STORAGE_KEYS.lastAnalysis]: '0',
    });
    analyzer = new BehaviorAnalyzer();

    const patterns = await analyzer.analyzePatterns();

    expect(
      patterns.some(
        pattern =>
          pattern.relatedScenes?.includes('OFFICE') &&
          pattern.relatedApps?.includes('com.dingtalk')
      )
    ).toBe(true);
  });

  it('discovers app sequence patterns', async () => {
    const history = Array.from({ length: 5 }, (_, index) =>
      createEvent({
        timestamp: Date.now() - index * 120_000,
        scene: 'HOME',
        app: 'com.eg.android.AlipayGphone',
        previousApp: 'com.tencent.mm',
        hour: 20,
      })
    );

    mockStorage({
      [STORAGE_KEYS.history]: JSON.stringify(history),
      [STORAGE_KEYS.lastAnalysis]: '0',
    });
    analyzer = new BehaviorAnalyzer();

    const patterns = await analyzer.analyzePatterns();

    expect(
      patterns.some(pattern =>
        pattern.relatedApps?.includes('com.tencent.mm') &&
        pattern.relatedApps?.includes('com.eg.android.AlipayGphone')
      )
    ).toBe(true);
  });

  it('matches stored patterns against the current context', async () => {
    const patterns: BehaviorPattern[] = [
      {
        id: 'office_app',
        description: 'Open DingTalk in office',
        conditions: [
          { type: 'scene', operator: 'equals', value: 'OFFICE' },
          { type: 'app', operator: 'equals', value: 'com.dingtalk' },
        ],
        frequency: 10,
        lastOccurrence: Date.now(),
        confidence: 0.8,
        relatedApps: ['com.dingtalk'],
        relatedScenes: ['OFFICE'],
      },
    ];

    mockStorage({
      [STORAGE_KEYS.patterns]: JSON.stringify(patterns),
      [STORAGE_KEYS.lastAnalysis]: String(Date.now()),
    });
    analyzer = new BehaviorAnalyzer();
    await analyzer.initialize();

    const context: SilentContext = {
      timestamp: Date.now(),
      context: 'OFFICE',
      confidence: 0.9,
      signals: [],
    };

    const matches = analyzer.matchCurrentPattern(context, 'com.dingtalk');

    expect(matches).toHaveLength(1);
    expect(matches[0].pattern.id).toBe('office_app');
    expect(matches[0].matchScore).toBeGreaterThanOrEqual(0.8);
  });

  it('builds suggestions from patterns that include an action', () => {
    const suggestion = analyzer.generatePatternSuggestion({
      id: 'office_launch',
      description: 'Launch DingTalk at work',
      conditions: [{ type: 'scene', operator: 'equals', value: 'OFFICE' }],
      frequency: 12,
      lastOccurrence: Date.now(),
      confidence: 0.85,
      relatedApps: ['com.dingtalk'],
      relatedScenes: ['OFFICE'],
      suggestedAction: {
        type: 'launch_app',
        payload: { packageName: 'com.dingtalk' },
      },
    });

    expect(suggestion).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        action: expect.objectContaining({
          type: 'launch_app',
        }),
      })
    );
  });

  it('reports aggregate statistics for loaded patterns and history', async () => {
    const history = [createEvent(), createEvent({ timestamp: Date.now() - 60_000 })];
    const patterns: BehaviorPattern[] = [
      {
        id: 'pattern',
        description: 'Office app pattern',
        conditions: [{ type: 'scene', operator: 'equals', value: 'OFFICE' }],
        frequency: 10,
        lastOccurrence: Date.now(),
        confidence: 0.7,
        relatedScenes: ['OFFICE'],
      },
    ];

    mockStorage({
      [STORAGE_KEYS.history]: JSON.stringify(history),
      [STORAGE_KEYS.patterns]: JSON.stringify(patterns),
      [STORAGE_KEYS.lastAnalysis]: String(Date.now()),
    });
    analyzer = new BehaviorAnalyzer();
    await analyzer.initialize();

    expect(analyzer.getStats()).toEqual(
      expect.objectContaining({
        totalPatterns: 1,
        totalEvents: 2,
      })
    );
  });

  it('clears all persisted analyzer data', async () => {
    await analyzer.clearAll();

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      STORAGE_KEYS.patterns,
      STORAGE_KEYS.history,
      STORAGE_KEYS.lastAnalysis,
    ]);
  });
});
