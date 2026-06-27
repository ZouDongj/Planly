export interface TaskGroup {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  group_id: string;
  parent_id: string | null;
  title: string;
  note: string;
  priority: "p0" | "p1" | "p2" | "p3";
  status: "todo" | "in_progress" | "done" | "archived";
  due_date: string | null;
  due_time: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  recurrence: string | null;
}

export interface Reminder {
  id: string;
  task_id: string;
  type: "due_date" | "recurring" | "one_time";
  remind_at: string | null;
  advance_minutes: number | null;
  repeat_rule: string | null;
  snooze_minutes: number;
  enabled: boolean;
}

export interface ActivityLog {
  id: string;
  task_id: string;
  action: string;
  detail: string;
  created_at: string;
}

export interface ExportData {
  groups: TaskGroup[];
  tasks: Task[];
  reminders: Reminder[];
  activity_log: ActivityLog[];
  exported_at: string;
}

export type ViewType = "list" | "kanban" | "calendar";

export const PRIORITY_ORDER = ["p0", "p1", "p2", "p3"] as const;
export type Priority = typeof PRIORITY_ORDER[number];

const PRIORITY_I18N: Record<Priority, string> = {
  p0: "priority.urgent",
  p1: "priority.high",
  p2: "priority.medium",
  p3: "priority.low",
};

export function getPriorityLabel(priority: Priority): string {
  return PRIORITY_I18N[priority];
}
