"use client";

import { useRouter } from "next/navigation";

export default function AuditClient({ initialLogs, currentPage }: { initialLogs: any[], currentPage: number }) {
  const router = useRouter();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      
      <div className="flex space-x-4 mb-4">
        <input type="text" placeholder="Filter by employee..." className="border rounded p-2 flex-1" />
        <select className="border rounded p-2">
          <option value="all">All Actions</option>
          <option value="update">Updates</option>
          <option value="delete">Deletes</option>
        </select>
        <input type="date" className="border rounded p-2" />
      </div>

      <div className="overflow-x-auto bg-white rounded-lg border shadow-sm">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-3 font-semibold text-gray-700">Timestamp</th>
              <th className="p-3 font-semibold text-gray-700">Actor</th>
              <th className="p-3 font-semibold text-gray-700">Action</th>
              <th className="p-3 font-semibold text-gray-700">Employee</th>
              <th className="p-3 font-semibold text-gray-700">Details</th>
            </tr>
          </thead>
          <tbody>
            {initialLogs?.map((log) => (
              <tr key={log.id} className="border-b hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap text-gray-600">{log.timestamp}</td>
                <td className="p-3 font-medium">{log.actorName}</td>
                <td className="p-3">
                  <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs uppercase tracking-wider">
                    {log.actionType}
                  </span>
                </td>
                <td className="p-3">{log.targetEmployeeName || "N/A"}</td>
                <td className="p-3 text-gray-600 break-words max-w-xs">{log.details}</td>
              </tr>
            ))}
            {(!initialLogs || initialLogs.length === 0) && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">No logs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center mt-6">
        <button
          onClick={() => router.push(`/admin/audit?page=${currentPage + 1}`)}
          className="bg-white border text-gray-700 px-6 py-2 rounded hover:bg-gray-50"
        >
          Load More
        </button>
      </div>
    </div>
  );
}
