"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

import { assertFirebaseConfigured, firebaseAuth, firestoreDb } from "@/lib/firebase";
import type { Letter } from "@/lib/types";

export type AdminUserSummary = {
  uid: string;
  username: string;
  mailboxName: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

function usersCollection() {
  return collection(firestoreDb!, "users");
}

function lettersCollection() {
  return collection(firestoreDb!, "letters");
}

async function refreshToken() {
  const user = firebaseAuth!.currentUser;
  if (user) {
    try {
      await user.getIdToken(true);
    } catch (tokenError) {
      console.error("Auth token refresh failed:", tokenError);
    }
  }
}

export async function listAllUsers(): Promise<AdminUserSummary[]> {
  assertFirebaseConfigured();

  const snapshot = await getDocs(usersCollection());
  return snapshot.docs
    .map((entry) => {
      const data = entry.data();
      return {
        uid: entry.id,
        username: String(data.username ?? ""),
        mailboxName: String(data.mailboxName ?? ""),
        firstName: String(data.firstName ?? ""),
        lastName: String(data.lastName ?? ""),
        createdAt: String(data.createdAt ?? ""),
      };
    })
    .sort((a, b) => a.username.localeCompare(b.username));
}

export async function listAllLetters(): Promise<Letter[]> {
  assertFirebaseConfigured();

  const snapshot = await getDocs(lettersCollection());
  return snapshot.docs
    .map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        fromName: String(data.fromName ?? ""),
        fromMailboxName: String(data.fromMailboxName ?? ""),
        toName: String(data.toName ?? ""),
        toMailboxName: String(data.toMailboxName ?? ""),
        title: String(data.title ?? ""),
        body: "",
        status: (data.status as Letter["status"]) ?? "draft",
        createdAt: String(data.createdAt ?? ""),
        fromUid: data.fromUid ? String(data.fromUid) : undefined,
        toUid: data.toUid ? String(data.toUid) : undefined,
        inviteId: data.inviteId ? String(data.inviteId) : undefined,
        writingMode: data.writingMode === "typewriter" ? "typewriter" : "fountainPen",
      } as Letter;
    })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function deleteLetterAsAdmin(letter: Pick<Letter, "id" | "inviteId">): Promise<void> {
  assertFirebaseConfigured();
  await refreshToken();

  const batch = writeBatch(firestoreDb!);
  batch.delete(doc(firestoreDb!, "letters", letter.id));
  if (letter.inviteId) {
    batch.delete(doc(firestoreDb!, "invites", letter.inviteId));
  }
  await batch.commit();
}

export async function deleteUserAccountAsAdmin(user: AdminUserSummary): Promise<void> {
  assertFirebaseConfigured();
  await refreshToken();

  const [sentSnapshot, receivedSnapshot, binsSnapshot] = await Promise.all([
    getDocs(query(lettersCollection(), where("fromUid", "==", user.uid))),
    getDocs(query(lettersCollection(), where("toUid", "==", user.uid))),
    getDocs(collection(firestoreDb!, "users", user.uid, "bins")),
  ]);

  const letterDocs = new Map<string, Record<string, unknown>>();
  for (const entry of [...sentSnapshot.docs, ...receivedSnapshot.docs]) {
    letterDocs.set(entry.id, entry.data());
  }

  const batch = writeBatch(firestoreDb!);
  for (const [letterId, data] of letterDocs) {
    batch.delete(doc(firestoreDb!, "letters", letterId));
    const inviteId = data.inviteId;
    if (typeof inviteId === "string") {
      batch.delete(doc(firestoreDb!, "invites", inviteId));
    }
  }
  for (const entry of binsSnapshot.docs) {
    batch.delete(entry.ref);
  }
  if (user.username) {
    batch.delete(doc(firestoreDb!, "usernames", user.username));
  }
  batch.delete(doc(firestoreDb!, "users", user.uid));

  await batch.commit();
}
