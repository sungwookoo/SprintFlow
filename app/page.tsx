import { WorkspaceApp } from "@/components/workspace-app";
import { getWorkspaceData } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccessBar } from "@/components/access-ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.projectId) redirect("/admin");
  if (!await prisma.project.count({ where: { id: session.projectId } })) redirect("/admin");
  const data = await getWorkspaceData(session.projectId);

  return <><AccessBar admin={session.role === "admin"} name={data.project.name} /><WorkspaceApp initialData={data} isAdmin={session.role === "admin"} /></>;
}
