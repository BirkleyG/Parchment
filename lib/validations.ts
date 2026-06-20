import { containsCrassLanguage } from "@/lib/profanity";
import type { ValidationResult } from "@/lib/types";

const MAILBOX_PATTERN = /^[a-z0-9._-]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,24}$/;

export function normalizeMailboxName(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export function validateMailboxName(value: string): ValidationResult {
  const normalized = normalizeMailboxName(value);

  if (!normalized) {
    return { valid: false, message: "Mailbox name is required." };
  }

  if (normalized.includes(" ")) {
    return { valid: false, message: "Mailbox names cannot contain spaces." };
  }

  if (!MAILBOX_PATTERN.test(normalized)) {
    return {
      valid: false,
      message: "Use lowercase letters, numbers, dots, underscores, or hyphens.",
    };
  }

  if (containsCrassLanguage(normalized)) {
    return {
      valid: false,
      message: "Please choose a kinder mailbox name.",
    };
  }

  return { valid: true, normalizedValue: normalized };
}

export function validateUsername(value: string): ValidationResult {
  const normalized = normalizeUsername(value);

  if (!normalized) {
    return { valid: false, message: "Username is required." };
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      valid: false,
      message: "Use 3 to 24 lowercase characters, numbers, dots, underscores, or hyphens.",
    };
  }

  if (containsCrassLanguage(normalized)) {
    return {
      valid: false,
      message: "Please choose a kinder username.",
    };
  }

  return { valid: true, normalizedValue: normalized };
}

