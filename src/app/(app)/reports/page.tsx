import { getCurrentMember } from '@/lib/auth';
import { db } from '@/db/index';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ReportsContent } from '@/components/reports/reports-content';

export default async function ReportsPage() {
  const { profile, organizationId } = await getCurrentMember();

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate and download your timesheets
        </p>
      </div>

      <ReportsContent
        userId={profile.id}
        userName={profile.fullName}
        timezone={organization?.defaultTimezone || 'Europe/Berlin'}
      />
    </div>
  );
}
