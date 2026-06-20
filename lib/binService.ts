"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
} from "firebase/firestore";

import { DEFAULT_BINS } from "@/lib/seedData";
import { assertFirebaseConfigured, firestoreDb } from "@/lib/firebase";
import type { Letter, MailBin } from "@/lib/types";

export const MAX_MAIL_BINS = 5;

function binsCollection(uid: string) {
  return collection(firestoreDb!, "users", uid, "bins");
}

export async function ensureDefaultBins(uid: string): Promise<void> {
  assertFirebaseConfigured();

  const snapshot = await getDocs(query(binsCollection(uid)));
  if (!snapshot.empty) {
    return;
  }

  await Promise.all(
    DEFAULT_BINS.map((bin) =>
      setDoc(doc(firestoreDb!, "users", uid, "bins", bin.id), {
        id: bin.id,
        name: bin.name,
      }),
    ),
  );
}

export async function listBins(uid: string): Promise<MailBin[]> {
  assertFirebaseConfigured();

  await ensureDefaultBins(uid);
  const snapshot = await getDocs(query(binsCollection(uid)));
  return snapshot.docs
    .map((entry) => ({
      id: entry.id,
      name: String(entry.data().name ?? "Untitled"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createBin(uid: string, name: string): Promise<MailBin> {
  assertFirebaseConfigured();

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Bin names need at least one character.");
  }

  const existingBins = await listBins(uid);
  if (existingBins.length >= MAX_MAIL_BINS) {
    throw new Error(`You can keep up to ${MAX_MAIL_BINS} bins in the mailbox.`);
  }

  const id = crypto.randomUUID();
  const nextBin = { id, name: trimmed };
  await setDoc(doc(firestoreDb!, "users", uid, "bins", id), nextBin);
  return nextBin;
}

export async function renameBin(uid: string, binId: string, nextName: string): Promise<void> {
  assertFirebaseConfigured();
  const trimmed = nextName.trim();
  if (!trimmed) {
    throw new Error("Bin names need at least one character.");
  }

  await updateDoc(doc(firestoreDb!, "users", uid, "bins", binId), {
    name: trimmed,
  });
}

export function canDeleteBin(binId: string, letters: Letter[]): boolean {
  if (DEFAULT_BINS.some((entry) => entry.id === binId)) {
    return false;
  }

  return !letters.some((letter) => letter.binId === binId);
}

export async function deleteBin(uid: string, binId: string, letters: Letter[]): Promise<void> {
  assertFirebaseConfigured();

  if (!canDeleteBin(binId, letters)) {
    throw new Error("Only empty custom bins can be removed.");
  }

  await deleteDoc(doc(firestoreDb!, "users", uid, "bins", binId));
}
