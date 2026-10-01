"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  FolderKanbanIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProjectDialog } from "@/components/app/project-dialog";
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
  deleteProjectAction,
  updateProjectAction,
} from "@/lib/actions/projects";
import type { ProjectRow } from "@/lib/db/schema";
import { chartTint } from "@/lib/tint";

export interface ProjectCardData extends ProjectRow {
  conversationCount: number;
}

function ProjectCard({ project }: { project: ProjectCardData }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteProjectAction(project.id);
      toast.success(`پروژه «${project.name}» حذف شد`);
    });
  };

  return (
    <>
      <motion.div
        layout={reduceMotion ? false : "position"}
        exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
        className="group glass relative flex flex-col gap-3 rounded-2xl p-4 transition-shadow hover:shadow-lg">
        <Link
          aria-label={project.name}
          className="absolute inset-0 rounded-2xl"
          href={`/projects/${project.id}`}
        />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-xl bg-muted text-xl"
            >
              {project.emoji ?? "📁"}
            </span>
            {project.color && (
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: project.color }}
              />
            )}
          </div>
          <div className="relative z-10 flex items-center gap-1">
            {project.isPinned && (
              <PinIcon className="size-3.5 text-primary" />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-md p-1 text-fg-4 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                  type="button"
                >
                  <MoreHorizontalIcon className="size-4" />
                  <span className="sr-only">عملیات پروژه</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-sm">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <PencilIcon className="size-3.5" /> ویرایش
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    startTransition(() =>
                      updateProjectAction(project.id, {
                        isPinned: !project.isPinned,
                      }),
                    )
                  }
                >
                  {project.isPinned ? (
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
                    startTransition(() =>
                      updateProjectAction(project.id, {
                        isArchived: !project.isArchived,
                      }),
                    )
                  }
                >
                  {project.isArchived ? (
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
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-heading font-medium text-foreground text-sm">
            {project.name}
          </h3>
          {project.description && (
            <p className="line-clamp-2 text-fg-3 text-xs">
              {project.description}
            </p>
          )}
        </div>

        <div className="mt-auto flex items-center gap-1.5 text-fg-4 text-xs">
          <MessageSquareIcon className="size-3.5" />
          <span>{project.conversationCount} گفتگو</span>
        </div>
      </motion.div>
      <ProjectDialog
        onOpenChange={setEditing}
        open={editing}
        project={project}
      />
      <AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف پروژه؟</AlertDialogTitle>
            <AlertDialogDescription>
              پروژه «{project.name}» حذف می‌شود. گفتگوهای داخل آن حذف نمی‌شوند و
              به حالت بدون پروژه بازمی‌گردند.
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
  );
}

export function ProjectsBoard({ projects }: { projects: ProjectCardData[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-foreground text-lg">
            پروژه‌ها
          </h1>
          <p className="text-fg-3 text-sm">
            گفتگوهای مرتبط را در پروژه‌ها و پوشه‌ها سازماندهی کنید
          </p>
        </div>
        <Button onClick={() => setCreating(true)} type="button">
          <PlusIcon className="size-4" /> پروژه جدید
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
          <span
            className="grid size-14 place-items-center rounded-2xl"
            style={{
              background: `color-mix(in oklch, ${chartTint(4)} 12%, transparent)`,
              color: chartTint(4),
            }}
          >
            <FolderKanbanIcon className="size-7" />
          </span>
          <div className="space-y-1">
            <p className="font-heading font-medium text-foreground">
              هنوز پروژه‌ای نساخته‌اید
            </p>
            <p className="text-fg-3 text-sm">
              اولین پروژه را بسازید تا گفتگوها و پوشه‌ها را در آن جمع کنید
            </p>
          </div>
          <Button
            className="mt-1"
            onClick={() => setCreating(true)}
            type="button"
          >
            <PlusIcon className="size-4" /> ساختن پروژه
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ProjectDialog onOpenChange={setCreating} open={creating} />
    </div>
  );
}
