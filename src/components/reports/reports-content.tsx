'use client';

import { useState } from 'react';
import { FileDown, Printer, FileText } from 'lucide-react';

interface Props {
  userId: string;
  userName: string;
  timezone: string;
}

export function ReportsContent({ userId, userName, timezone }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      const url = `/api/timesheet/pdf?employeeId=${userId}&year=${year}&month=${month}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `timesheet-${userName.replace(/\s+/g, '_')}-${monthNames[month - 1]}-${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewPDF = () => {
    const url = `/api/timesheet/pdf?employeeId=${userId}&year=${year}&month=${month}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="border rounded-lg p-6 bg-card">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Select Period
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1.5">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {monthNames.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePreviewPDF}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
          >
            <FileText className="w-4 h-4" />
            Preview PDF
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            {loading ? 'Generating...' : 'Download PDF'}
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="text-sm text-muted-foreground">
        <p>
          The generated timesheet includes daily entries with clock-in/out times,
          breaks, and total hours. It also includes signature areas for employee
          and supervisor verification.
        </p>
      </div>
    </div>
  );
}
