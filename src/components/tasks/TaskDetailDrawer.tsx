import { useEffect, useState, useRef, useCallback } from "react";
import { Trash2, Plus, Clock, Calendar, AlarmClock, ArrowLeft, X, ExternalLink, Circle, CircleDot, CircleCheck, Repeat } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useTaskStore } from "../../stores/taskStore";
import { useGroupStore } from "../../stores/groupStore";
import { useUIStore } from "../../stores/uiStore";
import * as api from "../../lib/commands";
import type { Reminder } from "../../lib/types";
import { useT } from "../../i18n/translations";
import { openCardWindow, notifyTaskDeleted, notifySubtasksChanged } from "../../lib/cardWindows";
import SubtaskItem from "./SubtaskItem";
import NoteEditor from "../notes/NoteEditor";
import ReminderFormDialog from "../reminders/ReminderFormDialog";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import { format } from "date-fns";
import { GROUP_ICONS, FALLBACK_GROUP_ICON } from "../../lib/groupIcons";
import { getPriorityColor } from "../../lib/utils";

export default function TaskDetailDrawer() {
  const { __, lang } = useT();
  const selectedTask = useTaskStore((s) => s.selectedTask);
  const selectTask = useTaskStore((s) => s.selectTask);
  const editTask = useTaskStore((s) => s.editTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const drawerOpen = useUIStore((s) => s.drawerOpen);
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  const cardSections = useUIStore((s) => s.cardSections);
  const groups = useGroupStore((s) => s.groups);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const subtaskMap = useTaskStore((s) => s.subtaskMap);
  const subtasks = selectedTask ? (subtaskMap.get(selectedTask.id) || []) : [];
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [slideDir, setSlideDir] = useState<"right" | "left" | null>(null);

  // Local state for text fields to avoid IME composition breakage
  const [localTitle, setLocalTitle] = useState("");
  const [localNote, setLocalNote] = useState("");
  const titleTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Track which task the local text fields currently belong to.
  // This prevents flushSaves from writing a stale title to a different task.
  const editingTaskIdRef = useRef<string | null>(null);
  const editingTitleRef = useRef<string>("");
  const editingNoteRef = useRef<string>("");

  // Sync local state when selected task changes
  const prevTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedTask) {
      // Before switching, flush any pending edits to the PREVIOUS task.
      if (editingTaskIdRef.current && editingTaskIdRef.current !== selectedTask.id) {
        if (titleTimer.current) { clearTimeout(titleTimer.current); titleTimer.current = null; }
        if (noteTimer.current) { clearTimeout(noteTimer.current); noteTimer.current = null; }
        const prevTask = useTaskStore.getState().tasks.find(t => t.id === editingTaskIdRef.current)
          || [...useTaskStore.getState().subtaskMap.values()].flat().find(t => t.id === editingTaskIdRef.current);
        if (prevTask) {
          if (editingTitleRef.current !== prevTask.title) editTask({ id: prevTask.id, title: editingTitleRef.current });
          if (editingNoteRef.current !== prevTask.note) editTask({ id: prevTask.id, note: editingNoteRef.current });
        }
      }
      setLocalTitle(selectedTask.title);
      setLocalNote(selectedTask.note);
      editingTaskIdRef.current = selectedTask.id;
      editingTitleRef.current = selectedTask.title;
      editingNoteRef.current = selectedTask.note;
      // Determine slide direction based on navigation
      if (prevTaskIdRef.current && prevTaskIdRef.current !== selectedTask.id) {
        if (selectedTask.parent_id === prevTaskIdRef.current) {
          setSlideDir("right"); // navigating to child
        } else {
          setSlideDir("left"); // navigating back to parent
        }
      }
      prevTaskIdRef.current = selectedTask.id;
    }
  }, [selectedTask?.id]);

  const refreshReminders = async () => {
    if (selectedTask) {
      const updated = await api.getReminders(selectedTask.id);
      setReminders(updated);
    }
  };

  useEffect(() => {
    if (selectedTask) {
      api.getReminders(selectedTask.id).then(setReminders).catch((e) => { console.error("Failed to fetch reminders:", e); });
      // Only fetch subtasks if they haven't been loaded yet
      const store = useTaskStore.getState();
      if (!store.subtaskMap.has(selectedTask.id)) {
        store.fetchSubtasks(selectedTask.id);
      }
    }
  }, [selectedTask]);

  // Debounced save for text fields
  const saveTitle = useCallback((value: string) => {
    editingTitleRef.current = value;
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      if (editingTaskIdRef.current) editTask({ id: editingTaskIdRef.current, title: value });
    }, 500);
  }, []);

  const saveNote = useCallback((value: string) => {
    editingNoteRef.current = value;
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      if (editingTaskIdRef.current) editTask({ id: editingTaskIdRef.current, note: value });
    }, 500);
  }, []);

  // Flush pending saves — uses refs so it always targets the correct task.
  const flushSaves = useCallback(() => {
    if (titleTimer.current) { clearTimeout(titleTimer.current); titleTimer.current = null; }
    if (noteTimer.current) { clearTimeout(noteTimer.current); noteTimer.current = null; }
    const taskId = editingTaskIdRef.current;
    if (taskId) {
      if (editingTitleRef.current) {
        const task = useTaskStore.getState().tasks.find(t => t.id === taskId)
          || [...useTaskStore.getState().subtaskMap.values()].flat().find(t => t.id === taskId);
        if (task) {
          if (editingTitleRef.current !== task.title) editTask({ id: taskId, title: editingTitleRef.current });
          if (editingNoteRef.current !== task.note) editTask({ id: taskId, note: editingNoteRef.current });
        }
      }
    }
  }, []);

  // Flush on unmount or when task changes
  useEffect(() => {
    return () => { flushSaves(); };
  }, [flushSaves]);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTask) return;
    // Fetch subtask IDs before deletion (DB cascades delete)
    const subs = await api.getSubtasks(selectedTask.id).catch((e) => { console.error("Failed to fetch subtasks:", e); return []; });
    const subIds = subs.map((s) => s.id);
    await removeTask(selectedTask.id);
    notifyTaskDeleted(selectedTask.id, subIds);
    closeDrawer();
  };

  const handleAddSubtask = async () => {
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    await useTaskStore.getState().addTask({
      group_id: selectedTask.group_id,
      parent_id: selectedTask.id,
      title: newSubtaskTitle.trim(),
    });
    setNewSubtaskTitle("");
    await useTaskStore.getState().fetchSubtasks(selectedTask.id);
    // Auto-reorder: uncompleted before completed
    const st = useTaskStore.getState();
    const sibs = st.subtaskMap.get(selectedTask.id) || [];
    if (sibs.length > 1) {
      const active = sibs.filter(t => t.status !== "done").map(t => t.id);
      const done = sibs.filter(t => t.status === "done").map(t => t.id);
      await st.moveTask([...active, ...done]);
    }
    notifySubtasksChanged(selectedTask.id);
  };

  const handleClose = () => {
    flushSaves();
    // Capture the task being closed so we only clear it if the user hasn't
    // opened a different task during the exit animation.
    const closingTaskId = selectedTask?.id ?? null;
    closeDrawer();
    // Delay clearing selectedTask until the Sheet exit animation (0.2s) has
    // finished — otherwise the component unmounts immediately and base-ui
    // never gets to play the close transition.
    setTimeout(() => {
      if (useTaskStore.getState().selectedTask?.id === closingTaskId) {
        selectTask(null);
      }
      setSlideDir(null);
      prevTaskIdRef.current = null;
    }, 220);
  };

  const handleGoToParent = () => {
    flushSaves();
    if (selectedTask?.parent_id) {
      const parent = useTaskStore.getState().tasks.find(t => t.id === selectedTask.parent_id);
      if (parent) {
        selectTask(parent);
        return;
      }
      // Parent might be a subtask of another task; check subtaskMap
      for (const subs of useTaskStore.getState().subtaskMap.values()) {
        const p = subs.find(t => t.id === selectedTask.parent_id);
        if (p) { selectTask(p); return; }
      }
    }
    // No parent found, go to root
    selectTask(null);
    closeDrawer();
  };

  return (
    <Sheet open={drawerOpen && !!selectedTask} onOpenChange={(open: boolean) => { if (!open) handleClose(); }}>
      <SheetContent className="overflow-hidden !bg-transparent !shadow-none !border-none p-3" style={{ width: "var(--drawer-width, 440px)", maxWidth: "var(--drawer-width, 440px)" }} showCloseButton={false}>
        {!selectedTask ? null : (
        <div key={selectedTask.id} className={`${slideDir === "right" ? "animate-slide-right" : slideDir === "left" ? "animate-slide-left" : ""} bg-card rounded-xl border border-border/40 shadow-lg min-h-full p-4 overflow-y-auto`}>
        <SheetHeader className="flex flex-row items-center justify-between pr-8">
          <div className="flex items-center gap-2">
            {selectedTask.parent_id && (
              <button onClick={handleGoToParent} className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors" title={__("detail.backToParent")}>
                <ArrowLeft size={15} />
              </button>
            )}
            <SheetTitle className="text-sm">{__("detail.title")}</SheetTitle>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openCardWindow(selectedTask.id, selectedTask.title)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs flex-shrink-0 transition-colors"
              title={__("card.openInCard")}
            >
              <ExternalLink size={14} />
            </button>
            <button onClick={handleDelete} className="text-destructive hover:text-destructive/90 flex items-center gap-1 text-xs flex-shrink-0">
              <Trash2 size={14} />
              {__("task.delete")}
            </button>
          </div>
        </SheetHeader>

        <div className="space-y-4 mt-4 px-4">
          {/* Title — local state + debounce */}
          <Input
            value={localTitle}
            onChange={(e) => { setLocalTitle(e.target.value); saveTitle(e.target.value); }}
            className="font-semibold text-sm"
          />

          {/* Meta dropdowns — Popover-based to avoid base-ui Select flicker */}
          <div className="flex gap-2 flex-wrap">
            {/* Group */}
            <Popover>
              <PopoverTrigger>
                <button className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-input text-xs hover:border-primary/50 transition-colors">
                  {(() => { const g = groups.find(x => x.id === selectedTask.group_id); const Icon = g ? (GROUP_ICONS[g.icon] || FALLBACK_GROUP_ICON) : FALLBACK_GROUP_ICON; return <><Icon size={13} style={{ color: g?.color }} />{g?.name}</>; })()}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1.5" align="start" sideOffset={4}>
                {groups.map((g) => { const Icon = GROUP_ICONS[g.icon] || FALLBACK_GROUP_ICON;
                  return <button key={g.id} onClick={() => editTask({ id: selectedTask.id, group_id: g.id })} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${selectedTask.group_id === g.id ? "bg-muted font-medium" : ""}`}><Icon size={13} style={{ color: g.color }} />{g.name}</button>;
                })}
              </PopoverContent>
            </Popover>

            {/* Status */}
            <Popover>
              <PopoverTrigger>
                <button className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-input text-xs hover:border-primary/50 transition-colors">
                  {selectedTask.status === "in_progress" ? <><CircleDot size={14} className="text-status-in_progress" />{__("status.inProgress")}</> :
                   selectedTask.status === "done" ? <><CircleCheck size={14} className="text-status-done" />{__("status.done")}</> :
                   <><Circle size={14} className="text-muted-foreground" />{__("status.todo")}</>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1.5" align="start" sideOffset={4}>
                {(["todo","in_progress","done"] as const).map(s => (
                  <button key={s} onClick={() => editTask({ id: selectedTask.id, status: s })} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${selectedTask.status === s ? "bg-muted font-medium" : ""}`}>
                    {s === "in_progress" ? <CircleDot size={14} className="text-status-in_progress" /> : s === "done" ? <CircleCheck size={14} className="text-status-done" /> : <Circle size={14} className="text-muted-foreground" />}{__(`status.${s === "in_progress" ? "inProgress" : s}`)}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Priority */}
            <Popover>
              <PopoverTrigger>
                <button className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-input text-xs hover:border-primary/50 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getPriorityColor(selectedTask.priority) }} />
                  {__(`priority.${selectedTask.priority === "p0" ? "urgent" : selectedTask.priority === "p1" ? "high" : selectedTask.priority === "p2" ? "medium" : "low"}`)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1.5" align="start" sideOffset={4}>
                {(["p0","p1","p2","p3"] as const).map(p => (
                  <button key={p} onClick={() => editTask({ id: selectedTask.id, priority: p })} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${selectedTask.priority === p ? "bg-muted font-medium" : ""}`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getPriorityColor(p) }} />{__(`priority.${p === "p0" ? "urgent" : p === "p1" ? "high" : p === "p2" ? "medium" : "low"}`)}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

          {/* Due date, time & recurrence — same flex-wrap row as meta */}
            <Popover>
              <PopoverTrigger>
                <button className={`flex items-center gap-2 h-8 px-3 rounded-lg border border-input text-xs transition-colors hover:border-primary/50 ${selectedTask.due_date ? "text-foreground" : "text-muted-foreground"}`}>
                  <Calendar size={13} className="flex-shrink-0" />
                  {selectedTask.due_date ? format(new Date(selectedTask.due_date), lang === "zh" ? "yyyy年M月d日" : "MMM d, yyyy") : __("taskForm.setDate")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={selectedTask.due_date ? new Date(selectedTask.due_date) : undefined}
                  onSelect={(date) => editTask({ id: selectedTask.id, due_date: date ? format(date, "yyyy-MM-dd") : "" })}
                />
                {selectedTask.due_date && (
                  <div className="px-4 pb-3">
                    <button
                      onClick={() => editTask({ id: selectedTask.id, due_date: "" })}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      {__("taskForm.clearDate")}
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            {cardSections.time && (
            <Popover>
              <PopoverTrigger>
                <button className={`w-28 flex items-center gap-2 h-8 px-3 rounded-lg border border-input text-xs transition-colors hover:border-primary/50 ${selectedTask.due_time ? "text-foreground" : "text-muted-foreground"}`}>
                  <AlarmClock size={13} className="flex-shrink-0" />
                  {selectedTask.due_time || __("taskForm.setTime")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-3" align="start">
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold">
                    <button
                      onClick={() => {
                        const cur = selectedTask.due_time ? parseInt(selectedTask.due_time.split(":")[0]) : 9;
                        editTask({ id: selectedTask.id, due_time: `${String((cur - 1 + 24) % 24).padStart(2, "0")}:${selectedTask.due_time ? selectedTask.due_time.split(":")[1] : "00"}` });
                      }}
                      className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      −
                    </button>
                    <span className="w-10 text-center tabular-nums">{selectedTask.due_time ? selectedTask.due_time.split(":")[0] : "09"}</span>
                    <button
                      onClick={() => {
                        const cur = selectedTask.due_time ? parseInt(selectedTask.due_time.split(":")[0]) : 9;
                        editTask({ id: selectedTask.id, due_time: `${String((cur + 1) % 24).padStart(2, "0")}:${selectedTask.due_time ? selectedTask.due_time.split(":")[1] : "00"}` });
                      }}
                      className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      +
                    </button>
                    <span className="mx-0.5 text-muted-foreground">:</span>
                    <button
                      onClick={() => {
                        const parts = selectedTask.due_time ? selectedTask.due_time.split(":") : ["09", "00"];
                        editTask({ id: selectedTask.id, due_time: `${parts[0]}:${String((parseInt(parts[1]) - 5 + 60) % 60).padStart(2, "0")}` });
                      }}
                      className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      −
                    </button>
                    <span className="w-10 text-center tabular-nums">{selectedTask.due_time ? selectedTask.due_time.split(":")[1] : "00"}</span>
                    <button
                      onClick={() => {
                        const parts = selectedTask.due_time ? selectedTask.due_time.split(":") : ["09", "00"];
                        editTask({ id: selectedTask.id, due_time: `${parts[0]}:${String((parseInt(parts[1]) + 5) % 60).padStart(2, "0")}` });
                      }}
                      className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      +
                    </button>
                  </div>
                  {selectedTask.due_time && (
                    <button
                      onClick={() => editTask({ id: selectedTask.id, due_time: "" })}
                      className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      {__("taskForm.clearTime")}
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            )}
            {cardSections.recurrence && (
            <Popover>
              <PopoverTrigger>
                <button className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-input text-xs hover:border-primary/50 transition-colors">
                  <Repeat size={13} className="text-muted-foreground" />
                  {selectedTask.recurrence === "daily" ? __("taskForm.recurrenceDaily") :
                   selectedTask.recurrence === "weekly" ? __("taskForm.recurrenceWeekly") :
                   selectedTask.recurrence === "monthly" ? __("taskForm.recurrenceMonthly") :
                   __("taskForm.recurrenceNone")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1.5" align="start" sideOffset={4}>
                {(["none","daily","weekly","monthly"] as const).map(r => (
                  <button key={r} onClick={() => editTask({ id: selectedTask.id, recurrence: r === "none" ? "" : r })} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${(selectedTask.recurrence || "none") === r ? "bg-muted font-medium" : ""}`}>
                    {r === "daily" ? __("taskForm.recurrenceDaily") : r === "weekly" ? __("taskForm.recurrenceWeekly") : r === "monthly" ? __("taskForm.recurrenceMonthly") : __("taskForm.recurrenceNone")}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            )}
          </div>

          {/* Notes — local state + debounce */}
          <div>
            <div className="text-[10px] text-text-muted mb-1">{__("detail.notes")}</div>
            <NoteEditor
              value={localNote}
              onChange={(v) => { setLocalNote(v); saveNote(v); }}
              placeholder={__("detail.notesPlaceholder")}
            />
          </div>

          {/* Reminders */}
          <div>
            <div className="text-[10px] text-text-muted mb-2 flex items-center gap-1">
              <Clock size={12} /> {__("detail.reminders")}
            </div>
            {reminders.length === 0 && (
              <div className="text-[11px] text-muted-foreground/50 italic px-1">{__("detail.noReminders")}</div>
            )}
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-1.5 mb-1 text-xs group/rem">
                <Clock size={12} className="text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground flex-1 min-w-0 truncate">
                  {r.type === "due_date" ? `${r.advance_minutes} ${__("reminder.minBeforeDue")}` :
                   r.type === "recurring" ? `${__("reminder.recurringLabel")}${r.repeat_rule || __("reminder.custom")}` :
                   r.remind_at ? `${__("reminder.oneTimeLabel")}${new Date(r.remind_at).toLocaleDateString()}` : __("reminder.oneTimeDisplay")}
                </span>
                <button onClick={async () => { await api.snoozeReminder(r.id); await refreshReminders(); }} className="text-muted-foreground hover:text-foreground opacity-0 group-hover/rem:opacity-100 transition-opacity" title={__("reminder.snoozeBtn")}><Clock size={11} /></button>
                <button onClick={async () => { await api.deleteReminder(r.id); await refreshReminders(); }} className="text-muted-foreground hover:text-destructive opacity-0 group-hover/rem:opacity-100 transition-opacity"><X size={12} /></button>
              </div>
            ))}
            <button
              onClick={() => setReminderDialogOpen(true)}
              className="text-[10px] text-brand hover:text-brand-dark flex items-center gap-1"
            >
              <Plus size={12} /> {__("detail.addReminder")}
            </button>
          </div>

          {/* Subtasks */}
          <div>
            <div className="text-[10px] text-text-muted mb-2">
              {__("detail.subtasks")} ({subtasks.filter((s) => s.status === "done").length}/{subtasks.length})
            </div>
            <div className="space-y-1.5">
              {subtasks.map((st) => (
                <SubtaskItem key={st.id} task={st} depth={0} />
              ))}
            </div>
            <div className="relative mt-1">
              <Input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder={__("detail.addSubtask")}
                className="text-xs h-7 pr-7"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); }}
              />
              <button
                onClick={handleAddSubtask}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-primary rounded transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Activity */}
          <div>
            <div className="text-[10px] text-text-muted mb-1">{__("detail.activity")}</div>
            <div className="text-[10px] text-text-muted">
              {__("detail.created")} {new Date(selectedTask.created_at).toLocaleDateString()}
            </div>
            {selectedTask.completed_at && (
              <div className="text-[10px] text-text-muted">
                {__("detail.completed")} {new Date(selectedTask.completed_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
        </div>
        )}
      </SheetContent>
      {selectedTask && (
        <DeleteConfirmDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen} taskTitle={selectedTask.title} onConfirm={confirmDelete} />
      )}
      {selectedTask && (
      <ReminderFormDialog
        open={reminderDialogOpen}
        onOpenChange={setReminderDialogOpen}
        taskId={selectedTask.id}
        onCreated={refreshReminders}
      />
      )}
    </Sheet>
  );
}
