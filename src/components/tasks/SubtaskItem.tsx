import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronUp, ChevronDown, AlertTriangle, Trash2, MoreHorizontal, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import type { Task } from "../../lib/types";
import { useTaskStore } from "../../stores/taskStore";
import { useUIStore } from "../../stores/uiStore";
import { getPriorityColor, formatDueDate, isOverdue } from "../../lib/utils";
import { useT } from "../../i18n/translations";
import { notifyTaskDeleted, notifySubtasksChanged } from "../../lib/cardWindows";
import { emit } from "@tauri-apps/api/event";

interface Props {
  task: Task;
  depth?: number;
  onDeleted?: () => void;
  onToggle?: (task: Task, newStatus: string) => void | Promise<void>;
  onEdit?: (input: { id: string; [key: string]: unknown }) => void;
}

const PRIORITY_LIST = [
  { key: "p0", color: "bg-priority-p0", labelKey: "priority.urgent" },
  { key: "p1", color: "bg-priority-p1", labelKey: "priority.high" },
  { key: "p2", color: "bg-priority-p2", labelKey: "priority.medium" },
  { key: "p3", color: "bg-priority-p3", labelKey: "priority.low" },
] as const;

export default function SubtaskItem({ task, onDeleted, onToggle, onEdit }: Props) {
  const { __ } = useT();
  const editTask = useTaskStore((s) => s.editTask);
  const selectTask = useTaskStore((s) => s.selectTask);
  const openDrawer = useUIStore((s) => s.openDrawer);
  const subtaskMap = useTaskStore((s) => s.subtaskMap);
  const reorder = useTaskStore((s) => s.moveTask);
  const movedTaskId = useUIStore((s) => s.movedTaskId);
  const swappedTaskId = useUIStore((s) => s.swappedTaskId);
  const moveDirection = useUIStore((s) => s.moveDirection);
  const setMovedTask = useUIStore((s) => s.setMovedTask);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Inline editing state (card mode only)
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const dateTriggerRef = useRef<HTMLSpanElement>(null);
  const priorityTriggerRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLElement | null>(null);

  // Create a portal container that escapes body's overflow:hidden
  useEffect(() => {
    let el = document.getElementById("dropdown-portal");
    if (!el) {
      el = document.createElement("div");
      el.id = "dropdown-portal";
      el.style.cssText = "position:fixed;inset:0;overflow:visible;z-index:9999;pointer-events:none;";
      document.body.appendChild(el);
    }
    portalRef.current = el;
  }, []);

  // Animated dropdown state: "open" | "closing" | "closed"
  const [dateState, setDateState] = useState<"open" | "closed">("closed");
  const [priorityState, setPriorityState] = useState<"open" | "closed">("closed");

  const openDropdown = (which: "date" | "priority") => {
    if (which === "date") {
      setDateState("open");
      setPriorityState("closed");
    } else {
      setPriorityState("open");
      setDateState("closed");
    }
  };

  const closeDropdown = (which: "date" | "priority") => {
    const setState = which === "date" ? setDateState : setPriorityState;
    setState("closed");
  };

  const closeAllDropdowns = () => {
    if (dateState === "open") closeDropdown("date");
    if (priorityState === "open") closeDropdown("priority");
  };

  const isCard = !!onEdit;

  useEffect(() => { setEditTitle(task.title); }, [task.title]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (priorityState === "closed" && dateState === "closed") return;
    const handler = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        closeAllDropdowns();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [priorityState, dateState]);

  // Auto-scroll in card mode to show full date dropdown
  useEffect(() => {
    if (!isCard || dateState !== "open" || !dateDropdownRef.current) return;
    requestAnimationFrame(() => {
      dateDropdownRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [dateState, isCard]);

  // Auto-scroll to show full date dropdown when opened
  useEffect(() => {
    if (dateState === "open" && dateDropdownRef.current) {
      requestAnimationFrame(() => {
        dateDropdownRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }, [dateState]);

  const siblings = subtaskMap.get(task.parent_id || "") || [];
  const currentIndex = siblings.findIndex(t => t.id === task.id);

  const handleMoveUp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex <= 0) return;
    const ids = siblings.map(t => t.id);
    const moved = [...ids];
    [moved[currentIndex - 1], moved[currentIndex]] = [moved[currentIndex], moved[currentIndex - 1]];
    setMovedTask(task.id, "up", ids[currentIndex - 1]);
    await reorder(moved);
    if (task.parent_id) {
      notifySubtasksChanged(task.parent_id);
      emit("card:subtasks-changed", { parentId: task.parent_id, movedId: task.id, direction: "up" as const, swappedId: ids[currentIndex - 1] });
    }
  };

  const handleMoveDown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex >= siblings.length - 1) return;
    const ids = siblings.map(t => t.id);
    const moved = [...ids];
    [moved[currentIndex], moved[currentIndex + 1]] = [moved[currentIndex + 1], moved[currentIndex]];
    setMovedTask(task.id, "down", ids[currentIndex + 1]);
    await reorder(moved);
    if (task.parent_id) {
      notifySubtasksChanged(task.parent_id);
      emit("card:subtasks-changed", { parentId: task.parent_id, movedId: task.id, direction: "down" as const, swappedId: ids[currentIndex + 1] });
    }
  };

  const handleRowClick = () => {
    if (isCard) return;
    selectTask(task);
    openDrawer();
  };

  const handleToggle = async () => {
    const newStatus = task.status === "done" ? "todo" : "done";
    if (onToggle) {
      await onToggle(task, newStatus);
    } else {
      await editTask({ id: task.id, status: newStatus });
    }

    // Auto-reorder: uncompleted before completed
    const sibs = subtaskMap.get(task.parent_id || "") || [];
    if (sibs.length > 1) {
      const active: string[] = [];
      const done: string[] = [];
      for (const t of sibs) {
        const st = t.id === task.id ? newStatus : t.status;
        if (st === "done") done.push(t.id);
        else active.push(t.id);
      }
      const newOrder = [...active, ...done];
      const oldIdx = sibs.findIndex(t => t.id === task.id);
      const newIdx = newOrder.indexOf(task.id);
      if (oldIdx !== newIdx) {
        const goingDown = newIdx > oldIdx;
        const swappedId = goingDown ? sibs[oldIdx + 1]?.id : sibs[oldIdx - 1]?.id;
        setMovedTask(task.id, goingDown ? "down" : "up", swappedId);
        await reorder(newOrder);
        if (task.parent_id) {
          notifySubtasksChanged(task.parent_id);
          emit("card:subtasks-changed", { parentId: task.parent_id, movedId: task.id, direction: goingDown ? "down" : "up", swappedId });
        }
      }
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    if (!isCard) return;
    e.stopPropagation();
    setEditTitle(task.title);
    setEditing(true);
  };

  const saveTitle = () => {
    setEditing(false);
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title && onEdit) {
      onEdit({ id: task.id, title: trimmed });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    await useTaskStore.getState().removeTask(task.id);
    notifyTaskDeleted(task.id);
    if (task.parent_id) notifySubtasksChanged(task.parent_id);
    onDeleted?.();
  };

  const overdue = isOverdue(task);
  const dueText = formatDueDate(task.due_date, task.due_time);

  // Card mode: absolute positioning + auto-scroll
  const renderCardDateDropdown = (onSave: (input: { id: string; [key: string]: unknown }) => void) => (
    <div className="relative inline-flex">
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap cursor-pointer transition-colors ${dueText ? "bg-muted text-muted-foreground hover:bg-muted/70" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
        onClick={(e) => { e.stopPropagation(); dateState === "open" ? closeDropdown("date") : openDropdown("date"); }}
      >
        {dueText || <Calendar size={11} className="inline -mt-px" />}
      </span>
      {dateState !== "closed" && (
        <div
          ref={dateDropdownRef}
          className={`absolute right-0 top-full mt-1 z-50 bg-popover rounded-lg shadow-md ring-1 ring-foreground/10 overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          <CalendarPicker mode="single" selected={task.due_date ? new Date(task.due_date) : undefined} onSelect={(date) => { onSave({ id: task.id, due_date: date ? format(date, "yyyy-MM-dd") : "" }); if (date) closeDropdown("date"); }} />
          {task.due_date && (<div className="px-4 pb-3"><button onClick={() => { onSave({ id: task.id, due_date: "" }); closeDropdown("date"); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">{__("taskForm.clearDate")}</button></div>)}
        </div>
      )}
    </div>
  );

  const renderCardPriorityDropdown = (onSave: (input: { id: string; [key: string]: unknown }) => void) => (
    <div className="relative inline-flex">
      <span className="p-0.5 rounded cursor-pointer hover:bg-muted transition-colors" style={{ color: getPriorityColor(task.priority) }} onClick={(e) => { e.stopPropagation(); priorityState === "open" ? closeDropdown("priority") : openDropdown("priority"); }}>
        <span className="w-2 h-2 rounded-full block" style={{ backgroundColor: "currentColor" }} />
      </span>
      {priorityState !== "closed" && (
        <div className={`absolute right-0 top-full mt-1 z-50 w-36 bg-popover rounded-lg shadow-md ring-1 ring-foreground/10 p-1.5 overflow-hidden`} onClick={(e) => e.stopPropagation()}>
          {PRIORITY_LIST.map((p) => (<button key={p.key} onClick={() => { onSave({ id: task.id, priority: p.key }); closeDropdown("priority"); }} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${task.priority === p.key ? "bg-muted font-medium" : ""}`}><span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />{__(p.labelKey)}</button>))}
        </div>
      )}
    </div>
  );

  // Main view: portal-based (escapes overflow-hidden ancestors)
  const renderPortalDateDropdown = (onSave: (input: { id: string; [key: string]: unknown }) => void) => {
    const triggerRect = dateTriggerRef.current?.getBoundingClientRect();
    return (
      <>
        <span ref={dateTriggerRef} className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap cursor-pointer transition-colors ${dueText ? "bg-muted text-muted-foreground hover:bg-muted/70" : "text-muted-foreground/40 hover:text-muted-foreground"}`} onClick={(e) => { e.stopPropagation(); dateState === "open" ? closeDropdown("date") : openDropdown("date"); }}>
          {dueText || <Calendar size={11} className="inline -mt-px" />}
        </span>
        {dateState !== "closed" && triggerRect && portalRef.current && createPortal(
          <div ref={dateDropdownRef} className={`bg-popover rounded-lg shadow-md ring-1 ring-foreground/10 overflow-hidden`} style={{ position: "fixed", top: triggerRect.bottom + 4, right: window.innerWidth - triggerRect.right, zIndex: 9999, pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
            <CalendarPicker mode="single" selected={task.due_date ? new Date(task.due_date) : undefined} onSelect={(date) => { onSave({ id: task.id, due_date: date ? format(date, "yyyy-MM-dd") : "" }); if (date) closeDropdown("date"); }} />
            {task.due_date && (<div className="px-4 pb-3"><button onClick={() => { onSave({ id: task.id, due_date: "" }); closeDropdown("date"); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">{__("taskForm.clearDate")}</button></div>)}
          </div>,
          portalRef.current
        )}
      </>
    );
  };

  const renderPortalPriorityDropdown = (onSave: (input: { id: string; [key: string]: unknown }) => void) => {
    const triggerRect = priorityTriggerRef.current?.getBoundingClientRect();
    return (
      <>
        <span ref={priorityTriggerRef} className="p-0.5 rounded cursor-pointer hover:bg-muted transition-colors" style={{ color: getPriorityColor(task.priority) }} onClick={(e) => { e.stopPropagation(); priorityState === "open" ? closeDropdown("priority") : openDropdown("priority"); }}>
          <span className="w-2 h-2 rounded-full block" style={{ backgroundColor: "currentColor" }} />
        </span>
        {priorityState !== "closed" && triggerRect && portalRef.current && createPortal(
          <div className={`w-36 bg-popover rounded-lg shadow-md ring-1 ring-foreground/10 p-1.5 overflow-hidden`} style={{ position: "fixed", top: triggerRect.bottom + 4, right: window.innerWidth - triggerRect.right, zIndex: 9999, pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
            {PRIORITY_LIST.map((p) => (<button key={p.key} onClick={() => { onSave({ id: task.id, priority: p.key }); closeDropdown("priority"); }} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${task.priority === p.key ? "bg-muted font-medium" : ""}`}><span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />{__(p.labelKey)}</button>))}
          </div>,
          portalRef.current
        )}
      </>
    );
  };

  return (
    <div
      ref={rowRef}
      className={`group relative flex items-center gap-1.5 px-2 ${isCard ? "py-1" : "py-2"} rounded-lg border border-border/20 bg-black/[0.04] cursor-default ${task.status === "done" ? "opacity-50" : ""} ${task.id === movedTaskId && moveDirection === "up" ? "animate-slide-up" : task.id === movedTaskId && moveDirection === "down" ? "animate-slide-down" : task.id === swappedTaskId && moveDirection === "up" ? "animate-slide-down" : task.id === swappedTaskId && moveDirection === "down" ? "animate-slide-up" : ""}`}
      onClick={handleRowClick}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
        className={`w-[14px] h-[14px] rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          task.status === "done"
            ? "bg-primary border-primary"
            : "border-muted-foreground/30 hover:border-primary"
        }`}
      >
        {task.status === "done" && <Check size={9} className="text-primary-foreground" />}
      </button>

      {/* Title — inline edit in card mode */}
      {editing ? (
        <input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditTitle(task.title); setEditing(false); } }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 text-[13px] bg-transparent border-b border-primary outline-none py-0.5"
        />
      ) : (
        <span
          onClick={handleTitleClick}
          className={`text-[13px] flex-1 min-w-0 truncate ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"} ${isCard ? "hover:underline cursor-text" : ""}`}
        >
          {task.title}
        </span>
      )}

      {/* Meta: date + priority */}
      <div className="flex items-center gap-0.5 flex-shrink-0 flex-nowrap" onClick={(e) => e.stopPropagation()}>
        {isCard
          ? renderCardDateDropdown(onEdit!)
          : renderPortalDateDropdown((input) => editTask(input as Parameters<typeof editTask>[0]))}

        {overdue && (
          <span className="p-0.5 rounded text-destructive cursor-default" title={__("task.overdue")}>
            <AlertTriangle size={12} />
          </span>
        )}

        {isCard
          ? renderCardPriorityDropdown(onEdit!)
          : renderPortalPriorityDropdown((input) => editTask(input as Parameters<typeof editTask>[0]))}
      </div>

      {/* More menu */}
      <div onClick={(e) => e.stopPropagation()}>
      <Popover>
        <PopoverTrigger>
          <button
            className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
            title={__("task.moreActions")}
          >
            <MoreHorizontal size={12} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1.5" align="end" sideOffset={4}>
          <button
            onClick={handleMoveUp}
            disabled={currentIndex <= 0}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <ChevronUp size={14} />
            {__("taskSubtask.moveUp")}
          </button>
          <button
            onClick={handleMoveDown}
            disabled={currentIndex >= siblings.length - 1}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <ChevronDown size={14} />
            {__("taskSubtask.moveDown")}
          </button>
          <div className="my-0.5 border-t border-border" />
          <button
            onClick={handleDeleteClick}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-destructive/10 text-destructive transition-colors"
          >
            <Trash2 size={14} />
            {__("task.delete")}
          </button>
        </PopoverContent>
      </Popover>
      </div>
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        taskTitle={task.title}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
