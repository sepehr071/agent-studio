"use client";

import {
  CheckIcon,
  type LucideIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SettingsRow } from "@/lib/db/schema";
import { models } from "@/lib/models";
import { chartTint } from "@/lib/tint";
import { detectDir } from "@/lib/use-direction";
import { type SettingsInput, saveSettingsAction } from "./actions";

const FIELD_LABEL = "text-xs font-medium text-fg-3";

/** Section heading with a chart-ramp-tinted icon tile (app icon-tile convention). */
function SectionHeader({
  icon: Icon,
  tint,
  title,
  children,
}: {
  icon: LucideIcon;
  tint: 1 | 2 | 3 | 4 | 5;
  title: string;
  children?: React.ReactNode;
}) {
  const hue = chartTint(tint);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${hue} 16%, transparent)` }}
        >
          <Icon className="size-4" style={{ color: hue }} />
        </span>
        <h2 className="font-heading font-bold text-base text-foreground">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

/** Persian display labels for the stored (latin) enum values. */
const EXPERTISE_LABELS: Record<string, string> = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  expert: "حرفه‌ای",
};
const TONE_LABELS: Record<string, string> = {
  professional: "رسمی",
  friendly: "دوستانه",
  casual: "خودمانی",
};
const STYLE_LABELS: Record<string, string> = {
  concise: "مختصر",
  balanced: "متعادل",
  detailed: "مفصل",
};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className={FIELD_LABEL}>{label}</p>
      {children}
      {hint && <p className="text-fg-4 text-xs">{hint}</p>}
    </div>
  );
}

export function SettingsForm({ initial }: { initial: SettingsRow }) {
  const [form, setForm] = useState<SettingsInput>({
    defaultModelId: initial.defaultModelId,
    aiPrefsEnabled: initial.aiPrefsEnabled,
    userName: initial.userName,
    outputLanguage: initial.outputLanguage,
    expertiseLevel: initial.expertiseLevel as SettingsInput["expertiseLevel"],
    tone: initial.tone as SettingsInput["tone"],
    responseStyle: initial.responseStyle as SettingsInput["responseStyle"],
    customInstructions: initial.customInstructions,
  });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (next: Partial<SettingsInput>) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, ...next }));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveSettingsAction(form);
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
      <section className="glass space-y-5 rounded-2xl p-5">
        <SectionHeader icon={PaletteIcon} tint={1} title="ظاهر" />
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-medium text-fg-1 text-sm">پوسته</p>
            <p className="text-fg-4 text-xs">جابجایی میان حالت روشن و تیره</p>
          </div>
          <ThemeToggle className="border" />
        </div>
      </section>

      <section className="glass space-y-5 rounded-2xl p-5">
        <SectionHeader
          icon={SlidersHorizontalIcon}
          tint={3}
          title="پیش‌فرض‌ها"
        />
        <Field hint="مدلی که گفتگوهای جدید با آن آغاز می‌شوند" label="مدل پیش‌فرض">
          <Select
            onValueChange={(v) => patch({ defaultModelId: v })}
            value={form.defaultModelId}
          >
            <SelectTrigger className="w-72 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span dir="ltr" className="font-mono text-xs">
                    {m.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </section>

      <section className="glass space-y-5 rounded-2xl p-5">
        <SectionHeader
          icon={SparklesIcon}
          tint={2}
          title="ترجیحات هوش مصنوعی"
        >
          <Switch
            checked={form.aiPrefsEnabled}
            onCheckedChange={(v) => patch({ aiPrefsEnabled: v })}
          />
        </SectionHeader>
        <div
          className={`grid gap-4 sm:grid-cols-2 ${form.aiPrefsEnabled ? "" : "pointer-events-none opacity-40"}`}
        >
          <Field label="نام شما">
            <Input
              className="text-sm"
              onChange={(e) => patch({ userName: e.target.value || null })}
              placeholder="دستیار شما را چه صدا بزند؟"
              value={form.userName ?? ""}
            />
          </Field>
          <Field label="زبان خروجی">
            <Input
              className="text-sm"
              onChange={(e) =>
                patch({ outputLanguage: e.target.value || null })
              }
              placeholder="مثلاً فارسی، English"
              value={form.outputLanguage ?? ""}
            />
          </Field>
          <Field label="سطح دانش">
            <Select
              onValueChange={(v) =>
                patch({ expertiseLevel: v as SettingsInput["expertiseLevel"] })
              }
              value={form.expertiseLevel ?? ""}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {(["beginner", "intermediate", "expert"] as const).map((v) => (
                  <SelectItem className="text-sm" key={v} value={v}>
                    {EXPERTISE_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="لحن">
            <Select
              onValueChange={(v) => patch({ tone: v as SettingsInput["tone"] })}
              value={form.tone ?? ""}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {(["professional", "friendly", "casual"] as const).map((v) => (
                  <SelectItem className="text-sm" key={v} value={v}>
                    {TONE_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="سبک پاسخ">
            <Select
              onValueChange={(v) =>
                patch({ responseStyle: v as SettingsInput["responseStyle"] })
              }
              value={form.responseStyle ?? ""}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {(["concise", "balanced", "detailed"] as const).map((v) => (
                  <SelectItem className="text-sm" key={v} value={v}>
                    {STYLE_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div
          className={
            form.aiPrefsEnabled ? "" : "pointer-events-none opacity-40"
          }
        >
          <Field
            hint={`${form.customInstructions?.length ?? 0}/۲۰۰۰ — به ابتدای پرامپت سیستمی افزوده می‌شود`}
            label="دستورالعمل‌های سفارشی"
          >
            <Textarea
              className="min-h-28 text-sm"
              dir={detectDir(form.customInstructions ?? "")}
              maxLength={2000}
              onChange={(e) =>
                patch({ customInstructions: e.target.value || null })
              }
              placeholder="هر چیزی که دستیار باید همیشه بداند یا انجام دهد"
              value={form.customInstructions ?? ""}
            />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          className="rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={isPending}
          onClick={save}
          type="button"
        >
          {isPending ? "در حال ذخیره…" : "ذخیره تغییرات"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-primary text-sm">
            <CheckIcon className="size-4" /> ذخیره شد
          </span>
        )}
        {error && (
          <span className="text-destructive text-sm">
            <span dir="ltr" className="font-mono">
              ERR:
            </span>{" "}
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
