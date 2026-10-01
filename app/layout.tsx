import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "استودیو",
    template: "%s · استودیو",
  },
  description:
    "میز کار هوش مصنوعی استودیو: گفتگوی پایدار، جستجوی وب، ردیابی استدلال، استودیو تصویر و جلسات.",
};

/**
 * No-FOUC theme bootstrap. Light is the CSS default (:root), so this script
 * only ever ADDS `.dark` before first paint — reading the stored preference,
 * then falling back to the OS setting. Kept inline + tiny so it runs ahead of
 * any stylesheet.
 */
const THEME_INIT = `(function(){try{var t=localStorage.getItem('studio-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;if(d){e.classList.add('dark');}e.style.colorScheme=d?'dark':'light';}catch(_){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      dir="rtl"
      lang="fa"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, static no-FOUC bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="flex h-dvh flex-col overflow-hidden">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
