/**
 * Monta a URL do checkout da Hotmart pré-preenchendo os dados do comprador.
 *
 * Regra da Hotmart: o 1º parâmetro entra com "?" e os demais com "&".
 * Pré-preencher o `email` do usuário logado faz a compra sair com o MESMO
 * e-mail do login (Google OAuth) → quando o webhook chegar, o comprador casa
 * com o usuário e o acesso é liberado automaticamente, sem fluxo manual de
 * "reivindicar acesso".
 *
 * Parâmetros oficiais suportados: name, email, doc (CPF/CNPJ), zip (CEP),
 * phoneac + phonenumber. Aqui só usamos os que temos do login (email/name).
 * Ref: help.hotmart.com/pt-br/article/115003588572
 */
export type CheckoutPrefill = {
  email?: string | null;
  name?: string | null;
};

/**
 * @param base URL base do checkout (vem do produtor, ex.: https://pay.hotmart.com/XXXX).
 *             Configurada em NEXT_PUBLIC_HOTMART_CHECKOUT_URL.
 * @param prefill dados do comprador para pré-preencher o formulário.
 * @returns URL final com os parâmetros, ou a base inalterada se não houver o que preencher.
 */
export function buildHotmartCheckoutUrl(
  base: string,
  prefill: CheckoutPrefill = {},
): string {
  const trimmed = base.trim();
  if (!trimmed) return "";

  const params = new URLSearchParams();
  if (prefill.email) params.set("email", prefill.email.trim().toLowerCase());
  if (prefill.name) params.set("name", prefill.name.trim());

  const qs = params.toString();
  if (!qs) return trimmed;

  const sep = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${sep}${qs}`;
}
