"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";

import { SetupRequired } from "@/components/SetupRequired";
import { useAuth } from "@/components/providers/AuthProvider";
import { claimInvite, getInviteByToken } from "@/lib/inviteService";
import type { InviteClaim, InviteClaimMode } from "@/lib/types";

function formatClaimError(error: unknown): string {
  if (error instanceof Error) {
    // If the service layer already wrapped this with a diagnostic message
    // (from diagnosePermissionDenied), surface it directly.
    return error.message;
  }
  if (error instanceof FirebaseError) {
    if (error.code === "permission-denied") {
      return (
        "Permission denied while claiming this invitation. Check that you are signed in " +
        "to the correct account and that your account has a mailbox name set.\n\n" +
        `Firebase details: ${error.message}\n\n` +
        "If this problem persists, try signing out and creating a new account."
      );
    }
    if (error.code === "not-found") {
      return "This invitation could not be found. It may have expired or been replaced.";
    }
    if (error.code === "deadline-exceeded") {
      return "The claim request timed out. Please try again.";
    }
    if (error.code === "cancelled" || error.code === "aborted") {
      return "Someone else may have already claimed this invitation, or it was replaced. Please try again.";
    }
    return `Error: ${error.message}`;
  }
  return "Unable to claim this invitation. Please refresh and try again.";
}

function parseClaimMode(value: string | null): InviteClaimMode | undefined {
  if (value === "existingAccount" || value === "newAccount") {
    return value;
  }
  return undefined;
}

function buildNextHref(token: string, claimMode: InviteClaimMode): string {
  return `/invite/${token}?claimMode=${claimMode}`;
}

type InviteClaimExperienceProps = {
  token: string;
  initialClaimMode?: InviteClaimMode;
};

export function InviteClaimExperience({
  token,
  initialClaimMode,
}: InviteClaimExperienceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlClaimMode = parseClaimMode(searchParams.get("claimMode"));
  const effectiveClaimMode = urlClaimMode ?? initialClaimMode;

  const { firebaseConfigured, profile, loading: authLoading, user } = useAuth();
  const [invite, setInvite] = useState<InviteClaim | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadInvite() {
      setInviteLoading(true);
      setInviteError(null);

      try {
        const nextInvite = await getInviteByToken(token);
        if (!active) return;

        if (!nextInvite) {
          setInviteError("This invitation could not be found.");
          setInvite(null);
          return;
        }

        setInvite(nextInvite);
      } catch (caughtError) {
        if (!active) return;
        console.error("Failed to load invite:", caughtError);
        setInviteError(formatClaimError(caughtError));
        setInvite(null);
      } finally {
        if (active) setInviteLoading(false);
      }
    }

    void loadInvite();
    return () => {
      active = false;
    };
  }, [token]);

  // Auto-claim: when the user arrives with a claimMode parameter and is
  // fully authenticated (user + profile loaded), automatically claim the
  // invitation instead of requiring a manual button click.
  useEffect(() => {
    if (!effectiveClaimMode) return;
    if (authLoading || !user || !profile) return;
    if (!invite || invite.status === "claimed") return;
    if (isClaiming) return;

    void handleClaim(effectiveClaimMode);
  }, [effectiveClaimMode, authLoading, user, profile, invite, isClaiming]);

  async function handleClaim(mode: InviteClaimMode) {
    if (!profile || !invite || invite.status === "claimed") return;

    setIsClaiming(true);
    setClaimError(null);

    try {
      const result = await claimInvite(profile, token, mode);
      setInvite(result.invite);
      setClaimStatus(
        mode === "existingAccount"
          ? "Your letter is now on its way and will arrive after the usual delay."
          : "Your letter has been delivered and is ready in your mailbox.",
      );
      // Redirect to the mailbox after a brief moment so the user sees
      // the success message, then they can open their letter.
      if (mode === "newAccount") {
        const target = `/mailbox?letter=${result.letter.id}`;
        setTimeout(() => router.replace(target), 1500);
      } else {
        setTimeout(() => router.replace("/mailbox"), 1500);
      }
    } catch (caughtError) {
      // Log full error to console for debugging — the UI shows a user-friendly message.
      console.error("Claim failed:", caughtError);
      setClaimError(formatClaimError(caughtError));
    } finally {
      setIsClaiming(false);
    }
  }

  const signInHref = useMemo(
    () => `/sign-in?next=${encodeURIComponent(buildNextHref(token, "existingAccount"))}`,
    [token],
  );
  const signUpHref = useMemo(
    () => `/sign-up?next=${encodeURIComponent(buildNextHref(token, "newAccount"))}`,
    [token],
  );

  if (!firebaseConfigured) {
    return <SetupRequired />;
  }

  const inviteUnavailable = !inviteLoading && (!invite || inviteError);
  const inviteClaimed = invite?.status === "claimed";
  const senderName = invite?.senderDisplayName || "A friend";
  const isReadyToClaim = user && profile && !authLoading;

  return (
    <div className="invite-shell">
      <div className="invite-card parchment-panel">
        <p className="eyebrow">Parchment Invitation</p>
        <h1 className="invite-title">
          {inviteClaimed
            ? "This invitation has already been opened."
            : "A letter is waiting for you."}
        </h1>

        {inviteLoading ? (
          <p className="invite-copy">Preparing the wax seal and unfolding the details...</p>
        ) : inviteUnavailable ? (
          <>
            <p className="invite-copy">
              {inviteError || "This invitation is no longer available."}
            </p>
            <Link href="/sign-in" className="paper-button invite-primary-link">
              Go to Sign In
            </Link>
          </>
        ) : authLoading ? (
          <>
            <p className="invite-copy">Finishing your address setup...</p>
          </>
        ) : (
          <>
            <p className="invite-copy">
              {senderName} sent you <span className="invite-emphasis">“{invite?.title || "Untitled Letter"}”</span> on Parchment.
            </p>
            <p className="invite-subcopy">
              Claim it with an existing account and let it arrive after the usual delay, or create a new address and receive it right away.
            </p>

            <div className="invite-detail-grid">
              <div>
                <span className="invite-detail-label">From</span>
                <p className="invite-detail-value">{senderName}</p>
              </div>
              <div>
                <span className="invite-detail-label">For</span>
                <p className="invite-detail-value">{invite?.recipientName || "You"}</p>
              </div>
            </div>

            {claimStatus ? <p className="invite-success">{claimStatus}</p> : null}
            {claimError ? <p className="invite-error">{claimError}</p> : null}

            {inviteClaimed ? (
              <div className="invite-actions">
                <Link href={user ? "/mailbox" : "/sign-in"} className="paper-button invite-primary-link">
                  {user ? "Open Mailbox" : "Sign In"}
                </Link>
              </div>
            ) : isReadyToClaim ? (
              <div className="invite-actions invite-actions-stacked">
                <button
                  type="button"
                  className="paper-button"
                  disabled={isClaiming}
                  onClick={() => void handleClaim(effectiveClaimMode ?? "existingAccount")}
                >
                  {isClaiming ? "Claiming..." : `Receive with @${profile!.settings.mailboxName}`}
                </button>
                <p className="invite-hint">
                  Signed in as @{profile!.settings.mailboxName}. If this is not the right account, sign out and return with a different one.
                </p>
              </div>
            ) : (
              <div className="invite-actions invite-actions-split">
                <Link href={signInHref} className="secondary-button invite-secondary-link">
                  Link Existing Account
                </Link>
                <Link href={signUpHref} className="paper-button invite-primary-link">
                  Create Account
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
