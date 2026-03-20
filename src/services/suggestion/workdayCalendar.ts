export interface WorkdayCalendarSnapshot {
  holidays: string[];
  workdays: string[];
}

export interface DayClassification {
  dateKey: string;
  isWeekend: boolean;
  isHoliday: boolean;
  isWorkday: boolean;
  isRestDay: boolean;
  dayTypeLabel: '工作日' | '周末' | '休息日';
}

// Local-maintained statutory holiday and adjusted-workday snapshot.
// This keeps suggestion logic off fake "weekday == workday" assumptions
// even before any remote holiday service is introduced.
export const WORKDAY_CALENDAR: Record<number, WorkdayCalendarSnapshot> = {
  2026: {
    holidays: [
      '2026-01-01',
      '2026-02-17',
      '2026-02-18',
      '2026-02-19',
      '2026-02-20',
      '2026-02-21',
      '2026-02-22',
      '2026-02-23',
      '2026-04-04',
      '2026-04-05',
      '2026-04-06',
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
      '2026-05-05',
      '2026-06-19',
      '2026-06-20',
      '2026-06-21',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ],
    workdays: [
      '2026-02-15',
      '2026-02-28',
      '2026-04-26',
      '2026-05-09',
      '2026-09-27',
      '2026-10-10',
    ],
  },
};

function pad(value: number): string {
  return `${value}`.padStart(2, '0');
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function classifyDay(date: Date): DayClassification {
  const dateKey = toLocalDateKey(date);
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const snapshot = WORKDAY_CALENDAR[date.getFullYear()];
  const isHoliday = snapshot?.holidays.includes(dateKey) ?? false;
  const isAdjustedWorkday = snapshot?.workdays.includes(dateKey) ?? false;
  const isWorkday = isAdjustedWorkday || (!isWeekend && !isHoliday);
  const isRestDay = !isWorkday;
  const dayTypeLabel = isWorkday ? '工作日' : isWeekend ? '周末' : '休息日';

  return {
    dateKey,
    isWeekend,
    isHoliday,
    isWorkday,
    isRestDay,
    dayTypeLabel,
  };
}
