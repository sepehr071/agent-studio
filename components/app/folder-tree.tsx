"use client";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  InboxIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
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
  createFolderAction,
  deleteFolderAction,
  updateFolderAction,
} from "@/lib/actions/projects";
import type { FolderRow } from "@/lib/db/schema";

interface FolderNode extends FolderRow {
  children: FolderNode[];
}

function buildTree(folders: FolderRow[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  for (const f of folders) map.set(f.id, { ...f, children: [] });
  const roots: FolderNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function FolderRowItem({
  node,
  depth,
  projectId,
  selectedFolderId,
  onSelect,
  counts,
}: {
  node: FolderNode;
  depth: number;
  projectId: string;
  selectedFolderId: string | null;
  onSelect: (id: string | null) => void;
  counts: Record<string, number>;
}) {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(node.name);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [, startTransition] = useTransition();
  const active = selectedFolderId === node.id;
  const hasChildren = node.children.length > 0;

  const commitRename = () => {
    setRenaming(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== node.name) {
      startTransition(() => updateFolderAction(node.id, { name: trimmed }));
    } else {
      setDraft(node.name);
    }
  };

  const commitChild = () => {
    const trimmed = childName.trim();
    setAddingChild(false);
    setChildName("");
    if (trimmed) {
      startTransition(async () => {
        await createFolderAction({ projectId, parentId: node.id, name: trimmed });
      });
    }
  };

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-lg pe-1 ps-2 text-sm transition-colors ${
          active ? "bg-primary/12 text-primary" : "hover:bg-muted"
        }`}
        style={{ marginInlineStart: depth * 12 }}
      >
        <button
          aria-label={open ? "بستن" : "باز کردن"}
          className="grid size-5 shrink-0 place-items-center rounded text-fg-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
            className="flex flex-1 items-center gap-1.5 rounded-md py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
              className="rounded-md p-1 text-fg-4 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
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
                if (active) onSelect(null);
                startTransition(() => deleteFolderAction(node.id));
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
            <FolderRowItem
              counts={counts}
              depth={depth + 1}
              key={child.id}
              node={child}
              onSelect={onSelect}
              projectId={projectId}
              selectedFolderId={selectedFolderId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FolderTree({
  projectId,
  folders,
  selectedFolderId,
  onSelect,
  counts = {},
  unfiledCount = 0,
}: {
  projectId: string;
  folders: FolderRow[];
  selectedFolderId: string | null;
  onSelect: (id: string | null) => void;
  /** conversation counts keyed by folderId */
  counts?: Record<string, number>;
  unfiledCount?: number;
}) {
  const tree = useMemo(() => buildTree(folders), [folders]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [, startTransition] = useTransition();

  const commit = () => {
    const trimmed = name.trim();
    setAdding(false);
    setName("");
    if (trimmed) {
      startTransition(async () => {
        await createFolderAction({ projectId, parentId: null, name: trimmed });
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <span className="font-medium text-fg-3 text-xs">پوشه‌ها</span>
        <button
          aria-label="پوشه جدید"
          className="rounded-md p-1 text-fg-4 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => setAdding(true)}
          type="button"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      <ul className="space-y-0.5">
        <li>
          <button
            className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 ${
              selectedFolderId === null
                ? "bg-primary/12 text-primary"
                : "hover:bg-muted"
            }`}
            onClick={() => onSelect(null)}
            type="button"
          >
            <span className="size-5" />
            <InboxIcon className="size-4 shrink-0" />
            <span className="flex-1 truncate">همه گفتگوها</span>
            {unfiledCount ? (
              <span className="text-fg-4 text-xs">{unfiledCount}</span>
            ) : null}
          </button>
        </li>
        {tree.map((node) => (
          <FolderRowItem
            counts={counts}
            depth={0}
            key={node.id}
            node={node}
            onSelect={onSelect}
            projectId={projectId}
            selectedFolderId={selectedFolderId}
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
