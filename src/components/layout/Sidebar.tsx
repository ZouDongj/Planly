import { useState } from "react";
import { Search, Plus, List, Columns, Calendar, Settings, Pencil, Trash2, Check, X, Folder, FolderKanban, Briefcase, Heart, Star, BookOpen, Home, Sun, Archive } from "lucide-react";
import DeleteConfirmDialog from "../tasks/DeleteConfirmDialog";
import ColorPicker from "./ColorPicker";
import type { ViewType } from "../../lib/types";
import { useUIStore } from "../../stores/uiStore";
import { useGroupStore } from "../../stores/groupStore";
import { useTaskStore } from "../../stores/taskStore";
import { useT } from "../../i18n/translations";
import { isUngroupedGroup } from "../../lib/utils";

const viewIcons: Record<ViewType, typeof List> = {
  list: List, kanban: Columns, calendar: Calendar,
};

const GROUP_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4"];

const GROUP_ICONS: Record<string, typeof Folder> = {
  folder: Folder,
  briefcase: Briefcase,
  heart: Heart,
  star: Star,
  book: BookOpen,
  home: Home,
  kanban: FolderKanban,
};

export default function Sidebar({ onSettings, onNavigate }: { onSettings: () => void; onNavigate: () => void }) {
  const { __ } = useT();
  const currentView = useUIStore((s) => s.currentView);
  const setView = useUIStore((s) => s.setView);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearch = useUIStore((s) => s.setSearch);
  const filterGroupId = useUIStore((s) => s.filterGroupId);
  const filterTodayOnly = useUIStore((s) => s.filterTodayOnly);
  const showArchived = useUIStore((s) => s.showArchived);
  const setFilterGroup = useUIStore((s) => s.setFilterGroup);
  const setFilterTodayOnly = useUIStore((s) => s.setFilterTodayOnly);
  const setShowArchived = useUIStore((s) => s.setShowArchived);
  const groups = useGroupStore((s) => s.groups);
  const addGroup = useGroupStore((s) => s.addGroup);
  const editGroup = useGroupStore((s) => s.editGroup);
  const removeGroup = useGroupStore((s) => s.removeGroup);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);

  // User profile
  const [userName, setUserName] = useState(() => localStorage.getItem("planly-username") || __("sidebar.user"));
  const [avatarColor, setAvatarColor] = useState(() => localStorage.getItem("planly-avatar-color") || "#6366f1");
  const [avatarImg, setAvatarImg] = useState(() => localStorage.getItem("planly-avatar-img") || "");
  const [editingColor, setEditingColor] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#8b5cf6"];
  const [customColor, setCustomColor] = useState("#6366f1");
  const displayInitial = userName ? (userName.length > 0 ? userName[0].toUpperCase() : "U") : "U";
  const handleFilePick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      // Simple: just use the image as data URL (no cropping for now)
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setAvatarImg(dataUrl);
        localStorage.setItem("planly-avatar-img", dataUrl);
        setEditingColor(false);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const views: ViewType[] = ["list", "kanban", "calendar"];
  const viewLabels: Record<ViewType, string> = {
    list: __("view.tasks"), kanban: __("view.kanban"), calendar: __("view.calendar"),
  };

  const handleStartRename = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleConfirmRename = async () => {
    if (editingId && editName.trim() && editName !== groups.find(g => g.id === editingId)?.name) {
      await editGroup(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteDialog({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    await removeGroup(deleteDialog.id);
    fetchTasks();
    setDeleteDialog(null);
  };

  const handleAddGroup = async () => {
    if (newName.trim()) {
      const color = GROUP_COLORS[groups.length % GROUP_COLORS.length];
      const icon = localStorage.getItem("planly-group-icon") || "folder";
      await addGroup(newName.trim(), color, icon);
      setNewName("");
      setAdding(false);
    }
  };

  const colorfulIcons = useUIStore((s) => s.colorfulIcons);

  return (
    <div className="absolute inset-x-2 inset-y-0 bg-sidebar flex flex-col rounded-xl border border-border/40">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        {/* Avatar — click to change color or image */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => { setEditingColor(!editingColor); setEditingName(false); }}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold overflow-hidden transition-transform hover:scale-105 flex-shrink-0 ring-1 ring-border/30"
            style={{ backgroundColor: avatarImg ? "transparent" : avatarColor }}
          >
            {avatarImg ? (
              <img src={avatarImg} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{displayInitial}</span>
            )}
          </button>
          {editingColor && (
            <>
              <div className="fixed inset-0 z-[5]" onClick={() => setEditingColor(false)} />
              <div className="absolute top-full left-0 mt-2 bg-popover border border-border/60 rounded-xl p-3 shadow-lg z-10 w-52 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-[11px] text-muted-foreground mb-2 font-medium">{__("sidebar.avatar")}</p>
              <div className="flex gap-2 flex-wrap mb-3">
                {COLORS.map(c => (
                  <button key={c} onClick={() => { setAvatarColor(c); localStorage.setItem("planly-avatar-color", c); setAvatarImg(""); localStorage.removeItem("planly-avatar-img"); setEditingColor(false); }} className={`w-8 h-8 rounded-full transition-transform hover:scale-110 flex items-center justify-center text-[11px] text-white/80 font-bold ${avatarColor === c && !avatarImg ? "ring-2 ring-offset-1 ring-sidebar-foreground/30" : ""}`} style={{ backgroundColor: c }}>
                    {displayInitial}
                  </button>
                ))}
                {/* Temp swatch for picked custom color (not a preset) */}
                {!COLORS.includes(customColor) && (
                  <button onClick={() => { setAvatarColor(customColor); setAvatarImg(""); localStorage.removeItem("planly-avatar-img"); setEditingColor(false); }} className={`w-8 h-8 rounded-full transition-transform hover:scale-110 flex items-center justify-center text-[11px] text-white/80 font-bold ${avatarColor === customColor && !avatarImg ? "ring-2 ring-offset-1 ring-sidebar-foreground/30" : ""}`} style={{ backgroundColor: customColor }}>
                    {avatarColor === customColor && !avatarImg ? "✓" : displayInitial}
                  </button>
                )}
                {/* Custom color picker button — sunset gradient */}
                <ColorPicker color={customColor} onChange={(c) => { setCustomColor(c); setAvatarColor(c); localStorage.setItem("planly-avatar-color", c); setAvatarImg(""); localStorage.removeItem("planly-avatar-img"); }} className="w-8 h-8 rounded-full transition-transform hover:scale-110 flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #f97316, #fb923c, #fbbf24, #f59e0b, #ef4444, #ec4899)" }}>
                  <Plus size={12} className="text-white drop-shadow-sm" />
                </ColorPicker>
                {/* Image avatar */}
                {avatarImg && (
                  <button onClick={() => { setAvatarImg(""); localStorage.removeItem("planly-avatar-img"); }} className="w-8 h-8 rounded-full ring-2 ring-offset-1 ring-sidebar-foreground/30 overflow-hidden transition-transform hover:scale-110 relative" title={__("sidebar.removeImage")}>
                    <img src={avatarImg} alt="" className="w-full h-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs font-bold">✓</span>
                  </button>
                )}
                {/* Image picker */}
                <button onClick={() => handleFilePick()} className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title={__("sidebar.chooseImage")}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
            </>
          )}
        </div>
        {/* Name — double-click to edit */}
        {editingName ? (
          <div className="flex items-center gap-1 min-w-0">
            <input className="flex-1 min-w-0 bg-sidebar-accent border border-sidebar-border rounded-md px-2 py-1 text-[13px] outline-none" value={userName} onChange={(e) => setUserName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { localStorage.setItem("planly-username", userName); setEditingName(false); } if (e.key === "Escape") setEditingName(false); }} autoFocus />
            <button onClick={() => { localStorage.setItem("planly-username", userName); setEditingName(false); }} className="text-brand hover:text-brand-dark flex-shrink-0"><Check size={14} /></button>
            <button onClick={() => { setUserName(localStorage.getItem("planly-username") || "User"); setEditingName(false); }} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X size={14} /></button>
          </div>
        ) : (
          <button
            onDoubleClick={() => { setEditingName(true); setEditingColor(false); }}
            className="font-semibold text-sm text-sidebar-foreground tracking-tight hover:text-sidebar-primary transition-colors truncate text-left"
            title={__("sidebar.editName")}
          >
            {userName}
          </button>
        )}
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 bg-sidebar-accent border border-sidebar-border rounded-lg px-3 py-2">
          <Search size={15} className="text-muted-foreground" />
          <input
            className="bg-transparent text-[13px] outline-none w-full placeholder:text-muted-foreground/60"
            placeholder={__("search.placeholder")}
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="px-3 py-1">
        <div className="text-[11px] text-muted-foreground font-medium tracking-wide px-2 mb-2">
          {__("sidebar.views")}
        </div>
        {views.map((v) => {
          const Icon = viewIcons[v];
          return (
            <button
              key={v}
              onClick={() => { setView(v); onNavigate(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-all ${
                currentView === v
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <Icon size={16} />
              {viewLabels[v]}
            </button>
          );
        })}
      </div>

      <div className="px-3 py-1">
        <div className="text-[11px] text-muted-foreground font-medium tracking-wide px-2 mb-2">
          {__("sidebar.filters")}
        </div>

        <button
          onClick={() => { setFilterTodayOnly(!filterTodayOnly); fetchTasks(); onNavigate(); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${filterTodayOnly ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}
        >
          <Sun size={16} className="flex-shrink-0" />
          {__("view.today")}
        </button>

        <button
          onClick={() => { setShowArchived(!showArchived); fetchTasks(); onNavigate(); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] mb-3 transition-colors ${showArchived ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}
        >
          <Archive size={16} className="flex-shrink-0" />
          {__("view.archived")}
        </button>
      </div>

      <div className="px-3 py-2 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="text-[11px] text-muted-foreground font-medium tracking-wide px-2 mb-2">
          {__("sidebar.groups")}
        </div>

        <button
          onClick={() => { setFilterGroup(null); setFilterTodayOnly(false); setShowArchived(false); fetchTasks(); onNavigate(); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${filterGroupId === null && !filterTodayOnly && !showArchived ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}
        >
          <Folder size={15} className="text-foreground/30 flex-shrink-0" />
          {__("sidebar.all")}
        </button>

        {groups.map((g) => (
          <div
            key={g.id}
            className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] mb-0.5 cursor-pointer transition-colors ${filterGroupId === g.id ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}
          >
            {editingId === g.id ? (
              <>
                <input
                  className="flex-1 min-w-0 bg-background border border-brand rounded-md px-2 py-1 text-[13px] outline-none"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleConfirmRename(); if (e.key === "Escape") setEditingId(null); }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <button onClick={(e) => { e.stopPropagation(); handleConfirmRename(); }} className="text-brand hover:text-brand-dark flex-shrink-0 p-0.5"><Check size={13} /></button>
                <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-muted-foreground hover:text-foreground flex-shrink-0 p-0.5"><X size={13} /></button>
              </>
            ) : (
              <>
                <div onClick={() => { setFilterGroup(g.id); fetchTasks(g.id); onNavigate(); }} className="flex-1 flex items-center gap-3 min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const keys = Object.keys(GROUP_ICONS);
                      const idx = keys.indexOf(g.icon);
                      const next = keys[(idx + 1) % keys.length];
                      editGroup(g.id, undefined, undefined, next);
                    }}
                    className="flex-shrink-0 hover:scale-110 transition-transform"
                    title={__("sidebar.clickToChangeIcon")}
                  >
                    {(() => { const Icon = GROUP_ICONS[g.icon] || Folder; return <Icon size={15} style={{ color: colorfulIcons ? g.color : undefined }} />; })()}
                  </button>
                  <span className="truncate">{isUngroupedGroup(g.name) ? __("sidebar.ungrouped") : g.name}</span>
                </div>
                <div className="hidden group-hover:flex items-center gap-0 flex-shrink-0">
                {g.id !== groups[0]?.id && (
                <button
                    onClick={(e) => { e.stopPropagation(); handleStartRename(g.id, g.name); }}
                    className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                    title={__("sidebar.rename")}
                  >
                    <Pencil size={12} />
                  </button>
                  )}
                  {g.id !== groups[0]?.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(g.id, g.name); }}
                    className="p-0.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                    title={__("sidebar.delete")}
                  >
                    <Trash2 size={12} />
                  </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        {adding ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            <input
              className="flex-1 min-w-0 bg-background border border-brand rounded-md px-2 py-1.5 text-[13px] outline-none"
              placeholder={__("sidebar.groupName")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddGroup(); if (e.key === "Escape") setAdding(false); }}
              autoFocus
            />
            <button onClick={handleAddGroup} className="text-brand hover:text-brand-dark flex-shrink-0 p-0.5"><Check size={13} /></button>
            <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground flex-shrink-0 p-0.5"><X size={13} /></button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all"
          >
            <Plus size={16} />
            {__("sidebar.addGroup")}
          </button>
        )}
      </div>

      <div className="px-4 pb-4 pt-1">
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
        >
          <Settings size={16} />
          {__("app.settings")}
        </button>
      </div>
      {deleteDialog && (
        <DeleteConfirmDialog
          open={true}
          onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}
          taskTitle={deleteDialog.name}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
