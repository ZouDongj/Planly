import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGroupStore } from "../groupStore";

vi.mock("../../lib/commands", () => ({
  getGroups: vi.fn().mockResolvedValue([]),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn().mockResolvedValue(undefined),
  archiveGroup: vi.fn(),
  reorderGroups: vi.fn().mockResolvedValue(undefined),
}));

import * as api from "../../lib/commands";
import type { TaskGroup } from "../../lib/types";

const mockGroup: TaskGroup = {
  id: "group-1",
  name: "Work",
  color: "#6366f1",
  icon: "folder",
  sort_order: 0,
  archived: false,
  created_at: "2026-01-01T00:00:00Z",
};

function resetStore() {
  useGroupStore.setState({ groups: [], loading: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe("groupStore - fetch", () => {
  it("fetches groups", async () => {
    vi.mocked(api.getGroups).mockResolvedValue([mockGroup]);
    await useGroupStore.getState().fetchGroups();
    expect(useGroupStore.getState().groups).toEqual([mockGroup]);
  });
});

describe("groupStore - CRUD", () => {
  it("adds a group", async () => {
    vi.mocked(api.createGroup).mockResolvedValue(mockGroup);
    await useGroupStore.getState().addGroup("Work", "#6366f1");
    expect(useGroupStore.getState().groups).toContainEqual(mockGroup);
  });

  it("updates a group in place", async () => {
    useGroupStore.setState({ groups: [mockGroup] });
    vi.mocked(api.updateGroup).mockResolvedValue(undefined);
    await useGroupStore.getState().editGroup("group-1", "Personal", "#6366f1");
    // editGroup updates optimistically, then awaits API
    const groups = useGroupStore.getState().groups;
    expect(groups[0].name).toBe("Personal");
  });

  it("removes a group", async () => {
    useGroupStore.setState({ groups: [mockGroup] });
    await useGroupStore.getState().removeGroup("group-1");
    expect(useGroupStore.getState().groups).toHaveLength(0);
    expect(api.deleteGroup).toHaveBeenCalledWith("group-1");
  });
});

describe("groupStore - reorder", () => {
  it("reorders groups optimistically", async () => {
    const g2 = { ...mockGroup, id: "group-2", name: "Home", sort_order: 1 };
    useGroupStore.setState({ groups: [mockGroup, g2] });
    await useGroupStore.getState().reorderGroups(["group-2", "group-1"]);
    expect(useGroupStore.getState().groups[0].id).toBe("group-2");
    expect(api.reorderGroups).toHaveBeenCalledWith(["group-2", "group-1"]);
  });
});
