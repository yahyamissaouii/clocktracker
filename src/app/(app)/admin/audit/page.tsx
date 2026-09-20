import { getAuditLog } from "@/actions/admin";
import AuditClient from "./client";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const auditLogs = await getAuditLog({ page });
  return <AuditClient initialLogs={auditLogs} currentPage={page} />;
}
