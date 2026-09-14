// A hard character cap is just a safety bound for the binary search below,
// not the actual page-break rule — see getFittedText.
export const MAX_CHARACTERS_PER_PAGE = 20000;

// Whether text fits a page is a question about the actual rendered box —
// character count alone can't know that, because it has no idea how many
// visual lines that text wraps into (variable-width glyphs, word-wrap, and
// explicit "\n"s all affect that differently). So we measure it for real:
// mirror the text into a same-sized hidden textarea and binary search for
// the longest prefix whose rendered height still fits.
export function getFittedText(
  text: string,
  textarea: HTMLTextAreaElement | null,
  measure: HTMLTextAreaElement | null,
) {
  if (!textarea || !measure) {
    return text;
  }

  measure.style.width = `${textarea.clientWidth}px`;
  measure.style.height = `${textarea.clientHeight}px`;
  measure.value = text;

  if (measure.scrollHeight <= measure.clientHeight) {
    return text;
  }

  let low = 0;
  let high = Math.min(text.length, MAX_CHARACTERS_PER_PAGE);
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = text.slice(0, mid);
    measure.value = candidate;

    if (measure.scrollHeight <= measure.clientHeight) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

// Splits arbitrarily long text into as many pages as it takes to actually
// fit all of it on screen — a paste that's five pages long produces five
// pages, not one oversized page that silently scrolls past the paper.
export function splitTextIntoPages(
  text: string,
  textarea: HTMLTextAreaElement | null,
  measure: HTMLTextAreaElement | null,
): string[] {
  const result: string[] = [];
  let remaining = text;

  while (true) {
    // Trailing pages can end up empty once leading newlines are trimmed off
    // a split point — don't add a blank page nobody asked for, unless it's
    // the only page there is.
    if (remaining.length === 0) {
      if (result.length === 0) {
        result.push("");
      }
      break;
    }

    const fitted = getFittedText(remaining, textarea, measure);
    if (fitted === remaining) {
      result.push(remaining);
      break;
    }

    // If even a single character doesn't fit (e.g. the box is mid-layout
    // and briefly has no height), force forward progress instead of
    // spinning forever on the same text.
    const safeFitted = fitted.length > 0 ? fitted : remaining.slice(0, 1);
    result.push(safeFitted);

    // Trim a leading blank line off the next page — but only when there's
    // real content after it. If the overflow is *just* a newline (the
    // classic "pressing Enter at the bottom of a full page" case), trimming
    // it away entirely would erase the overflow before it ever became a
    // page, which is exactly the bug where Enter silently did nothing.
    const rest = remaining.slice(safeFitted.length);
    const trimmedRest = rest.replace(/^\n+/, "");
    remaining = trimmedRest.length > 0 ? trimmedRest : rest;
  }

  return result;
}

// True when the box's rendered content no longer fits its own height — the
// trigger for re-paginating against whatever size the page actually is on
// this screen, rather than trusting whatever split was computed elsewhere
// (a different device, a different orientation, before the container had
// laid out at all).
export function isOverflowing(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return false;
  }

  return textarea.scrollHeight > textarea.clientHeight + 1;
}

// Re-splits a page's worth of pages against the box's current geometry only
// when it no longer fits, and only reports a change when the result is
// actually different — callers use this to decide whether to persist a
// fresh split.
export function reflowPages(
  pages: string[],
  textarea: HTMLTextAreaElement | null,
  measure: HTMLTextAreaElement | null,
): string[] | null {
  if (!isOverflowing(textarea)) {
    return null;
  }

  const fullText = pages.join("\n\n").trim();
  const nextPages = splitTextIntoPages(fullText, textarea, measure);
  const unchanged =
    nextPages.length === pages.length && nextPages.every((page, index) => page === pages[index]);

  return unchanged ? null : nextPages;
}
