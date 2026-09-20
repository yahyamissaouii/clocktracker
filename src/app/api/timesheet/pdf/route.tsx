import { NextRequest } from 'next/server';
import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db/index';
import { users, organizationMembers, organizations, workSessions, breaks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 24,
    borderBottom: '2px solid #2563eb',
    paddingBottom: 12,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 9,
    color: '#888',
    width: 80,
  },
  metaValue: {
    fontSize: 9,
  },
  table: {
    marginTop: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '1px solid #333',
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '0.5px solid #eee',
  },
  tableRowWeekend: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '0.5px solid #eee',
    backgroundColor: '#f9f9f9',
  },
  colDate: { width: '12%', fontSize: 9 },
  colDay: { width: '10%', fontSize: 9 },
  colStart: { width: '14%', fontSize: 9 },
  colEnd: { width: '14%', fontSize: 9 },
  colBreak: { width: '14%', fontSize: 9 },
  colGross: { width: '14%', fontSize: 9 },
  colNet: { width: '14%', fontSize: 9, textAlign: 'right' },
  headerText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
  },
  totalsSection: {
    marginTop: 16,
    borderTop: '2px solid #333',
    paddingTop: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  signatures: {
    marginTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBlock: {
    width: '40%',
  },
  signatureLine: {
    borderTop: '1px solid #333',
    paddingTop: 4,
    fontSize: 8,
    color: '#666',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#999',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

function formatMs(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatTimeFromDate(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

interface DayEntry {
  date: string;
  dayName: string;
  isWeekend: boolean;
  clockIn: string | null;
  clockOut: string | null;
  breakMs: number;
  grossMs: number;
  netMs: number;
}

interface TimesheetData {
  companyName: string;
  employeeName: string;
  department: string;
  period: string;
  days: DayEntry[];
  totalNetMs: number;
  totalBreakMs: number;
  totalGrossMs: number;
  daysWorked: number;
  targetHours: number | null;
  timesheetFooter: string | null;
  generatedAt: string;
}

function TimesheetPDF({ data }: { data: TimesheetData }) {
  const difference = data.targetHours
    ? data.totalNetMs - data.targetHours * 3600000
    : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.title}>MONTHLY TIMESHEET</Text>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.subtitle}>Employee: {data.employeeName}</Text>
              <Text style={styles.subtitle}>Department: {data.department || 'N/A'}</Text>
            </View>
            <View>
              <Text style={styles.subtitle}>Period: {data.period}</Text>
              <Text style={styles.subtitle}>Generated: {data.generatedAt}</Text>
            </View>
          </View>
        </View>

        {/* Table Header */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDate, styles.headerText]}>Date</Text>
            <Text style={[styles.colDay, styles.headerText]}>Day</Text>
            <Text style={[styles.colStart, styles.headerText]}>Start</Text>
            <Text style={[styles.colEnd, styles.headerText]}>End</Text>
            <Text style={[styles.colBreak, styles.headerText]}>Break</Text>
            <Text style={[styles.colGross, styles.headerText]}>Gross</Text>
            <Text style={[styles.colNet, styles.headerText]}>Net</Text>
          </View>

          {/* Table Rows */}
          {data.days.map((day, i) => (
            <View key={i} style={day.isWeekend ? styles.tableRowWeekend : styles.tableRow}>
              <Text style={styles.colDate}>{day.date}</Text>
              <Text style={styles.colDay}>{day.dayName}</Text>
              <Text style={styles.colStart}>{day.clockIn || '—'}</Text>
              <Text style={styles.colEnd}>{day.clockOut || '—'}</Text>
              <Text style={styles.colBreak}>
                {day.netMs > 0 ? formatMs(day.breakMs) : '—'}
              </Text>
              <Text style={styles.colGross}>
                {day.netMs > 0 ? formatMs(day.grossMs) : '—'}
              </Text>
              <Text style={styles.colNet}>
                {day.netMs > 0 ? formatMs(day.netMs) : '—'}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Days Worked</Text>
            <Text style={styles.totalValue}>{data.daysWorked}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Breaks</Text>
            <Text style={styles.totalValue}>{formatMs(data.totalBreakMs)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Net Hours</Text>
            <Text style={styles.totalValue}>{formatMs(data.totalNetMs)}</Text>
          </View>
          {data.targetHours && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Target Hours</Text>
                <Text style={styles.totalValue}>{formatMs(data.targetHours * 3600000)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: difference! >= 0 ? '#22c55e' : '#ef4444' }]}>
                  Difference
                </Text>
                <Text style={[styles.totalValue, { color: difference! >= 0 ? '#22c55e' : '#ef4444' }]}>
                  {difference! >= 0 ? '+' : ''}{formatMs(Math.abs(difference!))}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Signatures */}
        <View style={styles.signatures}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>Employee Signature</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>Supervisor Signature</Text>
          </View>
        </View>

        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>Date</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{data.timesheetFooter || data.companyName}</Text>
          <Text>Generated: {data.generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);
    const employeeId = url.searchParams.get('employeeId') || authUser.id;
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(url.searchParams.get('month') || String(new Date().getMonth() + 1)) - 1;

    // Fetch employee info
    const employee = await db.query.users.findFirst({
      where: eq(users.id, employeeId),
    });

    if (!employee) {
      return new Response('Employee not found', { status: 404 });
    }

    // Fetch org member
    const orgMember = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.userId, employeeId),
    });

    if (!orgMember) {
      return new Response('Not a member', { status: 404 });
    }

    // Auth: only allow self or admin/manager
    if (employeeId !== authUser.id) {
      const requesterMember = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.userId, authUser.id),
          eq(organizationMembers.organizationId, orgMember.organizationId)
        ),
      });
      if (!requesterMember || (requesterMember.role !== 'admin' && requesterMember.role !== 'manager')) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    // Fetch org
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgMember.organizationId),
    });

    // Fetch sessions for the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const sessions = await db.query.workSessions.findMany({
      where: and(
        eq(workSessions.employeeId, employeeId),
        eq(workSessions.organizationId, orgMember.organizationId)
      ),
      with: { breaks: true },
      orderBy: [desc(workSessions.clockInAt)],
    });

    const monthSessions = sessions.filter(s => {
      const d = new Date(s.clockInAt);
      return d >= startDate && d <= endDate;
    });

    // Build day entries
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const dayEntries: DayEntry[] = [];
    let totalNetMs = 0;
    let totalBreakMs = 0;
    let totalGrossMs = 0;
    let daysWorked = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const daySessions = monthSessions.filter(s => {
        const sd = new Date(s.clockInAt);
        return sd.getDate() === d;
      });

      let dayBreakMs = 0;
      let dayGrossMs = 0;
      let firstClockIn: Date | null = null;
      let lastClockOut: Date | null = null;

      daySessions.forEach(s => {
        const clockIn = new Date(s.clockInAt);
        const clockOut = s.clockOutAt ? new Date(s.clockOutAt) : null;

        if (!firstClockIn || clockIn < firstClockIn) firstClockIn = clockIn;
        if (clockOut && (!lastClockOut || clockOut > lastClockOut)) lastClockOut = clockOut;

        const gross = clockOut
          ? clockOut.getTime() - clockIn.getTime()
          : 0;
        dayGrossMs += gross;

        s.breaks.forEach(b => {
          const bStart = new Date(b.startedAt);
          const bEnd = b.endedAt ? new Date(b.endedAt) : null;
          if (bEnd) {
            dayBreakMs += bEnd.getTime() - bStart.getTime();
          }
        });
      });

      const dayNetMs = Math.max(0, dayGrossMs - dayBreakMs);

      if (daySessions.length > 0 && dayNetMs > 0) {
        daysWorked++;
      }

      totalNetMs += dayNetMs;
      totalBreakMs += dayBreakMs;
      totalGrossMs += dayGrossMs;

      dayEntries.push({
        date: `${String(d).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}`,
        dayName: dayNames[dayOfWeek],
        isWeekend,
        clockIn: firstClockIn ? formatTimeFromDate(firstClockIn) : null,
        clockOut: lastClockOut ? formatTimeFromDate(lastClockOut) : null,
        breakMs: dayBreakMs,
        grossMs: dayGrossMs,
        netMs: dayNetMs,
      });
    }

    const targetHours = orgMember.weeklyTargetHours
      ? parseFloat(orgMember.weeklyTargetHours) * 4.33
      : null;

    const data: TimesheetData = {
      companyName: org?.name || 'ClockTrack',
      employeeName: employee.fullName,
      department: orgMember.department || '',
      period: `${monthNames[month]} ${year}`,
      days: dayEntries,
      totalNetMs,
      totalBreakMs,
      totalGrossMs,
      daysWorked,
      targetHours,
      timesheetFooter: org?.timesheetFooter || null,
      generatedAt: new Date().toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const stream = await renderToStream(<TimesheetPDF data={data} />);

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="timesheet-${employee.fullName.replace(/\s+/g, '_')}-${monthNames[month]}-${year}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return new Response('Failed to generate PDF', { status: 500 });
  }
}
