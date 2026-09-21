/**
 * Apify server-side adapter.
 *
 * ⚠️ SERVER ONLY — this module is imported exclusively by API routes under
 * app/api/. It reads APIFY_API_TOKEN from server-side environment variables
 * and NEVER sends the token to the client.
 *
 * ─── WHERE TO PUT THE TOKEN ───────────────────────────────────────────────
 * Create `.env.local` in the project root (see `.env.example`):
 *
 *   APIFY_API_TOKEN=apify_api_XXXXXXXXXXXXXXXX
 *   APIFY_ACTOR_ID=apify/instagram-scraper
 *
 * Get your token at https://apify.com → Settings → Integrations → API token.
 * On Vercel add the same variables under Project → Settings → Environment
 * Variables. Do NOT prefix them with NEXT_PUBLIC_.
 *
 * ─── HOW TO CHANGE THE ACTOR ───────────────────────────────────────────────
 * Set APIFY_ACTOR_ID to any Actor ID (owner/name) that:
 *   1. Accepts input containing a list of Instagram post URLs, and
 *   2. Produces a dataset whose items describe the fetched media
 *      (image URLs, optional author/username, caption, dimensions…).
 *
 * The default input below targets the official `apify/instagram-scraper`
 * Actor. If you switch Actors, only `buildActorInput()` and (if the output
 * shape differs) `lib/instagram-parser.ts` need adjustments — the rest of
 * the app is Actor-agnostic.
 *
 * ─── EXPECTED ACTOR INPUT (default: apify/instagram-scraper) ───────────────
 * {
 *   "directUrls":   ["https://www.instagram.com/p/SHORTCODE/"],
 *   "resultsType":  "posts",
 *   "resultsLimit": 1
 * }
 *
 * ─── EXPECTED ACTOR OUTPUT (dataset items, simplified) ─────────────────────
 * [
 *   {
 *     "shortCode": "SHORTCODE",
 *     "displayUrl": "https://scontent...cdninstagram.com/...jpg",
 *     "thumbnailUrl": "https://...jpg",
 *     "images": { "low": "...", "standard": "...", "high": "..." },
 *     "videoUrl": "https://...mp4" | null,
 *     "caption": "#caption text…",
 *     "ownerUsername": "some_user",
 *     "dimensions": { "width": 1080, "height": 1080 },
 *     "isVideo": false
 *   }
 * ]
 *
 * Parsing is intentionally tolerant: `lib/instagram-parser.ts` normalizes
 * many common shapes so small Actor differences do not break the app.
 *
 * ─── HOW TO TEST LOCALLY ────────────────────────────────────────────────────
 *   npm install
 *   cp .env.example .env.local   # then paste your token
 *   npm run dev                  # http://localhost:3000
 * Then paste a public Instagram post URL into the tool.
 */

import { parseInstagramMedia, type InstagramMedia } from "./instagram-parser";

const APIFY_API_BASE = "https://api.apify.com/v2";

/** Default Actor when APIFY_ACTOR_ID is not set (official public scraper). */
export const DEFAULT_ACTOR_ID = "apify/instagram-scraper";

/** Actor run timeout in milliseconds. */
const ACTOR_TIMEOUT_MS = 90_000;

/** Maximum bytes we are willing to read from the dataset response. */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024; // 8 MB

/** Structured result handed back to the API route. */
export type ApifyFetchResult =
  | { ok: true; media: InstagramMedia }
  | { ok: false; reason: string; httpStatus?: number };

/**
 * Build the input payload for the configured Actor.
 * If you switch to another Actor, adapt this function to its input schema.
 */
function buildActorInput(postUrl: string): Record<string, unknown> {
  return {
    // Direct URLs of public Instagram posts/reels to scrape.
    directUrls: [postUrl],
    // We only want post results.
    resultsType: "posts",
    // One URL → at most one result.
    resultsLimit: 1,
    // Speed things up: we do not need comments.
    addParentData: false,
  };
}

/** Simple typed fetch with timeout + AbortController. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs: number },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run the configured Apify Actor for one public Instagram post URL and
 * parse the first usable media item from its dataset.
 *
 * Uses the synchronous "run-sync-get-dataset-items" endpoint: Apify starts
 * the Actor run, waits for it to finish and returns the default dataset
 * items in a single HTTP response. No polling required.
 */
export async function fetchInstagramMedia(
  canonicalPostUrl: string,
): Promise<ApifyFetchResult> {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_ACTOR_ID?.trim() || DEFAULT_ACTOR_ID;

  if (!token) {
    // Misconfiguration — never leak details, but log server-side.
    console.error("[apify] APIFY_API_TOKEN is not configured.");
    return { ok: false, reason: "not_configured", httpStatus: 503 };
  }

  // Defensive: the actorId must look like an Apify Actor reference
  // (owner/name or numeric id) to avoid building a strange URL.
  if (!/^[A-Za-z0-9_-]+(?:~|\/)[A-Za-z0-9_-]+$|^\d+$/.test(actorId)) {
    console.error("[apify] Invalid APIFY_ACTOR_ID configured.");
    return { ok: false, reason: "not_configured", httpStatus: 503 };
  }

  // `~` actor references work directly in the URL; `owner/name` is encoded.
  const actorPath = actorId.includes("/") ? actorId.replace(/\//g, "~") : actorId;
  const endpoint =
    `${APIFY_API_BASE}/acts/${encodeURIComponent(actorPath)}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(token)}&timeout=${Math.round(ACTOR_TIMEOUT_MS / 1000)}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildActorInput(canonicalPostUrl)),
      timeoutMs: ACTOR_TIMEOUT_MS + 10_000, // network slack on top of Actor timeout
      cache: "no-store",
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    console.error("[apify] Request failed:", aborted ? "timeout" : err);
    return { ok: false, reason: aborted ? "timeout" : "network_error" };
  }

  if (response.status === 429) {
    return { ok: false, reason: "rate_limited", httpStatus: 429 };
  }
  if (response.status === 401 || response.status === 403) {
    console.error("[apify] Authentication failed — check APIFY_API_TOKEN.");
    return { ok: false, reason: "auth_error", httpStatus: 502 };
  }
  if (!response.ok) {
    console.error("[apify] Actor run failed with HTTP", response.status);
    return { ok: false, reason: "actor_error", httpStatus: 502 };
  }

  // Read + size-cap the dataset payload.
  const raw = await response.text();
  if (raw.length > MAX_RESPONSE_BYTES) {
    console.error("[apify] Dataset payload too large.");
    return { ok: false, reason: "actor_error", httpStatus: 502 };
  }

  let items: unknown;
  try {
    items = JSON.parse(raw);
  } catch {
    console.error("[apify] Dataset response was not valid JSON.");
    return { ok: false, reason: "actor_error", httpStatus: 502 };
  }
  if (!Array.isArray(items)) {
    console.error("[apify] Dataset response is not an array.");
    return { ok: false, reason: "no_results" };
  }

  const media = parseInstagramMedia(items);
  if (!media) {
    return { ok: false, reason: "no_media" };
  }
  return { ok: true, media };
}
