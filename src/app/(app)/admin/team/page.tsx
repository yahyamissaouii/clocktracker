import { getTeamStatus } from "@/actions/admin";
import TeamClient from "./client";

export default async function TeamPage() {
  const teamStatus = await getTeamStatus();
  return <TeamClient initialStatus={teamStatus} />;
}
