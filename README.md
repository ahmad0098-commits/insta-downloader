# Baixar Foto do Instagram — insta-downloader

Ferramenta para **baixar foto do Instagram** (publicações públicas) em alta
qualidade, construída com **Next.js (App Router) + TypeScript + Tailwind CSS**,
com integração server-side segura à **Apify**.

> ⚠️ Suporta apenas conteúdo **público** do Instagram. Não há login, não há
> bypass de contas privadas e não há dados fictícios.

---

## Como funciona

```
Browser
   ↓
Next.js /api/instagram-photo   (validação + rate limit + SSRF guard)
   ↓
Apify Actor                    (APIFY_API_TOKEN fica só no servidor)
   ↓
Instagram public media data
   ↓
Next.js  →  JSON estruturado  →  Browser
```

O token da Apify **nunca** aparece no JavaScript do cliente, no HTML ou em
requisições do navegador. Não existem variáveis `NEXT_PUBLIC_*` para segredos.

## Estrutura do projeto

```text
app/
  page.tsx                      # Homepage (hero + downloader + conteúdo SEO)
  layout.tsx                    # Metadata (title, OG, Twitter, canonical)
  globals.css                   # Tailwind + acessibilidade
  sitemap.ts / robots.ts        # SEO técnico
  api/
    instagram-photo/route.ts    # POST — busca a foto via Apify
    download/route.ts           # GET  — proxy de download seguro

components/
  instagram-downloader.tsx      # Client component (input, paste, loading)
  result-card.tsx               # Pré-visualização + Baixar + Copiar link
  faq.tsx                       # Perguntas frequentes

lib/
  apify.ts                      # Adapter server-side da Apify (isolado)
  instagram-parser.ts           # Parser tolerante ao output do Actor
  validation.ts                 # Validação/sanitização de URLs (anti-SSRF)
  rate-limit.ts                 # Rate limiting (fallback em memória)

.env.local                      # (não versionado) token + Actor ID
.env.example                    # Modelo das variáveis
```

## Onde colocar o token da Apify

1. Crie uma conta em <https://apify.com>.
2. Vá em **Settings → Integrations → API token** e copie o token.
3. No projeto, crie `.env.local` (ele está no `.gitignore`):

```env
APIFY_API_TOKEN=apify_api_XXXXXXXXXXXX
APIFY_ACTOR_ID=apify/instagram-scraper
```

> Se `APIFY_ACTOR_ID` ficar vazio, o app usa `apify/instagram-scraper` por
> padrão. **Nunca** renomeie as variáveis para `NEXT_PUBLIC_*`.

## Como trocar o Actor

Qualquer Actor da Apify que aceite URLs de posts públicos e retorne dataset
com URLs de imagem funciona:

1. Defina `APIFY_ACTOR_ID=owner/actor-name` no `.env.local`.
2. Se o input do Actor for diferente, ajuste `buildActorInput()` em
   `lib/apify.ts`.
3. Se o output for diferente, ajuste `lib/instagram-parser.ts` — ele já
   cobre os formatos mais comuns (`displayUrl`, `images.high`,
   `thumbnailUrl`, carrosséis, GraphQL `edges`, etc.).

Os contratos de input/output esperados estão documentados em comentários no
topo de `lib/apify.ts`.

## Como testar localmente

```bash
npm install
cp .env.example .env.local   # cole seu token no arquivo
npm run dev                  # http://localhost:3000
```

Depois, cole o link de uma publicação **pública** (ex. `https://www.instagram.com/p/XXXX/`)
e clique em **Baixar Foto**.

Testes rápidos de validação (sem gastar créditos da Apify — URLs inválidas
são rejeitadas antes da chamada):

- `https://google.com` → "Insira um link válido do Instagram."
- campo vazio → "Cole o link da publicação do Instagram."
- `https://www.instagram.com/seu-perfil/` → link inválido (perfis não são suportados)

## Deploy na Vercel

1. Crie sua conta na [Apify](https://apify.com).
2. Escolha/configure um Actor de conteúdo público do Instagram
   (padrão: `apify/instagram-scraper`).
3. Copie seu **API token**.
4. Na Vercel: **Project → Settings → Environment Variables** e adicione:
   - `APIFY_API_TOKEN` (valor do token — *server-side only*)
   - `APIFY_ACTOR_ID` (ex. `apify/instagram-scraper`)
   - `NEXT_PUBLIC_SITE_URL` (opcional: domínio final, p/ canonical/OG)
5. Faça o deploy (`vercel deploy` ou via GitHub → Vercel).
6. Teste com uma publicação pública real.

## Notas de produção

- **Rate limiting**: em desenvolvimento/servidor único é usado um limitador
  em memória (`lib/rate-limit.ts`). Em ambientes serverless multi-instância,
  para limites estritos plugue um store compartilhado — ex.
  [Upstash Redis (@upstash/ratelimit)](https://github.com/upstash/ratelimit)
  ou Vercel KV. A interface `RateLimiter` permite trocar sem tocar nas rotas.
- **Links de mídia**: URLs de CDN do Instagram são assinadas e podem exporar
  em pouco tempo. O proxy `/api/download` tenta baixar e, se o upstream
  bloquear, redireciona para a URL real (fallback honesto — nunca um
  "download falso").
- **Segurança**: apenas URLs do Instagram são aceitas; o proxy de download
  só permite hosts de CDN conhecidos (`cdninstagram.com`, `fbcdn.net`);
  corpo da requisição limitado a 1 KB; nenhuma URL controlada pelo cliente
  é buscada pelo servidor.

## Aviso legal

Ferramenta independente, sem afiliação com Instagram/Meta. Use apenas com
conteúdo público e respeite os direitos autorais dos autores.
