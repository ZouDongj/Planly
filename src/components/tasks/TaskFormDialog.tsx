import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Calendar, ChevronDown, Repeat } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import NoteEditor from "../notes/NoteEditor";
import { format } from "date-fns";
import { useTaskStore } from "../../stores/taskStore";
import { useGroupStore } from "../../stores/groupStore";
import { useUIStore } from "../../stores/uiStore";
import { useT } from "../../i18n/translations";
import type { Task } from "../../lib/types";
import { getPriorityColor, isUngroupedGroup } from "../../lib/utils";

const PRIORITY_LABELS: Record<string, string> = {
  p0: "priority.urgent",
  p1: "priority.high",
  p2: "priority.medium",
  p3: "priority.low",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (task: Task) => void;
}

export default function TaskFormDialog({ open, onOpenChange, onCreated }: Props) {
  const { __, lang } = useT();
  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState("");
  const [priority, setPriority] = useState("p2");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [groupPopOpen, setGroupPopOpen] = useState(false);
  const [priorityPopOpen, setPriorityPopOpen] = useState(false);
  const [recurrence, setRecurrence] = useState<string>("none");
  const addTask = useTaskStore((s) => s.addTask);
  const addGroup = useGroupStore((s) => s.addGroup);
  const cardSections = useUIStore((s) => s.cardSections);
  const groups = useGroupStore((s) => s.groups);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    const group = await addGroup(name);
    setGroupId(group.id);
    setNewGroupName("");
    setCreatingGroup(false);
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setPriority("p2");
      setDueDate("");
      setDueTime("");
      setRecurrence("none");
      setNote("");
      // Auto-select first group if available
      if (groups.length > 0) {
        setGroupId(groups[0].id);
      } else {
        setGroupId("");
      }
    }
  }, [open, groups]);

  const handleSubmit = async () => {
    if (!title.trim()) { setError(__("taskForm.titleRequired")); return; }
    if (!groupId) { setError(__("taskForm.groupRequired")); return; }
    setError("");
    const created = await addTask({ group_id: groupId, title: title.trim(), priority, due_date: dueDate || undefined, due_time: dueTime || undefined, note: note.replace(/<[^>]*>/g, '').trim() ? note.trim() : undefined, recurrence: recurrence === "none" ? "" : recurrence });
    setTitle("");
    onOpenChange(false);
    onCreated?.(created);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{__("taskForm.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input maxLength={200} placeholder={__("taskForm.titlePlaceholder")} value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }} autoFocus />
          <div className="flex gap-2">
            {groups.length === 0 ? (
              <button onClick={() => setCreatingGroup(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary/30 transition-colors">
                <Plus size={12} />{__("taskForm.newGroup")}
              </button>
            ) : (
              <Popover open={groupPopOpen} onOpenChange={setGroupPopOpen}>
                <PopoverTrigger>
                  <button className="flex items-center justify-between gap-1.5 h-8 px-3 rounded-lg border border-border text-xs hover:border-primary/30 transition-colors">
                    <span className={groupId ? "text-foreground" : "text-muted-foreground"}>
                      {(() => { const name = groups.find(g => g.id === groupId)?.name; return isUngroupedGroup(name || "") ? __("sidebar.ungrouped") : (name || __("taskForm.select")); })()}
                    </span>
                    <ChevronDown size={12} className="text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1.5" align="start" sideOffset={4}>
                  {groups.map((g) => (
                    <button key={g.id} onClick={() => { setGroupId(g.id); setGroupPopOpen(false); }} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${groupId === g.id ? "bg-muted font-medium" : ""}`}>
                      {g.name}
                    </button>
                  ))}
                  <div className="my-0.5 border-t border-border" />
                  {creatingGroup ? (
                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                      <input className="flex-1 min-w-0 text-xs h-7 rounded-md border border-border px-2 bg-transparent outline-none" placeholder={__("taskForm.newGroupName")} value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); if (e.key === "Escape") { setCreatingGroup(false); setNewGroupName(""); } }} autoFocus />
                      <button onClick={handleCreateGroup} className="text-xs text-primary hover:text-primary/80 font-medium whitespace-nowrap px-1">{__("taskForm.create")}</button>
                    </div>
                  ) : (
                    <button onClick={() => setCreatingGroup(true)} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Plus size={14} />{__("taskForm.newGroup")}
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            )}
            <Popover>
              <PopoverTrigger>
                <button className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary/30 transition-colors whitespace-nowrap">
                  <Calendar size={13} />
                  {dueDate ? format(new Date(dueDate), lang === "zh" ? "M月d日" : "MMM d") : __("taskForm.dueDate")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
                <CalendarPicker mode="single" selected={dueDate ? new Date(dueDate) : undefined} onSelect={(date) => setDueDate(date ? format(date, "yyyy-MM-dd") : "")} />
                {dueDate && (
                  <div className="flex items-center gap-2 px-4 pb-3">
                    <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="text-xs h-7 border border-border rounded-md px-2 bg-transparent" />
                    <button onClick={() => { setDueDate(""); setDueTime(""); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">{__("taskForm.clear")}</button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <Popover open={priorityPopOpen} onOpenChange={setPriorityPopOpen}>
              <PopoverTrigger>
                <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs hover:border-primary/30 transition-colors">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getPriorityColor(priority) }} />
                  {__(PRIORITY_LABELS[priority] || "priority.medium")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1.5" align="start" sideOffset={4}>
                {(["p0","p1","p2","p3"] as const).map(p => (
                  <button key={p} onClick={() => { setPriority(p); setPriorityPopOpen(false); }} className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${priority === p ? "bg-muted font-medium" : ""}`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getPriorityColor(p) }} />{__(PRIORITY_LABELS[p])}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {cardSections.recurrence && (
            <Select value={recurrence} onValueChange={(v) => { if (v) setRecurrence(v); }}>
              <SelectTrigger className="w-auto text-xs h-8 gap-1">
                <Repeat size={12} />
                {recurrence === "daily" ? __("taskForm.recurrenceDaily") :
                 recurrence === "weekly" ? __("taskForm.recurrenceWeekly") :
                 recurrence === "monthly" ? __("taskForm.recurrenceMonthly") :
                 __("taskForm.recurrenceNone")}
              </SelectTrigger>
              <SelectContent align="start" sideOffset={6}>
                <SelectItem value="none">{__("taskForm.recurrenceNone")}</SelectItem>
                <SelectItem value="daily">{__("taskForm.recurrenceDaily")}</SelectItem>
                <SelectItem value="weekly">{__("taskForm.recurrenceWeekly")}</SelectItem>
                <SelectItem value="monthly">{__("taskForm.recurrenceMonthly")}</SelectItem>
              </SelectContent>
            </Select>
            )}
          </div>
          <NoteEditor value={note} onChange={setNote} placeholder={__("taskForm.notesOpt")} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button onClick={handleSubmit} disabled={groups.length === 0 || !groupId} className="w-full">{__("taskForm.createTask")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
