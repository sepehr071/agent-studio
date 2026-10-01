"use client";

import {
  CheckSquareIcon,
  DownloadIcon,
  HeartIcon,
  ImageIcon,
  SparklesIcon,
  SquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  bulkDeleteGeneratedImagesAction,
  deleteGeneratedImageAction,
  toggleImageFavoriteAction,
} from "@/lib/actions";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { detectDir } from "@/lib/use-direction";
import type { GeneratedImageRow } from "@/lib/db/schema";
import { type DropzoneImage, ImageDropzone } from "./image-dropzone";
import { ImageDetailDialog } from "./image-detail-dialog";
import { type ImageModel, ImageModelPicker } from "./image-model-picker";

// Style chips appended to the prompt as a stylistic hint; the chosen label is
// also persisted on the row as `styleHint`.
const STYLE_CHIPS: { label: string; hint: string }[] = [
  { label: "واقع‌گرایانه", hint: "photorealistic, highly detailed" },
  { label: "نقاشی دیجیتال", hint: "digital painting, concept art" },
  { label: "سه‌بعدی", hint: "3D render, octane, cinematic lighting" },
  { label: "مینیمال", hint: "minimalist, clean, simple composition" },
  { label: "آبرنگ", hint: "watercolor painting, soft" },
  { label: "آنیمه", hint: "anime style, vibrant" },
];

// Aspect chips appended to the prompt; persisted as `aspectHint`.
const ASPECT_CHIPS: { label: string; hint: string }[] = [
  { label: "مربع ۱:۱", hint: "square 1:1 aspect ratio" },
  { label: "افقی ۱۶:۹", hint: "wide 16:9 landscape aspect ratio" },
  { label: "عمودی ۹:۱۶", hint: "tall 9:16 portrait aspect ratio" },
];

function fileUrl(id: string): string {
  return `/api/images/${id}/file`;
}

async function downloadImage(image: GeneratedImageRow): Promise<void> {
  try {
    const res = await fetch(fileUrl(image.id));
    if (!res.ok) throw new Error("download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const ext = (image.mimeType.split("/")[1] || "png").replace("jpeg", "jpg");
    link.download = `studio-image-${image.id.slice(0, 8)}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    // best-effort
  }
}

export function ImageStudio({
  initialImages,
}: {
  initialImages: GeneratedImageRow[];
}) {
  const router = useRouter();

  // ----- form state -----
  const [model, setModel] = useState<ImageModel | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [aspect, setAspect] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<DropzoneImage[]>([]);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string } | null>(null);

  // ----- history / select state -----
  const [tab, setTab] = useState<"generate" | "history">("generate");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<GeneratedImageRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const styleHint = useMemo(
    () => STYLE_CHIPS.find((c) => c.label === style)?.hint ?? null,
    [style],
  );
  const aspectHint = useMemo(
    () => ASPECT_CHIPS.find((c) => c.label === aspect)?.hint ?? null,
    [aspect],
  );

  const buildFullPrompt = useCallback((): string => {
    const parts = [prompt.trim()];
    if (styleHint) parts.push(styleHint);
    if (aspectHint) parts.push(aspectHint);
    return parts.filter(Boolean).join(", ");
  }, [prompt, styleHint, aspectHint]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !model || generating) return;
    setGenerating(true);
    setGenError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildFullPrompt(),
          negativePrompt: negativePrompt.trim() || undefined,
          modelId: model.id,
          mode: refImages.length > 0 ? "i2i" : "t2i",
          aspectHint: aspect ?? undefined,
          styleHint: style ?? undefined,
          inputImages:
            refImages.length > 0
              ? refImages.map((r) => r.dataUrl)
              : undefined,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        throw new Error(json.error ?? `وضعیت ${res.status}`);
      }
      setPreview({ id: json.id });
      setRefImages([]);
      // The grid is server-rendered; refresh to pull in the new row.
      router.refresh();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "تولید تصویر ناموفق بود.");
    } finally {
      setGenerating(false);
    }
  }, [
    prompt,
    model,
    generating,
    buildFullPrompt,
    negativePrompt,
    refImages,
    aspect,
    style,
    router,
  ]);

  const regenerateFrom = useCallback(
    (image: GeneratedImageRow) => {
      setTab("generate");
      setPrompt(image.prompt);
      setNegativePrompt(image.negativePrompt ?? "");
      setStyle(image.styleHint ?? null);
      setAspect(image.aspectHint ?? null);
      setRefImages([]);
      setDetail(null);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      startTransition(async () => {
        await toggleImageFavoriteAction(id);
        router.refresh();
      });
    },
    [router],
  );

  const deleteOne = useCallback(
    (id: string) => {
      startTransition(async () => {
        await deleteGeneratedImageAction(id);
        router.refresh();
      });
    },
    [router],
  );

  const bulkDelete = useCallback(() => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkDeleteGeneratedImagesAction(ids);
      setSelected(new Set());
      setSelectMode(false);
      router.refresh();
    });
  }, [selected, router]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const canGenerate = Boolean(prompt.trim() && model && !generating);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-3 border-x-0 border-t-0 px-6 py-3">
        <div
          className="flex size-9 items-center justify-center rounded-lg"
          style={{
            background: "color-mix(in oklab, var(--chart-5) 12%, transparent)",
            color: "var(--chart-5)",
          }}
        >
          <SparklesIcon className="size-5" />
        </div>
        <div>
          <h1 className="font-medium text-fg-0 text-sm">استودیو تصویر</h1>
          <p className="text-fg-3 text-xs">
            تولید و ویرایش تصویر با مدل‌های هوش مصنوعی
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "generate" | "history")}
        >
          <TabsList variant="glass">
            <TabsTrigger value="generate">تولید</TabsTrigger>
            <TabsTrigger value="history">
              تاریخچه
              {initialImages.length > 0 && (
                <span className="ms-1.5 text-fg-4 text-xs">
                  {initialImages.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ---------------- GENERATE ---------------- */}
          <TabsContent value="generate" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* form column */}
              <div className="glass space-y-5 rounded-xl p-5">
                <div className="space-y-2">
                  <label className="font-medium text-fg-2 text-xs">مدل</label>
                  <ImageModelPicker
                    value={model}
                    onChange={setModel}
                    disabled={generating}
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-fg-2 text-xs">
                    توضیح تصویر
                  </label>
                  <Textarea
                    value={prompt}
                    dir={detectDir(prompt)}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="تصویری که می‌خواهید را توصیف کنید…"
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-fg-4 text-xs">{prompt.length} نویسه</p>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-fg-2 text-xs">سبک</label>
                  <div className="flex flex-wrap gap-2">
                    {STYLE_CHIPS.map((chip) => (
                      <Chip
                        key={chip.label}
                        active={style === chip.label}
                        onClick={() =>
                          setStyle(style === chip.label ? null : chip.label)
                        }
                      >
                        {chip.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-fg-2 text-xs">نسبت ابعاد</label>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_CHIPS.map((chip) => (
                      <Chip
                        key={chip.label}
                        active={aspect === chip.label}
                        onClick={() =>
                          setAspect(aspect === chip.label ? null : chip.label)
                        }
                      >
                        {chip.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-fg-2 text-xs">
                    پرامپت منفی (اختیاری)
                  </label>
                  <Textarea
                    value={negativePrompt}
                    dir={detectDir(negativePrompt)}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="چه چیزهایی در تصویر نباشند…"
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-fg-2 text-xs">
                    تصاویر مرجع (تصویر به تصویر)
                  </label>
                  <ImageDropzone
                    images={refImages}
                    onChange={setRefImages}
                    maxImages={4}
                    disabled={generating}
                  />
                </div>

                {genError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-xs">
                    <span className="font-medium">خطا در تولید تصویر:</span>{" "}
                    {genError}
                  </p>
                )}

                <Button
                  size="lg"
                  className="w-full"
                  disabled={!canGenerate}
                  onClick={handleGenerate}
                >
                  {generating ? (
                    <>
                      <Spinner />
                      در حال تولید…
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="size-4" />
                      تولید تصویر
                    </>
                  )}
                </Button>
              </div>

              {/* preview column */}
              <div className="glass flex min-h-[24rem] items-center justify-center rounded-xl p-4">
                {generating ? (
                  <div
                    aria-busy="true"
                    className="flex w-full max-w-md flex-col items-center gap-4"
                  >
                    {/* AI-feeling wait: an azure→violet gradient field sweeps
                        across a fixed-size canvas while the model renders. The
                        glass-sheen animation (reduced-motion gated) drives the
                        background-position sweep; we override its gradient stops
                        to the studio's azure→violet ramp. */}
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                      <div
                        aria-hidden
                        className="glass-sheen absolute inset-0"
                        style={{
                          backgroundImage:
                            "linear-gradient(110deg, color-mix(in oklab, var(--chart-1) 18%, transparent), color-mix(in oklab, var(--chart-2) 22%, transparent), color-mix(in oklab, var(--chart-1) 18%, transparent))",
                          backgroundSize: "200% 100%",
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span
                          aria-hidden
                          className="ai-glow-pulse flex size-14 items-center justify-center rounded-full"
                          style={{
                            background:
                              "color-mix(in oklab, var(--chart-2) 16%, transparent)",
                            color: "var(--chart-2)",
                          }}
                        >
                          <SparklesIcon className="size-7" />
                        </span>
                      </div>
                    </div>
                    <Shimmer
                      variant="accent"
                      className="text-fg-2 text-sm"
                    >
                      در حال تولید…
                    </Shimmer>
                  </div>
                ) : preview ? (
                  <div className="relative">
                    {/* biome-ignore lint/a11y/useAltText: generated preview */}
                    <img
                      src={fileUrl(preview.id)}
                      alt="تصویر تولیدشده"
                      className="max-h-[28rem] max-w-full rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="text-center text-fg-4">
                    <ImageIcon
                      className="mx-auto mb-3 size-14"
                      style={{ color: "var(--chart-5)", opacity: 0.7 }}
                    />
                    <p className="text-sm">تصویر تولیدشده اینجا نمایش داده می‌شود</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ---------------- HISTORY ---------------- */}
          <TabsContent value="history" className="mt-4">
            {initialImages.length === 0 ? (
              <div className="glass flex flex-col items-center justify-center gap-3 rounded-xl py-16 text-center text-fg-4">
                <ImageIcon className="size-14 opacity-50" />
                <p className="text-sm">هنوز تصویری تولید نکرده‌اید</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTab("generate")}
                >
                  <SparklesIcon className="size-4" />
                  تولید اولین تصویر
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-fg-3 text-sm">
                    {selectMode
                      ? `${selected.size} مورد انتخاب شده`
                      : `${initialImages.length} تصویر`}
                  </span>
                  <div className="flex items-center gap-2">
                    {selectMode && selected.size > 0 && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={bulkDelete}
                      >
                        {isPending ? (
                          <Spinner />
                        ) : (
                          <Trash2Icon className="size-4" />
                        )}
                        حذف {selected.size} مورد
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={selectMode ? "default" : "outline"}
                      onClick={() => {
                        setSelectMode((m) => !m);
                        setSelected(new Set());
                      }}
                    >
                      {selectMode ? (
                        <>
                          <XIcon className="size-4" />
                          انصراف
                        </>
                      ) : (
                        <>
                          <CheckSquareIcon className="size-4" />
                          انتخاب
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {initialImages.map((image) => (
                    <HistoryTile
                      key={image.id}
                      image={image}
                      selectMode={selectMode}
                      selected={selected.has(image.id)}
                      onSelectToggle={() => toggleSelected(image.id)}
                      onOpen={() => setDetail(image)}
                      onFavorite={() => toggleFavorite(image.id)}
                      onDownload={() => void downloadImage(image)}
                      onDelete={() => deleteOne(image.id)}
                    />
                  ))}
                </ul>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ImageDetailDialog
        image={detail}
        open={detail !== null}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
        onToggleFavorite={toggleFavorite}
        onDelete={deleteOne}
        onRegenerate={regenerateFrom}
        onDownload={(img) => void downloadImage(img)}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-foreground/10 text-fg-3 hover:bg-foreground/5",
      )}
    >
      {children}
    </button>
  );
}

function HistoryTile({
  image,
  selectMode,
  selected,
  onSelectToggle,
  onOpen,
  onFavorite,
  onDownload,
  onDelete,
}: {
  image: GeneratedImageRow;
  selectMode: boolean;
  selected: boolean;
  onSelectToggle: () => void;
  onOpen: () => void;
  onFavorite: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-lg bg-foreground/5 ring-1 ring-foreground/10",
        selectMode && selected && "ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        onClick={selectMode ? onSelectToggle : onOpen}
        className="block w-full"
        aria-label={selectMode ? "انتخاب تصویر" : "مشاهده جزئیات تصویر"}
      >
        {/* biome-ignore lint/a11y/useAltText: prompt as alt */}
        <img
          src={fileUrl(image.id)}
          alt={image.prompt.slice(0, 120)}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full object-cover"
        />
      </button>

      {selectMode ? (
        <div className="pointer-events-none absolute start-2 top-2 text-white drop-shadow">
          {selected ? (
            <CheckSquareIcon className="size-6 text-primary" />
          ) : (
            <SquareIcon className="size-6 text-white/80" />
          )}
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <p
            dir={detectDir(image.prompt)}
            className="absolute inset-x-0 bottom-0 line-clamp-2 px-2 py-1.5 text-white text-xs"
          >
            {image.prompt}
          </p>
          <div className="pointer-events-auto absolute end-2 top-2 flex gap-1">
            <TileAction label="دانلود" onClick={onDownload}>
              <DownloadIcon className="size-4" />
            </TileAction>
            <TileAction
              label={image.isFavorite ? "حذف از علاقه‌مندی" : "علاقه‌مندی"}
              onClick={onFavorite}
              pressed={image.isFavorite}
            >
              <HeartIcon
                className={cn(
                  "size-4",
                  image.isFavorite && "fill-current text-destructive",
                )}
              />
            </TileAction>
            <TileAction label="حذف" onClick={onDelete}>
              <Trash2Icon className="size-4" />
            </TileAction>
          </div>
        </div>
      )}
    </li>
  );
}

function TileAction({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="rounded-md bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
    >
      {children}
    </button>
  );
}
