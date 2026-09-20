import { CalendarView } from '@/components/calendar/calendar-view';
import { getMonthRange, DEFAULT_TIMEZONE } from '@/lib/time';
import { getSessionsByDateRange } from '@/actions/clock';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth();

  const { start, end } = getMonthRange(new Date(year, month, 1), DEFAULT_TIMEZONE);
  const sessions = await getSessionsByDateRange(start, end);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <CalendarView 
        initialYear={year} 
        initialMonth={month} 
        sessions={JSON.parse(JSON.stringify(sessions))}
      />
    </div>
  );
}
