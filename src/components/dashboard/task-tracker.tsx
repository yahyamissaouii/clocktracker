'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CheckSquare, Clock3, Edit3, Plus, Send, Timer, X } from 'lucide-react';
import { toast } from 'sonner';
import { createTask, finishTask, toggleTask, updateTask } from '@/actions/tasks';
import { requestCustomShift } from '@/actions/shifts';
import { formatDuration, formatTime } from '@/lib/time';

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  totalMinutes: number;
  status: 'open' | 'in_progress' | 'completed';
  isTracked: boolean;
  pendingEdit: boolean;
}

interface ShiftItem {
  id: string;
  shiftDate: string;
  title: string;
  startAt: Date | string;
  endAt: Date | string;
  status: string;
  notes: string | null;
}

const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20';

export function TaskTracker({ tasks, shiftRequests }: { tasks: TaskItem[]; shiftRequests: ShiftItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [shiftOpen, setShiftOpen] = useState(false);

  const run = (work: () => Promise<{ success: boolean; error?: string; approvalRequired?: boolean }>, successMessage?: string) => {
    startTransition(async () => {
      const result = await work();
      if (!result.success) {
        toast.error(result.error || 'Something went wrong');
        return;
      }
      if (successMessage) toast.success(successMessage);
      router.refresh();
    });
  };

  const handleCreateTask = (event: React.FormEvent) => {
    event.preventDefault();
    run(
      () => createTask({ title: newTitle, description: newDescription }),
      'Task added',
    );
    setNewTitle('');
    setNewDescription('');
  };

  const beginEdit = (task: TaskItem) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
  };

  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    const id = editingId;
    run(async () => {
      const result = await updateTask(id, { title: editTitle, description: editDescription });
      if (result.success && result.approvalRequired) {
        toast.success('Edit submitted for admin approval');
      }
      return result;
    });
    setEditingId(null);
  };

  const handleShift = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get('shiftDate'));
    const start = String(form.get('startTime'));
    const end = String(form.get('endTime'));
    run(
      () => requestCustomShift({
        shiftDate: date,
        title: String(form.get('title')),
        startAt: new Date(`${date}T${start}:00`).toISOString(),
        endAt: new Date(`${date}T${end}:00`).toISOString(),
        breakMinutes: Number(form.get('breakMinutes') || 0),
        notes: String(form.get('notes') || ''),
      }),
      'Shift submitted for admin approval',
    );
    event.currentTarget.reset();
    setShiftOpen(false);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Tasks & time tracking</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Check a task while you work. Minutes are saved when you uncheck it or clock out.</p>
          </div>
        </div>

        <form onSubmit={handleCreateTask} className="mb-5 rounded-xl bg-muted/50 p-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <input className={inputClass} placeholder="Task title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} required />
            <input className={inputClass} placeholder="Task details (required)" value={newDescription} onChange={(event) => setNewDescription(event.target.value)} required />
            <button className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={isPending}>
              <Plus className="h-4 w-4" /> Add task
            </button>
          </div>
        </form>

        <div className="space-y-2">
          {tasks.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No tasks yet. Add the first thing you are working on.</p>}
          {tasks.map((task) => (
            <div key={task.id} className={`rounded-xl border p-3 transition-colors ${task.isTracked ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingId === task.id ? (
                <form onSubmit={saveEdit} className="space-y-2">
                  <input className={inputClass} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
                  <textarea className={inputClass} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={2} required />
                  <div className="flex gap-2">
                    <button className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground" disabled={isPending}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-border px-3 py-1.5 text-sm"><X className="mr-1 inline h-3.5 w-3.5" />Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Track ${task.title}`}
                    checked={task.isTracked}
                    onChange={(event) => run(() => toggleTask(task.id, event.target.checked), event.target.checked ? 'Task timer started' : 'Task time saved')}
                    className="mt-1 h-4 w-4 accent-primary"
                    disabled={isPending || task.status === 'completed'}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{task.title}</span>
                      {task.isTracked && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Tracking</span>}
                      {task.status === 'completed' && <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">Finished</span>}
                      {task.pendingEdit && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">Edit pending</span>}
                    </div>
                    {task.description && <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>}
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" /> {formatDuration(task.totalMinutes * 60000)} recorded</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {task.status !== 'completed' && <button type="button" onClick={() => run(() => finishTask(task.id), 'Task finished and time saved')} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-500/10" title="Finish task" disabled={isPending}><CheckCircle2 className="h-4 w-4" /> Finish</button>}
                    <button type="button" onClick={() => beginEdit(task)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title={task.isTracked ? 'Edit (requires admin approval)' : 'Edit task'}>
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Custom shifts</h2></div>
            <p className="mt-1 text-sm text-muted-foreground">Submit a shift with custom hours. An admin must approve it before it is accepted.</p>
          </div>
          <button type="button" onClick={() => setShiftOpen((open) => !open)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><Plus className="h-4 w-4" /> Add</button>
        </div>

        {shiftOpen && (
          <form onSubmit={handleShift} className="mb-5 space-y-3 rounded-xl bg-muted/50 p-3">
            <input name="title" className={inputClass} placeholder="Shift title" required />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input name="shiftDate" type="date" className={inputClass} required />
              <input name="startTime" type="time" className={inputClass} required />
              <input name="endTime" type="time" className={inputClass} required />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input name="breakMinutes" type="number" min="0" max="720" className={inputClass} placeholder="Break minutes" defaultValue="0" />
              <input name="notes" className={inputClass} placeholder="Notes and details (required)" required />
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={isPending}><Send className="h-4 w-4" /> Submit for approval</button>
          </form>
        )}

        <div className="space-y-2">
          {shiftRequests.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No custom shift requests yet.</p>}
          {shiftRequests.map((shift) => (
            <div key={shift.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{shift.title}</p>
                  <p className="text-sm text-muted-foreground">{shift.shiftDate} · {formatTime(shift.startAt)}–{formatTime(shift.endAt)}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${shift.status === 'approved' ? 'bg-green-500/10 text-green-700' : shift.status === 'rejected' ? 'bg-red-500/10 text-red-700' : 'bg-amber-500/10 text-amber-700'}`}>{shift.status}</span>
              </div>
              {shift.notes && <p className="mt-2 text-xs text-muted-foreground">{shift.notes}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
