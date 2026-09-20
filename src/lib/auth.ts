import { createClient } from '@/lib/supabase/server';
import { db } from '@/db/index';
import { users, organizationMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { User } from '@supabase/supabase-js';

const configuredAdminEmails = (process.env.ADMIN_EMAILS || 'spampropropro@gmail.com')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isConfiguredAdmin(email: string | undefined) {
  return Boolean(email && configuredAdminEmails.includes(email.toLowerCase()));
}

/**
 * requireAuth() - Simple auth check, returns user or redirects
 */
export async function requireAuth(): Promise<User> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    redirect('/login');
  }
  
  return user;
}

/**
 * getCurrentUser() - Gets authenticated user from Supabase, fetches their profile from our users table
 */
export async function getCurrentUser() {
  const user = await requireAuth();
  
  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
    
  if (!profile) {
    redirect('/login?error=profile_not_found');
  }
  
  return { user, profile };
}

/**
 * getCurrentMember(organizationId?: string) - Gets current user's organization membership
 */
export async function getCurrentMember(organizationId?: string) {
  const { user, profile } = await getCurrentUser();
  
  let member;
  
  if (organizationId) {
    const [foundMember] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, user.id),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1);
    member = foundMember;
  } else {
    // If no orgId provided, gets their first/only org membership
    const [foundMember] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1);
    member = foundMember;
  }
  
  if (!member) {
    redirect('/login?error=not_a_member');
  }
  
  const effectiveRole = isConfiguredAdmin(profile.email) ? 'admin' : member.role;

  return {
    user,
    profile,
    member: {
      ...member,
      role: effectiveRole,
    },
    organizationId: member.organizationId,
  };
}

/**
 * requireRole(roles: string[]) - Checks that current user has one of the specified roles
 */
export async function requireRole(allowedRoles: string[], organizationId?: string) {
  const data = await getCurrentMember(organizationId);
  
  if (!data.member.role || !allowedRoles.includes(data.member.role)) {
    throw new Error('Unauthorized: Insufficient permissions');
  }
  
  return data;
}
