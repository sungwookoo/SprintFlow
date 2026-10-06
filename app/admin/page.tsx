import { redirect } from "next/navigation";
import { AccessBar, GroupManager } from "@/components/access-ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin") redirect("/");
  const groups = await prisma.project.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, key: true, accessCodeHash: true, _count: { select: { issues: true } } } });
  return <><AccessBar admin name="서비스 관리" /><GroupManager selectedProjectId={session.projectId} groups={groups.map(group => ({ id: group.id, name: group.name, key: group.key, hasCode: !!group.accessCodeHash, issues: group._count.issues }))} /></>;
}
