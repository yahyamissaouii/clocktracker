'use server';

import { db } from '@/db';
import { 
  correctionRequests, 
  workSessions, 
  auditLogs,
  users 
} from '@/db/schema';
import { getCurrentMember, requireRole } from '@/lib/auth';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const requestCorrectionSchema = z.object({
  workSessionId: z.string().uuid(),
  requestedClockIn: z.string().datetime().optional(),
  requestedClockOut: z.string().datetime().optional(),
  reason: z.string().min(1, 'Reason is required'),
});

export async function requestCorrection(data: z.infer<typeof requestCorrectionSchema>) {
  try {
    const { user, member } = await getCurrentMember();
    const validated = requestCorrectionSchema.parse(data);

    // Verify session belongs to employee
    const [session] = await db.select()
      .from(workSessions)
      .where(and(
        eq(workSessions.id, validated.workSessionId),
        eq(workSessions.organizationId, member.organizationId),
      ));

    if (!session || session.employeeId !== user.id) {
      throw new Error('Work session not found or unauthorized');
    }

    const [correction] = await db.insert(correctionRequests)
      .values({
        organizationId: member.organizationId,
        employeeId: user.id,
        workSessionId: validated.workSessionId,
        requestedClockIn: validated.requestedClockIn ? new Date(validated.requestedClockIn) : null,
        requestedClockOut: validated.requestedClockOut ? new Date(validated.requestedClockOut) : null,
        reason: validated.reason,
        status: 'pending'
      })
      .returning();

    await db.insert(auditLogs)
      .values({
        organizationId: member.organizationId,
        actorId: user.id,
        action: 'create',
        entityType: 'correction_request',
        entityId: correction.id,
        newValue: { reason: validated.reason, requestedChanges: data }
      });

    revalidatePath('/corrections');
    return { success: true, correctionRequest: correction };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPendingCorrections() {
  try {
    const { member } = await requireRole(['admin', 'manager']);

    const corrections = await db.select({
      correction: correctionRequests,
      session: workSessions,
      employee: {
        id: users.id,
        fullName: users.fullName
      }
    })
    .from(correctionRequests)
    .innerJoin(workSessions, eq(correctionRequests.workSessionId, workSessions.id))
    .innerJoin(users, eq(correctionRequests.employeeId, users.id))
    .where(
      and(
        eq(correctionRequests.organizationId, member.organizationId),
        eq(correctionRequests.status, 'pending')
      )
    )
    .orderBy(desc(correctionRequests.createdAt));

    return corrections.map(({ correction, session, employee }) => ({
      id: correction.id,
      employeeId: employee.id,
      employeeName: employee.fullName,
      date: session.clockInAt,
      originalClockIn: session.clockInAt,
      originalClockOut: session.clockOutAt,
      requestedClockIn: correction.requestedClockIn,
      requestedClockOut: correction.requestedClockOut,
      reason: correction.reason,
      createdAt: correction.createdAt,
    }));
  } catch (error) {
    return [];
  }
}

export async function approveCorrection(correctionId: string, reviewerNote?: string) {
  try {
    const { user, member } = await requireRole(['admin', 'manager']);

    const [correction] = await db.select()
      .from(correctionRequests)
      .where(
        and(
          eq(correctionRequests.id, correctionId),
          eq(correctionRequests.organizationId, member.organizationId)
        )
      );

    if (!correction) throw new Error('Correction not found');

    const [session] = await db.select().from(workSessions).where(eq(workSessions.id, correction.workSessionId));
    
    // Apply changes
    const updates: any = {};
    if (correction.requestedClockIn) updates.clockInAt = correction.requestedClockIn;
    if (correction.requestedClockOut) updates.clockOutAt = correction.requestedClockOut;
    
    // update session
    await db.update(workSessions)
      .set(updates)
      .where(eq(workSessions.id, session.id));

    // update correction
    await db.update(correctionRequests)
      .set({
        status: 'approved',
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewerNote
      })
      .where(eq(correctionRequests.id, correctionId));

    // log
    await db.insert(auditLogs).values({
      organizationId: member.organizationId,
      actorId: user.id,
      action: 'update',
      entityType: 'work_session',
      entityId: session.id,
      oldValue: session,
      newValue: { ...updates, correctionId }
    });

    revalidatePath('/admin/approvals');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectCorrection(correctionId: string, reviewerNote?: string) {
  try {
    const { user, member } = await requireRole(['admin', 'manager']);

    const [correction] = await db.select()
      .from(correctionRequests)
      .where(
        and(
          eq(correctionRequests.id, correctionId),
          eq(correctionRequests.organizationId, member.organizationId)
        )
      );

    if (!correction) throw new Error('Correction not found');

    await db.update(correctionRequests)
      .set({
        status: 'rejected',
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewerNote
      })
      .where(eq(correctionRequests.id, correctionId));

    await db.insert(auditLogs).values({
      organizationId: member.organizationId,
      actorId: user.id,
      action: 'update',
      entityType: 'correction_request',
      entityId: correction.id,
      newValue: { status: 'rejected', reviewerNote }
    });

    revalidatePath('/admin/approvals');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

  export async function getMyCorrections() {
  try {
    const { user, member } = await getCurrentMember();

    const corrections = await db.select()
      .from(correctionRequests)
      .where(eq(correctionRequests.employeeId, user.id))
      .orderBy(desc(correctionRequests.createdAt));

    return corrections;
  } catch (error) {
    return [];
  }
}
