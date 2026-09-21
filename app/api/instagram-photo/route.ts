/**
 * POST /api/instagram-photo
 *
 * Server-side only endpoint that:
 *   1. Rate limits the caller.
 *   2. Validates + sanitizes the Instagram URL (SSRF-safe: only Instagram
 *      post shortcodes are accepted; no arbitrary fetching).
 *   3. Calls the configured Apify Actor (lib/apify.ts) with the server-side
 *      APIFY_API_TOKEN — the token never leaves the server.
 *   4. Parses the dataset and returns the highest-quality public image.
 *
 * Success:
 *   { success: true, imageUrl, downloadUrl, thumbnail?, caption?, username?, width?, height? }
 * Failure:
 *   { success: false, error: "<friendly pt-BR message>" }
 *
 * The client never learns anything about Apify, tokens, or stack traces.
 */

import { NextResponse } from "next/server";
import { validateInstagramUrl } from "@/lib/validation";
import { fetchInstagramMedia } from "@/lib/apify";
import { getClientKey, instagramApiLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Maximum accepted JSON body size in bytes (1 KB is plenty for a URL). */
const MAX_BODY_BYTES = 1024;

/** Friendly pt-BR messages mapped from internal failure reasons. */
const FRIENDLY_ERRORS: Record<string, string> = {
  not_configured:
    "O serviço não está configurado no momento. Tente novamente mais tarde.",
  timeout:
    "O processamento demorou demais. Tente novamente em alguns instantes.",
  network_error:
    "Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.",
  rate_limited:
    "Muitas solicitações. Aguarde um pouco e tente novamente.",
  auth_error:
    "Não foi possível processar sua solicitação. Tente novamente mais tarde.",
  actor_error:
    "Não foi possível encontrar essa foto. Verifique se a publicação é pública e tente novamente.",
  no_results:
    "Não foi possível encontrar essa foto. Verifique se a publicação é pública e tente novamente.",
  no_media:
    "Nenhuma foto pública encontrada.",
};

function friendlyError(reason: string, fallback?: string): string {
  return FRIENDLY_ERRORS[reason] ?? fallback ?? FRIENDLY_ERRORS.actor_error;
}

export async function POST(request: Request) {
  // ── Rate limiting ────────────────────────────────────────────────────────
  if (!instagramApiLimiter.check(getClientKey(request))) {
    return NextResponse.json(
      { success: false, error: FRIENDLY_ERRORS.rate_limited },
      { status: 429 },
    );
  }

  // ── Body size guard ─────────────────────────────────────────────────────
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: "Insira um link válido do Instagram." },
      { status: 413 },
    );
  }

  // ── Parse body safely ─────────────────────────────────────────────────────
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: "Insira um link válido do Instagram." },
        { status: 413 },
      );
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { success: false, error: "Insira um link válido do Instagram." },
      { status: 400 },
    );
  }

  const url = (body as { url?: unknown } | null)?.url;
  const validated = validateInstagramUrl(url);
  if (!validated.ok) {
    return NextResponse.json(
      { success: false, error: validated.error },
      { status: 400 },
    );
  }

  // ── Call Apify (server-side) ────────────────────────────────────────────
  const result = await fetchInstagramMedia(validated.canonicalUrl!);

  if (!result.ok) {
    const status =
      result.reason === "timeout" || result.reason === "network_error" ? 504 : 502;
    return NextResponse.json(
      { success: false, error: friendlyError(result.reason) },
      { status },
    );
  }

  // ── Success: only real fields are returned ───────────────────────────────
  const media = result.media;
  // The download proxy only accepts media URLs this server just produced.
  const downloadUrl = `/api/download?u=${encodeURIComponent(media.imageUrl)}`;

  return NextResponse.json({
    success: true,
    imageUrl: media.imageUrl,
    downloadUrl,
    ...(media.thumbnailUrl ? { thumbnail: media.thumbnailUrl } : {}),
    ...(media.caption ? { caption: media.caption } : {}),
    ...(media.username ? { username: media.username } : {}),
    ...(media.width !== undefined ? { width: media.width } : {}),
    ...(media.height !== undefined ? { height: media.height } : {}),
    ...(media.mediaType ? { mediaType: media.mediaType } : {}),
  });
}

/** Only POST is supported — everything else is a 405. */
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Método não permitido." },
    { status: 405 },
  );
}
