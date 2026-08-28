"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { getProfileByUid, signOutCurrentUser } from "@/lib/authService";
import { firebaseAuth, hasFirebaseConfig } from "@/lib/firebase";
import type { AuthProfile } from "@/lib/types";

type AuthContextValue = {
  firebaseConfigured: boolean;
  loading: boolean;
  user: User | null;
  profile: AuthProfile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const loadedProfileUidRef = useRef<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      loadedProfileUidRef.current = null;
      return;
    }

    const nextProfile = await getProfileByUid(user.uid);
    setProfile(nextProfile);
    loadedProfileUidRef.current = user.uid;
  }, [user]);

  useEffect(() => {
    if (!hasFirebaseConfig || !firebaseAuth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        loadedProfileUidRef.current = null;
        setLoading(false);
        return;
      }

      // Firebase also re-fires this observer on a silent background token
      // refresh for the *same* signed-in user (roughly hourly, and often on
      // tab focus). Refetching the profile every time would hand out a new
      // object reference, and pages that reset local edit state whenever
      // `profile` changes (desk drafts, registry settings) would lose
      // whatever was being typed. Only reload when the uid actually changed.
      if (loadedProfileUidRef.current === nextUser.uid) {
        return;
      }

      setLoading(true);
      const nextProfile = await getProfileByUid(nextUser.uid);
      setProfile(nextProfile);
      loadedProfileUidRef.current = nextUser.uid;
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    await signOutCurrentUser();
    setUser(null);
    setProfile(null);
    loadedProfileUidRef.current = null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseConfigured: hasFirebaseConfig,
      loading,
      user,
      profile,
      refreshProfile,
      signOut,
    }),
    [loading, profile, refreshProfile, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}

