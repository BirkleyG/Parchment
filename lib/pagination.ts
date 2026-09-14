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

  // The binary search above is purely height-based and doesn't know what a
  // word is, so its longest-fitting prefix can land mid-word. When it does,
  // back the cut up to the last word boundary so the split word moves to
  // the next page whole, rather than being torn in two. Skip this when
  // `best` is the *whole* remaining text (nothing is being cut) or when
  // there's no boundary to back up to at all (one unbroken run of
  // non-whitespace longer than a page) — either way there's nothing better
  // to do than the character-level cut.
  if (best.length > 0 && best.length < text.length) {
    const lastChar = best[best.length - 1];
    const nextChar = text[best.length];
    const isMidWord = !/\s/.test(lastChar) && !/\s/.test(nextChar);

    if (isMidWord) {
      const trailingWordStart = /\S*$/.exec(best)!.index;
      if (trailingWordStart > 0) {
        best = best.slice(0, trailingWordStart);
      }
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

// Re-splits a letter's full text against the box's current geometry and
// only reports a change when the result is actually different — callers
// use this to decide whether to persist a fresh split.
//
// This always re-splits the *whole* letter, not just whatever page
// currently overflows. A box only ever getting fixed when it overflows
// would make page count a one-way ratchet — shrink the window and it
// splits into more pages, grow it back and those extra pages just sit
// there half-empty, since nothing ever re-merges them. Re-deriving the
// whole split from the box's current size every time is self-correcting
// in both directions: reopening a letter on whatever box is actually on
// screen always lands on the page count that box calls for.
export function reflowPages(
  pages: string[],
  textarea: HTMLTextAreaElement | null,
  measure: HTMLTextAreaElement | null,
): string[] | null {
  if (!textarea || !measure) {
    return null;
  }

  // Plain concatenation, not "\n\n".join() — a page boundary is usually in
  // the middle of a paragraph, not between two of them, so joining with an
  // inserted blank line fabricates whitespace that was never actually
  // there. That fabricated whitespace then becomes part of the "current"
  // pages the *next* time this runs (e.g. the next resize event during a
  // drag), and each pass adds more — which is exactly how one page turns
  // into dozens of one-word fragments after a few resizes. Concatenating
  // the pages back exactly as split (each one a contiguous slice of the
  // original text) reconstructs the real text losslessly instead.
  const fullText = pages.join("").trim();
  const nextPages = splitTextIntoPages(fullText, textarea, measure);
  const unchanged =
    nextPages.length === pages.length && nextPages.every((page, index) => page === pages[index]);

  return unchanged ? null : nextPages;
}
