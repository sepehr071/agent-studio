/**
 * One-shot sessionStorage bridge that seeds the chat composer across a
 * navigation. useChat v6 has no shared store, so a freshly mounted ChatPane
 * reads (and clears) the seed on mount. Used by "fill template → composer"
 * and "discuss this meeting → new chat". Client-safe (no server imports).
 */
const KEY = "studio:composer-seed";

export function setComposerSeed(text: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, text);
  } catch {
    // Private mode / quota — handoff is best-effort.
  }
}

/** Read and clear the pending seed. Returns null if none is set. */
export function consumeComposerSeed(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(KEY);
    if (value !== null) window.sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}
