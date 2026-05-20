import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeId =
  | "warm"
  | "lavender"
  | "sage"
  | "rose"
  | "sky"
  | "dark-warm"
  | "dark-lavender"
  | "dark-sage"
  | "dark-rose"
  | "dark-midnight";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  dark: boolean;
  swatch: { bg: string; accent: string };
}

export const THEMES: ThemeDefinition[] = [
  { id: "warm",          label: "Warm",          dark: false, swatch: { bg: "#faf8f5", accent: "#c1694f" } },
  { id: "lavender",      label: "Lavender",      dark: false, swatch: { bg: "#f7f5fc", accent: "#7c5cbf" } },
  { id: "sage",          label: "Sage",          dark: false, swatch: { bg: "#f4faf6", accent: "#4a8c5c" } },
  { id: "rose",          label: "Rose",          dark: false, swatch: { bg: "#fdf5f7", accent: "#c1506a" } },
  { id: "sky",           label: "Sky",           dark: false, swatch: { bg: "#f4f9fd", accent: "#3d87c1" } },
  { id: "dark-warm",     label: "Dark Warm",     dark: true,  swatch: { bg: "#1a1410", accent: "#d4714a" } },
  { id: "dark-lavender", label: "Dark Lavender", dark: true,  swatch: { bg: "#16111e", accent: "#9b7fd4" } },
  { id: "dark-sage",     label: "Dark Sage",     dark: true,  swatch: { bg: "#0f1812", accent: "#52a870" } },
  { id: "dark-rose",     label: "Dark Rose",     dark: true,  swatch: { bg: "#1a1015", accent: "#d45e7a" } },
  { id: "dark-midnight", label: "Midnight",      dark: true,  swatch: { bg: "#0c1220", accent: "#5a96d4" } },
];

const STORAGE_KEY = "noted-theme";
const DEFAULT_THEME: ThemeId = "warm";

function applyTheme(id: ThemeId): void {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  document.documentElement.setAttribute("data-theme", id);
  if (theme.dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return saved && THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME;
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    localStorage.setItem(STORAGE_KEY, id);
    setThemeState(id);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
