/**
 * E-mail vira CHAVE de comparação — só pra PERGUNTAR "estas duas caixas são a
 * mesma?", nunca pra gravar, enviar ou exibir. O endereço original continua
 * sendo o que vai no `to:` do e-mail.
 *
 * Motivo (incidente #306 / 18bf275c, nomeado em 08/09/2026 e ainda vivo em
 * 17/09): a guarda `hasAccount` do `orphan-outreach.ts` comparava e-mail por
 * igualdade de string. O Gmail IGNORA o ponto no nome do usuário e ignora tudo
 * depois do `+`, então `herysilva.27@gmail.com` e `herysilva27@gmail.com` são a
 * MESMA caixa — e a casa mandou "crie sua conta com EXATAMENTE este e-mail"
 * para a dona de uma conta `plan=pro` que já existia desde 21/07. É a repetição
 * do incidente 72a4c9db / #127: convite pra cliente ATIVO.
 *
 * ⚠️ POR QUE SÓ O GMAIL. Fundir endereços é uma faca de dois gumes, e os dois
 * lados têm dano:
 *  - não fundir o que é a mesma caixa → convite constrangedor pra cliente ativo
 *    (o defeito acima);
 *  - fundir o que NÃO é a mesma caixa → um pagante órfão de verdade é lido como
 *    "já tem conta" e fica em SILÊNCIO, pagando sem acesso. Esse é o dano PIOR.
 * Por isso a regra é deliberadamente conservadora: só normaliza o local-part em
 * domínio do Google, onde a equivalência é garantida pelo próprio provedor. Em
 * muitos outros provedores o ponto distingue pessoas DIFERENTES, e fundir seria
 * trocar um duplicado por um dado errado.
 *
 * Módulo ZERO-IMPORT de propósito: é o que o deixa rodável em `node --test`,
 * que não resolve o alias `@/` do Next.
 *
 * ⚠️ NÃO é o mesmo que `chaveEmail` (`@/lib/sgp/compradores.ts`), e a diferença
 * é intencional: `chaveEmail` preserva o domínio `googlemail.com` (tem teste
 * fixando isso, porque ele é a identidade de LINHA do painel do SGP e mudar a
 * chave de uma tela viva é outro cartão). Aqui o domínio é dobrado pra
 * `gmail.com`, que é o que a pergunta "é a mesma caixa?" exige: `googlemail.com`
 * é alias oficial do `gmail.com`. Unificar os dois módulos muda a chave do
 * painel do SGP e precisa vir com o caminho de convivência no próprio PR.
 */

/** Alias oficial do Gmail: as duas formas entregam na mesma caixa. */
const DOMINIOS_GOOGLE = new Set(["gmail.com", "googlemail.com"]);

/**
 * Forma canônica do e-mail para COMPARAÇÃO.
 *
 * Regras, e só estas:
 *  1. sempre `trim()` + minúsculas;
 *  2. domínio do Google (`gmail.com`/`googlemail.com`): remove TODOS os pontos
 *     do local-part, corta do primeiro `+` em diante, e o domínio vira
 *     `gmail.com`;
 *  3. qualquer outro domínio: o local-part NÃO é tocado (só minúsculas).
 *
 * Entrada vazia, `null` ou sem `@` volta como está (em minúsculas) em vez de
 * explodir — quem chama está varrendo dado de produção, e uma linha suja não
 * pode derrubar a varredura inteira.
 */
export function normalizarEmailParaComparacao(email: string | null | undefined): string {
  const e = (email ?? "").trim().toLowerCase();
  // `lastIndexOf`: o local-part pode conter `@` entre aspas; o domínio é o que
  // vem depois do ÚLTIMO. `at <= 0` cobre "sem @" e "@ no começo" (sem nome),
  // que não são endereço comparável — devolve o que veio, sem inventar chave.
  const at = e.lastIndexOf("@");
  if (at <= 0) return e;

  const dominio = e.slice(at + 1);
  const local = e.slice(0, at);
  if (!DOMINIOS_GOOGLE.has(dominio)) return `${local}@${dominio}`;

  const semTag = local.split("+")[0] ?? "";
  const semPonto = semTag.replace(/\./g, "");
  // Local-part que some inteiro na normalização (".@gmail.com", "+x@gmail.com")
  // não é endereço real, e devolver "@gmail.com" faria endereços diferentes
  // colidirem numa chave só. Colisão aqui é o lado PERIGOSO (cala pagante
  // órfão), então nesse caso preserva-se o local-part original.
  if (semPonto === "") return `${local}@gmail.com`;
  return `${semPonto}@gmail.com`;
}
