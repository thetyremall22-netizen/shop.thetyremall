"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "./icons";

type Theme = "dark" | "light";
const KEY = "ttm-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const cur = (document.documentElement.dataset.theme as Theme) || "dark";
    setTheme(cur);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch {}
  }

  return (
    <button
      onClick={toggle}
      className={`grid size-10 place-items-center rounded-lg text-fg hover:text-volt ${className}`}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? <Sun width={20} height={20} /> : <Moon width={20} height={20} />}
    </button>
  );
}
