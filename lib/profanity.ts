const BLOCKED_TERMS = [
  "asshole",
  "bastard",
  "bitch",
  "cock",
  "cunt",
  "dick",
  "fuck",
  "motherfucker",
  "piss",
  "shit",
  "slut",
  "whore",
];

export function containsCrassLanguage(value: string): boolean {
  const normalized = value.toLowerCase();
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}

