/**
 * Nome do cookie/chave da sessão do Supabase — FIXO, de propósito.
 *
 * O `supabase-js` monta o nome sozinho a partir do começo do hostname:
 *     defaultStorageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`
 *
 * Então trocar a URL do projeto (`yizerthyrgrajivlotcw.supabase.co` →
 * `fastcloner.supabase.co`, vanity subdomain ativado 26/08) mudaria a chave de
 * `sb-yizerthyrgrajivlotcw-auth-token` para `sb-fastcloner-auth-token` — e
 * TODA sessão viva viraria órfã: quem estava logado cai na tela de login no
 * próximo clique. Com 60 pessoas online no momento da troca, isso é uma fila
 * de suporte, não um detalhe.
 *
 * Fixando aqui, a URL muda (o Google passa a mostrar `fastcloner.supabase.co`
 * no consentimento) e ninguém é deslogado.
 *
 * ⚠️ Os TRÊS pontos que falam com o Supabase precisam usar esta mesma chave —
 * client.ts, server.ts e middleware.ts. Se um ler um cookie e outro escrever
 * outro, o resultado não é "meio quebrado": é loop de login.
 *
 * ⚠️ NÃO derive este valor da URL nem o "modernize" pro ref novo: o nome antigo
 * é o que está gravado no navegador de quem já usa a plataforma. Ele só pode
 * mudar num dia em que deslogar todo mundo seja aceitável.
 */
export const SUPABASE_STORAGE_KEY = "sb-yizerthyrgrajivlotcw-auth-token";
