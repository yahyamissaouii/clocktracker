import { getSessionsByDateRange } from '@/actions/clock';
import { getCurrentMember } from '@/lib/auth';
import { getWeekRange, DEFAULT_TIMEZONE } from '@/lib/time';
import { WeeklyTimesheetContent } from '@/components/timesheet/weekly-timesheet-content';
import { getMyTaskTimeSummary } from '@/actions/tasks';

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function WeeklyTimesheetPage({ searchParams }: Props) {
  const params = await searchParams;
  const { member } = await getCurrentMember();
  const timezone = DEFAULT_TIMEZONE;

  // Parse the target date or use today
  const targetDate = params.date ? new Date(params.date) : new Date();
  const { start, end } = getWeekRange(targetDate, timezone);

  const [sessions, taskSummary] = await Promise.all([
    getSessionsByDateRange(start, end),
    getMyTaskTimeSummary(start, end),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly Timesheet</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your work hours for the week
        </p>
      </div>

      <WeeklyTimesheetContent
        sessions={JSON.parse(JSON.stringify(sessions))}
        taskSummary={JSON.parse(JSON.stringify(taskSummary))}
        weekStart={start.toISOString()}
        weekEnd={end.toISOString()}
        timezone={timezone}
        targetHours={member.weeklyTargetHours ? parseFloat(member.weeklyTargetHours) : 40}
      />
    </div>
  );
}
