import { getEmployee } from "@/actions/admin";
import EmployeeDetailClient from "./client";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getEmployee(id);
  return <EmployeeDetailClient employee={employee} />;
}
