"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SetupRequired } from "@/components/SetupRequired";
import { useAuth } from "@/components/providers/AuthProvider";
import { signUpWithUsername } from "@/lib/authService";

export default function SignUpPage() {
  const router = useRouter();
  const { firebaseConfigured, loading, user } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mailboxName, setMailboxName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nextPath, setNextPath] = useState("/desk");
  const signInHref = nextPath === "/desk" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(nextPath)}`;

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
      await signUpWithUsername({ username, password, firstName, lastName, mailboxName });
      router.replace(nextPath);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create your address.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!firebaseConfigured) {
    return <SetupRequired />;
  }

  return (
    <div className="auth-shell">
      <div className="auth-card w-full max-w-3xl parchment-panel">
        <p className="eyebrow">Create Your Address</p>
        <h1 className="font-display text-5xl text-[var(--color-text-strong)]">Start corresponding</h1>
        <p className="mt-3 text-[var(--color-text-soft)]">
          Long-form letters, thoughtful pacing, and a cleaner web-native workspace.
        </p>

        <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="auth-label">First Name</span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="paper-input"
            />
          </label>
          <label className="block space-y-2">
            <span className="auth-label">Last Name</span>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="paper-input"
            />
          </label>

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
            <span className="auth-label">Mailbox Name</span>
            <input
              value={mailboxName}
              onChange={(event) => setMailboxName(event.target.value)}
              className="paper-input"
              placeholder="willowhollow"
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="auth-label">Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="paper-input"
            />
          </label>

          {error ? <p className="text-sm text-[var(--color-danger)] md:col-span-2">{error}</p> : null}

          <div className="flex flex-col gap-4 md:col-span-2 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-[var(--color-text-soft)]">
              Already have an address?{" "}
              <Link href={signInHref} className="font-semibold text-[var(--color-bronze-strong)] underline">
                Sign in
              </Link>
              .
            </p>
            <button type="submit" className="paper-button" disabled={submitting}>
              {submitting ? "Preparing..." : "Create Address"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
