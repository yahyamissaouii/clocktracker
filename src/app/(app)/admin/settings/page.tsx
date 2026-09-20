import { getOrganization } from "@/actions/organization";
import SettingsClient from "./client";

export default async function SettingsPage() {
  const org = await getOrganization();
  return <SettingsClient initialOrg={org} />;
}
