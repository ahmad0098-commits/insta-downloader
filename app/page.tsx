import type { Metadata } from "next";
import InstagramDownloader from "@/components/instagram-downloader";
import Faq from "@/components/faq";

export const metadata: Metadata = {
  title: "Baixar Foto do Instagram Online Grátis",
  description:
    "Baixe fotos públicas do Instagram em alta qualidade. Cole o link da publicação e faça o download da imagem de forma rápida e fácil.",
};

/** Structured data (FAQPage) — helps search engines understand the FAQ. */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Posso baixar qualquer foto do Instagram?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Você pode baixar fotos de publicações públicas do Instagram. Publicações de contas privadas, stories e conteúdo restrito não são suportados.",
      },
    },
    {
      "@type": "Question",
      name: "O download funciona no celular?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim. A ferramenta funciona no navegador do celular (iPhone e Android), sem necessidade de instalar aplicativos.",
      },
    },
    {
      "@type": "Question",
      name: "Preciso instalar algum aplicativo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Não. Tudo funciona diretamente no navegador: basta copiar o link da publicação, colar no campo e clicar em “Baixar Foto”.",
      },
    },
    {
      "@type": "Question",
      name: "O download funciona com contas privadas?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Não. Apenas conteúdo público é suportado. Se a publicação pertencer a uma conta privada, não será possível encontrar a foto.",
      },
    },
    {
      "@type": "Question",
      name: "O serviço é gratuito?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim, a ferramenta é gratuita para uso pessoal.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Reserved area for a future top advertising slot (kept separate from
          the tool so ads never interfere with functionality). */}
      <div
        aria-hidden="true"
        className="mx-auto hidden h-[90px] w-full max-w-5xl items-center justify-center text-xs text-neutral-300 lg:flex"
      />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="px-4 pb-10 pt-16 sm:pt-24">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
            Baixar Foto do Instagram
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-neutral-600">
            Baixe fotos públicas do Instagram em alta qualidade de forma
            rápida e fácil.
          </p>

          {/* ── Downloader (the primary focus) ─────────────────────────── */}
          <div className="mt-10">
            <InstagramDownloader />
          </div>
        </div>
      </section>

      {/* Reserved area for a future in-content advertising slot. */}
      <div
        aria-hidden="true"
        className="mx-auto hidden h-[90px] w-full max-w-3xl items-center justify-center text-xs text-neutral-300 lg:flex"
      />

      {/* ── SEO CONTENT ────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-100 px-4 py-14">
        <div className="mx-auto w-full max-w-3xl space-y-12">
          <article>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Como baixar uma foto do Instagram?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              Baixar imagem do Instagram é simples e leva menos de um minuto.
              Siga os passos abaixo:
            </p>
            <ol className="mt-6 space-y-4">
              {[
                "Copie o link da publicação pública do Instagram.",
                "Cole o link no campo acima.",
                "Clique em “Baixar Foto”.",
                "Aguarde o processamento.",
                "Baixe a imagem encontrada.",
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-semibold text-violet-600">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-base leading-relaxed text-neutral-700">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </article>

          <article>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Como usar o Baixar Foto do Instagram
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              O Baixar Foto do Instagram é um downloader de fotos do Instagram
              que funciona direto no navegador, sem instalar aplicativos.
              Você só precisa do link da publicação: a ferramenta busca a
              imagem original da foto pública e disponibiliza o download em
              alta qualidade. Também é possível copiar o link direto da
              imagem, caso prefira compartilhar ou abrir em outra aba. A
              ferramenta respeita a privacidade do Instagram: apenas
              publicações públicas são suportadas.
            </p>
          </article>

          {/* Reserved area for a future pre-FAQ advertising slot. */}
          <div
            aria-hidden="true"
            className="hidden h-[90px] items-center justify-center text-xs text-neutral-300 lg:flex"
          />
        </div>
      </section>

      <section className="border-t border-neutral-100 px-4 py-14">
        <Faq />
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-neutral-100 px-4 py-8">
        <p className="mx-auto max-w-3xl text-center text-sm text-neutral-500">
          Baixar Foto do Instagram — ferramenta para download de fotos públicas.
          Não afiliado ao Instagram ou à Meta Platforms, Inc.
        </p>
      </footer>
    </main>
  );
}
