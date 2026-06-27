import { create } from "zustand";
import type { TaskGroup } from "../lib/types";
import * as api from "../lib/commands";

interface GroupState {
  groups: TaskGroup[];
  loading: boolean;
  fetchGroups: () => Promise<void>;
  addGroup: (name: string, color?: string, icon?: string) => Promise<TaskGroup>;
  editGroup: (id: string, name?: string, color?: string, icon?: string) => Promise<void>;
  removeGroup: (id: string) => Promise<void>;
  archiveGroup: (id: string) => Promise<void>;
  reorderGroups: (ids: string[]) => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  loading: false,

  fetchGroups: async () => {
    set({ loading: true });
    const groups = await api.getGroups();
    set({ groups, loading: false });
  },

  addGroup: async (name, color, icon) => {
    const group = await api.createGroup({ name, color, icon });
    set((s) => ({ groups: [...s.groups, group] }));
    return group;
  },

  editGroup: async (id, name, color, icon) => {
    await api.updateGroup({ id, name, color, icon });
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === id ? { ...g, name: name ?? g.name, color: color ?? g.color, icon: icon ?? g.icon } : g
      ),
    }));
  },

  removeGroup: async (id) => {
    await api.deleteGroup(id);
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }));
  },

  archiveGroup: async (id) => {
    await api.archiveGroup(id);
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }));
  },

  reorderGroups: async (ids) => {
    await api.reorderGroups(ids);
    const ordered = ids.map((id) => get().groups.find((g) => g.id === id)!)
      .filter(Boolean);
    set({ groups: ordered });
  },
}));
