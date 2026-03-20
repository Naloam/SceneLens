import sceneBridge from '../../../core/SceneBridge';
import { feedbackLogger } from '../../../reflection/FeedbackLogger';
import { storageManager } from '../../../stores/storageManager';
import { ContextAggregator } from '../ContextAggregator';
import { textGenerator } from '../TextGenerator';

describe('ContextAggregator calendar integration', () => {
  let aggregator: ContextAggregator;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 20, 9, 0, 0));
    jest.spyOn(storageManager, 'getString').mockReturnValue(undefined);
    jest.spyOn(feedbackLogger, 'getStats').mockReturnValue({
      sceneType: 'OFFICE',
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
    });
    aggregator = new ContextAggregator();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('builds meeting context from real calendar events instead of stale signal strings', async () => {
    jest.spyOn(sceneBridge, 'hasCalendarPermission').mockResolvedValue(true);
    jest.spyOn(sceneBridge, 'getUpcomingEvents').mockResolvedValue([
      {
        id: 'evt-1',
        title: '项目例会',
        startTime: Date.now() + 20 * 60 * 1000,
        endTime: Date.now() + 80 * 60 * 1000,
        location: '会议室 A',
      },
    ]);

    const context = await aggregator.aggregate('OFFICE', 0.9, null, null);

    expect(context.calendar.available).toBe(true);
    expect(context.calendar.isInMeeting).toBe(false);
    expect(context.calendar.upcomingEvent).toEqual({
      title: '项目例会',
      minutesUntil: 20,
      location: '会议室 A',
      durationMinutes: 60,
    });
  });

  it('marks in-progress meetings from real calendar timing', async () => {
    jest.spyOn(sceneBridge, 'hasCalendarPermission').mockResolvedValue(true);
    jest.spyOn(sceneBridge, 'getUpcomingEvents').mockResolvedValue([
      {
        id: 'evt-2',
        title: '团队周会',
        startTime: Date.now() - 10 * 60 * 1000,
        endTime: Date.now() + 20 * 60 * 1000,
        location: '线上会议',
      },
    ]);

    const context = await aggregator.aggregate('OFFICE', 0.85, null, null);

    expect(context.calendar.available).toBe(true);
    expect(context.calendar.isInMeeting).toBe(true);
    expect(context.calendar.upcomingEvent).toBeNull();
  });

  it('keeps calendar unavailable when permission is missing', async () => {
    const getUpcomingEventsSpy = jest.spyOn(sceneBridge, 'getUpcomingEvents');
    jest.spyOn(sceneBridge, 'hasCalendarPermission').mockResolvedValue(false);

    const context = await aggregator.aggregate('OFFICE', 0.75, null, null);

    expect(context.calendar).toEqual({
      available: false,
      upcomingEvent: null,
      isInMeeting: false,
    });
    expect(getUpcomingEventsSpy).not.toHaveBeenCalled();
  });

  it('uses a neutral weather filler until realtime weather is wired', async () => {
    jest.spyOn(sceneBridge, 'hasCalendarPermission').mockResolvedValue(false);

    const context = await aggregator.aggregate('COMMUTE', 0.8, null, null);

    expect(textGenerator.fillTemplate('天气{weather}', context)).toBe('天气待确认');
  });
});
