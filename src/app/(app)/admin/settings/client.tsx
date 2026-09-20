"use client";

import { useTransition } from "react";
import { updateOrganization } from "@/actions/organization";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function SettingsClient({ initialOrg }: { initialOrg: any }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateOrganization(Object.fromEntries(formData));
      toast.success("Settings saved successfully");
      router.refresh();
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Organization Settings</h1>
      <form onSubmit={handleSave} className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Company Name</label>
          <input
            name="companyName"
            defaultValue={initialOrg?.companyName}
            required
            className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default Timezone</label>
          <select
            name="timezone"
            defaultValue={initialOrg?.timezone || "Europe/Berlin"}
            className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default Weekly Hours</label>
          <input
            name="weeklyHours"
            type="number"
            defaultValue={initialOrg?.weeklyHours || 40}
            required
            className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Timesheet Footer Notes</label>
          <textarea
            name="timesheetFooter"
            defaultValue={initialOrg?.timesheetFooter}
            rows={4}
            className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
          ></textarea>
        </div>
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
