import { useState, memo } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, useDroppable, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { ChevronRight, Check, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { useTaskStore } from "../../stores/taskStore";
import { useUIStore } from "../../stores/uiStore";
import { getPriorityLabel } from "../../lib/types";
import { getPriorityColor, sortTasks } from "../../lib/utils";
import { useT } from "../../i18n/translations";
import type { Task } from "../../lib/types";

type ColKey = "todo" | "in_progress" | "done";

function KanbanCard({ task }: { task: Task }) {
  const { __ } = useT();
  const selectTask = useTaskStore((s) => s.selectTask);
  const openDrawer = useUIStore((s) => s.openDrawer);
  const expandedTaskIds = useUIStore((s) => s.expandedTaskIds);
  const toggleExpandedTask = useUIStore((s) => s.toggleExpandedTask);
  const fetchSubtasks = useTaskStore((s) => s.fetchSubtasks);
  const subtaskMap = useTaskStore((s) => s.subtaskMap);
  const expanded = expandedTaskIds.has(task.id);
  const subtasks = subtaskMap.get(task.id) || [];
  const editTask = useTaskStore((s) => s.editTask);
  const cardSections = useUIStore((s) => s.cardSections);

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const overdue = task.due_date && task.status !== "done" ? new Date(task.due_date) < new Date(new Date().toDateString()) : false;
  const dueDateStr = task.due_date ? format(new Date(task.due_date), "MM/dd") : null;
  const dueDisplay = dueDateStr ? (task.due_time ? `${dueDateStr} ${task.due_time}` : dueDateStr) : null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition: isDragging ? "none" : transition, opacity: isDragging ? 0 : undefined };

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded) await fetchSubtasks(task.id);
    toggleExpandedTask(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border/20 rounded-xl shadow-sm ${isDragging ? "shadow-lg z-10" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing"
      >
        <div className="flex-1 min-w-0" onClick={() => { selectTask(task); openDrawer(); }}>
          <div className="text-[13px] text-foreground truncate">{task.title}</div>
        </div>

        {/* Icons */}
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Overdue */}
          {overdue && <span className="p-0.5 rounded text-destructive" title={__("task.overdue")}><AlertTriangle size={14} /></span>}
          {/* Due date */}
          {dueDisplay && (
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger>
                <button onPointerDown={(e) => e.stopPropagation()} className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-lg whitespace-nowrap cursor-pointer hover:bg-muted/70 transition-colors">{dueDisplay}</button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end" sideOffset={4} onPointerDown={(e) => e.stopPropagation()}>
                <CalendarPicker mode="single" selected={task.due_date ? new Date(task.due_date) : undefined} onSelect={(date) => {
                  const newDateStr = date ? format(date, "yyyy-MM-dd") : "";
                  if (newDateStr && newDateStr === task.due_date) return;
                  editTask({ id: task.id, due_date: newDateStr || task.due_date || undefined });
                  if (newDateStr) setDateOpen(false);
                }} />
                {task.due_date && (<>
                  {cardSections.time && (
                    <div className="flex items-center justify-center gap-1 px-4 pb-2">
                      <button onClick={() => { const p = (task.due_time || "09:00").split(":").map(Number); const h = String((p[0] - 1 + 24) % 24).padStart(2, "0"); editTask({ id: task.id, due_time: `${h}:${String(p[1] || 0).padStart(2, "0")}` }); }} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-xs text-muted-foreground">−</button>
                      <span className="w-12 text-center text-sm font-medium">{task.due_time || "09:00"}</span>
                      <button onClick={() => { const p = (task.due_time || "09:00").split(":").map(Number); const h = String((p[0] + 1) % 24).padStart(2, "0"); editTask({ id: task.id, due_time: `${h}:${String(p[1] || 0).padStart(2, "0")}` }); }} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-xs text-muted-foreground">+</button>
                      <span className="text-muted-foreground mx-0.5">:</span>
                      <button onClick={() => { const p = (task.due_time || "09:00").split(":").map(Number); const m = String((p[1] - 5 + 60) % 60).padStart(2, "0"); editTask({ id: task.id, due_time: `${String(p[0] || 9).padStart(2, "0")}:${m}` }); }} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-xs text-muted-foreground">−</button>
                      <span className="w-12 text-center text-sm font-medium">{task.due_time ? task.due_time.split(":")[1] : "00"}</span>
                      <button onClick={() => { const p = (task.due_time || "09:00").split(":").map(Number); const m = String((p[1] + 5) % 60).padStart(2, "0"); editTask({ id: task.id, due_time: `${String(p[0] || 9).padStart(2, "0")}:${m}` }); }} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-xs text-muted-foreground">+</button>
                      <button onClick={() => { editTask({ id: task.id, due_time: "" }); }} className="ml-1 text-xs text-muted-foreground hover:text-destructive transition-colors" title={__("taskForm.clearTime")}>✕</button>
                    </div>
                  )}
                  <div className={`px-4 pb-3 pt-2 mx-4 ${cardSections.time ? "border-t border-border" : ""}`}>
                    <button onClick={() => { editTask({ id: task.id, due_date: "" }); setDateOpen(false); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">{__("taskForm.clearDate")}</button>
                  </div>
                </>)}
              </PopoverContent>
            </Popover>
          )}
          {/* Priority */}
          <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
            <PopoverTrigger>
              <button onPointerDown={(e) => e.stopPropagation()} className="p-0.5 rounded hover:bg-muted transition-colors cursor-pointer" title={`${__(getPriorityLabel(task.priority))} — ${__("task.clickToChange")}`}>
                <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: getPriorityColor(task.priority) }} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1.5" align="end" sideOffset={4} onPointerDown={(e) => e.stopPropagation()}>
              {(["p0","p1","p2","p3"] as const).map(p => (
                <button key={p} onClick={() => { editTask({ id: task.id, priority: p }); setPriorityOpen(false); }} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${task.priority === p ? "bg-muted font-medium" : ""}`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getPriorityColor(p) }} />{__(getPriorityLabel(p))}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        {/* Expand */}
        <button
          onClick={subtasks.length === 0 && subtaskMap.has(task.id) ? undefined : handleExpand}
          className={`inline-flex items-center justify-center transition-colors cursor-default ${subtasks.length === 0 && subtaskMap.has(task.id) ? "text-muted-foreground/15" : "text-muted-foreground hover:text-foreground cursor-pointer"}`}
          title={subtasks.length === 0 && subtaskMap.has(task.id) ? __("task.noSubtasks") : expanded ? __("task.collapse") : __("task.expand")}
        >
          <ChevronRight size={15} className={`transition-transform duration-300 ease-out ${expanded ? "rotate-90" : ""}`} />
        </button>
      </div>

      {/* Subtask area with grid animation */}
      <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: expanded && subtasks.length > 0 ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="px-2 pb-2.5 pt-0.5 space-y-1 border-t border-border/20 mx-2">
            {subtasks.map(st => (
              <div key={st.id} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 cursor-pointer text-xs transition-colors" onClick={(e) => { e.stopPropagation(); selectTask(st); openDrawer(); }}>
                <button onClick={async (e) => { e.stopPropagation(); await editTask({ id: st.id, status: st.status === "done" ? "todo" : "done" }); }} className={`w-[14px] h-[14px] rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${st.status === "done" ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary"}`}>
                  {st.status === "done" && <Check size={9} className="text-primary-foreground" />}
                </button>
                <span className={`flex-1 truncate ${st.status === "done" ? "line-through opacity-50" : ""}`}>{st.title}</span>
                {st.due_date && <span className="text-[9px] bg-muted text-muted-foreground px-1 py-0.5 rounded whitespace-nowrap">{format(new Date(st.due_date), "MM/dd")}{st.due_time ? ` ${st.due_time}` : ""}</span>}
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getPriorityColor(st.priority) }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ColumnDef { key: ColKey; label: string; color: string; bgClass: string; }
function DroppableColumn({ col, children }: { col: ColumnDef; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${col.key}` });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 rounded-xl p-3 flex flex-col transition-all min-h-0 min-w-0 ${col.bgClass} ${isOver ? "ring-2 ring-inset ring-primary/40" : ""}`}
    >
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
        <span className="text-xs font-semibold text-foreground">{col.label}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export default memo(function KanbanView() {
  const tasks = useTaskStore((s) => s.tasks);
  const editTask = useTaskStore((s) => s.editTask);
  const reorder = useTaskStore((s) => s.moveTask);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const filterTodayOnly = useUIStore((s) => s.filterTodayOnly);
  const showArchived = useUIStore((s) => s.showArchived);
  const exitingTaskIds = useUIStore((s) => s.exitingTaskIds);
  const sortBy = useUIStore((s) => s.sortBy);
  const { __ } = useT();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const COLUMNS = [
    { key: "todo" as const, label: __("kanban.todo"), color: "var(--color-status-todo)", bgClass: "bg-[var(--kanban-todo-bg)]" },
    { key: "in_progress" as const, label: __("kanban.inProgress"), color: "var(--color-status-in_progress)", bgClass: "bg-[var(--kanban-progress-bg)]" },
    { key: "done" as const, label: __("kanban.done"), color: "var(--color-status-done)", bgClass: "bg-[var(--kanban-done-bg)]" },
  ];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const baseFiltered = searchQuery
    ? tasks.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : tasks;
  const filteredTasks = (() => {
    let result = baseFiltered;
    if (filterTodayOnly) {
      const today = new Date().toISOString().slice(0, 10);
      result = result.filter((t) =>
        t.due_date === today || (t.due_date && t.due_date < today && t.status !== "done")
      );
    }
    if (showArchived) {
      result = result.filter((t) => t.status === "archived");
    } else {
      result = result.filter((t) => t.status !== "archived" || exitingTaskIds.has(t.id));
    }
    return result;
  })();
  const sortedTasks = sortTasks(filteredTasks, sortBy);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === String(event.active.id));
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;
    const activeId = String(active.id);
    const found = tasks.find((t) => t.id === activeId);
    if (!found) return;

    const overId = String(over.id);

    if (overId.startsWith("col-")) {
      const targetCol = overId.replace("col-", "") as ColKey;
      if (found.status !== targetCol) {
        editTask({ id: activeId, status: targetCol });
      }
      return;
    }

    const overTask = tasks.find((t) => t.id === overId);
    if (!overTask) return;

    if (found.status !== overTask.status) {
      editTask({ id: activeId, status: overTask.status });
      return;
    }

    const colTasks = sortedTasks.filter((t) => t.status === found.status);
    const ids = colTasks.map((t) => t.id);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...ids];
    reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, activeId);
    reorder(reordered);
  };

  if (sortedTasks.length === 0) {
    const emptyIcon = showArchived ? "✅" : filterTodayOnly ? "☀️" : "";
    const emptyTitle = showArchived ? __("list.emptyCompleted") : filterTodayOnly ? __("list.emptyToday") : __("kanban.empty");
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {emptyIcon && <span className="text-2xl opacity-30">{emptyIcon}</span>}
          <span className="text-sm font-medium">{emptyTitle}</span>
          {!showArchived && !filterTodayOnly && <span className="text-xs">{__("kanban.emptyHint")}</span>}
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 h-full overflow-hidden">
        {COLUMNS.map((col) => {
          const colTasks = sortedTasks.filter((t) => t.status === col.key);
          const taskIds = colTasks.map((t) => t.id);
          return (
            <DroppableColumn key={col.key} col={col}>
              <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {colTasks.map((task) => (
                    <KanbanCard key={task.id} task={task} />
                  ))}
                </div>
              </SortableContext>
            </DroppableColumn>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="bg-card border border-primary/40 rounded-xl p-3 shadow-xl rotate-1">
            <div className="text-[13px] text-foreground mb-2">{activeTask.title}</div>
            <div className="flex items-center gap-1.5">
              <span className="p-0.5 rounded" style={{ color: getPriorityColor(activeTask.priority) }} title={__(getPriorityLabel(activeTask.priority))}>
                <span className="w-2 h-2 rounded-full block" style={{ backgroundColor: "currentColor" }} />
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});
