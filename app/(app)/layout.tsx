import { AppSidebar } from "@/components/app/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { listConversations } from "@/lib/db/queries";

// Single-user local app — every render reads live SQLite state
export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const conversations = listConversations({ includeArchived: true }).map(
    (c) => ({
      id: c.id,
      title: c.title,
      isPinned: c.isPinned,
      isArchived: c.isArchived,
    }),
  );

  return (
    <SidebarProvider>
      <AppSidebar conversations={conversations} />
      <SidebarInset className="h-dvh overflow-hidden bg-transparent">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
