'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  format, 
  addMonths, 
  subMonths, 
  setMonth, 
  setYear, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  isWeekend,
  isSameDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { calculateNetTime, formatDurationHHMM, calculateGrossTime, calculateBreakTime } from '@/lib/time';
import { Session } from '@/components/timesheet/monthly-timesheet-content';
import { DayDetail } from './day-detail';

interface Props {
  initialYear: number;
  initialMonth: number;
  sessions: Session[];
}

export function CalendarView({ initialYear, initialMonth, sessions }: Props) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(setYear(setMonth(new Date(), initialMonth), initialYear));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const handlePrevMonth = () => {
    const prev = subMonths(currentDate, 1);
    setCurrentDate(prev);
    router.push(`/calendar?year=${prev.getFullYear()}&month=${prev.getMonth()}`);
  };

  const handleNextMonth = () => {
    const next = addMonths(currentDate, 1);
    setCurrentDate(next);
    router.push(`/calendar?year=${next.getFullYear()}&month=${next.getMonth()}`);
  };

  // Generate calendar grid
  const monthStart = setYear(setMonth(new Date(), currentDate.getMonth()), currentDate.getFullYear());
  monthStart.setDate(1); // Set to start of month
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const getSessionStart = (s: any) => s.clockInAt || s.startTime;
  const getSessionEnd = (s: any) => s.clockOutAt || s.endTime;

  const daysWithData = calendarDays.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const daySessions = sessions.filter(s => {
      const start = getSessionStart(s);
      if (!start) return false;
      const str = typeof start === 'string' ? start : new Date(start).toISOString();
      return str.startsWith(dayStr);
    });
    const dayNetSecs = daySessions.reduce((acc, s) => {
      const gross = calculateGrossTime(getSessionStart(s), getSessionEnd(s));
      const breakTime = s.breaks ? calculateBreakTime(s.breaks) : (s.breakDuration || 0);
      return acc + calculateNetTime(gross, breakTime);
    }, 0);
    const hasActiveSession = daySessions.some(s => !getSessionEnd(s));

    return {
      date: day,
      sessions: daySessions,
      netSecs: dayNetSecs,
      hasActiveSession
    };
  });

  const totalMonthNetSecs = daysWithData
    .filter(d => isSameMonth(d.date, currentDate))
    .reduce((acc, d) => acc + d.netSecs, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={handlePrevMonth} className="p-2 border rounded hover:bg-gray-100">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold w-48 text-center">{format(currentDate, 'MMMM yyyy')}</h2>
          <button onClick={handleNextMonth} className="p-2 border rounded hover:bg-gray-100">
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="bg-gray-50 border px-4 py-2 rounded-lg text-sm font-medium">
          Total this month: <span className="text-blue-600">{formatDurationHHMM(totalMonthNetSecs)}</span>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {weekDays.map(day => (
            <div key={day} className="py-2 text-center text-sm font-semibold text-gray-500">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7">
          {daysWithData.map((cell, idx) => {
            const isCurrentMonth = isSameMonth(cell.date, currentDate);
            const isWknd = isWeekend(cell.date);
            const isTdy = isToday(cell.date);
            const isSelected = selectedDay && isSameDay(selectedDay, cell.date);
            
            let bgClass = 'bg-white';
            if (!isCurrentMonth) bgClass = 'bg-gray-50 text-gray-400';
            else if (isSelected) bgClass = 'bg-blue-50';
            else if (isWknd) bgClass = 'bg-gray-50';

            return (
              <div 
                key={cell.date.toISOString()} 
                onClick={() => setSelectedDay(cell.date)}
                className={`min-h-[80px] p-2 border-r border-b cursor-pointer transition-colors hover:bg-blue-50 relative ${bgClass} ${isTdy ? 'ring-2 ring-inset ring-blue-500' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-sm font-medium ${isTdy ? 'text-blue-600' : ''}`}>
                    {format(cell.date, 'd')}
                  </span>
                  {cell.hasActiveSession && (
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  )}
                </div>
                
                {cell.netSecs > 0 && isCurrentMonth && (
                  <div className="mt-2 text-xs font-semibold text-green-700 bg-green-50 rounded px-1.5 py-0.5 inline-block">
                    {formatDurationHHMM(cell.netSecs)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">{format(selectedDay, 'EEEE, MMMM d, yyyy')}</h3>
              <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <DayDetail 
                date={selectedDay} 
                sessions={sessions.filter(s => {
                  const start = getSessionStart(s);
                  if (!start) return false;
                  const str = typeof start === 'string' ? start : new Date(start).toISOString();
                  return str.startsWith(format(selectedDay, 'yyyy-MM-dd'));
                })} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
