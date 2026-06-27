import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import AppLayout from "./components/layout/AppLayout";
import FloatingCard from "./components/card/FloatingCard";
import { useGroupStore } from "./stores/groupStore";
import { useTaskStore } from "./stores/taskStore";
import { useUIStore } from "./stores/uiStore";
import { useT } from "./i18n/translations";
import { setupCardEventListeners } from "./lib/cardWindows";

function loadShortcut(): string {
  return localStorage.getItem("planly-shortcut-sidebar") || "Ctrl+b";
}

export default function App() {
  // Card mode: detect URL params and render FloatingCard instead of AppLayout
  const params = new URLSearchParams(window.location.search);
  const cardTaskId = params.get("mode") === "card" ? params.get("taskId") : null;
  if (cardTaskId) {
    return <FloatingCard taskId={cardTaskId} />;
  }

  const fetchGroups = useGroupStore((s) => s.fetchGroups);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const groups = useGroupStore((s) => s.groups);
  const addGroup = useGroupStore((s) => s.addGroup);
  const { __ } = useT();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      await fetchGroups();
      await fetchTasks();
      setReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (ready && groups.length === 0) {
      addGroup(__("sidebar.ungrouped"), "#6366f1");
    }
  }, [ready, groups.length]);

  useEffect(() => {
    const setupListener = async () => {
      const unlistenReminder = await listen("reminder-fired", (event) => {
        const { title: _title } = event.payload as { task_id: string; reminder_id: string; title: string };
        void _title;
        fetchTasks();
      });
      const unlistenQuickAdd = await listen("tray-quick-add", () => {
        useUIStore.getState().setQuickAddOpen(true);
      });
      const unlistenToday = await listen("tray-today", () => {
        useUIStore.getState().setFilterTodayOnly(true);
        useUIStore.getState().setView("list");
      });
      return () => { unlistenReminder(); unlistenQuickAdd(); unlistenToday(); };
    };
    const cleanup = setupListener();
    return () => { cleanup.then((fn) => fn()); };
  }, []);

  // Card window event listeners (main window only)
  useEffect(() => {
    if (!ready) return;
    const cleanup = setupCardEventListeners();
    return () => { cleanup.then((fn) => fn()); };
  }, [ready]);

  // Keyboard shortcut for sidebar toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Suppress WebView2's built-in F1 help page
      if (e.key === "F1") {
        e.preventDefault();
        return;
      }
      const shortcut = loadShortcut().toLowerCase();
      const parts = shortcut.split("+");
      const hasCtrl = parts.includes("ctrl") && (e.ctrlKey || e.metaKey);
      const hasAlt = parts.includes("alt") && e.altKey;
      const hasShift = parts.includes("shift") && e.shiftKey;
      const key = parts.filter((p) => !["ctrl", "alt", "shift", "meta"].includes(p)).join("+");
      const matchesKey = e.key.toLowerCase() === key;

      if (matchesKey && (parts.includes("ctrl") ? hasCtrl : true) && (parts.includes("alt") ? hasAlt : true) && (parts.includes("shift") ? hasShift : true)) {
        // Don't toggle sidebar when focus is inside an editable element —
        // otherwise we collide with the editor's built-in Ctrl+B (bold) etc.
        const target = e.target as HTMLElement;
        if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
        e.preventDefault();
        useUIStore.getState().toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-brand to-brand-light rounded-lg flex items-center justify-center text-white text-sm font-bold animate-pulse">
            P
          </div>
          <span className="text-xs text-text-muted">{__("app.loading")}</span>
        </div>
      </div>
    );
  }

  return <AppLayout />;
}
