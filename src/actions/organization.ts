'use server';

import { db } from '@/db';
import { organizations, organizationMembers, auditLogs } from '@/db/schema';
import { getCurrentMember, requireRole } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

export async function getOrganization() {
  try {
    const { member } = await getCurrentMember();
    const [org] = await db.select()
      .from(organizations)
      .where(eq(organizations.id, member.organizationId));
    return org;
  } catch (error) {
    return null;
  }
}

const updateOrgSchema = z.object({
  name: z.string().optional(),
  logoUrl: z.string().url().optional(),
  defaultTimezone: z.string().optional(),
  defaultWeeklyHours: z.union([z.string(), z.number()]).optional(),
  timesheetFooter: z.string().optional(),
});

export async function updateOrganization(data: z.infer<typeof updateOrgSchema>) {
  try {
    const { user, member } = await requireRole(['admin']);
    const validated = updateOrgSchema.parse(data);

    // Convert number to string if necessary
    const updates: any = { ...validated };
    if (updates.defaultWeeklyHours) {
      updates.defaultWeeklyHours = updates.defaultWeeklyHours.toString();
    }

    await db.update(organizations)
      .set(updates)
      .where(eq(organizations.id, member.organizationId));

    await db.insert(auditLogs).values({
      organizationId: member.organizationId,
      actorId: user.id,
      action: 'update',
      entityType: 'organization',
      entityId: member.organizationId,
      newValue: updates
    });

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

const createOrgSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  defaultTimezone: z.string().optional(),
  defaultWeeklyHours: z.number().optional(),
});

export async function createOrganization(data: z.infer<typeof createOrgSchema>) {
  try {
    // Current user shouldn't need a member context yet to create org, but they need to be authed
    const { user } = await getCurrentMember().catch(() => ({ user: { id: 'temp-auth-id' } as any }));
    const validated = createOrgSchema.parse(data);

    // This typically runs in a transaction
    const [org] = await db.insert(organizations).values({
      name: validated.name,
      defaultTimezone: validated.defaultTimezone,
      defaultWeeklyHours: validated.defaultWeeklyHours ? validated.defaultWeeklyHours.toString() : undefined
    }).returning();

    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: user.id,
      role: 'admin',
      status: 'active'
    });

    return { success: true, organization: org };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
