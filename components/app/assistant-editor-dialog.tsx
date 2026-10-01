"use client";

import { ImageIcon, SearchIcon, ServerIcon, SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { ModelPicker, type SelectedModel } from "@/components/app/model-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSISTANT_EMOJIS,
  DEFAULT_ASSISTANT_EMOJI,
} from "@/lib/assistant-emojis";
import type { McpServerRow } from "@/lib/db/schema";
import type { ConfigRow } from "@/lib/db/schema";
import type { ConfigParams, ConfigToolConfig } from "@/lib/db/types";
import { DEFAULT_MODEL_ID, getModel } from "@/lib/models";
import { chartTint, hashTint } from "@/lib/tint";
import { NATIVE_TOOL_IDS, NATIVE_TOOL_LABELS } from "@/lib/tools";
import { detectDir } from "@/lib/use-direction";
import {
  createConfigAction,
  updateConfigAction,
} from "@/lib/actions";

/** Persian transport labels for the MCP server badge. */
const MCP_TRANSPORT_LABELS: Record<McpServerRow["transport"], string> = {
  http: "HTTP",
  sse: "SSE",
  stdio: "stdio",
};

/** Per-native-tool lucide icon, keyed by tool id. */
const NATIVE_TOOL_ICONS: Record<string, typeof SearchIcon> = {
  knowledge_search: SearchIcon,
  generate_image: ImageIcon,
};

/** Per-capability identity hue (chart-ramp slot), keyed by tool id. */
const NATIVE_TOOL_TINTS: Record<string, 1 | 2 | 3 | 4 | 5> = {
  knowledge_search: 3, // teal — matches the knowledge section
  generate_image: 5, // rose — matches the studio section
};
/** MCP servers share the assistants/tools family hue (violet). */
const MCP_TINT = 2 as const;

type ReasoningEffort = NonNullable<ConfigParams["reasoningEffort"]>;
const REASONING_NONE = "none" as const;
type ReasoningChoice = ReasoningEffort | typeof REASONING_NONE;

const REASONING_LABELS: Record<ReasoningChoice, string> = {
  none: "بدون استدلال",
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
};

interface FormState {
  name: string;
  avatarEmoji: string;
  systemPrompt: string;
  modelId: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  reasoningEffort: ReasoningChoice;
  enabledTools: string[];
  mcpServerIds: string[];
}

function modelToSelected(modelId: string): SelectedModel {
  const m = getModel(modelId);
  return m.id === modelId
    ? {
        id: m.id,
        name: m.name,
        contextWindow: m.contextWindow,
        supportsVision: m.supportsVision,
        configId: null,
      }
    : {
        id: modelId,
        name: modelId.split("/").at(-1) ?? modelId,
        contextWindow: 0,
        supportsVision: true,
        configId: null,
      };
}

function initialForm(config: ConfigRow | null): FormState {
  const params = config?.params ?? {};
  const toolConfig = config?.toolConfig ?? {};
  return {
    name: config?.name ?? "",
    avatarEmoji: config?.avatarEmoji ?? DEFAULT_ASSISTANT_EMOJI,
    systemPrompt: config?.systemPrompt ?? "",
    modelId: config?.modelId ?? DEFAULT_MODEL_ID,
    temperature: params.temperature ?? 0.7,
    topP: params.topP ?? 1,
    maxTokens: params.maxTokens ?? 0,
    reasoningEffort: params.reasoningEffort ?? REASONING_NONE,
    enabledTools: toolConfig.enabledTools ?? [],
    mcpServerIds: toolConfig.mcpServerIds ?? [],
  };
}

/** Build the persisted params json, omitting unset/neutral values. */
function buildParams(form: FormState): ConfigParams | null {
  const params: ConfigParams = {};
  if (form.temperature !== 0.7) params.temperature = form.temperature;
  if (form.topP !== 1) params.topP = form.topP;
  if (form.maxTokens > 0) params.maxTokens = form.maxTokens;
  if (form.reasoningEffort !== REASONING_NONE)
    params.reasoningEffort = form.reasoningEffort;
  return Object.keys(params).length ? params : null;
}

/** Build the persisted tool config, null when no capabilities are selected. */
function buildToolConfig(form: FormState): ConfigToolConfig | null {
  const toolConfig: ConfigToolConfig = {};
  if (form.enabledTools.length) toolConfig.enabledTools = form.enabledTools;
  if (form.mcpServerIds.length) toolConfig.mcpServerIds = form.mcpServerIds;
  return Object.keys(toolConfig).length ? toolConfig : null;
}

export function AssistantEditorDialog({
  open,
  onOpenChange,
  config,
  mcpServers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null ⇒ create a new assistant; a row ⇒ edit it. */
  config: ConfigRow | null;
  /** MCP servers available to attach (from the settings registry). */
  mcpServers: McpServerRow[];
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(config));
  const [error, setError] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Re-seed the form whenever the target config changes (dialog reused across
  // create/edit). Keyed remount from the parent also works; this is defensive.
  const [seededId, setSeededId] = useState<string | null>(config?.id ?? null);
  if ((config?.id ?? null) !== seededId) {
    setSeededId(config?.id ?? null);
    setForm(initialForm(config));
    setError(null);
  }

  const patch = (next: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...next }));

  const toggleNativeTool = (id: string, on: boolean) =>
    patch({
      enabledTools: on
        ? [...form.enabledTools, id]
        : form.enabledTools.filter((t) => t !== id),
    });

  const toggleMcpServer = (id: string, on: boolean) =>
    patch({
      mcpServerIds: on
        ? [...form.mcpServerIds, id]
        : form.mcpServerIds.filter((s) => s !== id),
    });

  // Identity hue for the avatar tile: stable per-assistant (id for saved, name
  // while typing); falls back to violet (the assistants section hue) when empty.
  const avatarSeed = config?.id ?? form.name.trim();
  const avatarTint = avatarSeed ? hashTint(avatarSeed) : chartTint(2);

  const enhance = async () => {
    const prompt = form.systemPrompt.trim();
    if (!prompt || enhancing) return;
    setError(null);
    setEnhancing(true);
    try {
      const res = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = (await res.json()) as {
        enhancedPrompt?: string;
        error?: string;
      };
      if (!res.ok || !json.enhancedPrompt) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      patch({ systemPrompt: json.enhancedPrompt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "بهبود پرامپت ناموفق بود.");
    } finally {
      setEnhancing(false);
    }
  };

  const submit = () => {
    const name = form.name.trim();
    if (!name) {
      setError("نام دستیار الزامی است.");
      return;
    }
    setError(null);
    const payload = {
      name,
      avatarEmoji: form.avatarEmoji,
      systemPrompt: form.systemPrompt.trim(),
      modelId: form.modelId,
      params: buildParams(form),
      toolConfig: buildToolConfig(form),
    };
    startTransition(async () => {
      try {
        if (config) {
          await updateConfigAction(config.id, payload);
        } else {
          await createConfigAction(payload);
        }
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "ذخیره ناموفق بود.");
      }
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>
            {config ? "ویرایش دستیار" : "دستیار جدید"}
          </DialogTitle>
          <DialogDescription className="text-fg-4 text-xs">
            یک شخصیت، مدل و پارامترهای دلخواه برای گفتگوهایتان بسازید.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Identity: emoji + name */}
          <div className="space-y-2">
            <Label htmlFor="assistant-name">نام و نماد</Label>
            <div className="flex items-center gap-2">
              <div
                className="grid size-10 shrink-0 place-items-center rounded-xl text-lg"
                style={{
                  backgroundColor: `color-mix(in oklch, ${avatarTint} 14%, transparent)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${avatarTint} 35%, transparent)`,
                }}
              >
                {form.avatarEmoji}
              </div>
              <Input
                id="assistant-name"
                className="text-sm"
                dir={detectDir(form.name)}
                maxLength={80}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="مثلاً مشاور حقوقی، ویراستار فارسی"
                value={form.name}
              />
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {ASSISTANT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={form.avatarEmoji === emoji}
                  className={`grid size-8 place-items-center rounded-lg text-base transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    form.avatarEmoji === emoji
                      ? "bg-primary/15 ring-1 ring-primary/50"
                      : ""
                  }`}
                  onClick={() => patch({ avatarEmoji: emoji })}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label>مدل</Label>
            <div className="flex">
              <ModelPicker
                value={modelToSelected(form.modelId)}
                onChange={(m) => patch({ modelId: m.id })}
              />
            </div>
          </div>

          {/* System prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="assistant-prompt">پرامپت سیستمی</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-primary text-xs"
                disabled={!form.systemPrompt.trim() || enhancing}
                onClick={enhance}
              >
                <SparklesIcon className="size-3.5" />
                {enhancing ? "در حال بهبود…" : "بهبود با هوش مصنوعی"}
              </Button>
            </div>
            <Textarea
              id="assistant-prompt"
              className="min-h-32 text-sm"
              dir={detectDir(form.systemPrompt)}
              maxLength={10_000}
              onChange={(e) => patch({ systemPrompt: e.target.value })}
              placeholder="رفتار، شخصیت و قواعد دستیار را شرح دهید."
              value={form.systemPrompt}
            />
          </div>

          {/* Params */}
          <div className="space-y-4 rounded-xl bg-secondary/50 p-4">
            <p className="font-medium text-fg-3 text-xs">پارامترهای تولید</p>

            <ParamSlider
              label="دما (Temperature)"
              value={form.temperature}
              min={0}
              max={2}
              step={0.1}
              format={(v) => v.toFixed(1)}
              onChange={(v) => patch({ temperature: v })}
            />
            <ParamSlider
              label="هسته‌ای (Top-P)"
              value={form.topP}
              min={0}
              max={1}
              step={0.05}
              format={(v) => v.toFixed(2)}
              onChange={(v) => patch({ topP: v })}
            />
            <ParamSlider
              label="حداکثر توکن خروجی"
              value={form.maxTokens}
              min={0}
              max={32_000}
              step={256}
              format={(v) => (v === 0 ? "خودکار" : String(v))}
              onChange={(v) => patch({ maxTokens: v })}
            />

            <div className="space-y-1.5">
              <Label>تلاش استدلالی</Label>
              <Select
                value={form.reasoningEffort}
                onValueChange={(v) =>
                  patch({ reasoningEffort: v as ReasoningChoice })
                }
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-popover">
                  {(
                    [
                      REASONING_NONE,
                      "low",
                      "medium",
                      "high",
                    ] as ReasoningChoice[]
                  ).map((v) => (
                    <SelectItem key={v} value={v} className="text-sm">
                      {REASONING_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tools: native built-ins + attachable MCP servers */}
          <div className="space-y-4 rounded-xl bg-secondary/50 p-4">
            <div className="space-y-1">
              <p className="font-medium text-fg-3 text-xs">ابزارها</p>
              <p className="text-fg-4 text-xs leading-relaxed">
                توانایی‌هایی که این دستیار هنگام گفتگو می‌تواند به کار بگیرد.
              </p>
            </div>

            <div className="space-y-2">
              {NATIVE_TOOL_IDS.map((id) => {
                const Icon = NATIVE_TOOL_ICONS[id] ?? SparklesIcon;
                const tint = chartTint(NATIVE_TOOL_TINTS[id] ?? 2);
                const on = form.enabledTools.includes(id);
                return (
                  <label
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors"
                    key={id}
                    style={
                      on
                        ? {
                            backgroundColor: `color-mix(in oklch, ${tint} 9%, transparent)`,
                          }
                        : undefined
                    }
                  >
                    <span className="flex items-center gap-2 text-fg-2 text-sm">
                      <Icon className="size-4" style={{ color: tint }} />
                      {NATIVE_TOOL_LABELS[id]}
                    </span>
                    <Switch
                      checked={on}
                      onCheckedChange={(value) => toggleNativeTool(id, value)}
                    />
                  </label>
                );
              })}
            </div>

            <div className="space-y-2 border-border/60 border-t pt-3">
              <p className="flex items-center gap-1.5 font-medium text-fg-4 text-xs">
                <ServerIcon
                  className="size-3.5"
                  style={{ color: chartTint(MCP_TINT) }}
                />
                سرورهای MCP
              </p>
              {mcpServers.length === 0 ? (
                <p className="text-fg-4 text-xs leading-relaxed">
                  سروری تعریف نشده — از تنظیمات اضافه کنید.
                </p>
              ) : (
                <div className="space-y-2">
                  {mcpServers.map((server) => {
                    const on = form.mcpServerIds.includes(server.id);
                    return (
                      <label
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors"
                        key={server.id}
                        style={
                          on
                            ? {
                                backgroundColor: `color-mix(in oklch, ${chartTint(MCP_TINT)} 9%, transparent)`,
                              }
                            : undefined
                        }
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="truncate text-fg-2 text-sm"
                            dir={detectDir(server.name)}
                          >
                            {server.name}
                          </span>
                          <Badge
                            className="shrink-0 font-mono text-[10px]"
                            variant="secondary"
                          >
                            {MCP_TRANSPORT_LABELS[server.transport]}
                          </Badge>
                        </span>
                        <Switch
                          checked={on}
                          onCheckedChange={(value) =>
                            toggleMcpServer(server.id, value)
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          {error ? (
            <span className="text-destructive text-xs">{error}</span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              انصراف
            </Button>
            <Button type="button" disabled={isPending} onClick={submit}>
              {isPending ? "در حال ذخیره…" : "ذخیره دستیار"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span dir="ltr" className="font-mono text-fg-3 text-xs tabular-nums">
          {format(value)}
        </span>
      </div>
      <Slider
        dir="ltr"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}
