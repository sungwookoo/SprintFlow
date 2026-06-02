import { WorkspaceApp } from "@/components/workspace-app";
import { getWorkspaceData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getWorkspaceData();

  return <WorkspaceApp initialData={data} />;
}
