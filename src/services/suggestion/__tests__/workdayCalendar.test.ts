import sceneBridge from '../../../core/SceneBridge';
import { feedbackLogger } from '../../../reflection/FeedbackLogger';
import { storageManager } from '../../../stores/storageManager';
import { ContextAggregator } from '../ContextAggregator';
import { textGenerator } from '../TextGenerator';
import { classifyDay } from '../workdayCalendar';

const EMPTY_FEEDBACK_STATS = {
  sceneType: 'HOME' as const,
  totalCount: 0,
  acceptCount: 0,
  ignoreCount: 0,
  cancelCount: 0,
  acceptRate: 0,
  ignoreRate: 0,
  cancelRate: 0,
  consecutiveIgnores: 0,
  lastFeedback: null,
  lastFeedbackTime: null,
  averageConfidenceOnAccept: 0,
  averageConfidenceOnIgnore: 0,
};

describe('workdayCalendar', () => {
  let aggregator: ContextAggregator;

  beforeEach(() => {
    jest.spyOn(storageManager, 'getString').mockReturnValue(undefined);
    jest.spyOn(feedbackLogger, 'getStats').mockReturnValue(EMPTY_FEEDBACK_STATS);
    jest.spyOn(sceneBridge, 'hasCalendarPermission').mockResolvedValue(false);
    aggregator = new ContextAggregator();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('marks weekday statutory holidays as rest days', () => {
    expect(classifyDay(new Date(2026, 4, 4, 9, 0, 0))).toMatchObject({
      dateKey: '2026-05-04',
      isWeekend: false,
      isHoliday: true,
      isWorkday: false,
      isRestDay: true,
      dayTypeLabel: '休息日',
    });
  });

  it('marks weekend adjusted-workdays as workdays', () => {
    expect(classifyDay(new Date(2026, 4, 9, 9, 0, 0))).toMatchObject({
      dateKey: '2026-05-09',
      isWeekend: true,
      isHoliday: false,
      isWorkday: true,
      isRestDay: false,
      dayTypeLabel: '工作日',
    });
  });

  it('feeds real workday flags into aggregated time context', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 9, 9, 0, 0));

    const context = await aggregator.aggregate('OFFICE', 0.88, null, null);

    expect(context.time).toMatchObject({
      dayOfWeek: 6,
      isWeekend: true,
      isHoliday: false,
      isWorkday: true,
      isRestDay: false,
    });
  });

  it('rewrites weekend copy to rest-day copy on weekday holidays', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 4, 9, 0, 0));

    const context = await aggregator.aggregate('HOME', 0.92, null, null);

    expect(textGenerator.fillTemplate('周末出行，{work_hint}', context)).toBe('休息日出行，休息日');
  });

  it('uses the local holiday snapshot for tomorrow_type', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 3, 22, 0, 0));

    const context = await aggregator.aggregate('SLEEP', 0.81, null, null);

    expect(textGenerator.fillTemplate('明天是{tomorrow_type}', context)).toBe('明天是休息日');
  });
});
