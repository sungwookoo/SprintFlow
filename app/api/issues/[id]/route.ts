import { Prisma } from "@prisma/client";
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
  const { id } = await context.params;
  const body = (await request.json()) as UpdateIssueBody;
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
  const { id } = await context.params;
  await prisma.issue.delete({
    where: { id }
  });

  return NextResponse.json({ ok: true });
}
