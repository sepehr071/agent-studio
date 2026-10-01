import {
  BarChart3Icon,
  BookMarkedIcon,
  FilesIcon,
  FolderKanbanIcon,
  ImageIcon,
  type LucideIcon,
  MessageSquarePlusIcon,
  MicIcon,
  Settings2Icon,
  SparklesIcon,
  Wand2Icon,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** Persian label */
  label: string;
  icon: LucideIcon;
  /** Section identity hue (chart-ramp slot); `null` = neutral (settings). */
  tint: 1 | 2 | 3 | 4 | 5 | null;
}

/**
 * Primary navigation, ordered top-to-bottom in the (RTL) sidebar.
 * Labels are Persian; hrefs map to `app/(app)/<route>`.
 */
// Sections get a stable identity hue from the chart ramp; meetings/series share
// amber (4) as a family. Settings stays neutral (null).
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "گفتگوی جدید", icon: MessageSquarePlusIcon, tint: 1 },
  { href: "/assistants", label: "دستیارها", icon: SparklesIcon, tint: 2 },
  { href: "/projects", label: "پروژه‌ها", icon: FolderKanbanIcon, tint: 4 },
  { href: "/knowledge", label: "گنجینه دانش", icon: BookMarkedIcon, tint: 3 },
  { href: "/studio", label: "استودیو تصویر", icon: ImageIcon, tint: 5 },
  { href: "/meetings", label: "جلسات", icon: MicIcon, tint: 4 },
  { href: "/series", label: "سری جلسات", icon: FilesIcon, tint: 4 },
  { href: "/templates", label: "قالب‌ها", icon: Wand2Icon, tint: 2 },
  { href: "/usage", label: "آمار مصرف", icon: BarChart3Icon, tint: 1 },
  { href: "/settings", label: "تنظیمات", icon: Settings2Icon, tint: null },
];

/** Match the active nav item for a given pathname (longest-prefix wins). */
export function activeNavHref(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/chat")) return "/";
  const match = NAV_ITEMS.filter(
    (item) => item.href !== "/" && pathname.startsWith(item.href),
  ).sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href ?? "/";
}
