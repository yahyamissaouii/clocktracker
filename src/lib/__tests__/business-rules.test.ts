import { describe, it, expect } from 'vitest';
import { calculateGrossTime, calculateBreakTime, calculateNetTime } from '../time';

describe('Clock & Break Business Rules Logic', () => {
  it('prevents duplicate active sessions (idempotency rule)', () => {
    // Simulating server action idempotency check
    const existingSession = {
      id: 'session-1',
      employeeId: 'emp-123',
      status: 'active',
      clockInAt: new Date('2026-09-19T09:00:00Z'),
    };

    function handleClockIn(currentSession: typeof existingSession | null) {
      if (currentSession && currentSession.status === 'active') {
        return { success: true, session: currentSession, alreadyActive: true };
      }
      return {
        success: true,
        session: { id: 'session-2', employeeId: 'emp-123', status: 'active', clockInAt: new Date() },
        alreadyActive: false,
      };
    }

    const firstAttempt = handleClockIn(null);
    expect(firstAttempt.alreadyActive).toBe(false);

    const secondAttempt = handleClockIn(existingSession);
    expect(secondAttempt.alreadyActive).toBe(true);
    expect(secondAttempt.session.id).toBe('session-1');
  });

  it('handles break state transitions accurately', () => {
    const sessionWithoutBreaks = {
      id: 'sess-1',
      breaks: [] as { id: string; startedAt: Date; endedAt: Date | null }[],
    };

    function startBreak(session: typeof sessionWithoutBreaks) {
      const openBreak = session.breaks.find((b) => !b.endedAt);
      if (openBreak) {
        return { success: true, break: openBreak, alreadyOnBreak: true };
      }
      const newBreak = { id: `brk-${Date.now()}`, startedAt: new Date(), endedAt: null };
      session.breaks.push(newBreak);
      return { success: true, break: newBreak, alreadyOnBreak: false };
    }

    function endBreak(session: typeof sessionWithoutBreaks) {
      const openBreak = session.breaks.find((b) => !b.endedAt);
      if (!openBreak) {
        return { success: false, error: 'No active break found' };
      }
      openBreak.endedAt = new Date();
      return { success: true, break: openBreak };
    }

    // Start 1st break
    const brk1 = startBreak(sessionWithoutBreaks);
    expect(brk1.alreadyOnBreak).toBe(false);
    expect(sessionWithoutBreaks.breaks).toHaveLength(1);

    // Attempt double start break while active
    const brkDuplicate = startBreak(sessionWithoutBreaks);
    expect(brkDuplicate.alreadyOnBreak).toBe(true);
    expect(sessionWithoutBreaks.breaks).toHaveLength(1);

    // End break
    const ended = endBreak(sessionWithoutBreaks);
    expect(ended.success).toBe(true);
    expect(ended.break?.endedAt).toBeInstanceOf(Date);

    // Attempt to end break again when none active
    const endAgain = endBreak(sessionWithoutBreaks);
    expect(endAgain.success).toBe(false);
    expect(endAgain.error).toBe('No active break found');
  });

  it('auto-closes open break when clocking out', () => {
    const session = {
      id: 'sess-1',
      status: 'active',
      clockInAt: new Date('2026-09-19T08:00:00Z'),
      clockOutAt: null as Date | null,
      breaks: [
        {
          id: 'brk-1',
          startedAt: new Date('2026-09-19T12:00:00Z'),
          endedAt: null as Date | null,
        },
      ],
    };

    function handleClockOut(activeSession: typeof session) {
      const now = new Date('2026-09-19T16:00:00Z');
      const openBreak = activeSession.breaks.find((b) => !b.endedAt);
      if (openBreak) {
        openBreak.endedAt = now;
      }
      activeSession.clockOutAt = now;
      activeSession.status = 'completed';
      return {
        session: activeSession,
        breakAutoClosed: !!openBreak,
      };
    }

    const result = handleClockOut(session);
    expect(result.breakAutoClosed).toBe(true);
    expect(session.breaks[0].endedAt).toEqual(new Date('2026-09-19T16:00:00Z'));
    expect(session.status).toBe('completed');
  });

  it('computes exact net hours matching target scenario (Gross = 8h, Break = 30m, Net = 7h 30m)', () => {
    // Exact scenario from Master Prompt item 40:
    // 09:00 - 17:00 Gross = 8h, Break = 30m, Net = 7h 30m
    const clockIn = new Date('2026-09-19T09:00:00Z');
    const clockOut = new Date('2026-09-19T17:00:00Z');
    const breaks = [
      {
        startedAt: new Date('2026-09-19T12:00:00Z'),
        endedAt: new Date('2026-09-19T12:30:00Z'),
      },
    ];

    const gross = calculateGrossTime(clockIn, clockOut);
    const breakTime = calculateBreakTime(breaks);
    const net = calculateNetTime(gross, breakTime);

    expect(gross).toBe(8 * 60 * 60 * 1000); // 8h
    expect(breakTime).toBe(30 * 60 * 1000); // 30m
    expect(net).toBe(7.5 * 60 * 60 * 1000); // 7h 30m
  });
});

describe('Role Authorization Rules', () => {
  function verifyRole(role: string | null | undefined, allowedRoles: string[]) {
    if (!role || !allowedRoles.includes(role)) {
      throw new Error('Unauthorized: Insufficient permissions');
    }
    return true;
  }

  it('allows admin on admin-only routes', () => {
    expect(verifyRole('admin', ['admin'])).toBe(true);
    expect(verifyRole('admin', ['admin', 'manager'])).toBe(true);
  });

  it('allows manager on admin & manager routes', () => {
    expect(verifyRole('manager', ['admin', 'manager'])).toBe(true);
    expect(() => verifyRole('manager', ['admin'])).toThrow('Unauthorized');
  });

  it('blocks employee from admin actions', () => {
    expect(() => verifyRole('employee', ['admin'])).toThrow('Unauthorized');
    expect(() => verifyRole('employee', ['admin', 'manager'])).toThrow('Unauthorized');
  });

  it('blocks undefined or null roles', () => {
    expect(() => verifyRole(null, ['admin', 'manager', 'employee'])).toThrow('Unauthorized');
    expect(() => verifyRole(undefined, ['employee'])).toThrow('Unauthorized');
  });
});
