import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  AttachmentDto,
  CommentDto,
  IssueDto,
  IssuePriority,
  IssueType,
  MemberDto,
  ProjectDto,
  SprintDto,
  SprintStatus,
  StatusCategory,
  StatusDto,
  WorkspaceData
} from "@/lib/types";

export const issueInclude = Prisma.validator<Prisma.IssueInclude>()({
  status: true,
  assignee: true,
  reporter: true,
  comments: {
    include: {
      author: true
    },
    orderBy: {
      createdAt: "asc"
    }
  },
  attachments: {
    orderBy: {
      createdAt: "desc"
    }
  }
});

export type IssueRecord = Prisma.IssueGetPayload<{ include: typeof issueInclude }>;

const issueTypes = new Set<IssueType>(["EPIC", "STORY", "TASK", "BUG", "SUBTASK"]);
const priorities = new Set<IssuePriority>(["HIGHEST", "HIGH", "MEDIUM", "LOW"]);
const statusCategories = new Set<StatusCategory>(["TODO", "IN_PROGRESS", "DONE"]);
const sprintStatuses = new Set<SprintStatus>(["PLANNED", "ACTIVE", "COMPLETED"]);

const toIso = (date: Date | null | undefined) => (date ? date.toISOString() : null);

function parseLabels(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function serializeMember(member: NonNullable<IssueRecord["assignee"]>): MemberDto {
  return {
    id: member.id,
    projectId: member.projectId,
    name: member.name,
    initials: member.initials,
    role: member.role,
    color: member.color
  };
}

export function serializeStatus(status: IssueRecord["status"]): StatusDto {
  return {
    id: status.id,
    projectId: status.projectId,
    name: status.name,
    category: statusCategories.has(status.category as StatusCategory)
      ? (status.category as StatusCategory)
      : "TODO",
    color: status.color,
    sortOrder: status.sortOrder
  };
}

export function serializeComment(comment: IssueRecord["comments"][number]): CommentDto {
  return {
    id: comment.id,
    issueId: comment.issueId,
    authorId: comment.authorId,
    author: comment.author ? serializeMember(comment.author) : null,
    body: comment.body,
    createdAt: comment.createdAt.toISOString()
  };
}

export function serializeAttachment(attachment: IssueRecord["attachments"][number]): AttachmentDto {
  return {
    id: attachment.id,
    issueId: attachment.issueId,
    fileName: attachment.fileName,
    url: attachment.url,
    fileSize: attachment.fileSize,
    createdAt: attachment.createdAt.toISOString()
  };
}

export function serializeIssue(issue: IssueRecord): IssueDto {
  return {
    id: issue.id,
    projectId: issue.projectId,
    sprintId: issue.sprintId,
    parentId: issue.parentId,
    statusId: issue.statusId,
    assigneeId: issue.assigneeId,
    reporterId: issue.reporterId,
    issueKey: issue.issueKey,
    type: issueTypes.has(issue.type as IssueType) ? (issue.type as IssueType) : "TASK",
    summary: issue.summary,
    description: issue.description,
    priority: priorities.has(issue.priority as IssuePriority)
      ? (issue.priority as IssuePriority)
      : "MEDIUM",
    labels: parseLabels(issue.labels),
    storyPoints: issue.storyPoints,
    estimateHours: issue.estimateHours,
    loggedHours: issue.loggedHours,
    rank: issue.rank,
    isFlagged: issue.isFlagged,
    startDate: toIso(issue.startDate),
    dueDate: toIso(issue.dueDate),
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    status: serializeStatus(issue.status),
    assignee: issue.assignee ? serializeMember(issue.assignee) : null,
    reporter: issue.reporter ? serializeMember(issue.reporter) : null,
    comments: issue.comments.map(serializeComment),
    attachments: issue.attachments.map(serializeAttachment)
  };
}

function serializeProject(project: NonNullable<Awaited<ReturnType<typeof prisma.project.findFirst>>>): ProjectDto {
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    summary: project.summary,
    leadName: project.leadName,
    color: project.color,
    startDate: toIso(project.startDate),
    targetDate: toIso(project.targetDate)
  };
}

function serializeSprint(sprint: Awaited<ReturnType<typeof prisma.sprint.findMany>>[number]): SprintDto {
  return {
    id: sprint.id,
    projectId: sprint.projectId,
    name: sprint.name,
    goal: sprint.goal,
    status: sprintStatuses.has(sprint.status as SprintStatus)
      ? (sprint.status as SprintStatus)
      : "PLANNED",
    startDate: toIso(sprint.startDate),
    endDate: toIso(sprint.endDate)
  };
}

export async function getWorkspaceData(): Promise<WorkspaceData> {
  const project = await prisma.project.findFirst({
    orderBy: {
      createdAt: "asc"
    }
  });

  if (!project) {
    throw new Error("프로젝트 데이터가 없습니다. npm run db:reset으로 샘플 데이터를 생성하세요.");
  }

  const [statuses, sprints, members, issues] = await Promise.all([
    prisma.status.findMany({
      where: { projectId: project.id },
      orderBy: { sortOrder: "asc" }
    }),
    prisma.sprint.findMany({
      where: { projectId: project.id },
      orderBy: [{ status: "asc" }, { startDate: "asc" }]
    }),
    prisma.member.findMany({
      where: { projectId: project.id },
      orderBy: { name: "asc" }
    }),
    prisma.issue.findMany({
      where: { projectId: project.id },
      include: issueInclude,
      orderBy: [{ rank: "asc" }, { createdAt: "asc" }]
    })
  ]);

  return {
    project: serializeProject(project),
    statuses: statuses.map(serializeStatus),
    sprints: sprints.map(serializeSprint),
    members: members.map(serializeMember),
    issues: issues.map(serializeIssue)
  };
}
