import { getCurrentSession, getTodaySessions, getSessionsByDateRange } from "@/actions/clock";
import { getWeekRange, getMonthRange, DEFAULT_TIMEZONE } from "@/lib/time";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { Suspense } from "react";
import { getMyTasks } from '@/actions/tasks';
import { getMyShiftRequests } from '@/actions/shifts';
import { TaskTracker } from '@/components/dashboard/task-tracker';

export default async function DashboardPage() {
  const now = new Date();
  const weekRange = getWeekRange(now, DEFAULT_TIMEZONE);
  const monthRange = getMonthRange(now, DEFAULT_TIMEZONE);

  const [currentSession, todaySessions, weekSessions, monthSessions, tasks, shiftRequests] = await Promise.all([
    getCurrentSession(),
    getTodaySessions(),
    getSessionsByDateRange(weekRange.start, weekRange.end),
    getSessionsByDateRange(monthRange.start, monthRange.end),
    getMyTasks(),
    getMyShiftRequests(),
  ]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 w-full">
      <Suspense fallback={<div>Loading dashboard...</div>}>
        <DashboardContent 
          currentSession={currentSession}
          todaySessions={todaySessions}
          weekSessions={weekSessions}
          monthSessions={monthSessions}
        />
      </Suspense>
      <TaskTracker tasks={JSON.parse(JSON.stringify(tasks))} shiftRequests={JSON.parse(JSON.stringify(shiftRequests))} />
    </div>
  );
}
