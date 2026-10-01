"use client";

import {
  LayersIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  Wand2Icon,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { TemplateEditorDialog } from "@/components/app/template-editor-dialog";
import { TemplateFillDialog } from "@/components/app/template-fill-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteTemplateAction } from "@/lib/actions";
import type { PromptTemplateRow } from "@/lib/db/schema";
import { TEMPLATE_CATEGORIES } from "@/lib/templates-categories";
import { chartTint } from "@/lib/tint";
import { detectDir } from "@/lib/use-direction";

const ALL = "__all__";

export function TemplatesView({
  templates,
}: {
  templates: PromptTemplateRow[];
}) {
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PromptTemplateRow | null>(null);
  const [fillOpen, setFillOpen] = useState(false);
  const [filling, setFilling] = useState<PromptTemplateRow | null>(null);
  const [, startTransition] = useTransition();

  // Sidebar categories: canonical order first, then any extra DB categories
  const categories = useMemo(() => {
    const seen = new Set<string>(TEMPLATE_CATEGORIES);
    const extras = templates
      .map((t) => t.category)
      .filter((c) => !seen.has(c));
    return [...TEMPLATE_CATEGORIES, ...Array.from(new Set(extras))];
  }, [templates]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of templates) map.set(t.category, (map.get(t.category) ?? 0) + 1);
    return map;
  }, [templates]);

  const visible =
    activeCategory === ALL
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (t: PromptTemplateRow) => {
    setEditing(t);
    setEditorOpen(true);
  };
  const openFill = (t: PromptTemplateRow) => {
    setFilling(t);
    setFillOpen(true);
  };
  const remove = (t: PromptTemplateRow) => {
    startTransition(async () => {
      await deleteTemplateAction(t.id);
    });
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Category rail */}
      <aside className="glass-strong hidden w-56 shrink-0 flex-col gap-1 overflow-y-auto border-e-0 p-3 sm:flex">
        <button
          className={catBtn(activeCategory === ALL)}
          onClick={() => setActiveCategory(ALL)}
          type="button"
        >
          <LayersIcon className="size-4 opacity-70" />
          <span className="flex-1 text-start">همه قالب‌ها</span>
          <span className="text-fg-4 text-xs">{templates.length}</span>
        </button>
        <div className="my-1 h-px bg-border/60" />
        {categories.map((c) => (
          <button
            className={catBtn(activeCategory === c)}
            key={c}
            onClick={() => setActiveCategory(c)}
            type="button"
          >
            <span className="flex-1 truncate text-start">{c}</span>
            <span className="text-fg-4 text-xs">{counts.get(c) ?? 0}</span>
          </button>
        ))}
      </aside>

      {/* Main panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Wand2Icon className="size-5" style={{ color: chartTint(2) }} />
            <h1 className="font-bold font-heading text-base text-foreground">
              قالب‌ها
            </h1>
          </div>
          <Button onClick={openCreate} type="button">
            <PlusIcon className="size-4" />
            قالب جدید
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {visible.length === 0 ? (
            <div className="glass mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl p-8 text-center">
              <span
                className="grid size-14 place-items-center rounded-2xl"
                style={{
                  background: `color-mix(in oklch, ${chartTint(2)} 12%, transparent)`,
                  color: chartTint(2),
                }}
              >
                <Wand2Icon className="size-7" />
              </span>
              <p className="font-medium text-fg-1 text-sm">
                هنوز قالبی در این دسته نیست
              </p>
              <p className="text-fg-4 text-xs">
                با ساخت یک قالب، پرامپت‌های پرکاربرد خود را ذخیره و دوباره
                استفاده کنید.
              </p>
              <Button className="mt-1" onClick={openCreate} type="button">
                <PlusIcon className="size-4" />
                ساخت قالب
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((t) => {
                const vars = t.variables ?? [];
                return (
                  <article
                    className="glass group flex flex-col gap-3 rounded-2xl p-4"
                    key={t.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <h3 className="truncate font-medium font-heading text-fg-0 text-sm">
                          {t.title}
                        </h3>
                        <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-fg-3 text-xs">
                          {t.category}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            aria-label="گزینه‌های بیشتر"
                            className="rounded-md p-1 text-fg-4 opacity-0 transition-opacity hover:bg-muted hover:text-fg-1 focus-visible:opacity-100 group-hover:opacity-100"
                            type="button"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onSelect={() => openEdit(t)}>
                            <PencilIcon className="size-3.5" />
                            ویرایش
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => remove(t)}
                            variant="destructive"
                          >
                            <Trash2Icon className="size-3.5" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <p
                      dir={detectDir(t.body)}
                      className="line-clamp-3 flex-1 whitespace-pre-wrap text-fg-3 text-xs leading-relaxed"
                    >
                      {t.body}
                    </p>

                    {vars.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {vars.slice(0, 4).map((v) => (
                          <span
                            dir="ltr"
                            className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary"
                            key={v}
                          >
                            {v}
                          </span>
                        ))}
                        {vars.length > 4 && (
                          <span className="text-[10px] text-fg-4">
                            +{vars.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                      <span className="text-[10px] text-fg-4">
                        {t.usageCount} بار استفاده
                      </span>
                      <button
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 font-medium text-primary text-xs outline-none transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring/50"
                        onClick={() => openFill(t)}
                        type="button"
                      >
                        <PlayIcon className="size-3" />
                        استفاده
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TemplateEditorDialog
        defaultCategory={
          activeCategory === ALL ? undefined : activeCategory
        }
        onOpenChange={setEditorOpen}
        open={editorOpen}
        template={editing}
      />
      <TemplateFillDialog
        onOpenChange={setFillOpen}
        open={fillOpen}
        template={filling}
      />
    </div>
  );
}

function catBtn(active: boolean): string {
  return [
    "flex items-center gap-2 rounded-lg border-s-2 px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
    active
      ? // Active category: violet (chart-2) tint fill + a 2px inline-start bar.
        "border-s-[var(--chart-2)] bg-[color-mix(in_oklch,var(--chart-2)_15%,transparent)] font-medium text-[var(--chart-2)]"
      : "border-s-transparent text-fg-2 hover:bg-muted hover:text-fg-0",
  ].join(" ");
}
