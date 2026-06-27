import { useState } from "react";
import { Plus } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useT } from "../../i18n/translations";
import TaskFormDialog from "../tasks/TaskFormDialog";

export default function TopBar() {
  const { __ } = useT();
  const currentView = useUIStore((s) => s.currentView);
  const viewTitles: Record<string, string> = {
    list: __("view.tasks"), kanban: __("view.kanban"), calendar: __("view.calendar"),
  };
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  return (
    <>
      <div className="h-12 flex items-center px-5 gap-4 bg-background/80 backdrop-blur-sm">
        <h1 className="font-semibold text-sm text-text tracking-tight">{viewTitles[currentView]}</h1>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setNewTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-[13px] font-medium rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            <Plus size={15} />
            {__("view.newTask")}
          </button>
        </div>
      </div>
      <TaskFormDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
    </>
  );
}
