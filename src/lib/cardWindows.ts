import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit, listen } from "@tauri-apps/api/event";
import { useTaskStore } from "../stores/taskStore";
import { useUIStore } from "../stores/uiStore";

const cardWindows = new Map<string, WebviewWindow>();
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 500;
const STORAGE_KEY = "planly-card-positions";

interface CardPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadPositions(): Record<string, CardPosition> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    console.error("Failed to parse card positions from localStorage");
    return {};
  }
}

function savePosition(taskId: string, pos: CardPosition): void {
  const all = loadPositions();
  all[taskId] = pos;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

async function saveCurrentPosition(taskId: string, win: WebviewWindow): Promise<void> {
  try {
    const size = await win.outerSize();
    const position = await win.outerPosition();
    savePosition(taskId, {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
    });
  } catch {
    // Window may have been destroyed
  }
}

export async function openCardWindow(taskId: string, taskTitle?: string): Promise<void> {
  if (cardWindows.has(taskId)) {
    const existing = cardWindows.get(taskId)!;
    await existing.show();
    await existing.setFocus();
    return;
  }

  const positions = loadPositions();
  const pos = positions[taskId];
  const url = `/?mode=card&taskId=${taskId}`;

  const win = new WebviewWindow(`card-${taskId}`, {
    url,
    title: taskTitle || "Planly",
    width: pos?.width ?? DEFAULT_WIDTH,
    height: pos?.height ?? DEFAULT_HEIGHT,
    x: pos?.x,
    y: pos?.y,
    alwaysOnTop: true,
    decorations: false,
    resizable: true,
    minWidth: 300,
    minHeight: 350,
    dragDropEnabled: false,
    center: !pos,
  });

  cardWindows.set(taskId, win);

  await win.onCloseRequested(() => {
    saveCurrentPosition(taskId, win);
    cardWindows.delete(taskId);
  });

  await win.onResized(() => saveCurrentPosition(taskId, win));
  await win.onMoved(() => saveCurrentPosition(taskId, win));
}

export async function closeCardWindow(taskId: string): Promise<void> {
  const win = cardWindows.get(taskId);
  if (win) {
    await win.close();
    cardWindows.delete(taskId);
  }
}

export async function notifyTaskDeleted(taskId: string, subtaskIds?: string[]): Promise<void> {
  await emit("main:task-deleted", { taskId });
  cardWindows.delete(taskId);
  // Notify for subtasks (must pass IDs since task may already be deleted from DB)
  if (subtaskIds) {
    for (const subId of subtaskIds) {
      await emit("main:task-deleted", { taskId: subId });
      cardWindows.delete(subId);
    }
  }
}

export async function notifySubtasksChanged(parentId: string): Promise<void> {
  await emit("main:subtasks-changed", { parentId });
}

export async function setupCardEventListeners(): Promise<() => void> {
  const unlistenUpdate = await listen<{ taskId: string }>("card:task-updated", () => {
    useTaskStore.getState().fetchTasks();
  });

  const unlistenCreate = await listen("card:task-created", () => {
    useTaskStore.getState().fetchTasks();
  });

  const unlistenSubtasks = await listen<{ parentId: string; movedId?: string; swappedId?: string; direction?: "up" | "down" }>("card:subtasks-changed", async (event) => {
    const store = useTaskStore.getState();
    // Refresh data first so DOM reflects new order
    await store.fetchSubtasks(event.payload.parentId);
    store.fetchTasks();
    if (event.payload.movedId && event.payload.direction) {
      // Wait two frames so React has committed the new order, then apply animation class
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          useUIStore.getState().setMovedTask(event.payload.movedId!, event.payload.direction!, event.payload.swappedId);
        });
      });
    }
  });

  return () => {
    unlistenUpdate();
    unlistenCreate();
    unlistenSubtasks();
  };
}

export function isCardOpen(taskId: string): boolean {
  return cardWindows.has(taskId);
}
