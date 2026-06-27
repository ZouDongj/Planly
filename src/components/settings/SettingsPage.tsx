import { useState, useEffect } from "react";
import { ArrowLeft, Download, Upload, Trash2, Folder, Briefcase, Heart, Star, BookOpen, Home, FolderKanban, ChevronUp, ChevronDown, X } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { exportToFile, importFromFile, clearAllData, listSystemFonts } from "../../lib/commands";
import { PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Popover } from "@/components/ui/popover";
import { useUIStore } from "../../stores/uiStore";
import { useT } from "../../i18n/translations";

function loadRadius(): number {
  const saved = localStorage.getItem("planly-radius");
  if (saved) return parseFloat(saved);
  return 0.5;
}

function loadDrawerWidth(): number {
  const saved = localStorage.getItem("planly-drawer-width");
  if (saved) return parseFloat(saved);
  return 440;
}

function loadFontFamily(): string[] {
  const saved = localStorage.getItem("planly-font-family");
  if (!saved) return [];
  return saved.split(",").map(s => s.trim()).filter(Boolean);
}

function loadFontSize(): number {
  const saved = localStorage.getItem("planly-font-size");
  if (saved) return parseFloat(saved);
  return 14;
}

function applyFontFamily(fonts: string[]) {
  if (fonts.length > 0) {
    const cssValue = fonts.map(f => `'${f}'`).join(", ") + ", 'Geist Variable', sans-serif";
    document.documentElement.style.setProperty("--app-font-family", cssValue);
  } else {
    document.documentElement.style.setProperty("--app-font-family", `'Geist Variable', sans-serif`);
  }
}

export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const [langOpen, setLangOpen] = useState(false);
  const [radius, setRadius] = useState(loadRadius);
  const [drawerWidth, setDrawerWidth] = useState(loadDrawerWidth);
  const [fontFamily, setFontFamily] = useState<string[]>(loadFontFamily);
  const [fontSize, setFontSize] = useState(loadFontSize);
  const [fontOpen, setFontOpen] = useState(false);
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [resultMsg, setResultMsg] = useState(""); // styled alert
  const [sidebarShortcut, setSidebarShortcut] = useState(() => localStorage.getItem("planly-shortcut-sidebar") || "Ctrl+b");
  const [recording, setRecording] = useState(false);
  const [groupIcon, setGroupIcon] = useState(() => localStorage.getItem("planly-group-icon") || "folder");
  const colorfulIcons = useUIStore((s) => s.colorfulIcons);
  const toggleColorfulIcons = useUIStore((s) => s.toggleColorfulIcons);
  const singleExpand = useUIStore((s) => s.singleExpand);
  const toggleSingleExpand = useUIStore((s) => s.toggleSingleExpand);
  const darkMode = useUIStore((s) => s.darkMode);
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);
  const lightTheme = useUIStore((s) => s.lightTheme);
  const darkTheme = useUIStore((s) => s.darkTheme);
  const setLightTheme = useUIStore((s) => s.setLightTheme);
  const setDarkTheme = useUIStore((s) => s.setDarkTheme);
  const cardSections = useUIStore((s) => s.cardSections);
  const setCardSection = useUIStore((s) => s.setCardSection);
  const { lang, setLang, __ } = useT();

  const handleShortcutCapture = (e: React.KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return; // only modifiers, wait for real key
    parts.push(key);
    const val = parts.join("+");
    setSidebarShortcut(val);
    localStorage.setItem("planly-shortcut-sidebar", val);
    setRecording(false);
  };

  const handleRadiusChange = (value: number) => {
    setRadius(value);
    localStorage.setItem("planly-radius", String(value));
    document.documentElement.style.setProperty("--radius", `${value}rem`);
  };

  const handleDrawerWidthChange = (value: number) => {
    setDrawerWidth(value);
    localStorage.setItem("planly-drawer-width", String(value));
    document.documentElement.style.setProperty("--drawer-width", `${value}px`);
  };

  const handleFontFamilyToggle = (font: string) => {
    setFontFamily((prev) => {
      let next: string[];
      if (prev.includes(font)) {
        next = prev.filter(f => f !== font);
      } else {
        next = [...prev, font];
      }
      if (next.length > 0) {
        localStorage.setItem("planly-font-family", next.join(","));
      } else {
        localStorage.removeItem("planly-font-family");
      }
      applyFontFamily(next);
      return next;
    });
  };

  const [movedFontIndex, setMovedFontIndex] = useState<number | null>(null);
  const [swappedFontIndex, setSwappedFontIndex] = useState<number | null>(null);
  const [movedFontDir, setMovedFontDir] = useState<"up" | "down" | null>(null);

  const handleFontFamilyReorder = (index: number, dir: "up" | "down") => {
    const target = dir === "up" ? index - 1 : index + 1;
    // Track BOTH the moved font and the swapped font by their NEW positions
    const movedNewPos = target;      // the clicked font ends up at target
    const swappedNewPos = index;      // the displaced font ends up at index
    setFontFamily((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      localStorage.setItem("planly-font-family", next.join(","));
      applyFontFamily(next);
      return next;
    });
    // Trigger slide animation — moved font slides in its direction,
    // swapped font slides the opposite direction
    setMovedFontIndex(movedNewPos);
    setSwappedFontIndex(swappedNewPos);
    setMovedFontDir(dir);
    setTimeout(() => { setMovedFontIndex(null); setSwappedFontIndex(null); setMovedFontDir(null); }, 250);
  };

  const handleFontSizeChange = (value: number) => {
    setFontSize(value);
    localStorage.setItem("planly-font-size", String(value));
    document.documentElement.style.setProperty("--app-font-size", `${value}px`);
  };

  const openFontPopover = () => {
    setFontOpen(true);
    if (!fontsLoaded) {
      listSystemFonts().then((fonts) => {
        setSystemFonts(fonts);
        setFontsLoaded(true);
      }).catch((e) => { console.error("Failed to list fonts:", e); });
    }
  };
  const handleExport = async () => {
    try {
      const filePath = await saveDialog({
        defaultPath: `planly-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!filePath) return; // user cancelled
      await exportToFile(filePath);
      setResultMsg(__("settings.exportSuccess"));
    } catch (e) {
      setResultMsg(__("settings.exportFailed") + String(e));
    }
  };

  const handleImport = async () => {
    try {
      const filePath = await openDialog({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!filePath || typeof filePath !== "string") return; // user cancelled
      const result = await importFromFile(filePath);
      setResultMsg(result + " " + __("settings.importedRecords") + " — " + __("settings.importReloading"));
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setResultMsg(__("settings.importFailed") + String(e));
    }
  };

  const [clearDialog, setClearDialog] = useState(false);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("1.0.0"));
  }, []);

  const handleClear = async () => {
    setClearDialog(true);
  };

  return (
    <div className="max-w-lg mx-auto animate-in fade-in duration-200">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text mb-4"
      >
        <ArrowLeft size={14} />
        {__("settings.back")}
      </button>

      <h2 className="text-sm font-semibold mb-4">{__("settings.title")}</h2>

      <div className="space-y-4">
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">{__("settings.appearance")}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[13px] text-foreground">{__("settings.language")}</label>
                <p className="text-[11px] text-muted-foreground">English / 中文</p>
              </div>
              <Popover open={langOpen} onOpenChange={setLangOpen}>
                <PopoverTrigger>
                  <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-input text-xs transition-colors hover:border-primary/50 text-foreground">
                    {lang === "en" ? "English" : "中文"}
                    <span className="text-[9px] text-muted-foreground">▼</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-32 p-1.5" side="bottom" sideOffset={4} align="end">
                  <button
                    onClick={() => { setLang("en"); setLangOpen(false); }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${lang === "en" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => { setLang("zh"); setLangOpen(false); }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${lang === "zh" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                  >
                    中文
                  </button>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] text-foreground">{__("settings.cornerRadius")}</label>
                <span className="text-xs text-muted-foreground">{radius.toFixed(2)}rem</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={radius}
                onChange={(e) => handleRadiusChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{__("settings.sharp")}</span>
                <span>{__("settings.round")}</span>
              </div>
            </div>
            {/* Font Family — multi-select with ordered fallback chain */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <label className="text-[13px] text-foreground">{__("settings.fontFamily")}</label>
                </div>
                <Popover open={fontOpen} onOpenChange={setFontOpen}>
                  <PopoverTrigger>
                    <button
                      onClick={openFontPopover}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-input text-xs transition-colors hover:border-primary/50 text-foreground"
                    >
                      {__("settings.fontFamilyAdd")}
                      <span className="text-[9px] text-muted-foreground">▼</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0" side="bottom" sideOffset={4} align="end">
                    <div className="max-h-64 overflow-y-auto p-1">
                      {systemFonts.map((f) => (
                        <button
                          key={f}
                          onClick={() => handleFontFamilyToggle(f)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors truncate flex items-center gap-2 ${fontFamily.includes(f) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
                          style={{ fontFamily: `'${f}', sans-serif` }}
                        >
                          {fontFamily.includes(f) && <span className="text-primary flex-shrink-0">✓</span>}
                          <span className="truncate">{f}</span>
                        </button>
                      ))}
                      {!fontsLoaded && (
                        <div className="px-2.5 py-2 text-xs text-muted-foreground text-center">Loading...</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {/* Selected font chain with reorder controls */}
              {fontFamily.length > 0 ? (
                <div className="space-y-1">
                  {fontFamily.map((f, i) => {
                    const animClass =
                      movedFontIndex === i && movedFontDir === "up" ? "animate-slide-up"
                      : movedFontIndex === i && movedFontDir === "down" ? "animate-slide-down"
                      : swappedFontIndex === i && movedFontDir === "up" ? "animate-slide-down"
                      : swappedFontIndex === i && movedFontDir === "down" ? "animate-slide-up"
                      : "";
                    return (
                    <div key={f} className={`flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1 ${animClass}`}>
                      <span className="text-[10px] text-muted-foreground/60 w-4 text-center flex-shrink-0">{i + 1}</span>
                      <span className="text-xs text-foreground flex-1 truncate" style={{ fontFamily: `'${f}', sans-serif` }}>{f}</span>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => handleFontFamilyReorder(i, "up")}
                          disabled={i === 0}
                          className="w-5 h-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-foreground/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                          title="Move up"
                        ><ChevronUp size={13} /></button>
                        <button
                          onClick={() => handleFontFamilyReorder(i, "down")}
                          disabled={i === fontFamily.length - 1}
                          className="w-5 h-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-foreground/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                          title="Move down"
                        ><ChevronDown size={13} /></button>
                        <button
                          onClick={() => handleFontFamilyToggle(f)}
                          className="w-5 h-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove"
                        ><X size={13} /></button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground/50 italic px-1">{__("settings.defaultFont")}</div>
              )}
            </div>
            {/* Font Size */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] text-foreground">{__("settings.fontSize")}</label>
                <span className="text-xs text-muted-foreground">{fontSize}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="20"
                step="1"
                value={fontSize}
                onChange={(e) => handleFontSizeChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{__("settings.small")}</span>
                <span>{__("settings.large")}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] text-foreground">{__("settings.drawerWidth")}</label>
                <span className="text-xs text-muted-foreground">{drawerWidth}px</span>
              </div>
              <input
                type="range"
                min="360"
                max="600"
                step="10"
                value={drawerWidth}
                onChange={(e) => handleDrawerWidthChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] text-foreground">{__("settings.defaultGroupIcon")}</label>
              </div>
              <div className="flex gap-1 flex-wrap">
                {(Object.entries({
                  folder: Folder,
                  briefcase: Briefcase,
                  star: Star,
                  heart: Heart,
                  book: BookOpen,
                  home: Home,
                  kanban: FolderKanban,
                }) as [string, typeof Folder][]).map(([name, Icon]) => (
                  <button
                    key={name}
                    onClick={() => { setGroupIcon(name); localStorage.setItem("planly-group-icon", name); }}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${groupIcon === name ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                    title={name}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[13px] text-foreground">{__("settings.colorfulIcons")}</label>
                <p className="text-[11px] text-muted-foreground">{__("settings.colorfulIconsDesc")}</p>
              </div>
              <button
                onClick={toggleColorfulIcons}
                className={`relative w-10 h-5 rounded-full transition-colors overflow-hidden ${colorfulIcons ? "bg-primary" : "bg-muted-foreground/20"}`}
              >
                <span className={`absolute top-0.5 left-0 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${colorfulIcons ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[13px] text-foreground">{__("settings.singleExpand")}</label>
                <p className="text-[11px] text-muted-foreground">{__("settings.singleExpandDesc")}</p>
              </div>
              <button
                onClick={toggleSingleExpand}
                className={`relative w-10 h-5 rounded-full transition-colors overflow-hidden ${singleExpand ? "bg-primary" : "bg-muted-foreground/20"}`}
              >
                <span className={`absolute top-0.5 left-0 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${singleExpand ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[13px] text-foreground">{__("settings.darkMode")}</label>
                <p className="text-[11px] text-muted-foreground">{__("settings.darkModeDesc")}</p>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative w-10 h-5 rounded-full transition-colors overflow-hidden ${darkMode ? "bg-primary" : "bg-muted-foreground/20"}`}
              >
                <span className={`absolute top-0.5 left-0 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${darkMode ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div>
              <label className="text-[13px] text-foreground mb-2 block">{__("settings.lightTheme") || "Light Theme"}</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "default", label: "Default", colors: ["#6366f1", "#f3f3f3", "#1e1e1e"] },
                  { id: "github", label: "GitHub", colors: ["#0969da", "#f6f8fa", "#1f2328"] },
                  { id: "notion", label: "Notion", colors: ["#2eaadc", "#fbfbfa", "#37352f"] },
                  { id: "minimal", label: "Minimal", colors: ["#18181b", "#fafafa", "#18181b"] },
                  { id: "ocean", label: "Ocean", colors: ["#0d9488", "#f0fdfa", "#134e4a"] },
                  { id: "sunset", label: "Sunset", colors: ["#d97706", "#fffbeb", "#1c1917"] },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setLightTheme(t.id)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs transition-colors ${lightTheme === t.id ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/30"}`}
                  >
                    <div className="flex -space-x-1">
                      {t.colors.map((c, i) => (
                        <span key={i} className="w-3 h-3 rounded-full ring-1 ring-border/30" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[13px] text-foreground mb-2 block">{__("settings.darkTheme") || "Dark Theme"}</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "default", label: "Default", colors: ["#18181b", "#1a1a1a", "#a0a0a0"] },
                  { id: "one-dark-pro", label: "One Dark Pro", colors: ["#61afef", "#282c34", "#abb2bf"] },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDarkTheme(t.id)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs transition-colors ${darkTheme === t.id ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/30"}`}
                  >
                    <div className="flex -space-x-1">
                      {t.colors.map((c, i) => (
                        <span key={i} className="w-3 h-3 rounded-full ring-1 ring-border/30" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">{__("settings.cardSections")}</h3>
          <div className="space-y-3">
            {(["dateTime", "time", "recurrence", "reminders", "group", "activity"] as const).map((section) => (
              <div key={section} className="flex items-center justify-between">
                <label className="text-[13px] text-foreground">{__(`card.show${section.charAt(0).toUpperCase() + section.slice(1)}`)}</label>
                <button
                  onClick={() => setCardSection(section, !cardSections[section])}
                  className={`relative w-10 h-5 rounded-full transition-colors overflow-hidden ${cardSections[section] ? "bg-primary" : "bg-muted-foreground/20"}`}
                >
                  <span className={`absolute top-0.5 left-0 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${cardSections[section] ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">{__("settings.shortcuts")}</h3>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] text-foreground">{__("settings.sidebarShortcut")}</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={recording ? __("settings.recording") : sidebarShortcut}
                readOnly
                onKeyDown={handleShortcutCapture}
                onFocus={() => setRecording(true)}
                onBlur={() => setRecording(false)}
                className={`flex-1 h-8 px-3 text-xs rounded-lg border bg-transparent outline-none cursor-pointer text-center font-mono transition-colors ${recording ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30"}`}
              />
              <button onClick={() => { setSidebarShortcut(""); localStorage.removeItem("planly-shortcut-sidebar"); }} className="px-2.5 py-1.5 text-[11px] rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors whitespace-nowrap">{__("taskForm.clear")}</button>
              <button onClick={() => { setSidebarShortcut("Ctrl+b"); localStorage.setItem("planly-shortcut-sidebar", "Ctrl+b"); }} className="px-2.5 py-1.5 text-[11px] rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors whitespace-nowrap">{__("settings.default")}</button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{__("settings.clickToRecord")}</p>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">{__("settings.data")}</h3>
          <div className="space-y-2">
            <button
              onClick={handleExport}
              className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-md text-xs hover:bg-surface-muted transition-colors"
            >
              <Download size={14} />
              {__("settings.exportBtn")}
            </button>
            <button
              onClick={handleImport}
              className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-md text-xs hover:bg-surface-muted transition-colors"
            >
              <Upload size={14} />
              {__("settings.importBtn")}
            </button>
            <button
              onClick={handleClear}
              className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-md text-xs text-destructive hover:text-destructive/90 hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={14} />
              {__("settings.clearDataBtn")}
            </button>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">{__("settings.about")}</h3>
          <div className="text-xs text-text-muted">
            <p>{appVersion ? `${__("settings.versionLabel")} ${appVersion}` : __("settings.version")}</p>
            <p>{__("settings.aboutText")}</p>
          </div>
        </div>
      </div>

      {resultMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10" onClick={() => setResultMsg("")}>
          <div className="bg-card rounded-xl border border-border/60 shadow-lg p-5 max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <p className="text-[13px] text-foreground mb-3">{resultMsg}</p>
            <button onClick={() => setResultMsg("")} className="w-full px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors">OK</button>
          </div>
        </div>
      )}

      {clearDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10" onClick={() => setClearDialog(false)}>
          <div className="bg-card rounded-xl border border-border/60 shadow-lg p-5 max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <p className="text-[13px] text-foreground mb-1">{__("settings.clearConfirmTitle")}</p>
            <p className="text-xs text-muted-foreground mb-4">{__("settings.clearConfirmText")}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setClearDialog(false)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors">{__("delete.cancel")}</button>
              <button onClick={async () => { setClearDialog(false); try { const msg = await clearAllData(); setResultMsg(msg); window.location.reload(); } catch (e) { setResultMsg(__("settings.clearFailed") + String(e)); } }} className="px-3 py-1.5 text-xs rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">{__("settings.clearDataBtn")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
