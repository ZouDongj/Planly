import { useState, useMemo, memo } from "react";
import { ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { useTaskStore } from "../../stores/taskStore";
import { useUIStore } from "../../stores/uiStore";
import { useT } from "../../i18n/translations";
import { getPriorityColor, getPriorityBgColor } from "../../lib/utils";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths, isToday,
} from "date-fns";

export default memo(function CalendarView() {
  const tasks = useTaskStore((s) => s.tasks);
  const selectTask = useTaskStore((s) => s.selectTask);
  const openDrawer = useUIStore((s) => s.openDrawer);
  const { __ } = useT();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const dayNames = useMemo(() => [
    __("calendar.sun"), __("calendar.mon"), __("calendar.tue"),
    __("calendar.wed"), __("calendar.thu"), __("calendar.fri"), __("calendar.sat"),
  ], [__]);

  const selectedDayTasks = useMemo(() => {
    if (!selectedDate) return [];
    return tasks.filter((t) => t.due_date && isSameDay(new Date(t.due_date), selectedDate));
  }, [tasks, selectedDate]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date;
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const goToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col">
      {tasks.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">{__("calendar.noTasksAll")}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-muted rounded-md transition-colors">
            <ChevronLeft size={16} className="text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground w-36 text-center">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-muted rounded-md transition-colors">
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="text-[11px] text-brand hover:text-brand-dark font-medium transition-colors px-2 py-1 rounded-md hover:bg-brand/5"
        >
          {__("calendar.todayBtn")}
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border border-border/20">
        <div className="grid grid-cols-7 bg-muted/30 border-b border-border/15">
          {dayNames.map((d) => (
            <div key={d} className="text-center text-[10px] text-muted-foreground py-2 font-medium tracking-wide">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDate.get(dateKey) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={[
                "bg-card min-h-[72px] p-1.5 text-left transition-colors hover:bg-muted/30 border-b border-r border-border/10",
                inMonth && "border-border/15",
                !inMonth && "opacity-30",
                isSelected && "ring-2 ring-inset ring-brand/60 bg-brand/5",
              ].filter(Boolean).join(" ")}
            >
              <span
                className={[
                  "text-[11px] inline-flex items-center justify-center w-5 h-5 rounded-full font-medium",
                  today && "bg-brand text-white",
                  !today && !isSelected && "text-muted-foreground",
                  !today && isSelected && "text-brand",
                ].filter(Boolean).join(" ")}
              >
                {format(day, "d")}
              </span>
              <div className="space-y-0.5 mt-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectTask(t);
                      openDrawer();
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded-md cursor-pointer hover:ring-1 hover:ring-border transition-all truncate flex items-center gap-1"
                    style={{
                      backgroundColor: getPriorityBgColor(t.priority),
                      color: getPriorityColor(t.priority),
                    }}
                  >
                    <Circle size={6} className="flex-shrink-0" fill="currentColor" stroke="none" />
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[9px] text-muted-foreground pl-1.5 font-medium">
                    +{dayTasks.length - 3} {__("calendar.more")}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        </div>
      </div>

      {selectedDate && (
        <div className="mt-4 bg-card rounded-xl border border-border/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-semibold text-foreground">
                {format(selectedDate, "MMM d")}
              </span>
              {isToday(selectedDate) && (
                <span className="ml-2 text-[10px] text-brand font-medium">{__("calendar.todayBadge")}</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {selectedDayTasks.length} {__("calendar.taskCount")}
            </span>
          </div>
          {selectedDayTasks.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 italic py-2">
              {__("calendar.noTasks")}
            </div>
          ) : (
            <div className="space-y-1">
              {selectedDayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { selectTask(t); openDrawer(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getPriorityColor(t.priority) }}
                  />
                  <span className="text-[13px] text-foreground truncate flex-1 group-hover:text-brand transition-colors">
                    {t.title}
                  </span>
                  {t.status === "done" && (
                    <span className="text-[10px] text-status-done font-medium">{__("calendar.done")}</span>
                  )}
                  {t.due_time && (
                    <span className="text-[10px] text-muted-foreground">{t.due_time}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
