"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import type { MeetingRow } from "@/lib/db/schema";

export type MeetingStatus = MeetingRow["status"];

// ---------------------------------------------------------------- sections

/**
 * Stable identifiers for the meeting-detail section rail. The string value
 * doubles as the URL hash (`#summary`, `#actions`, …) so a refresh restores
 * the active panel. Order here is the canonical display order.
 */
export type MeetingSectionId =
  | "summary"
  | "actions"
  | "decisions"
  | "qa"
  | "open"
  | "minutes"
  | "email"
  | "transcript"
  | "speakers";

/** A rail entry: which section, its label, count badge, and data presence. */
export interface MeetingSection {
  id: MeetingSectionId;
  label: string;
  /** Optional count rendered as a small badge (omit when not meaningful). */
  count?: number;
  /** Whether this section has any content; data-less sections are hidden. */
  hasData: boolean;
}

/** Persian label for each pipeline status. */
export const STATUS_LABEL: Record<MeetingStatus, string> = {
  uploaded: "آماده پردازش",
  transcribing: "در حال رونویسی",
  summarizing: "در حال خلاصه‌سازی",
  done: "آماده",
  failed: "ناموفق",
  cancelled: "لغو شده",
};

/** True while the pipeline is mid-flight (UI should poll). */
export function isActiveStatus(status: MeetingStatus): boolean {
  return status === "transcribing" || status === "summarizing";
}

type Tone = "ok" | "warn" | "err" | "muted";

const STATUS_TONE: Record<MeetingStatus, Tone> = {
  uploaded: "muted",
  transcribing: "warn",
  summarizing: "warn",
  done: "ok",
  failed: "err",
  cancelled: "muted",
};

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-ok/18 text-ok border border-ok/25",
  warn: "bg-warn/18 text-warn border border-warn/25",
  err: "bg-err/18 text-err border border-err/25",
  muted: "bg-foreground/8 text-fg-3 border border-foreground/15",
};

/** A glass-friendly status pill using the semantic token ramp. */
export function StatusBadge({ status }: { status: MeetingStatus }) {
  const tone = STATUS_TONE[status];
  const active = isActiveStatus(status);
  return (
    <Badge variant="ghost" className={`gap-1.5 ${TONE_CLASS[tone]}`}>
      <span
        data-state={tone === "err" ? "error" : active ? "active" : "idle"}
        className="status-dot"
        aria-hidden
      />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** `4215` → `"01:10:15"` / `"05:45"`. Returns null for missing/invalid input. */
export function formatDuration(totalSeconds: number | null): string | null {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return null;
  }
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

const DATE_FMT = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const TIME_FMT = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Persian calendar date, e.g. «۱۵ خرداد ۱۴۰۵». */
export function formatDate(date: Date): string {
  return DATE_FMT.format(date);
}

/** Persian date + time. */
export function formatDateTime(date: Date): string {
  return `${DATE_FMT.format(date)} • ${TIME_FMT.format(date)}`;
}

/** Stable accent color for a diarized speaker label, drawn from the chart ramp. */
export function speakerColor(speakerId: string): string {
  const palette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  let hash = 0;
  for (let i = 0; i < speakerId.length; i++) {
    hash = (hash * 31 + speakerId.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

export const EMAIL_TONE_OPTIONS: { value: string; label: string }[] = [
  { value: "formal", label: "رسمی" },
  { value: "casual", label: "دوستانه" },
];

export function toneLabel(tone: string | null | undefined): string {
  return tone === "casual" ? "دوستانه" : "رسمی";
}

const NUMBER_FMT = new Intl.NumberFormat("fa-IR");

/** Latin digits → Persian (`12` → «۱۲»), grouping included. */
export function formatNumber(value: number): string {
  return NUMBER_FMT.format(value);
}

/**
 * A KPI chip for the overview header: an icon, a value, and a quiet label.
 * Used for duration, speaker count, action-item count and the series name.
 */
export function KpiChip({
  icon,
  value,
  label,
  dir,
  tint,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  /** Override flow direction for values that are inherently LTR (durations). */
  dir?: "ltr" | "rtl";
  /** Optional chart-ramp accent (`--chart-N`); default is the primary tint. */
  tint?: 1 | 2 | 3 | 4 | 5;
}) {
  return (
    <div className="glass flex items-center gap-2.5 rounded-xl px-3.5 py-2.5">
      <span
        aria-hidden
        className={`grid size-8 shrink-0 place-items-center rounded-lg ${
          tint ? "" : "bg-primary/10 text-primary"
        }`}
        style={
          tint
            ? {
                background: `color-mix(in oklab, var(--chart-${tint}) 10%, transparent)`,
                color: `var(--chart-${tint})`,
              }
            : undefined
        }
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p
          dir={dir}
          className="truncate font-heading font-semibold text-fg-0 text-sm leading-tight"
        >
          {value}
        </p>
        <p className="truncate text-fg-4 text-xs leading-tight">{label}</p>
      </div>
    </div>
  );
}

/** Subscribe to `hashchange`; returns the unsubscribe. */
function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** Current `#hash` value without the leading `#` (empty string on the server). */
function readHash(): string {
  return typeof window === "undefined"
    ? ""
    : window.location.hash.replace(/^#/, "");
}

/**
 * Two-way bind a section id to the URL hash. Refresh keeps the active panel;
 * back/forward and manual `#hash` edits update state. The first valid section
 * is the fallback when the hash is empty or unknown.
 *
 * Built on `useSyncExternalStore` so it is SSR-safe (server snapshot is the
 * fallback) and free of mount-time `setState`. The active id is *derived* from
 * the live hash on every render, so when a section disappears after a
 * regenerate the panel snaps back to the fallback with no extra effect.
 *
 * `available` is the list of currently-visible section ids.
 */
export function useHashSection(
  available: MeetingSectionId[],
): [MeetingSectionId, (id: MeetingSectionId) => void] {
  const fallback = available[0];
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");

  const active: MeetingSectionId = available.includes(
    hash as MeetingSectionId,
  )
    ? (hash as MeetingSectionId)
    : fallback;

  const select = useCallback((id: MeetingSectionId) => {
    // replaceState keeps the back button meaningful (no per-tab history spam)
    // while still surviving a refresh. Dispatch hashchange so the external
    // store re-reads — replaceState alone does not fire it.
    window.history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  return [active, select];
}
