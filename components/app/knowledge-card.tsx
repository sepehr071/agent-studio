"use client";

import {
  ExternalLinkIcon,
  FolderInputIcon,
  MoreHorizontalIcon,
  PencilIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { KnowledgeItemDialog } from "@/components/app/knowledge-item-dialog";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteKnowledgeItemAction,
  toggleKnowledgeFavoriteAction,
  updateKnowledgeItemAction,
} from "@/lib/actions/knowledge";
import type { KnowledgeFolderRow, KnowledgeItemRow } from "@/lib/db/schema";
import { chartTint } from "@/lib/tint";
import { detectDir } from "@/lib/use-direction";

/** Drop a leading markdown heading marker (`## `) from auto-saved titles. */
function cleanTitle(title: string): string {
  return title.replace(/^#{1,6}\s+/, "");
}

export function KnowledgeCard({
  item,
  folders,
}: {
  item: KnowledgeItemRow;
  folders: KnowledgeFolderRow[];
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const sourceHref =
    item.sourceConversationId &&
    `/chat/${item.sourceConversationId}${
      item.sourceMessageId ? `#msg-${item.sourceMessageId}` : ""
    }`;

  return (
    <>
      <div className="group glass flex flex-col gap-3 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-heading font-medium text-foreground text-sm leading-snug"
            dir={detectDir(item.title)}
          >
            {cleanTitle(item.title)}
          </h3>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              aria-label={item.isFavorite ? "حذف از برگزیده" : "افزودن به برگزیده"}
              className={`rounded-md p-1 transition-colors hover:bg-muted ${
                item.isFavorite ? "text-warn" : "text-fg-4 hover:text-foreground"
              }`}
              onClick={() =>
                startTransition(() => toggleKnowledgeFavoriteAction(item.id))
              }
              type="button"
            >
              <StarIcon
                className={`size-4 ${item.isFavorite ? "fill-current" : ""}`}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-md p-1 text-fg-4 transition-colors hover:bg-muted hover:text-foreground"
                  type="button"
                >
                  <MoreHorizontalIcon className="size-4" />
                  <span className="sr-only">عملیات</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-sm">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <PencilIcon className="size-3.5" /> ویرایش
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderInputIcon className="size-3.5" /> انتقال به پوشه
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="text-sm">
                    <DropdownMenuItem
                      onClick={() =>
                        startTransition(() =>
                          updateKnowledgeItemAction(item.id, {
                            folderId: null,
                          }),
                        )
                      }
                    >
                      بدون پوشه
                    </DropdownMenuItem>
                    {folders.length > 0 && <DropdownMenuSeparator />}
                    {folders.map((f) => (
                      <DropdownMenuItem
                        key={f.id}
                        onClick={() =>
                          startTransition(() =>
                            updateKnowledgeItemAction(item.id, {
                              folderId: f.id,
                            }),
                          )
                        }
                      >
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    startTransition(() => deleteKnowledgeItemAction(item.id))
                  }
                  variant="destructive"
                >
                  <Trash2Icon className="size-3.5" /> حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {item.content && (
          <div
            className="prose-knowledge line-clamp-4 text-fg-2 text-xs leading-relaxed"
            dir={detectDir(item.content)}
          >
            <MessageResponse>{item.content}</MessageResponse>
          </div>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span
                className="rounded-full bg-muted px-2 py-0.5 text-fg-3 text-xs"
                dir={detectDir(t)}
                key={t}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {item.modelId ? (
            <span
              className="truncate rounded-md px-2 py-0.5 font-mono text-fg-3 text-xs"
              dir="ltr"
              style={{
                backgroundColor: `color-mix(in oklch, ${chartTint(1)} 10%, transparent)`,
              }}
            >
              {item.modelId}
            </span>
          ) : (
            <span />
          )}
          {sourceHref && (
            <Link
              className="flex shrink-0 items-center gap-1 text-primary text-xs transition-opacity hover:opacity-80"
              href={sourceHref}
            >
              <ExternalLinkIcon className="size-3" />
              بازگشت به منبع
            </Link>
          )}
        </div>
      </div>
      <KnowledgeItemDialog item={item} onOpenChange={setEditing} open={editing} />
    </>
  );
}
