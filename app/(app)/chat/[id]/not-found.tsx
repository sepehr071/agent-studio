import { MessageCircleOffIcon } from "lucide-react";
import Link from "next/link";

export default function ConversationNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-2xl bg-destructive/12 text-destructive"
      >
        <MessageCircleOffIcon className="size-7" />
      </span>
      <div className="space-y-1.5">
        <p className="font-heading font-bold text-lg">گفتگو پیدا نشد</p>
        <p className="text-fg-3 text-sm">
          این شناسه نامعتبر است یا گفتگو حذف شده است.
        </p>
      </div>
      <Link
        className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
        href="/"
      >
        گفتگوی جدید
      </Link>
    </div>
  );
}
