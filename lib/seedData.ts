import type { MailBin, RegistryUser } from "@/lib/types";

export const DEFAULT_DELAY_OPTIONS = [1, 3, 7, 14, 30];

export const DEFAULT_BINS: MailBin[] = [
  { id: "unopened", name: "Unopened" },
  { id: "keepsakes", name: "Keepsakes" },
  { id: "friends", name: "Friends" },
  { id: "family", name: "Family" },
];

export const REGISTRY_PAGE_SIZE = 6;

export const STARTER_REGISTRY: RegistryUser[] = [
  {
    id: "starter-1",
    firstName: "Adeline",
    lastName: "Harper",
    mailboxName: "fieldnotes",
    includedInRegistry: true,
  },
  {
    id: "starter-2",
    firstName: "Daniel",
    lastName: "Prescott",
    mailboxName: "danielprescott",
    includedInRegistry: true,
  },
];

