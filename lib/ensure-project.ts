import type { PrismaClient } from "@prisma/client";

export async function ensureProject(prisma: PrismaClient) {
  const existing = await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  try {
    // Nested creation is atomic: a workspace never appears without its statuses.
    return await prisma.project.create({
      data: {
        key: "SFL",
        name: "SprintFlow",
        summary: "작업과 일정을 관리하는 프로젝트",
        leadName: "Product Owner",
        statuses: {
          create: [
            { name: "할 일", category: "TODO", color: "#64748b", sortOrder: 0 },
            { name: "진행 중", category: "IN_PROGRESS", color: "#2563eb", sortOrder: 1 },
            { name: "검토 중", category: "IN_PROGRESS", color: "#d97706", sortOrder: 2 },
            { name: "완료", category: "DONE", color: "#15a46b", sortOrder: 3 }
          ]
        }
      }
    });
  } catch (error) {
    // Concurrent first requests can both observe an empty database.
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return prisma.project.findUniqueOrThrow({ where: { key: "SFL" } });
    }
    throw error;
  }
}
