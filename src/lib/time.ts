import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  differenceInMilliseconds,
  addDays,
  subDays,
  getDay,
  isToday,
  isSameDay,
  startOfDay,
  endOfDay,
  parseISO
} from 'date-fns';
import { TZDate, tz } from '@date-fns/tz';

// Default timezone
export const DEFAULT_TIMEZONE = 'Europe/Berlin';

export function calculateGrossTime(clockIn: Date | string | null | undefined, clockOut: Date | string | null | undefined): number {
  if (!clockIn) return 0;
  const inDate = new Date(clockIn);
  const outDate = clockOut ? new Date(clockOut) : new Date();
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return 0;
  return Math.max(0, differenceInMilliseconds(outDate, inDate));
}

export function calculateBreakTime(breaks: Array<{ startedAt?: Date | string | null; endedAt?: Date | string | null; startTime?: Date | string | null; endTime?: Date | string | null }>): number {
  if (!Array.isArray(breaks)) return 0;
  return breaks.reduce((total, b) => {
    const startVal = b.startedAt || b.startTime;
    const endVal = b.endedAt || b.endTime;
    if (!startVal) return total;
    const startDate = new Date(startVal);
    const endDate = endVal ? new Date(endVal) : new Date();
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return total;
    return total + Math.max(0, differenceInMilliseconds(endDate, startDate));
  }, 0);
}

export function calculateNetTime(grossMs: number, breakMs: number): number {
  return Math.max(0, grossMs - breakMs);
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatDurationHHMM(ms: number): string {
  if (ms <= 0) return '00:00';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function formatTime(date: Date | string | null | undefined, timezone: string = DEFAULT_TIMEZONE): string {
  if (!date) return '—';
  try {
    const d = new TZDate(new Date(date), timezone);
    if (isNaN(d.getTime())) return '—';
    return format(d, 'HH:mm');
  } catch {
    return '—';
  }
}

export function formatDate(date: Date | string | null | undefined, timezone: string = DEFAULT_TIMEZONE): string {
  if (!date) return '—';
  try {
    const d = new TZDate(new Date(date), timezone);
    if (isNaN(d.getTime())) return '—';
    return format(d, 'dd.MM.yyyy');
  } catch {
    return '—';
  }
}

export function formatDateFull(date: Date | string | null | undefined, timezone: string = DEFAULT_TIMEZONE): string {
  if (!date) return '—';
  try {
    const d = new TZDate(new Date(date), timezone);
    if (isNaN(d.getTime())) return '—';
    return format(d, 'EEEE, d MMMM yyyy');
  } catch {
    return '—';
  }
}

export function getWeekRange(date: Date, timezone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const d = new TZDate(date, timezone);
  return {
    start: startOfWeek(d, { weekStartsOn: 1 }),
    end: endOfWeek(d, { weekStartsOn: 1 })
  };
}

export function getMonthRange(date: Date, timezone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const d = new TZDate(date, timezone);
  return {
    start: startOfMonth(d),
    end: endOfMonth(d)
  };
}

export function getWeekDays(date: Date, timezone: string = DEFAULT_TIMEZONE): Date[] {
  const range = getWeekRange(date, timezone);
  return eachDayOfInterval({ start: range.start, end: range.end });
}

export function getMonthDays(date: Date, timezone: string = DEFAULT_TIMEZONE): Date[] {
  const range = getMonthRange(date, timezone);
  return eachDayOfInterval({ start: range.start, end: range.end });
}

export function isCurrentlyActive(session: { clockOutAt: Date | null; status: string }): boolean {
  return session.status === 'active' && session.clockOutAt === null;
}

export function hasActiveBreak(breaks: { endedAt: Date | null }[]): boolean {
  return breaks.some(b => b.endedAt === null);
}

export function getGreeting(): string {
  const now = new TZDate(new Date(), DEFAULT_TIMEZONE);
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
