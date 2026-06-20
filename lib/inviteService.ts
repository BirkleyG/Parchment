"use client";

import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { addDaysToIsoDate, nowIso } from "@/lib/dateUtils";
import { assertFirebaseConfigured, firestoreDb } from "@/lib/firebase";
import type {
  AuthProfile,
  InviteClaim,
  InviteClaimMode,
  Letter,
  SendInviteDraftPayload,
} from "@/lib/types";

function invitesCollection() {
  return collection(firestoreDb!, "invites");
}

function composeBodyFromPages(pages: string[]): string {
  return pages.join("\n\n").trim();
}

function mapInvite(id: string, data: Record<string, unknown>): InviteClaim {
  return {
    id,
    letterId: String(data.letterId ?? ""),
    senderDisplayName: String(data.senderDisplayName ?? ""),
    recipientName: String(data.recipientName ?? ""),
    title: String(data.title ?? ""),
    status: data.status === "claimed" ? "claimed" : "pending",
    createdAt: String(data.createdAt ?? nowIso()),
    claimedAt: typeof data.claimedAt === "string" ? data.claimedAt : undefined,
    claimedByUid: typeof data.claimedByUid === "string" ? data.claimedByUid : undefined,
    claimMode: data.claimMode === "newAccount" ? "newAccount" : data.claimMode === "existingAccount" ? "existingAccount" : undefined,
    senderDelayDays: Number(data.senderDelayDays ?? 1),
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

function mapClaimRecipient(profile: AuthProfile) {
  return {
    toName: `${profile.settings.firstName} ${profile.settings.lastName}`.trim() || profile.username,
    toMailboxName: profile.settings.mailboxName,
    toUid: profile.uid,
  };
}

export function buildInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/invite/${token}`;
}

export function buildInviteMessage(link: string): string {
  return `Greetings, this is a message from Parchment. You have been sent a letter from me, but I was unable to locate your mailbox in the registry. Please use the following link to receive your letter:\n\n${link}`;
}

export async function getInviteByToken(token: string): Promise<InviteClaim | null> {
  assertFirebaseConfigured();

  const snapshot = await getDoc(doc(firestoreDb!, "invites", token));
  if (!snapshot.exists()) {
    return null;
  }

  return mapInvite(snapshot.id, snapshot.data());
}

export async function sendInviteDraft(
  profile: AuthProfile,
  letter: Letter,
  payload: SendInviteDraftPayload,
): Promise<{ invite: InviteClaim; letter: Letter }> {
  assertFirebaseConfigured();

  const inviteRef = doc(invitesCollection());
  const now = nowIso();
  const pages = Array.isArray(letter.pages) && letter.pages.length > 0 ? letter.pages : [letter.body ?? ""];
  const title = payload.title.trim() || letter.title.trim() || "Untitled Letter";

  const nextLetter: Letter = {
    ...letter,
    fromName: payload.senderDisplayName.trim() || senderDisplay(profile),
    fromMailboxName: profile.settings.mailboxName,
    toName: payload.recipientName.trim(),
    toMailboxName: "",
    title,
    pages,
    body: composeBodyFromPages(pages),
    status: "sent",
    sentAt: now,
    deliveredAt: undefined,
    updatedAt: now,
    recipientMode: "invite",
    deliveryDelayDays: profile.settings.outgoingDelayDays,
    inviteId: inviteRef.id,
    inviteStatus: "pending",
    claimMode: undefined,
    toUid: undefined,
  };

  const invitePayload: InviteClaim = {
    id: inviteRef.id,
    letterId: letter.id,
    senderDisplayName: nextLetter.fromName,
    recipientName: payload.recipientName.trim(),
    title,
    status: "pending",
    createdAt: now,
    senderDelayDays: profile.settings.outgoingDelayDays,
  };

  await Promise.all([
    setDoc(doc(firestoreDb!, "letters", letter.id), stripUndefined(nextLetter), { merge: true }),
    setDoc(inviteRef, {
      ...invitePayload,
      createdAtServer: serverTimestamp(),
    }),
  ]);

  return {
    invite: invitePayload,
    letter: nextLetter,
  };
}

export async function claimInvite(
  profile: AuthProfile,
  token: string,
  claimMode: InviteClaimMode,
): Promise<{ invite: InviteClaim; letter: Letter }> {
  assertFirebaseConfigured();

  return runTransaction(firestoreDb!, async (transaction) => {
    const inviteRef = doc(firestoreDb!, "invites", token);
    const inviteSnapshot = await transaction.get(inviteRef);

    if (!inviteSnapshot.exists()) {
      throw new Error("This invitation could not be found.");
    }

    const invite = mapInvite(inviteSnapshot.id, inviteSnapshot.data());
    if (invite.status === "claimed") {
      throw new Error("This invitation has already been claimed.");
    }

    const letterRef = doc(firestoreDb!, "letters", invite.letterId);
    const letterSnapshot = await transaction.get(letterRef);
    if (!letterSnapshot.exists()) {
      throw new Error("The invited letter could not be found.");
    }

    const letterData = letterSnapshot.data() as Record<string, unknown>;
    const now = nowIso();
    const recipient = mapClaimRecipient(profile);
    const senderDelayDays = Number(letterData.deliveryDelayDays ?? invite.senderDelayDays ?? 1);
    const nextDeliveredAt = claimMode === "existingAccount" ? addDaysToIsoDate(now, senderDelayDays) : now;
    const nextStatus = claimMode === "existingAccount" ? "inTransit" : "delivered";

    const nextLetterData: Record<string, unknown> = stripUndefined({
      ...letterData,
      ...recipient,
      status: nextStatus,
      deliveredAt: nextDeliveredAt,
      updatedAt: now,
      inviteId: token,
      inviteStatus: "claimed",
      claimMode,
    });

    const nextInvite: Record<string, unknown> = stripUndefined({
      ...inviteSnapshot.data(),
      status: "claimed",
      claimedAt: now,
      claimedByUid: profile.uid,
      claimMode,
      claimedAtServer: serverTimestamp(),
    });

    transaction.update(letterRef, nextLetterData);
    transaction.update(inviteRef, nextInvite);

    return {
      invite: mapInvite(token, nextInvite),
      letter: {
        id: letterSnapshot.id,
        fromName: String(nextLetterData.fromName ?? ""),
        fromMailboxName: String(nextLetterData.fromMailboxName ?? ""),
        toName: String(nextLetterData.toName ?? ""),
        toMailboxName: String(nextLetterData.toMailboxName ?? ""),
        title: String(nextLetterData.title ?? ""),
        pages: Array.isArray(nextLetterData.pages)
          ? nextLetterData.pages.map((entry) => String(entry ?? ""))
          : [String(nextLetterData.body ?? "")],
        body: typeof nextLetterData.body === "string" ? nextLetterData.body : "",
        status: nextStatus,
        createdAt: String(nextLetterData.createdAt ?? now),
        sentAt: typeof nextLetterData.sentAt === "string" ? nextLetterData.sentAt : undefined,
        deliveredAt: typeof nextLetterData.deliveredAt === "string" ? nextLetterData.deliveredAt : undefined,
        openedAt: typeof nextLetterData.openedAt === "string" ? nextLetterData.openedAt : undefined,
        binId: typeof nextLetterData.binId === "string" ? nextLetterData.binId : undefined,
        writingMode: nextLetterData.writingMode === "typewriter" ? "typewriter" : "fountainPen",
        fromUid: typeof nextLetterData.fromUid === "string" ? nextLetterData.fromUid : undefined,
        toUid: typeof nextLetterData.toUid === "string" ? nextLetterData.toUid : undefined,
        updatedAt: typeof nextLetterData.updatedAt === "string" ? nextLetterData.updatedAt : undefined,
        inviteId: typeof nextLetterData.inviteId === "string" ? nextLetterData.inviteId : undefined,
        inviteStatus: nextLetterData.inviteStatus === "pending" ? "pending" : nextLetterData.inviteStatus === "claimed" ? "claimed" : undefined,
        recipientMode: nextLetterData.recipientMode === "invite" ? "invite" : "registry",
        deliveryDelayDays: Number(nextLetterData.deliveryDelayDays ?? senderDelayDays),
        claimMode,
      },
    };
  });
}
