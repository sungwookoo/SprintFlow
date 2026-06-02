export type IssueType = "EPIC" | "STORY" | "TASK" | "BUG" | "SUBTASK";
export type IssuePriority = "HIGHEST" | "HIGH" | "MEDIUM" | "LOW";
export type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE";
export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED";

export type ProjectDto = {
  id: string;
  key: string;
  name: string;
  summary: string;
  leadName: string;
  color: string;
  startDate: string | null;
  targetDate: string | null;
};

export type StatusDto = {
  id: string;
  projectId: string;
  name: string;
  category: StatusCategory;
  color: string;
  sortOrder: number;
};

export type SprintDto = {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
};

export type MemberDto = {
  id: string;
  projectId: string;
  name: string;
  initials: string;
  role: string;
  color: string;
};

export type CommentDto = {
  id: string;
  issueId: string;
  authorId: string | null;
  author: MemberDto | null;
  body: string;
  createdAt: string;
};

export type AttachmentDto = {
  id: string;
  issueId: string;
  fileName: string;
  url: string;
  fileSize: number;
  createdAt: string;
};

export type IssueDto = {
  id: string;
  projectId: string;
  sprintId: string | null;
  parentId: string | null;
  statusId: string;
  assigneeId: string | null;
  reporterId: string | null;
  issueKey: string;
  type: IssueType;
  summary: string;
  description: string;
  priority: IssuePriority;
  labels: string[];
  storyPoints: number;
  estimateHours: number;
  loggedHours: number;
  rank: number;
  isFlagged: boolean;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  status: StatusDto;
  assignee: MemberDto | null;
  reporter: MemberDto | null;
  comments: CommentDto[];
  attachments: AttachmentDto[];
};

export type WorkspaceData = {
  project: ProjectDto;
  statuses: StatusDto[];
  sprints: SprintDto[];
  members: MemberDto[];
  issues: IssueDto[];
};
