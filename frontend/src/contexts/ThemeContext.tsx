/* eslint-disable react/only-export-components -- Provider and its context hook are intentionally colocated. */
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
type Theme = "light" | "dark" | "system";
const ThemeContext = createContext<{
  theme: Theme;
  dark: boolean;
  setTheme: (theme: Theme) => void;
}>({ theme: "dark", dark: true, setTheme: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("danava-theme");
      return ["light", "dark", "system"].includes(saved || "")
        ? (saved as Theme)
        : "dark";
    } catch {
      return "dark";
    }
  });
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const dark = theme === "dark" || (theme === "system" && systemDark);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("danava-theme", theme);
    } catch {}
  }, [theme, dark]);
  return (
    <ThemeContext.Provider value={{ theme, dark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
