/**
 * Canonical prompt-template categories (Persian). The editor offers these as
 * fixed choices; the /templates sidebar shows the union of these plus any
 * distinct category found in the DB (so old/imported categories still appear).
 * Client-safe (plain data).
 */
export const TEMPLATE_CATEGORIES = [
  "نوشتن",
  "برنامه‌نویسی",
  "تحلیل",
  "ترجمه",
  "ایمیل",
  "عمومی",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
