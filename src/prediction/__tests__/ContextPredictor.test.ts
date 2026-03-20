import { ContextPredictor } from '../ContextPredictor';
import { sceneBridge } from '../../core/SceneBridge';
import { timePatternEngine } from '../TimePatternEngine';
import { behaviorAnalyzer } from '../BehaviorAnalyzer';
import type { CalendarEvent } from '../../types';

const RealDate = Date;

function setMockTime(isoTime: string): void {
  const fixedDate = new RealDate(isoTime);

  global.Date = class extends RealDate {
    constructor(value?: string | number | Date) {
      if (typeof value !== 'undefined') {
        super(value instanceof RealDate ? value.getTime() : value);
      } else {
        super(fixedDate.getTime());
      }
    }

    static now() {
      return fixedDate.getTime();
    }
  } as DateConstructor;
}

jest.mock('../../core/SceneBridge', () => {
  const mock = {
    hasCalendarPermission: jest.fn(),
    getUpcomingEvents: jest.fn(),
  };

  return {
    __esModule: true,
    default: mock,
    sceneBridge: mock,
  };
});

jest.mock('../TimePatternEngine', () => ({
  timePatternEngine: {
    initialize: jest.fn().mockResolvedValue(undefined),
    predictNextScene: jest.fn().mockReturnValue(null),
    getUsualArrivalTime: jest.fn(),
    recordSceneChange: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../BehaviorAnalyzer', () => ({
  behaviorAnalyzer: {
    initialize: jest.fn().mockResolvedValue(undefined),
    matchCurrentPattern: jest.fn().mockReturnValue([]),
    recordBehavior: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockSceneBridge = sceneBridge as jest.Mocked<typeof sceneBridge>;
const mockTimePatternEngine = timePatternEngine as jest.Mocked<typeof timePatternEngine>;
const mockBehaviorAnalyzer = behaviorAnalyzer as jest.Mocked<typeof behaviorAnalyzer>;

describe('ContextPredictor', () => {
  let predictor: ContextPredictor;

  beforeEach(() => {
    jest.clearAllMocks();
    global.Date = RealDate;
    predictor = new ContextPredictor();

    mockSceneBridge.hasCalendarPermission.mockResolvedValue(false);
    mockSceneBridge.getUpcomingEvents.mockResolvedValue([]);
    mockTimePatternEngine.initialize.mockResolvedValue(undefined);
    mockTimePatternEngine.predictNextScene.mockReturnValue(null);
    mockTimePatternEngine.getUsualArrivalTime.mockReturnValue(null);
    mockBehaviorAnalyzer.initialize.mockResolvedValue(undefined);
    mockBehaviorAnalyzer.matchCurrentPattern.mockReturnValue([]);
  });

  afterEach(() => {
    global.Date = RealDate;
  });

  it('maps adjusted weekend workdays to workday semantics', () => {
    setMockTime('2026-02-15T08:00:00');

    const context = predictor.getPredictionContext('HOME');

    expect(context.isWeekday).toBe(true);
    expect(context.isWorkday).toBe(true);
    expect(context.isRestDay).toBe(false);
  });

  it('suppresses departure reminders on statutory weekday holidays', async () => {
    setMockTime('2026-02-18T07:20:00');
    mockTimePatternEngine.getUsualArrivalTime.mockReturnValue('08:20');

    const reminder = await predictor.shouldRemindDeparture('HOME');

    expect(reminder.shouldRemind).toBe(false);
  });

  it('keeps departure reminders active on adjusted weekend workdays', async () => {
    setMockTime('2026-02-15T07:20:00');
    mockTimePatternEngine.getUsualArrivalTime.mockReturnValue('08:20');

    const reminder = await predictor.shouldRemindDeparture('HOME');

    expect(reminder.shouldRemind).toBe(true);
    expect(reminder.targetScene).toBe('OFFICE');
    expect(reminder.suggestedDepartureTime).toBe('07:35');
  });

  it('builds real meeting suggestions from calendar events', async () => {
    setMockTime('2026-03-20T09:00:00');
    mockSceneBridge.hasCalendarPermission.mockResolvedValue(true);

    const now = Date.now();
    const events: CalendarEvent[] = [
      {
        id: 'meeting-1',
        title: 'Project Review Meeting',
        startTime: now + 20 * 60 * 1000,
        endTime: now + 80 * 60 * 1000,
        location: 'Conference Room A',
      },
    ];
    mockSceneBridge.getUpcomingEvents.mockResolvedValue(events);

    const suggestions = await predictor.getCalendarAwareSuggestions();

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      id: 'meeting_meeting-1',
      type: 'prepare',
      priority: 'high',
      eventTitle: 'Project Review Meeting',
    });
  });

  it('builds travel suggestions from calendar events', async () => {
    setMockTime('2026-03-20T09:00:00');
    mockSceneBridge.hasCalendarPermission.mockResolvedValue(true);

    const now = Date.now();
    const events: CalendarEvent[] = [
      {
        id: 'travel-1',
        title: 'Flight MU5108',
        startTime: now + 60 * 60 * 1000,
        endTime: now + 3 * 60 * 60 * 1000,
        location: 'Shanghai Pudong Airport',
      },
    ];
    mockSceneBridge.getUpcomingEvents.mockResolvedValue(events);

    const suggestions = await predictor.getCalendarAwareSuggestions();

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      id: 'travel_travel-1',
      type: 'travel',
      priority: 'high',
      eventTitle: 'Flight MU5108',
    });
  });

  it('marks in-progress meetings as ongoing instead of saying they start in 0 minutes', async () => {
    setMockTime('2026-03-20T09:00:00');
    mockSceneBridge.hasCalendarPermission.mockResolvedValue(true);

    const now = Date.now();
    const events: CalendarEvent[] = [
      {
        id: 'meeting-live',
        title: 'Weekly Meeting',
        startTime: now - 10 * 60 * 1000,
        endTime: now + 20 * 60 * 1000,
        location: 'Conference Room B',
      },
    ];
    mockSceneBridge.getUpcomingEvents.mockResolvedValue(events);

    const suggestions = await predictor.getCalendarAwareSuggestions();

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      id: 'meeting_meeting-live',
      eventTime: '进行中',
      type: 'prepare',
      priority: 'high',
    });
    expect(suggestions[0].suggestion).toContain('会议进行中');
  });
});
