import { useState } from "react";
import { Plus, ArrowUpDown, CheckSquare, Archive } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Sidebar from "./Sidebar";
import TitleBar from "./TitleBar";
import ListView from "../views/ListView";
import KanbanView from "../views/KanbanView";
import CalendarView from "../views/CalendarView";

import TaskFormDialog from "../tasks/TaskFormDialog";
import TaskDetailDrawer from "../tasks/TaskDetailDrawer";
import SettingsPage from "../settings/SettingsPage";
import UndoToast from "./UndoToast";
import { useUIStore } from "../../stores/uiStore";
import { useTaskStore } from "../../stores/taskStore";
import { useT } from "../../i18n/translations";

export default function AppLayout() {
  const currentView = useUIStore((s) => s.currentView);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const quickAddOpen = useUIStore((s) => s.quickAddOpen);
  const setQuickAddOpen = useUIStore((s) => s.setQuickAddOpen);
  const filterTodayOnly = useUIStore((s) => s.filterTodayOnly);
  const setFilterTodayOnly = useUIStore((s) => s.setFilterTodayOnly);
  const sortBy = useUIStore((s) => s.sortBy);
  const setSortBy = useUIStore((s) => s.setSortBy);
  const selectMode = useUIStore((s) => s.selectMode);
  const setSelectMode = useUIStore((s) => s.setSelectMode);
  const archiveCompleted = useTaskStore((s) => s.archiveCompleted);
  const tasks = useTaskStore((s) => s.tasks);
  const showArchived = useUIStore((s) => s.showArchived);
  const [showSettings, setShowSettings] = useState(false);

  const { __ } = useT();
  const viewTitle = { list: __("view.tasks"), kanban: __("view.kanban"), calendar: __("view.calendar") }[currentView];

  return (
    <div className="flex flex-col h-screen bg-surface-muted">
      <TitleBar />
      <div className="flex flex-1 min-h-0 px-2 pt-0 pb-8 gap-2">
        <div className={`transition-all duration-300 ease-out overflow-x-hidden overflow-y-visible shrink-0 ${sidebarOpen ? "w-[256px] opacity-100" : "w-0 opacity-0"}`}>
          <div className="relative w-[256px] h-full">
            <Sidebar
                onSettings={() => setShowSettings(true)}
                onNavigate={() => setShowSettings(false)}
              />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0 rounded-xl bg-sidebar/50 overflow-y-auto stable-scroll">
          {showSettings ? (
            <div className="flex-1 overflow-auto px-6 py-5">
              <SettingsPage onBack={() => setShowSettings(false)} />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-foreground tracking-tight">{viewTitle}</h1>
                  {currentView !== "calendar" && (
                  <Popover>
                    <PopoverTrigger className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={__("sort.label")}>
                      <ArrowUpDown size={14} />
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-1.5" align="start" sideOffset={8}>
                      {([
                        { v: "manual", l: "sort.manual" },
                        { v: "due_date_asc", l: "sort.dueDateAsc" },
                        { v: "due_date_desc", l: "sort.dueDateDesc" },
                        { v: "priority", l: "sort.priority" },
                        { v: "title_asc", l: "sort.titleAsc" },
                        { v: "created_desc", l: "sort.createdDesc" },
                      ] as const).map(({ v, l }) => (
                        <button
                          key={v}
                          onClick={() => setSortBy(v)}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors ${sortBy === v ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                        >
                          {__(l)}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  )}
                  {filterTodayOnly && (
                    <button
                      onClick={() => setFilterTodayOnly(false)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand/10 text-brand text-[11px] font-medium hover:bg-brand/20 transition-colors"
                    >
                      Today
                      <span className="ml-1 opacity-50">×</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                {!showArchived && tasks.some(t => t.status === "done") && (
                  <button
                    onClick={() => {
                      const doneIds = tasks.filter(t => t.status === "done").map(t => t.id);
                      if (doneIds.length === 0) return;
                      // Add exiting animation
                      useUIStore.setState(s => {
                        const next = new Set(s.exitingTaskIds);
                        doneIds.forEach(id => next.add(id));
                        return { exitingTaskIds: next };
                      });
                      // Archive after animation completes
                      setTimeout(async () => {
                        await archiveCompleted();
                        // Clean up exiting IDs
                        useUIStore.setState(s => {
                          const next = new Set(s.exitingTaskIds);
                          doneIds.forEach(id => next.delete(id));
                          return { exitingTaskIds: next };
                        });
                      }, 400);
                    }}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-primary/30 text-xs text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Archive size={13} />
                    {__("view.archiveDone")}
                    <span className="ml-0.5 opacity-60">{tasks.filter(t => t.status === "done").length}</span>
                  </button>
                )}
                {currentView !== "calendar" && (
                <button
                  onClick={() => setSelectMode(!selectMode)}
                  className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border text-xs transition-colors ${selectMode ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"}`}
                >
                  <CheckSquare size={13} />
                  {__("view.select")}
                </button>
                )}
                <button
                  onClick={() => setQuickAddOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[13px] font-medium rounded-xl hover:opacity-90 transition-all shadow-sm antialiased"
                >
                  <Plus size={16} />
                  {__("view.newTask")}
                </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 px-6 pb-5" key={currentView}>
                {currentView === "list" ? <ListView /> :
                 currentView === "kanban" ? <KanbanView /> :
                 <CalendarView />}
              </div>
            </>
          )}
        </div>
      </div>
      <TaskDetailDrawer />
      <TaskFormDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} />
      <UndoToast />
    </div>
  );
}
