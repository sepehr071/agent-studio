"use client";

import { SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTemplateAction } from "@/lib/actions";
import { setComposerSeed } from "@/lib/composer-handoff";
import type { PromptTemplateRow } from "@/lib/db/schema";
import { extractTemplateVariables, fillTemplate } from "@/lib/templates";
import { detectDir } from "@/lib/use-direction";

export function TemplateFillDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PromptTemplateRow | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});

  const variables = useMemo(
    () =>
      template
        ? template.variables?.length
          ? template.variables
          : extractTemplateVariables(template.body)
        : [],
    [template],
  );

  useEffect(() => {
    if (open) setValues({});
  }, [open]);

  const preview = template ? fillTemplate(template.body, values) : "";

  const insert = () => {
    if (!template) return;
    setComposerSeed(preview);
    // Increment usage in the background; don't block navigation on it
    void useTemplateAction(template.id);
    onOpenChange(false);
    router.push("/");
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{template?.title ?? "تکمیل قالب"}</DialogTitle>
          <DialogDescription>
            مقادیر متغیرها را وارد کنید و پیش‌نمایش را در گفتگو درج کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            {variables.length === 0 && (
              <p className="text-fg-4 text-sm">
                این قالب متغیری ندارد و آماده درج است.
              </p>
            )}
            {variables.map((v) => (
              <div className="space-y-1.5" key={v}>
                <p
                  dir="ltr"
                  className="font-medium font-mono text-fg-3 text-xs"
                >
                  {v}
                </p>
                <Textarea
                  className="min-h-16"
                  dir={detectDir(values[v] ?? "")}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [v]: e.target.value }))
                  }
                  placeholder={`مقدار ${v}`}
                  value={values[v] ?? ""}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-fg-3 text-xs">پیش‌نمایش</p>
            <div
              dir={detectDir(preview)}
              className="glass max-h-72 overflow-auto whitespace-pre-wrap rounded-lg p-3 text-fg-1 text-sm leading-relaxed"
            >
              {preview}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            انصراف
          </Button>
          <Button disabled={!template} onClick={insert} type="button">
            <SendIcon className="size-4" />
            درج در گفتگو
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
