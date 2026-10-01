"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { activeNavHref, NAV_ITEMS } from "@/lib/nav";
import { chartTint } from "@/lib/tint";

/**
 * Primary navigation rail (top of the sidebar). Labels come from `lib/nav.ts`
 * (Persian) and the active item is resolved by longest-prefix match. The
 * "settings" entry is rendered separately in the sidebar footer, so it's
 * filtered out here.
 *
 * Each section carries an identity hue (`item.tint`, a chart-ramp slot). The
 * icon idle color mixes that hue toward the muted text ramp; when active the
 * row gets the full hue on the icon, a faint tinted wash, and a logical
 * border-inline-start accent bar. Settings (`tint: null`) stays neutral.
 * Tailwind can't template the dynamic `--chart-N` var, so the tint is wired in
 * via inline style.
 */
export function SidebarNav() {
  const pathname = usePathname();
  const active = activeNavHref(pathname);
  const items = NAV_ITEMS.filter((item) => item.href !== "/settings");

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(({ href, label, icon: Icon, tint }) => {
            const isActive = active === href;
            const hue = tint == null ? null : chartTint(tint);
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  style={
                    hue && isActive
                      ? {
                          // Active: logical accent bar + faint tinted wash.
                          borderInlineStartColor: hue,
                          background: `color-mix(in oklab, ${hue} 11%, transparent)`,
                        }
                      : undefined
                  }
                  className={hue ? "border-s-2 border-transparent" : undefined}
                  tooltip={label}
                >
                  <Link href={href}>
                    <Icon
                      className="size-4"
                      style={
                        hue
                          ? {
                              color: isActive
                                ? hue
                                : `color-mix(in oklab, ${hue} 55%, var(--fg-3))`,
                            }
                          : undefined
                      }
                    />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
