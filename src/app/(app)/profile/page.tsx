import { getCurrentMember } from '@/lib/auth';
import { db } from '@/db/index';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ProfileContent } from '@/components/profile/profile-content';

export default async function ProfilePage() {
  const { user, profile, member, organizationId } = await getCurrentMember();

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your account details
        </p>
      </div>

      <ProfileContent
        user={{
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
        }}
        member={JSON.parse(JSON.stringify(member))}
        organization={{
          id: organization?.id || '',
          name: organization?.name || 'Unknown',
          defaultTimezone: organization?.defaultTimezone || 'Europe/Berlin',
        }}
      />
    </div>
  );
}
