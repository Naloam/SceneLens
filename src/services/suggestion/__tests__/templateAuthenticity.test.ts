import sceneBridge from '../../../core/SceneBridge';
import { feedbackLogger } from '../../../reflection/FeedbackLogger';
import { storageManager } from '../../../stores/storageManager';
import { useAppPreferenceStore } from '../../../stores/appPreferenceStore';
import { ContextAggregator } from '../ContextAggregator';
import { actionReasonGenerator } from '../ActionReasonGenerator';
import { textGenerator } from '../TextGenerator';

const EMPTY_FEEDBACK_STATS = {
  sceneType: 'OFFICE' as const,
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

describe('suggestion template authenticity', () => {
  let aggregator: ContextAggregator;

  beforeEach(() => {
    jest.spyOn(storageManager, 'getString').mockReturnValue(undefined);
    jest.spyOn(feedbackLogger, 'getStats').mockReturnValue(EMPTY_FEEDBACK_STATS);
    jest.spyOn(sceneBridge, 'hasCalendarPermission').mockResolvedValue(false);
    useAppPreferenceStore.getState().reset();
    aggregator = new ContextAggregator();
  });

  afterEach(() => {
    useAppPreferenceStore.getState().reset();
    jest.restoreAllMocks();
  });

  it('uses the preferred meeting app name instead of a hardcoded label', async () => {
    useAppPreferenceStore.getState().setAllApps([
      {
        packageName: 'com.alibaba.dingtalk',
        appName: '钉钉会议',
        category: 'MEETING_APP',
        icon: '',
        isSystemApp: false,
      },
    ]);
    useAppPreferenceStore.getState().setPreferences(new Map([
      [
        'MEETING_APP',
        {
          category: 'MEETING_APP',
          topApps: ['com.alibaba.dingtalk'],
          lastUpdated: Date.now(),
        },
      ],
    ]));

    const context = await aggregator.aggregate('OFFICE', 0.85, null, null);

    expect(textGenerator.fillTemplate('打开{meeting_app}', context)).toBe('打开钉钉会议');
    expect(
      actionReasonGenerator.selectRandomReason(
        ['一键打开{meeting_app}，准备加入会议'],
        context
      )
    ).toBe('一键打开钉钉会议，准备加入会议');
  });

  it('uses a neutral event location fallback when calendar details lack a location', async () => {
    jest.spyOn(sceneBridge, 'hasCalendarPermission').mockResolvedValue(true);
    jest.spyOn(sceneBridge, 'getUpcomingEvents').mockResolvedValue([
      {
        id: 'meeting-1',
        title: '项目会议同步',
        startTime: Date.now() + 20 * 60 * 1000,
        endTime: Date.now() + 80 * 60 * 1000,
        location: '',
      },
    ]);

    const context = await aggregator.aggregate('OFFICE', 0.9, null, null);

    expect(context.calendar.upcomingEvent).toMatchObject({
      title: '项目会议同步',
      location: '',
    });
    expect(textGenerator.fillTemplate('地点: {event_location}', context)).toBe('地点: 地点待确认');
  });
});
