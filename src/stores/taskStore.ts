import { create } from "zustand";
import type { Task } from "../lib/types";
import * as api from "../lib/commands";
import { useUIStore } from "./uiStore";

interface TaskState {
  tasks: Task[];
  subtaskMap: Map<string, Task[]>;
  selectedTask: Task | null;
  loading: boolean;
  pendingDeletes: Map<string, ReturnType<typeof setTimeout>>;
  fetchTasks: (groupId?: string) => Promise<void>;
  fetchSubtasks: (parentId: string) => Promise<void>;
  addTask: (input: Parameters<typeof api.createTask>[0]) => Promise<Task>;
  editTask: (input: Parameters<typeof api.updateTask>[0]) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  undoRemoveTask: (id: string) => void;
  moveTask: (taskIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
  selectTask: (task: Task | null) => void;
  archiveCompleted: () => Promise<number>;
  unarchiveTask: (id: string) => Promise<void>;
}

const UNDO_DELAY = 5000;

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  subtaskMap: new Map(),
  selectedTask: null,
  loading: false,
  pendingDeletes: new Map(),

  fetchTasks: async (groupId) => {
    set({ loading: true });
    const tasks = await api.getTasks(groupId);
    // Fetch all tasks flat to build subtask counts for every top-level task
    // in a single request — avoids N requests and avoids false "no subtasks".
    const allTasks = await api.getAllTasksFlat();
    // Build a parent_id → subtasks map from the flat list
    const subtaskByParent = new Map<string, Task[]>();
    for (const t of allTasks) {
      if (t.parent_id) {
        const list = subtaskByParent.get(t.parent_id) || [];
        list.push(t);
        subtaskByParent.set(t.parent_id, list);
      }
    }
    set((s) => {
      // Preserve existing entries, update/add entries for currently loaded top-level tasks
      const newMap = new Map(s.subtaskMap);
      for (const t of tasks) {
        newMap.set(t.id, subtaskByParent.get(t.id) || []);
      }
      return { tasks, subtaskMap: newMap, loading: false };
    });
  },

  fetchSubtasks: async (parentId) => {
    const subtasks = await api.getSubtasks(parentId);
    const map = new Map(get().subtaskMap);
    map.set(parentId, subtasks);
    set({ subtaskMap: map });
  },

  addTask: async (input) => {
    const task = await api.createTask(input);
    if (!task.parent_id) {
      // Seed empty subtask list so expand button shows gray from the start
      set((s) => {
        const newMap = new Map(s.subtaskMap);
        if (!newMap.has(task.id)) newMap.set(task.id, []);
        return { tasks: [...s.tasks, task], subtaskMap: newMap };
      });
    }
    return task;
  },

  editTask: async (input) => {
    const updated = await api.updateTask(input);
    set((s) => {
      // Also update in subtaskMap if this is a subtask
      const newMap = new Map(s.subtaskMap);
      for (const [parentId, subs] of newMap.entries()) {
        const idx = subs.findIndex(t => t.id === updated.id);
        if (idx !== -1) {
          const newSubs = [...subs];
          newSubs[idx] = updated;
          newMap.set(parentId, newSubs);
          break;
        }
      }
      return {
        tasks: s.tasks.map((t) => (t.id === updated.id ? updated : t)),
        subtaskMap: newMap,
        selectedTask: s.selectedTask?.id === updated.id ? updated : s.selectedTask,
      };
    });
  },

  removeTask: async (id) => {
    // Cancel any existing pending delete for this task
    const existing = get().pendingDeletes.get(id);
    if (existing) { clearTimeout(existing); }

    // Find task — may be in root tasks or in subtaskMap
    let task = get().tasks.find(t => t.id === id);
    if (!task) {
      for (const subs of get().subtaskMap.values()) {
        const found = subs.find(t => t.id === id);
        if (found) { task = found; break; }
      }
    }
    if (!task) {
      // Task not in local state — delete via API directly
      api.deleteTask(id).catch(() => {});
      return;
    }

    // Subtasks: delete immediately, no undo
    if (task.parent_id) {
      set((s) => {
        const newMap = new Map(s.subtaskMap);
        const subs = newMap.get(task.parent_id!) || [];
        const remaining = subs.filter(t => t.id !== id);
        newMap.set(task.parent_id!, remaining);
        return {
          tasks: s.tasks.filter((t) => t.id !== id),
          subtaskMap: newMap,
          selectedTask: s.selectedTask?.id === id ? null : s.selectedTask,
        };
      });
      // Auto-collapse parent if no subtasks remain
      const remaining = get().subtaskMap.get(task.parent_id!) || [];
      if (remaining.length === 0 && useUIStore.getState().expandedTaskIds.has(task.parent_id!)) {
        useUIStore.getState().toggleExpandedTask(task.parent_id!);
      }
      try {
        await api.deleteTask(id);
      } catch {
        get().fetchTasks();
      }
      return;
    }

    // Top-level tasks: optimistic remove + undo window
    set((s) => {
      const newMap = new Map(s.subtaskMap);
      for (const [parentId, subs] of newMap.entries()) {
        const filtered = subs.filter(t => t.id !== id);
        if (filtered.length !== subs.length) {
          newMap.set(parentId, filtered);
          break;
        }
      }
      // Also clean up any existing pending delete for this task
      const newDeletes = new Map(s.pendingDeletes);
      newDeletes.delete(id);
      return {
        tasks: s.tasks.filter((t) => t.id !== id),
        subtaskMap: newMap,
        selectedTask: s.selectedTask?.id === id ? null : s.selectedTask,
        pendingDeletes: newDeletes,
      };
    });

    // Schedule actual deletion after undo window
    const timer = setTimeout(async () => {
      set((s) => {
        const next = new Map(s.pendingDeletes);
        next.delete(id);
        return { pendingDeletes: next };
      });
      try {
        await api.deleteTask(id);
      } catch {
        // On failure, restore the task
        set((s) => ({ tasks: [...s.tasks, task] }));
      }
    }, UNDO_DELAY);

    const newMap = new Map(get().pendingDeletes);
    newMap.set(id, timer);
    set({ pendingDeletes: newMap });
  },

  undoRemoveTask: (id) => {
    const timer = get().pendingDeletes.get(id);
    if (timer) {
      clearTimeout(timer);
      const newMap = new Map(get().pendingDeletes);
      newMap.delete(id);
      set({ pendingDeletes: newMap });
    }
    // Restore is handled by the caller re-fetching or re-adding
    // For simplicity, just refresh tasks to restore
    get().refresh();
  },

  moveTask: async (taskIds) => {
    const prevTasks = get().tasks;
    set((s) => {
      let parentId: string | null = null;
      for (const [pid, subs] of s.subtaskMap.entries()) {
        if (subs.some(sub => taskIds.includes(sub.id))) {
          parentId = pid;
          break;
        }
      }

      if (parentId) {
        const subs = [...(s.subtaskMap.get(parentId) || [])];
        const ordered = taskIds.map((id) => subs.find((t) => t.id === id)).filter(Boolean) as Task[];
        if (ordered.length === subs.length) {
          const newMap = new Map(s.subtaskMap);
          newMap.set(parentId, ordered);
          return { subtaskMap: newMap };
        }
        return {};
      }

      const ordered = taskIds.map((id) => s.tasks.find((t) => t.id === id)).filter(Boolean) as Task[];
      const remaining = s.tasks.filter((t) => !taskIds.includes(t.id));
      return { tasks: [...ordered, ...remaining] };
    });
    try {
      await api.reorderTasks(taskIds);
    } catch {
      // Rollback on failure
      set({ tasks: prevTasks });
    }
  },

  refresh: async () => {
    await get().fetchTasks();
  },

  selectTask: (task) => set({ selectedTask: task }),

  archiveCompleted: async () => {
    const result = await api.archiveCompleted();
    await get().fetchTasks();
    return parseInt(result) || 0;
  },

  unarchiveTask: async (id) => {
    await api.unarchiveTask(id);
    await get().fetchTasks();
  },
}));
