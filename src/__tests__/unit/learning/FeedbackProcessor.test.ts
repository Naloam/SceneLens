jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FeedbackProcessor,
  type FeedbackRecord,
  type FeedbackType,
  type SuggestionInfo,
  type SuggestionType,
} from '../../../learning/FeedbackProcessor';
import type { SceneType } from '../../../types';

const STORAGE_KEYS = {
  records: 'feedback_records',
  weights: 'suggestion_weights',
  insights: 'feedback_insights',
  report: 'personalization_report',
};

function mockStorage(data: Partial<Record<string, string>> = {}): void {
  (AsyncStorage.multiGet as jest.Mock).mockImplementation(async (keys: string[]) =>
    keys.map(key => [key, data[key] ?? null])
  );
  (AsyncStorage.multiSet as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(data[STORAGE_KEYS.report] ?? null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
}

function createSuggestion(
  type: SuggestionType = 'APP_LAUNCH',
  scene: SceneType = 'OFFICE'
): SuggestionInfo {
  return {
    id: `${type}_${scene}`,
    type,
    scene,
    title: `${type} ${scene}`,
    content: 'Test suggestion',
    confidence: 0.85,
  };
}

function createRecord(
  feedback: FeedbackType,
  type: SuggestionType = 'APP_LAUNCH',
  scene: SceneType = 'OFFICE',
  hour: number = 9
): FeedbackRecord {
  const timestamp = Date.now() - hour * 60_000;

  return {
    id: `${feedback}_${type}_${scene}_${hour}`,
    suggestion: createSuggestion(type, scene),
    feedback,
    timestamp,
    responseTime: 1500,
    context: {
      hour,
      dayOfWeek: 1,
      scene,
    },
  };
}

describe('FeedbackProcessor', () => {
  let processor: FeedbackProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage();
    processor = new FeedbackProcessor();
  });

  it('records feedback and adjusts suggestion weights', async () => {
    const suggestion = createSuggestion('APP_LAUNCH', 'OFFICE');

    await processor.recordFeedback(suggestion, 'ACCEPT', {
      responseTime: 1200,
      modification: 'kept as-is',
    });

    expect(processor.getWeight('APP_LAUNCH', 'OFFICE')).toBeGreaterThan(1);
    expect(AsyncStorage.multiSet).toHaveBeenCalled();
  });

  it('decreases weight for negative feedback', async () => {
    const suggestion = createSuggestion('SYSTEM_SETTING', 'HOME');

    await processor.recordFeedback(suggestion, 'DISMISS');

    expect(processor.getWeight('SYSTEM_SETTING', 'HOME')).toBeLessThan(1);
  });

  it('generates negative insights from repeated poor acceptance', async () => {
    const records = [
      ...Array.from({ length: 8 }, () => createRecord('DISMISS', 'APP_LAUNCH', 'OFFICE')),
      ...Array.from({ length: 2 }, () => createRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE')),
    ];

    mockStorage({
      [STORAGE_KEYS.records]: JSON.stringify(records),
    });
    processor = new FeedbackProcessor();

    const insights = await processor.generateInsights();

    expect(
      insights.some(
        insight =>
          insight.type === 'NEGATIVE' &&
          insight.data.suggestionType === 'APP_LAUNCH'
      )
    ).toBe(true);
  });

  it('builds a personalization report from stored feedback', async () => {
    const records = [
      createRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE', 9),
      createRecord('ACCEPT', 'APP_LAUNCH', 'OFFICE', 10),
      createRecord('DISMISS', 'SYSTEM_SETTING', 'HOME', 20),
      createRecord('IGNORE', 'REMINDER', 'HOME', 21),
    ];

    mockStorage({
      [STORAGE_KEYS.records]: JSON.stringify(records),
    });
    processor = new FeedbackProcessor();

    const report = await processor.generateReport(7);

    expect(report.overview.totalSuggestions).toBe(4);
    expect(report.byScene.OFFICE?.total).toBe(2);
    expect(report.byType.APP_LAUNCH.total).toBe(2);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.report,
      expect.any(String)
    );
  });

  it('returns UI-facing report and stats from in-memory feedback', async () => {
    await processor.recordFeedback(createSuggestion('APP_LAUNCH', 'OFFICE'), 'ACCEPT');
    await processor.recordFeedback(createSuggestion('REMINDER', 'HOME'), 'DISMISS');

    const stats = processor.getStats();
    const report = processor.getPersonalizationReport();

    expect(stats.totalRecords).toBe(2);
    expect(report.overview.totalSuggestions).toBe(2);
    expect(report.byScene.OFFICE?.total).toBe(1);
    expect(report.byScene.HOME?.total).toBe(1);
  });

  it('clears all persisted feedback data', async () => {
    await processor.clearAll();

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      STORAGE_KEYS.records,
      STORAGE_KEYS.weights,
      STORAGE_KEYS.insights,
      STORAGE_KEYS.report,
    ]);
  });
});
