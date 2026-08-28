"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmBurnModal } from "@/components/ConfirmBurnModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { ADMIN_USERNAME } from "@/lib/adminConfig";
import {
  deleteLetterAsAdmin,
  deleteUserAccountAsAdmin,
  listAllLetters,
  listAllUsers,
  type AdminUserSummary,
} from "@/lib/adminService";
import { formatLetterArrival } from "@/lib/dateUtils";
import type { Letter } from "@/lib/types";

type ConfirmTarget =
  | { kind: "user"; user: AdminUserSummary }
  | { kind: "letter"; letter: Letter };

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.username === ADMIN_USERNAME;

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!authLoading && profile && !isAdmin) {
      router.replace("/desk");
    }
  }, [authLoading, profile, isAdmin, router]);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setDataLoading(true);
    try {
      const [nextUsers, nextLetters] = await Promise.all([listAllUsers(), listAllLetters()]);
      setUsers(nextUsers);
      setLetters(nextLetters);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to load admin data.");
    } finally {
      setDataLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!statusMessage) return;
    const timeoutId = window.setTimeout(() => setStatusMessage(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setWorking(true);
    try {
      if (confirmTarget.kind === "user") {
        await deleteUserAccountAsAdmin(confirmTarget.user);
        setStatusMessage(`Deleted account @${confirmTarget.user.username} and its letters.`);
      } else {
        await deleteLetterAsAdmin(confirmTarget.letter);
        setStatusMessage("Deleted letter.");
      }
      setConfirmTarget(null);
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to delete.");
    } finally {
      setWorking(false);
    }
  }

  if (authLoading || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-[var(--color-text-soft)]">
        Checking access...
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="desk-workspace">
      <div className="h-full overflow-y-auto px-2 py-4">
        <div className="mx-auto max-w-5xl space-y-8 pb-10">
          <div>
            <p className="desk-rail-title">Admin</p>
            <h1 className="font-display text-3xl text-[var(--color-text-strong)]">Test Data Cleanup</h1>
            <p className="mt-1 text-sm text-[var(--color-text-soft)]">
              Only visible to @{ADMIN_USERNAME}. Deleting an account removes its profile, bins, and
              every letter it sent or received.
            </p>
          </div>

          {statusMessage ? (
            <p className="rounded-md border border-[var(--color-border-strong)] bg-white/70 px-4 py-2 text-sm text-[var(--color-text-strong)]">
              {statusMessage}
            </p>
          ) : null}

          <section className="desk-card p-5">
            <h2 className="desk-panel-heading">Accounts ({users.length})</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-[var(--color-text-soft)]">
                    <th className="pb-2 pr-3 font-medium">Username</th>
                    <th className="pb-2 pr-3 font-medium">Name</th>
                    <th className="pb-2 pr-3 font-medium">Mailbox</th>
                    <th className="pb-2 pr-3 font-medium">Created</th>
                    <th className="pb-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isSelf = user.uid === profile.uid;
                    return (
                      <tr key={user.uid} className="border-t border-[var(--color-border)]">
                        <td className="py-2 pr-3 text-[var(--color-text-strong)]">@{user.username}</td>
                        <td className="py-2 pr-3">{`${user.firstName} ${user.lastName}`.trim() || "—"}</td>
                        <td className="py-2 pr-3">@{user.mailboxName || "—"}</td>
                        <td className="py-2 pr-3">
                          {user.createdAt ? formatLetterArrival(user.createdAt) : "—"}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            className="danger-button px-3 py-1.5 text-xs"
                            disabled={isSelf}
                            title={isSelf ? "You can't delete your own account here." : undefined}
                            onClick={() => setConfirmTarget({ kind: "user", user })}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && !dataLoading ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-[var(--color-text-soft)]">
                        No accounts found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="desk-card p-5">
            <h2 className="desk-panel-heading">Letters ({letters.length})</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-[var(--color-text-soft)]">
                    <th className="pb-2 pr-3 font-medium">Title</th>
                    <th className="pb-2 pr-3 font-medium">From</th>
                    <th className="pb-2 pr-3 font-medium">To</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {letters.map((letter) => (
                    <tr key={letter.id} className="border-t border-[var(--color-border)]">
                      <td className="py-2 pr-3 text-[var(--color-text-strong)]">
                        {letter.title.trim() || "Untitled Letter"}
                      </td>
                      <td className="py-2 pr-3">{letter.fromName || "—"}</td>
                      <td className="py-2 pr-3">{letter.toName || "—"}</td>
                      <td className="py-2 pr-3 capitalize">{letter.status}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="danger-button px-3 py-1.5 text-xs"
                          onClick={() => setConfirmTarget({ kind: "letter", letter })}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {letters.length === 0 && !dataLoading ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-[var(--color-text-soft)]">
                        No letters found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <ConfirmBurnModal
        open={confirmTarget !== null}
        title={confirmTarget?.kind === "user" ? "Delete This Account?" : "Delete This Letter?"}
        body={
          confirmTarget?.kind === "user"
            ? `This permanently deletes @${confirmTarget.user.username}, its bins, and every letter it sent or received. This cannot be undone.`
            : "This permanently deletes the letter. This cannot be undone."
        }
        confirmLabel={working ? "Deleting..." : "Delete Permanently"}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
