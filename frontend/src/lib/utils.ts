import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fix UTF-8 mojibake: text that was stored/transmitted as UTF-8 but interpreted as Latin-1/Windows-1252.
 * Replaces common garbled sequences with the correct Unicode punctuation (smart quotes, en/em dash).
 */
export function fixUtf8Mojibake(str: string | null | undefined): string {
  if (str == null || typeof str !== "string") return ""
  return str
    .replace(/\u00E2\u20AC\u0153/g, "\u201C")   // â€œ → "
    .replace(/\u00E2\u20AC\u009D/g, "\u201D")   // â€ → "
    .replace(/\u00E2\u20AC\u0094/g, "\u2014")   // â€" → —
    .replace(/\u00E2\u20AC\u201C/g, "\u2013")   // â€" (curly quote) → – en-dash
    .replace(/\u00E2\u20AC\u0093/g, "\u2013")   // â€" → –
    .replace(/\u00E2\u20AC\u2122/g, "\u2019")   // â€™ → '
    .replace(/\u00E2\u20AC\u00A6/g, "\u2026")   // â€¦ → …
}
