import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import type { Task } from "./types";

// Priority / status colors come from CSS tokens so they lift in dark mode and
// stay in one place. Returning the var() string lets inline styles pick them up.
const PRIORITY_VAR: Record<string, string> = {
  p0: "var(--color-priority-p0)",
  p1: "var(--color-priority-p1)",
  p2: "var(--color-priority-p2)",
  p3: "var(--color-priority-p3)",
};

export function getPriorityColor(priority: string): string {
  return PRIORITY_VAR[priority] || "var(--color-status-todo)";
}

// Translucent background tint for a priority (for chips/dots on canvases).
export function getPriorityBgColor(priority: string): string {
  const v = PRIORITY_VAR[priority] || "var(--color-status-todo)";
  return `color-mix(in srgb, ${v} 14%, transparent)`;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    todo: "var(--color-status-todo)",
    in_progress: "var(--color-status-in_progress)",
    done: "var(--color-status-done)",
  };
  return map[status] || "var(--color-status-todo)";
}

export function formatDueDate(date: string | null, time: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (time) return `${month}/${day} ${time}`;
  return `${month}/${day}`;
}

/** Check if a group is the built-in "Ungrouped" default (matches both en and zh names). */
export function isUngroupedGroup(name: string): boolean {
  return name === "Ungrouped" || name === "未分组";
}

export function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === "done") return false;
  const due = new Date(task.due_date);
  if (task.due_time) {
    const [h, m] = task.due_time.split(":").map(Number);
    due.setHours(h, m);
  } else {
    due.setHours(23, 59, 59);
  }
  return due < new Date();
}

export function buildTaskTree(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.parent_id) {
      const children = map.get(t.parent_id) || [];
      children.push(t);
      map.set(t.parent_id, children);
    }
  }
  return map;
}

const PRIORITY_SORT_ORDER: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };

export function sortTasks(tasks: Task[], sortBy: string): Task[] {
  if (sortBy === "manual") return tasks;
  const sorted = [...tasks];
  switch (sortBy) {
    case "due_date_asc":
      sorted.sort((a, b) => (a.due_date || "z").localeCompare(b.due_date || "z"));
      break;
    case "due_date_desc":
      sorted.sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""));
      break;
    case "priority":
      sorted.sort((a, b) => (PRIORITY_SORT_ORDER[a.priority] ?? 4) - (PRIORITY_SORT_ORDER[b.priority] ?? 4));
      break;
    case "title_asc":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "created_desc":
      sorted.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      break;
  }
  return sorted;
}
