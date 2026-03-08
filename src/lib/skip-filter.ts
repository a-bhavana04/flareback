/**
 * Pre-filter: skip obvious noise before sending to AI.
 * Saves AI calls and prevents junk from entering the DB.
 */

const MIN_SUBSTANTIVE_LENGTH = 25;

// Short reactions that are almost never substantive feedback (case-insensitive)
// Content that is ONLY one of these (with optional punctuation) gets skipped
const NOISE_PHRASES = [
  'oh totally',
  'totally',
  'lol',
  'lmao',
  'same',
  'same here',
  'nice',
  'cool',
  'thanks',
  'thank you',
  'agree',
  'agreed',
  'yes',
  'no',
  'true',
  'facts',
  'based',
  'fr',
  'real',
  'literally',
  'literally this',
  'mood',
  'rip',
  'oof',
  'yikes',
  'damn',
  'wtf',
  'smh',
  'imo',
  'imho',
  'tbh',
  'ngl',
  'fire',
  'gg',
  'wp',
  'ez',
  'ok',
  'okay',
  'k',
  'kk',
  'yep',
  'nope',
  'yeah',
  'nah',
  'idk',
  'lgtm',
  'sounds good',
  'looks good',
  'ship it',
  'this',
  'that',
  'it',
  'same',
  'ditto',
  'seconded',
  'thirded',
  '+1',
  '++',
  '^',
  '^^',
  '^^^',
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?+^\-]/g, '')
    .trim();
}

export function shouldSkipContent(title: string | undefined, body: string | undefined): boolean {
  const combined = `${title || ''} ${body || ''}`.trim();
  if (combined.length < MIN_SUBSTANTIVE_LENGTH) {
    return true;
  }

  const normalized = normalize(combined);
  if (normalized.length < MIN_SUBSTANTIVE_LENGTH) {
    return true;
  }

  // Exact match: content is ONLY this phrase (with optional punctuation)
  for (const phrase of NOISE_PHRASES) {
    const n = normalize(phrase);
    if (n.length < 2) continue;
    const exactMatch =
      normalized === n ||
      normalized === n + '.' ||
      normalized === n + '!' ||
      normalized === n + '?';
    if (exactMatch) return true;
  }

  return false;
}
