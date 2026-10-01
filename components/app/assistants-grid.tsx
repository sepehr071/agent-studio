"use client";

import {
  CopyIcon,
  MoreVerticalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AssistantEditorDialog } from "@/components/app/assistant-editor-dialog";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteConfigAction,
  duplicateConfigAction,
  toggleConfigPinAction,
} from "@/lib/actions";
import type { ConfigRow, McpServerRow } from "@/lib/db/schema";
import { chartTint, hashTint } from "@/lib/tint";
import { detectDir } from "@/lib/use-direction";

const usageFmt = new Intl.NumberFormat("fa-IR");

function modelLabel(modelId: string): string {
  return modelId.split("/").at(-1) ?? modelId;
}

export function AssistantsGrid({
  configs,
  mcpServers,
}: {
  configs: ConfigRow[];
  mcpServers: McpServerRow[];
}) {
  const [editing, setEditing] = useState<ConfigRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (config: ConfigRow) => {
    setEditing(config);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading font-bold text-foreground text-lg">
            دستیارها
          </h1>
          <p className="text-fg-4 text-xs">
            شخصیت‌های سفارشی با مدل، پرامپت و پارامترهای دلخواه برای گفتگوها.
          </p>
        </div>
        <Button className="gap-1.5" onClick={openCreate} type="button">
          <PlusIcon className="size-4" />
          دستیار جدید
        </Button>
      </div>

      {configs.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {configs.map((config) => (
              <AssistantCard
                key={config.id}
                config={config}
                onEdit={() => openEdit(config)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Keyed so create/edit fully re-seeds the form state. */}
      <AssistantEditorDialog
        key={editing?.id ?? "new"}
        config={editing}
        mcpServers={mcpServers}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </div>
  );
}

function AssistantCard({
  config,
  onEdit,
}: {
  config: ConfigRow;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const reduceMotion = useReducedMotion();

  const act = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
    });

  const handleDelete = () => {
    act(async () => {
      await deleteConfigAction(config.id);
      toast.success(`دستیار «${config.name}» حذف شد`);
    });
  };

  return (
    <motion.div
      layout={reduceMotion ? false : "position"}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
      className="glass group/assistant flex flex-col gap-3 rounded-2xl p-4 transition-colors hover:ring-1 hover:ring-primary/20">
      <div className="flex items-start gap-3">
        <div
          className="grid size-11 shrink-0 place-items-center rounded-xl text-xl"
          style={{
            backgroundColor: `color-mix(in oklch, ${hashTint(config.id)} 14%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${hashTint(config.id)} 35%, transparent)`,
          }}
        >
          {config.avatarEmoji ?? "🤖"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {config.isPinned && (
              <PinIcon className="size-3 shrink-0 fill-primary text-primary" />
            )}
            <h2
              dir={detectDir(config.name)}
              className="truncate font-medium text-fg-1 text-sm"
            >
              {config.name}
            </h2>
          </div>
          <p
            dir="ltr"
            className="truncate font-mono text-fg-4 text-meta text-start"
          >
            {modelLabel(config.modelId)}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="-me-1 -mt-1 size-7 shrink-0 text-fg-3"
              size="icon-sm"
              variant="ghost"
              disabled={isPending}
            >
              <MoreVerticalIcon className="size-4" />
              <span className="sr-only">گزینه‌ها</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon className="size-4" />
              ویرایش
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => act(() => toggleConfigPinAction(config.id))}
            >
              {config.isPinned ? (
                <>
                  <PinOffIcon className="size-4" />
                  برداشتن سنجاق
                </>
              ) : (
                <>
                  <PinIcon className="size-4" />
                  سنجاق کردن
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => act(() => duplicateConfigAction(config.id))}
            >
              <CopyIcon className="size-4" />
              ایجاد رونوشت
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                setConfirmDelete(true);
              }}
            >
              <Trash2Icon className="size-4" />
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {config.systemPrompt.trim() && (
        <p
          dir={detectDir(config.systemPrompt)}
          className="line-clamp-2 text-fg-3 text-xs leading-relaxed"
        >
          {config.systemPrompt.trim()}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between pt-1 text-fg-4 text-xs">
        <span>{usageFmt.format(config.usageCount)} بار استفاده</span>
      </div>

      <AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف دستیار؟</AlertDialogTitle>
            <AlertDialogDescription>
              دستیار «{config.name}» برای همیشه حذف می‌شود. این عمل قابل بازگشت
              نیست.
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
    </motion.div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
      <div
        className="grid size-12 place-items-center rounded-2xl"
        style={{
          backgroundColor: `color-mix(in oklch, ${chartTint(2)} 12%, transparent)`,
          color: chartTint(2),
        }}
      >
        <SparklesIcon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-fg-1 text-sm">هنوز دستیاری نساخته‌اید</p>
        <p className="text-fg-4 text-xs">
          یک دستیار با شخصیت و مدل دلخواه بسازید تا در گفتگوها از آن استفاده کنید.
        </p>
      </div>
      <Button className="mt-1 gap-1.5" onClick={onCreate} type="button">
        <PlusIcon className="size-4" />
        ساخت اولین دستیار
      </Button>
    </div>
  );
}
