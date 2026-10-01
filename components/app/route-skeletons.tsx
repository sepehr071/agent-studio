import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * Route skeletons — glass-consistent loading placeholders that mirror each
 * screen's real layout proportions so the swap to live content doesn't jump.
 * The (app) sidebar persists during navigation; these cover the page area only.
 *
 * RTL note: alignment uses logical utilities (ms/me/start/end) so the mirrored
 * layout matches the real Persian-RTL screens. Chat bubbles alternate on the
 * logical start/end edges exactly like the live thread.
 */

/** A header row that matches the sticky glass titlebars across screens. */
function HeaderBar({
  withAction = true,
}: {
  withAction?: boolean;
}) {
  return (
    <div className="glass-strong flex items-center justify-between gap-3 border-x-0 border-t-0 px-6 py-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-7 rounded-lg" />
        <Skeleton className="h-4 w-32 rounded-md" />
      </div>
      {withAction && <Skeleton className="h-8 w-28 rounded-lg" />}
    </div>
  );
}

/**
 * A single glass card placeholder: avatar block, two title lines, a body
 * paragraph, and a footer meta line. Tuned to the assistants/series card shape.
 */
function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/5 rounded-md" />
          <Skeleton className="h-3 w-2/5 rounded-md" />
        </div>
        <Skeleton className="size-7 shrink-0 rounded-md" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
            key={i}
            className={cn("h-3 rounded-md", i === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
      <Skeleton className="mt-1 h-3 w-24 rounded-md" />
    </div>
  );
}

/**
 * Responsive card grid — assistants, series, projects boards. Wrapped in the
 * same centered max-width + padding the real grids use.
 */
export function CardGridSkeleton({
  count = 6,
  columns = 3,
  withHeader = true,
  maxWidth = "max-w-5xl",
}: {
  count?: number;
  columns?: 2 | 3;
  withHeader?: boolean;
  maxWidth?: string;
}) {
  return (
    <div className="h-dvh overflow-hidden">
      <div className={cn("mx-auto w-full space-y-6 px-6 py-8", maxWidth)}>
        {withHeader && (
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-3 w-64 rounded-md" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        )}
        <div
          className={cn(
            "grid grid-cols-1 gap-3 sm:grid-cols-2",
            columns === 3 && "lg:grid-cols-3",
          )}
        >
          {Array.from({ length: count }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cards
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Vertical list of glass rows — meetings list, knowledge results, project
 * conversation lists. Each row: leading icon block, two text lines, trailing
 * status pill.
 */
export function ListRowsSkeleton({
  count = 7,
  maxWidth = "max-w-4xl",
  withHeader = true,
}: {
  count?: number;
  maxWidth?: string;
  withHeader?: boolean;
}) {
  return (
    <div className="h-dvh overflow-hidden">
      <div className={cn("mx-auto w-full space-y-6 px-6 py-8", maxWidth)}>
        {withHeader && (
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-3 w-72 rounded-md" />
            </div>
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        )}
        <ul className="space-y-2.5">
          {Array.from({ length: count }).map((_, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
              key={i}
              className="glass flex items-center gap-3 rounded-xl px-4 py-3"
            >
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5 rounded-md" />
                <Skeleton className="h-3 w-3/5 rounded-md" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Chat thread — alternating user (logical-end) and assistant (logical-start)
 * bubbles, a sticky titlebar, and a composer bar pinned to the bottom. Used by
 * "/" and /chat/[id].
 */
export function ChatThreadSkeleton() {
  // Widths chosen so the cadence reads as a real back-and-forth conversation.
  const bubbles: { side: "start" | "end"; w: string; lines: number }[] = [
    { side: "end", w: "w-2/5", lines: 1 },
    { side: "start", w: "w-3/4", lines: 3 },
    { side: "end", w: "w-1/3", lines: 1 },
    { side: "start", w: "w-2/3", lines: 2 },
    { side: "end", w: "w-1/2", lines: 1 },
    { side: "start", w: "w-4/5", lines: 4 },
  ];

  return (
    <div className="mx-auto flex h-full min-w-0 flex-1 flex-col px-4 lg:max-w-4xl">
      {/* Titlebar */}
      <div className="glass mt-2 flex items-center justify-between rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="size-2 rounded-full" />
          <Skeleton className="h-3.5 w-36 rounded-md" />
        </div>
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>

      {/* Thread */}
      <div className="flex-1 space-y-6 overflow-hidden py-6">
        {bubbles.map((b, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder bubbles
            key={i}
            className={cn(
              "flex",
              b.side === "end" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[80%] space-y-2 rounded-2xl p-3.5",
                b.side === "end"
                  ? "rounded-ee-sm bg-primary/10"
                  : "glass rounded-es-sm",
                b.w,
              )}
            >
              {Array.from({ length: b.lines }).map((_, j) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder lines
                  key={j}
                  className={cn(
                    "h-3 rounded-md",
                    j === b.lines - 1 ? "w-1/2" : "w-full",
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="glass mb-2 space-y-3 rounded-2xl p-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-32 rounded-md" />
          </div>
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t py-2">
        <Skeleton className="h-2.5 w-20 rounded-sm" />
        <Skeleton className="hidden h-2.5 w-40 rounded-sm sm:block" />
        <Skeleton className="h-2.5 w-16 rounded-sm" />
      </div>
    </div>
  );
}

/**
 * Two-pane detail — a fixed-width rail (section nav / folder tree) beside a
 * flowing content column. Used by meetings/[id], series/[id], projects/[id],
 * knowledge (sidebar + main).
 */
export function TwoPaneDetailSkeleton({
  railWidth = "w-56",
  railItems = 7,
}: {
  railWidth?: string;
  railItems?: number;
}) {
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden">
      {/* Rail */}
      <aside
        className={cn(
          "glass hidden shrink-0 flex-col gap-2 border-e-0 p-3 sm:flex",
          railWidth,
        )}
      >
        <Skeleton className="h-8 w-full rounded-lg" />
        <div className="my-1 h-px bg-border/60" />
        {Array.from({ length: railItems }).map((_, i) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
            key={i}
            className="h-7 w-full rounded-lg"
          />
        ))}
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar />
        <div className="min-h-0 flex-1 space-y-6 overflow-hidden p-6">
          {/* Title block */}
          <div className="space-y-2.5">
            <Skeleton className="h-6 w-2/5 rounded-md" />
            <Skeleton className="h-3.5 w-3/5 rounded-md" />
          </div>
          {/* Body cards */}
          <div className="glass space-y-3 rounded-2xl p-5">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-4/5 rounded-md" />
          </div>
          <div className="glass space-y-3 rounded-2xl p-5">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-3/4 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Image studio — header, tab strip, then a two-column split: a tall glass form
 * (model picker, prompt, chips) beside a square preview placeholder.
 */
export function StudioSkeleton() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="glass-strong flex items-center gap-3 border-x-0 border-t-0 px-6 py-3">
        <Skeleton className="size-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-3 w-44 rounded-md" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        {/* Tab strip */}
        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {/* Form column */}
          <div className="glass space-y-5 rounded-xl p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder fields
                key={i}
                className="space-y-2"
              >
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder chips
                  key={i}
                  className="h-7 w-20 rounded-full"
                />
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Preview column */}
          <div className="glass grid min-h-[24rem] place-items-center rounded-xl p-4">
            <Skeleton className="aspect-square w-full max-w-md rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Settings — back-link header then a single centered column of labeled form
 * field placeholders grouped in glass cards.
 */
export function SettingsSkeleton() {
  return (
    <div className="h-dvh overflow-hidden">
      <div className="glass-strong flex items-center gap-3 border-x-0 border-t-0 px-6 py-3">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
      <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
        {Array.from({ length: 2 }).map((_, group) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder groups
            key={group}
            className="glass space-y-5 rounded-2xl p-5"
          >
            <Skeleton className="h-4 w-32 rounded-md" />
            {Array.from({ length: 3 }).map((_, field) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder fields
                key={field}
                className="space-y-2"
              >
                <Skeleton className="h-3 w-28 rounded-md" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A single chart panel — title + a fixed-height plot area. */
function ChartPanelSkeleton({ height }: { height: string }) {
  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-5">
      <Skeleton className="h-4 w-44 rounded-md" />
      <Skeleton className={cn("w-full rounded-lg", height)} />
    </div>
  );
}

/**
 * Usage dashboard — KPI tile row, a wide spend panel, then a two-up grid of
 * chart panels. Heights mirror the real Recharts containers (280 / 256px).
 */
export function ChartDashboardSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="glass flex items-center gap-2 border-b px-6 py-4">
        <Skeleton className="size-5 rounded-sm" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-hidden p-6">
        {/* KPI tiles */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder tiles
              key={i}
              className="glass flex flex-col gap-3 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded-sm" />
                <Skeleton className="h-3 w-16 rounded-md" />
              </div>
              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
          ))}
        </div>

        {/* Spend over time */}
        <ChartPanelSkeleton height="h-[280px]" />

        {/* Per-model + per-feature */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartPanelSkeleton height="h-[280px]" />
          <ChartPanelSkeleton height="h-64" />
        </div>
      </div>
    </div>
  );
}
