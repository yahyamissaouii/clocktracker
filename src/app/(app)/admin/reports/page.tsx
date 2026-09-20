import { getMissingClockOuts, getEmployees } from "@/actions/admin";
import ReportsClient from "./client";

export default async function ReportsPage() {
  const missingClockOuts = await getMissingClockOuts();
  const employees = await getEmployees();
  return <ReportsClient missingClockOuts={missingClockOuts} employees={employees} />;
}
