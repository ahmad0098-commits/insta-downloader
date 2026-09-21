"use client";

import { useCallback, useRef, useState } from "react";
import ResultCard, { type InstagramResult } from "./result-card";

type Status = "idle" | "loading" | "result" | "error";

/** Client-side URL pre-check — mirrors lib/validation.ts patterns. */
const INSTAGRAM_URL_RE =
  /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|reels|tv)\/[A-Za-z0-9_-]{5,32}\/?(\?.*)?$/i;

function isValidInstagramUrl(url: string): boolean {
  if (!url.trim()) return false;
  const candidate = /^https?:\/\//i.test(url.trim())
    ? url.trim()
    : `https://${url.trim()}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.username || parsed.password) return false;
    return INSTAGRAM_URL_RE.test(parsed.toString());
  } catch {
    return false;
  }
}

export default function InstagramDownloader() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InstagramResult | null>(null);
  const [pasteOk, setPasteOk] = useState(false);
  const inFlight = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setUrl("");
    setResult(null);
    setError(null);
    setStatus("idle");
    setPasteOk(false);
    inFlight.current = false;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrl(text.trim());
        setPasteOk(true);
        setTimeout(() => setPasteOk(false), 2000);
        setError(null);
      }
    } catch {
      // Clipboard unavailable/denied — focus input so the user can paste manually.
      inputRef.current?.focus();
    }
  }, []);

  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (inFlight.current) return; // prevent duplicate requests

      setError(null);
      setResult(null);

      if (!url.trim()) {
        setStatus("error");
        setError("Cole o link da publicação do Instagram.");
        return;
      }
      if (!isValidInstagramUrl(url)) {
        setStatus("error");
        setError("Insira um link válido do Instagram.");
        return;
      }

      inFlight.current = true;
      setStatus("loading");

      try {
        const response = await fetch("/api/instagram-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        const data = await response.json();

        if (data?.success && data?.imageUrl) {
          setResult(data as InstagramResult);
          setStatus("result");
        } else {
          setStatus("error");
          setError(
            data?.error ??
              "Não foi possível encontrar essa foto. Verifique se a publicação é pública e tente novamente.",
          );
        }
      } catch {
        setStatus("error");
        setError(
          "Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.",
        );
      } finally {
        inFlight.current = false;
      }
    },
    [url],
  );

  // ── Result state ──────────────────────────────────────────────────────────
  if (status === "result" && result) {
    return <ResultCard result={result} onReset={reset} />;
  }

  // ── Form (idle / loading / error) ─────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7"
      noValidate
    >
      <label htmlFor="instagram-url" className="sr-only">
        Link da publicação do Instagram
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id="instagram-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Cole o link da foto do Instagram aqui"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) {
                setError(null);
                if (status === "error") setStatus("idle");
              }
            }}
            disabled={status === "loading"}
            aria-invalid={status === "error"}
            aria-describedby="download-note"
            className="h-14 w-full rounded-xl border border-neutral-300 bg-white pl-4 pr-12 text-base text-neutral-900 placeholder:text-neutral-400 transition-colors hover:border-neutral-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-neutral-50 disabled:text-neutral-400"
          />
          <button
            type="button"
            onClick={handlePaste}
            disabled={status === "loading"}
            aria-label="Colar link da área de transferência"
            title="Colar"
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-violet-50 hover:text-violet-600 focus-visible:bg-violet-50 focus-visible:text-violet-600"
          >
            {/* clipboard icon */}
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
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            </svg>
          </button>
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="flex h-14 items-center justify-center gap-2 rounded-xl bg-violet-600 px-7 text-base font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-400"
        >
          {status === "loading" ? (
            <>
              <svg
                aria-hidden="true"
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Processando...
            </>
          ) : (
            "Baixar Foto"
          )}
        </button>
      </div>

      {pasteOk && (
        <p className="mt-2 text-sm font-medium text-violet-600" role="status">
          Link colado!
        </p>
      )}

      {status === "loading" && (
        <p
          className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-violet-600"
          role="status"
          aria-live="polite"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Encontrando sua foto...
        </p>
      )}

      {status === "error" && error && (
        <p
          className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      )}

      <p
        id="download-note"
        className="mt-4 flex items-center justify-center gap-1.5 text-center text-sm text-neutral-500"
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Funciona com publicações públicas do Instagram.
      </p>
    </form>
  );
}
