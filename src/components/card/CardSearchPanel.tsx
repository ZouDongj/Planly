import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import * as api from "../../lib/commands";
import type { Task } from "../../lib/types";
import { useT } from "../../i18n/translations";

interface Props {
  onSelect: (task: Task) => void;
  onClose: () => void;
}

export default function CardSearchPanel({ onSelect, onClose }: Props) {
  const { __ } = useT();
  const [query, setQuery] = useState("");
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getAllTasksFlat().then((all) => {
      // Only show top-level tasks (no parent_id) — subtasks can't be opened
      // as standalone cards because the card window only fetches top-level tasks.
      setAllTasks(all.filter(t => !t.parent_id));
    }).catch((e) => { console.error("Failed to fetch all tasks:", e); });
    inputRef.current?.focus();
  }, []);

  const filtered = query.trim()
    ? allTasks
        .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 50)
    : allTasks.slice(0, 50);

  const priorityColor = (p: string) =>
    p === "p0" ? "bg-priority-p0" :
    p === "p1" ? "bg-priority-p1" :
    p === "p2" ? "bg-priority-p2" :
    p === "p3" ? "bg-priority-p3" : "";

  const statusColor = (s: string) =>
    s === "done" ? "bg-status-done" :
    s === "in_progress" ? "bg-status-in_progress" : "bg-status-todo";

  return (
    <div className="border-b border-border/30 bg-surface-muted">
      <div className="px-3 py-2 flex items-center gap-2">
        <Search size={13} className="text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={__("card.searchTasks")}
          className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"
        />
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={13} />
        </button>
      </div>
      {filtered.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-t border-border/20">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors text-left"
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor(t.status)}`} />
              <span className={`flex-1 min-w-0 truncate ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {t.title}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityColor(t.priority)}`} />
            </button>
          ))}
        </div>
      )}
      {query.trim() && filtered.length === 0 && (
        <div className="px-3 py-4 text-xs text-muted-foreground text-center">
          {__("card.noResults")}
        </div>
      )}
    </div>
  );
}
