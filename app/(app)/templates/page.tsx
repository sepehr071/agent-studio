import type { Metadata } from "next";
import { TemplatesView } from "@/components/app/template-view";
import { listTemplates } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "قالب‌ها — استودیو",
};

export default function TemplatesPage() {
  const templates = listTemplates();
  return <TemplatesView templates={templates} />;
}
