import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { issueInclude, serializeIssue } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import type { IssuePriority, IssueType } from "@/lib/types";

const issueTypes = new Set<IssueType>(["EPIC", "STORY", "TASK", "BUG", "SUBTASK"]);
const priorities = new Set<IssuePriority>(["HIGHEST", "HIGH", "MEDIUM", "LOW"]);

type CreateIssueBody = {
  projectId?: string;
  summary?: string;
  type?: IssueType;
  sprintId?: string | null;
  parentId?: string | null;
  statusId?: string;
  assigneeId?: string | null;
  priority?: IssuePriority;
  dueDate?: string | null;
};

function parseDate(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !value) return undefined;
  return new Date(`${value.slice(0, 10)}T09:00:00`);
}

async function nextIssueKey(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { key: true }
  });
  const existing = await prisma.issue.findMany({
    where: { projectId },
    select: { issueKey: true }
  });
  const nextNumber =
    existing.reduce((max, issue) => {
      const value = Number(issue.issueKey.replace(`${project.key}-`, ""));
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1;

  return `${project.key}-${nextNumber}`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateIssueBody;
  const projectId = body.projectId;
  const summary = body.summary?.trim();

  if (!projectId || !summary) {
    return NextResponse.json({ message: "projectId와 summary가 필요합니다." }, { status: 400 });
  }

  const [firstStatus, maxRank] = await Promise.all([
    prisma.status.findFirst({
      where: { projectId },
      orderBy: { sortOrder: "asc" }
    }),
    prisma.issue.aggregate({
      where: { projectId },
      _max: { rank: true }
    })
  ]);

  const statusId = body.statusId ?? firstStatus?.id;
  if (!statusId) {
    return NextResponse.json({ message: "기본 상태가 없습니다." }, { status: 400 });
  }

  const dueDate = parseDate(body.dueDate);
  const data: Prisma.IssueUncheckedCreateInput = {
    projectId,
    issueKey: await nextIssueKey(projectId),
    summary,
    type: issueTypes.has(body.type as IssueType) ? (body.type as IssueType) : "TASK",
    priority: priorities.has(body.priority as IssuePriority) ? (body.priority as IssuePriority) : "MEDIUM",
    statusId,
    sprintId: body.sprintId ?? null,
    parentId: body.parentId ?? null,
    assigneeId: body.assigneeId ?? null,
    reporterId: body.assigneeId ?? null,
    description: "",
    labels: "[]",
    rank: (maxRank._max.rank ?? 0) + 10,
    dueDate
  };

  const issue = await prisma.issue.create({
    data,
    include: issueInclude
  });

  return NextResponse.json({ issue: serializeIssue(issue) }, { status: 201 });
}
