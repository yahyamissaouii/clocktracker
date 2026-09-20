'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { format, addMonths, subMonths, setMonth, setYear } from 'date-fns';
import { 
  calculateGrossTime, 
  calculateBreakTime, 
  calculateNetTime, 
  formatDurationHHMM, 
  formatTime, 
  formatDate,
  getMonthDays,
  DEFAULT_TIMEZONE
} from '@/lib/time';

export interface Session {
  id: string;
  startTime?: string;
  endTime?: string | null;
  clockInAt?: Date | string;
  clockOutAt?: Date | string | null;
  breaks?: Array<{ startedAt?: Date | string | null; endedAt?: Date | string | null; startTime?: Date | string | null; endTime?: Date | string | null }>;
  breakDuration?: number;
  type?: string;
  note?: string | null;
}

interface Props {
  sessions: Session[];
  taskSummary: TaskSummary[];
  year: number;
  month: number;
  timezone: string;
  targetHours: number;
}

interface TaskSummary {
  id: string;
  title: string;
  minutes: number;
  status: string;
}

export function MonthlyTimesheetContent({ sessions, taskSummary, year, month, timezone, targetHours }: Props) {
  const router = useRouter();
  
  const currentDate = setYear(setMonth(new Date(), month), year);
  const daysInMonth = getMonthDays(currentDate);
  
  const handlePrevMonth = () => {
    const prev = subMonths(currentDate, 1);
    router.push(`/timesheet/month?year=${prev.getFullYear()}&month=${prev.getMonth()}`);
  };

  const handleNextMonth = () => {
    const next = addMonths(currentDate, 1);
    router.push(`/timesheet/month?year=${next.getFullYear()}&month=${next.getMonth()}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const getSessionStart = (s: any) => s.clockInAt || s.startTime;
  const getSessionEnd = (s: any) => s.clockOutAt || s.endTime;

  const rows = daysInMonth.map(date => {
    const dayStr = format(date, 'yyyy-MM-dd');
    const daySessions = sessions.filter(s => {
      const start = getSessionStart(s);
      if (!start) return false;
      const str = typeof start === 'string' ? start : new Date(start).toISOString();
      return str.startsWith(dayStr);
    });
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    const dayGross = daySessions.reduce((acc, s) => {
      return acc + calculateGrossTime(getSessionStart(s), getSessionEnd(s));
    }, 0);
    const dayBreak = daySessions.reduce((acc, s) => {
      if (s.breaks) return acc + calculateBreakTime(s.breaks);
      return acc + (s.breakDuration || 0);
    }, 0);
    const dayNet = calculateNetTime(dayGross, dayBreak);

    return {
      date,
      isWeekend,
      sessions: daySessions,
      dayGross,
      dayBreak,
      dayNet
    };
  });

  const daysWorked = rows.filter(r => r.sessions.length > 0).length;
  const totalGross = rows.reduce((acc, r) => acc + r.dayGross, 0);
  const totalBreak = rows.reduce((acc, r) => acc + r.dayBreak, 0);
  const totalNet = rows.reduce((acc, r) => acc + r.dayNet, 0);

  const targetSecs = targetHours * 3600;
  const diffSecs = totalNet - targetSecs;
  const diffColor = diffSecs >= 0 ? 'text-green-600' : 'text-red-600';
  const diffSign = diffSecs >= 0 ? '+' : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg border">
        <div className="flex items-center space-x-2">
          <button onClick={handlePrevMonth} className="p-2 border rounded hover:bg-gray-50 text-gray-600">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-lg px-2">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button onClick={handleNextMonth} className="p-2 border rounded hover:bg-gray-50 text-gray-600">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button 
          onClick={handlePrint}
          className="flex items-center space-x-2 px-4 py-2 border rounded hover:bg-gray-50 text-gray-700 w-full sm:w-auto justify-center"
        >
          <Printer className="w-4 h-4" />
          <span>Print Timesheet</span>
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Day</th>
              <th className="px-4 py-3 font-medium">Clock In</th>
              <th className="px-4 py-3 font-medium">Clock Out</th>
              <th className="px-4 py-3 font-medium">Break</th>
              <th className="px-4 py-3 font-medium">Work</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date.toISOString()} className={`border-b ${row.isWeekend ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-4 py-3">{formatDate(row.date)}</td>
                <td className="px-4 py-3">{format(row.date, 'E')}</td>
                {row.sessions.length > 0 ? (
                  <>
                    <td className="px-4 py-3">{row.sessions.map(s => formatTime(getSessionStart(s))).join(', ')}</td>
                    <td className="px-4 py-3">{row.sessions.map(s => getSessionEnd(s) ? formatTime(getSessionEnd(s)) : 'Working...').join(', ')}</td>
                    <td className="px-4 py-3">{formatDurationHHMM(row.dayBreak)}</td>
                    <td className="px-4 py-3 font-medium">{formatDurationHHMM(row.dayNet)}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-gray-400">-</td>
                    <td className="px-4 py-3 text-gray-400">-</td>
                    <td className="px-4 py-3 text-gray-400">-</td>
                    <td className="px-4 py-3 text-gray-400">-</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg border grid grid-cols-2 md:grid-cols-3 gap-6">
        <div>
          <p className="text-sm text-gray-500">Days worked</p>
          <p className="text-xl font-semibold">{daysWorked}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Gross presence</p>
          <p className="text-xl font-semibold">{formatDurationHHMM(totalGross)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Breaks</p>
          <p className="text-xl font-semibold">{formatDurationHHMM(totalBreak)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Net working time</p>
          <p className="text-xl font-semibold">{formatDurationHHMM(totalNet)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Target</p>
          <p className="text-xl font-semibold">{targetHours}h 00m</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Difference</p>
          <p className={`text-xl font-semibold ${diffColor}`}>
            {diffSecs > 0 ? '+' : '-'}{formatDurationHHMM(Math.abs(diffSecs))}
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
        <div className="border-b bg-gray-50 px-4 py-3">
          <h2 className="font-medium">Task time recorded</h2>
          <p className="text-xs text-gray-500">Task minutes are a breakdown of your working time and are already included in Net working time.</p>
        </div>
        {taskSummary.length === 0 ? (
          <p className="px-4 py-5 text-sm text-gray-500">No task time recorded this month.</p>
        ) : (
          <div className="divide-y">
            {taskSummary.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0"><p className="truncate font-medium">{task.title}</p><p className="text-xs text-gray-500">{task.status === 'completed' ? 'Finished' : 'In progress'}</p></div>
                <span className="shrink-0 font-medium">{formatDurationHHMM(task.minutes * 60000)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
