/**
 * Lightweight rate limiting for POST /api/instagram-photo and /api/download.
 *
 * Development / single-instance fallback: in-memory sliding window.
 *
 * ── PRODUCTION NOTE ───────────────────────────────────────────────────────────────
 * The in-memory store only works when the app runs in a single process.
 * On serverless platforms (e.g. Vercel) each instance keeps its own memory,
 * so limits are approximate. For strict, persistent rate limiting at scale,
 * plug a shared store such as:
 *   - Upstash Redis (@upstash/ratelimit) — serverless-friendly, recommended
 *   - Vercel KV / Redis
 *   - Cloudflare rate limiting rules in front of the deployment
 * The `RateLimiter` interface below is intentionally small so the backend
 * can be swapped without touching the API routes.
 * ────────────────────────────────────────────────────────────────────────────────────
 */

export interface RateLimiter {
  /** Consume one request for `key`. Returns true if allowed. */
  check(key: string): boolean;
}

type WindowState = { count: number; resetAt: number };

export class InMemoryRateLimiter implements RateLimiter {
  private windows = new Map<string, WindowState>();

  constructor(
    /** Max requests per window per key. */
    private readonly max: number,
    /** Window length in milliseconds. */
    private readonly windowMs: number,
    /** Max distinct keys tracked before sweeping (abuse protection). */
    private readonly maxKeys = 10_000,
  ) {}

  check(key: string): boolean {
    const now = Date.now();

    // Periodic sweep to keep memory bounded.
    if (this.windows.size > this.maxKeys) {
      for (const [k, w] of this.windows) {
        if (w.resetAt <= now) this.windows.delete(k);
      }
      if (this.windows.size > this.maxKeys) {
        // Still too large (abuse): drop the oldest entry defensively.
        const oldest = this.windows.keys().next().value;
        if (oldest !== undefined) this.windows.delete(oldest);
      }
    }

    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (current.count >= this.max) {
      return false;
    }
    current.count += 1;
    return true;
  }
}

/**
 * Best-effort client identity for rate limiting.
 * Prefers proxy headers commonly set by Vercel/CDNs; falls back to a stable
 * placeholder when no IP is available (e.g. local dev).
 */
export function getClientKey(request: Request): string {
  const fwd =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip");
  const ip = fwd?.split(",")[0]?.trim();
  return ip && ip.length > 0 ? ip : "anonymous";
}

/** Shared limiter: 10 requests per minute per IP for the main API. */
export const instagramApiLimiter = new InMemoryRateLimiter(10, 60_000);

/** Shared limiter: 30 requests per minute per IP for the download proxy. */
export const downloadLimiter = new InMemoryRateLimiter(30, 60_000);
