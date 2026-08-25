"use client";

import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { addDaysToIsoDate, nowIso } from "@/lib/dateUtils";
import { assertFirebaseConfigured, firebaseAuth, firestoreDb } from "@/lib/firebase";
import type {
  AuthProfile,
  InviteClaim,
  InviteClaimMode,
  Letter,
  LetterStatus,
  SendInviteDraftPayload,
} from "@/lib/types";
import { diagnosePermissionDenied } from "@/lib/permissionDiagnostics";
import type { FirestoreOp } from "@/lib/permissionDiagnostics";

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
    status: data.status === "claimed" ? "claimed" : data.status === "replaced" ? "replaced" : "pending",
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

  const invite = mapInvite(snapshot.id, snapshot.data());
  return invite.status === "replaced" ? null : invite;
}

export async function sendInviteDraft(
  profile: AuthProfile,
  letter: Letter,
  payload: SendInviteDraftPayload,
): Promise<{ invite: InviteClaim; letter: Letter }> {
  assertFirebaseConfigured();

  // Force-refresh the auth token to ensure Firestore sees a valid token.
  const user = firebaseAuth!.currentUser;
  if (user) {
    try {
      await user.getIdToken(true);
    } catch (tokenError) {
      console.error("Auth token refresh failed:", tokenError);
    }
  }

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
    senderUid: profile.uid,
  };

  await Promise.all([
    setDoc(
      doc(firestoreDb!, "letters", letter.id),
      { ...stripUndefined(nextLetter), toUid: null },
      { merge: true },
    ),
    setDoc(inviteRef, {
      ...invitePayload,
      createdAtServer: serverTimestamp(),
    }),
  ]).catch((error) => {
    const diagnosis = diagnosePermissionDenied(error, { kind: "invite-create" });
    if (diagnosis) {
      throw new Error(`Permission denied while preparing your invitation.\n\n${diagnosis}`);
    }
    throw error;
  });

  return {
    invite: invitePayload,
    letter: nextLetter,
  };
}

export async function getInviteStatuses(inviteIds: string[]): Promise<Record<string, InviteClaim>> {
  assertFirebaseConfigured();
  const uniqueIds = [...new Set(inviteIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  const snapshots = await Promise.all(uniqueIds.map((id) => getDoc(doc(firestoreDb!, "invites", id))));
  return snapshots.filter((snapshot) => snapshot.exists()).reduce<Record<string, InviteClaim>>((result, entry) => {
    result[entry.id] = mapInvite(entry.id, entry.data());
    return result;
  }, {});
}

export async function rotateInviteLink(profile: AuthProfile, letter: Letter): Promise<InviteClaim> {
  assertFirebaseConfigured();

  // Force-refresh the auth token to ensure Firestore sees a valid token.
  const user = firebaseAuth!.currentUser;
  if (user) {
    try {
      await user.getIdToken(true);
    } catch (tokenError) {
      console.error("Auth token refresh failed:", tokenError);
    }
  }

  if (!letter.inviteId || letter.inviteStatus !== "pending") {
    throw new Error("Only unclaimed invitation links can be replaced.");
  }

  const nextInviteRef = doc(invitesCollection());
  const letterRef = doc(firestoreDb!, "letters", letter.id);
  const oldInviteRef = doc(firestoreDb!, "invites", letter.inviteId);
  const now = nowIso();

  return runTransaction(firestoreDb!, async (transaction) => {
    const [letterSnapshot, oldInviteSnapshot] = await Promise.all([
      transaction.get(letterRef),
      transaction.get(oldInviteRef),
    ]);
    if (!letterSnapshot.exists() || letterSnapshot.data().fromUid !== profile.uid) {
      throw new Error("This sent letter could not be found.");
    }
    if (!oldInviteSnapshot.exists() || oldInviteSnapshot.data().status !== "pending") {
      throw new Error("This invitation has already been claimed or replaced.");
    }

    const oldInvite = mapInvite(oldInviteSnapshot.id, oldInviteSnapshot.data());
    const nextInvite: InviteClaim & { senderUid: string } = {
      ...oldInvite,
      id: nextInviteRef.id,
      status: "pending",
      createdAt: now,
      claimedAt: undefined,
      claimedByUid: undefined,
      claimMode: undefined,
      senderUid: profile.uid,
    };

    transaction.update(oldInviteRef, { status: "replaced", replacedAt: now });
    transaction.set(nextInviteRef, { ...stripUndefined(nextInvite), createdAtServer: serverTimestamp() });
    transaction.update(letterRef, { inviteId: nextInviteRef.id, inviteStatus: "pending", updatedAt: now });
    return nextInvite;
  }).catch((error) => {
    const op: FirestoreOp = { kind: "invite-rotate", token: letter.inviteId! };
    const diagnosis = diagnosePermissionDenied(error, op);
    if (diagnosis) {
      throw new Error(`Permission denied while rotating this invitation link.\n\n${diagnosis}`);
    }
    throw error;
  });
}

export async function claimInvite(
  profile: AuthProfile,
  token: string,
  claimMode: InviteClaimMode,
): Promise<{ invite: InviteClaim; letter: Letter }> {
  assertFirebaseConfigured();

  // New accounts often hit a transient Firestore "permission-denied" because
  // the freshly-minted ID token hasn't propagated to the rules engine. One
  // getIdToken(true) is not reliably enough, so we force-refresh the token
  // and retry the transaction with exponential backoff on permission-denied.
  const MAX_ATTEMPTS = 4;
  const BASE_DELAY_MS = 400;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const user = firebaseAuth!.currentUser;
    if (user) {
      try {
        await user.getIdToken(true);
      } catch (tokenError) {
        console.error("Auth token refresh failed:", tokenError);
      }
    }

    try {
      return await runTransaction(firestoreDb!, async (transaction) => {
        const inviteRef = doc(firestoreDb!, "invites", token);
        const inviteSnapshot = await transaction.get(inviteRef);

        if (!inviteSnapshot.exists()) {
          throw new Error("This invitation could not be found.");
        }

        const invite = mapInvite(inviteSnapshot.id, inviteSnapshot.data());
        if (invite.status !== "pending") {
          throw new Error("This invitation has already been claimed or replaced.");
        }

        const now = nowIso();
        const recipient = mapClaimRecipient(profile);
        const senderDelayDays = invite.senderDelayDays || 1;
        const nextDeliveredAt = claimMode === "existingAccount" ? addDaysToIsoDate(now, senderDelayDays) : now;
        const nextStatus: LetterStatus = claimMode === "existingAccount" ? "inTransit" : "delivered";

        const nextLetterData: Record<string, unknown> = stripUndefined({
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

        transaction.update(doc(firestoreDb!, "letters", invite.letterId), nextLetterData);
        transaction.update(inviteRef, nextInvite);

        return {
          invite: mapInvite(token, nextInvite),
          letter: {
            id: invite.letterId,
            fromName: invite.senderDisplayName,
            fromMailboxName: "",
            toName: String(nextLetterData.toName ?? ""),
            toMailboxName: String(nextLetterData.toMailboxName ?? ""),
            title: invite.title,
            pages: [""],
            body: "",
            status: nextStatus,
            createdAt: invite.createdAt,
            deliveredAt: typeof nextLetterData.deliveredAt === "string" ? nextLetterData.deliveredAt : undefined,
            writingMode: "fountainPen" as const,
            toUid: typeof nextLetterData.toUid === "string" ? nextLetterData.toUid : undefined,
            updatedAt: typeof nextLetterData.updatedAt === "string" ? nextLetterData.updatedAt : undefined,
            inviteId: typeof nextLetterData.inviteId === "string" ? nextLetterData.inviteId : undefined,
            inviteStatus: nextLetterData.inviteStatus === "pending" ? "pending" as const : nextLetterData.inviteStatus === "claimed" ? "claimed" as const : undefined,
            recipientMode: "invite" as const,
            deliveryDelayDays: Number(nextLetterData.deliveryDelayDays ?? senderDelayDays),
            claimMode,
          },
        };
      });
    } catch (error) {
      lastError = error;
      const isPermissionDenied = error instanceof FirebaseError && error.code === "permission-denied";
      if (!isPermissionDenied || attempt === MAX_ATTEMPTS) {
        break;
      }
      // Exponential backoff before forcing another token refresh + retry.
      await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * attempt));
    }
  }

  const op: FirestoreOp = { kind: "invite-claim", token, claimMode };
  const diagnosis = diagnosePermissionDenied(lastError, op);
  if (diagnosis) {
    throw new Error(`Permission denied while claiming your invitation.\n\n${diagnosis}`);
  }
  throw lastError;
}
