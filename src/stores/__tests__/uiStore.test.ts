import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUIStore } from "../uiStore";

// Mock Tauri APIs used by uiStore (theme change emitter)
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn() }));

const initialState = {
  darkMode: false,
  lightTheme: "default" as const,
  darkTheme: "default" as const,
  currentView: "list" as const,
  sortBy: "manual" as const,
  filterTodayOnly: false,
  showArchived: false,
  filterGroupId: null as string | null,
  searchQuery: "",
  sidebarOpen: true,
  quickAddOpen: false,
  selectMode: false,
  selectedTaskIds: new Set<string>(),
  exitingTaskIds: new Set<string>(),
  cardSections: { reminders: false, dateTime: true, time: true, recurrence: true, group: true, activity: false },
};

function resetStore() {
  useUIStore.setState({ ...initialState, selectedTaskIds: new Set(), exitingTaskIds: new Set() });
}

beforeEach(resetStore);

describe("uiStore - theme", () => {
  it("starts with light mode", () => {
    const { darkMode } = useUIStore.getState();
    expect(darkMode).toBe(false);
  });

  it("toggles dark mode", () => {
    useUIStore.getState().toggleDarkMode();
    expect(useUIStore.getState().darkMode).toBe(true);
  });

  it("sets light theme", () => {
    useUIStore.getState().setLightTheme("ocean");
    expect(useUIStore.getState().lightTheme).toBe("ocean");
  });

  it("sets dark theme", () => {
    useUIStore.getState().setDarkTheme("one-dark-pro");
    expect(useUIStore.getState().darkTheme).toBe("one-dark-pro");
  });
});

describe("uiStore - view & sort", () => {
  it("starts with list view", () => {
    expect(useUIStore.getState().currentView).toBe("list");
  });

  it("switches to kanban view", () => {
    useUIStore.getState().setView("kanban");
    expect(useUIStore.getState().currentView).toBe("kanban");
  });

  it("switches to calendar view", () => {
    useUIStore.getState().setView("calendar");
    expect(useUIStore.getState().currentView).toBe("calendar");
  });

  it("sets sort by priority", () => {
    useUIStore.getState().setSortBy("priority");
    expect(useUIStore.getState().sortBy).toBe("priority");
  });

  it("sets sort by date", () => {
    useUIStore.getState().setSortBy("due_date");
    expect(useUIStore.getState().sortBy).toBe("due_date");
  });
});

describe("uiStore - filter", () => {
  it("starts with no filters", () => {
    const s = useUIStore.getState();
    expect(s.filterTodayOnly).toBe(false);
    expect(s.showArchived).toBe(false);
    expect(s.filterGroupId).toBeNull();
  });

  it("sets filter for today only", () => {
    useUIStore.getState().setFilterTodayOnly(true);
    expect(useUIStore.getState().filterTodayOnly).toBe(true);
  });

  it("sets show completed", () => {
    useUIStore.getState().setShowArchived(true);
    expect(useUIStore.getState().showArchived).toBe(true);
  });

  it("filters by group", () => {
    useUIStore.getState().setFilterGroup("group-123");
    expect(useUIStore.getState().filterGroupId).toBe("group-123");
  });

  it("filters are layered (today + group)", () => {
    useUIStore.getState().setFilterGroup("group-1");
    useUIStore.getState().setFilterTodayOnly(true);
    const s = useUIStore.getState();
    expect(s.filterGroupId).toBe("group-1");
    expect(s.filterTodayOnly).toBe(true);
  });
});

describe("uiStore - select mode", () => {
  it("starts with select mode off", () => {
    expect(useUIStore.getState().selectMode).toBe(false);
  });

  it("enables select mode", () => {
    useUIStore.getState().setSelectMode(true);
    expect(useUIStore.getState().selectMode).toBe(true);
  });

  it("toggles task selection", () => {
    useUIStore.getState().setSelectMode(true);
    useUIStore.getState().toggleSelectTask("task-1");
    expect(useUIStore.getState().selectedTaskIds.has("task-1")).toBe(true);
    useUIStore.getState().toggleSelectTask("task-1");
    expect(useUIStore.getState().selectedTaskIds.has("task-1")).toBe(false);
  });

  it("clears selections when exiting select mode", () => {
    useUIStore.getState().setSelectMode(true);
    useUIStore.getState().toggleSelectTask("task-1");
    useUIStore.getState().setSelectMode(false);
    expect(useUIStore.getState().selectedTaskIds.size).toBe(0);
  });
});

describe("uiStore - card sections", () => {
  it("has default card sections enabled", () => {
    const { cardSections } = useUIStore.getState();
    expect(cardSections.time).toBe(true);
    expect(cardSections.recurrence).toBe(true);
  });

  it("toggles card section", () => {
    useUIStore.getState().setCardSection("time", false);
    expect(useUIStore.getState().cardSections.time).toBe(false);
  });
});

describe("uiStore - sidebar", () => {
  it("starts with sidebar open", () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("toggles sidebar", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });
});

describe("uiStore - exit animations", () => {
  it("adds and auto-removes exiting task IDs", () => {
    vi.useFakeTimers();
    useUIStore.getState().addExitingTask("task-x");
    expect(useUIStore.getState().exitingTaskIds.has("task-x")).toBe(true);
    vi.advanceTimersByTime(400);
    expect(useUIStore.getState().exitingTaskIds.has("task-x")).toBe(false);
    vi.useRealTimers();
  });
});
