"use client";

import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  Loader2Icon,
  MessageSquarePlusIcon,
  MicIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SettingsIcon,
  Trash2Icon,
  Volume2Icon,
  XCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteMeetingAction,
  discussMeetingAction,
  updateMeetingAction,
} from "@/lib/actions/meetings";
import { setComposerSeed } from "@/lib/composer-handoff";
import { cn } from "@/lib/utils";
import type {
  MeetingRow,
  MeetingSeriesRow,
  MeetingSpeakerRow,
  MeetingSummaryRow,
  MeetingTranscriptRow,
} from "@/lib/db/schema";
import { MeetingSectionContent } from "./meeting-section-content";
import { MeetingSectionRail } from "./meeting-section-rail";
import { MeetingSettingsDialog } from "./meeting-settings-dialog";
import {
  formatDate,
  formatDuration,
  isActiveStatus,
  type MeetingSection,
  type MeetingSectionId,
  StatusBadge,
  type MeetingStatus,
  useHashSection,
} from "./meeting-shared";

interface StatusPayload {
  status: MeetingStatus;
  stage: string | null;
  error: string | null;
  running: boolean;
  latestSummaryId: string | null;
  /** Bumps whenever the summary row is (re)written — incl. each streamed partial. */
  summaryRevision: number;
}

const CANCELLED_SENTINEL = "لغو شده توسط کاربر";

/** Build the visible section list (skips data-less sections). */
function buildSections(
  summary: MeetingSummaryRow | null,
  hasTranscript: boolean,
  speakerCount: number,
): MeetingSection[] {
  const actions = summary?.actionItemsJson ?? [];
  const decisions = summary?.decisionsJson ?? [];
  const qa = summary?.qaJson ?? [];
  const open = summary?.openQuestionsJson ?? [];
  const minutes = summary?.minutesJson ?? [];

  const all: (MeetingSection | null)[] = [
    summary ? { id: "summary", label: "نمای کلی", hasData: true } : null,
    { id: "actions", label: "اقدامات", count: actions.length, hasData: actions.length > 0 },
    { id: "decisions", label: "تصمیم‌ها", count: decisions.length, hasData: decisions.length > 0 },
    { id: "qa", label: "پرسش‌وپاسخ", count: qa.length, hasData: qa.length > 0 },
    { id: "open", label: "موارد باز", count: open.length, hasData: open.length > 0 },
    // Segment count is noise at this granularity (hundreds) — no badge.
    { id: "minutes", label: "صورت‌جلسه", hasData: minutes.length > 0 },
    summary?.emailSubject || summary?.emailBody
      ? { id: "email", label: "پیش‌نویس ایمیل", hasData: true }
      : null,
    hasTranscript ? { id: "transcript", label: "رونوشت", hasData: true } : null,
    speakerCount > 0
      ? { id: "speakers", label: "بلندگوها", count: speakerCount, hasData: true }
      : null,
  ];

  return all.filter((s): s is MeetingSection => s !== null && s.hasData);
}

/**
 * Subtle "summary still streaming" indicator shown above the section content
 * while `status === 'summarizing'` and a partial summary already exists. The
 * sections themselves fill in progressively via polling + `router.refresh()`.
 */
function SummarizingPartialBanner() {
  return (
    <div
      className="glass flex items-center gap-2.5 rounded-xl px-4 py-2.5"
      role="status"
      aria-live="polite"
    >
      <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
      <Shimmer variant="accent" className="text-fg-2 text-sm">
        در حال تکمیل خلاصه…
      </Shimmer>
    </div>
  );
}

export function MeetingDetailShell({
  meeting,
  speakers,
  transcript,
  summary,
  series,
}: {
  meeting: MeetingRow;
  speakers: MeetingSpeakerRow[];
  transcript: MeetingTranscriptRow | null;
  summary: MeetingSummaryRow | null;
  series: MeetingSeriesRow[];
}) {
  const router = useRouter();

  // Live status overrides the server-rendered row while polling.
  const [status, setStatus] = useState<MeetingStatus>(meeting.status);
  const [stage, setStage] = useState<string | null>(meeting.stage ?? null);
  const [error, setError] = useState<string | null>(meeting.errorMessage ?? null);

  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [discussing, startDiscuss] = useTransition();
  const [, startDelete] = useTransition();

  const active = isActiveStatus(status);
  const cancelled = status === "failed" && error === CANCELLED_SENTINEL;

  // Track the summary id we mounted with; when polling sees a newer one (or a
  // status transition to done), refresh to pull server-rendered artifacts.
  const mountedSummaryId = useRef(meeting.latestSummaryId ?? null);
  // Track the last summary revision we refreshed for. The streaming summarizer
  // rewrites ONE row in place while `summarizing`, so latestSummaryId stays
  // constant; this token moves on every partial write and drives the refresh
  // that progressively fills the panel.
  const lastRevision = useRef(meeting.updatedAt?.getTime() ?? 0);

  // ---------------- status poller ----------------
  useEffect(() => {
    if (!isActiveStatus(status)) return;
    let cancelledPoll = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/meetings/${meeting.id}/status`, {
          cache: "no-store",
        });
        if (!res.ok || cancelledPoll) return;
        const data = (await res.json()) as StatusPayload;
        if (cancelledPoll) return;

        setStatus(data.status);
        setStage(data.stage);
        setError(data.error);

        const reachedTerminal = !isActiveStatus(data.status);
        const newerSummary =
          data.latestSummaryId &&
          data.latestSummaryId !== mountedSummaryId.current;
        // During `summarizing` the partial row is rewritten in place: the id is
        // stable but `summaryRevision` advances. Refresh on that too so the
        // exec summary / decisions / action items grow as they stream in.
        const summaryGrew =
          isActiveStatus(data.status) &&
          data.latestSummaryId != null &&
          data.summaryRevision > lastRevision.current;
        if (reachedTerminal || newerSummary || summaryGrew) {
          mountedSummaryId.current = data.latestSummaryId;
          lastRevision.current = data.summaryRevision;
          router.refresh();
        }
      } catch {
        // network flap — keep polling
      }
    };

    const interval = setInterval(poll, 2000);
    void poll();
    return () => {
      cancelledPoll = true;
      clearInterval(interval);
    };
  }, [status, meeting.id, router]);

  // ---------------- actions ----------------
  const startProcessing = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/process`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "آغاز پردازش ناموفق بود.");
      }
      setStatus("transcribing");
      setStage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "آغاز پردازش ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }, [meeting.id]);

  const cancelProcessing = useCallback(async () => {
    setBusy(true);
    try {
      await fetch(`/api/meetings/${meeting.id}/cancel`, { method: "POST" });
      setStatus("failed");
      setStage(null);
      setError(CANCELLED_SENTINEL);
    } catch {
      // ignore — the poller will reflect the real state
    } finally {
      setBusy(false);
    }
  }, [meeting.id]);

  const regenerate = useCallback(
    async (tone?: string) => {
      setBusy(true);
      setError(null);
      try {
        // Persist a tone change first so the regenerated email uses it.
        if (tone && tone !== meeting.emailTone) {
          await updateMeetingAction(meeting.id, { emailTone: tone });
        }
        const res = await fetch(`/api/meetings/${meeting.id}/regenerate`, {
          method: "POST",
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(json.error ?? "تولید دوبارهٔ خلاصه ناموفق بود.");
        }
        setStatus("summarizing");
        setStage(null);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "تولید دوبارهٔ خلاصه ناموفق بود.",
        );
      } finally {
        setBusy(false);
      }
    },
    [meeting.id, meeting.emailTone],
  );

  const discuss = useCallback(() => {
    startDiscuss(async () => {
      const result = await discussMeetingAction(meeting.id);
      if ("url" in result) {
        // Seed the composer via the sessionStorage bridge (useChat v6 has no
        // shared store) BEFORE navigating; the fresh ChatPane reads it on mount.
        setComposerSeed(result.seed);
        router.push(result.url);
      } else {
        setError(result.error);
      }
    });
  }, [meeting.id, router]);

  const remove = useCallback(() => {
    startDelete(async () => {
      await deleteMeetingAction(meeting.id);
      router.push("/meetings");
    });
  }, [meeting.id, router]);

  const hasTranscript = Boolean(
    transcript && (transcript.wordsJson?.length ?? 0) > 0,
  );
  const canRegenerate = hasTranscript && !active && !busy;
  const hasContent = Boolean(summary || hasTranscript);
  // A partial summary is streaming in: show the rail layout with whatever
  // sections exist so far, plus a subtle "still completing" indicator.
  const summarizingPartial = status === "summarizing" && Boolean(summary);

  const seriesName = useMemo(
    () => series.find((s) => s.id === meeting.seriesId)?.name ?? null,
    [series, meeting.seriesId],
  );

  const sections = useMemo(
    () => buildSections(summary, hasTranscript, speakers.length),
    [summary, hasTranscript, speakers.length],
  );
  const sectionIds = useMemo<MeetingSectionId[]>(
    () => sections.map((s) => s.id),
    [sections],
  );

  const [activeSection, selectSection] = useHashSection(
    sectionIds.length ? sectionIds : ["summary"],
  );

  const durationLabel = formatDuration(meeting.durationS);

  // ---------------- primary action cluster (shared by both layouts) -------
  const primaryActions = (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={discussing}
        onClick={discuss}
      >
        {discussing ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <MessageSquarePlusIcon className="size-4" />
        )}
        <span className="max-sm:sr-only">بحث درباره این جلسه</span>
      </Button>

      {meeting.audioPath && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={audioOpen ? "بستن پخش‌کنندهٔ صدا" : "نمایش پخش‌کنندهٔ صدا"}
          aria-pressed={audioOpen}
          onClick={() => setAudioOpen((v) => !v)}
          className={audioOpen ? "text-primary" : undefined}
        >
          <Volume2Icon className="size-4" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="تنظیمات جلسه">
            <SettingsIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-sm">
          <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="size-3.5" /> تنظیمات جلسه
          </DropdownMenuItem>
          {canRegenerate && (
            <DropdownMenuItem onClick={() => regenerate()}>
              <RefreshCwIcon className="size-3.5" /> تولید دوبارهٔ خلاصه
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={remove}>
            <Trash2Icon className="size-3.5" /> حذف جلسه
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* top header */}
      <header className="glass-strong sticky top-0 z-20 flex items-center gap-3 border-x-0 border-t-0 px-4 py-3 sm:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/meetings")}
          aria-label="بازگشت به جلسات"
        >
          <ArrowRightIcon className="size-4" />
        </Button>
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary max-sm:hidden"
        >
          <MicIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-medium text-fg-0 text-sm">
            {meeting.title}
          </h1>
          <p className="flex items-center gap-2 text-fg-3 text-xs">
            <span>{formatDate(meeting.createdAt)}</span>
            {durationLabel && (
              <>
                <span aria-hidden className="text-fg-4">
                  •
                </span>
                <span dir="ltr" className="font-mono">
                  {durationLabel}
                </span>
              </>
            )}
          </p>
        </div>

        <StatusBadge status={status} />

        <div className="flex items-center gap-1.5">{primaryActions}</div>
      </header>

      {/* body */}
      {hasContent ? (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <MeetingSectionRail
            sections={sections}
            active={activeSection}
            onSelect={selectSection}
          />

          {/* active section panel */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-3xl space-y-4">
                {summarizingPartial && <SummarizingPartialBanner />}
                {/* While the summary streams in, sweep an accent sheen across
                    the section content so partially-filled sections read as
                    "still arriving". Keyed on status — no JS timers; glass-sheen
                    is reduced-motion gated. */}
                <div
                  className={cn(
                    "rounded-xl",
                    status === "summarizing" && "glass-sheen",
                  )}
                >
                  <MeetingSectionContent
                    activeId={activeSection}
                    ctx={{
                      meetingId: meeting.id,
                      summary,
                      transcript,
                      speakers,
                      seriesName,
                      durationS: meeting.durationS,
                      onRegenerate: regenerate,
                      regenerating: busy && status === "summarizing",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* docked compact audio player — overlays the panel foot, never
                pushes the scrollable content */}
            {meeting.audioPath && audioOpen && (
              <div className="glass-strong border-x-0 border-b-0 px-4 py-2.5 sm:px-6">
                <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
                  {/* biome-ignore lint/a11y/useMediaCaption: meeting audio has no captions */}
                  <audio
                    controls
                    preload="metadata"
                    src={`/api/meetings/${meeting.id}/audio`}
                    className="h-9 w-full"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="بستن پخش‌کننده"
                    onClick={() => setAudioOpen(false)}
                  >
                    <ChevronDownIcon className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* processing / uploaded / failed — centered status card, no rail */
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-2xl space-y-4">
            {active && (
              <div className="glass space-y-3 rounded-xl p-5">
                <div className="flex items-center gap-2.5">
                  <Loader2Icon className="size-5 animate-spin text-primary" />
                  <div className="flex-1" role="status" aria-live="polite">
                    <Shimmer
                      variant="accent"
                      className="font-medium text-fg-1 text-sm"
                    >
                      {stage ??
                        (status === "transcribing"
                          ? "در حال رونویسی صدا…"
                          : "در حال خلاصه‌سازی…")}
                    </Shimmer>
                    <p className="text-fg-4 text-xs">
                      این کار ممکن است چند دقیقه طول بکشد؛ می‌توانید این صفحه را
                      باز بگذارید.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={cancelProcessing}
                  >
                    <XCircleIcon className="size-4" />
                    لغو
                  </Button>
                </div>
                {/* Indeterminate accent sweep — the real progress is unknown
                    (Scribe gives no percentage), so an honest "live" bar beats
                    a fabricated 40/80%. glass-sheen drives the sweep and is
                    reduced-motion gated. */}
                <div
                  className="h-1 overflow-hidden rounded-full bg-foreground/10"
                  role="progressbar"
                  aria-label={
                    status === "transcribing"
                      ? "در حال رونویسی"
                      : "در حال خلاصه‌سازی"
                  }
                >
                  <div
                    className="glass-sheen h-full w-full"
                    style={{
                      backgroundImage:
                        "linear-gradient(100deg, transparent 25%, color-mix(in oklab, var(--accent-base) 60%, transparent) 50%, transparent 75%)",
                      backgroundSize: "200% 100%",
                    }}
                  />
                </div>
              </div>
            )}

            {status === "uploaded" && !active && (
              <div className="glass flex items-center gap-3 rounded-xl p-5">
                <div className="flex-1">
                  <p className="font-medium text-fg-1 text-sm">
                    جلسه آمادهٔ پردازش است
                  </p>
                  <p className="text-fg-4 text-xs">
                    برای ساخت رونوشت و خلاصه، پردازش را آغاز کنید.
                  </p>
                </div>
                <Button disabled={busy} onClick={startProcessing}>
                  {busy ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="size-4" />
                  )}
                  آغاز پردازش
                </Button>
              </div>
            )}

            {status === "failed" && (
              <div className="glass space-y-3 rounded-xl border border-err/20 p-5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-err" />
                  <div className="flex-1">
                    <p className="font-medium text-fg-1 text-sm">
                      {cancelled ? "پردازش لغو شد" : "پردازش ناموفق بود"}
                    </p>
                    {error && (
                      <p
                        className="mt-0.5 text-fg-3 text-xs"
                        dir={/[a-zA-Z]/.test(error) ? "ltr" : "rtl"}
                      >
                        {error}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={startProcessing}
                >
                  {busy ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <RotateCcwIcon className="size-4" />
                  )}
                  تلاش دوباره
                </Button>
              </div>
            )}

            {meeting.audioPath && (
              <div className="glass rounded-xl p-3">
                {/* biome-ignore lint/a11y/useMediaCaption: meeting audio has no captions */}
                <audio
                  controls
                  preload="metadata"
                  src={`/api/meetings/${meeting.id}/audio`}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <MeetingSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        meeting={meeting}
        series={series}
      />
    </div>
  );
}
