"use client";

import { TagIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { setConversationTagsAction } from "@/lib/actions/conversations";
import { detectDir } from "@/lib/use-direction";

export function TagsEditor({
  conversationId,
  tags,
}: {
  conversationId: string;
  tags: string[];
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string[]>(tags);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  const persist = (next: string[]) => {
    setCurrent(next);
    startTransition(() => setConversationTagsAction(conversationId, next));
  };

  const add = () => {
    const t = draft.trim();
    setDraft("");
    if (t && !current.includes(t)) persist([...current, t]);
  };

  const remove = (t: string) => persist(current.filter((x) => x !== t));

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-fg-4 text-xs outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          type="button"
        >
          <TagIcon className="size-3" />
          {current.length > 0 ? (
            <span className="text-fg-3">{current.length} برچسب</span>
          ) : (
            "برچسب"
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2">
        <p className="font-medium text-fg-3 text-xs">برچسب‌ها</p>
        {current.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {current.map((t) => (
              <span
                className="flex items-center gap-1 rounded-full bg-primary/10 ps-2 pe-1 py-0.5 text-primary text-xs"
                dir={detectDir(t)}
                key={t}
              >
                {t}
                <button
                  aria-label="حذف برچسب"
                  className="rounded-full p-0.5 hover:bg-primary/20"
                  onClick={() => remove(t)}
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
          dir={detectDir(draft)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="برچسب را بنویسید و Enter بزنید"
          value={draft}
        />
      </PopoverContent>
    </Popover>
  );
}
