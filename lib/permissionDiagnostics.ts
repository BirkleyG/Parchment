/**
 * Centralized Firebase permission-error diagnostics.
 *
 * When a Firestore operation fails with `permission-denied`, this helper
 * inspects the operation context (collection, document path, claim token,
 * claim mode) and returns a human-readable diagnosis with a concrete fix.
 *
 * Usage:
 *   import { diagnosePermissionDenied } from "@/lib/permissionDiagnostics";
 *
 *   try {
 *     await someFirestoreOp();
 *   } catch (error) {
 *     const diagnosis = diagnosePermissionDenied(error, { kind: "send-draft", letterId, recipientMailbox });
 *     if (diagnosis) console.error(diagnosis);
 *   }
 */

import { FirebaseError } from "firebase/app";

export type FirestoreOp =
  | { kind: "letter-read"; letterId: string }
  | { kind: "letter-create" }
  | { kind: "letter-update"; letterId: string }
  | { kind: "letter-delete"; letterId: string }
  | { kind: "send-draft"; letterId: string; recipientMailbox: string }
  | { kind: "invite-read"; token: string }
  | { kind: "invite-create" }
  | { kind: "invite-claim"; token: string; claimMode: string }
  | { kind: "invite-rotate"; token: string }
  | { kind: "user-read"; uid: string }
  | { kind: "user-create"; uid: string }
  | { kind: "user-update"; uid: string }
  | { kind: "username-lookup" }
  | { kind: "registry-list" }
  | { kind: "bin-read"; uid: string }
  | { kind: "bin-write"; uid: string };

/**
 * Maps a Firebase permission-denied error to a diagnostic message that
 * explains **why** the operation was denied and **what to check** in the
 * Firestore security rules.
 *
 * Returns null if the error is not a permission-denied FirebaseError.
 */
export function diagnosePermissionDenied(error: unknown, op: FirestoreOp): string | null {
  if (!(error instanceof FirebaseError) || error.code !== "permission-denied") {
    return null;
  }

  const lines: string[] = [];

  switch (op.kind) {
    case "letter-read":
      lines.push(
        `Permission denied reading letter ${op.letterId}.`,
        "",
        "Diagnosis: The signed-in user is neither the sender (fromUid) nor the recipient (toUid) of this letter, and the letter does not have a pending invite linked to it.",
        "",
        'Fix: Check firestore.rules -> match /letters/{letterId} -> allow read.',
        "Ensure the user is the sender or recipient, or that the letter has an inviteId pointing to a \"pending\" invite document.",
      );
      break;

    case "letter-create":
      lines.push(
        "Permission denied creating a new letter draft.",
        "",
        "Diagnosis: The user is either not signed in, or request.resource.data does not satisfy the create rule constraints.",
        "",
        "Fix: Check firestore.rules -> match /letters/{letterId} -> allow create.",
        "Ensure the user is signed in, fromUid matches request.auth.uid, status is 'draft', and writingMode is 'fountainPen' or 'typewriter'.",
      );
      break;

    case "letter-update":
      lines.push(
        `Permission denied updating letter ${op.letterId}.`,
        "",
        "Diagnosis: None of the four letter-update sub-rules in firestore.rules matched.",
        "The user is likely not the sender (fromUid) or the recipient (toUid), or the status transition is not allowed.",
        "",
        "Fix: Check firestore.rules -> match /letters/{letterId} -> allow update.",
        "Rules [1]-[4] handle: sender draft lifecycle, invite claim, invite rotation, and recipient mailbox actions respectively.",
        "Verify the resource.data and request.resource.data fields match the expected preconditions.",
      );
      break;

    case "letter-delete":
      lines.push(
        `Permission denied deleting letter ${op.letterId}.`,
        "",
        "Diagnosis: The user is neither the sender (fromUid) nor the recipient (toUid) of this letter.",
        "",
        "Fix: Check firestore.rules -> match /letters/{letterId} -> allow delete.",
        "Ensure the user is the sender or recipient.",
      );
      break;

    case "send-draft":
      lines.push(
        `Permission denied sealing and sending letter ${op.letterId}.`,
        "",
        "Diagnosis: The sender (fromUid) update rule did not match. This typically happens when:",
        '  - The letter status is not "draft" (it may have been modified already)',
        "  - request.resource.data.fromUid changed from resource.data.fromUid",
        "  - The user is not the original sender",
        "",
        "Fix: Check firestore.rules -> match /letters/{letterId} -> allow update [1].",
        "Ensure resource.data.status == 'draft' and resource.data.fromUid == request.auth.uid.",
        "Ensure sendDraft() in lib/letterService.ts preserves fromUid when calling setDoc with merge.",
      );
      break;

    case "invite-read":
      lines.push(
        `Permission denied reading invite ${op.token}.`,
        "",
        "Diagnosis: The invite document could not be read.",
        "Note that invites have a public get rule (allow get: if true), so this should not happen unless the token is malformed or the document does not exist.",
        "",
        "Fix: Verify the invite document exists at /invites/$(token) and that the token is correct.",
        "If the invite was claimed or replaced, getInviteByToken() returns null — handle that case in the client.",
      );
      break;

    case "invite-create":
      lines.push(
        "Permission denied creating an invite.",
        "",
        "Diagnosis: The user is either not signed in, or the invite payload does not match the create rule.",
        "",
        "Fix: Check firestore.rules -> match /invites/{inviteId} -> allow create.",
        "Ensure the user is signed in, status is 'pending', and senderUid matches request.auth.uid.",
      );
      break;

    case "invite-claim":
      lines.push(
        `Permission denied claiming invite ${op.token} (claimMode: ${op.claimMode}).`,
        "",
        "Diagnosis: The invite-claim update rule on /letters did not match. This happens when:",
        '  - The letter status is not "sent" (it may have already been claimed)',
        "  - The letter's inviteId is not a string (invite not linked to this letter)",
        "  - The letter's toUid is not null (already claimed by someone else)",
        "  - request.resource.data.toUid != request.auth.uid (claimant mismatch)",
        "  - The status transition is not to 'inTransit' or 'delivered'",
        "  - fromUid or inviteId changed from the original letter data",
        "",
        "The corresponding invite update (status -> 'claimed', claimedByUid -> claimant) is independently verified.",
        "",
        "Fix: Check firestore.rules -> match /letters/{letterId} -> allow update [2].",
        "The claimInvite() transaction in lib/inviteService.ts updates both the letter and invite atomically.",
        "Ensure the invite is still 'pending' and the claimant is the authenticated user.",
      );
      break;

    case "invite-rotate":
      lines.push(
        `Permission denied rotating invite ${op.token}.`,
        "",
        "Diagnosis: The sender-rotate update rule did not match.",
        "",
        "Fix: Check firestore.rules -> match /letters/{letterId} -> allow update [3].",
        "Ensure the user is the sender (fromUid), the letter status is 'sent', and inviteStatus is 'pending'.",
      );
      break;

    case "user-read":
      lines.push(
        `Permission denied reading user document ${op.uid}.`,
        "",
        "Diagnosis: The /users/{userId} match has allow read: if true, so this should not happen unless Firebase config is missing.",
        "",
        "Fix: Verify NEXT_PUBLIC_FIREBASE_* environment variables are set.",
        "If using the emulator, ensure it is running.",
      );
      break;

    case "user-create":
      lines.push(
        `Permission denied creating user document ${op.uid}.`,
        "",
        "Diagnosis: The user-create rule requires isOwner(userId) — i.e., request.auth.uid == userId — and the document must contain uid, username, and mailboxName as strings.",
        "",
        "Fix: Check firestore.rules -> match /users/{userId} -> allow create.",
        "Ensure the UID matches the authenticated user and all required fields are present.",
      );
      break;

    case "user-update":
      lines.push(
        `Permission denied updating user document ${op.uid}.`,
        "",
        "Diagnosis: The user is either not the owner, or the update changes immutable fields (uid, username, createdAt).",
        "",
        "Fix: Check firestore.rules -> match /users/{userId} -> allow update.",
        "Ensure the user is updating their own document and not changing uid, username, or createdAt.",
      );
      break;

    case "username-lookup":
      lines.push(
        "Permission denied looking up username.",
        "",
        "Diagnosis: The /usernames/{username} match allows public gets, so this should not happen unless Firebase config is missing.",
        "",
        "Fix: Verify NEXT_PUBLIC_FIREBASE_* environment variables are set.",
      );
      break;

    case "registry-list":
      lines.push(
        "Permission denied listing registry users.",
        "",
        "Diagnosis: The /users/{userId} match has allow read: if true, so anyone can list registry users.",
        "This should not happen unless Firebase config is missing.",
        "",
        "Fix: Verify NEXT_PUBLIC_FIREBASE_* environment variables are set.",
      );
      break;

    case "bin-read":
      lines.push(
        `Permission denied reading bins for user ${op.uid}.`,
        "",
        "Diagnosis: The user does not own this /users/{uid}/bins/{binId} subcollection.",
        "",
        "Fix: Check firestore.rules -> match /users/{userId}/bins/{binId}.",
        "Ensure the authenticated user's UID matches {userId}.",
      );
      break;

    case "bin-write":
      lines.push(
        `Permission denied writing bins for user ${op.uid}.`,
        "",
        "Diagnosis: The user does not own this /users/{uid}/bins/{binId} subcollection.",
        "",
        "Fix: Check firestore.rules -> match /users/{userId}/bins/{binId} -> allow read, write.",
        "Ensure the authenticated user's UID matches {userId}.",
      );
      break;

    default:
      lines.push(
        "Permission denied: a Firestore security rule rejected this operation.",
        "",
        "Fix: Check firestore.rules for the relevant match path and ensure the authenticated user satisfies the rule conditions.",
      );
  }

  return lines.join("\n");
}
