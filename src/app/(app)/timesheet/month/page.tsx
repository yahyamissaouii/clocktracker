import { getSessionsByDateRange } from '@/actions/clock';
import { getCurrentMember } from '@/lib/auth';
import { getMonthRange, DEFAULT_TIMEZONE } from '@/lib/time';
import { MonthlyTimesheetContent } from '@/components/timesheet/monthly-timesheet-content';
import { getMyTaskTimeSummary } from '@/actions/tasks';

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function MonthlyTimesheetPage({ searchParams }: Props) {
  const params = await searchParams;
  const { member } = await getCurrentMember();
  const timezone = DEFAULT_TIMEZONE;

  const now = new Date();
  const year = params.year ? parseInt(params.year) : now.getFullYear();
  const month = params.month ? parseInt(params.month) - 1 : now.getMonth();

  const targetDate = new Date(year, month, 15);
  const { start, end } = getMonthRange(targetDate, timezone);

  const [sessions, taskSummary] = await Promise.all([
    getSessionsByDateRange(start, end),
    getMyTaskTimeSummary(start, end),
  ]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Monthly Timesheet</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {monthNames[month]} {year}
        </p>
      </div>

      <MonthlyTimesheetContent
        sessions={JSON.parse(JSON.stringify(sessions))}
        taskSummary={JSON.parse(JSON.stringify(taskSummary))}
        year={year}
        month={month}
        timezone={timezone}
        targetHours={member.weeklyTargetHours ? parseFloat(member.weeklyTargetHours) * 4.33 : 173.33}
      />
    </div>
  );
}
