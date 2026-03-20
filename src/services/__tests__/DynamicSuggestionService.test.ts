import { DynamicSuggestionService } from '../DynamicSuggestionService';

const APP_USAGE_HISTORY_KEY = 'app_usage_history';

type MockDependencies = ConstructorParameters<typeof DynamicSuggestionService>[0] & {
  feedbackLogger: {
    initialize: jest.Mock<Promise<void>, []>;
    getStats: jest.Mock<null, [string]>;
  };
  weightAdjuster: {
    initialize: jest.Mock<Promise<void>, []>;
    getWeight: jest.Mock<number, [string]>;
  };
  storage: {
    getString: jest.Mock<string | undefined, [string]>;
    set: jest.Mock<void, [string, string]>;
  };
  logger: {
    log: jest.Mock<void, [string]>;
    warn: jest.Mock<void, [string, unknown]>;
    error: jest.Mock<void, [string, unknown]>;
  };
};

function createDependencies(
  initialStore: Record<string, string> = {}
): MockDependencies {
  const store = new Map<string, string>(Object.entries(initialStore));

  return {
    feedbackLogger: {
      initialize: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue(null),
    },
    weightAdjuster: {
      initialize: jest.fn().mockResolvedValue(undefined),
      getWeight: jest.fn().mockReturnValue(1),
    },
    storage: {
      getString: jest.fn((key: string) => store.get(key)),
      set: jest.fn((key: string, value: string) => {
        store.set(key, value);
      }),
    },
    logger: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
}

describe('DynamicSuggestionService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 17, 9, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deduplicates concurrent initialize calls', async () => {
    let resolveFeedbackInit!: () => void;
    const feedbackInitPromise = new Promise<void>((resolve) => {
      resolveFeedbackInit = resolve;
    });
    const deps = createDependencies();
    deps.feedbackLogger.initialize.mockReturnValue(feedbackInitPromise);

    const service = new DynamicSuggestionService(deps);
    const initialize1 = service.initialize();
    const initialize2 = service.initialize();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.feedbackLogger.initialize).toHaveBeenCalledTimes(1);
    expect(deps.weightAdjuster.initialize).toHaveBeenCalledTimes(0);

    resolveFeedbackInit();
    await Promise.all([initialize1, initialize2]);

    expect(deps.feedbackLogger.initialize).toHaveBeenCalledTimes(1);
    expect(deps.weightAdjuster.initialize).toHaveBeenCalledTimes(1);
    expect(deps.logger.log).toHaveBeenCalledWith('[DynamicSuggestionService] initialize complete');
  });

  it('loads persisted app usage before recording new usage', async () => {
    const deps = createDependencies({
      [APP_USAGE_HISTORY_KEY]: JSON.stringify([
        [
          'TRANSIT_APP_TOP1',
          {
            packageName: 'com.eg.android.AlipayGphone',
            intentType: 'TRANSIT_APP_TOP1',
            usageCount: 2,
            lastUsed: 100,
            hourlyDistribution: { 9: 2 },
          },
        ],
        [
          'MUSIC_PLAYER_TOP1',
          {
            packageName: 'com.netease.cloudmusic',
            intentType: 'MUSIC_PLAYER_TOP1',
            usageCount: 1,
            lastUsed: 50,
            hourlyDistribution: { 9: 1 },
          },
        ],
      ]),
    });
    const service = new DynamicSuggestionService(deps);

    await service.recordAppUsage('TRANSIT_APP_TOP1', 'com.eg.android.AlipayGphone');

    expect(deps.feedbackLogger.initialize).toHaveBeenCalledTimes(0);
    expect(deps.weightAdjuster.initialize).toHaveBeenCalledTimes(0);
    expect(deps.storage.set).toHaveBeenCalledTimes(1);

    const savedPayload = deps.storage.set.mock.calls[0][1];
    const savedEntries = new Map<string, any>(JSON.parse(savedPayload));

    expect(savedEntries.get('TRANSIT_APP_TOP1')).toMatchObject({
      packageName: 'com.eg.android.AlipayGphone',
      intentType: 'TRANSIT_APP_TOP1',
      usageCount: 3,
    });
    expect(savedEntries.get('TRANSIT_APP_TOP1').hourlyDistribution[9]).toBe(3);
    expect(savedEntries.get('MUSIC_PLAYER_TOP1')).toMatchObject({
      packageName: 'com.netease.cloudmusic',
      intentType: 'MUSIC_PLAYER_TOP1',
      usageCount: 1,
    });
  });

  it('recovers from malformed stored history without cascading initialization side effects', async () => {
    const deps = createDependencies({
      [APP_USAGE_HISTORY_KEY]: '{broken-json',
    });
    const service = new DynamicSuggestionService(deps);

    await service.recordAppUsage('MUSIC_PLAYER_TOP1', 'com.netease.cloudmusic');

    expect(deps.feedbackLogger.initialize).toHaveBeenCalledTimes(0);
    expect(deps.weightAdjuster.initialize).toHaveBeenCalledTimes(0);
    expect(deps.logger.warn).toHaveBeenCalledTimes(1);
    expect(deps.storage.set).toHaveBeenCalledTimes(1);

    const savedPayload = deps.storage.set.mock.calls[0][1];
    const savedEntries = new Map<string, any>(JSON.parse(savedPayload));

    expect(savedEntries.size).toBe(1);
    expect(savedEntries.get('MUSIC_PLAYER_TOP1')).toMatchObject({
      packageName: 'com.netease.cloudmusic',
      intentType: 'MUSIC_PLAYER_TOP1',
      usageCount: 1,
    });
  });

  it('uses local adjusted-workday facts instead of weekend heuristics in dynamic context', async () => {
    jest.setSystemTime(new Date(2026, 4, 9, 9, 0, 0));
    const deps = createDependencies();
    const service = new DynamicSuggestionService(deps);

    const suggestion = await service.generateDynamicSuggestions('OFFICE', {
      systemAdjustments: [],
      appLaunches: [],
      oneTapActions: [],
    });

    expect(suggestion.context).toMatchObject({
      isWeekend: true,
      isHoliday: false,
      isWorkday: true,
      isRestDay: false,
      dayTypeLabel: '工作日',
    });
    expect(suggestion.personalizedNotes).toContain('💡 今天是调休工作日，办公建议按工作日处理');
  });

  it('marks statutory holidays as rest days in office dynamic notes', async () => {
    jest.setSystemTime(new Date(2026, 4, 4, 9, 0, 0));
    const deps = createDependencies();
    const service = new DynamicSuggestionService(deps);

    const suggestion = await service.generateDynamicSuggestions('OFFICE', {
      systemAdjustments: [],
      appLaunches: [],
      oneTapActions: [],
    });

    expect(suggestion.context).toMatchObject({
      isWeekend: false,
      isHoliday: true,
      isWorkday: false,
      isRestDay: true,
      dayTypeLabel: '休息日',
    });
    expect(suggestion.personalizedNotes).toContain('💡 今天是休息日，如非必要可稍后处理工作');
  });
});
