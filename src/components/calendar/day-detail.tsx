'use client';

import { Session } from '@/components/timesheet/monthly-timesheet-content';
import { 
  calculateGrossTime, 
  calculateBreakTime, 
  calculateNetTime, 
  formatDurationHHMM, 
  formatTime 
} from '@/lib/time';

interface Props {
  date: Date;
  sessions: Session[];
}

export function DayDetail({ date, sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No work recorded for this day.</p>
      </div>
    );
  }

  const getSessionStart = (s: any) => s.clockInAt || s.startTime;
  const getSessionEnd = (s: any) => s.clockOutAt || s.endTime;

  const totalNet = sessions.reduce((acc, s) => {
    const gross = calculateGrossTime(getSessionStart(s), getSessionEnd(s));
    const breakTime = s.breaks ? calculateBreakTime(s.breaks) : (s.breakDuration || 0);
    return acc + calculateNetTime(gross, breakTime);
  }, 0);
  const totalBreak = sessions.reduce((acc, s) => {
    if (s.breaks) return acc + calculateBreakTime(s.breaks);
    return acc + (s.breakDuration || 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border">
        <div>
          <p className="text-sm text-gray-500">Total Worked</p>
          <p className="text-xl font-bold text-green-600">{formatDurationHHMM(totalNet)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Total Break</p>
          <p className="text-lg font-medium text-gray-700">{formatDurationHHMM(totalBreak)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-gray-700">Sessions</h4>
        {sessions.map((session, idx) => (
          <div key={session.id || idx} className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium text-gray-800">Session {idx + 1}</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{session.type || 'Standard'}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Clock In</p>
                <p className="font-medium">{formatTime(getSessionStart(session))}</p>
              </div>
              <div>
                <p className="text-gray-500">Clock Out</p>
                <p className="font-medium">
                  {getSessionEnd(session) ? formatTime(getSessionEnd(session)) : (
                    <span className="text-green-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Working...
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Break</p>
                <p className="font-medium">
                  {formatDurationHHMM(session.breaks ? calculateBreakTime(session.breaks) : (session.breakDuration || 0))}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Net Time</p>
                <p className="font-medium">
                  {formatDurationHHMM(
                    calculateNetTime(
                      calculateGrossTime(getSessionStart(session), getSessionEnd(session)),
                      session.breaks ? calculateBreakTime(session.breaks) : (session.breakDuration || 0)
                    )
                  )}
                </p>
              </div>
            </div>

            {session.note && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs text-gray-500">Note</p>
                <p className="text-sm italic">{session.note}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pt-4 border-t">
        <button className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          Request Correction
        </button>
      </div>
    </div>
  );
}
