'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock3, FilePenLine } from 'lucide-react';
import { toast } from 'sonner';
import { approveCorrection, rejectCorrection } from '@/actions/corrections';
import { approveTaskEdit, rejectTaskEdit } from '@/actions/tasks';
import { approveShiftRequest, rejectShiftRequest } from '@/actions/shifts';
import { formatDate, formatTime } from '@/lib/time';

type Correction = {
  id: string;
  employeeName: string;
  date: Date | string;
  originalClockIn: Date | string;
  originalClockOut: Date | string | null;
  requestedClockIn: Date | string | null;
  requestedClockOut: Date | string | null;
  reason: string;
};

type TaskEdit = {
  id: string;
  taskTitle: string;
  employeeName: string;
  requestedTitle: string;
  currentDescription: string | null;
  requestedDescription: string | null;
};

type ShiftRequest = {
  id: string;
  employeeName: string;
  employeeEmail: string;
  shiftDate: string;
  title: string;
  startAt: Date | string;
  endAt: Date | string;
  breakMinutes: number;
  notes: string | null;
};

export default function ApprovalsClient({
  initialCorrections,
  initialTaskEdits,
  initialShiftRequests,
}: {
  initialCorrections: Correction[];
  initialTaskEdits: TaskEdit[];
  initialShiftRequests: ShiftRequest[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const review = (action: (note: string) => Promise<{ success: boolean; error?: string }>, successMessage: string) => {
    const note = window.prompt('Optional note for this decision:');
    if (note === null) return;
    startTransition(async () => {
      const result = await action(note);
      if (!result.success) {
        toast.error(result.error || 'Unable to process approval');
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  };

  const total = initialCorrections.length + initialTaskEdits.length + initialShiftRequests.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review corrections, task edits, and custom shifts submitted by your team.</p>
      </div>

      {total === 0 && <div className="rounded-2xl border border-dashed border-border p-12 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-green-600" /><h2 className="mt-3 text-lg font-semibold">Everything is up to date</h2><p className="mt-1 text-sm text-muted-foreground">There are no pending requests.</p></div>}

      {initialCorrections.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Clock3 className="h-5 w-5 text-primary" /> Time corrections</h2>
          {initialCorrections.map((request) => (
            <div key={request.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row">
                <div>
                  <p className="font-semibold">{request.employeeName} <span className="font-normal text-muted-foreground">· {formatDate(request.date)}</span></p>
                  <p className="mt-2 text-sm">Original: {formatTime(request.originalClockIn)} – {formatTime(request.originalClockOut)}</p>
                  <p className="text-sm text-primary">Requested: {formatTime(request.requestedClockIn)} – {formatTime(request.requestedClockOut)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{request.reason}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button disabled={isPending} onClick={() => review((note) => approveCorrection(request.id, note), 'Correction approved')} className="h-fit rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Approve</button>
                  <button disabled={isPending} onClick={() => review((note) => rejectCorrection(request.id, note), 'Correction rejected')} className="h-fit rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {initialTaskEdits.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FilePenLine className="h-5 w-5 text-primary" /> Checked task edits</h2>
          {initialTaskEdits.map((request) => (
            <div key={request.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{request.employeeName} wants to edit a tracked task</p>
                  <p><span className="text-muted-foreground">Current:</span> {request.taskTitle}</p>
                  <p className="text-primary"><span className="text-muted-foreground">Requested:</span> {request.requestedTitle}</p>
                  {request.requestedDescription && <p className="text-muted-foreground">{request.requestedDescription}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button disabled={isPending} onClick={() => review((note) => approveTaskEdit(request.id, note), 'Task edit approved')} className="h-fit rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Approve</button>
                  <button disabled={isPending} onClick={() => review((note) => rejectTaskEdit(request.id, note), 'Task edit rejected')} className="h-fit rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {initialShiftRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Clock3 className="h-5 w-5 text-primary" /> Custom shifts</h2>
          {initialShiftRequests.map((request) => (
            <div key={request.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{request.employeeName} <span className="font-normal text-muted-foreground">· {request.employeeEmail}</span></p>
                  <p>{request.title} · {request.shiftDate} · {formatTime(request.startAt)}–{formatTime(request.endAt)}</p>
                  <p className="text-muted-foreground">Break: {request.breakMinutes} minutes{request.notes ? ` · ${request.notes}` : ''}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button disabled={isPending} onClick={() => review((note) => approveShiftRequest(request.id, note), 'Shift approved')} className="h-fit rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Approve</button>
                  <button disabled={isPending} onClick={() => review((note) => rejectShiftRequest(request.id, note), 'Shift rejected')} className="h-fit rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
