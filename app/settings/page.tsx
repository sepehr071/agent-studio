import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { McpServersSection } from "@/components/app/mcp-servers-section";
import { getSettings, listMcpServers } from "@/lib/db/queries";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "تنظیمات" };

export default function SettingsPage() {
  const settings = getSettings();
  const mcpServers = listMcpServers();

  return (
    <div className="h-dvh overflow-y-auto">
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-3 border-x-0 border-t-0 px-6 py-3 text-sm">
        <Link
          className="flex items-center gap-1.5 text-fg-3 transition-colors hover:text-foreground"
          href="/"
        >
          <ArrowRightIcon className="size-4" />
          بازگشت
        </Link>
        <span className="font-medium text-fg-1">تنظیمات</span>
      </header>
      <SettingsForm initial={settings} />
      <div className="mx-auto w-full max-w-2xl px-6 pb-8">
        <McpServersSection servers={mcpServers} />
      </div>
    </div>
  );
}
