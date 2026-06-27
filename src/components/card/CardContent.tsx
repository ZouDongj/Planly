import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Clock, Calendar, AlarmClock, X, Circle, CircleDot, CircleCheck, Repeat } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import type { Task, TaskGroup, Reminder } from "../../lib/types";
import { GROUP_ICONS, FALLBACK_GROUP_ICON } from "../../lib/groupIcons";
import { useT } from "../../i18n/translations";
import { useTaskStore } from "../../stores/taskStore";
import NoteEditor from "../notes/NoteEditor";
import SubtaskItem from "../tasks/SubtaskItem";
import ReminderFormDialog from "../reminders/ReminderFormDialog";
import * as api from "../../lib/commands";

interface EditInput {
  id: string;
  title?: string;
  note?: string;
  priority?: string;
  status?: string;
  due_date?: string;
  due_time?: string;
  group_id?: string;
  recurrence?: string | null;
}

interface Props {
  task: Task;
  groups: TaskGroup[];
  onEdit: (input: EditInput) => Promise<void>;
  onSubtaskEdit?: (input: EditInput) => Promise<void>;
  onSubtaskCreated?: (task: Task) => void;
  onSubtaskDeleted?: () => void;
}

function loadCardSections() {
  try {
    const raw = localStorage.getItem("planly-card-sections");
    return raw ? JSON.parse(raw) : { reminders: false, dateTime: true, time: false, recurrence: false, group: true, activity: false };
  } catch {
    return { reminders: false, dateTime: true, group: true, activity: false };
  }
}

const EMPTY_SUBTASKS: Task[] = [];

export default function CardContent({ task, groups, onEdit, onSubtaskEdit, onSubtaskCreated, onSubtaskDeleted }: Props) {
  const { __, lang } = useT();
  const subtasks = useTaskStore((s) => s.subtaskMap.get(task.id) || EMPTY_SUBTASKS);
  const fetchSubtasks = useTaskStore((s) => s.fetchSubtasks);
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localNote, setLocalNote] = useState(task.note);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [sections, setSections] = useState(loadCardSections);

  const titleTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Track container width to trigger Framer Motion layout updates
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync local state when task identity changes
  useEffect(() => {
    setLocalTitle(task.title);
    setLocalNote(task.note);
  }, [task.id]);

  // Listen for settings changes
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "planly-card-sections") setSections(loadCardSections());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Fetch reminders
  useEffect(() => {
    if (sections.reminders) {
      api.getReminders(task.id).then(setReminders).catch((e) => { console.error("Failed to fetch reminders:", e); });
    }
  }, [task.id, sections.reminders]);

  const saveTitle = useCallback((value: string) => {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => onEdit({ id: task.id, title: value }), 500);
  }, [task.id, onEdit]);

  const saveNote = useCallback((value: string) => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => onEdit({ id: task.id, note: value }), 500);
  }, [task.id, onEdit]);

  // Clear pending timers on unmount (no flush to avoid stale writes)
  useEffect(() => {
    return () => {
      if (titleTimer.current) { clearTimeout(titleTimer.current); titleTimer.current = null; }
      if (noteTimer.current) { clearTimeout(noteTimer.current); noteTimer.current = null; }
    };
  }, []);

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    const created = await api.createTask({
      group_id: task.group_id,
      parent_id: task.id,
      title: newSubtaskTitle.trim(),
    });
    setNewSubtaskTitle("");
    await fetchSubtasks(task.id);
    onSubtaskCreated?.(created);
  };

  const priorityLabel = (p: string) =>
    p === "p0" ? __("priority.urgent") :
    p === "p1" ? __("priority.high") :
    p === "p2" ? __("priority.medium") :
    p === "p3" ? __("priority.low") : "";

  const priorityColor = (p: string) =>
    p === "p0" ? "bg-priority-p0" :
    p === "p1" ? "bg-priority-p1" :
    p === "p2" ? "bg-priority-p2" :
    p === "p3" ? "bg-priority-p3" : "";

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Title */}
      <Input
        value={localTitle}
        onChange={(e) => { setLocalTitle(e.target.value); saveTitle(e.target.value); }}
        className="font-semibold text-sm"
      />

      {/* Status + Priority + Group + Date + Time */}
      <div>
        <div className="flex gap-1.5 flex-wrap">
        {sections.group && (
          <motion.div key={`group-${containerWidth}`} layout transition={{ duration: 0.2, ease: "easeOut" }}>
          <Popover>
            <PopoverTrigger>
              <button className="flex items-center gap-1.5 h-7 px-2 rounded-lg border border-input text-xs hover:border-primary/50 transition-colors">
                {(() => { const g = groups.find((x) => x.id === task.group_id); const Icon = g ? (GROUP_ICONS[g.icon] || FALLBACK_GROUP_ICON) : FALLBACK_GROUP_ICON; return <><Icon size={13} style={{ color: g?.color }} />{g?.name}</>; })()}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1.5" align="start" sideOffset={4}>
              {groups.map((g) => { const Icon = GROUP_ICONS[g.icon] || FALLBACK_GROUP_ICON;
                return <button key={g.id} onClick={() => onEdit({ id: task.id, group_id: g.id })} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${task.group_id === g.id ? "bg-muted font-medium" : ""}`}><Icon size={13} style={{ color: g.color }} />{g.name}</button>;
              })}
            </PopoverContent>
          </Popover>
          </motion.div>
        )}

        <motion.div key={`status-${containerWidth}`} layout transition={{ duration: 0.2, ease: "easeOut" }}>
        <Popover>
          <PopoverTrigger>
            <button className="flex items-center gap-1.5 h-7 px-2 rounded-lg border border-input text-xs hover:border-primary/50 transition-colors">
              {task.status === "in_progress" ? <><CircleDot size={14} className="text-status-in_progress" />{__("status.inProgress")}</> :
               task.status === "done" ? <><CircleCheck size={14} className="text-status-done" />{__("status.done")}</> :
               <><Circle size={14} className="text-muted-foreground" />{__("status.todo")}</>}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-1.5" align="start" sideOffset={4}>
            {(["todo","in_progress","done"] as const).map(s => (
              <button key={s} onClick={() => onEdit({ id: task.id, status: s })} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${task.status === s ? "bg-muted font-medium" : ""}`}>
                {s === "in_progress" ? <CircleDot size={14} className="text-status-in_progress" /> : s === "done" ? <CircleCheck size={14} className="text-status-done" /> : <Circle size={14} className="text-muted-foreground" />}{__(`status.${s === "in_progress" ? "inProgress" : s}`)}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        </motion.div>

        <motion.div key={`priority-${containerWidth}`} layout transition={{ duration: 0.2, ease: "easeOut" }}>
        <Popover>
          <PopoverTrigger>
            <button className="flex items-center gap-1.5 h-7 px-2 rounded-lg border border-input text-xs hover:border-primary/50 transition-colors">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${priorityColor(task.priority)}`} />
              {priorityLabel(task.priority)}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-1.5" align="start" sideOffset={4}>
            {(["p0","p1","p2","p3"] as const).map(p => (
              <button key={p} onClick={() => onEdit({ id: task.id, priority: p })} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${task.priority === p ? "bg-muted font-medium" : ""}`}>
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${priorityColor(p)}`} />{priorityLabel(p)}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        </motion.div>

        {sections.dateTime && (
          <>
            <motion.div key={`date-${containerWidth}`} layout transition={{ duration: 0.2, ease: "easeOut" }}>
            <Popover>
              <PopoverTrigger>
                <button className={`flex items-center gap-1 h-7 px-2 rounded-lg border border-input text-xs transition-colors hover:border-primary/50 ${task.due_date ? "text-foreground" : "text-muted-foreground"}`}>
                  <Calendar size={12} className="flex-shrink-0" />
                  {task.due_date ? format(new Date(task.due_date), lang === "zh" ? "M月d日" : "MMM d") : __("taskForm.setDate")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" sideOffset={6} collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}>
                <CalendarPicker
                  mode="single"
                  selected={task.due_date ? new Date(task.due_date) : undefined}
                  onSelect={(date) => onEdit({ id: task.id, due_date: date ? format(date, "yyyy-MM-dd") : "" })}
                />
                {task.due_date && (
                  <div className="px-4 pb-3">
                    <button onClick={() => onEdit({ id: task.id, due_date: "" })} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                      {__("taskForm.clearDate")}
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            </motion.div>
            <motion.div key={`time-${containerWidth}`} layout transition={{ duration: 0.2, ease: "easeOut" }}>
            {sections.time && (
            <Popover>
              <PopoverTrigger>
                <button className={`flex items-center gap-1 h-7 px-2 rounded-lg border border-input text-xs transition-colors hover:border-primary/50 ${task.due_time ? "text-foreground" : "text-muted-foreground"}`}>
                  <AlarmClock size={12} className="flex-shrink-0" />
                  {task.due_time || __("taskForm.setTime")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-3" align="start" sideOffset={6} collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}>
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold">
                    <button onClick={() => { const cur = task.due_time ? parseInt(task.due_time.split(":")[0]) : 9; onEdit({ id: task.id, due_time: `${String((cur - 1 + 24) % 24).padStart(2, "0")}:${task.due_time ? task.due_time.split(":")[1] : "00"}` }); }} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">−</button>
                    <span className="w-10 text-center tabular-nums">{task.due_time ? task.due_time.split(":")[0] : "09"}</span>
                    <button onClick={() => { const cur = task.due_time ? parseInt(task.due_time.split(":")[0]) : 9; onEdit({ id: task.id, due_time: `${String((cur + 1) % 24).padStart(2, "0")}:${task.due_time ? task.due_time.split(":")[1] : "00"}` }); }} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">+</button>
                    <span className="mx-0.5 text-muted-foreground">:</span>
                    <button onClick={() => { const parts = task.due_time ? task.due_time.split(":") : ["09", "00"]; onEdit({ id: task.id, due_time: `${parts[0]}:${String((parseInt(parts[1]) - 5 + 60) % 60).padStart(2, "0")}` }); }} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">−</button>
                    <span className="w-10 text-center tabular-nums">{task.due_time ? task.due_time.split(":")[1] : "00"}</span>
                    <button onClick={() => { const parts = task.due_time ? task.due_time.split(":") : ["09", "00"]; onEdit({ id: task.id, due_time: `${parts[0]}:${String((parseInt(parts[1]) + 5) % 60).padStart(2, "0")}` }); }} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">+</button>
                  </div>
                  {task.due_time && (
                    <button onClick={() => onEdit({ id: task.id, due_time: "" })} className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors">{__("taskForm.clearTime")}</button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            )}
            <motion.div key={`recurrence-${containerWidth}`} layout transition={{ duration: 0.2, ease: "easeOut" }}>
            {sections.recurrence && (
            <Popover>
              <PopoverTrigger>
                <button className="flex items-center gap-1.5 h-7 px-2 rounded-lg border border-input text-xs hover:border-primary/50 transition-colors">
                  <Repeat size={12} className="text-muted-foreground" />
                  {task.recurrence === "daily" ? __("taskForm.recurrenceDaily") :
                   task.recurrence === "weekly" ? __("taskForm.recurrenceWeekly") :
                   task.recurrence === "monthly" ? __("taskForm.recurrenceMonthly") :
                   __("taskForm.recurrenceNone")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1.5" align="start" sideOffset={4}>
                {(["none","daily","weekly","monthly"] as const).map(r => (
                  <button key={r} onClick={() => onEdit({ id: task.id, recurrence: r === "none" ? "" : r })} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${(task.recurrence || "none") === r ? "bg-muted font-medium" : ""}`}>
                    {r === "daily" ? __("taskForm.recurrenceDaily") : r === "weekly" ? __("taskForm.recurrenceWeekly") : r === "monthly" ? __("taskForm.recurrenceMonthly") : __("taskForm.recurrenceNone")}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            )}
            </motion.div>
            </motion.div>
          </>
        )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <div className="text-[10px] text-text-muted mb-1">{__("detail.notes")}</div>
        <NoteEditor
          value={localNote}
          onChange={(v) => { setLocalNote(v); saveNote(v); }}
          placeholder={__("detail.notesPlaceholder")}
        />
      </div>

      {/* Reminders (optional) */}
      {sections.reminders && (
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
              <button onClick={async () => { await api.snoozeReminder(r.id); const updated = await api.getReminders(task.id); setReminders(updated); }} className="text-muted-foreground hover:text-foreground opacity-0 group-hover/rem:opacity-100 transition-opacity" title={__("reminder.snoozeBtn")}><Clock size={11} /></button>
              <button onClick={async () => { await api.deleteReminder(r.id); const updated = await api.getReminders(task.id); setReminders(updated); }} className="text-muted-foreground hover:text-destructive opacity-0 group-hover/rem:opacity-100 transition-opacity"><X size={12} /></button>
            </div>
          ))}
          <button onClick={() => setReminderDialogOpen(true)} className="text-[10px] text-brand hover:text-brand-dark flex items-center gap-1">
            <Plus size={12} /> {__("detail.addReminder")}
          </button>
        </div>
      )}

      {/* Subtasks */}
      <div>
        <div className="text-[10px] text-text-muted mb-2">
          {__("detail.subtasks")} ({subtasks.filter((s) => s.status === "done").length}/{subtasks.length})
        </div>
        <div className="space-y-1.5 ml-1 border-l-2 border-border/30 pl-2 rounded-bl-lg">
          {subtasks.map((st) => (
            <SubtaskItem
              key={st.id}
              task={st}
              depth={0}
              onDeleted={onSubtaskDeleted}
              onToggle={(t, newStatus) => (onSubtaskEdit || onEdit)({ id: t.id, status: newStatus })}
              onEdit={onSubtaskEdit || onEdit}
            />
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
          <button onClick={handleAddSubtask} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-primary rounded transition-colors">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Activity (optional) */}
      {sections.activity && (
        <div>
          <div className="text-[10px] text-text-muted mb-1">{__("detail.activity")}</div>
          <div className="text-[10px] text-text-muted">{__("detail.created")} {new Date(task.created_at).toLocaleDateString()}</div>
          {task.completed_at && (
            <div className="text-[10px] text-text-muted">{__("detail.completed")} {new Date(task.completed_at).toLocaleDateString()}</div>
          )}
        </div>
      )}

      {/* Reminder dialog */}
      <ReminderFormDialog
        open={reminderDialogOpen}
        onOpenChange={setReminderDialogOpen}
        taskId={task.id}
        onCreated={() => api.getReminders(task.id).then(setReminders)}
      />
    </div>
  );
}
