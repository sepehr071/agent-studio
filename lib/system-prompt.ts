import type { ConfigRow, SettingsRow } from "@/lib/db/schema";

const BASE_PROMPT =
  "You are Studio, a sharp, concise assistant. " +
  "Use markdown. When asked to build a web page, demo, or visual snippet, return a " +
  "single self-contained ```html code block (inline CSS/JS) so it can run in the canvas preview.";

/**
 * Build the system prompt for a turn.
 *
 * Layering (highest priority first):
 *   1. The active assistant config's system prompt (when a config is bound) —
 *      it becomes the leading persona, fully replacing the generic Studio base.
 *   2. The user's AI preferences (when enabled) — appended as a [User
 *      preferences] block so an assistant persona still honors how the user
 *      wants to be addressed / the response style.
 *   3. The base Studio persona — only when no config is bound.
 *
 * Mirrors uni-chat's build_enhanced_system_prompt while letting per-assistant
 * configs override the default persona.
 */
export function buildSystemPrompt(
  settings: SettingsRow,
  config?: ConfigRow | null,
): string {
  const persona = config?.systemPrompt?.trim()
    ? config.systemPrompt.trim()
    : BASE_PROMPT;

  if (!settings.aiPrefsEnabled) return persona;

  const prefs = collectPrefs(settings);
  if (prefs.length === 0) return persona;

  return `${persona}\n\n[User preferences]\n${prefs.join("\n")}`;
}

function collectPrefs(settings: SettingsRow): string[] {
  const prefs: string[] = [];
  if (settings.userName) prefs.push(`Address the user as ${settings.userName}.`);
  if (settings.outputLanguage)
    prefs.push(`Respond in ${settings.outputLanguage}.`);
  if (settings.expertiseLevel)
    prefs.push(`The user's expertise level is ${settings.expertiseLevel}.`);
  if (settings.tone) prefs.push(`Use a ${settings.tone} tone.`);
  if (settings.responseStyle)
    prefs.push(`Keep responses ${settings.responseStyle}.`);
  if (settings.customInstructions)
    prefs.push(`Custom instructions: ${settings.customInstructions}`);
  return prefs;
}
