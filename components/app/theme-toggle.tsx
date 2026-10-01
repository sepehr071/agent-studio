"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark";

const STORAGE_KEY = "studio-theme";

/** Read the theme the no-FOUC script already applied to <html>. */
function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode / storage disabled — toggle still works for the session
  }
}

/**
 * Light/dark switch. The actual first-paint theme is set by an inline script in
 * the document head (no FOUC); this component only mirrors and mutates it.
 * `mounted` gates the icon so SSR (always light) never mismatches the client.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(currentTheme());
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "روشن کردن پوسته" : "تیره کردن پوسته"}
      aria-pressed={isDark}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      onClick={toggle}
      title={isDark ? "حالت روشن" : "حالت تیره"}
      type="button"
    >
      {mounted && isDark ? (
        <MoonIcon className="size-4" />
      ) : (
        <SunIcon className="size-4" />
      )}
    </button>
  );
}
