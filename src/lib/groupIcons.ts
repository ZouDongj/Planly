import { Folder, FolderKanban, Briefcase, Heart, Star, BookOpen, Home, type LucideIcon } from "lucide-react";

export const GROUP_ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  kanban: FolderKanban,
  briefcase: Briefcase,
  heart: Heart,
  star: Star,
  book: BookOpen,
  home: Home,
};

export const FALLBACK_GROUP_ICON: LucideIcon = Folder;
