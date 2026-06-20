"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SetupRequired } from "@/components/SetupRequired";
import { useAuth } from "@/components/providers/AuthProvider";
import { signInWithUsername } from "@/lib/authService";

export default function SignInPage() {
  const router = useRouter();
  const { firebaseConfigured, loading, user } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nextPath, setNextPath] = useState("/desk");
  const signUpHref = nextPath === "/desk" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(nextPath)}`;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setNextPath(params.get("next") || "/desk");
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath);
    }
  }, [loading, nextPath, router, user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signInWithUsername({ username, password });
      router.replace(nextPath);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!firebaseConfigured) {
    return <SetupRequired />;
  }

  return (
    <div className="auth-shell">
      <div className="auth-card parchment-panel">
        <p className="eyebrow">Welcome Back</p>
        <h1 className="font-display text-5xl text-[var(--color-text-strong)]">Enter your desk</h1>
        <p className="mt-3 text-[var(--color-text-soft)]">
          Take your time. Your letters, drafts, and registry are waiting.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="auth-label">Username</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="paper-input"
              placeholder="willowhollow"
            />
          </label>
          <label className="block space-y-2">
            <span className="auth-label">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="paper-input"
            />
          </label>

          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

          <button type="submit" className="paper-button" disabled={submitting}>
            {submitting ? "Signing In..." : "Enter the Desk"}
          </button>
        </form>

        <p className="mt-8 text-sm text-[var(--color-text-soft)]">
          New here?{" "}
          <Link href={signUpHref} className="font-semibold text-[var(--color-bronze-strong)] underline">
            Create your address
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
