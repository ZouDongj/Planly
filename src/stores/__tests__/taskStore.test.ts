import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTaskStore } from "../taskStore";
import type { Task } from "../../lib/types";

// Mock the commands module
vi.mock("../../lib/commands", () => ({
  getTasks: vi.fn().mockResolvedValue([]),
  getSubtasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  reorderTasks: vi.fn().mockResolvedValue(undefined),
  getAllTasksFlat: vi.fn().mockResolvedValue([]),
}));

import * as api from "../../lib/commands";

const mockTask: Task = {
  id: "task-1",
  group_id: "group-1",
  parent_id: null,
  title: "Test Task",
  note: "",
  priority: "p2",
  status: "todo",
  due_date: null,
  due_time: null,
  sort_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  completed_at: null,
  recurrence: null,
};

const initialState = {
  tasks: [] as Task[],
  subtaskMap: new Map<string, Task[]>(),
  selectedTask: null as Task | null,
  loading: false,
};

function resetStore() {
  useTaskStore.setState({
    ...initialState,
    subtaskMap: new Map(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe("taskStore - fetch", () => {
  it("fetches tasks and stores them", async () => {
    vi.mocked(api.getTasks).mockResolvedValue([mockTask]);
    await useTaskStore.getState().fetchTasks();
    expect(useTaskStore.getState().tasks).toEqual([mockTask]);
  });

  it("sets loading true during fetch", async () => {
    vi.mocked(api.getTasks).mockResolvedValue([]);
    const promise = useTaskStore.getState().fetchTasks();
    expect(useTaskStore.getState().loading).toBe(true);
    await promise;
    expect(useTaskStore.getState().loading).toBe(false);
  });

  it("fetches subtasks and stores in map", async () => {
    const sub: Task = { ...mockTask, id: "sub-1", parent_id: "task-1" };
    vi.mocked(api.getSubtasks).mockResolvedValue([sub]);
    await useTaskStore.getState().fetchSubtasks("task-1");
    expect(useTaskStore.getState().subtaskMap.get("task-1")).toEqual([sub]);
  });
});

describe("taskStore - CRUD", () => {
  it("adds a task to the list", async () => {
    vi.mocked(api.createTask).mockResolvedValue(mockTask);
    const task = await useTaskStore.getState().addTask({
      group_id: "group-1",
      title: "Test Task",
    });
    expect(task).toEqual(mockTask);
    expect(useTaskStore.getState().tasks).toContainEqual(mockTask);
  });

  it("edits a task in place", async () => {
    const updated = { ...mockTask, title: "Updated" };
    useTaskStore.setState({ tasks: [mockTask] });
    vi.mocked(api.updateTask).mockResolvedValue(updated);
    await useTaskStore.getState().editTask({ id: "task-1", title: "Updated" });
    expect(useTaskStore.getState().tasks[0].title).toBe("Updated");
  });

  it("removes a task from UI immediately", () => {
    useTaskStore.setState({ tasks: [mockTask] });
    useTaskStore.getState().removeTask("task-1");
    expect(useTaskStore.getState().tasks).toHaveLength(0);
    expect(useTaskStore.getState().pendingDeletes.has("task-1")).toBe(true);
  });

  it("undo restores task before API call", () => {
    vi.useFakeTimers();
    useTaskStore.setState({ tasks: [mockTask] });
    useTaskStore.getState().removeTask("task-1");
    expect(useTaskStore.getState().tasks).toHaveLength(0);
    // Undo before timeout
    vi.mocked(api.getTasks).mockResolvedValue([mockTask]);
    useTaskStore.getState().undoRemoveTask("task-1");
    expect(useTaskStore.getState().pendingDeletes.has("task-1")).toBe(false);
    vi.useRealTimers();
  });

  it("calls API delete after timeout expires", () => {
    vi.useFakeTimers();
    useTaskStore.setState({ tasks: [mockTask] });
    useTaskStore.getState().removeTask("task-1");
    vi.advanceTimersByTime(6000);
    expect(api.deleteTask).toHaveBeenCalledWith("task-1");
    vi.useRealTimers();
  });
});

describe("taskStore - select", () => {
  it("selects a task", () => {
    useTaskStore.getState().selectTask(mockTask);
    expect(useTaskStore.getState().selectedTask).toEqual(mockTask);
  });

  it("clears selection", () => {
    useTaskStore.getState().selectTask(mockTask);
    useTaskStore.getState().selectTask(null);
    expect(useTaskStore.getState().selectedTask).toBeNull();
  });
});
