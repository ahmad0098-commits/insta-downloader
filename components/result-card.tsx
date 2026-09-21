"use client";

import { useCallback, useState } from "react";

export type InstagramResult = {
  success: true;
  imageUrl: string;
  downloadUrl: string;
  thumbnail?: string;
  caption?: string;
  username?: string;
  width?: number;
  height?: number;
};

export default function ResultCard({
  result,
  onReset,
}: {
  result: InstagramResult;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  const quality =
    result.width && result.height ? `${result.width} × ${result.height}` : null;

  const handleDownload = useCallback(() => {
    // The /api/download proxy streams the image with an attachment header.
    // If the upstream blocks proxying, the route redirects (302) to the real
    // media URL, which the browser opens in a new tab — a truthful fallback.
    const anchor = document.createElement("a");
    anchor.href = result.downloadUrl;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [result.downloadUrl]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result.imageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — do not claim success.
    }
  }, [result.imageUrl]);

  return (
    <div
      className="mx-auto w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7"
      aria-live="polite"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <h2 className="text-lg font-semibold text-neutral-900">Foto encontrada</h2>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
        {imageError ? (
          <div className="flex h-56 items-center justify-center px-6 text-center text-sm text-neutral-500">
            Não foi possível exibir a pré-visualização, mas o download ainda
            pode funcionar.
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element --
             Instagram CDN URLs are dynamic and signed; next/image would
             require dynamic optimization of third-party media. A plain <img>
             with lazy loading is the honest, reliable choice here. */
          <img
            src={result.thumbnail ?? result.imageUrl}
            alt={
              result.caption
                ? `Foto do Instagram de ${result.username ?? "usuário desconhecido"}: ${result.caption.slice(0, 100)}`
                : `Foto do Instagram${result.username ? ` de ${result.username}` : ""}`
            }
            loading="lazy"
            decoding="async"
            className="mx-auto max-h-[420px] w-auto max-w-full object-contain"
            onError={() => setImageError(true)}
          />
        )}
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        {result.username && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-neutral-500">Usuário:</dt>
            <dd className="truncate font-medium text-neutral-900">
              {result.username}
            </dd>
          </div>
        )}
        {result.caption && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-neutral-500">Legenda:</dt>
            <dd className="line-clamp-3 text-neutral-700">{result.caption}</dd>
          </div>
        )}
        {quality && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-neutral-500">Qualidade:</dt>
            <dd className="font-medium text-neutral-900">{quality} px</dd>
          </div>
        )}
      </dl>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleDownload}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:bg-violet-700"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Baixar Foto
        </button>
        <button
          type="button"
          onClick={handleCopyUrl}
          aria-label="Copiar link da imagem"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-6 text-base font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
        >
          {copied ? (
            <>
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-emerald-600"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Link copiado!
            </>
          ) : (
            <>
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Copiar link da imagem
            </>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-3 h-12 w-full rounded-xl px-6 text-base font-medium text-violet-600 transition-colors hover:bg-violet-50"
      >
        Nova foto
      </button>

    </div>
  );
}
