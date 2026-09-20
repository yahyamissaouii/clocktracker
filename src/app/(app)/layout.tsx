import { db } from '@/db/index';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentMember } from '@/lib/auth';
import { Sidebar } from '@/components/navigation/sidebar';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { UserProvider } from '@/components/providers/user-provider';
import React from 'react';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, member, organizationId } = await getCurrentMember();
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  if (!organization) return null;

  const userContextData = {
    user: {
      id: user.id,
      email: user.email ?? profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
    },
    member: {
      id: member.id,
      organizationId: member.organizationId,
      role: member.role || 'employee',
      status: member.status || 'active',
      weeklyTargetHours: member.weeklyTargetHours,
      department: member.department,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      logoUrl: organization.logoUrl,
      defaultTimezone: organization.defaultTimezone ?? 'Europe/Berlin',
      defaultWeeklyHours: organization.defaultWeeklyHours ?? '40',
    }
  };

  return (
    <UserProvider value={userContextData}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 flex flex-col h-full overflow-y-auto">
          <div className="flex-1 p-4 lg:p-8 pb-20 lg:pb-8">
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </UserProvider>
  );
}
