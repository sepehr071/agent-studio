/**
 * Prompt-template helpers (client-safe, no server imports).
 */

/**
 * Matches `{{ name }}` placeholders. Unicode-aware: the variable name is any
 * run of non-brace, non-newline characters (e.g. Persian `{{موضوع}}`), trimmed.
 * `extractTemplateVariables` and `fillTemplate` MUST share this pattern so the
 * variable identity (trimmed inner text) stays consistent across both.
 */
const TEMPLATE_VAR_RE = /\{\{\s*([^{}\n]+?)\s*\}\}/g;

/** Extract `{{var}}` names from a template body (order-preserving, unique). */
export function extractTemplateVariables(body: string): string[] {
  const matches = body.matchAll(TEMPLATE_VAR_RE);
  const seen = new Set<string>();
  for (const m of matches) seen.add(m[1].trim());
  return Array.from(seen);
}

/** Substitute `{{var}}` placeholders with provided values (missing → kept). */
export function fillTemplate(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(TEMPLATE_VAR_RE, (full, name: string) => {
    const key = name.trim();
    return key in values ? values[key] : full;
  });
}
