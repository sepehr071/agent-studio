"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowRightIcon,
  FolderInputIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { FolderTree } from "@/components/app/folder-tree";
import { TagsEditor } from "@/components/app/tags-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  deleteConversationAction,
  moveConversationToFolderAction,
  moveConversationToProjectAction,
  toggleArchiveAction,
  togglePinAction,
} from "@/lib/actions/conversations";
import type { FolderRow, ProjectRow } from "@/lib/db/schema";

export interface ScopedConversation {
  id: string;
  title: string;
  folderId: string | null;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
}

function ConversationItem({
  conversation,
  folders,
}: {
  conversation: ScopedConversation;
  folders: FolderRow[];
}) {
  const [, startTransition] = useTransition();

  return (
    <div className="group glass flex items-center gap-2 rounded-xl px-3 py-2.5">
      <MessageSquareIcon className="size-4 shrink-0 text-fg-4" />
      <Link
        className="min-w-0 flex-1 truncate text-sm transition-colors hover:text-primary"
        href={`/chat/${conversation.id}`}
      >
        {conversation.title}
      </Link>
      {conversation.tags.length > 0 && (
        <div className="hidden gap-1 sm:flex">
          {conversation.tags.slice(0, 3).map((t) => (
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-fg-3 text-xs"
              key={t}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <TagsEditor conversationId={conversation.id} tags={conversation.tags} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-md p-1 text-fg-4 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
            type="button"
          >
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">عملیات گفتگو</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-sm">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInputIcon className="size-3.5" /> انتقال به پوشه
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="text-sm">
              <DropdownMenuItem
                onClick={() =>
                  startTransition(() =>
                    moveConversationToFolderAction(conversation.id, null),
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
                      moveConversationToFolderAction(conversation.id, f.id),
                    )
                  }
                >
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onClick={() =>
              startTransition(() => togglePinAction(conversation.id))
            }
          >
            {conversation.isPinned ? (
              <>
                <PinOffIcon className="size-3.5" /> برداشتن سنجاق
              </>
            ) : (
              <>
                <PinIcon className="size-3.5" /> سنجاق کردن
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              startTransition(() => toggleArchiveAction(conversation.id))
            }
          >
            {conversation.isArchived ? (
              <>
                <ArchiveRestoreIcon className="size-3.5" /> خروج از بایگانی
              </>
            ) : (
              <>
                <ArchiveIcon className="size-3.5" /> بایگانی کردن
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-fg-4 text-xs">
            خروج از پروژه
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() =>
              startTransition(() =>
                moveConversationToProjectAction(conversation.id, null),
              )
            }
          >
            <FolderInputIcon className="size-3.5" /> برداشتن از پروژه
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              startTransition(() => deleteConversationAction(conversation.id))
            }
            variant="destructive"
          >
            <Trash2Icon className="size-3.5" /> حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ProjectDetail({
  project,
  folders,
  conversations,
}: {
  project: ProjectRow;
  folders: FolderRow[];
  conversations: ScopedConversation[];
}) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const folderCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of conversations) {
      if (c.folderId) map[c.folderId] = (map[c.folderId] ?? 0) + 1;
    }
    return map;
  }, [conversations]);

  const unfiledCount = useMemo(
    () => conversations.filter((c) => !c.folderId).length,
    [conversations],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) =>
        selectedFolderId === null ? true : c.folderId === selectedFolderId,
      )
      .filter((c) => (q ? c.title.toLowerCase().includes(q) : true))
      .sort(
        (a, b) => Number(b.isPinned) - Number(a.isPinned),
      );
  }, [conversations, selectedFolderId, query]);

  return (
    <div>
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-3 border-x-0 border-t-0 px-6 py-3">
        <Link
          className="flex items-center gap-1.5 text-fg-3 text-sm transition-colors hover:text-foreground"
          href="/projects"
        >
          <ArrowRightIcon className="size-4" />
          پروژه‌ها
        </Link>
        <span className="text-fg-4">/</span>
        <span className="flex items-center gap-1.5 font-medium text-fg-1 text-sm">
          <span aria-hidden>{project.emoji ?? "📁"}</span>
          {project.name}
        </span>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-8 md:grid-cols-[220px_1fr]">
        <aside className="glass-strong h-fit rounded-2xl p-3 md:sticky md:top-20">
          <FolderTree
            counts={folderCounts}
            folders={folders}
            onSelect={setSelectedFolderId}
            projectId={project.id}
            selectedFolderId={selectedFolderId}
            unfiledCount={unfiledCount}
          />
        </aside>

        <main className="space-y-4">
          {project.description && (
            <p className="text-fg-3 text-sm">{project.description}</p>
          )}
          <div className="relative">
            <SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 start-3 size-4 text-fg-4" />
            <Input
              className="ps-9 text-sm"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در گفتگوهای این پروژه…"
              value={query}
            />
          </div>

          {visible.length === 0 ? (
            <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-14 text-center">
              <MessageSquareIcon className="size-7 text-fg-4" />
              <p className="font-medium text-foreground text-sm">
                {query ? "موردی یافت نشد" : "این بخش هنوز خالی است"}
              </p>
              <p className="text-fg-3 text-xs">
                گفتگوها را از نوار کناری به این پروژه منتقل کنید
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((c) => (
                <ConversationItem
                  conversation={c}
                  folders={folders}
                  key={c.id}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
