"use client";

import { CheckIcon, ChevronDownIcon, CpuIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CatalogModel } from "@/lib/openrouter-models";

export interface ImageModel {
  id: string;
  name: string;
}

function formatPrice(model: CatalogModel): string {
  if (model.promptPrice === 0 && model.completionPrice === 0) return "رایگان";
  return `$${model.promptPrice.toFixed(2)}/${model.completionPrice.toFixed(2)}`;
}

/**
 * Picker for image-output models. Fetches `/api/models?modality=image`
 * (CatalogModel.supportsImageOutput filter), auto-selects the first model on
 * first load, retries on the next open if the catalog fetch failed.
 */
export function ImageModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: ImageModel | null;
  onChange: (model: ImageModel) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/models?modality=image")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as CatalogModel[];
        setCatalog(data);
        if (!value && data.length > 0) {
          onChange({ id: data[0].id, name: data[0].name });
        }
      })
      .catch((e: Error) =>
        setError(`کاتالوگ مدل‌های تصویر در دسترس نیست (${e.message})`),
      );
  }, [value, onChange]);

  // Load up front so the picker can auto-select a default and "تولید" isn't
  // gated behind opening the dialog. Failed loads retry the next time it opens.
  useEffect(() => {
    if (catalog) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, open]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="glass flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <CpuIcon className="size-4 shrink-0 text-fg-3" />
        <span className="min-w-0 flex-1 truncate" dir="ltr">
          {value?.name ?? "انتخاب مدل تصویر"}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-fg-4" />
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent
          aria-describedby={undefined}
          // DialogContent already carries glass-strong; the inner Command stays
          // bg-transparent to inherit it (no second glass class to stack).
          className="overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">انتخاب مدل تصویر</DialogTitle>
          <Command className="bg-transparent **:data-[slot=command-input-wrapper]:h-11">
            <CommandInput placeholder="جستجوی مدل‌های تصویر…" />
            <CommandList className="max-h-80">
              <CommandEmpty className="py-6 text-center text-fg-3 text-xs">
                مدل تصویری یافت نشد
              </CommandEmpty>
              {error && (
                <p className="px-3 py-3 text-destructive text-xs">
                  <span dir="ltr" className="font-mono">
                    ERR:
                  </span>{" "}
                  {error}
                </p>
              )}
              {!(catalog || error) && (
                <p className="px-3 py-3 text-fg-3 text-xs">
                  در حال بارگذاری کاتالوگ…
                </p>
              )}
              {catalog && catalog.length > 0 && (
                <CommandGroup heading="مدل‌های تولید تصویر">
                  {catalog.map((model) => {
                    const selected = value?.id === model.id;
                    return (
                    <CommandItem
                      key={model.id}
                      value={`${model.name} ${model.id}`}
                      className={cn(
                        "focus-visible:ring-2 focus-visible:ring-ring/50",
                        selected && "ring-1 ring-primary/30",
                      )}
                      onSelect={() => {
                        onChange({ id: model.id, name: model.name });
                        setOpen(false);
                      }}
                    >
                      <CheckIcon
                        className={cn(
                          "size-3.5",
                          selected ? "text-primary opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex min-w-0 flex-col" dir="ltr">
                        <span className="truncate font-mono text-xs">
                          {model.name}
                        </span>
                        <span className="truncate font-mono text-[10px] text-fg-4">
                          {model.id}
                        </span>
                      </div>
                      <span
                        dir="ltr"
                        className="ms-auto font-mono text-[10px] text-fg-4"
                      >
                        {formatPrice(model)}
                      </span>
                    </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
