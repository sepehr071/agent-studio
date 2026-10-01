"use client";

import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { renameSpeakerAction } from "@/lib/actions/meetings";
import type { MeetingSpeakerRow, MeetingTranscriptRow } from "@/lib/db/schema";
import type { ScribeWord } from "@/lib/db/types";
import { buildMinutesSegments } from "@/lib/meetings/segment";
import { detectDir } from "@/lib/use-direction";
import { speakerColor } from "./meeting-shared";
import { SectionEmpty } from "./meeting-summary-view";

function SpeakerChip({
  meetingId,
  speakerId,
  displayName,
}: {
  meetingId: string;
  speakerId: string;
  displayName: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(displayName ?? "");
  const [pending, startTransition] = useTransition();
  const color = speakerColor(speakerId);
  const label = displayName || speakerId;

  const save = () => {
    const name = value.trim();
    startTransition(async () => {
      await renameSpeakerAction(meetingId, speakerId, name);
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <Input
          autoFocus
          value={value}
          dir={detectDir(value)}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder={speakerId}
          className="h-7 w-36 text-xs"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          aria-label="ذخیره نام"
          className="rounded-md p-1 text-ok hover:bg-foreground/5"
        >
          <CheckIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(displayName ?? "");
            setEditing(false);
          }}
          aria-label="انصراف"
          className="rounded-md p-1 text-fg-4 hover:bg-foreground/5"
        >
          <XIcon className="size-4" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group/chip inline-flex items-center gap-1.5 rounded-full border border-foreground/8 bg-foreground/4 px-3 py-1.5 text-xs transition-colors hover:bg-foreground/8"
      style={{ color }}
      title="تغییر نام گوینده"
    >
      <span className="size-2 rounded-full" style={{ background: color }} />
      <span className="font-medium">{label}</span>
      <PencilIcon className="size-3 opacity-0 transition-opacity group-hover/chip:opacity-60" />
    </button>
  );
}

/**
 * Speaker roster with inline rename. Used both as the dedicated "speakers"
 * section and inline above the transcript when speakers are diarized.
 */
export function SpeakerLegend({
  meetingId,
  speakers,
}: {
  meetingId: string;
  speakers: MeetingSpeakerRow[];
}) {
  if (!speakers.length) {
    return <SectionEmpty>گوینده‌ای شناسایی نشد.</SectionEmpty>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {speakers.map((s) => (
        <SpeakerChip
          key={s.id}
          meetingId={meetingId}
          speakerId={s.speakerId}
          displayName={s.displayName}
        />
      ))}
    </div>
  );
}

/** Speaker-colored transcript segments built from the diarized words. */
export function TranscriptBody({
  transcript,
  speakers,
}: {
  transcript: MeetingTranscriptRow | null;
  speakers: MeetingSpeakerRow[];
}) {
  const nameBySpeaker = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const s of speakers) map.set(s.speakerId, s.displayName);
    return map;
  }, [speakers]);

  const segments = useMemo(() => {
    const words = (transcript?.wordsJson ?? []) as ScribeWord[];
    return buildMinutesSegments(words);
  }, [transcript]);

  if (!transcript || !segments.length) {
    return <SectionEmpty>رونوشتی برای این جلسه در دسترس نیست.</SectionEmpty>;
  }

  return (
    <div className="space-y-4">
      {segments.map((seg, i) => {
        const display = nameBySpeaker.get(seg.speaker) || seg.speaker;
        const color = speakerColor(seg.speaker);
        return (
          <div key={i} className="flex gap-3">
            <div className="flex w-24 shrink-0 flex-col items-end gap-0.5 text-end">
              <span className="truncate font-medium text-xs" style={{ color }}>
                {display}
              </span>
              <span className="font-mono text-fg-4 text-[0.65rem]" dir="ltr">
                {seg.timestamp}
              </span>
            </div>
            <div
              className="border-foreground/10 border-s ps-3"
              style={{
                borderColor: `color-mix(in oklab, ${color} 35%, transparent)`,
              }}
            >
              <p
                dir={detectDir(seg.text)}
                className="text-fg-1 text-sm leading-relaxed"
              >
                {seg.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
