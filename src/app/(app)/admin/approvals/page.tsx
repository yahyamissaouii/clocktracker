import { getPendingCorrections } from "@/actions/corrections";
import { getPendingTaskEdits } from "@/actions/tasks";
import { getPendingShiftRequests } from "@/actions/shifts";
import ApprovalsClient from "./client";

export default async function ApprovalsPage() {
  const [corrections, taskEdits, shiftRequests] = await Promise.all([
    getPendingCorrections(),
    getPendingTaskEdits(),
    getPendingShiftRequests(),
  ]);
  return <ApprovalsClient initialCorrections={corrections} initialTaskEdits={taskEdits} initialShiftRequests={shiftRequests} />;
}
