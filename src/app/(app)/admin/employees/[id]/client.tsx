"use client";

import { useState, useTransition } from "react";
import { updateEmployee, createManualSession } from "@/actions/admin";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime, formatDuration, calculateGrossTime, calculateBreakTime, calculateNetTime } from "@/lib/time";

export default function EmployeeDetailClient({ employee }: { employee: any }) {
  const [showManualModal, setShowManualModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateEmployee(employee.member.id, {
        fullName: String(formData.get("fullName")),
        role: formData.get("role") as "employee" | "manager" | "admin",
        department: String(formData.get("department")),
        weeklyTargetHours: Number(formData.get("weeklyTargetHours")),
      });
      if (!result.success) {
        toast.error(result.error || "Unable to update employee");
        return;
      }
      toast.success("Employee updated");
      router.refresh();
    });
  };

  const handleManualSession = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = String(formData.get("date"));
    const clockIn = String(formData.get("clockIn"));
    const clockOut = String(formData.get("clockOut"));
    startTransition(async () => {
      const result = await createManualSession({
        employeeId: employee.user.id,
        clockInAt: new Date(`${date}T${clockIn}:00`).toISOString(),
        clockOutAt: new Date(`${date}T${clockOut}:00`).toISOString(),
        note: String(formData.get("reason")),
      });
      if (!result.success) {
        toast.error(result.error || "Unable to create manual session");
        return;
      }
      toast.success("Manual session created");
      setShowManualModal(false);
      router.refresh();
    });
  };

  if (!employee) return <div>Employee not found</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{employee.user.fullName}</h1>
        <div className="space-x-4">
          <button
            onClick={() => setShowManualModal(true)}
            className="bg-gray-100 px-4 py-2 rounded text-sm font-medium hover:bg-gray-200"
          >
            Create Manual Entry
          </button>
          <Link
            href={`/admin/reports?employeeId=${employee.id}`}
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            Full Timesheet
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Profile</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input name="fullName" defaultValue={employee.user.fullName} required className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input name="email" defaultValue={employee.user.email} disabled className="w-full border rounded p-2 bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium">Role</label>
              <select name="role" defaultValue={employee.member.role || 'employee'} className="w-full border rounded p-2">
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Department</label>
              <input name="department" defaultValue={employee.member.department || ''} required className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium">Weekly target hours</label>
              <input name="weeklyTargetHours" type="number" min="0" max="168" step="0.25" defaultValue={employee.member.weeklyTargetHours || '40'} required className="w-full border rounded p-2" />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Weekly Summary</h2>
          <div className="space-y-2 text-gray-700">
            <p>Total Hours: {employee.weeklyTotals?.hours || 0}</p>
            <p>Status: {employee.member.status}</p>
            <p>Start Date: {employee.member.startDate || '—'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Recent Sessions (Last 30 Days)</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b">
              <th className="p-2">Date</th>
              <th className="p-2">Clock In</th>
              <th className="p-2">Clock Out</th>
              <th className="p-2">Duration</th>
              <th className="p-2">Notes & task details</th>
            </tr>
          </thead>
          <tbody>
            {employee.recentSessions?.map((session: any) => {
              const clockIn = session.clockInAt || session.clockIn;
              const clockOut = session.clockOutAt || session.clockOut;
              const gross = calculateGrossTime(clockIn, clockOut);
              const net = calculateNetTime(gross, calculateBreakTime(session.breaks || []));

              return (
                <tr key={session.id} className="border-b">
                  <td className="p-2">{formatDate(clockIn)}</td>
                  <td className="p-2">{formatTime(clockIn)}</td>
                  <td className="p-2">{clockOut ? formatTime(clockOut) : "Active"}</td>
                  <td className="p-2">{formatDuration(net)}</td>
                  <td className="p-2 min-w-[260px] text-sm">
                    <p className="whitespace-pre-wrap">{session.note || "No entry notes"}</p>
                    {session.taskEntries?.length > 0 && (
                      <div className="mt-2 space-y-1 border-t pt-2 text-xs text-gray-600">
                        {session.taskEntries.map((entry: any) => (
                          <div key={`${session.id}-${entry.title}-${entry.startedAt}`}>
                            <span className="font-medium">{entry.title}</span>{entry.description ? ` — ${entry.description}` : ''} · {entry.durationMinutes} min
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showManualModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Manual Session Entry</h2>
            <form onSubmit={handleManualSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Date</label>
                <input name="date" type="date" required className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium">Clock In</label>
                <input name="clockIn" type="time" required className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium">Clock Out</label>
                <input name="clockOut" type="time" required className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium">Reason</label>
                <textarea name="reason" required className="w-full border rounded p-2"></textarea>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
