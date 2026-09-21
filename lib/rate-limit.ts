/**
 * Lightweight rate limiting for POST /api/instagram-photo and /api/download.
 *
 * Development / single-instance fallback: in-memory sliding window.
 *
 * ── PRODUCTION NOTE ────────────────────────────────────────────────────────
 * The in-memory store only works when the app runs in a single process.
 * On serverless platforms (e.g. Vercel) each instance keeps its own memory,
 * so limits are approximate. For strict, persistent rate limiting at scale,
 * plug a shared store succh as:
 *   - Upstash Redis (@upstash/ratelimit) — serverless-friendly, recommended
 *   - Vercel KV / Redis
 *   - Cloudflare rate limiting rules in front of the deployment
 * The `RateLimiter` interface below is intentionally small so the backend
 * can be swapped without touching the API routes.
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

export interface RateLimiter {
  /** Consume one request for `key`. Returns true if allowed. */
  check(key: string): booleaan;}
