'use server';

import { db } from '@/db';
import { auditLogs, taskEditRequests, taskTimeEntries, users, workSessions, workTasks } from '@/db/schema';
import { getCurrentMember, requireRole } from '@/lib/auth';
import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(120),
  description: z.string().trim().min(1, 'Task details are required').max(1000),
});

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export async function getMyTasks() {
  try {
    const { user, member } = await getCurrentMember();
    const [tasks, pendingEdits] = await Promise.all([
      db.query.workTasks.findMany({
        where: and(
          eq(workTasks.organizationId, member.organizationId),
          eq(workTasks.employeeId, user.id),
        ),
        with: { timeEntries: true },
        orderBy: [desc(workTasks.updatedAt), desc(workTasks.createdAt)],
        limit: 50,
      }),
      db.query.taskEditRequests.findMany({
        where: and(
          eq(taskEditRequests.organizationId, member.organizationId),
          eq(taskEditRequests.employeeId, user.id),
          eq(taskEditRequests.status, 'pending'),
        ),
      }),
    ]);

    return tasks.map((task) => {
      const activeEntry = task.timeEntries.find((entry) => !entry.endedAt);
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        totalMinutes: task.totalMinutes,
        isTracked: Boolean(activeEntry),
        activeStartedAt: activeEntry?.startedAt || null,
        pendingEdit: pendingEdits.some((request) => request.taskId === task.id),
      };
    });
  } catch {
    return [];
  }
}

export async function createTask(data: z.input<typeof taskSchema>) {
  try {
    const { user, member } = await getCurrentMember();
    const validated = taskSchema.parse(data);
    const [task] = await db.insert(workTasks).values({
      organizationId: member.organizationId,
      employeeId: user.id,
      title: validated.title,
      description: validated.description,
      status: 'open',
      totalMinutes: 0,
    }).returning();

    await db.insert(auditLogs).values({
      organizationId: member.organizationId,
      actorId: user.id,
      affectedEmployeeId: user.id,
      entityType: 'work_task',
      entityId: task.id,
      action: 'create',
      newValue: { title: task.title },
    });
    revalidatePath('/dashboard');
    revalidatePath('/admin/team');
    return { success: true, task };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to create task' };
  }
}

export async function toggleTask(taskId: string, checked: boolean) {
  try {
    const { user, member } = await getCurrentMember();
    const task = await db.query.workTasks.findFirst({
      where: and(
        eq(workTasks.id, taskId),
        eq(workTasks.organizationId, member.organizationId),
        eq(workTasks.employeeId, user.id),
      ),
    });
    if (!task) throw new Error('Task not found');
    if (task.status === 'completed' && checked) throw new Error('Finished tasks cannot be tracked again');

    const now = new Date();
    const activeEntry = await db.query.taskTimeEntries.findFirst({
      where: and(
        eq(taskTimeEntries.taskId, taskId),
        eq(taskTimeEntries.employeeId, user.id),
        isNull(taskTimeEntries.endedAt),
      ),
    });

    if (checked) {
      if (activeEntry) return { success: true, isTracked: true };
      const session = await db.query.workSessions.findFirst({
        where: and(
          eq(workSessions.organizationId, member.organizationId),
          eq(workSessions.employeeId, user.id),
          eq(workSessions.status, 'active'),
        ),
      });
      if (!session) throw new Error('Clock in before tracking task time');
      await db.insert(taskTimeEntries).values({
        taskId,
        organizationId: member.organizationId,
        employeeId: user.id,
        workSessionId: session.id,
        startedAt: now,
      });
      await db.update(workTasks).set({ status: 'in_progress', updatedAt: now }).where(eq(workTasks.id, taskId));
    } else {
      if (!activeEntry) return { success: true, isTracked: false };
      const minutes = minutesBetween(activeEntry.startedAt, now);
      await db.update(taskTimeEntries).set({ endedAt: now, durationMinutes: minutes }).where(eq(taskTimeEntries.id, activeEntry.id));
      await db.update(workTasks).set({
        status: 'open',
        totalMinutes: sql`${workTasks.totalMinutes} + ${minutes}`,
        updatedAt: now,
      }).where(eq(workTasks.id, taskId));
    }

    await db.insert(auditLogs).values({
      organizationId: member.organizationId,
      actorId: user.id,
      affectedEmployeeId: user.id,
      entityType: 'work_task',
      entityId: taskId,
      action: checked ? 'track_start' : 'track_stop',
      newValue: { checked },
    });
    revalidatePath('/dashboard');
    revalidatePath('/admin/team');
    return { success: true, isTracked: checked };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to update task tracking' };
  }
}

export async function finishTask(taskId: string) {
  try {
    const { user, member } = await getCurrentMember();
    const task = await db.query.workTasks.findFirst({
      where: and(
        eq(workTasks.id, taskId),
        eq(workTasks.organizationId, member.organizationId),
        eq(workTasks.employeeId, user.id),
      ),
    });
    if (!task) throw new Error('Task not found');
    if (task.status === 'completed') return { success: true, alreadyFinished: true };

    const now = new Date();
    const activeEntry = await db.query.taskTimeEntries.findFirst({
      where: and(
        eq(taskTimeEntries.taskId, taskId),
        eq(taskTimeEntries.employeeId, user.id),
        isNull(taskTimeEntries.endedAt),
      ),
    });
    if (activeEntry) {
      const minutes = minutesBetween(activeEntry.startedAt, now);
      await db.update(taskTimeEntries).set({ endedAt: now, durationMinutes: minutes }).where(eq(taskTimeEntries.id, activeEntry.id));
      await db.update(workTasks).set({
        status: 'completed',
        totalMinutes: sql`${workTasks.totalMinutes} + ${minutes}`,
        updatedAt: now,
      }).where(eq(workTasks.id, taskId));
    } else {
      await db.update(workTasks).set({ status: 'completed', updatedAt: now }).where(eq(workTasks.id, taskId));
    }

    await db.insert(auditLogs).values({
      organizationId: member.organizationId,
      actorId: user.id,
      affectedEmployeeId: user.id,
      entityType: 'work_task',
      entityId: taskId,
      action: 'complete',
      newValue: { completedAt: now.toISOString() },
    });
    revalidatePath('/dashboard');
    revalidatePath('/timesheet');
    revalidatePath('/admin/team');
    return { success: true, alreadyFinished: false };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to finish task' };
  }
}

export async function getMyTaskTimeSummary(startDate: Date, endDate: Date) {
  try {
    const { user, member } = await getCurrentMember();
    const entries = await db.select({
      taskId: taskTimeEntries.taskId,
      title: workTasks.title,
      status: workTasks.status,
      durationMinutes: taskTimeEntries.durationMinutes,
      startedAt: taskTimeEntries.startedAt,
    })
      .from(taskTimeEntries)
      .innerJoin(workTasks, eq(taskTimeEntries.taskId, workTasks.id))
      .where(and(
        eq(taskTimeEntries.organizationId, member.organizationId),
        eq(taskTimeEntries.employeeId, user.id),
        gte(taskTimeEntries.startedAt, startDate),
        lte(taskTimeEntries.startedAt, endDate),
      ));

    const grouped = new Map<string, { id: string; title: string; minutes: number; status: string }>();
    for (const entry of entries) {
      const current = grouped.get(entry.taskId) || { id: entry.taskId, title: entry.title, minutes: 0, status: entry.status };
      current.minutes += entry.durationMinutes;
      current.status = entry.status;
      grouped.set(entry.taskId, current);
    }
    return Array.from(grouped.values()).sort((a, b) => b.minutes - a.minutes);
  } catch {
    return [];
  }
}

export async function updateTask(taskId: string, data: z.input<typeof taskSchema>) {
  try {
    const { user, member } = await getCurrentMember();
    const validated = taskSchema.parse(data);
    const task = await db.query.workTasks.findFirst({
      where: and(
        eq(workTasks.id, taskId),
        eq(workTasks.organizationId, member.organizationId),
        eq(workTasks.employeeId, user.id),
      ),
    });
    if (!task) throw new Error('Task not found');

    const activeEntry = await db.query.taskTimeEntries.findFirst({
      where: and(eq(taskTimeEntries.taskId, taskId), eq(taskTimeEntries.employeeId, user.id), isNull(taskTimeEntries.endedAt)),
    });
    if (activeEntry) {
      const [existing] = await db.select().from(taskEditRequests).where(and(
        eq(taskEditRequests.taskId, taskId),
        eq(taskEditRequests.employeeId, user.id),
        eq(taskEditRequests.status, 'pending'),
      )).limit(1);
      if (existing) return { success: true, approvalRequired: true, requestId: existing.id };
      const [request] = await db.insert(taskEditRequests).values({
        organizationId: member.organizationId,
        taskId,
        employeeId: user.id,
        requestedTitle: validated.title,
        requestedDescription: validated.description,
        status: 'pending',
      }).returning();
      await db.insert(auditLogs).values({
        organizationId: member.organizationId,
        actorId: user.id,
        affectedEmployeeId: user.id,
        entityType: 'task_edit_request',
        entityId: request.id,
        action: 'create',
        newValue: { taskId, title: validated.title },
      });
      revalidatePath('/dashboard');
      revalidatePath('/admin/approvals');
      return { success: true, approvalRequired: true, requestId: request.id };
    }

    await db.update(workTasks).set({
      title: validated.title,
      description: validated.description,
      updatedAt: new Date(),
    }).where(eq(workTasks.id, taskId));
    revalidatePath('/dashboard');
    return { success: true, approvalRequired: false };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to edit task' };
  }
}

export async function stopActiveTaskEntriesForSession(sessionId: string, endedAt = new Date()) {
  const entries = await db.query.taskTimeEntries.findMany({
    where: and(eq(taskTimeEntries.workSessionId, sessionId), isNull(taskTimeEntries.endedAt)),
  });
  for (const entry of entries) {
    const minutes = minutesBetween(entry.startedAt, endedAt);
    await db.update(taskTimeEntries).set({ endedAt, durationMinutes: minutes }).where(eq(taskTimeEntries.id, entry.id));
    await db.update(workTasks).set({
      status: 'open',
      totalMinutes: sql`${workTasks.totalMinutes} + ${minutes}`,
      updatedAt: endedAt,
    }).where(eq(workTasks.id, entry.taskId));
  }
}

export async function getPendingTaskEdits() {
  try {
    const { member } = await requireRole(['admin']);
    return await db.select({
      id: taskEditRequests.id,
      taskId: workTasks.id,
      employeeId: taskEditRequests.employeeId,
      employeeName: users.fullName,
      taskTitle: workTasks.title,
      requestedTitle: taskEditRequests.requestedTitle,
      currentDescription: workTasks.description,
      requestedDescription: taskEditRequests.requestedDescription,
      createdAt: taskEditRequests.createdAt,
    })
      .from(taskEditRequests)
      .innerJoin(workTasks, eq(taskEditRequests.taskId, workTasks.id))
      .innerJoin(users, eq(taskEditRequests.employeeId, users.id))
      .where(and(eq(taskEditRequests.organizationId, member.organizationId), eq(taskEditRequests.status, 'pending')))
      .orderBy(desc(taskEditRequests.createdAt));
  } catch {
    return [];
  }
}

export async function approveTaskEdit(requestId: string, reviewerNote?: string) {
  return reviewTaskEdit(requestId, 'approved', reviewerNote);
}

export async function rejectTaskEdit(requestId: string, reviewerNote?: string) {
  return reviewTaskEdit(requestId, 'rejected', reviewerNote);
}

async function reviewTaskEdit(requestId: string, status: 'approved' | 'rejected', reviewerNote?: string) {
  try {
    const { user, member } = await requireRole(['admin']);
    const [request] = await db.select().from(taskEditRequests).where(and(
      eq(taskEditRequests.id, requestId),
      eq(taskEditRequests.organizationId, member.organizationId),
      eq(taskEditRequests.status, 'pending'),
    ));
    if (!request) throw new Error('Task edit request not found');

    if (status === 'approved') {
      await db.update(workTasks).set({
        title: request.requestedTitle,
        description: request.requestedDescription,
        updatedAt: new Date(),
      }).where(and(eq(workTasks.id, request.taskId), eq(workTasks.organizationId, member.organizationId)));
    }
    await db.update(taskEditRequests).set({ status, reviewedBy: user.id, reviewedAt: new Date(), reviewerNote }).where(eq(taskEditRequests.id, requestId));
    await db.insert(auditLogs).values({
      organizationId: member.organizationId,
      actorId: user.id,
      affectedEmployeeId: request.employeeId,
      entityType: 'task_edit_request',
      entityId: requestId,
      action: status,
      newValue: { status, reviewerNote },
    });
    revalidatePath('/admin/approvals');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to review task edit' };
  }
}
