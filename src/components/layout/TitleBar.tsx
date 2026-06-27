import { useState, useEffect } from "react";
import { Minus, Square, X, Copy, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useUIStore } from "../../stores/uiStore";
import { useT } from "../../i18n/translations";

export default function TitleBar() {
  const { __ } = useT();
  const [maximized, setMaximized] = useState(false);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(() => {
      win.isMaximized().then(setMaximized);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleMaximize = () => { getCurrentWindow().toggleMaximize(); setMaximized(!maximized); };
  const handleClose = () => getCurrentWindow().close();
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    getCurrentWindow().startDragging();
  };

  return (
    <div className="h-8 flex items-center shrink-0 select-none" onMouseDown={handleDragStart}>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => toggleSidebar()}
        aria-label={sidebarOpen ? __("sidebar.collapseSidebar") : __("sidebar.expandSidebar")}
        className="h-8 w-11 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 rounded-lg opacity-0 hover:opacity-100"
        title={sidebarOpen ? __("sidebar.collapseSidebar") : __("sidebar.expandSidebar")}
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>
      <div className="flex-1 h-full" />
      <button
        onClick={handleMinimize}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={__("titlebar.minimize")}
        className="h-8 w-11 inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-100"
      >
        <Minus size={15} />
      </button>
      <button
        onClick={handleMaximize}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={maximized ? __("titlebar.restore") : __("titlebar.maximize")}
        className="h-8 w-11 inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-100"
      >
        {maximized ? <Copy size={14} className="rotate-180" /> : <Square size={14} />}
      </button>
      <button
        onClick={handleClose}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={__("titlebar.close")}
        className="h-8 w-11 inline-flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all duration-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}
