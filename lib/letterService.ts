"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { addDaysToIsoDate, nowIso } from "@/lib/dateUtils";
import { assertFirebaseConfigured, firestoreDb } from "@/lib/firebase";
import type { AuthProfile, Letter, SendRegistryDraftPayload } from "@/lib/types";
import { findUserByMailbox } from "@/lib/registryService";

function lettersCollection() {
  return collection(firestoreDb!, "letters");
}

function normalizePages(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.pages)) {
    const pages = data.pages.map((entry) => String(entry ?? ""));
    if (pages.length > 0) {
      return pages;
    }
  }

  return [String(data.body ?? "")];
}

function composeBodyFromPages(pages: string[]): string {
  return pages.join("\n\n").trim();
}

function mapLetter(id: string, data: Record<string, unknown>): Letter {
  const pages = normalizePages(data);
  const body = typeof data.body === "string" ? data.body : composeBodyFromPages(pages);

  return {
    id,
    fromName: String(data.fromName ?? ""),
    fromMailboxName: String(data.fromMailboxName ?? ""),
    toName: String(data.toName ?? ""),
    toMailboxName: String(data.toMailboxName ?? ""),
    title: String(data.title ?? ""),
    pages,
    body,
    status: (data.status as Letter["status"]) ?? "draft",
    createdAt: String(data.createdAt ?? nowIso()),
    sentAt: data.sentAt ? String(data.sentAt) : undefined,
    deliveredAt: data.deliveredAt ? String(data.deliveredAt) : undefined,
    openedAt: data.openedAt ? String(data.openedAt) : undefined,
    binId: data.binId ? String(data.binId) : undefined,
    writingMode: data.writingMode === "typewriter" ? "typewriter" : "fountainPen",
    fromUid: data.fromUid ? String(data.fromUid) : undefined,
    toUid: data.toUid ? String(data.toUid) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    inviteId: data.inviteId ? String(data.inviteId) : undefined,
    inviteStatus: data.inviteStatus === "pending" ? "pending" : data.inviteStatus === "claimed" ? "claimed" : undefined,
    recipientMode: data.recipientMode === "invite" ? "invite" : "registry",
    deliveryDelayDays: data.deliveryDelayDays ? Number(data.deliveryDelayDays) : undefined,
    claimMode: data.claimMode === "newAccount" ? "newAccount" : data.claimMode === "existingAccount" ? "existingAccount" : undefined,
  };
}

function senderDisplay(profile: AuthProfile): string {
  const trimmed = `${profile.settings.firstName} ${profile.settings.lastName}`.trim();
  return trimmed || profile.username;
}

function stripUndefined<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;
}

export async function createDraft(profile: AuthProfile): Promise<Letter> {
  assertFirebaseConfigured();

  const id = doc(lettersCollection()).id;
  const now = nowIso();
  const draft: Letter = {
    id,
    fromName: senderDisplay(profile),
    fromMailboxName: profile.settings.mailboxName,
    toName: "",
    toMailboxName: "",
    title: "",
    pages: [""],
    body: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    writingMode: profile.settings.writingMode,
    fromUid: profile.uid,
    recipientMode: "registry",
    deliveryDelayDays: profile.settings.outgoingDelayDays,
  };

  await setDoc(doc(firestoreDb!, "letters", id), draft);
  return draft;
}

export async function listDrafts(uid: string): Promise<Letter[]> {
  assertFirebaseConfigured();

  const snapshot = await getDocs(query(lettersCollection(), where("fromUid", "==", uid)));
  return snapshot.docs
    .map((entry) => mapLetter(entry.id, entry.data()))
    .filter((letter) => letter.status === "draft")
    .sort((a, b) => {
      const left = new Date(a.updatedAt ?? a.createdAt).getTime();
      const right = new Date(b.updatedAt ?? b.createdAt).getTime();
      return right - left;
    });
}

export async function saveDraft(letter: Letter): Promise<Letter> {
  assertFirebaseConfigured();

  const updatedAt = nowIso();
  const pages = Array.isArray(letter.pages) && letter.pages.length > 0 ? letter.pages : [letter.body ?? ""];
  const nextLetter: Letter = {
    ...letter,
    pages,
    body: composeBodyFromPages(pages),
    status: "draft",
    updatedAt,
  };

  await setDoc(doc(firestoreDb!, "letters", letter.id), stripUndefined(nextLetter), {
    merge: true,
  });
  return nextLetter;
}

export async function burnDraft(letterId: string): Promise<void> {
  assertFirebaseConfigured();
  await deleteDoc(doc(firestoreDb!, "letters", letterId));
}

export async function sendDraft(
  profile: AuthProfile,
  letter: Letter,
  payload: SendRegistryDraftPayload,
): Promise<Letter> {
  assertFirebaseConfigured();

  const recipient = await findUserByMailbox(payload.recipientMailboxName);
  if (!recipient) {
    throw new Error("No address by that name was found in the registry.");
  }

  const now = nowIso();
  const deliveredAt = addDaysToIsoDate(now, profile.settings.outgoingDelayDays);
  const pages = Array.isArray(letter.pages) && letter.pages.length > 0 ? letter.pages : [letter.body ?? ""];
  const title = payload.title.trim() || letter.title.trim() || "Untitled Letter";
  const nextLetter: Letter = {
    ...letter,
    fromName: payload.senderDisplayName.trim() || senderDisplay(profile),
    fromMailboxName: profile.settings.mailboxName,
    toUid: recipient.id,
    toName: `${recipient.firstName} ${recipient.lastName}`.trim(),
    toMailboxName: recipient.mailboxName,
    title,
    pages,
    body: composeBodyFromPages(pages),
    status: "inTransit",
    sentAt: now,
    deliveredAt,
    updatedAt: now,
    recipientMode: "registry",
    deliveryDelayDays: profile.settings.outgoingDelayDays,
    inviteId: undefined,
    inviteStatus: undefined,
    claimMode: undefined,
  };

  await setDoc(doc(firestoreDb!, "letters", letter.id), stripUndefined(nextLetter), {
    merge: true,
  });
  return nextLetter;
}

export async function syncIncomingDeliveries(uid: string): Promise<void> {
  assertFirebaseConfigured();

  const snapshot = await getDocs(query(lettersCollection(), where("toUid", "==", uid)));
  const deliverable = snapshot.docs
    .map((entry) => mapLetter(entry.id, entry.data()))
    .filter(
      (letter) =>
        letter.status === "inTransit" &&
        Boolean(letter.deliveredAt) &&
        new Date(letter.deliveredAt!).getTime() <= Date.now(),
    );

  if (deliverable.length === 0) {
    return;
  }

  const batch = writeBatch(firestoreDb!);
  const now = nowIso();

  deliverable.forEach((letter) => {
    batch.update(doc(firestoreDb!, "letters", letter.id), {
      status: "delivered",
      updatedAt: now,
    });
  });

  await batch.commit();
}

export async function listMailboxLetters(uid: string): Promise<Letter[]> {
  assertFirebaseConfigured();

  await syncIncomingDeliveries(uid);
  const snapshot = await getDocs(query(lettersCollection(), where("toUid", "==", uid)));

  return snapshot.docs
    .map((entry) => mapLetter(entry.id, entry.data()))
    .filter((letter) => letter.status === "delivered" || letter.status === "opened")
    .sort((a, b) => {
      const left = new Date(a.deliveredAt ?? a.createdAt).getTime();
      const right = new Date(b.deliveredAt ?? b.createdAt).getTime();
      return right - left;
    });
}

export async function getLetter(letterId: string): Promise<Letter | null> {
  assertFirebaseConfigured();

  const snapshot = await getDoc(doc(firestoreDb!, "letters", letterId));
  if (!snapshot.exists()) {
    return null;
  }

  return mapLetter(snapshot.id, snapshot.data());
}

export async function openLetter(letterId: string): Promise<void> {
  assertFirebaseConfigured();
  const now = nowIso();
  await updateDoc(doc(firestoreDb!, "letters", letterId), {
    status: "opened",
    openedAt: now,
    updatedAt: now,
  });
}

export async function moveLetterToBin(letterId: string, binId: string): Promise<void> {
  assertFirebaseConfigured();
  await updateDoc(doc(firestoreDb!, "letters", letterId), {
    binId,
    updatedAt: nowIso(),
  });
}

export async function burnReceivedLetter(letterId: string): Promise<void> {
  assertFirebaseConfigured();
  await deleteDoc(doc(firestoreDb!, "letters", letterId));
}
