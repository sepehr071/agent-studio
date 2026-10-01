"use client";

import {
  ArrowRightIcon,
  CheckIcon,
  MicIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TagIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceptKeytermAction,
  addKeytermAction,
  deleteKeytermAction,
  deleteSpeakerNameAction,
  rememberSpeakerNameAction,
} from "@/lib/actions/series";
import type {
  MeetingRow,
  MeetingSeriesKeytermRow,
  MeetingSeriesRow,
  MeetingSeriesSpeakerNameRow,
} from "@/lib/db/schema";
import { detectDir } from "@/lib/use-direction";
import { SeriesDialog } from "./series-dialog";
import {
  formatDate,
  StatusBadge,
  toneLabel,
} from "./meeting-shared";

function KeytermChip({
  seriesId,
  term,
}: {
  seriesId: string;
  term: MeetingSeriesKeytermRow;
}) {
  const [pending, startTransition] = useTransition();
  const suggested = term.source === "suggested";

  return (
    <span
      dir={detectDir(term.term)}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
        suggested
          ? "border border-dashed border-warn/40 bg-warn/8 text-warn"
          : "bg-foreground/8 text-fg-2"
      } ${pending ? "opacity-50" : ""}`}
    >
      {term.source === "accepted" && (
        <CheckIcon className="size-3 text-ok" aria-label="پذیرفته‌شده" />
      )}
      {term.term}
      {suggested ? (
        <span className="ms-0.5 flex items-center gap-0.5">
          <button
            type="button"
            aria-label="پذیرفتن واژه"
            title="پذیرفتن"
            onClick={() =>
              startTransition(() => acceptKeytermAction(seriesId, term.id))
            }
            className="rounded-full p-0.5 text-ok hover:bg-ok/15"
          >
            <CheckIcon className="size-3" />
          </button>
          <button
            type="button"
            aria-label="رد واژه"
            title="رد"
            onClick={() =>
              startTransition(() => deleteKeytermAction(seriesId, term.id))
            }
            className="rounded-full p-0.5 text-fg-4 hover:bg-foreground/10"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label="حذف واژه"
          title="حذف"
          onClick={() =>
            startTransition(() => deleteKeytermAction(seriesId, term.id))
          }
          className="ms-0.5 rounded-full p-0.5 text-fg-4 hover:bg-foreground/10"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}

function KeytermManager({
  seriesId,
  keyterms,
}: {
  seriesId: string;
  keyterms: MeetingSeriesKeytermRow[];
}) {
  const [term, setTerm] = useState("");
  const [pending, startTransition] = useTransition();

  const add = () => {
    const trimmed = term.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await addKeytermAction(seriesId, trimmed, "manual");
      setTerm("");
    });
  };

  const suggested = keyterms.filter((k) => k.source === "suggested");
  const known = keyterms.filter((k) => k.source !== "suggested");

  return (
    <section className="glass space-y-4 rounded-xl p-5">
      <div className="flex items-center gap-2">
        <TagIcon className="size-4 text-primary" />
        <h3 className="font-heading font-medium text-fg-1 text-sm">
          واژگان تخصصی
        </h3>
        <span className="text-fg-4 text-xs">{keyterms.length}</span>
      </div>
      <p className="text-fg-4 text-xs">
        این واژه‌ها به موتور رونویسی کمک می‌کنند تا نام‌ها و اصطلاحات تخصصی را
        درست بنویسد. پیشنهادها از خلاصهٔ جلسه‌های پیشین می‌آیند.
      </p>

      <div className="flex items-center gap-2">
        <Input
          value={term}
          dir={detectDir(term)}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="افزودن واژه یا اصطلاح…"
          className="text-sm"
        />
        <Button size="sm" disabled={pending || !term.trim()} onClick={add}>
          <PlusIcon className="size-4" /> افزودن
        </Button>
      </div>

      {suggested.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-fg-3 text-xs">
            <SparklesIcon className="size-3.5" /> پیشنهادها
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggested.map((k) => (
              <KeytermChip key={k.id} seriesId={seriesId} term={k} />
            ))}
          </div>
        </div>
      )}

      {known.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {known.map((k) => (
            <KeytermChip key={k.id} seriesId={seriesId} term={k} />
          ))}
        </div>
      ) : (
        suggested.length === 0 && (
          <p className="text-fg-4 text-sm">هنوز واژه‌ای اضافه نشده است.</p>
        )
      )}
    </section>
  );
}

function SpeakerMemory({
  seriesId,
  speakerNames,
}: {
  seriesId: string;
  speakerNames: MeetingSeriesSpeakerNameRow[];
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await rememberSpeakerNameAction(seriesId, trimmed);
      setName("");
    });
  };

  return (
    <section className="glass space-y-4 rounded-xl p-5">
      <div className="flex items-center gap-2">
        <UsersIcon className="size-4 text-primary" />
        <h3 className="font-heading font-medium text-fg-1 text-sm">
          حافظهٔ گویندگان
        </h3>
        <span className="text-fg-4 text-xs">{speakerNames.length}</span>
      </div>
      <p className="text-fg-4 text-xs">
        نام گویندگانی که در جلسه‌های این سری شناسایی شده‌اند؛ به نگاشت پایدارِ
        گویندگان در جلسه‌های بعدی کمک می‌کند.
      </p>

      <div className="flex items-center gap-2">
        <Input
          value={name}
          dir={detectDir(name)}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="افزودن نام گوینده…"
          className="text-sm"
        />
        <Button size="sm" disabled={pending || !name.trim()} onClick={add}>
          <PlusIcon className="size-4" /> افزودن
        </Button>
      </div>

      {speakerNames.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {speakerNames.map((s) => (
            <SpeakerNameChip key={s.id} seriesId={seriesId} entry={s} />
          ))}
        </ul>
      ) : (
        <p className="text-fg-4 text-sm">هنوز نامی به خاطر سپرده نشده است.</p>
      )}
    </section>
  );
}

function SpeakerNameChip({
  seriesId,
  entry,
}: {
  seriesId: string;
  entry: MeetingSeriesSpeakerNameRow;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <li
      dir={detectDir(entry.displayName)}
      className={`inline-flex items-center gap-1.5 rounded-full bg-foreground/8 px-2.5 py-1 text-fg-2 text-xs ${
        pending ? "opacity-50" : ""
      }`}
    >
      {entry.displayName}
      <button
        type="button"
        aria-label="حذف نام"
        onClick={() =>
          startTransition(() => deleteSpeakerNameAction(seriesId, entry.id))
        }
        className="rounded-full p-0.5 text-fg-4 hover:bg-foreground/10"
      >
        <XIcon className="size-3" />
      </button>
    </li>
  );
}

export function SeriesDetail({
  series,
  keyterms,
  speakerNames,
  meetings,
}: {
  series: MeetingSeriesRow;
  keyterms: MeetingSeriesKeytermRow[];
  speakerNames: MeetingSeriesSpeakerNameRow[];
  meetings: MeetingRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <div className="h-dvh overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <div className="space-y-5">
          {/* header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push("/series")}
              aria-label="بازگشت به سری‌ها"
            >
              <ArrowRightIcon className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-heading font-bold text-foreground text-lg">
                {series.name}
              </h1>
              <p className="text-fg-3 text-sm">
                لحن پیش‌فرض ایمیل: {toneLabel(series.emailTone)}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon className="size-4" /> ویرایش
            </Button>
          </div>

          <KeytermManager seriesId={series.id} keyterms={keyterms} />
          <SpeakerMemory seriesId={series.id} speakerNames={speakerNames} />

          {/* meetings in series */}
          <section className="glass space-y-3 rounded-xl p-5">
            <div className="flex items-center gap-2">
              <MicIcon className="size-4 text-primary" />
              <h3 className="font-heading font-medium text-fg-1 text-sm">
                جلسه‌های این سری
              </h3>
              <span className="text-fg-4 text-xs">{meetings.length}</span>
            </div>
            {meetings.length === 0 ? (
              <p className="text-fg-4 text-sm">
                هنوز جلسه‌ای به این سری اختصاص نیافته است.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {meetings.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/meetings/${m.id}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-foreground/5"
                    >
                      <span className="min-w-0 flex-1 truncate text-fg-1 text-sm">
                        {m.title}
                      </span>
                      <span className="shrink-0 text-fg-4 text-xs">
                        {formatDate(m.createdAt)}
                      </span>
                      <StatusBadge status={m.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <SeriesDialog open={editing} onOpenChange={setEditing} series={series} />
    </div>
  );
}
