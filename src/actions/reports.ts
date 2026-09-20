'use server';

import { db } from '@/db';
import { workSessions, organizationMembers, users, breaks } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { 
  getWeekRange, 
  getMonthRange, 
  calculateGrossTime, 
  calculateBreakTime, 
  calculateNetTime,
  formatDuration,
  formatDate,
  formatTime
} from '@/lib/time';

export async function getWeeklyReport(date: Date | string, employeeId?: string) {
  try {
    const { member } = await requireRole(['admin', 'manager']);
    const targetDate = new Date(date);
    const { start, end } = getWeekRange(targetDate);
    
    const conditions = [
      eq(workSessions.organizationId, member.organizationId),
      gte(workSessions.clockInAt, start),
      lte(workSessions.clockInAt, end)
    ];
    if (employeeId && employeeId !== 'all') {
      conditions.push(eq(workSessions.employeeId, employeeId));
    }

    const sessions = await db.select()
      .from(workSessions)
      .where(and(...conditions));

    const sessionIds = sessions.map(s => s.id);
    const allBreaks = sessionIds.length > 0 
      ? await db.select().from(breaks).where(inArray(breaks.workSessionId, sessionIds))
      : [];

    let totalGross = 0;
    let totalBreak = 0;
    let totalNet = 0;
    const daysSet = new Set<string>();

    const days = sessions.map(s => {
      const sessionBreaks = allBreaks.filter(b => b.workSessionId === s.id);
      const gross = calculateGrossTime(s.clockInAt, s.clockOutAt);
      const brk = calculateBreakTime(sessionBreaks);
      const net = calculateNetTime(gross, brk);

      totalGross += gross;
      totalBreak += brk;
      totalNet += net;

      const dateStr = formatDate(s.clockInAt);
      daysSet.add(dateStr);

      return {
        id: s.id,
        date: dateStr,
        clockIn: s.clockInAt,
        clockOut: s.clockOutAt,
        grossMs: gross,
        breakMs: brk,
        netMs: net,
        status: s.status
      };
    });

    let employeeInfo = { name: 'All Employees', department: 'All' };
    if (employeeId && employeeId !== 'all') {
      const [userRecord] = await db.select().from(users).where(eq(users.id, employeeId));
      if (userRecord) {
        employeeInfo = { name: userRecord.fullName, department: 'General' };
      }
    }

    return {
      employee: employeeInfo,
      period: { start, end, label: 'Weekly Report' },
      days,
      totals: {
        totalNet,
        totalBreak,
        totalGross,
        totalNetFormatted: formatDuration(totalNet),
        daysWorked: daysSet.size
      }
    };
  } catch (error) {
    console.error('Failed to get weekly report:', error);
    return null;
  }
}

export async function getMonthlyReport(year: number, month: number, employeeId?: string) {
  try {
    const { member } = await requireRole(['admin', 'manager']);
    const { start, end } = getMonthRange(new Date(year, month - 1, 1));
    
    const conditions = [
      eq(workSessions.organizationId, member.organizationId),
      gte(workSessions.clockInAt, start),
      lte(workSessions.clockInAt, end)
    ];
    if (employeeId && employeeId !== 'all') {
      conditions.push(eq(workSessions.employeeId, employeeId));
    }

    const sessions = await db.select()
      .from(workSessions)
      .where(and(...conditions));

    const sessionIds = sessions.map(s => s.id);
    const allBreaks = sessionIds.length > 0 
      ? await db.select().from(breaks).where(inArray(breaks.workSessionId, sessionIds))
      : [];

    let totalGross = 0;
    let totalBreak = 0;
    let totalNet = 0;
    const daysSet = new Set<string>();

    const days = sessions.map(s => {
      const sessionBreaks = allBreaks.filter(b => b.workSessionId === s.id);
      const gross = calculateGrossTime(s.clockInAt, s.clockOutAt);
      const brk = calculateBreakTime(sessionBreaks);
      const net = calculateNetTime(gross, brk);

      totalGross += gross;
      totalBreak += brk;
      totalNet += net;

      const dateStr = formatDate(s.clockInAt);
      daysSet.add(dateStr);

      return {
        id: s.id,
        date: dateStr,
        clockIn: s.clockInAt,
        clockOut: s.clockOutAt,
        grossMs: gross,
        breakMs: brk,
        netMs: net,
        status: s.status
      };
    });

    let employeeInfo = { name: 'All Employees', department: 'All' };
    let targetHours = 160; // Standard monthly default
    if (employeeId && employeeId !== 'all') {
      const [userRecord] = await db.select().from(users).where(eq(users.id, employeeId));
      if (userRecord) {
        employeeInfo = { name: userRecord.fullName, department: 'General' };
      }
      const [memRecord] = await db.select().from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, member.organizationId),
          eq(organizationMembers.userId, employeeId)
        ));
      if (memRecord?.weeklyTargetHours) {
        targetHours = Math.round(Number(memRecord.weeklyTargetHours) * 4.33);
      }
    }

    const totalNetHours = totalNet / (1000 * 60 * 60);
    const difference = totalNetHours - targetHours;

    return {
      employee: employeeInfo,
      period: { year, month, label: `Monthly Report - ${month}/${year}` },
      days,
      totals: {
        totalNet,
        totalBreak,
        totalGross,
        totalNetFormatted: formatDuration(totalNet),
        daysWorked: daysSet.size,
        targetHours,
        difference: Number(difference.toFixed(2))
      }
    };
  } catch (error) {
    console.error('Failed to get monthly report:', error);
    return null;
  }
}

export async function getTeamReport(dateRange: { start: Date; end: Date }, filters?: { employeeId?: string }) {
  try {
    const { member } = await requireRole(['admin', 'manager']);
    
    // Get members in organization
    const memberQuery = db.select({
      id: users.id,
      name: users.fullName,
      email: users.email,
      role: organizationMembers.role,
      weeklyTargetHours: organizationMembers.weeklyTargetHours
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, member.organizationId));

    const members = await memberQuery;
    const filteredMembers = filters?.employeeId && filters.employeeId !== 'all'
      ? members.filter(m => m.id === filters.employeeId)
      : members;

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    const teamResults = await Promise.all(filteredMembers.map(async (emp) => {
      const sessions = await db.select()
        .from(workSessions)
        .where(and(
          eq(workSessions.organizationId, member.organizationId),
          eq(workSessions.employeeId, emp.id),
          gte(workSessions.clockInAt, startDate),
          lte(workSessions.clockInAt, endDate)
        ));

      const sessionIds = sessions.map(s => s.id);
      const allBreaks = sessionIds.length > 0
        ? await db.select().from(breaks).where(inArray(breaks.workSessionId, sessionIds))
        : [];

      let totalNetMs = 0;
      const daysSet = new Set<string>();

      for (const s of sessions) {
        const sessionBreaks = allBreaks.filter(b => b.workSessionId === s.id);
        const gross = calculateGrossTime(s.clockInAt, s.clockOutAt);
        const brk = calculateBreakTime(sessionBreaks);
        totalNetMs += calculateNetTime(gross, brk);
        daysSet.add(formatDate(s.clockInAt));
      }

      const totalHoursNum = totalNetMs / (1000 * 60 * 60);
      
      // Calculate target hours for duration
      const diffDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const weeklyHours = Number(emp.weeklyTargetHours || 40);
      const targetHours = (weeklyHours / 7) * diffDays;
      const overtimeDiffHours = totalHoursNum - targetHours;
      const overtimeSign = overtimeDiffHours >= 0 ? '+' : '-';
      const overtimeFormatted = `${overtimeSign}${formatDuration(Math.abs(overtimeDiffHours) * 3600000)}`;

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        hours: formatDuration(totalNetMs),
        rawNetMs: totalNetMs,
        overtime: overtimeFormatted,
        daysWorked: daysSet.size
      };
    }));

    return {
      team: teamResults,
      aggregates: {
        totalMembers: teamResults.length,
        totalNetMs: teamResults.reduce((acc, t) => acc + t.rawNetMs, 0),
        totalHoursFormatted: formatDuration(teamResults.reduce((acc, t) => acc + t.rawNetMs, 0))
      }
    };
  } catch (error) {
    console.error('Failed to get team report:', error);
    return null;
  }
}

export async function exportCSV(type: 'weekly' | 'monthly', date: Date | string, employeeId?: string) {
  try {
    const { member } = await requireRole(['admin', 'manager']);
    const targetDate = new Date(date);

    const range = type === 'weekly' 
      ? getWeekRange(targetDate)
      : getMonthRange(targetDate);

    const conditions = [
      eq(workSessions.organizationId, member.organizationId),
      gte(workSessions.clockInAt, range.start),
      lte(workSessions.clockInAt, range.end)
    ];

    if (employeeId && employeeId !== 'all') {
      conditions.push(eq(workSessions.employeeId, employeeId));
    }

    const sessions = await db.select({
      id: workSessions.id,
      employeeId: workSessions.employeeId,
      clockInAt: workSessions.clockInAt,
      clockOutAt: workSessions.clockOutAt,
      employeeName: users.fullName
    })
    .from(workSessions)
    .innerJoin(users, eq(workSessions.employeeId, users.id))
    .where(and(...conditions));

    const sessionIds = sessions.map(s => s.id);
    const allBreaks = sessionIds.length > 0
      ? await db.select().from(breaks).where(inArray(breaks.workSessionId, sessionIds))
      : [];

    const rows: string[] = [
      'Date,Day,Employee,Clock In,Clock Out,Break Duration,Gross Duration,Net Duration'
    ];

    let totalGrossMs = 0;
    let totalBreakMs = 0;
    let totalNetMs = 0;

    for (const s of sessions) {
      const sessionBreaks = allBreaks.filter(b => b.workSessionId === s.id);
      const gross = calculateGrossTime(s.clockInAt, s.clockOutAt);
      const brk = calculateBreakTime(sessionBreaks);
      const net = calculateNetTime(gross, brk);

      totalGrossMs += gross;
      totalBreakMs += brk;
      totalNetMs += net;

      const dateFormatted = formatDate(s.clockInAt);
      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(s.clockInAt);
      const inTime = formatTime(s.clockInAt);
      const outTime = s.clockOutAt ? formatTime(s.clockOutAt) : 'In Progress';

      rows.push(
        `"${dateFormatted}","${dayName}","${s.employeeName}","${inTime}","${outTime}","${formatDuration(brk)}","${formatDuration(gross)}","${formatDuration(net)}"`
      );
    }

    rows.push(
      `"TOTAL","","","","","${formatDuration(totalBreakMs)}","${formatDuration(totalGrossMs)}","${formatDuration(totalNetMs)}"`
    );

    return rows.join('\n');
  } catch (error) {
    console.error('Failed to export CSV:', error);
    return '';
  }
}
