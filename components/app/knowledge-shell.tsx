"use client";

import { BookMarkedIcon, Loader2Icon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { KnowledgeCard } from "@/components/app/knowledge-card";
import {
  KF_ALL,
  KF_FAVORITES,
  KnowledgeFolderTree,
} from "@/components/app/knowledge-folder-tree";
import { KnowledgeItemDialog } from "@/components/app/knowledge-item-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchKnowledgeAction } from "@/lib/actions/knowledge";
import type { KnowledgeFolderRow, KnowledgeItemRow } from "@/lib/db/schema";
import { chartTint } from "@/lib/tint";

export function KnowledgeShell({
  folders,
  items,
}: {
  folders: KnowledgeFolderRow[];
  items: KnowledgeItemRow[];
}) {
  const [selected, setSelected] = useState<string>(KF_ALL);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeItemRow[] | null>(
    null,
  );
  const [searching, startSearch] = useTransition();
  const [creating, setCreating] = useState(false);

  // Debounced FTS search through the server action.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const handle = setTimeout(() => {
      startSearch(async () => {
        const hits = await searchKnowledgeAction(q);
        setSearchResults(hits);
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const folderCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) {
      if (it.folderId) map[it.folderId] = (map[it.folderId] ?? 0) + 1;
    }
    return map;
  }, [items]);

  const favoritesCount = useMemo(
    () => items.filter((i) => i.isFavorite).length,
    [items],
  );

  const visible = useMemo(() => {
    if (searchResults !== null) return searchResults;
    if (selected === KF_ALL) return items;
    if (selected === KF_FAVORITES) return items.filter((i) => i.isFavorite);
    return items.filter((i) => i.folderId === selected);
  }, [items, selected, searchResults]);

  const isSearching = searchResults !== null;
  const defaultFolderId =
    selected === KF_ALL || selected === KF_FAVORITES ? null : selected;

  return (
    <div>
      <header className="glass-strong sticky top-0 z-10 flex items-center justify-between gap-3 border-x-0 border-t-0 px-6 py-3">
        <div className="flex items-center gap-2">
          <BookMarkedIcon className="size-4" style={{ color: chartTint(3) }} />
          <span className="font-medium text-fg-1 text-sm">گنجینه دانش</span>
        </div>
        <Button
          className="gap-1.5"
          onClick={() => setCreating(true)}
          type="button"
        >
          <PlusIcon className="size-4" /> یادداشت جدید
        </Button>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 md:grid-cols-[220px_1fr]">
        <aside className="glass-strong h-fit rounded-2xl p-3 md:sticky md:top-20">
          <KnowledgeFolderTree
            counts={folderCounts}
            favoritesCount={favoritesCount}
            folders={folders}
            onSelect={setSelected}
            selected={selected}
            totalCount={items.length}
          />
        </aside>

        <main className="space-y-4">
          <div className="relative">
            {searching ? (
              <Loader2Icon className="-translate-y-1/2 absolute top-1/2 start-3 size-4 animate-spin text-fg-4" />
            ) : (
              <SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 start-3 size-4 text-fg-4" />
            )}
            <Input
              className="ps-9 text-sm"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی تمام‌متن در گنجینه…"
              value={query}
            />
          </div>

          {isSearching && (
            <p className="text-fg-4 text-xs">
              {visible.length} نتیجه برای «{query.trim()}»
            </p>
          )}

          {visible.length === 0 ? (
            <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
              <span
                className="grid size-14 place-items-center rounded-2xl"
                style={{
                  backgroundColor: `color-mix(in oklch, ${chartTint(3)} 12%, transparent)`,
                  color: chartTint(3),
                }}
              >
                <BookMarkedIcon className="size-7" />
              </span>
              <div className="space-y-1">
                <p className="font-heading font-medium text-foreground">
                  {isSearching ? "نتیجه‌ای یافت نشد" : "گنجینه شما خالی است"}
                </p>
                <p className="text-fg-3 text-sm">
                  {isSearching
                    ? "عبارت دیگری را امتحان کنید"
                    : "پاسخ‌های ارزشمند گفتگو را با «ذخیره در گنجینه» اینجا نگه دارید"}
                </p>
              </div>
              {!isSearching && (
                <Button
                  className="mt-1 gap-1.5"
                  onClick={() => setCreating(true)}
                  type="button"
                >
                  <PlusIcon className="size-4" /> افزودن یادداشت
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((item) => (
                <KnowledgeCard folders={folders} item={item} key={item.id} />
              ))}
            </div>
          )}
        </main>
      </div>

      <KnowledgeItemDialog
        defaultFolderId={defaultFolderId}
        onOpenChange={setCreating}
        open={creating}
      />
    </div>
  );
}
