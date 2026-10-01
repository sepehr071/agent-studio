"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * App-wide toaster. Theme-agnostic on purpose — the glass tokens it reads
 * (`--popover`, `--border`) already flip with `.dark`, so no theme prop or
 * observer is needed.
 */
const Toaster = (props: ToasterProps) => (
  <Sonner
    dir="rtl"
    position="bottom-center"
    className="toaster group"
    toastOptions={{ classNames: { toast: "glass-strong" } }}
    style={
      {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--success-bg": "color-mix(in oklab, var(--ok) 16%, var(--popover))",
        "--success-text": "var(--ok)",
        "--error-bg": "color-mix(in oklab, var(--err) 16%, var(--popover))",
        "--error-text": "var(--err)",
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };
