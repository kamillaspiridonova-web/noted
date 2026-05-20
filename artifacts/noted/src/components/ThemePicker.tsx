import { useTheme, THEMES } from "@/hooks/use-theme";
import type { ThemeDefinition } from "@/hooks/use-theme";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  const lightThemes = THEMES.filter((t) => !t.dark);
  const darkThemes = THEMES.filter((t) => t.dark);

  return (
    <div className="px-3 pt-2 pb-3 border-t border-sidebar-border">
      <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2 px-1">
        Theme
      </p>
      <div className="flex gap-1.5 mb-1.5">
        {lightThemes.map((t) => (
          <Swatch key={t.id} t={t} active={theme === t.id} onSelect={() => setTheme(t.id)} />
        ))}
      </div>
      <div className="flex gap-1.5">
        {darkThemes.map((t) => (
          <Swatch key={t.id} t={t} active={theme === t.id} onSelect={() => setTheme(t.id)} />
        ))}
      </div>
    </div>
  );
}

function Swatch({
  t,
  active,
  onSelect,
}: {
  t: ThemeDefinition;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      title={t.label}
      onClick={onSelect}
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: t.swatch.bg,
        border: active ? `2.5px solid ${t.swatch.accent}` : "2px solid transparent",
        outline: active ? `2px solid ${t.swatch.accent}55` : "1.5px solid rgba(128,128,128,0.25)",
        outlineOffset: active ? 2 : 0,
        position: "relative",
        cursor: "pointer",
        transition: "transform 0.12s, outline 0.12s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.15)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
    >
      <span
        style={{
          position: "absolute",
          bottom: 3,
          right: 3,
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: t.swatch.accent,
        }}
      />
    </button>
  );
}
