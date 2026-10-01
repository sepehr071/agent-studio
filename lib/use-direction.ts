export type Direction = "rtl" | "ltr";

// First-strong-directional-character detection.
// RTL: Hebrew, Arabic (incl. Persian/Urdu), Arabic Supplement/Extended,
// Thaana, plus the RTL presentation forms. LTR: basic Latin/Greek/Cyrillic
// and the broad CJK + general letter ranges.
const RTL_CHAR =
  /[֐-׿؀-ۿ܀-ݏݐ-ݿހ-޿ࢠ-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR =
  /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ԰-֏぀-ヿ一-鿿]/;

/**
 * Detect base direction from the first strong directional character.
 * Skips digits, whitespace and punctuation (which are direction-neutral) so a
 * line starting with "۱۲۳ سلام" or "123 hello" resolves on the first letter.
 * Defaults to "rtl" (Persian-first app) when no strong character is present.
 */
export function detectDir(text: string): Direction {
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) return "rtl";
    if (LTR_CHAR.test(ch)) return "ltr";
  }
  return "rtl";
}
