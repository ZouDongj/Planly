import { useState, useEffect, useCallback } from "react";
import { X, Plus, FolderOpen, GripHorizontal } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import * as api from "../../lib/commands";
import type { Task } from "../../lib/types";
import CardContent from "./CardContent";
import CardSearchPanel from "./CardSearchPanel";
import TaskFormDialog from "../tasks/TaskFormDialog";
import { useT } from "../../i18n/translations";
import { useTaskStore } from "../../stores/taskStore";
import { useGroupStore } from "../../stores/groupStore";

interface Props {
  taskId: string;
}

export default function FloatingCard({ taskId }: Props) {
  const { __ } = useT();
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(taskId);
  const [ready, setReady] = useState(false);

  // ── Single source of truth: Zustand store ──
  const tasks = useTaskStore((s) => s.tasks);
  const task = tasks.find(t => t.id === currentTaskId) || null;
  const groups = useGroupStore((s) => s.groups);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchSubtasks = useTaskStore((s) => s.fetchSubtasks);
  const fetchGroups = useGroupStore((s) => s.fetchGroups);

  const deleted = ready && !task;

  // Initialize: defaults to light, events will correct
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.removeAttribute("data-theme");
    const lang = localStorage.getItem("planly-lang") || "en";
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    fetchGroups().catch(() => console.error("Failed to fetch groups"));
  }, []);

  // Fetch task data on mount
  useEffect(() => {
    const init = async () => {
      await fetchTasks();
      await fetchSubtasks(currentTaskId);
      setReady(true);
    };
    init();
  }, []);

  // Cross-window event listeners
  useEffect(() => {
    const setup = async () => {
      const unlistenDelete = await listen<{ taskId: string }>("main:task-deleted", (event) => {
        if (event.payload.taskId === currentTaskId) {
          fetchTasks();
        }
      });

      const unlistenUpdate = await listen<{ taskId: string }>("main:task-updated", async (event) => {
        if (event.payload.taskId === currentTaskId) {
          fetchTasks();
        }
      });

      const unlistenSubtasks = await listen<{ parentId: string }>("main:subtasks-changed", async (event) => {
        if (event.payload.parentId === currentTaskId) {
          await fetchSubtasks(currentTaskId);
        }
      });

      const unlistenDark = await listen<{ darkMode: boolean }>("main:dark-mode-changed", (event) => {
        document.documentElement.classList.toggle("dark", event.payload.darkMode);
      });

      const unlistenTheme = await listen<{ theme: string }>("main:theme-changed", (event) => {
        if (event.payload.theme === "default") {
          document.documentElement.removeAttribute("data-theme");
        } else {
          document.documentElement.setAttribute("data-theme", event.payload.theme);
        }
      });

      return () => { unlistenDelete(); unlistenUpdate(); unlistenSubtasks(); unlistenDark(); unlistenTheme(); };
    };
    const cleanup = setup();
    return () => { cleanup.then((fn) => fn()); };
  }, [currentTaskId]);

  // Edit handler for PARENT task: update task in store + notify main window
  const handleEdit = useCallback(async (input: Parameters<typeof api.updateTask>[0]) => {
    const updated = await api.updateTask(input);
    // Update store so card UI stays in sync (prevents stale localTitle loops)
    useTaskStore.setState((s) => ({
      tasks: s.tasks.map((t) => (t.id === updated.id ? updated : t)),
    }));
    await emit("card:task-updated", { taskId: updated.id });
  }, []);

  // Edit handler for SUBTASKS: use store so UI auto-updates
  const handleSubtaskEdit = useCallback(async (input: Parameters<typeof api.updateTask>[0]) => {
    await useTaskStore.getState().editTask(input);
    await emit("card:subtasks-changed", { parentId: currentTaskId });
  }, [currentTaskId]);

  // Subtask created in card — sync + auto-reorder
  const handleSubtaskCreated = useCallback(async (_newTask: Task) => {
    await fetchSubtasks(currentTaskId);
    // Reorder: uncompleted before completed
    const st = useTaskStore.getState();
    const sibs = st.subtaskMap.get(currentTaskId) || [];
    if (sibs.length > 1) {
      const active = sibs.filter(t => t.status !== "done").map(t => t.id);
      const done = sibs.filter(t => t.status === "done").map(t => t.id);
      await api.reorderTasks([...active, ...done]);
      await fetchSubtasks(currentTaskId);
    }
    await emit("card:subtasks-changed", { parentId: currentTaskId });
  }, [fetchSubtasks, currentTaskId]);

  // Subtask deleted in card — notify main window
  const handleSubtaskDeleted = useCallback(async () => {
    await fetchSubtasks(currentTaskId);
    await emit("card:subtasks-changed", { parentId: currentTaskId });
  }, [fetchSubtasks, currentTaskId]);

  // Task created in card
  const handleTaskCreated = useCallback(async (newTask: Task) => {
    setCurrentTaskId(newTask.id);
    fetchTasks();
    fetchSubtasks(newTask.id);
    setSearchOpen(false);
    await emit("card:task-created", { task: newTask });
  }, [fetchTasks, fetchSubtasks]);

  // Select task from search
  const handleSelectTask = useCallback((selected: Task) => {
    setCurrentTaskId(selected.id);
    fetchTasks();
    fetchSubtasks(selected.id);
    setSearchOpen(false);
  }, [fetchTasks, fetchSubtasks]);

  // Top bar drag
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    getCurrentWindow().startDragging();
  };

  return (
    <div className="h-screen flex flex-col bg-surface-muted overflow-hidden select-none">
      {/* Title bar / drag area */}
      <div
        className="h-9 flex items-center px-3 gap-2 shrink-0 cursor-grab active:cursor-grabbing border-b border-border/20"
        onMouseDown={handleDragStart}
      >
        <GripHorizontal size={14} className="text-muted-foreground/40 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] text-muted-foreground truncate block">
            {task?.title || "Planly"}
          </span>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => setNewTaskOpen(true)}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={__("card.newTask")}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={`w-7 h-7 inline-flex items-center justify-center rounded-md transition-colors ${searchOpen ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            title={__("card.open")}
          >
            <FolderOpen size={14} />
          </button>
          <button
            onClick={() => getCurrentWindow().close()}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive-foreground hover:bg-destructive transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search panel */}
      {searchOpen && (
        <CardSearchPanel onSelect={handleSelectTask} onClose={() => setSearchOpen(false)} />
      )}

      {/* Content area */}
      <div className="flex-1 scrollbar-hidden p-4">
        {!ready ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : deleted ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <div className="text-3xl opacity-30">🗑️</div>
            <p className="text-sm">{__("card.taskDeleted")}</p>
          </div>
        ) : task ? (
          <CardContent
            task={task}
            groups={groups}
            onEdit={handleEdit}
            onSubtaskEdit={handleSubtaskEdit}
            onSubtaskCreated={handleSubtaskCreated}
            onSubtaskDeleted={handleSubtaskDeleted}
          />
        ) : null}
      </div>

      {/* New task dialog */}
      <TaskFormDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        onCreated={handleTaskCreated}
      />
    </div>
  );
}
