'use server';

import { db } from '@/db/index';
import { workSessions, breaks, auditLogs, workTasks, taskTimeEntries } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentMember } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { stopActiveTaskEntriesForSession } from '@/actions/tasks';

// ============================================================
// CLOCK IN
// ============================================================
export async function clockIn(taskInput?: { title?: string; description?: string }) {
  const { user, member } = await getCurrentMember();

  // Check for existing active session (idempotent - return existing instead of error)
  const existingSession = await db.query.workSessions.findFirst({
    where: and(
      eq(workSessions.employeeId, user.id),
      eq(workSessions.status, 'active')
    ),
    with: { breaks: true },
  });

  if (existingSession) {
    return { success: true, session: existingSession, alreadyActive: true };
  }

  // Create new session with server timestamp
  const now = new Date();
  const taskTitle = taskInput?.title?.trim() || '';
  const taskDescription = taskInput?.description?.trim() || '';
  if (!taskTitle || !taskDescription) {
    return { success: false, error: 'Task title and notes/details are required before clocking in' };
  }

  const [session] = await db.insert(workSessions).values({
    organizationId: member.organizationId,
    employeeId: user.id,
    clockInAt: now,
    status: 'active',
    source: 'clock',
    note: `Task: ${taskTitle}\nNotes: ${taskDescription}`,
  }).returning();

  {
    const [task] = await db.insert(workTasks).values({
      organizationId: member.organizationId,
      employeeId: user.id,
      title: taskTitle,
      description: taskDescription,
      status: 'in_progress',
      totalMinutes: 0,
    }).returning();
    await db.insert(taskTimeEntries).values({
      taskId: task.id,
      organizationId: member.organizationId,
      employeeId: user.id,
      workSessionId: session.id,
      startedAt: now,
    });
  }

  // Audit log
  await db.insert(auditLogs).values({
    organizationId: member.organizationId,
    actorId: user.id,
    affectedEmployeeId: user.id,
    entityType: 'work_session',
    entityId: session.id,
    action: 'clock_in',
    newValue: { clockInAt: now.toISOString() },
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin/team');

  return { success: true, session, alreadyActive: false };
}

// ============================================================
// CLOCK OUT
// ============================================================
export async function clockOut() {
  const { user, member } = await getCurrentMember();

  // Find active session
  const activeSession = await db.query.workSessions.findFirst({
    where: and(
      eq(workSessions.employeeId, user.id),
      eq(workSessions.status, 'active')
    ),
    with: { breaks: true },
  });

  if (!activeSession) {
    return { success: false, error: 'No active session found' };
  }

  const now = new Date();

  // Stop any task timer that was checked when the employee clocks out so the
  // minutes are not left open indefinitely.
  await stopActiveTaskEntriesForSession(activeSession.id, now);

  // Auto-close any open break
  const openBreak = activeSession.breaks.find(b => !b.endedAt);
  if (openBreak) {
    await db.update(breaks)
      .set({ endedAt: now, updatedAt: now })
      .where(eq(breaks.id, openBreak.id));
  }

  // Close the session
  const [updatedSession] = await db.update(workSessions)
    .set({
      clockOutAt: now,
      status: 'completed',
      updatedAt: now,
    })
    .where(eq(workSessions.id, activeSession.id))
    .returning();

  // Audit log
  await db.insert(auditLogs).values({
    organizationId: member.organizationId,
    actorId: user.id,
    affectedEmployeeId: user.id,
    entityType: 'work_session',
    entityId: activeSession.id,
    action: 'clock_out',
    oldValue: { status: 'active' },
    newValue: {
      clockOutAt: now.toISOString(),
      status: 'completed',
      breakAutoClosed: !!openBreak,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin/team');

  return { success: true, session: updatedSession };
}

// ============================================================
// START BREAK
// ============================================================
export async function startBreak() {
  const { user, member } = await getCurrentMember();

  // Find active session
  const activeSession = await db.query.workSessions.findFirst({
    where: and(
      eq(workSessions.employeeId, user.id),
      eq(workSessions.status, 'active')
    ),
    with: { breaks: true },
  });

  if (!activeSession) {
    return { success: false, error: 'No active session found' };
  }

  // Check for existing open break (idempotent)
  const openBreak = activeSession.breaks.find(b => !b.endedAt);
  if (openBreak) {
    return { success: true, break: openBreak, alreadyOnBreak: true };
  }

  const now = new Date();

  const [newBreak] = await db.insert(breaks).values({
    workSessionId: activeSession.id,
    startedAt: now,
  }).returning();

  // Audit log
  await db.insert(auditLogs).values({
    organizationId: member.organizationId,
    actorId: user.id,
    affectedEmployeeId: user.id,
    entityType: 'break',
    entityId: newBreak.id,
    action: 'break_start',
    newValue: { startedAt: now.toISOString(), workSessionId: activeSession.id },
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin/team');

  return { success: true, break: newBreak, alreadyOnBreak: false };
}

// ============================================================
// END BREAK
// ============================================================
export async function endBreak() {
  const { user, member } = await getCurrentMember();

  // Find active session with breaks
  const activeSession = await db.query.workSessions.findFirst({
    where: and(
      eq(workSessions.employeeId, user.id),
      eq(workSessions.status, 'active')
    ),
    with: { breaks: true },
  });

  if (!activeSession) {
    return { success: false, error: 'No active session found' };
  }

  const openBreak = activeSession.breaks.find(b => !b.endedAt);
  if (!openBreak) {
    return { success: false, error: 'No active break found' };
  }

  const now = new Date();

  const [updatedBreak] = await db.update(breaks)
    .set({ endedAt: now, updatedAt: now })
    .where(eq(breaks.id, openBreak.id))
    .returning();

  // Audit log
  await db.insert(auditLogs).values({
    organizationId: member.organizationId,
    actorId: user.id,
    affectedEmployeeId: user.id,
    entityType: 'break',
    entityId: openBreak.id,
    action: 'break_end',
    oldValue: { startedAt: openBreak.startedAt.toISOString() },
    newValue: { endedAt: now.toISOString() },
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin/team');

  return { success: true, break: updatedBreak };
}

// ============================================================
// GET CURRENT SESSION (for timer reconstruction)
// ============================================================
export async function getCurrentSession() {
  const { user } = await getCurrentMember();

  const activeSession = await db.query.workSessions.findFirst({
    where: and(
      eq(workSessions.employeeId, user.id),
      eq(workSessions.status, 'active')
    ),
    with: { breaks: true },
  });

  return activeSession || null;
}

// ============================================================
// GET TODAY'S SESSIONS
// ============================================================
export async function getTodaySessions(timezone: string = 'Europe/Berlin') {
  const { user } = await getCurrentMember();

  // Get start and end of today in the user's timezone, converted to UTC
  const { TZDate } = await import('@date-fns/tz');
  const { startOfDay, endOfDay } = await import('date-fns');

  const nowInTz = new TZDate(new Date(), timezone);
  const todayStart = startOfDay(nowInTz);
  const todayEnd = endOfDay(nowInTz);

  const sessions = await db.query.workSessions.findMany({
    where: and(
      eq(workSessions.employeeId, user.id),
      // clockInAt is within today
    ),
    with: { breaks: true },
    orderBy: [desc(workSessions.clockInAt)],
  });

  // Filter sessions that overlap with today
  return sessions.filter(s => {
    const clockIn = new Date(s.clockInAt);
    return clockIn >= todayStart && clockIn <= todayEnd;
  });
}

// ============================================================
// GET SESSIONS BY DATE RANGE
// ============================================================
export async function getSessionsByDateRange(
  startDate: Date,
  endDate: Date,
  employeeId?: string
) {
  const { user, member } = await getCurrentMember();
  const targetEmployeeId = employeeId || user.id;

  // If requesting another employee's data, verify admin/manager role
  if (targetEmployeeId !== user.id) {
    if (member.role !== 'admin' && member.role !== 'manager') {
      throw new Error('Unauthorized: Cannot access other employee sessions');
    }
  }

  const sessions = await db.query.workSessions.findMany({
    where: and(
      eq(workSessions.employeeId, targetEmployeeId),
      eq(workSessions.organizationId, member.organizationId)
    ),
    with: {
      breaks: true,
      employee: true,
    },
    orderBy: [desc(workSessions.clockInAt)],
  });

  // Filter to date range
  return sessions.filter(s => {
    const clockIn = new Date(s.clockInAt);
    return clockIn >= startDate && clockIn <= endDate;
  });
}

// ============================================================
// UPDATE SESSION NOTE
// ============================================================
export async function updateSessionNote(sessionId: string, note: string) {
  const { user } = await getCurrentMember();
  const trimmedNote = note.trim();
  if (!trimmedNote) {
    return { success: false, error: 'Entry notes are required' };
  }

  // Verify session belongs to user
  const session = await db.query.workSessions.findFirst({
    where: and(
      eq(workSessions.id, sessionId),
      eq(workSessions.employeeId, user.id)
    ),
  });

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  await db.update(workSessions)
    .set({ note: trimmedNote, updatedAt: new Date() })
    .where(eq(workSessions.id, sessionId));

  revalidatePath('/dashboard');
  revalidatePath('/timesheet');

  return { success: true };
}
