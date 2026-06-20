"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { SetupRequired } from "@/components/SetupRequired";
import { useAuth } from "@/components/providers/AuthProvider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { firebaseConfigured, loading, user } = useAuth();

  useEffect(() => {
    if (!loading && firebaseConfigured && !user) {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }, [firebaseConfigured, loading, pathname, router, user]);

  if (!firebaseConfigured) {
    return <SetupRequired />;
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] px-6 py-12 text-[var(--color-text)]">
        <div className="mx-auto flex max-w-xl items-center justify-center rounded-[32px] border border-[var(--color-border)] bg-white/70 px-8 py-16 shadow-[var(--shadow-soft)]">
          <p className="tracking-[0.18em] uppercase text-sm text-[var(--color-text-soft)]">
            Gathering your correspondence...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
