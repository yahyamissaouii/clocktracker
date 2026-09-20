import { getEmployees } from "@/actions/admin";
import EmployeesClient from "./client";

export default async function EmployeesPage() {
  const employees = await getEmployees();
  return <EmployeesClient initialEmployees={employees} />;
}
