const LAST_DRAFT_KEY = "parchment:lastDraftId";

export function setLastDraftId(value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(LAST_DRAFT_KEY, value);
}

export function getLastDraftId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(LAST_DRAFT_KEY);
}

