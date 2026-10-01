"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createProjectAction,
  updateProjectAction,
} from "@/lib/actions/projects";
import type { ProjectRow } from "@/lib/db/schema";
import { detectDir } from "@/lib/use-direction";

const EMOJI_CHOICES = [
  "📁",
  "🚀",
  "💡",
  "📊",
  "🎯",
  "🧠",
  "✍️",
  "🔬",
  "💼",
  "🎨",
  "📚",
  "⚙️",
];

const COLOR_CHOICES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this project instead of creating one. */
  project?: ProjectRow;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        {/* Key by target id so switching between projects (or to "new")
            remounts the form and re-seeds its useState from the new props. */}
        <ProjectForm
          key={project?.id ?? "new"}
          onOpenChange={onOpenChange}
          project={project}
        />
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({
  onOpenChange,
  project,
}: {
  onOpenChange: (open: boolean) => void;
  project?: ProjectRow;
}) {
  const editing = Boolean(project);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [emoji, setEmoji] = useState(project?.emoji ?? EMOJI_CHOICES[0]);
  const [color, setColor] = useState(project?.color ?? COLOR_CHOICES[0]);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      if (editing && project) {
        await updateProjectAction(project.id, {
          name: trimmed,
          description: description.trim() || null,
          emoji,
          color,
        });
      } else {
        await createProjectAction({
          name: trimmed,
          description: description.trim() || null,
          emoji,
          color,
        });
      }
      onOpenChange(false);
      if (!editing) {
        setName("");
        setDescription("");
      }
    });
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
            <DialogTitle className="font-heading font-bold text-base text-foreground">
              {editing ? "ویرایش پروژه" : "پروژه جدید"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <p className="font-medium text-fg-3 text-xs">نام پروژه</p>
            <Input
              autoFocus
              className="text-sm"
              dir={detectDir(name)}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="مثلاً بازطراحی وب‌سایت"
              value={name}
            />
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-fg-3 text-xs">توضیح (اختیاری)</p>
            <Textarea
              className="min-h-16 text-sm"
              dir={detectDir(description)}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="یک خط درباره هدف این پروژه"
              value={description}
            />
          </div>

          <div className="flex items-start gap-6">
            <div className="space-y-1.5">
              <p className="font-medium text-fg-3 text-xs">نماد</p>
              <div className="flex flex-wrap gap-1">
                {EMOJI_CHOICES.map((e) => (
                  <button
                    className={`grid size-8 place-items-center rounded-lg text-base transition-colors ${
                      emoji === e
                        ? "bg-primary/15 ring-1 ring-primary/40"
                        : "hover:bg-muted"
                    }`}
                    key={e}
                    onClick={() => setEmoji(e)}
                    type="button"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-fg-3 text-xs">رنگ</p>
              <div className="flex gap-1.5 pt-1">
                {COLOR_CHOICES.map((c) => (
                  <button
                    aria-label="انتخاب رنگ"
                    className={`size-6 rounded-full transition-transform ${
                      color === c
                        ? "scale-110 ring-2 ring-foreground/40 ring-offset-2 ring-offset-background"
                        : ""
                    }`}
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ background: c }}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              انصراف
            </Button>
            <Button
              disabled={isPending || !name.trim()}
              onClick={submit}
              type="button"
            >
              {isPending
                ? "در حال ذخیره…"
                : editing
                  ? "ذخیره تغییرات"
                  : "ساختن"}
            </Button>
          </div>
    </div>
  );
}
