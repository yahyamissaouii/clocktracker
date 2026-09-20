'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  formatDuration,
  formatDurationHHMM,
  formatTime,
  formatDate,
  calculateGrossTime,
  calculateBreakTime,
  calculateNetTime,
  getWeekDays,
  DEFAULT_TIMEZONE,
} from '@/lib/time';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { format, addWeeks, subWeeks } from 'date-fns';

interface Session {
  id: string;
  clockInAt: string;
  clockOutAt: string | null;
  status: string;
  note: string | null;
  breaks: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
  }>;
}

interface Props {
  sessions: Session[];
  taskSummary: TaskSummary[];
  weekStart: string;
  weekEnd: string;
  timezone: string;
  targetHours: number;
}

interface DayData {
  date: Date;
  dayName: string;
  dateStr: string;
  sessions: Session[];
  firstClockIn: string | null;
  lastClockOut: string | null;
  totalBreakMs: number;
  totalGrossMs: number;
  totalNetMs: number;
}

export interface TaskSummary {
  id: string;
  title: string;
  minutes: number;
  status: string;
}

export function WeeklyTimesheetContent({ sessions, taskSummary, weekStart, weekEnd, timezone, targetHours }: Props) {
  const router = useRouter();
  const start = new Date(weekStart);
  const end = new Date(weekEnd);

  const days = useMemo(() => {
    const weekDays = getWeekDays(start, timezone);

    return weekDays.map((day): DayData => {
      const dayStart = new Date(day);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const daySessions = sessions.filter(s => {
        const clockIn = new Date(s.clockInAt);
        return clockIn >= dayStart && clockIn <= dayEnd;
      });

      let totalBreakMs = 0;
      let totalGrossMs = 0;

      daySessions.forEach(s => {
        const gross = calculateGrossTime(
          new Date(s.clockInAt),
          s.clockOutAt ? new Date(s.clockOutAt) : null
        );
        const breakMs = calculateBreakTime(
          s.breaks.map(b => ({
            startedAt: new Date(b.startedAt),
            endedAt: b.endedAt ? new Date(b.endedAt) : null,
          }))
        );
        totalGrossMs += gross;
        totalBreakMs += breakMs;
      });

      const totalNetMs = calculateNetTime(totalGrossMs, totalBreakMs);

      const sortedSessions = [...daySessions].sort(
        (a, b) => new Date(a.clockInAt).getTime() - new Date(b.clockInAt).getTime()
      );

      return {
        date: day,
        dayName: format(day, 'EEE'),
        dateStr: formatDate(day, timezone),
        sessions: sortedSessions,
        firstClockIn: sortedSessions.length > 0 ? sortedSessions[0].clockInAt : null,
        lastClockOut: sortedSessions.length > 0
          ? sortedSessions[sortedSessions.length - 1].clockOutAt
          : null,
        totalBreakMs,
        totalGrossMs,
        totalNetMs,
      };
    });
  }, [sessions, start, timezone]);

  const totals = useMemo(() => {
    const totalNetMs = days.reduce((sum, d) => sum + d.totalNetMs, 0);
    const totalBreakMs = days.reduce((sum, d) => sum + d.totalBreakMs, 0);
    const totalGrossMs = days.reduce((sum, d) => sum + d.totalGrossMs, 0);
    const daysWorked = days.filter(d => d.sessions.length > 0).length;
    const targetMs = targetHours * 60 * 60 * 1000;
    const differenceMs = totalNetMs - targetMs;

    return { totalNetMs, totalBreakMs, totalGrossMs, daysWorked, targetMs, differenceMs };
  }, [days, targetHours]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? subWeeks(start, 1) : addWeeks(start, 1);
    router.push(`/timesheet/week?date=${newDate.toISOString()}`);
  };

  const weekLabel = `${formatDate(start, timezone)} – ${formatDate(end, timezone)}`;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateWeek('prev')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md hover:bg-muted"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous Week
        </button>

        <span className="text-sm font-medium">{weekLabel}</span>

        <button
          onClick={() => navigateWeek('next')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md hover:bg-muted"
        >
          Next Week
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left font-medium px-4 py-3 text-muted-foreground">Day</th>
                <th className="text-left font-medium px-4 py-3 text-muted-foreground">Date</th>
                <th className="text-left font-medium px-4 py-3 text-muted-foreground">Start</th>
                <th className="text-left font-medium px-4 py-3 text-muted-foreground">End</th>
                <th className="text-left font-medium px-4 py-3 text-muted-foreground">Break</th>
                <th className="text-right font-medium px-4 py-3 text-muted-foreground">Work</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr
                  key={day.dateStr}
                  className={`border-b last:border-0 ${
                    day.sessions.length === 0 ? 'text-muted-foreground/50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{day.dayName}</td>
                  <td className="px-4 py-3">{day.dateStr}</td>
                  <td className="px-4 py-3">
                    {day.firstClockIn
                      ? formatTime(new Date(day.firstClockIn), timezone)
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {day.lastClockOut
                      ? formatTime(new Date(day.lastClockOut), timezone)
                      : day.sessions.length > 0
                      ? <span className="text-success font-medium">Working...</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {day.totalBreakMs > 0
                      ? formatDurationHHMM(day.totalBreakMs)
                      : day.sessions.length > 0
                      ? '00:00'
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {day.sessions.length > 0
                      ? formatDurationHHMM(day.totalNetMs)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/30 font-medium">
                <td className="px-4 py-3" colSpan={4}>
                  Total ({totals.daysWorked} day{totals.daysWorked !== 1 ? 's' : ''} worked)
                </td>
                <td className="px-4 py-3">
                  {formatDurationHHMM(totals.totalBreakMs)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatDurationHHMM(totals.totalNetMs)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Work</p>
          <p className="text-2xl font-semibold mt-1">{formatDuration(totals.totalNetMs)}</p>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target</p>
          <p className="text-2xl font-semibold mt-1">{targetHours}h</p>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Difference</p>
          <p className={`text-2xl font-semibold mt-1 ${
            totals.differenceMs >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {totals.differenceMs >= 0 ? '+' : ''}{formatDuration(Math.abs(totals.differenceMs))}
          </p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="border-b bg-muted/50 px-4 py-3">
          <h2 className="font-medium">Task time recorded</h2>
          <p className="text-xs text-muted-foreground">Task minutes are a breakdown of your working time and are already included in Work.</p>
        </div>
        {taskSummary.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">No task time recorded this week.</p>
        ) : (
          <div className="divide-y">
            {taskSummary.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0"><p className="truncate font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{task.status === 'completed' ? 'Finished' : 'In progress'}</p></div>
                <span className="shrink-0 font-medium">{formatDurationHHMM(task.minutes * 60000)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Print button */}
      <div className="flex justify-end no-print">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 text-sm px-4 py-2 border rounded-md hover:bg-muted transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print Timesheet
        </button>
      </div>
    </div>
  );
}
