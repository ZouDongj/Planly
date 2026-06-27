import { create } from "zustand";
import type { ViewType } from "../lib/types";

export type ThemeId = "default" | "github" | "notion" | "minimal" | "ocean" | "sunset" | "one-dark-pro";

interface CardSections {
  reminders: boolean;
  dateTime: boolean;
  time: boolean;
  recurrence: boolean;
  group: boolean;
  activity: boolean;
}

interface UIState {
  currentView: ViewType;
  sidebarOpen: boolean;
  drawerOpen: boolean;
  searchQuery: string;
  filterGroupId: string | null;
  filterTodayOnly: boolean;
  showArchived: boolean;
  sortBy: "manual" | "due_date_asc" | "due_date_desc" | "priority" | "title_asc" | "created_desc";
  expandedTaskIds: Set<string>;
  singleExpand: boolean;
  colorfulIcons: boolean;
  movedTaskId: string | null;
  swappedTaskId: string | null;
  exitingTaskIds: Set<string>;
  enteringTaskIds: Set<string>;
  selectMode: boolean;
  selectedTaskIds: Set<string>;
  moveDirection: "up" | "down" | null;
  quickAddOpen: boolean;
  darkMode: boolean;
  lang: "en" | "zh";
  lightTheme: ThemeId;
  darkTheme: ThemeId;
  cardSections: CardSections;
  setView: (view: ViewType) => void;
  setLang: (l: "en" | "zh") => void;
  toggleSidebar: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  setSearch: (query: string) => void;
  setFilterGroup: (groupId: string | null) => void;
  setFilterTodayOnly: (v: boolean) => void;
  setShowArchived: (v: boolean) => void;
  setSortBy: (sort: string) => void;
  toggleExpandedTask: (id: string) => void;
  toggleSingleExpand: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (enabled: boolean) => void;
  toggleColorfulIcons: () => void;
  setMovedTask: (id: string | null, direction?: "up" | "down", swappedId?: string) => void;
  addExitingTask: (id: string) => void;
  addExitingTasks: (ids: string[]) => void;
  addEnteringTask: (id: string) => void;
  setSelectMode: (on: boolean) => void;
  toggleSelectTask: (id: string) => void;
  clearSelection: () => void;
  setQuickAddOpen: (v: boolean) => void;
  setCardSection: (section: keyof CardSections, enabled: boolean) => void;
  setLightTheme: (theme: ThemeId) => void;
  setDarkTheme: (theme: ThemeId) => void;
}

// ─── Saved preferences ──────────────────────────────────────────────────────

const savedSingleExpand = localStorage.getItem("planly-single-expand") === "true";
const savedDarkMode = localStorage.getItem("planly-dark-mode") === "true";
const savedLightTheme = (localStorage.getItem("planly-light-theme") as ThemeId) || "default";
const savedDarkTheme = (localStorage.getItem("planly-dark-theme") as ThemeId) || "default";

const defaultCardSections: CardSections = { reminders: false, dateTime: true, time: false, recurrence: false, group: true, activity: false };
const savedCardSections: CardSections = (() => {
  try {
    const raw = localStorage.getItem("planly-card-sections");
    return raw ? { ...defaultCardSections, ...JSON.parse(raw) } : defaultCardSections;
  } catch { return defaultCardSections; }
})();

// ─── Apply initial state to DOM ─────────────────────────────────────────────

if (savedDarkMode) document.documentElement.classList.add("dark");

const initialActiveTheme = savedDarkMode ? savedDarkTheme : savedLightTheme;
if (initialActiveTheme && initialActiveTheme !== "default") {
  document.documentElement.setAttribute("data-theme", initialActiveTheme);
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function applyThemeAttr(theme: ThemeId) {
  if (theme === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

function emitThemeChanged(theme: ThemeId) {
  import("@tauri-apps/api/event").then(({ emit }) => {
    emit("main:theme-changed", { theme });
  });
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useUIStore = create<UIState>((set, get) => ({
  currentView: "list",
  sidebarOpen: true,
  drawerOpen: false,
  searchQuery: "",
  filterGroupId: null,
  filterTodayOnly: false,
  showArchived: false,
  sortBy: (localStorage.getItem("planly-sort-by") as "manual" | "due_date_asc" | "due_date_desc" | "priority" | "title_asc" | "created_desc") || "manual",
  expandedTaskIds: new Set<string>(),
  singleExpand: savedSingleExpand,
  colorfulIcons: localStorage.getItem("planly-colorful-icons") !== "false",
  movedTaskId: null,
  swappedTaskId: null,
  exitingTaskIds: new Set<string>(),
  enteringTaskIds: new Set<string>(),
  selectMode: false,
  selectedTaskIds: new Set<string>(),
  moveDirection: null,
  quickAddOpen: false,
  darkMode: savedDarkMode,
  lang: (localStorage.getItem("planly-lang") as "en" | "zh") || "en",
  lightTheme: savedLightTheme,
  darkTheme: savedDarkTheme,
  cardSections: savedCardSections,

  setLang: (l) => {
    localStorage.setItem("planly-lang", l);
    set({ lang: l });
    import("@tauri-apps/api/event").then(({ emit }) => {
      emit("main:lang-changed", { lang: l });
    });
  },

  setView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  setSearch: (query) => set({ searchQuery: query }),
  setFilterGroup: (groupId) => set({ filterGroupId: groupId, filterTodayOnly: false }),
  setFilterTodayOnly: (v) => set({ filterTodayOnly: v, showArchived: false }),
  setShowArchived: (v) => set({ showArchived: v, filterTodayOnly: false }),
  setSortBy: (sort) => {
    localStorage.setItem("planly-sort-by", sort);
    set({ sortBy: sort as UIState["sortBy"] });
  },
  toggleExpandedTask: (id) =>
    set((s) => {
      const next = new Set(s.expandedTaskIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (s.singleExpand) next.clear();
        next.add(id);
      }
      return { expandedTaskIds: next };
    }),
  toggleSingleExpand: () =>
    set((s) => {
      const next = !s.singleExpand;
      localStorage.setItem("planly-single-expand", String(next));
      return { singleExpand: next };
    }),
  toggleColorfulIcons: () =>
    set((s) => {
      const next = !s.colorfulIcons;
      localStorage.setItem("planly-colorful-icons", String(next));
      return { colorfulIcons: next };
    }),
  setMovedTask: (id, direction, swappedId) => {
    set({ movedTaskId: id, swappedTaskId: swappedId || null, moveDirection: direction || null });
    if (id) setTimeout(() => set({ movedTaskId: null, swappedTaskId: null, moveDirection: null }), 300);
  },
  addExitingTask: (id) => {
    set((s) => {
      const next = new Set(s.exitingTaskIds);
      next.add(id);
      return { exitingTaskIds: next };
    });
    setTimeout(() => {
      set((s) => {
        const next = new Set(s.exitingTaskIds);
        next.delete(id);
        return { exitingTaskIds: next };
      });
    }, 350);
  },
  addExitingTasks: (ids: string[]) => {
    if (ids.length === 0) return;
    set((s) => {
      const next = new Set(s.exitingTaskIds);
      ids.forEach(id => next.add(id));
      return { exitingTaskIds: next };
    });
    setTimeout(() => {
      set((s) => {
        const next = new Set(s.exitingTaskIds);
        ids.forEach(id => next.delete(id));
        return { exitingTaskIds: next };
      });
    }, 350);
  },
  addEnteringTask: (id) => {
    set((s) => {
      const next = new Set(s.enteringTaskIds);
      next.add(id);
      return { enteringTaskIds: next };
    });
    setTimeout(() => {
      set((s) => {
        const next = new Set(s.enteringTaskIds);
        next.delete(id);
        return { enteringTaskIds: next };
      });
    }, 350);
  },
  setSelectMode: (on) => set({ selectMode: on, selectedTaskIds: on ? new Set<string>(useUIStore.getState().selectedTaskIds) : new Set<string>() }),
  toggleSelectTask: (id) => set((s) => {
    const next = new Set(s.selectedTaskIds);
    next.has(id) ? next.delete(id) : next.add(id);
    return { selectedTaskIds: next };
  }),
  clearSelection: () => set({ selectedTaskIds: new Set<string>() }),
  setQuickAddOpen: (v) => set({ quickAddOpen: v }),

  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      localStorage.setItem("planly-dark-mode", String(next));
      document.documentElement.classList.toggle("dark", next);
      const themeToApply = next ? s.darkTheme : s.lightTheme;
      applyThemeAttr(themeToApply);
      import("@tauri-apps/api/event").then(({ emit }) => {
        emit("main:dark-mode-changed", { darkMode: next });
        emit("main:theme-changed", { theme: themeToApply });
      });
      return { darkMode: next };
    }),
  setDarkMode: (enabled) =>
    set((s) => {
      if (s.darkMode === enabled) return s;
      localStorage.setItem("planly-dark-mode", String(enabled));
      document.documentElement.classList.toggle("dark", enabled);
      const themeToApply = enabled ? s.darkTheme : s.lightTheme;
      applyThemeAttr(themeToApply);
      import("@tauri-apps/api/event").then(({ emit }) => {
        emit("main:dark-mode-changed", { darkMode: enabled });
        emit("main:theme-changed", { theme: themeToApply });
      });
      return { darkMode: enabled };
    }),

  setCardSection: (section, enabled) =>
    set((s) => {
      const next = { ...s.cardSections, [section]: enabled };
      localStorage.setItem("planly-card-sections", JSON.stringify(next));
      return { cardSections: next };
    }),

  setLightTheme: (theme) => {
    localStorage.setItem("planly-light-theme", theme);
    if (!get().darkMode) {
      applyThemeAttr(theme);
      emitThemeChanged(theme);
    }
    set({ lightTheme: theme });
  },

  setDarkTheme: (theme) => {
    localStorage.setItem("planly-dark-theme", theme);
    if (get().darkMode) {
      applyThemeAttr(theme);
      emitThemeChanged(theme);
    }
    set({ darkTheme: theme });
  },
}));
