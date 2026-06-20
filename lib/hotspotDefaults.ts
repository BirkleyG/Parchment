export type HotspotRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DeskHotspotKey =
  | "deskButton"
  | "registryButton"
  | "mailboxButton"
  | "viewAllDraftsButton"
  | "burnDraftButton"
  | "saveDraft"
  | "prepareToSend"
  | "newLetterButton"
  | "blankParchmentButton"
  | "writingArea"
  | "signaturePanelArea";

export const DESK_HOTSPOT_DEFAULTS: Record<DeskHotspotKey, HotspotRect> = {
  deskButton: { left: 2.135, top: 13.889, width: 12.083, height: 4.63 },
  registryButton: { left: 2.344, top: 19.352, width: 11.719, height: 4.167 },
  mailboxButton: { left: 2.708, top: 24.444, width: 11.094, height: 4.167 },
  viewAllDraftsButton: { left: 4.167, top: 69.259, width: 8.125, height: 2.593 },
  burnDraftButton: { left: 15.885, top: 79.074, width: 5.677, height: 9.444 },
  saveDraft: { left: 69.375, top: 4.722, width: 6.302, height: 3.519 },
  prepareToSend: { left: 77.5, top: 4.815, width: 9.323, height: 3.519 },
  newLetterButton: { left: 19.427, top: 5.278, width: 6.719, height: 2.5 },
  blankParchmentButton: { left: 81.354, top: 57.315, width: 12.552, height: 20 },
  writingArea: { left: 31.719, top: 10, width: 35.729, height: 63.056 },
  signaturePanelArea: { left: 35.26, top: 77.037, width: 29.792, height: 22.593 },
};
