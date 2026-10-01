"use client";

/*
 * Root-level error boundary. This replaces the root layout when active, so
 * globals.css, the Vazirmatn font, and the theme CSS variables may not be
 * loaded — everything here is inline and self-contained. It renders its own
 * <html dir="rtl" lang="fa"> and <body> per Next 16 conventions.
 *
 * Theme: we read the persisted `studio-theme` choice (falling back to the OS
 * preference) once on mount and flip a small set of inline colors so the panel
 * doesn't flash the wrong scheme.
 */

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function resolveTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("studio-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(resolveTheme());
    console.error(error);
  }, [error]);

  const dark = theme === "dark";
  const palette = {
    bg: dark ? "#0c0d10" : "#f6f7f9",
    surface: dark ? "rgba(28,30,36,0.72)" : "rgba(255,255,255,0.72)",
    border: dark ? "rgba(255,255,255,0.10)" : "rgba(15,18,28,0.10)",
    fg: dark ? "#e8eaed" : "#16181d",
    muted: dark ? "#9aa0aa" : "#5b616e",
    danger: dark ? "#ff8a8a" : "#d04545",
    dangerBg: dark ? "rgba(208,69,69,0.16)" : "rgba(208,69,69,0.10)",
    codeBg: dark ? "rgba(0,0,0,0.35)" : "rgba(15,18,28,0.05)",
    accent: dark ? "#7fb4ff" : "#2f6df0",
    accentFg: "#ffffff",
  };

  return (
    <html dir="rtl" lang="fa">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          background: palette.bg,
          color: palette.fg,
          fontFamily:
            "'Vazirmatn Variable', 'Vazirmatn', system-ui, -apple-system, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <title>خطا — استودیو</title>
        <main
          style={{
            width: "100%",
            maxWidth: "28rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            textAlign: "center",
            padding: "2rem",
            borderRadius: "1rem",
            background: palette.surface,
            border: `1px solid ${palette.border}`,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: dark
              ? "0 24px 60px rgba(0,0,0,0.5)"
              : "0 24px 60px rgba(15,18,28,0.12)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "1rem",
              background: palette.dangerBg,
              color: palette.danger,
            }}
          >
            <svg
              fill="none"
              height="28"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="28"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "1.125rem",
                fontWeight: 700,
              }}
            >
              مشکلی پیش آمد
            </h1>
            <p style={{ margin: 0, fontSize: "0.875rem", color: palette.muted }}>
              برنامه با خطای غیرمنتظره‌ای روبه‌رو شد. می‌توانید دوباره تلاش کنید.
            </p>
          </div>

          {error.message ? (
            <pre
              dir="ltr"
              style={{
                margin: 0,
                width: "100%",
                maxHeight: "8rem",
                overflow: "auto",
                textAlign: "left",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                background: palette.codeBg,
                color: palette.muted,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: "0.6875rem",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </pre>
          ) : null}

          <button
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
              background: palette.accent,
              color: palette.accentFg,
              fontSize: "0.875rem",
              fontWeight: 600,
              fontFamily: "inherit",
            }}
            type="button"
          >
            <svg
              fill="none"
              height="16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            تلاش دوباره
          </button>
        </main>
      </body>
    </html>
  );
}
