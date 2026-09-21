/**
 * GET /api/download?u=<imageUrl>
 *
 * Secure server-side media proxy for the download experience.
 *
 * Security contract:
 *  - `u` MUST be an https URL on a known Instagram/Facebook CDN host.
 *    This is NOT an open proxy: arbitrary external URLs are rejected.
 *  - Only URLs that the server itself produced (via the Apify Actor result)
 *    point here; the proxy re-validates every request anyway.
 *  - Rate limited; streams the response with `Content-Disposition:
 *    attachment; filename="instagram-foto.jpg"` so browsers save the file.
 *  - If the upstream refuses proxying (some CDN URLs are signed/locked to
 *    referrer or expire quickly), we respond with 302 to the original URL —
 *    the client then opens the real media URL in a new tab (truthful
 *    fallback, never a fake "download succeeded").
 */

import { NextResponse } from "next/server";
import { downloadLimiter, getClientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CDN hosts that Instagram media URLs legitimately live on. */
const ALLOWED_CDN_HOST_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
];

/** Hard cap on proxied media size (safety net). */
const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25 MB

/** Timeout for the upstream fetch. */
const UPSTREAM_TIMEOUT_MS = 30_000;

function isAllowedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_CDN_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

function guessExtension(contentType: string | null): string {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "jpg";
}

export async function GET(request: Request) {
  // ── Rate limiting ───────────────────────────────────────────────────────
  if (!downloadLimiter.check(getClientKey(request))) {
    return NextResponse.json(
      { success: false, error: "Muitas solicitações. Aguarde um pouco e tente novamente." },
      { status: 429 },
    );
  }

  // ── Validate the target URL (SSRF guard) ──────────────────────────────────
  const target = new URL(request.url).searchParams.get("u");
  if (!target) {
    return NextResponse.json(
      { success: false, error: "Solicitação inválida." },
      { status: 400 },
    );
  }

  let mediaUrl: URL;
  try {
    mediaUrl = new URL(target);
  } catch {
    return NextResponse.json(
      { success: false, error: "Solicitação inválida." },
      { status: 400 },
    );
  }

  if (mediaUrl.protocol !== "https:" || !isAllowedMediaHost(mediaUrl.hostname)) {
    return NextResponse.json(
      { success: false, error: "Solicitação inválida." },
      { status: 400 },
    );
  }

  // ── Fetch upstream media ────────────────────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(mediaUrl.toString(), {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        // Some signed CDN URLs validate the Referer; presenting the
        // Instagram origin maximizes compatibility without impersonation.
        Referer: "https://www.instagram.com/",
        "User-Agent":
          "Mozilla/5.0 (compatible; InstagramPhotoDownloader/1.0)",
      },
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === "AbortError";
    // Graceful truthful fallback: hand the real URL to the browser.
    if (!aborted) {
      return NextResponse.redirect(mediaUrl.toString(), 302);
    }
    return NextResponse.json(
      { success: false, error: "Não foi possível baixar a imagem. Tente novamente." },
      { status: 504 },
    );
  }
  clearTimeout(timer);

  if (!upstream.ok || !upstream.body) {
    // Truthful fallback: open the actual media URL instead of faking success.
    return NextResponse.redirect(mediaUrl.toString(), 302);
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return NextResponse.redirect(mediaUrl.toString(), 302);
  }

  const declaredLength = Number(upstream.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_MEDIA_BYTES) {
    return NextResponse.json(
      { success: false, error: "O arquivo é grande demais para ser baixado." },
      { status: 413 },
    );
  }

  const filename = `instagram-foto.${guessExtension(contentType)}`;

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      ...(declaredLength > 0 ? { "Content-Length": String(declaredLength) } : {}),
    },
  });
}
