import { Prisma } from "@prisma/client";
import { authorize, validReferences } from "@/lib/auth";
import { NextResponse } from "next/server";

import { issueInclude, serializeIssue } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import type { IssuePriority } from "@/lib/types";

type UpdateIssueBody = Partial<{
  statusId: string;
  sprintId: string | null;
  assigneeId: string | null;
  summary: string;
  description: string;
  priority: IssuePriority;
  labels: string[];
  storyPoints: number;
  estimateHours: number;
  loggedHours: number;
  isFlagged: boolean;
  startDate: string | null;
  dueDate: string | null;
}>;

const priorities = new Set<IssuePriority>(["HIGHEST", "HIGH", "MEDIUM", "LOW"]);

function parseDate(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !value) return undefined;
  return new Date(`${value.slice(0, 10)}T09:00:00`);
}

function assignNumber(data: Prisma.IssueUncheckedUpdateInput, key: "storyPoints" | "estimateHours" | "loggedHours", value: unknown) {
  if (typeof value !== "number") return;
  if (Number.isFinite(value) && value >= 0) {
    data[key] = Math.round(value);
  }
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await authorize(request);
  if (session instanceof Response) return session;
  const { id } = await context.params;
  if (!await prisma.issue.count({ where: { id, projectId: session.projectId!, deletedAt: null } })) return NextResponse.json({ message: "작업을 찾을 수 없습니다." }, { status: 404 });
  const body = (await request.json()) as UpdateIssueBody;
  if (!await validReferences(session.projectId!, { statusId: body.statusId, sprintId: body.sprintId, assigneeId: body.assigneeId })) return NextResponse.json({ message: "현재 그룹의 항목만 선택할 수 있습니다." }, { status: 400 });
  const data: Prisma.IssueUncheckedUpdateInput = {};

  if (typeof body.statusId === "string") data.statusId = body.statusId;
  if ("sprintId" in body) data.sprintId = body.sprintId ?? null;
  if ("assigneeId" in body) data.assigneeId = body.assigneeId ?? null;
  if (typeof body.summary === "string" && body.summary.trim()) data.summary = body.summary.trim();
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.priority === "string" && priorities.has(body.priority)) data.priority = body.priority;
  if (Array.isArray(body.labels)) {
    data.labels = JSON.stringify(body.labels.map((label) => label.trim()).filter(Boolean));
  }
  if (typeof body.isFlagged === "boolean") data.isFlagged = body.isFlagged;

  assignNumber(data, "storyPoints", body.storyPoints);
  assignNumber(data, "estimateHours", body.estimateHours);
  assignNumber(data, "loggedHours", body.loggedHours);

  if ("startDate" in body) data.startDate = parseDate(body.startDate);
  if ("dueDate" in body) data.dueDate = parseDate(body.dueDate);

  const issue = await prisma.issue.update({
    where: { id },
    data,
    include: issueInclude
  });

  return NextResponse.json({ issue: serializeIssue(issue) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await authorize(_request);
  if (session instanceof Response) return session;
  const { id } = await context.params;
  if (!await prisma.issue.count({ where: { id, projectId: session.projectId!, deletedAt: null } })) return NextResponse.json({ message: "작업을 찾을 수 없습니다." }, { status: 404 });
  await prisma.$transaction(async tx => {
    await tx.issue.updateMany({ where: { parentId: id, projectId: session.projectId! }, data: { parentId: null } });
    await tx.issue.update({ where: { id, projectId: session.projectId! }, data: { deletedAt: new Date() } });
  });

  return NextResponse.json({ ok: true });
}
