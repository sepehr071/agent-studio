/**
 * Section/identity palette — the chart ramp promoted to a UI identity system.
 *
 * The five `--chart-*` CSS variables (azure, violet, teal, amber, rose) double
 * as stable accent hues for sidebar sections and hashed identities (e.g. tags,
 * speakers). This is the single source for "which hue is this thing?" outside
 * the data-viz charts themselves.
 */

/** A chart-ramp slot expressed as a CSS variable reference. */
export function chartTint(n: 1 | 2 | 3 | 4 | 5): string {
  return `var(--chart-${n})`;
}

/**
 * Map an arbitrary id to a stable chart-ramp hue. Same input → same hue across
 * renders/sessions. Hash logic lifted from `speakerColor` in
 * `components/app/meeting-shared.tsx`.
 */
export function hashTint(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return chartTint(((hash % 5) + 1) as 1 | 2 | 3 | 4 | 5);
}
