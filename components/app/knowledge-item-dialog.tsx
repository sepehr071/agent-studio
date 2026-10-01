"use client";

import { XIcon } from "lucide-react";
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
  createKnowledgeItemAction,
  updateKnowledgeItemAction,
} from "@/lib/actions/knowledge";
import type { KnowledgeItemRow } from "@/lib/db/schema";
import { detectDir } from "@/lib/use-direction";

export function KnowledgeItemDialog({
  open,
  onOpenChange,
  item,
  defaultFolderId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, edits this item; otherwise creates a new one. */
  item?: KnowledgeItemRow;
  defaultFolderId?: string | null;
}) {
  const editing = Boolean(item);
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const addTag = () => {
    const t = tagDraft.trim();
    setTagDraft("");
    if (t && !tags.includes(t)) setTags([...tags, t]);
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    startTransition(async () => {
      if (editing && item) {
        await updateKnowledgeItemAction(item.id, {
          title: trimmed,
          content,
          tags: tags.length ? tags : null,
        });
      } else {
        await createKnowledgeItemAction({
          title: trimmed,
          content,
          tags: tags.length ? tags : null,
          folderId: defaultFolderId,
        });
        setTitle("");
        setContent("");
        setTags([]);
      }
      onOpenChange(false);
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-base text-foreground">
              {editing ? "ویرایش یادداشت" : "یادداشت جدید"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <p className="font-medium text-fg-3 text-xs">عنوان</p>
            <Input
              autoFocus
              className="text-sm"
              dir={detectDir(title)}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان یادداشت"
              value={title}
            />
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-fg-3 text-xs">محتوا (Markdown)</p>
            <Textarea
              className="min-h-40 text-sm"
              dir={detectDir(content)}
              onChange={(e) => setContent(e.target.value)}
              placeholder="متن یادداشت را اینجا بنویسید…"
              value={content}
            />
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-fg-3 text-xs">برچسب‌ها</p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    className="flex items-center gap-1 rounded-full bg-primary/10 ps-2 pe-1 py-0.5 text-primary text-xs"
                    dir={detectDir(t)}
                    key={t}
                  >
                    {t}
                    <button
                      aria-label="حذف برچسب"
                      className="rounded-full p-0.5 transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      type="button"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              className="h-8 text-sm"
              dir={detectDir(tagDraft)}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="برچسب را بنویسید و Enter بزنید"
              value={tagDraft}
            />
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
              disabled={isPending || !title.trim()}
              onClick={submit}
              type="button"
            >
              {isPending
                ? "در حال ذخیره…"
                : editing
                  ? "ذخیره تغییرات"
                  : "ذخیره"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
