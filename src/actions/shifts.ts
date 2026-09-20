'use server';

import { db } from '@/db';
import { auditLogs, breaks, shiftRequests, users, workSessions } from '@/db/schema';
import { getCurrentMember, requireRole } from '@/lib/auth';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const shiftRequestSchema = z.object({
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date'),
  title: z.string().trim().min(1, 'Shift title is required').max(120),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  breakMinutes: z.coerce.number().int().min(0).max(720).default(0),
  notes: z.string().trim().min(1, 'Shift notes are required').max(1000),
}).refine((data) => new Date(data.endAt).getTime() > new Date(data.startAt).getTime(), {
  message: 'Shift end must be after shift start',
  path: ['endAt'],
});

export async function requestCustomShift(data: z.input<typeof shiftRequestSchema>) {
  try {
    const { user, member } = await getCurrentMember();
    const validated = shiftRequestSchema.parse(data);
    const [request] = await db.insert(shiftRequests).values({
      organizationId: member.organizationId,
      employeeId: user.id,
      shiftDate: validated.shiftDate,
      title: validated.title,
      startAt: new Date(validated.startAt),
      endAt: new Date(validated.endAt),
      breakMinutes: validated.breakMinutes,
      notes: validated.notes,
      status: 'pending',
    }).returning();

    await db.insert(auditLogs).values({
      organizationId: member.organizationId,
      actorId: user.id,
      affectedEmployeeId: user.id,
      entityType: 'shift_request',
      entityId: request.id,
      action: 'create',
      newValue: { title: request.title, shiftDate: request.shiftDate },
    });
    revalidatePath('/dashboard');
    revalidatePath('/admin/approvals');
    return { success: true, request };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to submit shift request' };
  }
}

export async function getMyShiftRequests() {
  try {
    const { user, member } = await getCurrentMember();
    return await db.query.shiftRequests.findMany({
      where: and(eq(shiftRequests.organizationId, member.organizationId), eq(shiftRequests.employeeId, user.id)),
      orderBy: [desc(shiftRequests.shiftDate), desc(shiftRequests.createdAt)],
      limit: 20,
    });
  } catch {
    return [];
  }
}

export async function getPendingShiftRequests() {
  try {
    const { member } = await requireRole(['admin']);
    return await db.select({
      id: shiftRequests.id,
      employeeId: shiftRequests.employeeId,
      employeeName: users.fullName,
      employeeEmail: users.email,
      shiftDate: shiftRequests.shiftDate,
      title: shiftRequests.title,
      startAt: shiftRequests.startAt,
      endAt: shiftRequests.endAt,
      breakMinutes: shiftRequests.breakMinutes,
      notes: shiftRequests.notes,
      createdAt: shiftRequests.createdAt,
    })
      .from(shiftRequests)
      .innerJoin(users, eq(shiftRequests.employeeId, users.id))
      .where(and(eq(shiftRequests.organizationId, member.organizationId), eq(shiftRequests.status, 'pending')))
      .orderBy(desc(shiftRequests.createdAt));
  } catch {
    return [];
  }
}

export async function approveShiftRequest(requestId: string, reviewerNote?: string) {
  return reviewShiftRequest(requestId, 'approved', reviewerNote);
}

export async function rejectShiftRequest(requestId: string, reviewerNote?: string) {
  return reviewShiftRequest(requestId, 'rejected', reviewerNote);
}

async function reviewShiftRequest(requestId: string, status: 'approved' | 'rejected', reviewerNote?: string) {
  try {
    const { user, member } = await requireRole(['admin']);
    const [request] = await db.select().from(shiftRequests).where(and(
      eq(shiftRequests.id, requestId),
      eq(shiftRequests.organizationId, member.organizationId),
      eq(shiftRequests.status, 'pending'),
    ));
    if (!request) throw new Error('Shift request not found');

    let createdSessionId: string | undefined;
    if (status === 'approved') {
      // An approved custom shift becomes a completed manual work session so it
      // appears in the employee timesheet and in admin reports.
      const [session] = await db.insert(workSessions).values({
        organizationId: member.organizationId,
        employeeId: request.employeeId,
        clockInAt: request.startAt,
        clockOutAt: request.endAt,
        status: 'completed',
        source: 'manual',
        note: `Shift: ${request.title}\nNotes: ${request.notes}`,
      }).returning();
      createdSessionId = session.id;

      if (request.breakMinutes > 0) {
        const totalMs = request.endAt.getTime() - request.startAt.getTime();
        const breakMs = request.breakMinutes * 60000;
        const breakStart = new Date(request.startAt.getTime() + Math.max(0, (totalMs - breakMs) / 2));
        await db.insert(breaks).values({
          workSessionId: session.id,
          startedAt: breakStart,
          endedAt: new Date(breakStart.getTime() + breakMs),
        });
      }
    }

    await db.update(shiftRequests).set({
      status,
      reviewedBy: user.id,
      reviewedAt: new Date(),
      reviewerNote,
    }).where(eq(shiftRequests.id, requestId));
    await db.insert(auditLogs).values({
      organizationId: member.organizationId,
      actorId: user.id,
      affectedEmployeeId: request.employeeId,
      entityType: 'shift_request',
      entityId: requestId,
      action: status,
      newValue: { status, reviewerNote, createdSessionId },
    });
    revalidatePath('/admin/approvals');
    revalidatePath('/dashboard');
    revalidatePath('/timesheet');
    revalidatePath('/admin/reports');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to review shift request' };
  }
}
