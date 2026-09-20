import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

// This script seeds the database with demo data
// Run with: npm run db:seed

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  console.error('DATABASE_URL or DIRECT_URL must be set');
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

function randomId(): string {
  return crypto.randomUUID();
}

function randomTime(baseHour: number, variance: number): { hours: number; minutes: number } {
  const minuteOffset = Math.floor(Math.random() * variance * 60) - (variance * 30);
  let totalMinutes = baseHour * 60 + minuteOffset;
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

async function seed() {
  console.log('🌱 Seeding database...\n');

  // 1. Create organization
  const orgId = randomId();
  await db.insert(schema.organizations).values({
    id: orgId,
    name: 'ClockTrack Demo',
    defaultTimezone: 'Europe/Berlin',
    defaultWeeklyHours: '40',
    timesheetFooter: 'ClockTrack Demo Company — Time tracking made simple',
  });
  console.log('✅ Organization created: ClockTrack Demo');

  // 2. Create users (these IDs must match Supabase auth.users)
  // We'll use placeholder UUIDs — when real users sign up, the seed data won't apply
  // For demo, we create records in our users table
  const employees = [
    { id: randomId(), email: 'admin@clocktrack.dev', fullName: 'Yahya', role: 'admin' as const },
    { id: randomId(), email: 'max@clocktrack.dev', fullName: 'Max Mustermann', role: 'employee' as const },
    { id: randomId(), email: 'anna@clocktrack.dev', fullName: 'Anna Schmidt', role: 'employee' as const },
    { id: randomId(), email: 'john@clocktrack.dev', fullName: 'John Doe', role: 'employee' as const },
    { id: randomId(), email: 'sarah@clocktrack.dev', fullName: 'Sarah Johnson', role: 'employee' as const },
  ];

  for (const emp of employees) {
    // Ensure entry exists in auth.users for foreign key constraint
    await client`
      INSERT INTO auth.users (id, email, aud, role, created_at, updated_at)
      VALUES (${emp.id}::uuid, ${emp.email}, 'authenticated', 'authenticated', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `;

    await db.insert(schema.users).values({
      id: emp.id,
      email: emp.email,
      fullName: emp.fullName,
    }).onConflictDoNothing();

    await db.insert(schema.organizationMembers).values({
      organizationId: orgId,
      userId: emp.id,
      role: emp.role,
      status: 'active',
      weeklyTargetHours: '40',
      department: emp.role === 'admin' ? 'Management' : 'Development',
      startDate: '2024-01-15',
    }).onConflictDoNothing();
  }
  console.log(`✅ ${employees.length} users created`);

  // 3. Generate realistic work sessions for the past 45 days
  const now = new Date();
  let sessionCount = 0;
  let breakCount = 0;

  for (const emp of employees) {
    for (let dayOffset = 45; dayOffset >= 0; dayOffset--) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);

      // Skip weekends (roughly)
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Skip some random days (vacation/sick ~10%)
      if (Math.random() < 0.1 && dayOffset > 1) continue;

      // Random clock-in between 8:00 and 9:30
      const clockInHour = 8 + Math.random() * 1.5;
      const clockInMinute = Math.floor((clockInHour % 1) * 60);
      const clockIn = new Date(date);
      clockIn.setHours(Math.floor(clockInHour), clockInMinute, Math.floor(Math.random() * 60), 0);

      // Random clock-out between 16:30 and 18:30
      const clockOutHour = 16.5 + Math.random() * 2;
      const clockOutMinute = Math.floor((clockOutHour % 1) * 60);
      const clockOut = new Date(date);
      clockOut.setHours(Math.floor(clockOutHour), clockOutMinute, Math.floor(Math.random() * 60), 0);

      // For today (dayOffset === 0), skip if it's the admin - leave one active session for demo
      const isToday = dayOffset === 0;
      const isMissingClockOut = dayOffset === 1 && emp.email === 'max@clocktrack.dev';

      const sessionId = randomId();
      let status: 'active' | 'completed' | 'missing_clock_out' = 'completed';

      if (isToday && emp.email === 'admin@clocktrack.dev') {
        // Leave today's admin session as active (no clock-out)
        status = 'active';
        await db.insert(schema.workSessions).values({
          id: sessionId,
          organizationId: orgId,
          employeeId: emp.id,
          clockInAt: clockIn,
          clockOutAt: null,
          status: 'active',
          source: 'clock',
        });
      } else if (isMissingClockOut) {
        // One missing clock-out for demo
        await db.insert(schema.workSessions).values({
          id: sessionId,
          organizationId: orgId,
          employeeId: emp.id,
          clockInAt: clockIn,
          clockOutAt: null,
          status: 'missing_clock_out',
          source: 'clock',
        });
        status = 'missing_clock_out';
      } else if (!isToday) {
        await db.insert(schema.workSessions).values({
          id: sessionId,
          organizationId: orgId,
          employeeId: emp.id,
          clockInAt: clockIn,
          clockOutAt: clockOut,
          status: 'completed',
          source: 'clock',
        });
      } else {
        // Other employees today - completed or active
        await db.insert(schema.workSessions).values({
          id: sessionId,
          organizationId: orgId,
          employeeId: emp.id,
          clockInAt: clockIn,
          clockOutAt: clockOut,
          status: 'completed',
          source: 'clock',
        });
      }

      sessionCount++;

      // Add a lunch break (most days)
      if (Math.random() > 0.15 && status !== 'missing_clock_out') {
        const breakStartHour = 12 + Math.random() * 0.5;
        const breakDuration = 25 + Math.random() * 35; // 25-60 min

        const breakStart = new Date(date);
        breakStart.setHours(Math.floor(breakStartHour), Math.floor((breakStartHour % 1) * 60), 0, 0);

        const breakEnd = new Date(breakStart.getTime() + breakDuration * 60000);

        // Only add completed breaks for completed/missing sessions
        if (status !== 'active') {
          await db.insert(schema.breaks).values({
            workSessionId: sessionId,
            startedAt: breakStart,
            endedAt: breakEnd,
          });
          breakCount++;
        }
      }
    }
  }

  console.log(`✅ ${sessionCount} work sessions created`);
  console.log(`✅ ${breakCount} breaks created`);

  // 4. Create correction requests
  // Find a session from Max to create a correction for
  const maxUser = employees.find(e => e.email === 'max@clocktrack.dev')!;
  const adminUser = employees.find(e => e.email === 'admin@clocktrack.dev')!;

  const corrReqId1 = randomId();
  const corrReqId2 = randomId();

  // Get a recent session ID for corrections - use a dummy one for seed
  const recentMaxSessions = await db.query.workSessions.findMany({
    where: eq(schema.workSessions.employeeId, maxUser.id),
    limit: 2,
  });

  // We'll skip corrections if we can't find sessions (they'll work with real data)
  console.log('✅ Seed complete!');
  console.log('\n📋 Demo accounts:');
  console.log('   Admin:    admin@clocktrack.dev');
  console.log('   Employee: max@clocktrack.dev');
  console.log('   Employee: anna@clocktrack.dev');
  console.log('   Employee: john@clocktrack.dev');
  console.log('   Employee: sarah@clocktrack.dev');
  console.log('\n⚠️  Note: These users need matching Supabase auth accounts.');
  console.log('   Sign up with these emails to link them to seed data,');
  console.log('   or create fresh accounts and the app will work normally.\n');

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
