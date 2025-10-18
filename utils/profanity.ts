// Profanity filtering/sanitization utilities for user-generated text.
// Uses leo-profanity plus extra heuristics to catch obfuscated variants.

import leo from 'leo-profanity';

// Initialize dictionary once (en default). Consumers can extend if needed.
leo.clearList();
leo.add(leo.getDictionary('en')); // default English

// Characters that are commonly used to obfuscate profanity
const L33T_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
  '+': 't',
};

// Remove diacritics and normalize unicode (NFKD)
function normalizeBasic(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase();
}

// Collapse repeated characters: cooool -> cool
function collapseRepeats(input: string): string {
  return input.replace(/(.)\1{2,}/g, '$1$1');
}

// Replace common l33t characters with their letter counterparts
function deLeet(input: string): string {
  return input
    .split('')
    .map((ch) => L33T_MAP[ch.toLowerCase()] ?? ch)
    .join('');
}

// Remove non-letters between letters to catch f*ck, f.u.c.k
function stripSeparatorsBetweenLetters(input: string): string {
  return input.replace(/([a-z])[^a-z]+(?=[a-z])/gi, '$1');
}

// Build a normalized text variant for detection
export function buildDetectionText(input: string): string {
  const basic = normalizeBasic(input);
  const deleet = deLeet(basic);
  const collapsed = collapseRepeats(deleet);
  const stripped = stripSeparatorsBetweenLetters(collapsed);
  return stripped;
}

export type ProfanityCheck = {
  isClean: boolean;
  cleaned: string; // leo-profanity cleaned version using * mask, not used for save; just UI hint
  reasons?: string[]; // matched words if available
};

// Check whether a string contains profanity, attempting to catch bypasses.
export function checkProfanity(input: string): ProfanityCheck {
  const candidate = buildDetectionText(input);
  const isProfane = leo.check(candidate);
  if (!isProfane) {
    return { isClean: true, cleaned: input };
  }
  const found = leo.list().filter((w: string) => candidate.includes(w));
  return { isClean: false, cleaned: leo.clean(input), reasons: found.slice(0, 5) };
}

// Validate an event title/description pair; returns error string if blocked.
export function validateEventCopy(title: string, description?: string | null): string | null {
  const titleCheck = checkProfanity(title);
  if (!titleCheck.isClean) return 'Please remove profanity from the title.';
  if (description) {
    const descCheck = checkProfanity(description);
    if (!descCheck.isClean) return 'Please remove profanity from the description.';
  }
  return null;
}
