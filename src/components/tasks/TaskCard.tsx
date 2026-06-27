import { useState } from "react";
import { Check, ChevronRight, AlertTriangle, Trash2, MoreHorizontal, ExternalLink, Undo2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import type { Task } from "../../lib/types";
import { useTaskStore } from "../../stores/taskStore";
import { useUIStore } from "../../stores/uiStore";
import { getPriorityColor, formatDueDate, isOverdue } from "../../lib/utils";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import SubtaskItem from "./SubtaskItem";
import { useT } from "../../i18n/translations";
import { openCardWindow, notifyTaskDeleted } from "../../lib/cardWindows";
import * as api from "../../lib/commands";

interface Props {
  task: Task;
  depth: number;
}

export default function TaskCard({ task, depth }: Props) {
  const { __ } = useT();
  const selectTask = useTaskStore((s) => s.selectTask);
  const editTask = useTaskStore((s) => s.editTask);
  const fetchSubtasks = useTaskStore((s) => s.fetchSubtasks);
  const subtaskMap = useTaskStore((s) => s.subtaskMap);
  const openDrawer = useUIStore((s) => s.openDrawer);
  const expandedTaskIds = useUIStore((s) => s.expandedTaskIds);
  const toggleExpandedTask = useUIStore((s) => s.toggleExpandedTask);
  const movedTaskId = useUIStore((s) => s.movedTaskId);
  const moveDirection = useUIStore((s) => s.moveDirection);
  const exitingTaskIds = useUIStore((s) => s.exitingTaskIds);
  const addExitingTask = useUIStore((s) => s.addExitingTask);
  const enteringTaskIds = useUIStore((s) => s.enteringTaskIds);
  const selectMode = useUIStore((s) => s.selectMode);
  const selectedTaskIds = useUIStore((s) => s.selectedTaskIds);
  const toggleSelectTask = useUIStore((s) => s.toggleSelectTask);
  const cardSections = useUIStore((s) => s.cardSections);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const expanded = expandedTaskIds.has(task.id);

  const subtasks = subtaskMap.get(task.id) || [];

  // Drag-and-drop
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: depth > 0,
  });
  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0 : undefined,
  };

  const handleExpand = async () => {
    if (!expanded) {
      await fetchSubtasks(task.id);
    }
    toggleExpandedTask(task.id);
  };

  const isCompleted = task.status === "done" || task.status === "archived";

  const handleToggle = async () => {
    if (task.status === "archived") {
      addExitingTask(task.id);
      setTimeout(async () => { await useTaskStore.getState().unarchiveTask(task.id); }, 350);
      return;
    }
    const newStatus = task.status === "done" ? "todo" : "done";
    await editTask({ id: task.id, status: newStatus });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    // Fetch subtask IDs before deletion (DB cascades delete)
    const subs = await api.getSubtasks(task.id).catch((e) => { console.error("Failed to fetch subtasks:", e); return []; });
    const subIds = subs.map((s) => s.id);
    useTaskStore.getState().removeTask(task.id);
    notifyTaskDeleted(task.id, subIds);
  };

  const handleClick = () => {
    selectTask(task);
    openDrawer();
  };

  const overdue = isOverdue(task);
  const dueText = formatDueDate(task.due_date, task.due_time);

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...sortableStyle }}
        {...attributes}
        {...listeners}
        className={`rounded-xl border border-border/20 bg-card cursor-default ${
          depth > 0 ? "ml-6" : ""
        } ${isCompleted && !exitingTaskIds.has(task.id) ? "opacity-60" : ""} ${
          isDragging ? "shadow-lg z-10" : ""
        } ${
          movedTaskId === task.id && moveDirection === "up" ? "animate-slide-up" :
          movedTaskId === task.id && moveDirection === "down" ? "animate-slide-down" : ""
        } ${exitingTaskIds.has(task.id) ? "animate-task-exit" : ""} ${enteringTaskIds.has(task.id) ? "animate-task-enter" : ""} ${selectMode && selectedTaskIds.has(task.id) ? "ring-2 ring-primary/50 bg-primary/[0.06]" : selectMode ? "hover:ring-1 hover:ring-primary/20 cursor-pointer" : ""}`}
      >
        <div className={`group flex items-center gap-3 px-3 py-2.5 ${selectMode ? "cursor-pointer" : ""}`} onClick={selectMode ? () => toggleSelectTask(task.id) : undefined}>
          {!selectMode && (
          <button
            onClick={handleToggle}
            aria-label={task.status === "archived" ? __("task.restore") : isCompleted ? __("task.markUndone") : __("task.markDone")}
            className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              task.status === "archived" ? "border-muted-foreground/30 hover:border-primary" :
              isCompleted ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary"
            }`}
          >
            {task.status === "archived" ? <Undo2 size={11} className="text-muted-foreground" /> :
             isCompleted ? <Check size={11} className="text-primary-foreground" /> : null}
          </button>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0" onClick={!selectMode ? handleClick : undefined}>
            <span className={`text-[13px] ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {task.title}
            </span>
          </div>

          {/* Meta badges */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {overdue && (
              <span className="p-0.5 rounded text-destructive cursor-default" title={__("task.overdue")}>
                <AlertTriangle size={14} />
              </span>
            )}
            {dueText && (
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger>
                  <button onPointerDown={(e) => e.stopPropagation()} aria-label={__("taskForm.setDate")} aria-expanded={dateOpen} className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-lg whitespace-nowrap hover:bg-muted/70 transition-colors">{dueText}</button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end" sideOffset={4} onPointerDown={(e) => e.stopPropagation()}>
                  <CalendarPicker mode="single" selected={task.due_date ? new Date(task.due_date) : undefined} onSelect={(date) => {
                    const newDateStr = date ? format(date, "yyyy-MM-dd") : "";
                    // Don't clear if same date is clicked again
                    if (newDateStr && newDateStr === task.due_date) return;
                    editTask({ id: task.id, due_date: newDateStr || task.due_date || undefined });
                    if (newDateStr) setDateOpen(false);
                  }} />
                  {task.due_date && (
                    <>
                      {cardSections.time && (
                        <div className="flex items-center justify-center gap-1 px-4 pb-2">
                          <button onClick={() => {
                            const parts = (task.due_time || "09:00").split(":").map(Number);
                            const h = String((parts[0] - 1 + 24) % 24).padStart(2, "0");
                            editTask({ id: task.id, due_time: `${h}:${String(parts[1] || 0).padStart(2, "0")}` });
                          }} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-xs text-muted-foreground">−</button>
                          <span className="w-12 text-center text-sm font-medium tabular-nums">{task.due_time || "09:00"}</span>
                          <button onClick={() => {
                            const parts = (task.due_time || "09:00").split(":").map(Number);
                            const h = String((parts[0] + 1) % 24).padStart(2, "0");
                            editTask({ id: task.id, due_time: `${h}:${String(parts[1] || 0).padStart(2, "0")}` });
                          }} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-xs text-muted-foreground">+</button>
                          <span className="text-muted-foreground mx-0.5">:</span>
                          <button onClick={() => {
                            const parts = (task.due_time || "09:00").split(":").map(Number);
                            const m = String((parts[1] - 5 + 60) % 60).padStart(2, "0");
                            editTask({ id: task.id, due_time: `${String(parts[0] || 9).padStart(2, "0")}:${m}` });
                          }} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-xs text-muted-foreground">−</button>
                          <span className="w-12 text-center text-sm font-medium tabular-nums">{task.due_time ? task.due_time.split(":")[1] : "00"}</span>
                          <button onClick={() => {
                            const parts = (task.due_time || "09:00").split(":").map(Number);
                            const m = String((parts[1] + 5) % 60).padStart(2, "0");
                            editTask({ id: task.id, due_time: `${String(parts[0] || 9).padStart(2, "0")}:${m}` });
                          }} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-xs text-muted-foreground">+</button>
                          <button onClick={() => { editTask({ id: task.id, due_time: "" }); }} className="ml-1 text-xs text-muted-foreground hover:text-destructive transition-colors" title={__("taskForm.clearTime")}>✕</button>
                        </div>
                      )}
                      <div className={`px-4 pb-3 pt-2 mx-4 ${cardSections.time ? "border-t border-border" : ""}`}>
                        <button onClick={() => { editTask({ id: task.id, due_date: "" }); setDateOpen(false); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">{__("taskForm.clearDate")}</button>
                      </div>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            )}
            <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
              <PopoverTrigger>
                <button onPointerDown={(e) => e.stopPropagation()} aria-label={__(`priority.${task.priority === "p0" ? "urgent" : task.priority === "p1" ? "high" : task.priority === "p2" ? "medium" : "low"}`)} aria-expanded={priorityOpen} className="p-0.5 rounded hover:bg-muted transition-colors" title={`${__(`priority.${task.priority === "p0" ? "urgent" : task.priority === "p1" ? "high" : task.priority === "p2" ? "medium" : "low"}`)} — ${__("task.clickToChange")}`}>
                  <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: getPriorityColor(task.priority) }} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1.5" align="end" sideOffset={4} onPointerDown={(e) => e.stopPropagation()}>
                {(["p0","p1","p2","p3"] as const).map(p => (
                  <button key={p} onClick={(e) => { e.stopPropagation(); editTask({ id: task.id, priority: p }); setPriorityOpen(false); }} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${task.priority === p ? "bg-muted font-medium" : ""}`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getPriorityColor(p) }} />{__(`priority.${p === "p0" ? "urgent" : p === "p1" ? "high" : p === "p2" ? "medium" : "low"}`)}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Expand button — gray only when subtasks were fetched and confirmed empty */}
          {task.parent_id === null && (
            <button
              onClick={subtasks.length === 0 && subtaskMap.has(task.id) ? undefined : handleExpand}
              aria-label={subtasks.length === 0 && subtaskMap.has(task.id) ? __("task.noSubtasks") : expanded ? __("task.collapse") : __("task.expand")}
              className={`inline-flex items-center justify-center transition-colors ${subtasks.length === 0 && subtaskMap.has(task.id) ? "text-muted-foreground/15 cursor-default" : "text-muted-foreground hover:text-foreground"}`}
              title={subtasks.length === 0 && subtaskMap.has(task.id) ? __("task.noSubtasks") : expanded ? __("task.collapse") : __("task.expand")}
            >
              <ChevronRight size={15} className={`transition-transform duration-300 ease-out ${expanded ? "rotate-90" : ""}`} />
            </button>
          )}

          {/* More menu — delete + sort */}
          {depth === 0 && (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger
                render={
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
                    aria-label={__("task.moreActions")}
                    aria-expanded={menuOpen}
                    className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 inline-flex items-center justify-center translate-y-px leading-none"
                    title={__("task.moreActions")}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                }
              />
              <PopoverContent className="w-36 p-1.5" align="end" sideOffset={4}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); openCardWindow(task.id, task.title); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors"
                >
                  <ExternalLink size={14} />{__("card.openAsCard")}
                </button>
                <div className="my-0.5 border-t border-border" />
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); handleDeleteClick(e); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                >
                  <Trash2 size={14} />{__("task.delete")}
                </button>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Subtask area with grid animation */}
        <div
          className="grid transition-all duration-300 ease-out"
          style={{ gridTemplateRows: expanded && subtasks.length > 0 ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="px-2 pb-2.5 pt-0.5 space-y-1.5 ml-1 border-l-2 border-border/40 rounded-b-xl">
              {subtasks.map((st) => (
                <SubtaskItem key={st.id} task={st} depth={depth + 1} />
              ))}
            </div>
          </div>
        </div>
      </div>
    <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        taskTitle={task.title}
        onConfirm={confirmDelete}
      />
    </>
  );
}
