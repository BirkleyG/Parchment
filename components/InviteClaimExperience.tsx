"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { SetupRequired } from "@/components/SetupRequired";
import { useAuth } from "@/components/providers/AuthProvider";
import { claimInvite, getInviteByToken } from "@/lib/inviteService";
import type { InviteClaim, InviteClaimMode } from "@/lib/types";

type InviteClaimExperienceProps = {
  token: string;
  initialClaimMode?: InviteClaimMode;
};

function buildNextHref(token: string, claimMode: InviteClaimMode) {
  return `/invite/${token}?claimMode=${claimMode}`;
}

export function InviteClaimExperience({
  token,
  initialClaimMode,
}: InviteClaimExperienceProps) {
  const { firebaseConfigured, loading, profile, user } = useAuth();
  const [invite, setInvite] = useState<InviteClaim | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const attemptedAutoClaimRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInvite() {
      setInviteLoading(true);
      setInviteError(null);

      try {
        const nextInvite = await getInviteByToken(token);
        if (!active) {
          return;
        }

        if (!nextInvite) {
          setInviteError("This invitation could not be found.");
          setInvite(null);
          return;
        }

        setInvite(nextInvite);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        setInviteError(caughtError instanceof Error ? caughtError.message : "Unable to open this invitation.");
        setInvite(null);
      } finally {
        if (active) {
          setInviteLoading(false);
        }
      }
    }

    void loadInvite();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleClaim(mode: InviteClaimMode) {
    if (!profile || !invite || invite.status === "claimed") {
      return;
    }

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
    } catch (caughtError) {
      setClaimError(caughtError instanceof Error ? caughtError.message : "Unable to claim this invitation.");
    } finally {
      setIsClaiming(false);
    }
  }

  useEffect(() => {
    if (!initialClaimMode || !profile || !invite || invite.status === "claimed" || loading) {
      return;
    }

    const attemptKey = `${token}:${initialClaimMode}:${profile.uid}`;
    if (attemptedAutoClaimRef.current === attemptKey) {
      return;
    }

    attemptedAutoClaimRef.current = attemptKey;
    void handleClaim(initialClaimMode);
  }, [initialClaimMode, invite, loading, profile, token]);

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

  return (
    <div className="invite-shell">
      <div className="invite-card parchment-panel">
        <p className="eyebrow">Parchment Invitation</p>
        <h1 className="invite-title">
          {inviteClaimed ? "This invitation has already been opened." : "A letter is waiting for you."}
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
            ) : user && profile ? (
              <div className="invite-actions invite-actions-stacked">
                <button
                  type="button"
                  className="paper-button"
                  disabled={isClaiming}
                  onClick={() => void handleClaim("existingAccount")}
                >
                  {isClaiming ? "Claiming..." : `Receive with @${profile.settings.mailboxName}`}
                </button>
                <p className="invite-hint">
                  Signed in as @{profile.settings.mailboxName}. If this is not the right account, sign out and return with a different one.
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
