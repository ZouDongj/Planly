import { useState } from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import * as api from "../../lib/commands";
import { useT } from "../../i18n/translations";

const REMINDER_TYPE_KEYS = [
  { value: "due_date", labelKey: "reminder.dueDate", descKey: "reminder.dueDateDesc", icon: "⏰" },
  { value: "recurring", labelKey: "reminder.recurring", descKey: "reminder.recurringDesc", icon: "🔄" },
  { value: "one_time", labelKey: "reminder.oneTime", descKey: "reminder.oneTimeDesc", icon: "📅" },
];

const ADVANCE_OPTION_KEYS = [
  { value: 5, key: "reminder.5minBefore" },
  { value: 15, key: "reminder.15minBefore" },
  { value: 30, key: "reminder.30minBefore" },
  { value: 60, key: "reminder.1hourBefore" },
  { value: 120, key: "reminder.2hoursBefore" },
  { value: 1440, key: "reminder.1dayBefore" },
  { value: 0, key: "reminder.atDueTime" },
];

const RECUR_PRESET_KEYS = [
  { value: "0 9 * * *", key: "reminder.daily9am" },
  { value: "0 9 * * 1", key: "reminder.everyMonday9am" },
  { value: "0 9 1 * *", key: "reminder.firstOfMonth9am" },
  { value: "0 9 * * 1-5", key: "reminder.weekdays9am" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  onCreated: () => void;
}

export default function ReminderFormDialog({ open, onOpenChange, taskId, onCreated }: Props) {
  const { __, lang } = useT();
  const [reminderType, setReminderType] = useState("due_date");
  const [advanceMinutes, setAdvanceMinutes] = useState(30);
  const [repeatRule, setRepeatRule] = useState("0 9 * * *");
  const [remindDate, setRemindDate] = useState("");
  const [remindTime, setRemindTime] = useState("09:00");
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const base: Parameters<typeof api.createReminder>[0] = {
        task_id: taskId,
        reminder_type: reminderType,
        snooze_minutes: snoozeMinutes,
      };

      if (reminderType === "due_date") {
        base.advance_minutes = advanceMinutes;
      } else if (reminderType === "recurring") {
        base.repeat_rule = repeatRule;
      } else if (reminderType === "one_time") {
        if (remindDate && remindTime) {
          base.remind_at = new Date(`${remindDate}T${remindTime}`).toISOString();
        }
      }

      await api.createReminder(base);
      onCreated();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-sm">{__("reminder.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Type selector */}
          <div>
            <div className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">{__("reminder.type")}</div>
            <div className="space-y-1.5">
              {REMINDER_TYPE_KEYS.map((t) => (
                <label
                  key={t.value}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${
                    reminderType === t.value
                      ? "border-brand bg-indigo-50/50"
                      : "border-border hover:border-brand/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="reminderType"
                    value={t.value}
                    checked={reminderType === t.value}
                    onChange={(e) => setReminderType(e.target.value)}
                    className="accent-brand w-3.5 h-3.5"
                  />
                  <div>
                    <div className="text-xs font-medium text-text">
                      {t.icon} {__(t.labelKey)}
                    </div>
                    <div className="text-[10px] text-text-muted">{__(t.descKey)}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Due date config */}
          {reminderType === "due_date" && (
            <div>
              <div className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">{__("reminder.alertTiming")}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {ADVANCE_OPTION_KEYS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setAdvanceMinutes(o.value)}
                    className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                      advanceMinutes === o.value
                        ? "border-brand bg-indigo-50 text-brand font-medium"
                        : "border-border text-text-muted hover:border-brand/30"
                    }`}
                  >
                    {__(o.key)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recurring config */}
          {reminderType === "recurring" && (
            <div>
              <div className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">{__("reminder.repeatSchedule")}</div>
              <div className="space-y-1.5">
                {RECUR_PRESET_KEYS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setRepeatRule(p.value)}
                    className={`w-full text-xs px-3 py-1.5 rounded-md border transition-colors text-left ${
                      repeatRule === p.value
                        ? "border-brand bg-indigo-50 text-brand font-medium"
                        : "border-border text-text-muted hover:border-brand/30"
                    }`}
                  >
                    {__(p.key)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* One-time config */}
          {reminderType === "one_time" && (
            <div>
              <div className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">{__("reminder.dateTime")}</div>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger>
                    <button className={`flex-1 flex items-center gap-2 h-8 px-3 rounded-lg border border-input text-xs transition-colors hover:border-primary/50 ${remindDate ? "text-foreground" : "text-muted-foreground"}`}>
                      <CalendarIcon size={13} className="flex-shrink-0" />
                      {remindDate ? format(new Date(remindDate), lang === "zh" ? "yyyy年M月d日" : "MMM d, yyyy") : __("reminder.pickDate")}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" side="bottom" sideOffset={6} align="start" collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}>
                    <CalendarPicker
                      mode="single"
                      selected={remindDate ? new Date(remindDate) : undefined}
                      onSelect={(date) => setRemindDate(date ? format(date, "yyyy-MM-dd") : "")}
                    />
                    {remindDate && (
                      <div className="px-4 pb-3">
                        <button
                          onClick={() => setRemindDate("")}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          {__("reminder.clear")}
                        </button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger>
                    <button className={`w-28 flex items-center gap-2 h-8 px-3 rounded-lg border border-input text-xs transition-colors hover:border-primary/50 ${remindTime ? "text-foreground" : "text-muted-foreground"}`}>
                      <Clock size={13} className="flex-shrink-0" />
                      {remindTime || "09:00"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-3" side="bottom" sideOffset={6} align="start" collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}>
                    <div className="flex items-center justify-center gap-1 text-lg font-semibold">
                      <button
                        onClick={() => setRemindTime(`${String((parseInt(remindTime.split(":")[0]) - 1 + 24) % 24).padStart(2, "0")}:${remindTime.split(":")[1]}`)}
                        className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        −
                      </button>
                      <span className="w-8 text-center tabular-nums">{remindTime.split(":")[0]}</span>
                      <button
                        onClick={() => setRemindTime(`${String((parseInt(remindTime.split(":")[0]) + 1) % 24).padStart(2, "0")}:${remindTime.split(":")[1]}`)}
                        className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        +
                      </button>
                      <span className="mx-0.5 text-muted-foreground">:</span>
                      <button
                        onClick={() => setRemindTime(`${remindTime.split(":")[0]}:${String((parseInt(remindTime.split(":")[1]) - 5 + 60) % 60).padStart(2, "0")}`)}
                        className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        −
                      </button>
                      <span className="w-8 text-center tabular-nums">{remindTime.split(":")[1]}</span>
                      <button
                        onClick={() => setRemindTime(`${remindTime.split(":")[0]}:${String((parseInt(remindTime.split(":")[1]) + 5) % 60).padStart(2, "0")}`)}
                        className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Snooze */}
          <div>
            <div className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">{__("reminder.snooze")}</div>
            <Input
              type="number"
              min={1}
              max={60}
              value={snoozeMinutes}
              onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
              className="text-xs h-8 w-24"
            />
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full text-xs">
            {loading ? __("reminder.adding") : __("reminder.add")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
