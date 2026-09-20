import { describe, it, expect } from 'vitest';
import {
  calculateGrossTime,
  calculateBreakTime,
  calculateNetTime,
  formatDuration,
  formatDurationHHMM,
  formatTime,
  formatDate,
  getWeekRange,
  getMonthRange,
  getWeekDays,
  getMonthDays,
  isCurrentlyActive,
  hasActiveBreak,
} from '../time';

describe('Time and Duration Calculations', () => {
  it('calculates gross time correctly for completed session', () => {
    const clockIn = new Date('2026-09-15T09:00:00Z');
    const clockOut = new Date('2026-09-15T17:00:00Z');
    const gross = calculateGrossTime(clockIn, clockOut);
    // 8 hours = 8 * 3600 * 1000 = 28,800,000 ms
    expect(gross).toBe(8 * 60 * 60 * 1000);
  });

  it('calculates gross time for ongoing session using current time', () => {
    const clockIn = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
    const gross = calculateGrossTime(clockIn, null);
    expect(gross).toBeGreaterThanOrEqual(29 * 60 * 1000);
    expect(gross).toBeLessThanOrEqual(31 * 60 * 1000);
  });

  it('calculates break time with single completed break', () => {
    const breaks = [
      {
        startedAt: new Date('2026-09-15T12:00:00Z'),
        endedAt: new Date('2026-09-15T12:45:00Z'),
      },
    ];
    const breakMs = calculateBreakTime(breaks);
    // 45 minutes = 45 * 60 * 1000 = 2,700,000 ms
    expect(breakMs).toBe(45 * 60 * 1000);
  });

  it('calculates break time across multiple breaks', () => {
    const breaks = [
      {
        startedAt: new Date('2026-09-15T10:30:00Z'),
        endedAt: new Date('2026-09-15T10:45:00Z'), // 15 mins
      },
      {
        startedAt: new Date('2026-09-15T13:00:00Z'),
        endedAt: new Date('2026-09-15T13:30:00Z'), // 30 mins
      },
      {
        startedAt: new Date('2026-09-15T15:15:00Z'),
        endedAt: new Date('2026-09-15T15:25:00Z'), // 10 mins
      },
    ];
    const breakMs = calculateBreakTime(breaks);
    expect(breakMs).toBe(55 * 60 * 1000); // 55 mins total
  });

  it('calculates net time as gross minus break', () => {
    const grossMs = 8 * 60 * 60 * 1000; // 8 hours
    const breakMs = 45 * 60 * 1000; // 45 minutes
    const net = calculateNetTime(grossMs, breakMs);
    // 7 hours 15 minutes = 26,100,000 ms
    expect(net).toBe(7 * 60 * 60 * 1000 + 15 * 60 * 1000);
  });

  it('ensures net time cannot be negative if break exceeds gross', () => {
    const grossMs = 30 * 60 * 1000;
    const breakMs = 45 * 60 * 1000;
    const net = calculateNetTime(grossMs, breakMs);
    expect(net).toBe(0);
  });

  it('formats duration into human-readable string', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(-5000)).toBe('0m');
    expect(formatDuration(25 * 60 * 1000)).toBe('25m');
    expect(formatDuration(60 * 60 * 1000)).toBe('1h 0m');
    expect(formatDuration((7 * 60 + 30) * 60 * 1000)).toBe('7h 30m');
    expect(formatDuration((8 * 60 + 45) * 60 * 1000)).toBe('8h 45m');
  });

  it('formats duration as HH:MM', () => {
    expect(formatDurationHHMM(0)).toBe('00:00');
    expect(formatDurationHHMM(45 * 60 * 1000)).toBe('00:45');
    expect(formatDurationHHMM((7 * 60 + 30) * 60 * 1000)).toBe('07:30');
    expect(formatDurationHHMM((12 * 60 + 5) * 60 * 1000)).toBe('12:05');
  });
});

describe('Timezone & Date Utilities', () => {
  it('formats time in Europe/Berlin timezone correctly (UTC+2 in summer)', () => {
    // 2026-07-15 08:00 UTC is 10:00 CEST (UTC+2) in Berlin
    const summerDate = new Date('2026-07-15T08:00:00Z');
    expect(formatTime(summerDate, 'Europe/Berlin')).toBe('10:00');
  });

  it('formats time in Europe/Berlin timezone correctly in winter (UTC+1)', () => {
    // 2026-01-15 08:00 UTC is 09:00 CET (UTC+1) in Berlin
    const winterDate = new Date('2026-01-15T08:00:00Z');
    expect(formatTime(winterDate, 'Europe/Berlin')).toBe('09:00');
  });

  it('formats date in German standard dd.MM.yyyy', () => {
    const date = new Date('2026-09-19T10:00:00Z');
    expect(formatDate(date, 'Europe/Berlin')).toBe('19.09.2026');
  });

  it('determines week range starting on Monday and ending on Sunday', () => {
    // 2026-09-16 is a Wednesday
    const wednesday = new Date('2026-09-16T12:00:00Z');
    const { start, end } = getWeekRange(wednesday, 'Europe/Berlin');

    // Monday is 2026-09-14
    expect(formatDate(start, 'Europe/Berlin')).toBe('14.09.2026');
    // Sunday is 2026-09-20
    expect(formatDate(end, 'Europe/Berlin')).toBe('20.09.2026');
  });

  it('generates 7 days for a week', () => {
    const date = new Date('2026-09-16T12:00:00Z');
    const days = getWeekDays(date, 'Europe/Berlin');
    expect(days).toHaveLength(7);
    expect(formatDate(days[0], 'Europe/Berlin')).toBe('14.09.2026');
    expect(formatDate(days[6], 'Europe/Berlin')).toBe('20.09.2026');
  });

  it('determines month range and day count correctly for September (30 days)', () => {
    const sepDate = new Date('2026-09-15T12:00:00Z');
    const { start, end } = getMonthRange(sepDate, 'Europe/Berlin');
    expect(formatDate(start, 'Europe/Berlin')).toBe('01.09.2026');
    expect(formatDate(end, 'Europe/Berlin')).toBe('30.09.2026');

    const days = getMonthDays(sepDate, 'Europe/Berlin');
    expect(days).toHaveLength(30);
  });
});

describe('Session State Logic', () => {
  it('correctly identifies an active session', () => {
    expect(isCurrentlyActive({ status: 'active', clockOutAt: null })).toBe(true);
    expect(isCurrentlyActive({ status: 'completed', clockOutAt: new Date() })).toBe(false);
    expect(isCurrentlyActive({ status: 'missing_clock_out', clockOutAt: null })).toBe(false);
  });

  it('correctly checks for active breaks', () => {
    const noBreaks: { endedAt: Date | null }[] = [];
    expect(hasActiveBreak(noBreaks)).toBe(false);

    const completedBreaks = [
      { endedAt: new Date('2026-09-15T12:30:00Z') },
      { endedAt: new Date('2026-09-15T15:15:00Z') },
    ];
    expect(hasActiveBreak(completedBreaks)).toBe(false);

    const activeBreakList = [
      { endedAt: new Date('2026-09-15T12:30:00Z') },
      { endedAt: null },
    ];
    expect(hasActiveBreak(activeBreakList)).toBe(true);
  });
});
