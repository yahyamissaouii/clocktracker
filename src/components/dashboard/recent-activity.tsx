"use client";

import { formatTime, calculateGrossTime, calculateBreakTime, calculateNetTime, formatDuration } from "@/lib/time";
import { AlertCircle } from "lucide-react";

interface RecentActivityProps {
  sessions: any[];
  tz: string;
  currentSession: any;
}

export function RecentActivity({ sessions, tz, currentSession }: RecentActivityProps) {
  const getClockIn = (s: any) => s?.clockInAt || s?.clockIn;
  const getClockOut = (s: any) => s?.clockOutAt || s?.clockOut;

  const allSessions = [...(sessions || [])];
  
  if (currentSession && !allSessions.find(s => s.id === currentSession.id)) {
    allSessions.unshift(currentSession);
  }

  allSessions.sort((a, b) => {
    const aTime = new Date(getClockIn(a) || 0).getTime();
    const bTime = new Date(getClockIn(b) || 0).getTime();
    return bTime - aTime;
  });
  const displaySessions = allSessions.slice(0, 7);

  if (displaySessions.length === 0) {
    return <div className="text-gray-500 py-4">No recent activity.</div>;
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {displaySessions.map((session, i) => {
        const isActive = currentSession?.id && session.id === currentSession.id;
        const clockInVal = getClockIn(session);
        const clockOutVal = getClockOut(session);
        const start = clockInVal ? new Date(clockInVal) : new Date();
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(start);
        
        let timeString = "";
        let breakTotal = 0;
        let netTotal = 0;
        let isMissingClockOut = false;

        if (isActive || !clockOutVal) {
          timeString = `${formatTime(start, tz)} → Working...`;
          isMissingClockOut = !isActive; 
        } else {
          const end = new Date(clockOutVal);
          timeString = `${formatTime(start, tz)} → ${formatTime(end, tz)}`;
          const gross = calculateGrossTime(clockInVal, clockOutVal);
          breakTotal = calculateBreakTime(session.breaks || []);
          netTotal = calculateNetTime(gross, breakTotal);
        }

        return (
          <div key={session.id || i} className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between ${isActive ? 'bg-green-50/50 dark:bg-green-900/10 -mx-4 px-4 rounded-lg' : ''}`}>
            <div className="flex items-center space-x-4 mb-2 sm:mb-0">
              <div className="w-12 sm:w-16 flex-shrink-0">
                <div className="font-medium text-gray-900 dark:text-gray-100">{dayName}</div>
              </div>
              <div className="text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {timeString}
              </div>
              {isMissingClockOut && (
                <div className="flex items-center text-amber-500 text-sm ml-2" title="Missing clock out">
                  <AlertCircle className="w-4 h-4 mr-1" />
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-6 sm:ml-auto pl-16 sm:pl-0 text-sm">
              {(!isActive && !isMissingClockOut) && (
                <>
                  {breakTotal > 0 && (
                    <div className="text-gray-500">
                      Break: {formatDuration(breakTotal)}
                    </div>
                  )}
                  <div className="font-semibold text-gray-900 dark:text-gray-100 min-w-[4rem] text-right">
                    {formatDuration(netTotal)}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
