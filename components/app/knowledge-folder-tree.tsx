"use client";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  LibraryIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  createKnowledgeFolderAction,
  deleteKnowledgeFolderAction,
  updateKnowledgeFolderAction,
} from "@/lib/actions/knowledge";
import type { KnowledgeFolderRow } from "@/lib/db/schema";
import { chartTint } from "@/lib/tint";

// Teal active-row treatment (knowledge section hue). The 2px inline-start bar is
// carried by a logical `border-s-2` reserved transparent on every row (no layout
// shift); we only tint bg + bar + text when the row is active.
const TEAL = chartTint(3);
const activeRowStyle: React.CSSProperties = {
  backgroundColor: `color-mix(in oklch, ${TEAL} 12%, transparent)`,
  borderInlineStartColor: TEAL,
  color: TEAL,
};

interface KFNode extends KnowledgeFolderRow {
  children: KFNode[];
}

function buildTree(folders: KnowledgeFolderRow[]): KFNode[] {
  const map = new Map<string, KFNode>();
  for (const f of folders) map.set(f.id, { ...f, children: [] });
  const roots: KFNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// Special sentinel select values
export const KF_ALL = "__all__";
export const KF_FAVORITES = "__favorites__";

function KFItem({
  node,
  depth,
  selected,
  onSelect,
  counts,
}: {
  node: KFNode;
  depth: number;
  selected: string;
  onSelect: (id: string) => void;
  counts: Record<string, number>;
}) {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(node.name);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [, startTransition] = useTransition();
  const active = selected === node.id;
  const hasChildren = node.children.length > 0;

  const commitRename = () => {
    setRenaming(false);
    const t = draft.trim();
    if (t && t !== node.name) {
      startTransition(() => updateKnowledgeFolderAction(node.id, { name: t }));
    } else setDraft(node.name);
  };

  const commitChild = () => {
    const t = childName.trim();
    setAddingChild(false);
    setChildName("");
    if (t) {
      startTransition(async () => {
        await createKnowledgeFolderAction({ parentId: node.id, name: t });
      });
    }
  };

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-lg border-s-2 border-s-transparent pe-1 ps-2 text-sm transition-colors ${
          active ? "" : "hover:bg-muted"
        }`}
        style={{ marginInlineStart: depth * 12, ...(active && activeRowStyle) }}
      >
        <button
          aria-label={open ? "بستن" : "باز کردن"}
          className="grid size-5 shrink-0 place-items-center rounded text-fg-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {hasChildren ? (
            open ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronLeftIcon className="size-3.5" />
            )
          ) : (
            <span className="size-3.5" />
          )}
        </button>
        {renaming ? (
          <Input
            autoFocus
            className="my-0.5 h-7 text-sm"
            onBlur={commitRename}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(node.name);
                setRenaming(false);
              }
            }}
            value={draft}
          />
        ) : (
          <button
            className="flex flex-1 items-center gap-1.5 rounded py-1.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => onSelect(node.id)}
            type="button"
          >
            {active || open ? (
              <FolderOpenIcon className="size-4 shrink-0" />
            ) : (
              <FolderIcon className="size-4 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
            {counts[node.id] ? (
              <span className="text-fg-4 text-xs">{counts[node.id]}</span>
            ) : null}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-md p-1 text-fg-4 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100 data-[state=open]:opacity-100"
              type="button"
            >
              <MoreHorizontalIcon className="size-3.5" />
              <span className="sr-only">عملیات پوشه</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-sm">
            <DropdownMenuItem
              onClick={() => {
                setDraft(node.name);
                setRenaming(true);
              }}
            >
              <PencilIcon className="size-3.5" /> تغییر نام
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setOpen(true);
                setAddingChild(true);
              }}
            >
              <FolderPlusIcon className="size-3.5" /> زیرپوشه
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (active) onSelect(KF_ALL);
                startTransition(() => deleteKnowledgeFolderAction(node.id));
              }}
              variant="destructive"
            >
              <Trash2Icon className="size-3.5" /> حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {addingChild && (
        <div
          className="my-1"
          style={{ marginInlineStart: (depth + 1) * 12 + 20 }}
        >
          <Input
            autoFocus
            className="h-7 text-sm"
            onBlur={commitChild}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitChild();
              if (e.key === "Escape") {
                setChildName("");
                setAddingChild(false);
              }
            }}
            placeholder="نام زیرپوشه"
            value={childName}
          />
        </div>
      )}

      {open && hasChildren && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <KFItem
              counts={counts}
              depth={depth + 1}
              key={child.id}
              node={child}
              onSelect={onSelect}
              selected={selected}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function KnowledgeFolderTree({
  folders,
  selected,
  onSelect,
  counts = {},
  totalCount = 0,
  favoritesCount = 0,
}: {
  folders: KnowledgeFolderRow[];
  selected: string;
  onSelect: (id: string) => void;
  counts?: Record<string, number>;
  totalCount?: number;
  favoritesCount?: number;
}) {
  const tree = useMemo(() => buildTree(folders), [folders]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [, startTransition] = useTransition();

  const commit = () => {
    const t = name.trim();
    setAdding(false);
    setName("");
    if (t) {
      startTransition(async () => {
        await createKnowledgeFolderAction({ name: t });
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <span className="font-medium text-fg-3 text-xs">پوشه‌ها</span>
        <button
          aria-label="پوشه جدید"
          className="rounded-md p-1 text-fg-4 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => setAdding(true)}
          type="button"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      <ul className="space-y-0.5">
        <li>
          <button
            className={`flex w-full items-center gap-1.5 rounded-lg border-s-2 border-s-transparent px-2 py-1.5 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
              selected === KF_ALL ? "" : "hover:bg-muted"
            }`}
            onClick={() => onSelect(KF_ALL)}
            style={selected === KF_ALL ? activeRowStyle : undefined}
            type="button"
          >
            <span className="size-5" />
            <LibraryIcon className="size-4 shrink-0" />
            <span className="flex-1 truncate">همه موارد</span>
            {totalCount ? (
              <span className="text-fg-4 text-xs">{totalCount}</span>
            ) : null}
          </button>
        </li>
        <li>
          <button
            className={`flex w-full items-center gap-1.5 rounded-lg border-s-2 border-s-transparent px-2 py-1.5 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
              selected === KF_FAVORITES ? "" : "hover:bg-muted"
            }`}
            onClick={() => onSelect(KF_FAVORITES)}
            style={selected === KF_FAVORITES ? activeRowStyle : undefined}
            type="button"
          >
            <span className="size-5" />
            <StarIcon className="size-4 shrink-0" />
            <span className="flex-1 truncate">برگزیده‌ها</span>
            {favoritesCount ? (
              <span className="text-fg-4 text-xs">{favoritesCount}</span>
            ) : null}
          </button>
        </li>
        {tree.map((node) => (
          <KFItem
            counts={counts}
            depth={0}
            key={node.id}
            node={node}
            onSelect={onSelect}
            selected={selected}
          />
        ))}
      </ul>

      {adding && (
        <div className="px-2">
          <Input
            autoFocus
            className="h-7 text-sm"
            onBlur={commit}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setName("");
                setAdding(false);
              }
            }}
            placeholder="نام پوشه"
            value={name}
          />
        </div>
      )}
    </div>
  );
}
