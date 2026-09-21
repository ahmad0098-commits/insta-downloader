/**
 * Instagram URL validation & sanitization (server + client safe).
 *
 * Only publicly accessible Instagram post/reel URLs are accepted:
 *   https://www.instagram.com/p/CODE/
 *   https://instagram.com/p/CODE/
 *   https://www.instagram.com/reel/CODE/
 *   https://www.instagram.com/reels/CODE/
 *   https://www.instagram.com/tv/CODE/          (legacy)
 *
 * Everything else (profiles, stories, DMs, arbitrary URLs, localhost,
 * internal IPs, etc.) is rejected BEFORE any request is made. This is also
 * the SSRF guard: we never fetch a URL the user chooses freely — only the
 * shortcode is forwarded to the Apify Actor.
 */

/** Allowed Instagram hostnames (exact match, optionally with "www." prefix). */
const ALLOWED_HOSTS = new Set(["instagram.com", "instagr.am", "ddinstagram.com"]);

/** Path prefixes that represent public, single media posts. */
const ALLOWED_PATH_PREFIXES = ["/p/", "/reel/", "/reels/", "/tv/"];

/** Instagram shortcode alphabet. */
const SHORTCODE_RE = /^[A-Za-z0-9_-]{5,32}$/;

export type InstagramUrlInfo = {
  ok: boolean;
  /** The shortcode, e.g. "CxYzAbCdEfG" for /p/CxYzAbCdEfG/ */
  shortcode?: string;
  /** Canonical https://www.instagram.com/p/<code>/ URL */
  canonicalUrl?: string;
  /** Media kind guessed from the path */
  kind?: "post" | "reel";
  /** User-facing Brazilian Portuguese error reason */
  error?: string;
};

/**
 * Validate and parse an Instagram public post URL.
 * Returns `{ ok: true, shortcode, canonicalUrl, kind }` or `{ ok: false, error }`.
 */
export function validateInstagramUrl(rawInput: unknown): InstagramUrlInfo {
  if (typeof rawInput !== "string") {
    return { ok: false, error: "Insira um link válido do Instagram." };
  }

  const input = rawInput.trim();
  if (input.length === 0) {
    return { ok: false, error: "Cole o link da publicação do Instagram." };
  }
  // Hard cap input size (abuse protection).
  if (input.length > 2048) {
    return { ok: false, error: "Insira um link válido do Instagram." };
  }

  let url: URL;
  try {
    // Only absolute http(s) URLs are accepted. If the user pasted
    // "instagram.com/p/XXX" without scheme, we tentatively prepend https:// —
    // validation below still applies strictly.
    const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "Insira um link válido do Instagram." };
  }

  // Protocol check — block anything that is not plain https (or http for
  // lenient pasting, normalized to https afterwards).
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Insira um link válido do Instagram." };
  }

  // Hostname allowlist (SSRF guard). Exact match or "www." subdomain only —
  // subdomains like evil.instagram.com.attacker.tld cannot pass because we
  // compare the full hostname.
  const host = url.hostname.toLowerCase();
  const hostOk =
    ALLOWED_HOSTS.has(host) ||
    (host.startsWith("www.") && ALLOWED_HOSTS.has(host.slice(4)));
  if (!hostOk) {
    return { ok: false, error: "Insira um link válido do Instagram." };
  }

  // Path check: must be /p/, /reel/, /reels/ or /tv/ followed by a shortcode.
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return { ok: false, error: "Insira um link válido do Instagram." };
  }
  const prefix = `/${segments[0]}/`;
  if (!ALLOWED_PATH_PREFIXES.includes(prefix)) {
    return { ok: false, error: "Insira um link válido do Instagram." };
  }

  const shortcode = segments[1];
  if (!SHORTCODE_RE.test(shortcode)) {
    return { ok: false, error: "Insira um link válido do Instagram." };
  }

  // Reject credentials in URL (e.g. user:pass@instagram.com) — never needed.
  if (url.username || url.password) {
    return { ok: false, error: "Insira um link válido do Instagram." };
  }

  const kind: "post" | "reel" = prefix === "/reel/" || prefix === "/reels/" ? "reel" : "post";
  const canonicalPath = kind === "reel" ? `/reel/${shortcode}/` : `/p/${shortcode}/`;

  return {
    ok: true,
    shortcode,
    canonicalUrl: `https://www.instagram.com${canonicalPath}`,
    kind,
  };
}
