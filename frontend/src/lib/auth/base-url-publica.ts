/**
 * Base pública do redirect pós-login do `auth/callback`.
 *
 * Atrás do nginx, o `origin` de `request.url` vira `localhost:3002` — por isso
 * a env `NEXT_PUBLIC_SITE_URL` sempre mandou. MAS o cookie que o `verifyOtp`
 * acabou de gravar é do HOST desta request: quando ela chega pelo `www.`
 * (entrada do suporte na conta do aluno do SGP — ver `casaDoAluno` em
 * `lib/sgp/link-entrada-pure.ts`), mandar pro apex jogaria o aluno num host
 * SEM o cookie dele (e COM o cookie de admin da atendente — Karen, 22/09).
 *
 * Só honramos o host da request quando ele é exatamente o `www.` do site da
 * env. Qualquer outro `Host`/`X-Forwarded-Host` cai na env, como sempre:
 * cabeçalho forjado não vira open-redirect.
 *
 * Módulo PURO de propósito (zero imports): testável sem Next.
 */
export function baseUrlPublica(
  headers: Pick<Headers, "get">,
  origin: string,
  siteEnv: string | undefined,
): string {
  const env = (siteEnv ?? origin).replace(/\/+$/, "");
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (!host) return env;
  let site: URL;
  try {
    site = new URL(env);
  } catch {
    return env;
  }
  if (host === `www.${site.hostname.toLowerCase()}`) return `${site.protocol}//${host}`;
  return env;
}
