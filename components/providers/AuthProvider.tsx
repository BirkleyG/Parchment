"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const nextProfile = await getProfileByUid(user.uid);
    setProfile(nextProfile);
  }, [user]);

  useEffect(() => {
    if (!hasFirebaseConfig || !firebaseAuth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setLoading(true);
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const nextProfile = await getProfileByUid(nextUser.uid);
      setProfile(nextProfile);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    await signOutCurrentUser();
    setUser(null);
    setProfile(null);
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

