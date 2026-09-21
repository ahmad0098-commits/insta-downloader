/**
 * Instagram media parser.
 *
 * Normalizes dataset items coming from an Apify Instagram Actor into the
 * small internal shape the app needs. The parser is deliberately tolerant
 * to different Actor output schemas (field names vary between Actors and
 * Actor versions) so the Actor can be swapped via APIFY_ACTOR_ID without
 * rewriting the application.
 *
 * Only fields that actually exist in the Actor output are returned —
 * the parser never invents data.
 */

export type InstagramMedia = {
  /** Highest-quality publicly available image URL (absolute https). */
  imageUrl: string;
  /** Smaller preview image, if the Actor provides one. */
  thumbnailUrl?: string;
  /** Post caption, if available. */
  caption?: string;
  /** Author username, if available. */
  username?: string;
  /** Image dimensions, if the Actor reports them. */
  width?: number;
  height?: number;
  /** Media type reported by the Actor ("image" | "video" | "carousel"). */
  mediaType?: string;
};

const HTTPS_URL_RE = /^https:\/\//i;

/** Instagram *page* URLs (posts/profiles) — never actual image files. */
const INSTAGRAM_PAGE_URL_RE =
  /^https:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\//i;

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function asPositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return parseInt(value, 10);
  }
  return undefined;
}

function isHttpUrl(value: string | undefined): value is string {
  return typeof value === "string" && HTTPS_URL_RE.test(value);
}

/**
 * Collect candidate image URLs from one dataset item, best-first.
 * Covers common field names across Instagram Actors:
 *  - images: { low, thumbnail, standard, high } (apify/instagram-scraper)
 *  - displayUrl / display_url / thumbnailUrl / thumbnail / imageUrl / url
 *  - media[] / carouselMedia[] / edge_sidecar_to_children arrays
 *  - edge_media_to_caption / caption strings
 */
function collectImageCandidates(item: Record<string, unknown>): string[] {
  const candidates: string[] = [];

  const push = (value: unknown) => {
    const str = asString(value);
    if (isHttpUrl(str) && !INSTAGRAM_PAGE_URL_RE.test(str)) candidates.push(str);
  };

  // images object with quality keys — ordered best → worst.
  const images = item.images;
  if (images && typeof images === "object" && !Array.isArray(images)) {
    const obj = images as Record<string, unknown>;
    for (const key of ["high", "standard", "medium", "low", "thumbnail"]) {
      push(obj[key]);
    }
  }

  // Direct single-URL fields, roughly best → worst.
  for (const key of [
    "displayUrl",
    "display_url",
    "imageUrl",
    "image_url",
    "mainUrl",
    "thumbnailUrl",
    "thumbnail_url",
    "thumbnail",
    "thumbnailSrc",
    "url",
  ]) {
    push(item[key]);
  }

  // Nested media arrays (carousels / child media).
  for (const key of ["media", "carouselMedia", "carousel_media", "children", "edges"]) {
    const arr = item[key];
    if (Array.isArray(arr)) {
      for (const child of arr) {
        if (child && typeof child === "object") {
          const childObj = child as Record<string, unknown>;
          // GraphQL-style edges wrap the node in `node`.
          const node = (childObj.node ?? childObj) as Record<string, unknown>;
          const nested = collectImageCandidates(node);
          candidates.push(...nested);
        }
      }
    }
  }

  // GraphQL-style display_url under display_resource.
  const dr = item.display_resource;
  if (Array.isArray(dr)) {
    for (const entry of dr) {
      if (entry && typeof entry === "object") {
        push((entry as Record<string, unknown>).src);
      }
    }
  }

  return candidates;
}

function extractCaption(item: Record<string, unknown>): string | undefined {
  const direct = asString(item.caption);
  if (direct) return direct;

  const edge = item.edge_media_to_caption;
  if (edge && typeof edge === "object") {
    const edges = (edge as Record<string, unknown>).edges;
    if (Array.isArray(edges) && edges.length > 0) {
      const node = (edges[0] as Record<string, unknown>).node;
      if (node && typeof node === "object") {
        return asString((node as Record<string, unknown>).text);
      }
    }
  }

  const cap = item.captionText ?? item.text ?? item.title;
  return asString(cap);
}

function extractUsername(item: Record<string, unknown>): string | undefined {
  const direct =
    asString(item.ownerUsername) ??
    asString(item.username) ??
    asString(item.author) ??
    asString(item.owner_username);
  if (direct) return direct;

  const owner = item.owner;
  if (owner && typeof owner === "object" && !Array.isArray(owner)) {
    return asString((owner as Record<string, unknown>).username);
  }
  return undefined;
}

function extractDimensions(item: Record<string, unknown>): {
  width?: number;
  height?: number;
} {
  const dim = item.dimensions;
  if (dim && typeof dim === "object") {
    const obj = dim as Record<string, unknown>;
    return { width: asPositiveInt(obj.width), height: asPositiveInt(obj.height) };
  }
  const width = asPositiveInt(item.width ?? item.displayWidth);
  const height = asPositiveInt(item.height ?? item.displayHeight);
  return { width, height };
}

function extractMediaType(item: Record<string, unknown>): string | undefined {
  if (item.isVideo === true || item.is_video === true) return "video";
  const type = asString(item.type ?? item.mediaType ?? item.__typename);
  if (type) {
    const lower = type.toLowerCase();
    if (lower.includes("video")) return "video";
    if (lower.includes("carousel") || lower.includes("sidecar")) return "carousel";
    if (lower.includes("image") || lower.includes("graphimage")) return "image";
    return lower;
  }
  return undefined;
}

/**
 * Handle the easyapi/instagram-photos-downloader item shape directly:
 *   { url, result: { author, title, thumbnail, medias: [{ url, width,
 *      height, type, resolution }] } }
 * Picks the highest-resolution image media. Returns null when the item does
 * not match this shape (the generic parser handles those) or when only
 * non-image media exists.
 */
function parseEasyApiMedia(item: Record<string, unknown>): InstagramMedia | null {
  // Unwrap { url, result: {...} } envelope.
  const inner =
    item.result && typeof item.result === "object" && !Array.isArray(item.result)
      ? (item.result as Record<string, unknown>)
      : item;

  // Actor-reported failure (post not found, deleted, private…).
  if (inner.error === true) return null;

  const medias = inner.medias;
  if (!Array.isArray(medias)) return null;

  const imageMedias: { url: string; width?: number; height?: number }[] = [];
  for (const m of medias) {
    if (!m || typeof m !== "object" || Array.isArray(m)) continue;
    const obj = m as Record<string, unknown>;
    const type = asString(obj.type);
    // Only actual images; skip videos/other media types.
    if (type && !type.toLowerCase().includes("image")) continue;
    const url = asString(obj.url);
    if (!isHttpUrl(url)) continue;
    imageMedias.push({
      url,
      width: asPositiveInt(obj.width),
      height: asPositiveInt(obj.height),
    });
  }
  if (imageMedias.length === 0) return null;

  // Highest resolution first.
  imageMedias.sort(
    (a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0),
  );
  const best = imageMedias[0];

  const thumbnail = collectImageCandidates({ thumbnail: inner.thumbnail })[0];
  const caption = extractCaption(inner);
  const username = extractUsername(inner);

  return {
    imageUrl: best.url,
    ...(thumbnail && thumbnail !== best.url ? { thumbnailUrl: thumbnail } : {}),
    ...(caption ? { caption } : {}),
    ...(username ? { username } : {}),
    ...(best.width !== undefined ? { width: best.width } : {}),
    ...(best.height !== undefined ? { height: best.height } : {}),
    mediaType: "image",
  };
}

/**
 * Find the first dataset item that yields at least one usable public image
 * URL and return the normalized media. Returns null when nothing usable
 * exists (private/deleted post, video-only result, empty dataset…).
 */
export function parseInstagramMedia(
  datasetItems: unknown[],
): InstagramMedia | null {
  for (const entry of datasetItems) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;

    // easyapi/instagram-photos-downloader shape (author/title/medias).
    const easyApiMedia = parseEasyApiMedia(item);
    if (easyApiMedia) return easyApiMedia;

    // Skip Actor-reported failures (post not found, private, deleted…) —
    // never let the wrapped { url, result: { error: true } } envelope fall
    // through to the generic parser.
    const result = item.result;
    if (
      result &&
      typeof result === "object" &&
      !Array.isArray(result) &&
      (result as Record<string, unknown>).error === true
    ) {
      continue;
    }

    const imageUrl = collectImageCandidates(item).find((url) =>
      // Only https CDN URLs are usable; drop anything else defensively.
      isHttpUrl(url),
    );
    if (!imageUrl) continue;

    const { width, height } = extractDimensions(item);
    const caption = extractCaption(item);
    const username = extractUsername(item);
    const thumbnail = collectImageCandidates(item).find(
      (url) => url !== imageUrl,
    );
    const mediaType = extractMediaType(item);

    return {
      imageUrl,
      // Only set a thumbnail when it is genuinely different from imageUrl.
      ...(thumbnail ? { thumbnailUrl: thumbnail } : {}),
      ...(caption ? { caption } : {}),
      ...(username ? { username } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(mediaType ? { mediaType } : {}),
    };
  }
  return null;
}
