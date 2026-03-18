jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimePatternEngine } from '../../../prediction/TimePatternEngine';
import type { SceneType } from '../../../types';
import type { SceneHistoryRecord, TimePattern } from '../../../prediction/types';

const STORAGE_KEYS = {
  sceneHistory: 'scene_history',
  timePatterns: 'time_patterns',
  lastAnalysis: 'time_pattern_last_analysis',
};

function mockStorage(data: Partial<Record<string, string>> = {}): void {
  (AsyncStorage.multiGet as jest.Mock).mockImplementation(async (keys: string[]) =>
    keys.map(key => [key, data[key] ?? null])
  );
  (AsyncStorage.multiSet as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
}

function createHistoryRecord(
  sceneType: SceneType,
  dayOffset: number,
  hour: number,
  minute: number = 0
): SceneHistoryRecord {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  date.setHours(hour, minute, 0, 0);

  return {
    sceneType,
    startTime: date.getTime(),
    confidence: 0.9,
    dayOfWeek: date.getDay() || 7,
    hour,
  };
}

describe('TimePatternEngine', () => {
  let engine: TimePatternEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage();
    engine = new TimePatternEngine();
  });

  it('records scene changes and persists history', async () => {
    await engine.recordSceneChange('OFFICE', 0.92);

    expect(engine.getSceneHistory(1)).toHaveLength(1);
    expect(AsyncStorage.multiSet).toHaveBeenCalled();
  });

  it('derives patterns from repeated scene history', async () => {
    const history = Array.from({ length: 6 }, (_, index) =>
      createHistoryRecord('OFFICE', index, 9, 5)
    );

    mockStorage({
      [STORAGE_KEYS.sceneHistory]: JSON.stringify(history),
      [STORAGE_KEYS.lastAnalysis]: '0',
    });
    engine = new TimePatternEngine();

    const patterns = await engine.analyzePatterns();

    expect(patterns.some(pattern => pattern.sceneType === 'OFFICE')).toBe(true);
    expect(AsyncStorage.multiSet).toHaveBeenCalled();
  });

  it('predicts the next scene from stored patterns', async () => {
    const patterns: TimePattern[] = [
      {
        id: 'office_morning',
        period: 'daily',
        triggerTime: '09:00',
        sceneType: 'OFFICE',
        confidence: 0.9,
        sampleCount: 6,
      },
    ];

    mockStorage({
      [STORAGE_KEYS.timePatterns]: JSON.stringify(patterns),
      [STORAGE_KEYS.lastAnalysis]: String(Date.now()),
    });
    engine = new TimePatternEngine();
    await engine.initialize();

    const prediction = engine.predictNextScene(new Date('2026-03-16T08:15:00'));

    expect(prediction).toEqual(
      expect.objectContaining({
        sceneType: 'OFFICE',
        predictedTime: '09:00',
        minutesUntil: 45,
      })
    );
  });

  it('detects an unexpected scene when a strong routine exists', async () => {
    const patterns: TimePattern[] = [
      {
        id: 'commute_morning',
        period: 'daily',
        triggerTime: '08:00',
        sceneType: 'COMMUTE',
        confidence: 0.95,
        sampleCount: 8,
      },
    ];

    mockStorage({
      [STORAGE_KEYS.timePatterns]: JSON.stringify(patterns),
      [STORAGE_KEYS.lastAnalysis]: String(Date.now()),
    });
    engine = new TimePatternEngine();
    await engine.initialize();

    const anomaly = engine.detectAnomaly('HOME', new Date('2026-03-16T08:10:00'));

    expect(anomaly).toEqual(
      expect.objectContaining({
        type: 'UNEXPECTED_SCENE',
        currentScene: 'HOME',
        expectedScene: 'COMMUTE',
      })
    );
  });

  it('summarizes stored history and patterns', async () => {
    const history = [createHistoryRecord('HOME', 0, 19), createHistoryRecord('HOME', 1, 19)];
    const patterns: TimePattern[] = [
      {
        id: 'home_evening',
        period: 'daily',
        triggerTime: '19:00',
        sceneType: 'HOME',
        confidence: 0.8,
        sampleCount: 6,
      },
    ];

    mockStorage({
      [STORAGE_KEYS.sceneHistory]: JSON.stringify(history),
      [STORAGE_KEYS.timePatterns]: JSON.stringify(patterns),
      [STORAGE_KEYS.lastAnalysis]: String(Date.now()),
    });
    engine = new TimePatternEngine();
    await engine.initialize();

    expect(engine.getStatsSummary()).toEqual(
      expect.objectContaining({
        totalRecords: 2,
        totalPatterns: 1,
        mostPredictableScene: 'HOME',
      })
    );
  });

  it('clears all persisted data', async () => {
    await engine.clearAll();

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      STORAGE_KEYS.sceneHistory,
      STORAGE_KEYS.timePatterns,
      STORAGE_KEYS.lastAnalysis,
    ]);
  });
});
