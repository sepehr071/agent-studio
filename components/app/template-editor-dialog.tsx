"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createTemplateAction,
  updateTemplateAction,
} from "@/lib/actions";
import type { PromptTemplateRow } from "@/lib/db/schema";
import { extractTemplateVariables } from "@/lib/templates";
import { TEMPLATE_CATEGORIES } from "@/lib/templates-categories";
import { detectDir } from "@/lib/use-direction";

export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  defaultCategory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing template, or null for create. */
  template: PromptTemplateRow | null;
  defaultCategory?: string;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(
    TEMPLATE_CATEGORIES[0],
  );
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset the form whenever the dialog opens for a (different) target
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (template) {
      setTitle(template.title);
      setCategory(template.category);
      setBody(template.body);
    } else {
      setTitle("");
      setCategory(defaultCategory ?? TEMPLATE_CATEGORIES[0]);
      setBody("");
    }
  }, [open, template, defaultCategory]);

  const variables = extractTemplateVariables(body);

  const submit = () => {
    if (!title.trim() || !body.trim()) {
      setError("عنوان و متن قالب الزامی است");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (template) {
          await updateTemplateAction(template.id, {
            title: title.trim(),
            category,
            body,
          });
        } else {
          await createTemplateAction({ title: title.trim(), category, body });
        }
        onOpenChange(false);
      } catch {
        setError("ذخیره قالب ناموفق بود");
      }
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? "ویرایش قالب" : "قالب جدید"}</DialogTitle>
          <DialogDescription>
            با نوشتن{" "}
            <code dir="ltr" className="font-mono text-xs">
              {"{{نام_متغیر}}"}
            </code>{" "}
            متغیرها به صورت خودکار شناسایی می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <p className="font-medium text-fg-3 text-xs">عنوان</p>
              <Input
                dir={detectDir(title)}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً نگارش مقاله وبلاگ"
                value={title}
              />
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-fg-3 text-xs">دسته‌بندی</p>
              <Select onValueChange={setCategory} value={category}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-fg-3 text-xs">متن قالب</p>
            <Textarea
              className="min-h-40"
              dir={detectDir(body)}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"متن قالب… از {{متغیر}} برای جای‌گذاری استفاده کنید"}
              value={body}
            />
          </div>

          {variables.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-medium text-fg-3 text-xs">
                متغیرهای شناسایی‌شده
              </p>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <span
                    key={v}
                    dir="ltr"
                    className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-primary text-xs"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            انصراف
          </Button>
          <Button disabled={isPending} onClick={submit} type="button">
            {isPending ? "در حال ذخیره…" : "ذخیره قالب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
