"use client";

import { SparklesIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Presentational status chip for the assistant: a round glass disc carrying a
 * SparklesIcon ringed by the active accent, optionally trailed by a friendly
 * model-name badge. `thinking`/`streaming` add the `ai-glow-pulse` keyframe
 * (defined in globals.css, reduced-motion gated there) — also gated here so the
 * class never lands while a user prefers reduced motion. Dumb on purpose: no
 * copy of its own beyond the `modelName` passthrough.
 */
export function AssistantPresence({
  state = "idle",
  modelName,
  size = "sm",
  className,
}: {
  state?: "idle" | "thinking" | "streaming" | "done";
  modelName?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const isActive = state === "thinking" || state === "streaming";
  const pulse = isActive && !reduceMotion;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "glass inline-flex shrink-0 items-center justify-center rounded-full",
          "ring-1 ring-[var(--accent-base)]/40",
          size === "md" ? "size-7" : "size-5",
          pulse && "ai-glow-pulse",
        )}
      >
        <SparklesIcon
          className={cn(
            "text-[var(--accent-base)]",
            size === "md" ? "size-4" : "size-3",
          )}
        />
      </span>
      {modelName ? (
        <span className="text-meta text-fg-3">{modelName}</span>
      ) : null}
    </span>
  );
}
