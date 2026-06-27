import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { useTaskStore } from "../../stores/taskStore";
import { useT } from "../../i18n/translations";

export default function UndoToast() {
  const pendingDeletes = useTaskStore((s) => s.pendingDeletes);
  const undoRemoveTask = useTaskStore((s) => s.undoRemoveTask);
  const { __ } = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pendingDeletes.size > 0) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [pendingDeletes.size]);

  if (!visible || pendingDeletes.size === 0) return null;

  const taskIds = Array.from(pendingDeletes.keys());
  const count = taskIds.length;

  const handleUndo = () => {
    taskIds.forEach((id) => undoRemoveTask(id));
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-3 bg-card border border-border shadow-lg rounded-xl px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">
          {count === 1 ? __("undo.taskDeleted") : __("undo.tasksDeleted").replace("{n}", String(count))}
        </span>
        <button
          onClick={handleUndo}
          className="inline-flex items-center gap-1.5 text-brand hover:text-brand-light font-medium transition-colors"
        >
          <Undo2 size={14} />
          {__("undo.undo")}
        </button>
      </div>
    </div>
  );
}
