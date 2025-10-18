// Utility helpers for image URL validation/sanitization for events

const HTTP_OR_HTTPS_REGEX = /^https?:\/\//i;
const DATA_URL_IMAGE_REGEX = /^data:image\//i; // allow data:image/*;base64,...

export interface ImageValidationResult {
  cleaned: string[]; // cleaned list (<=3)
  errors: string[]; // human-readable error messages
}

/**
 * Sanitize up to 3 image URLs:
 *  - Trim whitespace
 *  - Deduplicate while preserving first occurrence
 *  - Allow http(s) and data:image/* schemes
 *  - Filter out obviously invalid (no host or no extension-like path) lightly
 */
export function sanitizeEventImageUrls(urls: (string | null | undefined)[]): ImageValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of urls) {
    if (!raw) continue;
    const u = raw.trim();
    if (!u) continue;
    // Accept data:image/* URLs directly and skip URL parsing
    if (DATA_URL_IMAGE_REGEX.test(u)) {
      if (!seen.has(u)) {
        cleaned.push(u);
        seen.add(u);
      }
      if (cleaned.length === 3) break;
      continue;
    }
    if (!HTTP_OR_HTTPS_REGEX.test(u)) {
      errors.push(`Image must use http(s) or data:image/*: ${u}`);
      continue;
    }
    if (seen.has(u)) continue;
    try {
      // Basic URL parsing
      const parsed = new URL(u);
      if (!parsed.hostname) {
        errors.push(`Missing hostname: ${u}`);
        continue;
      }
      // (Optional) Quick heuristic: path should have at least one dot (file-ish) or trailing slash ok
      if (!/\.[a-zA-Z0-9]{2,6}(?:$|[?#])/.test(parsed.pathname) && !parsed.pathname.endsWith('/')) {
        // Not a hard error; could be a CDN path; skip strictness
      }
      cleaned.push(u);
      seen.add(u);
      if (cleaned.length === 3) break; // enforce max 3
    } catch {
      errors.push(`Invalid URL: ${u}`);
    }
  }
  if (urls.filter((u) => !!u && u.trim()).length > 3) {
    errors.push('Only the first 3 image URLs are kept.');
  }
  return { cleaned, errors };
}
