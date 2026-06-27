import { useMemo, memo } from "react";
import { useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { useTaskStore } from "../../stores/taskStore";
import { useGroupStore } from "../../stores/groupStore";
import { useUIStore } from "../../stores/uiStore";
import type { Task } from "../../lib/types";
import { getPriorityColor, sortTasks, isUngroupedGroup } from "../../lib/utils";
import TaskCard from "../tasks/TaskCard";
import { useT } from "../../i18n/translations";

export default memo(function ListView() {
  const { __ } = useT();
  const tasks = useTaskStore((s) => s.tasks);
  const groups = useGroupStore((s) => s.groups);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const filterGroupId = useUIStore((s) => s.filterGroupId);
  const filterTodayOnly = useUIStore((s) => s.filterTodayOnly);
  const showArchived = useUIStore((s) => s.showArchived);
  const exitingTaskIds = useUIStore((s) => s.exitingTaskIds);
  const sortBy = useUIStore((s) => s.sortBy);
  const reorder = useTaskStore((s) => s.moveTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const selectMode = useUIStore((s) => s.selectMode);
  const selectedTaskIds = useUIStore((s) => s.selectedTaskIds);
  const setSelectMode = useUIStore((s) => s.setSelectMode);
  const setMovedTask = useUIStore((s) => s.setMovedTask);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === String(event.active.id));
    setActiveTask(task || null);
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (searchQuery) {
      result = result.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (filterGroupId) {
      result = result.filter((t) => t.group_id === filterGroupId);
    }
    if (filterTodayOnly) {
      const today = new Date().toISOString().slice(0, 10);
      result = result.filter((t) =>
        t.due_date === today || (t.due_date && t.due_date < today && t.status !== "done")
      );
    }
    if (showArchived) {
      result = result.filter((t) => t.status === "archived" || exitingTaskIds.has(t.id));
    } else {
      result = result.filter((t) => t.status !== "archived" || exitingTaskIds.has(t.id));
    }
    result = sortTasks(result, sortBy);
    return result;
  }, [tasks, searchQuery, filterGroupId, filterTodayOnly, showArchived, exitingTaskIds, sortBy]);

  const tasksByGroup = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const task of filteredTasks) {
      const list = map.get(task.group_id) || [];
      list.push(task);
      map.set(task.group_id, list);
    }
    return map;
  }, [filteredTasks]);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeTask = tasks.find(t => t.id === activeId);
    const overTask = tasks.find(t => t.id === overId);
    if (!activeTask || !overTask || activeTask.group_id !== overTask.group_id) return;
    const groupIds = tasks.filter(t => t.group_id === activeTask.group_id).map(t => t.id);
    const oldIdx = groupIds.indexOf(activeId);
    const newIdx = groupIds.indexOf(overId);
    if (oldIdx === -1 || newIdx === -1) return;
    const moved = [...groupIds];
    moved.splice(oldIdx, 1);
    moved.splice(newIdx, 0, activeId);
    setMovedTask(activeId, newIdx > oldIdx ? "down" : "up");
    reorder(moved);
  };

  if (filteredTasks.length === 0) {
    const emptyIcon = showArchived ? "✅" : filterTodayOnly ? "☀️" : "📋";
    const emptyTitle = showArchived ? __("list.emptyCompleted") : filterTodayOnly ? __("list.emptyToday") : __("list.empty");
    const emptyHint = showArchived || filterTodayOnly ? "" : __("list.emptyHint");
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <div className="text-4xl opacity-30">{emptyIcon}</div>
        <p className="text-sm">{emptyTitle}</p>
        {emptyHint && <p className="text-xs text-muted-foreground/60">{emptyHint}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="bg-card border border-primary/40 rounded-xl p-3 shadow-xl rotate-1 cursor-grabbing">
              <div className="text-[13px] text-foreground truncate mb-1">{activeTask.title}</div>
              <span className="w-2 h-2 rounded-full block" style={{ backgroundColor: getPriorityColor(activeTask.priority) }} />
            </div>
          ) : null}
        </DragOverlay>
        {Array.from(tasksByGroup.entries()).map(([groupId, groupTasks]) => {
          const group = groups.find((g) => g.id === groupId);
          const taskIds = groupTasks.map(t => t.id);
          return (
            <div key={groupId} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: group?.color || "#6366f1" }} />
                <span className="font-semibold text-xs text-foreground">{group && isUngroupedGroup(group.name) ? __("sidebar.ungrouped") : (group?.name || __("list.noGroup"))}</span>
                <span className="text-[10px] text-muted-foreground">{groupTasks.length}</span>
              </div>
              <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {groupTasks.map((task) => (
                    <TaskCard key={task.id} task={task} depth={0} />
                  ))}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </DndContext>

      {/* Bulk action bar */}
      {selectMode && selectedTaskIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border/60 rounded-xl px-5 py-3 shadow-lg flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{selectedTaskIds.size} {__("list.selected")}</span>
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            {__("view.deleteSelected")}
          </button>
          <button onClick={() => setSelectMode(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10" onClick={() => setBulkDeleteOpen(false)}>
          <div className="bg-card rounded-xl border border-border/60 shadow-lg p-5 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-[13px] text-foreground mb-1">{__("delete.bulkTitle")}</p>
            <p className="text-xs text-muted-foreground mb-4">{__("delete.bulkConfirm").replace("{n}", String(selectedTaskIds.size))}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkDeleteOpen(false)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors">{__("delete.cancel")}</button>
              <button onClick={async () => {
                for (const id of selectedTaskIds) await removeTask(id);
                setSelectMode(false);
                setBulkDeleteOpen(false);
              }} className="px-3 py-1.5 text-xs rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">{__("delete.delete")}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
