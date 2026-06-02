import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bookmark,
  Bug,
  CheckCircle2,
  Circle,
  Flame,
  Layers3,
  ListChecks,
  SquareKanban
} from "lucide-react";

import type { IssuePriority, IssueType } from "@/lib/types";

export const ISSUE_TYPE_META: Record<
  IssueType,
  {
    label: string;
    icon: typeof SquareKanban;
    color: string;
    bg: string;
  }
> = {
  EPIC: { label: "에픽", icon: Layers3, color: "#7c3aed", bg: "#f1eafe" },
  STORY: { label: "스토리", icon: Bookmark, color: "#15a46b", bg: "#e7f8ef" },
  TASK: { label: "작업", icon: SquareKanban, color: "#2563eb", bg: "#e8f0ff" },
  BUG: { label: "버그", icon: Bug, color: "#e11d48", bg: "#ffe8ef" },
  SUBTASK: { label: "하위작업", icon: ListChecks, color: "#d97706", bg: "#fff3df" }
};

export const PRIORITY_META: Record<
  IssuePriority,
  {
    label: string;
    icon: typeof Circle;
    color: string;
  }
> = {
  HIGHEST: { label: "긴급", icon: Flame, color: "#e11d48" },
  HIGH: { label: "높음", icon: ArrowUp, color: "#d97706" },
  MEDIUM: { label: "보통", icon: AlertTriangle, color: "#2563eb" },
  LOW: { label: "낮음", icon: ArrowDown, color: "#15a46b" }
};

export const DONE_ICON = CheckCircle2;
