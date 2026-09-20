'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Timer } from 'lucide-react';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  status: 'working' | 'on_break' | 'offline';
  todayHours: string;
  weekHours: string;
  activeTask: { title: string } | null;
  currentNote: string | null;
  openTaskCount: number;
  pendingTasks: string[];
};

export default function TeamClient({ initialStatus }: { initialStatus: TeamMember[] }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(interval);
  }, [router]);

  const working = initialStatus.filter((member) => member.status === 'working').length;
  const onBreak = initialStatus.filter((member) => member.status === 'on_break').length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-start gap-3"><Users className="mt-1 h-6 w-6 text-primary" /><div><h1 className="text-2xl font-bold">Live team view</h1><p className="mt-1 text-sm text-muted-foreground">See who is working, their tracked task, and hours at a glance.</p></div></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">Team</p><p className="mt-1 text-2xl font-semibold">{initialStatus.length}</p></div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4"><p className="text-xs uppercase text-green-700">Working</p><p className="mt-1 text-2xl font-semibold text-green-700">{working}</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs uppercase text-amber-700">On break</p><p className="mt-1 text-2xl font-semibold text-amber-700">{onBreak}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">Offline</p><p className="mt-1 text-2xl font-semibold">{initialStatus.length - working - onBreak}</p></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {initialStatus.map((employee) => (
          <div key={employee.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-semibold">{employee.name}</p><p className="text-xs text-muted-foreground">{employee.email}</p></div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${employee.status === 'working' ? 'bg-green-500/10 text-green-700' : employee.status === 'on_break' ? 'bg-amber-500/10 text-amber-700' : 'bg-muted text-muted-foreground'}`}>{employee.status.replace('_', ' ')}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Today</p><p className="font-medium">{employee.todayHours}</p></div><div><p className="text-xs text-muted-foreground">This week</p><p className="font-medium">{employee.weekHours}</p></div></div>
            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">{employee.activeTask ? <span className="flex items-center gap-2"><Timer className="h-4 w-4 text-primary" />{employee.activeTask.title}</span> : <span className="text-muted-foreground">No task currently tracked</span>}</div>
            {employee.currentNote && <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">{employee.currentNote}</p>}
            <div className="mt-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">{employee.openTaskCount}</span> open task{employee.openTaskCount === 1 ? '' : 's'}{employee.pendingTasks.length > 0 && <span> · {employee.pendingTasks.join(' · ')}</span>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
