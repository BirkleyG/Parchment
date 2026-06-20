"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  collection,
} from "firebase/firestore";

import { ensureDefaultBins } from "@/lib/binService";
import { assertFirebaseConfigured, firebaseAuth, firestoreDb } from "@/lib/firebase";
import type { AuthProfile, UserSettings } from "@/lib/types";
import { validateMailboxName, validateUsername } from "@/lib/validations";

const DEFAULT_SETTINGS: UserSettings = {
  firstName: "",
  lastName: "",
  mailboxName: "",
  includeInRegistry: true,
  outgoingDelayDays: 1,
  incomingDelayDays: 3,
  writingMode: "fountainPen",
};

const AUTH_EMAIL_DOMAIN = "parchment.local";

function mapUserDocToProfile(uid: string, data: Record<string, unknown>): AuthProfile {
  return {
    uid,
    username: String(data.username ?? ""),
    authEmail: String(data.authEmail ?? ""),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
    settings: {
      firstName: String(data.firstName ?? ""),
      lastName: String(data.lastName ?? ""),
      mailboxName: String(data.mailboxName ?? ""),
      includeInRegistry: Boolean(data.includeInRegistry ?? true),
      outgoingDelayDays: Number(data.outgoingDelayDays ?? 1),
      incomingDelayDays: Number(data.incomingDelayDays ?? 3),
      writingMode: (data.writingMode as UserSettings["writingMode"]) ?? "fountainPen",
    },
  };
}

function buildSyntheticAuthEmail(username: string): string {
  return `${username}@${AUTH_EMAIL_DOMAIN}`;
}

export async function getProfileByUid(uid: string): Promise<AuthProfile | null> {
  assertFirebaseConfigured();

  const userDoc = await getDoc(doc(firestoreDb!, "users", uid));
  if (!userDoc.exists()) {
    return null;
  }

  return mapUserDocToProfile(uid, userDoc.data());
}

export async function signUpWithUsername(input: {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  mailboxName: string;
}): Promise<AuthProfile> {
  assertFirebaseConfigured();

  const usernameResult = validateUsername(input.username);
  if (!usernameResult.valid || !usernameResult.normalizedValue) {
    throw new Error(usernameResult.message ?? "Please choose a valid username.");
  }

  const mailboxResult = validateMailboxName(input.mailboxName);
  if (!mailboxResult.valid || !mailboxResult.normalizedValue) {
    throw new Error(mailboxResult.message ?? "Please choose a valid mailbox name.");
  }

  const normalizedUsername = usernameResult.normalizedValue;
  const normalizedMailbox = mailboxResult.normalizedValue;

  const usernameRef = doc(firestoreDb!, "usernames", normalizedUsername);
  const usernameDoc = await getDoc(usernameRef);
  if (usernameDoc.exists()) {
    throw new Error("That username is already in use.");
  }

  const mailboxQuery = query(
    collection(firestoreDb!, "users"),
    where("mailboxName", "==", normalizedMailbox),
    limit(1),
  );
  const mailboxSnapshot = await getDocs(mailboxQuery);
  if (!mailboxSnapshot.empty) {
    throw new Error("That mailbox name is already spoken for.");
  }

  const authEmail = buildSyntheticAuthEmail(normalizedUsername);
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth!,
    authEmail,
    input.password,
  );
  const uid = credential.user.uid;

  const now = new Date().toISOString();
  const userPayload = {
    uid,
    username: normalizedUsername,
    authEmail,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    mailboxName: normalizedMailbox,
    includeInRegistry: true,
    outgoingDelayDays: DEFAULT_SETTINGS.outgoingDelayDays,
    incomingDelayDays: DEFAULT_SETTINGS.incomingDelayDays,
    writingMode: DEFAULT_SETTINGS.writingMode,
    favoriteRegistryUserIds: [],
    createdAt: now,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  };

  await Promise.all([
    setDoc(doc(firestoreDb!, "users", uid), userPayload),
    setDoc(usernameRef, {
      uid,
      username: normalizedUsername,
      authEmail,
      createdAt: now,
      createdAtServer: serverTimestamp(),
    }),
  ]);

  await ensureDefaultBins(uid);
  return mapUserDocToProfile(uid, userPayload);
}

export async function signInWithUsername(input: {
  username: string;
  password: string;
}): Promise<AuthProfile> {
  assertFirebaseConfigured();

  const usernameResult = validateUsername(input.username);
  if (!usernameResult.valid || !usernameResult.normalizedValue) {
    throw new Error("No account by that name was found.");
  }

  const usernameRef = doc(firestoreDb!, "usernames", usernameResult.normalizedValue);
  const usernameDoc = await getDoc(usernameRef);

  if (!usernameDoc.exists()) {
    throw new Error("No account by that name was found.");
  }

  const authEmail = String(usernameDoc.data().authEmail ?? "");
  if (!authEmail) {
    throw new Error("This address could not be found.");
  }

  const credential = await signInWithEmailAndPassword(
    firebaseAuth!,
    authEmail,
    input.password,
  );

  const profile = await getProfileByUid(credential.user.uid);
  if (!profile) {
    throw new Error("Your profile could not be found.");
  }

  await ensureDefaultBins(profile.uid);
  return profile;
}

export async function signOutCurrentUser(): Promise<void> {
  assertFirebaseConfigured();
  await signOut(firebaseAuth!);
}
