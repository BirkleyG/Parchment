"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { assertFirebaseConfigured, firestoreDb } from "@/lib/firebase";
import type { RegistryUser, UserSettings, ValidationResult } from "@/lib/types";
import { normalizeMailboxName, validateMailboxName } from "@/lib/validations";

function mapRegistryUser(id: string, data: Record<string, unknown>): RegistryUser {
  return {
    id,
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
    mailboxName: String(data.mailboxName ?? ""),
    includedInRegistry: Boolean(data.includeInRegistry ?? false),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
}

export async function getFavoriteRegistryUserIds(uid: string): Promise<string[]> {
  assertFirebaseConfigured();

  const userDoc = await getDoc(doc(firestoreDb!, "users", uid));
  if (!userDoc.exists()) {
    return [];
  }

  const favorites = userDoc.data().favoriteRegistryUserIds;
  return Array.isArray(favorites)
    ? favorites.filter((value): value is string => typeof value === "string")
    : [];
}

export async function toggleFavoriteRegistryUser(uid: string, targetUserId: string): Promise<string[]> {
  assertFirebaseConfigured();

  const userRef = doc(firestoreDb!, "users", uid);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) {
    throw new Error("Your profile could not be found.");
  }

  const currentFavorites = Array.isArray(userDoc.data().favoriteRegistryUserIds)
    ? userDoc.data().favoriteRegistryUserIds.filter((value: unknown): value is string => typeof value === "string")
    : [];

  const nextFavorites = currentFavorites.includes(targetUserId)
    ? currentFavorites.filter((value: string) => value !== targetUserId)
    : [...currentFavorites, targetUserId];

  await updateDoc(userRef, {
    favoriteRegistryUserIds: nextFavorites,
    updatedAt: new Date().toISOString(),
  });

  return nextFavorites;
}

export async function validateMailboxAvailability(
  mailboxName: string,
  currentUid?: string,
): Promise<ValidationResult> {
  assertFirebaseConfigured();

  const validation = validateMailboxName(mailboxName);
  if (!validation.valid || !validation.normalizedValue) {
    return validation;
  }

  const mailboxQuery = query(
    collection(firestoreDb!, "users"),
    where("mailboxName", "==", validation.normalizedValue),
    limit(1),
  );
  const snapshot = await getDocs(mailboxQuery);

  if (!snapshot.empty && snapshot.docs[0].id !== currentUid) {
    return {
      valid: false,
      message: "That mailbox name is already spoken for.",
    };
  }

  return validation;
}

export async function listRegistryUsers(): Promise<RegistryUser[]> {
  assertFirebaseConfigured();

  const registryQuery = query(
    collection(firestoreDb!, "users"),
    where("includeInRegistry", "==", true),
  );
  const snapshot = await getDocs(registryQuery);

  return snapshot.docs
    .map((entry) => mapRegistryUser(entry.id, entry.data()))
    .sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName);
      if (lastNameCompare !== 0) {
        return lastNameCompare;
      }

      return a.firstName.localeCompare(b.firstName);
    });
}

export async function findUserByMailbox(mailboxName: string): Promise<RegistryUser | null> {
  assertFirebaseConfigured();

  const normalized = normalizeMailboxName(mailboxName);
  if (!normalized) {
    return null;
  }

  const mailboxQuery = query(
    collection(firestoreDb!, "users"),
    where("mailboxName", "==", normalized),
    limit(1),
  );
  const snapshot = await getDocs(mailboxQuery);

  if (snapshot.empty) {
    return null;
  }

  return mapRegistryUser(snapshot.docs[0].id, snapshot.docs[0].data());
}

export async function updateUserSettings(uid: string, settings: UserSettings): Promise<void> {
  assertFirebaseConfigured();

  const validation = await validateMailboxAvailability(settings.mailboxName, uid);
  if (!validation.valid || !validation.normalizedValue) {
    throw new Error(validation.message ?? "Please choose a different mailbox name.");
  }

  await updateDoc(doc(firestoreDb!, "users", uid), {
    firstName: settings.firstName.trim(),
    lastName: settings.lastName.trim(),
    mailboxName: validation.normalizedValue,
    includeInRegistry: settings.includeInRegistry,
    outgoingDelayDays: settings.outgoingDelayDays,
    incomingDelayDays: settings.incomingDelayDays,
    writingMode: settings.writingMode,
    updatedAt: new Date().toISOString(),
  });
}

export async function getUserSettings(uid: string): Promise<UserSettings | null> {
  assertFirebaseConfigured();

  const userDoc = await getDoc(doc(firestoreDb!, "users", uid));
  if (!userDoc.exists()) {
    return null;
  }

  const data = userDoc.data();
  return {
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
    mailboxName: String(data.mailboxName ?? ""),
    includeInRegistry: Boolean(data.includeInRegistry ?? true),
    outgoingDelayDays: Number(data.outgoingDelayDays ?? 1),
    incomingDelayDays: Number(data.incomingDelayDays ?? 3),
    writingMode: data.writingMode === "typewriter" ? "typewriter" : "fountainPen",
  };
}
