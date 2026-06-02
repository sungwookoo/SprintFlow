"use client";

import clsx from "clsx";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FilePlus2,
  Flag,
  Gauge,
  Kanban,
  LayoutDashboard,
  Link as LinkIcon,
  ListTodo,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  TimerReset,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ISSUE_TYPE_META, PRIORITY_META } from "@/lib/issue-metadata";
import type {
  AttachmentDto,
  CommentDto,
  IssueDto,
  IssuePriority,
  IssueType,
  MemberDto,
  SprintDto,
  StatusDto,
  WorkspaceData
} from "@/lib/types";

type ViewKey = "dashboard" | "board" | "backlog" | "calendar" | "issues" | "settings";

type IssuePatch = Partial<{
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

type CreateIssuePayload = {
  projectId: string;
  summary: string;
  type: IssueType;
  sprintId?: string | null;
  parentId?: string | null;
  statusId?: string;
  assigneeId?: string | null;
  priority?: IssuePriority;
  dueDate?: string | null;
};

type CreateMemberPayload = {
  projectId: string;
  name: string;
  initials: string;
  role: string;
  color: string;
};

type MemberPatch = Partial<Omit<CreateMemberPayload, "projectId">>;

const views: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { key: "board", label: "보드", icon: Kanban },
  { key: "backlog", label: "백로그", icon: ListTodo },
  { key: "calendar", label: "일정", icon: CalendarDays },
  { key: "issues", label: "이슈", icon: Archive },
  { key: "settings", label: "설정", icon: Settings }
];

const issueTypes: IssueType[] = ["TASK", "STORY", "BUG", "EPIC"];
const priorities: IssuePriority[] = ["HIGHEST", "HIGH", "MEDIUM", "LOW"];

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric"
});

const longDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric"
});

function sortIssues(issues: IssueDto[]) {
  return [...issues].sort((a, b) => a.rank - b.rank || a.issueKey.localeCompare(b.issueKey));
}

function sortMembers(members: MemberDto[]) {
  return [...members].sort((a, b) => a.name.localeCompare(b.name));
}

function toInputDate(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "미정";
}

function formatLongDate(value: string | null) {
  return value ? longDateFormatter.format(new Date(value)) : "미정";
}

function dateKey(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function getSubtasks(issue: IssueDto, issues: IssueDto[]) {
  return sortIssues(issues.filter((candidate) => candidate.parentId === issue.id));
}

function getProgress(issue: IssueDto, issues: IssueDto[]) {
  const subtasks = getSubtasks(issue, issues);
  if (subtasks.length > 0) {
    const done = subtasks.filter((subtask) => subtask.status.category === "DONE").length;
    return Math.round((done / subtasks.length) * 100);
  }

  if (issue.status.category === "DONE") return 100;
  if (issue.status.category === "IN_PROGRESS") return 50;
  return 0;
}

function issueMatches(issue: IssueDto, query: string) {
  const value = query.trim().toLowerCase();
  if (!value) return true;

  return [
    issue.issueKey,
    issue.summary,
    issue.description,
    issue.status.name,
    issue.assignee?.name ?? "",
    ...issue.labels
  ]
    .join(" ")
    .toLowerCase()
    .includes(value);
}

function getSprintLabel(sprints: SprintDto[], sprintId: string | null) {
  if (!sprintId) return "백로그";
  return sprints.find((sprint) => sprint.id === sprintId)?.name ?? "스프린트";
}

function Avatar({ name, initials, color }: { name: string; initials: string; color: string }) {
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
      style={{ background: color }}
      title={name}
    >
      {initials}
    </span>
  );
}

function ProgressBar({ value, compact = false }: { value: number; compact?: boolean }) {
  return (
    <div className={clsx("w-full", compact ? "space-y-1" : "space-y-2")}>
      <div className="h-2 overflow-hidden rounded bg-slate-200">
        <div
          className="h-full rounded bg-mint transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {!compact ? <div className="text-xs font-semibold text-slate-500">{value}%</div> : null}
    </div>
  );
}

function IssueTypeBadge({ type }: { type: IssueType }) {
  const meta = ISSUE_TYPE_META[type];
  const Icon = meta.icon;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold"
      style={{ color: meta.color, background: meta.bg }}
    >
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

function PriorityMark({ priority, withLabel = false }: { priority: IssuePriority; withLabel?: boolean }) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: meta.color }}>
      <Icon size={14} />
      {withLabel ? meta.label : null}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone
}: {
  label: string;
  value: string;
  icon: typeof Gauge;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: tone }}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  activeView,
  onViewChange,
  data,
  progress
}: {
  activeView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  data: WorkspaceData;
  progress: number;
}) {
  const activeSprint = data.sprints.find((sprint) => sprint.status === "ACTIVE");

  return (
    <aside className="border-b border-line bg-white px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-[268px] lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white">
          <Sparkles size={20} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-ink">{data.project.name}</div>
          <div className="truncate text-xs font-semibold text-slate-500">{data.project.key} 프로젝트</div>
        </div>
      </div>

      <nav className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1">
        {views.map((view) => {
          const Icon = view.icon;
          const isActive = activeView === view.key;

          return (
            <button
              key={view.key}
              type="button"
              onClick={() => onViewChange(view.key)}
              className={clsx(
                "focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition",
                isActive
                  ? "bg-ocean text-white shadow-card"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-ink"
              )}
              title={view.label}
            >
              <Icon size={17} />
              <span>{view.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-5 hidden rounded-lg border border-line bg-smoke p-4 lg:block">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">활성 스프린트</div>
            <div className="mt-1 text-sm font-bold text-ink">{activeSprint?.name ?? "없음"}</div>
          </div>
          <TimerReset size={18} className="text-ocean" />
        </div>
        <div className="mt-3">
          <ProgressBar value={progress} compact />
        </div>
        <div className="mt-2 text-xs font-semibold text-slate-500">
          {activeSprint ? `${formatDate(activeSprint.startDate)} - ${formatDate(activeSprint.endDate)}` : "계획 필요"}
        </div>
      </div>

    </aside>
  );
}

function TopBar({
  data,
  query,
  onQueryChange,
  onCreateClick
}: {
  data: WorkspaceData;
  query: string;
  onQueryChange: (query: string) => void;
  onCreateClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/92 px-4 py-3 backdrop-blur lg:px-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-ocean">
            <span className="h-2 w-2 rounded bg-mint" />
            {data.project.leadName}
          </div>
          <h1 className="mt-1 truncate text-2xl font-bold text-ink">{data.project.name}</h1>
          <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">{data.project.summary}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="focus-within:shadow-card flex min-w-0 items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
            <Search size={17} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="w-full min-w-[220px] border-0 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-slate-400"
              placeholder="이슈, 라벨, 담당자 검색"
            />
          </label>
          <button
            type="button"
            onClick={onCreateClick}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white shadow-card hover:bg-slate-800"
            title="작업 만들기"
          >
            <Plus size={17} />
            만들기
          </button>
        </div>
      </div>
    </header>
  );
}

function IssueCard({
  issue,
  allIssues,
  sprints,
  onSelect,
  onDragStart
}: {
  issue: IssueDto;
  allIssues: IssueDto[];
  sprints: SprintDto[];
  onSelect: (issueId: string) => void;
  onDragStart?: (issueId: string) => void;
}) {
  const progress = getProgress(issue, allIssues);
  const subtasks = getSubtasks(issue, allIssues);
  const remainingDays = daysUntil(issue.dueDate);

  return (
    <article
      draggable={Boolean(onDragStart)}
      onDragStart={() => onDragStart?.(issue.id)}
      onClick={() => onSelect(issue.id)}
      className="group rounded-lg border border-line bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-panel"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <IssueTypeBadge type={issue.type} />
          {issue.isFlagged ? <Flag size={14} className="text-rose" /> : null}
        </div>
        <PriorityMark priority={issue.priority} />
      </div>

      <h3 className="mt-3 break-words text-sm font-bold leading-5 text-ink">{issue.summary}</h3>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span>{issue.issueKey}</span>
        <span>{getSprintLabel(sprints, issue.sprintId)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ProgressBar value={progress} compact />
        </div>
        {issue.assignee ? (
          <Avatar name={issue.assignee.name} initials={issue.assignee.initials} color={issue.assignee.color} />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-500">
            -
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span
          className={clsx(
            "inline-flex items-center gap-1 rounded-md px-2 py-1",
            remainingDays !== null && remainingDays < 0
              ? "bg-rose-50 text-rose"
              : remainingDays !== null && remainingDays <= 3
                ? "bg-amber-50 text-amber"
                : "bg-slate-100 text-slate-600"
          )}
        >
          <Clock size={13} />
          {formatDate(issue.dueDate)}
        </span>
        {subtasks.length > 0 ? (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
            하위 {subtasks.filter((subtask) => subtask.status.category === "DONE").length}/{subtasks.length}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function DashboardView({
  data,
  filteredIssues,
  onSelect
}: {
  data: WorkspaceData;
  filteredIssues: IssueDto[];
  onSelect: (issueId: string) => void;
}) {
  const topLevel = filteredIssues.filter((issue) => issue.type !== "SUBTASK");
  const doneCount = topLevel.filter((issue) => issue.status.category === "DONE").length;
  const progress = topLevel.length ? Math.round((doneCount / topLevel.length) * 100) : 0;
  const activeSprint = data.sprints.find((sprint) => sprint.status === "ACTIVE");
  const activeIssues = topLevel.filter((issue) => issue.sprintId === activeSprint?.id);
  const dueSoon = topLevel.filter((issue) => {
    const days = daysUntil(issue.dueDate);
    return days !== null && days >= 0 && days <= 7 && issue.status.category !== "DONE";
  });
  const flagged = topLevel.filter((issue) => issue.isFlagged);
  const totalPoints = activeIssues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  const donePoints = activeIssues
    .filter((issue) => issue.status.category === "DONE")
    .reduce((sum, issue) => sum + issue.storyPoints, 0);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="전체 작업" value={`${topLevel.length}`} icon={ListTodo} tone="#e8f0ff" />
        <MetricCard label="완료율" value={`${progress}%`} icon={Gauge} tone="#e7f8ef" />
        <MetricCard label="이번 스프린트" value={`${donePoints}/${totalPoints} SP`} icon={TimerReset} tone="#fff3df" />
        <MetricCard label="주의 필요" value={`${flagged.length + dueSoon.length}`} icon={Flag} tone="#ffe8ef" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink">상태 흐름</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">상위 이슈 기준</p>
            </div>
            <MoreHorizontal size={18} className="text-slate-400" />
          </div>
          <div className="mt-4 space-y-3">
            {data.statuses.map((status) => {
              const count = topLevel.filter((issue) => issue.statusId === status.id).length;
              const value = topLevel.length ? Math.round((count / topLevel.length) * 100) : 0;

              return (
                <div key={status.id}>
                  <div className="mb-1 flex items-center justify-between text-sm font-semibold">
                    <span className="flex items-center gap-2 text-ink">
                      <span className="h-2.5 w-2.5 rounded" style={{ background: status.color }} />
                      {status.name}
                    </span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <ProgressBar value={value} compact />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink">마감 임박</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">7일 안에 끝내야 할 작업</p>
            </div>
            <CalendarDays size={18} className="text-ocean" />
          </div>
          <div className="mt-4 space-y-2">
            {dueSoon.length === 0 ? (
              <div className="rounded-lg bg-smoke p-4 text-sm font-semibold text-slate-500">마감 임박 작업이 없습니다.</div>
            ) : (
              dueSoon.slice(0, 6).map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onSelect(issue.id)}
                  className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-left hover:bg-smoke"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">{issue.summary}</span>
                    <span className="text-xs font-semibold text-slate-500">{issue.issueKey}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-amber">{formatDate(issue.dueDate)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">팀 작업량</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">담당자별 미완료 작업</p>
          </div>
          <Check size={18} className="text-mint" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.members.map((member) => {
            const assigned = topLevel.filter(
              (issue) => issue.assigneeId === member.id && issue.status.category !== "DONE"
            );
            const points = assigned.reduce((sum, issue) => sum + issue.storyPoints, 0);

            return (
              <div key={member.id} className="rounded-lg border border-line bg-smoke p-3">
                <div className="flex items-center gap-2">
                  <Avatar name={member.name} initials={member.initials} color={member.color} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-ink">{member.name}</div>
                    <div className="truncate text-xs font-semibold text-slate-500">{member.role}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm font-bold text-ink">{assigned.length}개 작업</div>
                <div className="text-xs font-semibold text-slate-500">{points} story points</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BoardView({
  data,
  filteredIssues,
  onSelect,
  onUpdate
}: {
  data: WorkspaceData;
  filteredIssues: IssueDto[];
  onSelect: (issueId: string) => void;
  onUpdate: (issueId: string, patch: IssuePatch) => Promise<void>;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const activeSprint = data.sprints.find((sprint) => sprint.status === "ACTIVE");
  const boardIssues = sortIssues(
    filteredIssues.filter(
      (issue) => issue.type !== "SUBTASK" && (!activeSprint || issue.sprintId === activeSprint.id)
    )
  );

  async function handleDrop(status: StatusDto) {
    if (!draggingId) return;
    await onUpdate(draggingId, { statusId: status.id });
    setDraggingId(null);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-white p-4 shadow-card xl:flex-row xl:items-center">
        <div>
          <h2 className="text-lg font-bold text-ink">{activeSprint?.name ?? "전체 보드"}</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {activeSprint?.goal ?? "스프린트가 없으면 모든 상위 이슈를 상태별로 보여줍니다."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.statuses.map((status) => (
            <span key={status.id} className="inline-flex items-center gap-2 rounded-md bg-smoke px-2 py-1 text-xs font-bold text-slate-600">
              <span className="h-2 w-2 rounded" style={{ background: status.color }} />
              {status.name}
            </span>
          ))}
        </div>
      </div>

      <div className="scrollbar-slim grid gap-3 overflow-x-auto pb-3 xl:grid-cols-4">
        {data.statuses.map((status) => {
          const issues = boardIssues.filter((issue) => issue.statusId === status.id);
          const points = issues.reduce((sum, issue) => sum + issue.storyPoints, 0);

          return (
            <div
              key={status.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void handleDrop(status)}
              className="min-h-[520px] min-w-[280px] rounded-lg border border-line bg-smoke p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded" style={{ background: status.color }} />
                    <h3 className="truncate text-sm font-bold uppercase tracking-normal text-slate-600">{status.name}</h3>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {issues.length}개 작업 · {points} SP
                  </div>
                </div>
                <button type="button" className="focus-ring rounded-lg p-2 text-slate-400 hover:bg-white" title="컬럼 메뉴">
                  <MoreHorizontal size={17} />
                </button>
              </div>

              <div className="space-y-3">
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    allIssues={data.issues}
                    sprints={data.sprints}
                    onSelect={onSelect}
                    onDragStart={setDraggingId}
                  />
                ))}
                {issues.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm font-semibold text-slate-400">
                    비어 있음
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QuickCreateIssue({
  data,
  defaultSprintId,
  onCreate
}: {
  data: WorkspaceData;
  defaultSprintId?: string | null;
  onCreate: (payload: CreateIssuePayload) => Promise<void>;
}) {
  const [summary, setSummary] = useState("");
  const [type, setType] = useState<IssueType>("TASK");
  const [priority, setPriority] = useState<IssuePriority>("MEDIUM");
  const [sprintId, setSprintId] = useState<string | null>(defaultSprintId ?? null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!summary.trim()) return;

    setIsSaving(true);
    try {
      await onCreate({
        projectId: data.project.id,
        summary: summary.trim(),
        type,
        priority,
        sprintId,
        assigneeId: data.members[0]?.id ?? null
      });
      setSummary("");
      setType("TASK");
      setPriority("MEDIUM");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-lg border border-line bg-white p-3 shadow-card xl:grid-cols-[1fr_140px_140px_170px_auto]">
      <input
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        className="focus-ring min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
        placeholder="새 작업 제목"
      />
      <select
        value={type}
        onChange={(event) => setType(event.target.value as IssueType)}
        className="focus-ring rounded-lg border border-line px-3 text-sm font-semibold text-ink"
      >
        {issueTypes.map((item) => (
          <option key={item} value={item}>
            {ISSUE_TYPE_META[item].label}
          </option>
        ))}
      </select>
      <select
        value={priority}
        onChange={(event) => setPriority(event.target.value as IssuePriority)}
        className="focus-ring rounded-lg border border-line px-3 text-sm font-semibold text-ink"
      >
        {priorities.map((item) => (
          <option key={item} value={item}>
            {PRIORITY_META[item].label}
          </option>
        ))}
      </select>
      <select
        value={sprintId ?? "BACKLOG"}
        onChange={(event) => setSprintId(event.target.value === "BACKLOG" ? null : event.target.value)}
        className="focus-ring rounded-lg border border-line px-3 text-sm font-semibold text-ink"
      >
        <option value="BACKLOG">백로그</option>
        {data.sprints
          .filter((sprint) => sprint.status !== "COMPLETED")
          .map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name}
            </option>
          ))}
      </select>
      <button
        type="submit"
        disabled={isSaving || !summary.trim()}
        className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-ocean px-4 text-sm font-bold text-white disabled:opacity-50"
        title="작업 추가"
      >
        <Plus size={16} />
        추가
      </button>
    </form>
  );
}

function BacklogIssueRow({
  issue,
  data,
  onSelect,
  onUpdate
}: {
  issue: IssueDto;
  data: WorkspaceData;
  onSelect: (issueId: string) => void;
  onUpdate: (issueId: string, patch: IssuePatch) => Promise<void>;
}) {
  const progress = getProgress(issue, data.issues);
  const subtasks = getSubtasks(issue, data.issues);

  return (
    <div className="grid gap-2 rounded-lg border border-line bg-white p-3 shadow-sm xl:grid-cols-[1fr_150px_150px_130px_90px] xl:items-center">
      <button type="button" onClick={() => onSelect(issue.id)} className="min-w-0 text-left">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <IssueTypeBadge type={issue.type} />
          <span className="text-xs font-bold text-slate-500">{issue.issueKey}</span>
          {issue.isFlagged ? <Flag size={14} className="text-rose" /> : null}
        </div>
        <div className="mt-2 break-words text-sm font-bold text-ink">{issue.summary}</div>
        {subtasks.length > 0 ? (
          <div className="mt-2 max-w-[240px]">
            <ProgressBar value={progress} compact />
          </div>
        ) : null}
      </button>

      <select
        value={issue.statusId}
        onChange={(event) => void onUpdate(issue.id, { statusId: event.target.value })}
        className="focus-ring rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink"
      >
        {data.statuses.map((status) => (
          <option key={status.id} value={status.id}>
            {status.name}
          </option>
        ))}
      </select>

      <select
        value={issue.sprintId ?? "BACKLOG"}
        onChange={(event) =>
          void onUpdate(issue.id, {
            sprintId: event.target.value === "BACKLOG" ? null : event.target.value
          })
        }
        className="focus-ring rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink"
      >
        <option value="BACKLOG">백로그</option>
        {data.sprints.map((sprint) => (
          <option key={sprint.id} value={sprint.id}>
            {sprint.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        {issue.assignee ? (
          <>
            <Avatar name={issue.assignee.name} initials={issue.assignee.initials} color={issue.assignee.color} />
            <span className="truncate text-sm font-semibold text-slate-600">{issue.assignee.name}</span>
          </>
        ) : (
          <span className="text-sm font-semibold text-slate-400">담당자 없음</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-sm font-bold text-slate-600 xl:justify-end">
        <PriorityMark priority={issue.priority} />
        <span>{issue.storyPoints} SP</span>
      </div>
    </div>
  );
}

function BacklogSection({
  title,
  subtitle,
  issues,
  data,
  onSelect,
  onUpdate
}: {
  title: string;
  subtitle: string;
  issues: IssueDto[];
  data: WorkspaceData;
  onSelect: (issueId: string) => void;
  onUpdate: (issueId: string, patch: IssuePatch) => Promise<void>;
}) {
  const points = issues.reduce((sum, issue) => sum + issue.storyPoints, 0);

  return (
    <section className="rounded-lg border border-line bg-smoke p-3">
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>
        <div className="text-sm font-bold text-slate-600">
          {issues.length}개 · {points} SP
        </div>
      </div>
      <div className="space-y-2">
        {issues.map((issue) => (
          <BacklogIssueRow key={issue.id} issue={issue} data={data} onSelect={onSelect} onUpdate={onUpdate} />
        ))}
        {issues.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-semibold text-slate-400">
            작업 없음
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BacklogView({
  data,
  filteredIssues,
  onSelect,
  onUpdate,
  onCreate
}: {
  data: WorkspaceData;
  filteredIssues: IssueDto[];
  onSelect: (issueId: string) => void;
  onUpdate: (issueId: string, patch: IssuePatch) => Promise<void>;
  onCreate: (payload: CreateIssuePayload) => Promise<void>;
}) {
  const activeSprint = data.sprints.find((sprint) => sprint.status === "ACTIVE");
  const plannedSprints = data.sprints.filter((sprint) => sprint.status === "PLANNED");
  const topLevel = sortIssues(filteredIssues.filter((issue) => issue.type !== "SUBTASK"));
  const backlogIssues = topLevel.filter((issue) => !issue.sprintId);

  return (
    <div className="space-y-4">
      <QuickCreateIssue data={data} defaultSprintId={activeSprint?.id ?? null} onCreate={onCreate} />

      {activeSprint ? (
        <BacklogSection
          title={activeSprint.name}
          subtitle={`${formatLongDate(activeSprint.startDate)} - ${formatLongDate(activeSprint.endDate)} · ${activeSprint.goal}`}
          issues={topLevel.filter((issue) => issue.sprintId === activeSprint.id)}
          data={data}
          onSelect={onSelect}
          onUpdate={onUpdate}
        />
      ) : null}

      {plannedSprints.map((sprint) => (
        <BacklogSection
          key={sprint.id}
          title={sprint.name}
          subtitle={`${formatLongDate(sprint.startDate)} - ${formatLongDate(sprint.endDate)} · ${sprint.goal}`}
          issues={topLevel.filter((issue) => issue.sprintId === sprint.id)}
          data={data}
          onSelect={onSelect}
          onUpdate={onUpdate}
        />
      ))}

      <BacklogSection
        title="백로그"
        subtitle="아직 스프린트에 배치되지 않은 작업"
        issues={backlogIssues}
        data={data}
        onSelect={onSelect}
        onUpdate={onUpdate}
      />
    </div>
  );
}

function CalendarView({
  data,
  filteredIssues,
  onSelect
}: {
  data: WorkspaceData;
  filteredIssues: IssueDto[];
  onSelect: (issueId: string) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const monthName = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(cursor);
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, index) =>
    index < startOffset ? null : new Date(cursor.getFullYear(), cursor.getMonth(), index - startOffset + 1)
  );
  const topLevel = filteredIssues.filter((issue) => issue.type !== "SUBTASK" && issue.dueDate);

  function moveMonth(amount: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-ink">{monthName}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">마감일 기준 작업 일정</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="focus-ring rounded-lg border border-line p-2 text-slate-600 hover:bg-smoke"
            title="이전 달"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="focus-ring rounded-lg border border-line p-2 text-slate-600 hover:bg-smoke"
            title="다음 달"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell, index) => {
          const key = cell ? cell.toISOString().slice(0, 10) : `blank-${index}`;
          const issues = cell ? topLevel.filter((issue) => dateKey(issue.dueDate) === key) : [];
          const todayKey = new Date().toISOString().slice(0, 10);

          return (
            <div
              key={key}
              className={clsx(
                "min-h-[124px] rounded-lg border p-2",
                cell ? "border-line bg-smoke" : "border-transparent bg-transparent",
                key === todayKey && "ring-2 ring-ocean"
              )}
            >
              {cell ? <div className="text-xs font-bold text-slate-500">{cell.getDate()}</div> : null}
              <div className="mt-2 space-y-1">
                {issues.slice(0, 3).map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => onSelect(issue.id)}
                    className="focus-ring block w-full rounded-md bg-white px-2 py-1 text-left text-[11px] font-bold leading-4 text-ink shadow-sm hover:bg-blue-50"
                  >
                    <span className="block truncate">{issue.summary}</span>
                    <span className="text-slate-400">{issue.issueKey}</span>
                  </button>
                ))}
                {issues.length > 3 ? (
                  <div className="text-[11px] font-bold text-slate-500">+{issues.length - 3}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function IssuesView({
  data,
  filteredIssues,
  onSelect,
  onUpdate
}: {
  data: WorkspaceData;
  filteredIssues: IssueDto[];
  onSelect: (issueId: string) => void;
  onUpdate: (issueId: string, patch: IssuePatch) => Promise<void>;
}) {
  const issues = sortIssues(filteredIssues);

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
      <div className="grid grid-cols-[1.2fr_140px_140px_150px_120px] gap-3 border-b border-line bg-smoke px-4 py-3 text-xs font-bold uppercase tracking-normal text-slate-500 max-xl:hidden">
        <div>이슈</div>
        <div>상태</div>
        <div>우선순위</div>
        <div>담당자</div>
        <div>마감</div>
      </div>
      <div className="divide-y divide-line">
        {issues.map((issue) => (
          <div key={issue.id} className="grid gap-3 px-4 py-3 xl:grid-cols-[1.2fr_140px_140px_150px_120px] xl:items-center">
            <button type="button" onClick={() => onSelect(issue.id)} className="min-w-0 text-left">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <IssueTypeBadge type={issue.type} />
                <span className="text-xs font-bold text-slate-500">{issue.issueKey}</span>
              </div>
              <div className="mt-2 break-words text-sm font-bold text-ink">{issue.summary}</div>
            </button>
            <select
              value={issue.statusId}
              onChange={(event) => void onUpdate(issue.id, { statusId: event.target.value })}
              className="focus-ring rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink"
            >
              {data.statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
            <PriorityMark priority={issue.priority} withLabel />
            <div className="flex items-center gap-2">
              {issue.assignee ? (
                <>
                  <Avatar name={issue.assignee.name} initials={issue.assignee.initials} color={issue.assignee.color} />
                  <span className="truncate text-sm font-semibold text-slate-600">{issue.assignee.name}</span>
                </>
              ) : (
                <span className="text-sm font-semibold text-slate-400">없음</span>
              )}
            </div>
            <div className="text-sm font-bold text-slate-600">{formatDate(issue.dueDate)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const memberColorOptions = ["#2563eb", "#15a46b", "#7c3aed", "#e11d48", "#d97706", "#0891b2"];

function SettingsView({
  data,
  onCreateMember,
  onUpdateMember,
  onDeleteMember
}: {
  data: WorkspaceData;
  onCreateMember: (payload: CreateMemberPayload) => Promise<void>;
  onUpdateMember: (memberId: string, patch: MemberPatch) => Promise<void>;
  onDeleteMember: (memberId: string) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [backupMessage, setBackupMessage] = useState("");
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [backupSaveConfirmOpen, setBackupSaveConfirmOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    initials: "",
    role: "팀원",
    color: memberColorOptions[0]
  });
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberPatch>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);

  function updateDraft(memberId: string, patch: MemberPatch) {
    setMemberDrafts((current) => ({
      ...current,
      [memberId]: {
        ...current[memberId],
        ...patch
      }
    }));
  }

  async function downloadBackup() {
    setIsBackupBusy(true);
    setBackupMessage("");
    try {
      const response = await fetch("/api/backups/download");
      if (!response.ok) throw new Error("백업 다운로드에 실패했습니다.");

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match?.[1] ?? `sprintflow-backup-${Date.now()}.json`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupMessage(`백업 파일을 다운로드했습니다: ${fileName}`);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "백업 다운로드에 실패했습니다.");
    } finally {
      setIsBackupBusy(false);
    }
  }

  async function saveServerBackup() {
    setIsBackupBusy(true);
    setBackupMessage("");
    try {
      const response = await fetch("/api/backups/save", { method: "POST" });
      if (!response.ok) throw new Error("서버 백업 저장에 실패했습니다.");
      const result = (await response.json()) as { backup: { fileName: string } };
      setBackupMessage(`서버 백업을 저장했습니다: ${result.backup.fileName}`);
      setBackupSaveConfirmOpen(false);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "서버 백업 저장에 실패했습니다.");
    } finally {
      setIsBackupBusy(false);
    }
  }

  async function restoreLatestBackup() {
    if (!window.confirm("현재 데이터를 최신 서버 백업으로 교체합니다. 계속할까요?")) return;

    setIsBackupBusy(true);
    setBackupMessage("");
    try {
      const response = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latest: true })
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(result?.message ?? "최신 백업 복원에 실패했습니다.");
      }
      window.location.reload();
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "최신 백업 복원에 실패했습니다.");
      setIsBackupBusy(false);
    }
  }

  async function restoreBackupFile(file: File) {
    if (!window.confirm(`${file.name} 파일로 현재 데이터를 교체합니다. 계속할까요?`)) return;

    setIsBackupBusy(true);
    setBackupMessage("");
    try {
      const snapshot = JSON.parse(await file.text()) as unknown;
      const response = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot })
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(result?.message ?? "백업 파일 복원에 실패했습니다.");
      }
      window.location.reload();
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "백업 파일 복원에 실패했습니다.");
      setIsBackupBusy(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function submitNewMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMember.name.trim()) return;

    await onCreateMember({
      projectId: data.project.id,
      name: newMember.name.trim(),
      initials: newMember.initials.trim(),
      role: newMember.role.trim() || "팀원",
      color: newMember.color
    });
    setNewMember({
      name: "",
      initials: "",
      role: "팀원",
      color: memberColorOptions[data.members.length % memberColorOptions.length]
    });
  }

  async function saveMember(member: MemberDto) {
    const patch = memberDrafts[member.id];
    if (!patch) return;

    setSavingMemberId(member.id);
    try {
      await onUpdateMember(member.id, patch);
      setMemberDrafts((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
    } finally {
      setSavingMemberId(null);
    }
  }

  async function deleteMember(member: MemberDto) {
    if (!window.confirm(`${member.name} 사용자를 삭제하고 담당 작업을 미지정으로 바꿉니다. 계속할까요?`)) return;

    setSavingMemberId(member.id);
    try {
      await onDeleteMember(member.id);
    } finally {
      setSavingMemberId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-4 shadow-card">
        <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
          <div>
            <h2 className="text-lg font-bold text-ink">프로젝트 설정</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              로컬 단일 사용자 환경에서 데이터 백업과 담당자 목록을 관리합니다.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-smoke px-3 py-2 text-sm font-bold text-slate-600">
            <Settings size={16} />
            {data.project.key}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <div className="flex items-center gap-2">
            <Archive size={18} className="text-ocean" />
            <h3 className="text-base font-bold text-ink">백업 및 복원</h3>
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            프로젝트, 상태, 스프린트, 이슈, 하위작업, 댓글, 첨부, 사용자 데이터를 하나의 JSON 스냅샷으로 저장합니다.
          </p>

          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <div className="flex items-start gap-2">
                <Save size={16} className="mt-0.5 shrink-0 text-ocean" />
                <div>
                  <div className="text-sm font-bold text-ink">서버 백업 저장</div>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                    현재 상태를 <span className="font-bold text-ink">prisma/backups</span>에 저장하고 최신 복원 기준으로 사용합니다.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <RefreshCcw size={16} className="mt-0.5 shrink-0 text-amber" />
                <div>
                  <div className="text-sm font-bold text-ink">최신 백업 복원</div>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                    가장 최근 서버 백업으로 되돌립니다. 현재 데이터는 백업 시점의 데이터로 교체됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setBackupMessage("");
                setBackupSaveConfirmOpen(true);
              }}
              disabled={isBackupBusy}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ocean px-3 text-sm font-bold text-white disabled:opacity-50"
              title="서버 백업 저장"
            >
              <Save size={16} />
              서버 백업 저장
            </button>
            <button
              type="button"
              onClick={() => void restoreLatestBackup()}
              disabled={isBackupBusy}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-ink hover:bg-smoke disabled:opacity-50"
              title="최신 서버 백업 복원"
            >
              <RefreshCcw size={16} />
              최신 백업 복원
            </button>
            <button
              type="button"
              onClick={() => void downloadBackup()}
              disabled={isBackupBusy}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-ink hover:bg-smoke disabled:opacity-50"
              title="백업 파일 다운로드"
            >
              <Download size={16} />
              파일 다운로드
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBackupBusy}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-ink hover:bg-smoke disabled:opacity-50"
              title="백업 파일로 복원"
            >
              <Upload size={16} />
              파일로 복원
            </button>
          </div>
          {backupSaveConfirmOpen ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-bold text-ink">서버 백업을 저장할까요?</div>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                저장 후 최신 백업 복원 기준이 현재 상태로 바뀝니다.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void saveServerBackup()}
                  disabled={isBackupBusy}
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-ocean px-3 text-sm font-bold text-white disabled:opacity-50"
                  title="서버 백업 저장 실행"
                >
                  <Save size={16} />
                  저장 실행
                </button>
                <button
                  type="button"
                  onClick={() => setBackupSaveConfirmOpen(false)}
                  disabled={isBackupBusy}
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-ink hover:bg-smoke disabled:opacity-50"
                  title="서버 백업 저장 취소"
                >
                  취소
                </button>
              </div>
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const [file] = Array.from(event.target.files ?? []);
              if (file) void restoreBackupFile(file);
            }}
          />
          {backupMessage ? (
            <div className="mt-4 rounded-lg bg-smoke px-3 py-2 text-sm font-semibold text-slate-600">{backupMessage}</div>
          ) : null}
        </div>

        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-mint" />
            <h3 className="text-base font-bold text-ink">사용자 관리</h3>
          </div>

          <form onSubmit={submitNewMember} className="mt-4 grid gap-2 xl:grid-cols-[1fr_92px_120px_96px_auto]">
            <input
              value={newMember.name}
              onChange={(event) => setNewMember((current) => ({ ...current, name: event.target.value }))}
              className="focus-ring min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
              placeholder="이름"
            />
            <input
              value={newMember.initials}
              onChange={(event) => setNewMember((current) => ({ ...current, initials: event.target.value.toUpperCase().slice(0, 3) }))}
              className="focus-ring min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
              placeholder="이니셜"
            />
            <input
              value={newMember.role}
              onChange={(event) => setNewMember((current) => ({ ...current, role: event.target.value }))}
              className="focus-ring min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
              placeholder="역할"
            />
            <input
              type="color"
              value={newMember.color}
              onChange={(event) => setNewMember((current) => ({ ...current, color: event.target.value }))}
              className="focus-ring h-10 w-full rounded-lg border border-line bg-white p-1"
              title="사용자 색상"
            />
            <button
              type="submit"
              disabled={!newMember.name.trim()}
              className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-sm font-bold text-white disabled:opacity-50"
              title="사용자 추가"
            >
              <UserPlus size={16} />
              추가
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {data.members.map((member) => {
              const draft = memberDrafts[member.id] ?? {};
              const values = {
                name: draft.name ?? member.name,
                initials: draft.initials ?? member.initials,
                role: draft.role ?? member.role,
                color: draft.color ?? member.color
              };
              const hasChanges = Boolean(memberDrafts[member.id]);

              return (
                <div key={member.id} className="grid gap-2 rounded-lg border border-line bg-smoke p-3 xl:grid-cols-[1fr_92px_120px_96px_auto_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={values.name} initials={values.initials || "-"} color={values.color} />
                    <input
                      value={values.name}
                      onChange={(event) => updateDraft(member.id, { name: event.target.value })}
                      className="focus-ring min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink"
                      placeholder="이름"
                    />
                  </div>
                  <input
                    value={values.initials}
                    onChange={(event) => updateDraft(member.id, { initials: event.target.value.toUpperCase().slice(0, 3) })}
                    className="focus-ring min-h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink"
                    placeholder="이니셜"
                  />
                  <input
                    value={values.role}
                    onChange={(event) => updateDraft(member.id, { role: event.target.value })}
                    className="focus-ring min-h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink"
                    placeholder="역할"
                  />
                  <input
                    type="color"
                    value={values.color}
                    onChange={(event) => updateDraft(member.id, { color: event.target.value })}
                    className="focus-ring h-10 w-full rounded-lg border border-line bg-white p-1"
                    title={`${member.name} 색상`}
                  />
                  <button
                    type="button"
                    onClick={() => void saveMember(member)}
                    disabled={!hasChanges || savingMemberId === member.id}
                    className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-ocean px-3 text-sm font-bold text-white disabled:opacity-50"
                    title="사용자 저장"
                  >
                    <Check size={16} />
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteMember(member)}
                    disabled={savingMemberId === member.id}
                    className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-rose hover:bg-rose-50 disabled:opacity-50"
                    title="사용자 삭제"
                  >
                    <Trash2 size={16} />
                    삭제
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function IssueDrawer({
  issue,
  data,
  onClose,
  onUpdate,
  onCreate,
  onComment,
  onAttachment
}: {
  issue: IssueDto | null;
  data: WorkspaceData;
  onClose: () => void;
  onUpdate: (issueId: string, patch: IssuePatch) => Promise<void>;
  onCreate: (payload: CreateIssuePayload) => Promise<void>;
  onComment: (issueId: string, body: string) => Promise<void>;
  onAttachment: (issueId: string, attachment: { fileName: string; url: string }) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    summary: "",
    description: "",
    labels: "",
    storyPoints: 0,
    estimateHours: 0,
    loggedHours: 0,
    startDate: "",
    dueDate: ""
  });
  const [subtaskSummary, setSubtaskSummary] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [attachment, setAttachment] = useState({ fileName: "", url: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!issue) return;
    setDraft({
      summary: issue.summary,
      description: issue.description,
      labels: issue.labels.join(", "),
      storyPoints: issue.storyPoints,
      estimateHours: issue.estimateHours,
      loggedHours: issue.loggedHours,
      startDate: toInputDate(issue.startDate),
      dueDate: toInputDate(issue.dueDate)
    });
    setSubtaskSummary("");
    setCommentBody("");
    setAttachment({ fileName: "", url: "" });
  }, [issue?.id, issue]);

  if (!issue) return null;

  const currentIssue = issue;
  const subtasks = getSubtasks(currentIssue, data.issues);
  const progress = getProgress(currentIssue, data.issues);

  async function saveFields() {
    setIsSaving(true);
    try {
      await onUpdate(currentIssue.id, {
        summary: draft.summary.trim() || currentIssue.summary,
        description: draft.description,
        labels: draft.labels
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean),
        storyPoints: Number(draft.storyPoints) || 0,
        estimateHours: Number(draft.estimateHours) || 0,
        loggedHours: Number(draft.loggedHours) || 0,
        startDate: draft.startDate || null,
        dueDate: draft.dueDate || null
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function submitSubtask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subtaskSummary.trim()) return;

    await onCreate({
      projectId: currentIssue.projectId,
      parentId: currentIssue.id,
      sprintId: currentIssue.sprintId,
      type: "SUBTASK",
      summary: subtaskSummary.trim(),
      statusId: data.statuses[0]?.id,
      assigneeId: currentIssue.assigneeId,
      priority: "MEDIUM"
    });
    setSubtaskSummary("");
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    await onComment(currentIssue.id, commentBody.trim());
    setCommentBody("");
  }

  async function submitAttachment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!attachment.fileName.trim() || !attachment.url.trim()) return;
    await onAttachment(currentIssue.id, attachment);
    setAttachment({ fileName: "", url: "" });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/35">
      <button type="button" className="hidden flex-1 cursor-default lg:block" onClick={onClose} title="닫기" />
      <aside className="scrollbar-slim h-full w-full max-w-[760px] overflow-y-auto bg-white shadow-panel">
        <div className="sticky top-0 z-10 border-b border-line bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <IssueTypeBadge type={issue.type} />
                <span className="text-xs font-bold text-slate-500">{issue.issueKey}</span>
                <span className="text-xs font-bold text-slate-500">{getSprintLabel(data.sprints, issue.sprintId)}</span>
              </div>
              <h2 className="mt-2 break-words text-xl font-bold text-ink">{issue.summary}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-lg p-2 text-slate-500 hover:bg-smoke"
              title="닫기"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="grid gap-5 p-4 xl:grid-cols-[1fr_250px]">
          <main className="space-y-5">
            <section className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-ink">상세</h3>
                <button
                  type="button"
                  onClick={() => void saveFields()}
                  disabled={isSaving}
                  className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ocean px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  title="저장"
                >
                  <Check size={15} />
                  저장
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">제목</span>
                  <input
                    value={draft.summary}
                    onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
                    className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">설명</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    rows={5}
                    className="focus-ring mt-1 w-full resize-y rounded-lg border border-line px-3 py-2 text-sm font-medium leading-6 text-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">라벨</span>
                  <input
                    value={draft.labels}
                    onChange={(event) => setDraft((current) => ({ ...current, labels: event.target.value }))}
                    className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-ink">하위작업</h3>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{progress}% 완료</div>
                </div>
                <div className="w-32">
                  <ProgressBar value={progress} compact />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {subtasks.map((subtask) => (
                  <div key={subtask.id} className="grid gap-2 rounded-lg border border-line bg-smoke p-3 sm:grid-cols-[1fr_140px] sm:items-center">
                    <button type="button" onClick={() => undefined} className="min-w-0 text-left">
                      <div className="text-xs font-bold text-slate-500">{subtask.issueKey}</div>
                      <div className="mt-1 break-words text-sm font-bold text-ink">{subtask.summary}</div>
                    </button>
                    <select
                      value={subtask.statusId}
                      onChange={(event) => void onUpdate(subtask.id, { statusId: event.target.value })}
                      className="focus-ring rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
                    >
                      {data.statuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <form onSubmit={submitSubtask} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={subtaskSummary}
                  onChange={(event) => setSubtaskSummary(event.target.value)}
                  className="focus-ring min-h-10 flex-1 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
                  placeholder="하위작업 제목"
                />
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-ink hover:bg-smoke"
                  title="하위작업 추가"
                >
                  <FilePlus2 size={16} />
                  추가
                </button>
              </form>
            </section>

            <section className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={17} className="text-ocean" />
                <h3 className="text-sm font-bold text-ink">댓글</h3>
              </div>
              <div className="mt-4 space-y-3">
                {issue.comments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} />
                ))}
                {issue.comments.length === 0 ? (
                  <div className="rounded-lg bg-smoke p-3 text-sm font-semibold text-slate-500">댓글 없음</div>
                ) : null}
              </div>
              <form onSubmit={submitComment} className="mt-3 space-y-2">
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  rows={3}
                  className="focus-ring w-full resize-y rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink"
                  placeholder="댓글 작성"
                />
                <button
                  type="submit"
                  className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-bold text-white"
                  title="댓글 추가"
                >
                  <Plus size={15} />
                  댓글
                </button>
              </form>
            </section>

            <section className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-center gap-2">
                <Paperclip size={17} className="text-violet" />
                <h3 className="text-sm font-bold text-ink">첨부</h3>
              </div>
              <div className="mt-4 space-y-2">
                {issue.attachments.map((item) => (
                  <AttachmentItem key={item.id} attachment={item} />
                ))}
                {issue.attachments.length === 0 ? (
                  <div className="rounded-lg bg-smoke p-3 text-sm font-semibold text-slate-500">첨부 없음</div>
                ) : null}
              </div>
              <form onSubmit={submitAttachment} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  value={attachment.fileName}
                  onChange={(event) => setAttachment((current) => ({ ...current, fileName: event.target.value }))}
                  className="focus-ring min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
                  placeholder="파일명"
                />
                <input
                  value={attachment.url}
                  onChange={(event) => setAttachment((current) => ({ ...current, url: event.target.value }))}
                  className="focus-ring min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
                  placeholder="URL"
                />
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-ink hover:bg-smoke"
                  title="첨부 추가"
                >
                  <LinkIcon size={15} />
                  추가
                </button>
              </form>
            </section>
          </main>

          <aside className="space-y-3">
            <div className="rounded-lg border border-line bg-smoke p-3">
              <div className="grid gap-3">
                <label>
                  <span className="text-xs font-bold text-slate-500">상태</span>
                  <select
                    value={issue.statusId}
                    onChange={(event) => void onUpdate(issue.id, { statusId: event.target.value })}
                    className="focus-ring mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
                  >
                    {data.statuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-bold text-slate-500">스프린트</span>
                  <select
                    value={issue.sprintId ?? "BACKLOG"}
                    onChange={(event) =>
                      void onUpdate(issue.id, {
                        sprintId: event.target.value === "BACKLOG" ? null : event.target.value
                      })
                    }
                    className="focus-ring mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
                  >
                    <option value="BACKLOG">백로그</option>
                    {data.sprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-bold text-slate-500">담당자</span>
                  <select
                    value={issue.assigneeId ?? "NONE"}
                    onChange={(event) =>
                      void onUpdate(issue.id, {
                        assigneeId: event.target.value === "NONE" ? null : event.target.value
                      })
                    }
                    className="focus-ring mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
                  >
                    <option value="NONE">없음</option>
                    {data.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-bold text-slate-500">우선순위</span>
                  <select
                    value={issue.priority}
                    onChange={(event) => void onUpdate(issue.id, { priority: event.target.value as IssuePriority })}
                    className="focus-ring mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
                  >
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_META[priority].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-bold text-ink">
                    <Flag size={15} />
                    플래그
                  </span>
                  <input
                    type="checkbox"
                    checked={issue.isFlagged}
                    onChange={(event) => void onUpdate(issue.id, { isFlagged: event.target.checked })}
                    className="h-4 w-4"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-3">
              <h3 className="text-sm font-bold text-ink">일정과 추정</h3>
              <div className="mt-3 grid gap-3">
                <label>
                  <span className="text-xs font-bold text-slate-500">시작일</span>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                    className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink"
                  />
                </label>
                <label>
                  <span className="text-xs font-bold text-slate-500">마감일</span>
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                    className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink"
                  />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <NumberField label="SP" value={draft.storyPoints} onChange={(value) => setDraft((current) => ({ ...current, storyPoints: value }))} />
                  <NumberField label="예상" value={draft.estimateHours} onChange={(value) => setDraft((current) => ({ ...current, estimateHours: value }))} />
                  <NumberField label="기록" value={draft.loggedHours} onChange={(value) => setDraft((current) => ({ ...current, loggedHours: value }))} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-3 text-sm font-semibold text-slate-600">
              <div className="flex items-center justify-between gap-2">
                <span>생성</span>
                <span>{formatLongDate(issue.createdAt)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span>수정</span>
                <span>{formatLongDate(issue.updatedAt)}</span>
              </div>
            </div>
          </aside>
        </div>
      </aside>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="focus-ring mt-1 w-full rounded-lg border border-line px-2 py-2 text-sm font-bold text-ink"
      />
    </label>
  );
}

function CommentItem({ comment }: { comment: CommentDto }) {
  return (
    <div className="flex gap-3 rounded-lg bg-smoke p-3">
      {comment.author ? (
        <Avatar name={comment.author.name} initials={comment.author.initials} color={comment.author.color} />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-300 text-xs font-bold text-white">
          -
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
          <span>{comment.author?.name ?? "알 수 없음"}</span>
          <span>{formatLongDate(comment.createdAt)}</span>
        </div>
        <p className="mt-1 break-words text-sm font-medium leading-6 text-ink">{comment.body}</p>
      </div>
    </div>
  );
}

function AttachmentItem({ attachment }: { attachment: AttachmentDto }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="focus-ring flex items-center justify-between gap-3 rounded-lg border border-line bg-smoke px-3 py-2 hover:bg-white"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-ink">{attachment.fileName}</span>
        <span className="text-xs font-semibold text-slate-500">{Math.round(attachment.fileSize / 1024)} KB</span>
      </span>
      <Paperclip size={16} className="shrink-0 text-slate-500" />
    </a>
  );
}

function replaceMemberReferences(issue: IssueDto, member: MemberDto): IssueDto {
  return {
    ...issue,
    assignee: issue.assigneeId === member.id ? member : issue.assignee,
    reporter: issue.reporterId === member.id ? member : issue.reporter,
    comments: issue.comments.map((comment) =>
      comment.authorId === member.id ? { ...comment, author: member } : comment
    )
  };
}

function removeMemberReferences(issue: IssueDto, memberId: string): IssueDto {
  return {
    ...issue,
    assigneeId: issue.assigneeId === memberId ? null : issue.assigneeId,
    assignee: issue.assigneeId === memberId ? null : issue.assignee,
    reporterId: issue.reporterId === memberId ? null : issue.reporterId,
    reporter: issue.reporterId === memberId ? null : issue.reporter,
    comments: issue.comments.map((comment) =>
      comment.authorId === memberId ? { ...comment, authorId: null, author: null } : comment
    )
  };
}

export function WorkspaceApp({ initialData }: { initialData: WorkspaceData }) {
  const [data, setData] = useState(initialData);
  const [activeView, setActiveView] = useState<ViewKey>("board");
  const [query, setQuery] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filteredIssues = useMemo(
    () => data.issues.filter((issue) => issueMatches(issue, query)),
    [data.issues, query]
  );
  const selectedIssue = selectedIssueId ? data.issues.find((issue) => issue.id === selectedIssueId) ?? null : null;
  const topLevel = data.issues.filter((issue) => issue.type !== "SUBTASK");
  const doneTopLevel = topLevel.filter((issue) => issue.status.category === "DONE").length;
  const overallProgress = topLevel.length ? Math.round((doneTopLevel / topLevel.length) * 100) : 0;
  const activeSprint = data.sprints.find((sprint) => sprint.status === "ACTIVE");

  function replaceIssue(issue: IssueDto) {
    setData((current) => ({
      ...current,
      issues: sortIssues(current.issues.map((item) => (item.id === issue.id ? issue : item)))
    }));
  }

  async function updateIssue(issueId: string, patch: IssuePatch) {
    const response = await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    });

    if (!response.ok) {
      throw new Error("이슈 업데이트에 실패했습니다.");
    }

    const result = (await response.json()) as { issue: IssueDto };
    replaceIssue(result.issue);
  }

  async function createIssue(payload: CreateIssuePayload) {
    const response = await fetch("/api/issues", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("이슈 생성에 실패했습니다.");
    }

    const result = (await response.json()) as { issue: IssueDto };
    setData((current) => ({
      ...current,
      issues: sortIssues([...current.issues, result.issue])
    }));
    if (payload.type !== "SUBTASK") {
      setSelectedIssueId(result.issue.id);
    }
    setShowCreate(false);
  }

  async function createComment(issueId: string, body: string) {
    const response = await fetch(`/api/issues/${issueId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ body, authorId: data.members[0]?.id ?? null })
    });

    if (!response.ok) {
      throw new Error("댓글 생성에 실패했습니다.");
    }

    const result = (await response.json()) as { comment: CommentDto };
    setData((current) => ({
      ...current,
      issues: current.issues.map((item) =>
        item.id === issueId ? { ...item, comments: [...item.comments, result.comment] } : item
      )
    }));
  }

  async function createAttachment(issueId: string, item: { fileName: string; url: string }) {
    const response = await fetch(`/api/issues/${issueId}/attachments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(item)
    });

    if (!response.ok) {
      throw new Error("첨부 생성에 실패했습니다.");
    }

    const result = (await response.json()) as { attachment: AttachmentDto };
    setData((current) => ({
      ...current,
      issues: current.issues.map((candidate) =>
        candidate.id === issueId ? { ...candidate, attachments: [result.attachment, ...candidate.attachments] } : candidate
      )
    }));
  }

  async function createMember(payload: CreateMemberPayload) {
    const response = await fetch("/api/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("사용자 생성에 실패했습니다.");
    }

    const result = (await response.json()) as { member: MemberDto };
    setData((current) => ({
      ...current,
      members: sortMembers([...current.members, result.member])
    }));
  }

  async function updateMember(memberId: string, patch: MemberPatch) {
    const response = await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    });

    if (!response.ok) {
      throw new Error("사용자 수정에 실패했습니다.");
    }

    const result = (await response.json()) as { member: MemberDto };
    setData((current) => ({
      ...current,
      members: sortMembers(current.members.map((member) => (member.id === memberId ? result.member : member))),
      issues: current.issues.map((issue) => replaceMemberReferences(issue, result.member))
    }));
  }

  async function deleteMember(memberId: string) {
    const response = await fetch(`/api/members/${memberId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error("사용자 삭제에 실패했습니다.");
    }

    setData((current) => ({
      ...current,
      members: current.members.filter((member) => member.id !== memberId),
      issues: current.issues.map((issue) => removeMemberReferences(issue, memberId))
    }));
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-ink lg:flex">
      <Sidebar activeView={activeView} onViewChange={setActiveView} data={data} progress={overallProgress} />
      <div className="min-w-0 flex-1">
        <TopBar data={data} query={query} onQueryChange={setQuery} onCreateClick={() => setShowCreate((value) => !value)} />
        <main className="px-4 py-5 lg:px-6">
          {showCreate ? (
            <div className="mb-4">
              <QuickCreateIssue data={data} defaultSprintId={activeSprint?.id ?? null} onCreate={createIssue} />
            </div>
          ) : null}

          {activeView === "dashboard" ? (
            <DashboardView data={data} filteredIssues={filteredIssues} onSelect={setSelectedIssueId} />
          ) : null}
          {activeView === "board" ? (
            <BoardView data={data} filteredIssues={filteredIssues} onSelect={setSelectedIssueId} onUpdate={updateIssue} />
          ) : null}
          {activeView === "backlog" ? (
            <BacklogView
              data={data}
              filteredIssues={filteredIssues}
              onSelect={setSelectedIssueId}
              onUpdate={updateIssue}
              onCreate={createIssue}
            />
          ) : null}
          {activeView === "calendar" ? (
            <CalendarView data={data} filteredIssues={filteredIssues} onSelect={setSelectedIssueId} />
          ) : null}
          {activeView === "issues" ? (
            <IssuesView data={data} filteredIssues={filteredIssues} onSelect={setSelectedIssueId} onUpdate={updateIssue} />
          ) : null}
          {activeView === "settings" ? (
            <SettingsView
              data={data}
              onCreateMember={createMember}
              onUpdateMember={updateMember}
              onDeleteMember={deleteMember}
            />
          ) : null}
        </main>
      </div>

      <IssueDrawer
        issue={selectedIssue}
        data={data}
        onClose={() => setSelectedIssueId(null)}
        onUpdate={updateIssue}
        onCreate={createIssue}
        onComment={createComment}
        onAttachment={createAttachment}
      />
    </div>
  );
}
