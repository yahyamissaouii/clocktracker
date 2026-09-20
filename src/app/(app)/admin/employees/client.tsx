"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { inviteEmployee, deactivateEmployee } from "@/actions/admin";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function EmployeesClient({ initialEmployees }: { initialEmployees: any[] }) {
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = initialEmployees?.filter(
    (e) => filter === "all" || e.status.toLowerCase() === filter
  ) || [];

  const handleDeactivate = (id: string) => {
    startTransition(async () => {
      const result = await deactivateEmployee(id);
      if (result.success) {
        toast.success("Employee deactivated");
        router.refresh();
      } else toast.error(result.error || "Unable to deactivate employee");
    });
  };

  const handleInvite = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const data = {
        email: formData.get("email") as string,
        fullName: formData.get("name") as string,
        role: formData.get("role") as "employee" | "manager" | "admin",
        department: formData.get("department") as string,
      };
      const result = await inviteEmployee(data);
      if (!result.success) {
        toast.error(result.error || "Unable to invite employee");
        return;
      }
      toast.success("Invitation sent");
      setShowModal(false);
      router.refresh();
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Employees</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Add Employee
        </button>
      </div>

      <div className="flex space-x-4 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded p-2"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="p-3">Name</th>
            <th className="p-3">Email</th>
            <th className="p-3">Role</th>
            <th className="p-3">Department</th>
            <th className="p-3">Status</th>
            <th className="p-3">This week</th>
            <th className="p-3">Open tasks</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((emp) => (
            <tr key={emp.id} className="border-b hover:bg-gray-50">
              <td className="p-3">{emp.fullName}</td>
              <td className="p-3">{emp.email}</td>
              <td className="p-3">{emp.role}</td>
              <td className="p-3">{emp.department}</td>
              <td className="p-3">{emp.status}</td>
              <td className="p-3 font-medium">{emp.weekHours || '0m'}</td>
              <td className="p-3">{emp.openTaskCount ?? 0}</td>
              <td className="p-3 space-x-2">
                <Link href={`/admin/employees/${emp.id}`} className="text-blue-600 hover:underline">
                  Edit
                </Link>
                <button
                  onClick={() => handleDeactivate(emp.id)}
                  className="text-red-600 hover:underline"
                  disabled={isPending}
                >
                  Deactivate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Employee</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Full Name</label>
                <input name="name" required className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input name="email" type="email" required className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium">Role</label>
                <select name="role" className="w-full border rounded p-2">
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Department</label>
                <input name="department" required className="w-full border rounded p-2" />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {isPending ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
