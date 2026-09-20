'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { users, organizations, organizationMembers } from '@/db/schema';
import { isConfiguredAdmin } from '@/lib/auth';

const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export async function signupAction(formData: FormData) {
  const fullName = formData.get('fullName');
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  const parsed = signupSchema.safeParse({ fullName, email, password, confirmPassword });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  
  // 1. Sign up the user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName
      }
    }
  });

  if (authError) {
    return { error: authError.message };
  }

  const authUser = authData.user;
  if (!authUser) {
    return { error: 'Failed to create user account. Please check your email configuration.' };
  }

  // 2. Ensure user row exists in public.users
  await db.insert(users).values({
    id: authUser.id,
    fullName: parsed.data.fullName,
    email: parsed.data.email,
  }).onConflictDoNothing();

  // 3. Connect to existing organization or create new one
  let [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    [org] = await db.insert(organizations).values({
      name: `${parsed.data.fullName}'s Organization`,
      defaultTimezone: 'Europe/Berlin',
      defaultWeeklyHours: '40',
    }).returning();
  }

  // 4. Create organization membership
  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId: authUser.id,
    // Only the configured bootstrap administrator gets admin access. New
    // registrations are employees by default.
    role: isConfiguredAdmin(parsed.data.email) ? 'admin' : 'employee',
    status: 'active',
    weeklyTargetHours: '40',
    department: isConfiguredAdmin(parsed.data.email) ? 'Management' : 'General',
    startDate: new Date().toISOString().split('T')[0],
  }).onConflictDoNothing();

  redirect('/dashboard');
}
