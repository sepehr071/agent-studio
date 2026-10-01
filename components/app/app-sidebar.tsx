"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { ThemeToggle } from "@/components/app/theme-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  deleteConversationAction,
  renameConversationAction,
  searchMessagesAction,
  toggleArchiveAction,
  togglePinAction,
} from "@/lib/actions";
import { chartTint } from "@/lib/tint";
import { cn } from "@/lib/utils";

/** A body-match hit from full-text search over message contents. */
interface MessageSearchHit {
  conversationId: string;
  messageId: string;
  conversationTitle: string;
  snippet: string;
}

export interface SidebarConversation {
  id: string;
  title: string;
  isPinned: boolean;
  isArchived: boolean;
}

function ConversationRow({
  conversation,
  isActive,
  currentConversationId,
}: {
  conversation: SidebarConversation;
  isActive: boolean;
  currentConversationId?: string;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation.title);
  const [isPending, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();

  const commitRename = () => {
    setIsRenaming(false);
    if (draftTitle.trim() && draftTitle !== conversation.title) {
      startTransition(() =>
        renameConversationAction(conversation.id, draftTitle),
      );
    }
  };

  const handleDelete = () => {
    startTransition(() =>
      deleteConversationAction(conversation.id, currentConversationId),
    );
    toast.success("گفتگو حذف شد");
  };

  // The row's <li> is the animated unit: layout for pin/archive reorder,
  // height+opacity collapse on removal. Rows aren't backdrop-blurred
  // (only the sidebar shell carries `.glass`), so height animation is safe.
  const motionProps = reduceMotion
    ? {}
    : ({
        layout: true,
        initial: { opacity: 0, height: 0 },
        animate: { opacity: 1, height: "auto" },
        exit: { opacity: 0, height: 0 },
        transition: { duration: 0.18, ease: "easeOut" },
      } as const);

  return (
    <motion.li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative overflow-hidden")}
      {...motionProps}
    >
      {isRenaming ? (
        <Input
          autoFocus
          className="h-8 text-sm"
          onBlur={commitRename}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setDraftTitle(conversation.title);
              setIsRenaming(false);
            }
          }}
          value={draftTitle}
        />
      ) : (
        <>
      <SidebarMenuButton
        asChild
        className="text-sm"
        isActive={isActive}
        tooltip={conversation.title}
      >
        <Link href={`/chat/${conversation.id}`}>
          <span className="truncate">{conversation.title}</span>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontalIcon />
            <span className="sr-only">عملیات گفتگو</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-sm" side="left">
          <DropdownMenuItem
            onClick={() => {
              setDraftTitle(conversation.title);
              setIsRenaming(true);
            }}
          >
            <PencilIcon className="size-3.5" /> تغییر نام
          </DropdownMenuItem>
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
          <DropdownMenuItem asChild>
            <a href={`/api/conversations/${conversation.id}/export?format=md`}>
              <DownloadIcon className="size-3.5" /> خروجی Markdown
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`/api/conversations/${conversation.id}/export?format=json`}
            >
              <DownloadIcon className="size-3.5" /> خروجی JSON
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmDelete(true);
            }}
            variant="destructive"
          >
            <Trash2Icon className="size-3.5" /> حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف گفتگو؟</AlertDialogTitle>
            <AlertDialogDescription>
              گفتگوی «{conversation.title}» و تمام پیام‌های آن برای همیشه حذف
              می‌شوند. این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isPending}
              onClick={handleDelete}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </>
      )}
    </motion.li>
  );
}

export function AppSidebar({
  conversations,
}: {
  conversations: SidebarConversation[];
}) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [messageHits, setMessageHits] = useState<MessageSearchHit[]>([]);

  const currentConversationId = params?.id;
  // Chat section identity hue (azure) — keeps the brand + new-chat affordances
  // aligned with the «/» nav row's tint.
  const chat = chartTint(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  // Debounced full-text search over message bodies — title matches stay
  // client-side (above); this surfaces hits inside conversation contents.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMessageHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const hits = await searchMessagesAction(q);
        if (!cancelled) setMessageHits(hits);
      } catch {
        if (!cancelled) setMessageHits([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Drop body hits whose conversation already appears in the title-match list
  // so the same conversation isn't shown twice.
  const titleMatchIds = useMemo(
    () => new Set(filtered.map((c) => c.id)),
    [filtered],
  );
  const bodyHits = useMemo(
    () => messageHits.filter((h) => !titleMatchIds.has(h.conversationId)),
    [messageHits, titleMatchIds],
  );

  const pinned = filtered.filter((c) => c.isPinned && !c.isArchived);
  const recent = filtered.filter((c) => !c.isPinned && !c.isArchived);
  const archived = filtered.filter((c) => c.isArchived);

  return (
    <Sidebar className="glass border-0" side="right">
      <SidebarHeader className="gap-3 border-b px-3 py-3">
        <Link
          className="flex items-center gap-2 px-1 font-heading font-bold text-base"
          href="/"
        >
          {/* Brand tile + new-chat button carry the chat section's azure
              identity (chart-1) so they line up with the «/» nav row. */}
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-lg"
            style={{
              background: `color-mix(in oklab, ${chat} 15%, transparent)`,
              color: chat,
            }}
          >
            <SparklesIcon className="size-4" />
          </span>
          استودیو
        </Link>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="font-medium hover:bg-[color-mix(in_oklab,var(--chart-1)_16%,transparent)]"
              style={{
                background: `color-mix(in oklab, ${chat} 10%, transparent)`,
                color: chat,
              }}
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
            >
              <PlusIcon className="size-4" />
              گفتگوی جدید
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav />

        <div className="px-3 pt-1 pb-2">
          <div className="relative">
            <SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 start-2.5 size-3.5 text-fg-4" />
            <Input
              className="h-8 ps-8 text-sm"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی گفتگوها…"
              value={query}
            />
          </div>
        </div>

        {pinned.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>سنجاق‌شده</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <AnimatePresence initial={false}>
                  {pinned.map((conversation) => (
                    <ConversationRow
                      conversation={conversation}
                      currentConversationId={currentConversationId}
                      isActive={conversation.id === currentConversationId}
                      key={conversation.id}
                    />
                  ))}
                </AnimatePresence>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>اخیر</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recent.length === 0 && (
                <p className="px-2 py-1 text-fg-4 text-xs">
                  {query ? "موردی یافت نشد" : "هنوز گفتگویی نیست"}
                </p>
              )}
              <AnimatePresence initial={false}>
                {recent.map((conversation) => (
                  <ConversationRow
                    conversation={conversation}
                    currentConversationId={currentConversationId}
                    isActive={conversation.id === currentConversationId}
                    key={conversation.id}
                  />
                ))}
              </AnimatePresence>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {archived.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>بایگانی</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <AnimatePresence initial={false}>
                  {archived.map((conversation) => (
                    <ConversationRow
                      conversation={conversation}
                      currentConversationId={currentConversationId}
                      isActive={conversation.id === currentConversationId}
                      key={conversation.id}
                    />
                  ))}
                </AnimatePresence>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {query.trim() && bodyHits.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>نتایج در پیام‌ها</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {bodyHits.map((hit) => (
                  <SidebarMenuItem key={hit.messageId}>
                    <SidebarMenuButton
                      asChild
                      className="h-auto flex-col items-start gap-0.5 py-1.5"
                      isActive={hit.conversationId === currentConversationId}
                    >
                      <Link href={`/chat/${hit.conversationId}`}>
                        <span className="w-full truncate text-fg-2 text-sm">
                          {hit.conversationTitle}
                        </span>
                        <span className="w-full truncate text-fg-4 text-xs">
                          {hit.snippet}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-1">
            <SidebarMenuButton asChild className="flex-1 text-sm">
              <Link href="/settings">
                <Settings2Icon className="size-4" />
                تنظیمات
              </Link>
            </SidebarMenuButton>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
