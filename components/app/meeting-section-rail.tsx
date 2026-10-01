"use client";

import {
  CircleDashedIcon,
  GavelIcon,
  HelpCircleIcon,
  type LucideIcon,
  ListTodoIcon,
  MailIcon,
  ScrollTextIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { formatNumber, type MeetingSection } from "./meeting-shared";

const SECTION_ICON: Record<MeetingSection["id"], LucideIcon> = {
  summary: SparklesIcon,
  actions: ListTodoIcon,
  decisions: GavelIcon,
  qa: HelpCircleIcon,
  open: CircleDashedIcon,
  minutes: ScrollTextIcon,
  email: MailIcon,
  transcript: ScrollTextIcon,
  speakers: UsersIcon,
};

/**
 * The meeting-detail section navigator.
 *
 * Desktop: a slim sticky glass rail on the inline-start edge.
 * Mobile (`< lg`): the same items as a horizontally scrollable pill bar that
 * docks under the header.
 *
 * Items are real `<button>`s with `aria-current="page"` on the active one, so
 * the rail is fully keyboard- and screen-reader-operable.
 */
export function MeetingSectionRail({
  sections,
  active,
  onSelect,
}: {
  sections: MeetingSection[];
  active: MeetingSection["id"];
  onSelect: (id: MeetingSection["id"]) => void;
}) {
  return (
    <nav
      aria-label="بخش‌های جلسه"
      className="
        shrink-0 border-foreground/8 lg:w-52 lg:border-e lg:border-b-0
        max-lg:border-b
      "
    >
      <ul
        className="
          flex gap-1.5 overflow-x-auto p-3
          lg:sticky lg:top-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:py-4 lg:pe-3
          max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden
        "
      >
        {sections.map((section) => {
          const Icon = SECTION_ICON[section.id];
          const isActive = section.id === active;
          return (
            <li key={section.id} className="shrink-0">
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(section.id)}
                className="
                  group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start
                  text-fg-3 text-sm transition-colors
                  hover:bg-foreground/5 hover:text-fg-1
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
                  aria-[current=page]:bg-primary/10 aria-[current=page]:font-medium
                  aria-[current=page]:text-primary
                  max-lg:whitespace-nowrap
                "
              >
                <Icon
                  className="size-4 shrink-0 opacity-80 group-aria-[current=page]:opacity-100"
                  aria-hidden
                />
                <span className="flex-1 truncate">{section.label}</span>
                {section.count != null && section.count > 0 && (
                  <span
                    className="
                      grid h-5 min-w-5 place-items-center rounded-full bg-foreground/8 px-1.5
                      text-fg-4 text-xs tabular-nums
                      group-aria-[current=page]:bg-primary/15 group-aria-[current=page]:text-primary
                    "
                  >
                    {formatNumber(section.count)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
