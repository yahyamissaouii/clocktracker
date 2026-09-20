"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { getTeamReport, exportCSV } from "@/actions/reports";

interface Employee {
  id: string;
  memberId?: string;
  fullName?: string;
  name?: string;
  email?: string;
  role?: string | null;
  department?: string | null;
  status?: string | null;
}

interface MissingClockOut {
  id: string;
  employeeName: string;
  date: string;
  clockIn: string;
}

export default function ReportsClient({ 
  missingClockOuts, 
  employees 
}: { 
  missingClockOuts: MissingClockOut[]; 
  employees: Employee[];
}) {
  const [employeeId, setEmployeeId] = useState("all");
  const [period, setPeriod] = useState<"week" | "month" | "custom">("week");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [results, setResults] = useState<any[]>([]);
  const [aggregates, setAggregates] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();

    let start: Date;
    let end: Date;
    const now = new Date();

    if (period === "week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    startTransition(async () => {
      try {
        const report = await getTeamReport(
          { start, end },
          { employeeId: employeeId === "all" ? undefined : employeeId }
        );

        if (!report || report.team.length === 0) {
          setResults([]);
          setAggregates(null);
          toast.info("No work session data found for this period");
          return;
        }

        setResults(report.team);
        setAggregates(report.aggregates);
        toast.success(`Generated report for ${report.team.length} employee(s)`);
      } catch (err: any) {
        toast.error("Failed to generate report");
      }
    });
  };

  const handleExportCSV = async () => {
    startTransition(async () => {
      try {
        const targetPeriod = period === "month" ? "monthly" : "weekly";
        const csvContent = await exportCSV(
          targetPeriod,
          new Date(),
          employeeId === "all" ? undefined : employeeId
        );

        if (!csvContent) {
          toast.error("Failed to generate CSV");
          return;
        }

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `timesheet_report_${period}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("CSV exported successfully");
      } catch (err) {
        toast.error("Error exporting CSV");
      }
    });
  };

  const handleExportPDF = () => {
    const now = new Date();
    const targetEmp = employeeId === "all" && employees?.length > 0 ? employees[0].id : employeeId;
    if (targetEmp === "all") {
      toast.error("Please select a specific employee to download their PDF timesheet");
      return;
    }
    const url = `/api/timesheet/pdf?employeeId=${targetEmp}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
    window.open(url, "_blank");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate team work hour summaries, export timesheets, and view attendance warnings.
          </p>
        </div>
      </div>

      {missingClockOuts && missingClockOuts.length > 0 && (
        <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r-lg">
          <h3 className="text-amber-800 font-bold mb-2 flex items-center gap-2">
            <span>⚠️</span> Missing Clock-Out Warnings ({missingClockOuts.length})
          </h3>
          <ul className="list-disc list-inside text-amber-700 text-sm space-y-1">
            {missingClockOuts.map((w) => (
              <li key={w.id}>
                <span className="font-medium">{w.employeeName}</span> — {w.date} (Clocked in at: {w.clockIn})
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleGenerate} className="bg-card p-6 rounded-lg border shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border rounded-md p-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Employees</option>
              {employees?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName || emp.name || emp.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="w-full border rounded-md p-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </div>

        {period === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded-md p-2 bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded-md p-2 bg-background text-sm"
              />
            </div>
          </div>
        )}
      </form>

      {results.length > 0 && (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="p-4 border-b flex flex-wrap justify-between items-center bg-muted/40 gap-3">
            <div>
              <h2 className="font-bold text-lg">Results</h2>
              {aggregates && (
                <p className="text-xs text-muted-foreground">
                  Total Team Hours: <span className="font-semibold text-foreground">{aggregates.totalHoursFormatted}</span> across {aggregates.totalMembers} employee(s)
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={handleExportPDF}
                className="text-xs px-3 py-1.5 border rounded-md bg-background hover:bg-muted font-medium transition-colors"
              >
                PDF Timesheet
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={isPending}
                className="text-xs px-3 py-1.5 border rounded-md bg-background hover:bg-muted font-medium transition-colors disabled:opacity-50"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="text-xs px-3 py-1.5 border rounded-md bg-background hover:bg-muted font-medium transition-colors"
              >
                Print
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-muted-foreground font-medium">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Days Worked</th>
                  <th className="p-3">Total Net Hours</th>
                  <th className="p-3">Overtime Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">
                      <div>{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="p-3">{r.daysWorked} day(s)</td>
                    <td className="p-3 font-semibold">{r.hours}</td>
                    <td className={`p-3 font-semibold ${r.overtime.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {r.overtime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
