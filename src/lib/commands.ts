import { invoke } from "@tauri-apps/api/core";
import type { Task, TaskGroup, Reminder, ExportData } from "./types";

// Task commands
export const createTask = (input: {
  group_id: string;
  parent_id?: string | null;
  title: string;
  note?: string;
  priority?: string;
  due_date?: string | null;
  due_time?: string | null;
  recurrence?: string | null;
}) => invoke<Task>("create_task", { input });

export const getTasks = (group_id?: string) =>
  invoke<Task[]>("get_tasks", { groupId: group_id ?? null });

export const getSubtasks = (parent_id: string) =>
  invoke<Task[]>("get_subtasks", { parentId: parent_id });

export const updateTask = (input: {
  id: string;
  title?: string;
  note?: string;
  priority?: string;
  status?: string;
  due_date?: string;
  due_time?: string;
  group_id?: string;
  recurrence?: string | null;
}) => invoke<Task>("update_task", { input });

export const deleteTask = (id: string) =>
  invoke<void>("delete_task", { id });

export const reorderTasks = (task_ids: string[]) =>
  invoke<void>("reorder_tasks", { taskIds: task_ids });

export const getAllTasksFlat = () =>
  invoke<Task[]>("get_all_tasks_flat");

// Group commands
export const getGroups = () => invoke<TaskGroup[]>("get_groups");

export const createGroup = (input: { name: string; color?: string; icon?: string }) =>
  invoke<TaskGroup>("create_group", { input });

export const updateGroup = (input: { id: string; name?: string; color?: string; icon?: string }) =>
  invoke<void>("update_group", { input });

export const deleteGroup = (id: string) =>
  invoke<void>("delete_group", { id });

export const archiveGroup = (id: string) =>
  invoke<void>("archive_group", { id });

export const reorderGroups = (group_ids: string[]) =>
  invoke<void>("reorder_groups", { groupIds: group_ids });

// Reminder commands
export const createReminder = (input: {
  task_id: string;
  reminder_type: string;
  remind_at?: string | null;
  advance_minutes?: number | null;
  repeat_rule?: string | null;
  snooze_minutes?: number;
}) => invoke<Reminder>("create_reminder", { input });

export const getReminders = (task_id: string) =>
  invoke<Reminder[]>("get_reminders", { taskId: task_id });

export const deleteReminder = (id: string) =>
  invoke<void>("delete_reminder", { id });

export const toggleReminder = (id: string, enabled: boolean) =>
  invoke<void>("toggle_reminder", { id, enabled });

export const snoozeReminder = (reminder_id: string) =>
  invoke<void>("snooze_reminder", { reminderId: reminder_id });

// Export commands
export const exportAll = () => invoke<ExportData>("export_all");
export const importAll = (data: ExportData) => invoke<string>("import_all", { data });
export const exportToFile = (path: string) => invoke<string>("export_to_file", { path });
export const importFromFile = (path: string) => invoke<string>("import_from_file", { path });
export const clearAllData = () => invoke<string>("clear_all_data");

// Image commands
export const saveNoteImage = (data: number[], ext: string) =>
  invoke<string>("save_note_image", { data, ext });

export const deleteNoteImage = (filepath: string) =>
  invoke<void>("delete_note_image", { filepath });

export const getNoteImageDataUrl = (filepath: string) =>
  invoke<string>("get_note_image_data_url", { filepath });

// Archive
export const archiveCompleted = () =>
  invoke<string>("archive_completed");

export const unarchiveTask = (id: string) =>
  invoke<void>("unarchive_task", { id });
