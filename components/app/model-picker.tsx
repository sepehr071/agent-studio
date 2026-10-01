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
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import type { ConfigRow } from "@/lib/db/schema";
import { models as quickModels } from "@/lib/models";
import type { CatalogModel } from "@/lib/openrouter-models";

/**
 * The current selection.
 *
 * Backward-compatible shape: the existing chat-pane reads `id`, `name`,
 * `contextWindow` and `supportsVision` directly, so those stay top-level.
 *
 * `configId` is the only new field: it is `null` for a bare model and the
 * assistant id when the selection came from an assistant config. The model
 * fields are still populated from the config's bound model, so callers that
 * only care about the model keep working untouched.
 *
 * @see Integration contract at the bottom of this file.
 */
export interface SelectedModel {
  id: string;
  name: string;
  contextWindow: number;
  supportsVision: boolean;
  /** Assistant config id when the selection is an assistant; else null. */
  configId?: string | null;
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

function formatPrice(model: CatalogModel): string {
  if (model.promptPrice === 0 && model.completionPrice === 0) return "رایگان";
  return `$${model.promptPrice.toFixed(2)}/${model.completionPrice.toFixed(2)}`;
}

/** Short model label from a slug, used when the catalog hasn't loaded. */
function modelLabel(modelId: string): string {
  return modelId.split("/").at(-1) ?? modelId;
}

export function ModelPicker({
  value,
  onChange,
  configs = [],
}: {
  value: SelectedModel;
  onChange: (model: SelectedModel) => void;
  /**
   * The user's assistant configs. When non-empty, a "دستیارهای من" group is
   * shown above the model lists. Optional so the picker still works for plain
   * model selection (e.g. settings).
   */
  configs?: ConfigRow[];
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Lazy-load the catalog when the dialog opens; failed loads retry on the
  // next open (flaky networks happen)
  useEffect(() => {
    if (!open || catalog) return;
    setCatalogError(null);
    fetch("/api/models")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setCatalog((await res.json()) as CatalogModel[]);
      })
      .catch((error: Error) =>
        setCatalogError(`کاتالوگ در دسترس نیست (${error.message})`),
      );
  }, [open, catalog]);

  const select = useCallback(
    (model: SelectedModel) => {
      onChange(model);
      setOpen(false);
    },
    [onChange],
  );

  const selectModel = useCallback(
    (model: {
      id: string;
      name: string;
      contextWindow: number;
      supportsVision: boolean;
    }) => select({ ...model, configId: null }),
    [select],
  );

  const selectConfig = useCallback(
    (config: ConfigRow) => {
      // Resolve the config's bound model so the model fields stay populated.
      const quick = quickModels.find((m) => m.id === config.modelId);
      const fromCatalog = catalog?.find((m) => m.id === config.modelId);
      select({
        id: config.modelId,
        name:
          quick?.name ?? fromCatalog?.name ?? modelLabel(config.modelId),
        contextWindow:
          quick?.contextWindow ?? fromCatalog?.contextWindow ?? 0,
        supportsVision:
          quick?.supportsVision ?? fromCatalog?.supportsVision ?? true,
        configId: config.id,
      });
    },
    [select, catalog],
  );

  const quickIds = new Set(quickModels.map((m) => m.id));
  const activeConfig = value.configId
    ? configs.find((c) => c.id === value.configId)
    : undefined;

  return (
    <>
      <PromptInputButton
        onClick={() => setOpen(true)}
        tooltip={{
          content: activeConfig
            ? "دستیار فعال — برای تغییر کلیک کنید"
            : "تغییر مدل — دستیارها، فهرست سریع و کاتالوگ کامل",
        }}
        variant="ghost"
      >
        {activeConfig ? (
          <span className="text-sm leading-none">
            {activeConfig.avatarEmoji ?? "🤖"}
          </span>
        ) : (
          <CpuIcon className="size-4 text-primary" />
        )}
        <span className="max-w-[10rem] truncate text-xs">
          {activeConfig?.name ?? value.name}
        </span>
        <ChevronDownIcon className="size-3 opacity-60" />
      </PromptInputButton>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent
          aria-describedby={undefined}
          // DialogContent already carries glass-strong; the inner Command stays
          // bg-transparent to inherit it (no second glass class to stack).
          className="overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">انتخاب مدل یا دستیار</DialogTitle>
          <Command className="bg-transparent **:data-[slot=command-input-wrapper]:h-11">
            <CommandInput placeholder="جستجوی دستیارها و مدل‌ها…" />
            <CommandList className="max-h-80">
              <CommandEmpty className="py-6 text-center text-fg-3 text-xs">
                موردی یافت نشد
              </CommandEmpty>
              {configs.length > 0 && (
                <CommandGroup heading="دستیارهای من">
                  {configs.map((config) => {
                    const selected = value.configId === config.id;
                    return (
                    <CommandItem
                      key={config.id}
                      onSelect={() => selectConfig(config)}
                      className={
                        selected ? "ring-1 ring-primary/30" : undefined
                      }
                      value={`assistant ${config.name} ${config.modelId}`}
                    >
                      <CheckIcon
                        className={`size-3.5 ${selected ? "text-primary opacity-100" : "opacity-0"}`}
                      />
                      <span className="text-base leading-none">
                        {config.avatarEmoji ?? "🤖"}
                      </span>
                      <span className="truncate text-xs">{config.name}</span>
                      <span
                        dir="ltr"
                        className="ms-auto truncate font-mono text-[10px] text-fg-4"
                      >
                        {modelLabel(config.modelId)}
                      </span>
                    </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              <CommandGroup heading="سریع">
                {quickModels.map((model) => {
                  const selected = !value.configId && value.id === model.id;
                  return (
                  <CommandItem
                    key={model.id}
                    onSelect={() =>
                      selectModel({
                        id: model.id,
                        name: model.name,
                        contextWindow: model.contextWindow,
                        supportsVision: model.supportsVision,
                      })
                    }
                    className={selected ? "ring-1 ring-primary/30" : undefined}
                    value={`${model.name} ${model.id}`}
                  >
                    <CheckIcon
                      className={`size-3.5 ${selected ? "text-primary opacity-100" : "opacity-0"}`}
                    />
                    <span dir="ltr" className="font-mono text-xs">
                      {model.name}
                    </span>
                    <span className="ms-auto text-[10px] text-fg-4">
                      {formatContext(model.contextWindow)} توکن
                    </span>
                  </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup heading="همه مدل‌ها">
                {catalogError && (
                  <p className="px-2 py-2 text-destructive text-xs">
                    <span dir="ltr" className="font-mono">
                      ERR:
                    </span>{" "}
                    {catalogError}
                  </p>
                )}
                {!(catalog || catalogError) && (
                  <p className="px-2 py-2 text-fg-3 text-xs">
                    در حال بارگذاری کاتالوگ…
                  </p>
                )}
                {catalog
                  ?.filter((model) => !quickIds.has(model.id))
                  .map((model) => {
                    const selected =
                      !value.configId && value.id === model.id;
                    return (
                    <CommandItem
                      key={model.id}
                      onSelect={() =>
                        selectModel({
                          id: model.id,
                          name: model.name,
                          contextWindow: model.contextWindow,
                          supportsVision: model.supportsVision,
                        })
                      }
                      className={
                        selected ? "ring-1 ring-primary/30" : undefined
                      }
                      value={`${model.name} ${model.id}`}
                    >
                      <CheckIcon
                        className={`size-3.5 ${selected ? "text-primary opacity-100" : "opacity-0"}`}
                      />
                      <div className="flex min-w-0 flex-col" dir="ltr">
                        <span className="truncate font-mono text-xs">
                          {model.name}
                        </span>
                        <span className="truncate font-mono text-[10px] text-fg-4">
                          {model.id}
                        </span>
                      </div>
                      <div className="ms-auto flex flex-col items-end text-[10px] text-fg-4">
                        <span>{formatContext(model.contextWindow)} توکن</span>
                        <span dir="ltr" className="font-mono">
                          {formatPrice(model)}
                        </span>
                      </div>
                    </CommandItem>
                    );
                  })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

/*
 * ── Integration contract (for the chat-pane integrator) ──────────────────
 *
 * The picker stays backward compatible: `value`/`onChange` carry the same
 * `SelectedModel` shape as before, with one additive field — `configId`.
 *
 *   - Bare model picked   → onChange({ id, name, contextWindow,
 *                            supportsVision, configId: null })
 *   - Assistant picked    → onChange({ ...config's model fields,
 *                            configId: config.id })
 *
 * To wire assistants into chat:
 *   1. Pass `configs={configs}` (load via listConfigs() in the RSC, hand to
 *      ChatPane → ModelPicker). Empty/omitted ⇒ assistants group hidden.
 *   2. In `changeModel`, when `model.configId` changed, call
 *      `bindConfigAction(conversationId, model.configId)` (already exported
 *      from @/lib/actions) alongside the existing setModelAction.
 *   3. Send `configId: selectedModel.configId` in the chat request body
 *      (prepareSendMessagesRequest). The /api/chat route then resolves
 *      getConfig(configId) → buildSystemPrompt(settings, config) and applies
 *      config.params to streamText (see ConfigParams → streamText mapping in
 *      lib/db/types.ts: temperature, topP, maxOutputTokens, and
 *      providerOptions.openrouter.reasoning.effort for reasoningEffort).
 *   4. Initial selection on a hydrated conversation: if conversation.configId
 *      is set, seed `value.configId` from it.
 */
