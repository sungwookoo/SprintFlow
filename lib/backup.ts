import fs from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const backupDir = path.join(process.cwd(), "prisma", "backups");

type BackupTables = {
  projects: Prisma.ProjectCreateManyInput[];
  statuses: Prisma.StatusCreateManyInput[];
  sprints: Prisma.SprintCreateManyInput[];
  members: Prisma.MemberCreateManyInput[];
  issues: Prisma.IssueCreateManyInput[];
  comments: Prisma.CommentCreateManyInput[];
  attachments: Prisma.AttachmentCreateManyInput[];
};

export type BackupSnapshot = {
  app: "SprintFlow";
  schemaVersion: 1;
  exportedAt: string;
  tables: BackupTables;
};

type BackupFile = {
  fileName: string;
  filePath: string;
  createdAt: string;
  size: number;
};

const projectDateFields = ["startDate", "targetDate", "createdAt", "updatedAt"] as const;
const sprintDateFields = ["startDate", "endDate", "createdAt", "updatedAt"] as const;
const issueDateFields = ["startDate", "dueDate", "createdAt", "updatedAt", "deletedAt"] as const;
const createdAtField = ["createdAt"] as const;

function hydrateDates(record: Record<string, unknown>, fields: readonly string[]) {
  const next: Record<string, unknown> = { ...record };
  for (const field of fields) {
    const value = next[field];
    if (typeof value === "string") {
      next[field] = new Date(value);
    }
  }
  return next;
}

function assertSnapshot(value: unknown): asserts value is BackupSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("백업 파일 형식이 올바르지 않습니다.");
  }

  const snapshot = value as Partial<BackupSnapshot>;
  if (snapshot.app !== "SprintFlow" || snapshot.schemaVersion !== 1 || !snapshot.tables) {
    throw new Error("SprintFlow 백업 파일이 아닙니다.");
  }

  for (const key of ["projects", "statuses", "sprints", "members", "issues", "comments", "attachments"] as const) {
    if (!Array.isArray(snapshot.tables[key])) {
      throw new Error(`백업 파일의 ${key} 테이블이 올바르지 않습니다.`);
    }
  }
}

export async function createWorkspaceSnapshot(projectId: string): Promise<BackupSnapshot> {
  const [projects, statuses, sprints, members, issues, comments, attachments] = await Promise.all([
    prisma.project.findMany({ where: { id: projectId }, orderBy: { createdAt: "asc" } }),
    prisma.status.findMany({ where: { projectId }, orderBy: [{ projectId: "asc" }, { sortOrder: "asc" }] }),
    prisma.sprint.findMany({ where: { projectId }, orderBy: [{ projectId: "asc" }, { createdAt: "asc" }] }),
    prisma.member.findMany({ where: { projectId }, orderBy: [{ projectId: "asc" }, { name: "asc" }] }),
    prisma.issue.findMany({ where: { projectId }, orderBy: [{ rank: "asc" }, { createdAt: "asc" }] }),
    prisma.comment.findMany({ where: { issue: { projectId } }, orderBy: [{ issueId: "asc" }, { createdAt: "asc" }] }),
    prisma.attachment.findMany({ where: { issue: { projectId } }, orderBy: [{ issueId: "asc" }, { createdAt: "asc" }] })
  ]);

  return {
    app: "SprintFlow",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      projects: projects.map(({ accessCodeHash: _code, accessVersion: _version, ...project }) => project),
      statuses,
      sprints,
      members,
      issues,
      comments,
      attachments
    }
  };
}

export function getBackupFileName(snapshot = new Date()) {
  return `sprintflow-backup-${snapshot.toISOString().replace(/[:.]/g, "-")}.json`;
}

export async function saveSnapshot(snapshot: BackupSnapshot, projectId: string) {
  const directory = path.join(backupDir, projectId);
  await fs.mkdir(directory, { recursive: true });
  const fileName = getBackupFileName(new Date(snapshot.exportedAt));
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  const stat = await fs.stat(filePath);

  return {
    fileName,
    filePath,
    createdAt: stat.mtime.toISOString(),
    size: stat.size
  };
}

export async function listBackupFiles(projectId: string): Promise<BackupFile[]> {
  const directory = path.join(backupDir, projectId);
  await fs.mkdir(directory, { recursive: true });
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        const stat = await fs.stat(filePath);
        return {
          fileName: entry.name,
          filePath,
          createdAt: stat.mtime.toISOString(),
          size: stat.size
        };
      })
  );

  return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadLatestSnapshot(projectId: string) {
  const [latest] = await listBackupFiles(projectId);
  if (!latest) {
    throw new Error("복원할 서버 백업이 없습니다.");
  }

  const raw = await fs.readFile(latest.filePath, "utf8");
  const snapshot = JSON.parse(raw) as unknown;
  assertSnapshot(snapshot);
  return { snapshot, file: latest };
}

export async function restoreWorkspaceSnapshot(input: unknown, projectId: string) {
  assertSnapshot(input);

  const tables = input.tables;
  if (tables.projects.length !== 1 || tables.projects[0].id !== projectId) throw new Error("선택한 그룹의 백업만 복원할 수 있습니다.");
  for (const name of ["statuses", "sprints", "members", "issues"] as const) {
    if (tables[name].some(row => row.projectId !== projectId)) throw new Error("다른 그룹의 데이터가 포함되어 있습니다.");
  }
  const ids = (rows: { id?: string }[]) => new Set(rows.map(row => row.id));
  const statusIds = ids(tables.statuses), sprintIds = ids(tables.sprints), memberIds = ids(tables.members), issueIds = ids(tables.issues);
  if (tables.issues.some(row => !statusIds.has(row.statusId) || (row.sprintId && !sprintIds.has(row.sprintId)) ||
    (row.parentId && !issueIds.has(row.parentId)) || (row.assigneeId && !memberIds.has(row.assigneeId)) || (row.reporterId && !memberIds.has(row.reporterId))) ||
    tables.comments.some(row => !issueIds.has(row.issueId) || (row.authorId && !memberIds.has(row.authorId))) ||
    tables.attachments.some(row => !issueIds.has(row.issueId))) throw new Error("백업의 그룹 내 참조 관계가 올바르지 않습니다.");
  if (tables.attachments.some(row => { try { return !["http:", "https:"].includes(new URL(row.url).protocol); } catch { return true; } })) throw new Error("첨부 링크 형식이 올바르지 않습니다.");
  const projects = tables.projects.map((item) =>
    hydrateDates(item as Record<string, unknown>, projectDateFields)
  ) as Prisma.ProjectCreateManyInput[];
  const statuses = tables.statuses;
  const sprints = tables.sprints.map((item) =>
    hydrateDates(item as Record<string, unknown>, sprintDateFields)
  ) as Prisma.SprintCreateManyInput[];
  const members = tables.members;
  const issues = tables.issues.map((item) =>
    hydrateDates(item as Record<string, unknown>, issueDateFields)
  ) as Prisma.IssueCreateManyInput[];
  const comments = tables.comments.map((item) =>
    hydrateDates(item as Record<string, unknown>, createdAtField)
  ) as Prisma.CommentCreateManyInput[];
  const attachments = tables.attachments.map((item) =>
    hydrateDates(item as Record<string, unknown>, createdAtField)
  ) as Prisma.AttachmentCreateManyInput[];

  await prisma.$transaction(async (tx) => {
    await tx.comment.deleteMany({ where: { issue: { projectId } } });
    await tx.attachment.deleteMany({ where: { issue: { projectId } } });
    await tx.issue.deleteMany({ where: { projectId } });
    await tx.sprint.deleteMany({ where: { projectId } });
    await tx.status.deleteMany({ where: { projectId } });
    await tx.member.deleteMany({ where: { projectId } });


    const project = projects[0];
    await tx.project.update({ where: { id: projectId }, data: { name: project.name, summary: project.summary, leadName: project.leadName, color: project.color, startDate: project.startDate, targetDate: project.targetDate, accessVersion: { increment: 1 } } });
    if (statuses.length) await tx.status.createMany({ data: statuses });
    if (sprints.length) await tx.sprint.createMany({ data: sprints });
    if (members.length) await tx.member.createMany({ data: members });

    const remaining = [...issues];
    const createdIssueIds = new Set<string>();
    while (remaining.length) {
      const ready = remaining.filter((issue) => !issue.parentId || createdIssueIds.has(String(issue.parentId)));
      if (!ready.length) {
        throw new Error("백업 파일의 하위작업 관계를 복원할 수 없습니다.");
      }

      await tx.issue.createMany({ data: ready });
      for (const issue of ready) {
        createdIssueIds.add(String(issue.id));
      }

      for (const issue of ready) {
        const index = remaining.findIndex((candidate) => candidate.id === issue.id);
        if (index >= 0) remaining.splice(index, 1);
      }
    }

    if (comments.length) await tx.comment.createMany({ data: comments });
    if (attachments.length) await tx.attachment.createMany({ data: attachments });
  });

  return {
    projects: projects.length,
    statuses: statuses.length,
    sprints: sprints.length,
    members: members.length,
    issues: issues.length,
    comments: comments.length,
    attachments: attachments.length
  };
}
