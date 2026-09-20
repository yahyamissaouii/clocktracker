"use client";

import { useUser } from "@/components/providers/user-provider";
import { LiveTimer } from "./live-timer";
import { StatCard } from "./stat-card";
import { RecentActivity } from "./recent-activity";
import { clockIn, clockOut, startBreak, endBreak } from "@/actions/clock";
import { calculateGrossTime, calculateBreakTime, calculateNetTime, formatDuration, formatTime, formatDate, getGreeting } from "@/lib/time";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Play, Square, Coffee, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface DashboardContentProps {
  currentSession: any;
  todaySessions: any[];
  weekSessions: any[];
  monthSessions: any[];
}

export function DashboardContent({ currentSession, todaySessions, weekSessions, monthSessions }: DashboardContentProps) {
  const { user, member, organization } = useUser();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockInTaskTitle, setClockInTaskTitle] = useState('');
  const [clockInTaskDescription, setClockInTaskDescription] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update time every minute
    return () => clearInterval(timer);
  }, []);

  const tz = organization?.defaultTimezone || 'Europe/Berlin';

  const getClockIn = (s: any) => s?.clockInAt || s?.clockIn;
  const getClockOut = (s: any) => s?.clockOutAt || s?.clockOut;
  const getBreakStart = (b: any) => b?.startedAt || b?.startTime;
  const getBreakEnd = (b: any) => b?.endedAt || b?.endTime;
  
  const calculateTotalTime = (sessions: any[]) => {
    return (sessions || []).reduce((acc, session) => {
      const clockInVal = getClockIn(session);
      const clockOutVal = getClockOut(session);
      if (!clockInVal) return acc;
      const gross = calculateGrossTime(clockInVal, clockOutVal);
      const breakTime = calculateBreakTime(session.breaks || []);
      return acc + calculateNetTime(gross, breakTime);
    }, 0);
  };

  const todayTotal = calculateTotalTime(todaySessions);
  const weekTotal = calculateTotalTime(weekSessions);
  const monthTotal = calculateTotalTime(monthSessions);

  const activeBreak = currentSession?.breaks?.find((b: any) => !getBreakEnd(b));
  const isClockedIn = !!currentSession && !getClockOut(currentSession);
  const isOnBreak = !!activeBreak;

  const handleClockIn = () => {
    startTransition(async () => {
      const res = await clockIn({ title: clockInTaskTitle, description: clockInTaskDescription });
      if (res.success) {
        toast.success("Clocked in successfully");
        setClockInTaskTitle('');
        setClockInTaskDescription('');
        router.refresh();
      } else {
        toast.error("Failed to clock in");
      }
    });
  };

  const handleClockOut = () => {
    startTransition(async () => {
      const res = await clockOut();
      if (res.success) {
        toast.success("Clocked out successfully");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to clock out");
      }
    });
  };

  const handleStartBreak = () => {
    startTransition(async () => {
      const res = await startBreak();
      if (res.success) {
        toast.success("Break started");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to start break");
      }
    });
  };

  const handleEndBreak = () => {
    startTransition(async () => {
      const res = await endBreak();
      if (res.success) {
        toast.success("Break ended");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to end break");
      }
    });
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {getGreeting()}, {user?.fullName || 'User'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          {formatDate(currentTime, tz)}  {formatTime(currentTime, tz)}
        </p>
      </div>

      <div className={`p-6 rounded-xl border-2 transition-colors ${
        !isClockedIn ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900' :
        isOnBreak ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' :
        'border-green-500 bg-green-50 dark:bg-green-950/20'
      }`}>
        {!isClockedIn ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex items-center space-x-2 text-gray-500 mb-6">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="font-semibold tracking-wider text-sm uppercase">Not Clocked In</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-8 text-center text-lg">
              You are not currently working
            </p>
            <div className="mb-6 grid w-full max-w-xl gap-3 text-left md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="clock-in-task-title" className="mb-1 block text-sm font-medium">Task title <span className="text-destructive">*</span></label>
                <input id="clock-in-task-title" value={clockInTaskTitle} onChange={(event) => setClockInTaskTitle(event.target.value)} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="What are you working on?" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="clock-in-task-description" className="mb-1 block text-sm font-medium">Notes and details <span className="text-destructive">*</span></label>
                <textarea id="clock-in-task-description" value={clockInTaskDescription} onChange={(event) => setClockInTaskDescription(event.target.value)} rows={2} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Add context for this work" />
              </div>
            </div>
            <button
              onClick={handleClockIn}
              disabled={isPending}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-12 py-4 rounded-lg font-bold text-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              {isPending ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
              <span>CLOCK IN</span>
            </button>
          </div>
        ) : isOnBreak ? (
          <div className="flex flex-col items-center justify-center py-6">
             <div className="flex items-center space-x-2 text-amber-600 mb-4">
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-semibold tracking-wider text-sm uppercase">On Break</span>
            </div>
            <div className="text-amber-700 dark:text-amber-500 text-3xl font-mono mb-2 font-medium">
               Break: <LiveTimer startTime={getBreakStart(activeBreak) || new Date()} />
            </div>
            <p className="text-gray-500 text-sm mb-8">
              Started at {formatTime(getBreakStart(activeBreak), tz)}
            </p>
            <button
              onClick={handleEndBreak}
              disabled={isPending}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-lg font-bold text-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 w-full md:w-auto justify-center"
            >
              {isPending ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
              <span>END BREAK</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="flex items-center space-x-2 text-green-600 mb-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="font-semibold tracking-wider text-sm uppercase">Clocked In</span>
            </div>
            <div className="text-5xl md:text-7xl font-mono font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
              <LiveTimer startTime={getClockIn(currentSession) || new Date()} />
            </div>
            <p className="text-gray-500 text-sm mb-8">
              Started at {formatTime(getClockIn(currentSession), tz)}
            </p>
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 w-full md:w-auto">
              <button
                onClick={handleStartBreak}
                disabled={isPending}
                className="flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-lg font-bold text-lg shadow-md transition-transform active:scale-95 disabled:opacity-50 flex-1 md:flex-none"
              >
                {isPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Coffee className="w-5 h-5" />}
                <span>TAKE BREAK</span>
              </button>
              <button
                onClick={handleClockOut}
                disabled={isPending}
                className="flex items-center justify-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-lg font-bold text-lg shadow-md transition-transform active:scale-95 disabled:opacity-50 flex-1 md:flex-none"
              >
                {isPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 fill-current" />}
                <span>CLOCK OUT</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="TODAY" value={formatDuration(todayTotal)} />
        <StatCard label="THIS WEEK" value={formatDuration(weekTotal)} sublabel={member?.weeklyTargetHours ? `target: ${member.weeklyTargetHours}h` : undefined} />
        <StatCard label="THIS MONTH" value={formatDuration(monthTotal)} />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Recent Activity</h2>
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
           <RecentActivity sessions={weekSessions} tz={tz} currentSession={currentSession} />
        </div>
      </div>
    </div>
  );
}
