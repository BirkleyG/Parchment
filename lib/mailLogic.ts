import type { Letter, LetterStatus, WritingMode } from "@/lib/types";
import { isDatePastOrNow } from "@/lib/dateUtils";

export function isWritingLocked(letter: Pick<Letter, "title" | "body">): boolean {
  return letter.title.trim().length > 0 || letter.body.trim().length > 0;
}

export function canSwitchWritingMode(
  letter: Pick<Letter, "title" | "body">,
  nextMode: WritingMode,
  currentMode: WritingMode,
): boolean {
  if (nextMode === currentMode) {
    return true;
  }

  return !isWritingLocked(letter);
}

export function deriveDeliveryStatus(letter: Letter): LetterStatus {
  if (letter.status !== "inTransit") {
    return letter.status;
  }

  return isDatePastOrNow(letter.deliveredAt) ? "delivered" : "inTransit";
}

export function applyDeliverySync(letters: Letter[]): {
  deliverableIds: string[];
  updatedLetters: Letter[];
} {
  const deliverableIds: string[] = [];
  const updatedLetters = letters.map((letter) => {
    const nextStatus = deriveDeliveryStatus(letter);
    if (nextStatus === "delivered" && letter.status === "inTransit") {
      deliverableIds.push(letter.id);
      return { ...letter, status: "delivered" as const };
    }

    return letter;
  });

  return { deliverableIds, updatedLetters };
}

