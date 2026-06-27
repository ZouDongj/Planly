import { useState, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "../../i18n/translations";

interface Props {
  color: string;
  onChange: (color: string) => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [f(0), f(8), f(4)];
}

function mixRgb(a: number[], b: number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function ColorPicker({ color: initialColor, onChange, children, className, style }: Props) {
  const { __ } = useT();
  const [hex, setHex] = useState(initialColor);
  const [open, setOpen] = useState(false);
  const satRef = useRef<HTMLDivElement>(null);

  // Sync state when popover opens
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setHex(initialColor);
      setHsl(hexToHsl(initialColor));
    }
    setOpen(o);
  };

  // Parse hex to HSL
  function hexToHsl(color: string) {
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    let h = 0;
    if (max !== min) {
      if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / (max - min) + 2) / 6;
      else h = ((r - g) / (max - min) + 4) / 6;
    }
    return { h, s, l };
  }

  const [hsl, setHsl] = useState(() => hexToHsl(initialColor));

  const updateColor = (hue: number, sat: number, lit: number) => {
    setHsl({ h: hue, s: sat, l: lit });
    // Mix colors to match the CSS gradient: blend hue with white by sat, then with black by (1-lit)
    const hueRgb = hslToRgb(hue, 1, 0.5);
    const white = [1, 1, 1];
    const black = [0, 0, 0];
    const mixed = mixRgb(mixRgb(white, hueRgb, sat), black, 1 - lit);
    const hex = rgbToHex(mixed[0], mixed[1], mixed[2]);
    setHex(hex);
    onChange(hex);
  };

  const handleHueClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hue = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    updateColor(hue, hsl.s, hsl.l);
  };

  const handleSatClick = (e: React.MouseEvent) => {
    if (!satRef.current) return;
    const rect = satRef.current.getBoundingClientRect();
    const sat = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const lit = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    updateColor(hsl.h, sat, lit);
  };

  const handleHexChange = (val: string) => {
    setHex(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setHsl(hexToHsl(val));
      onChange(val);
    }
  };

  const triggerBtn = children ? (
    <button className={className} style={style}>{children}</button>
  ) : (
    <button className={className ?? "relative flex items-center gap-2 w-full h-7 rounded-lg cursor-pointer border border-border/60 hover:border-primary/30 bg-muted/30 px-2 text-[10px] text-muted-foreground"} style={style}>
      {__("colorPicker.custom")}
      <span className="w-4 h-4 rounded-full border border-border/30 flex-shrink-0 ml-auto" style={{ backgroundColor: initialColor }} />
    </button>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={triggerBtn} />
      <PopoverContent className="w-52 p-3" align="start" sideOffset={4}>
        {/* Saturation/Brightness area */}
        <div className="mb-2">
          <div
            ref={satRef}
            onClick={handleSatClick}
            className="w-full h-28 rounded-lg cursor-crosshair relative overflow-hidden"
            style={{ background: `linear-gradient(to right, #fff, hsl(${hsl.h * 360}, 100%, 50%))` }}
          >
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #000, transparent)" }} />
            <div
              className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${hsl.s * 100}%`, top: `${(1 - hsl.l) * 100}%` }}
            />
          </div>
        </div>
        {/* Hue slider */}
        <div className="mb-2">
          <div
            onClick={handleHueClick}
            className="w-full h-3 rounded-full cursor-pointer relative"
            style={{ background: "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)" }}
          >
            <div
              className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 top-1/2 pointer-events-none"
              style={{ left: `${hsl.h * 100}%` }}
            />
          </div>
        </div>
        {/* Hex input */}
        <input
          value={hex}
          onChange={(e) => handleHexChange(e.target.value)}
          onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(hex)) setHex(initialColor); }}
          className="w-full h-7 text-xs rounded-md border border-border px-2 bg-transparent font-mono text-center outline-none focus:border-primary/50"
          placeholder="#6366f1"
        />
      </PopoverContent>
    </Popover>
  );
}
