const FAQS = [
  {
    q: "Posso baixar qualquer foto do Instagram?",
    a: "Você pode baixar fotos de publicações públicas do Instagram. Publicações de contas privadas, stories e conteúdo restrito não são suportados, pois respeitamos a privacidade dos usuários e os termos da plataforma.",
  },
  {
    q: "O download funciona no celular?",
    a: "Sim. A ferramenta funciona no navegador do celular (iPhone e Android), sem necessidade de instalar aplicativos. No iPhone, a imagem geralmente é aberta em uma nova aba; mantenha o dedo sobre a imagem e toque em “Salvar nas Fotos”, se preferir.",
  },
  {
    q: "Preciso instalar algum aplicativo?",
    a: "Não. Tudo funciona diretamente no navegador: basta copiar o link da publicação, colar no campo acima e clicar em “Baixar Foto”.",
  },
  {
    q: "O download funciona com contas privadas?",
    a: "Não. Apenas conteúdo público é suportado. Se a publicação pertencer a uma conta privada, não será possível encontrar a foto.",
  },
  {
    q: "O serviço é gratuito?",
    a: "Sim, a ferramenta é gratuita para uso pessoal. Basta colar o link da publicação pública e baixar a imagem.",
  },
] as const;

export default function Faq() {
  return (
    <section aria-labelledby="faq-heading" className="mx-auto w-full max-w-3xl">
      <h2
        id="faq-heading"
        className="text-center text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl"
      >
        Perguntas frequentes
      </h2>
      <div className="mt-8 space-y-3">
        {FAQS.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-neutral-200 bg-white shadow-sm transition-colors open:border-violet-200"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-neutral-900 [&::-webkit-details-marker]:hidden">
              {item.q}
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
                className="shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <p className="px-5 pb-5 text-base leading-relaxed text-neutral-600">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
