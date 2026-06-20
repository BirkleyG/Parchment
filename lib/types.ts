export type WritingMode = "fountainPen" | "typewriter";
export type InviteStatus = "pending" | "claimed";
export type InviteClaimMode = "existingAccount" | "newAccount";

export type UserSettings = {
  firstName: string;
  lastName: string;
  mailboxName: string;
  includeInRegistry: boolean;
  outgoingDelayDays: number;
  incomingDelayDays: number;
  writingMode: WritingMode;
};

export type RegistryUser = {
  id: string;
  firstName: string;
  lastName: string;
  mailboxName: string;
  includedInRegistry: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LetterStatus =
  | "draft"
  | "sent"
  | "inTransit"
  | "delivered"
  | "opened"
  | "burned";

export type Letter = {
  id: string;
  fromName: string;
  fromMailboxName: string;
  toName: string;
  toMailboxName: string;
  title: string;
  pages?: string[];
  body: string;
  status: LetterStatus;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  binId?: string;
  writingMode: WritingMode;
  fromUid?: string;
  toUid?: string;
  updatedAt?: string;
  inviteId?: string;
  inviteStatus?: InviteStatus;
  recipientMode?: "registry" | "invite";
  deliveryDelayDays?: number;
  claimMode?: InviteClaimMode;
};

export type MailBin = {
  id: string;
  name: string;
};

export type AuthProfile = {
  uid: string;
  username: string;
  authEmail: string;
  createdAt: string;
  updatedAt: string;
  settings: UserSettings;
};

export type UsernameIndex = {
  uid: string;
  username: string;
  authEmail: string;
  createdAt: string;
};

export type SendRegistryDraftPayload = {
  kind: "registry";
  recipientMailboxName: string;
  senderDisplayName: string;
  title: string;
};

export type SendInviteDraftPayload = {
  kind: "invite";
  recipientName: string;
  senderDisplayName: string;
  title: string;
};

export type SendDraftPayload = SendRegistryDraftPayload | SendInviteDraftPayload;

export type InviteClaim = {
  id: string;
  letterId: string;
  senderDisplayName: string;
  recipientName: string;
  title: string;
  status: InviteStatus;
  createdAt: string;
  claimedAt?: string;
  claimedByUid?: string;
  claimMode?: InviteClaimMode;
  senderDelayDays: number;
};

export type RegistryGroup = {
  letter: string;
  users: RegistryUser[];
};

export type RegistryPage = {
  id: string;
  leftGroups: RegistryGroup[];
  rightGroups: RegistryGroup[];
};

export type Scene = "desk" | "registry" | "mailbox";

export type ValidationResult = {
  valid: boolean;
  message?: string;
  normalizedValue?: string;
};
