/**
 * A REGRA do "o endereço que quicou ainda é de cadastro?", PURA — zero import.
 *
 * POR QUE ESTE ARQUIVO EXISTE, E NÃO É ORGANIZAÇÃO: a regra nasceu (17/09,
 * #440/#441) dentro de `mail-bounce-cadastro.ts`, que importa
 * `@/lib/db/admin`. Os testes dela foram escritos no fim de
 * `mail-bounce.test.ts` — e `node --test` NÃO resolve o alias `@/` do Next.
 * Resultado medido: o arquivo de teste inteiro passou a morrer no import,
 * levando junto os testes do PARSER DE BOUNCE, que passavam desde 30/08 e são
 * os que guardam as três armadilhas das amostras reais (uid 380, 259, 277).
 * Um módulo de IO importado por um teste apagou a cobertura de um módulo puro
 * que não tinha nada a ver com ele.
 *
 * É a mesma razão de `acesso-regra.ts` e de `entitlements-pure.ts` existirem,
 * e o cabeçalho do próprio `mail-bounce-cadastro.ts` já dizia a regra ("tem IO,
 * por isso vive fora do `mail-bounce.ts`, que é puro"). Aqui ela é aplicada um
 * andar acima: a DECISÃO sai do módulo de IO e fica testável; lá ficam só a
 * consulta ao banco e o adaptador.
 *
 * Quem importava de `mail-bounce-cadastro.ts` não muda uma linha — aquele
 * arquivo re-exporta tudo isto. A regra é byte a byte a mesma.
 */

/**
 * O que a consulta descobriu sobre UM endereço.
 *
 *  · "vigente"  → consta em algum cadastro. Chamado NORMAL, vivo. É o caso da
 *                 maioria (11 dos 16 medidos) e o que não pode regredir.
 *  · "obsoleto" → perguntamos às duas tabelas e ele não está em nenhuma.
 *  · "nao-sei"  → a pergunta não foi respondida (banco fora, erro). Ignorância
 *                 não vira veredito: o chamado nasce aberto.
 */
export type VeredictoCadastro = "vigente" | "obsoleto" | "nao-sei";

/**
 * A porta de saída, injetável. Cada método devolve `true` (achei), `false`
 * (perguntei e não tem) ou `null` (NÃO CONSEGUI PERGUNTAR) — a diferença entre
 * os dois últimos é a razão de existir da armadilha do erro de consulta.
 */
export type Cadastro = {
  /** O endereço está em `sgp_pedidos.email`? */
  emSgp(email: string): Promise<boolean | null>;
  /** O endereço está em `profiles.email`? */
  emProfiles(email: string): Promise<boolean | null>;
};

/**
 * A decisão, pura e sem banco.
 *
 * Só é "obsoleto" quando as DUAS tabelas responderam e as duas disseram não.
 * Basta uma delas não ter respondido para virar "nao-sei": um `false` de uma e
 * um `null` da outra não somam "não está em lugar nenhum" — somam "não está
 * numa, e da outra eu não sei".
 *
 * As duas são consultadas de propósito, e a medição diz que nenhuma sozinha
 * bastaria: dos 11 endereços vigentes, 1 só existe em `sgp_pedidos`, 8 só em
 * `profiles` e 2 nos dois. Conferir só `profiles` marcaria o aluno do SGP como
 * fantasma; conferir só `sgp_pedidos` marcaria 8 alunos da plataforma.
 */
export function decidirCadastro(r: { emSgp: boolean | null; emProfiles: boolean | null }): VeredictoCadastro {
  if (r.emSgp === true || r.emProfiles === true) return "vigente";
  if (r.emSgp === null || r.emProfiles === null) return "nao-sei";
  return "obsoleto";
}

/**
 * A nota que o chamado obsoleto carrega.
 *
 * Diz o que foi MEDIDO (este endereço não está em cadastro nenhum) e o que NÃO
 * foi (qual é o endereço bom). A tentação é escrever "cadastro atual: <x>", e
 * é exatamente o que a armadilha proíbe — no #440 esse <x> chutado seria o
 * endereço errado. Quem for tratar o caso procura o aluno pelo NOME, que é o
 * caminho que funciona.
 */
export function notaDeObsoleto(email: string, quando: string): string {
  return (
    `Fechado automaticamente: o endereço que quicou (${email}) NÃO consta em ` +
    `nenhum cadastro vigente — nem em sgp_pedidos.email, nem em profiles.email ` +
    `(conferido em ${quando}). Bounce é fotografia do passado: pode chegar dias ` +
    `depois (no #440 chegou 2 dias depois, MX de domínio estacionado), quando o ` +
    `próprio aluno já corrigiu o endereço. Fica como registro de que a mensagem ` +
    `não chegou naquele endereço.\n\n` +
    `⚠️ NÃO troque o cadastro de ninguém por causa deste chamado. O endereço ` +
    `substituto NÃO está indicado aqui de propósito: ele não é computável com ` +
    `segurança (o cadastro é atualizado no lugar, sem deixar vínculo) e chutar ` +
    `por semelhança já apontou o endereço ERRADO no #440 — teria trocado um ` +
    `cadastro verificado e em uso pelo e-mail da Hotmart. Se precisar achar o ` +
    `aluno, procure pelo NOME em sgp_pedidos/profiles e confirme antes de mexer.`
  );
}

/**
 * O endereço ainda é de cadastro? NUNCA lança: roda dentro da varredura, e lá
 * uma exceção trava a fila inteira (ver o alerta no topo de `tratarSeForBounce`).
 *
 * ⚠️ A porta `c` é OBRIGATÓRIA aqui, de propósito. O default `= cadastroReal`
 * mora no `mail-bounce-cadastro.ts`, junto do adaptador — é ele que arrasta o
 * Supabase. Se o default vivesse neste arquivo, este arquivo deixaria de ser
 * puro e o teste voltaria a morrer no import, que é o defeito que ele conserta.
 */
export async function veredictoDoCadastro(email: string, c: Cadastro): Promise<VeredictoCadastro> {
  try {
    const alvo = (email || "").trim();
    if (!alvo) return "nao-sei";
    // Em série e não em paralelo: são duas consultas leves e, quando a primeira
    // já diz "vigente", a segunda não precisa acontecer.
    const emSgp = await c.emSgp(alvo);
    if (emSgp === true) return "vigente";
    const emProfiles = await c.emProfiles(alvo);
    return decidirCadastro({ emSgp, emProfiles });
  } catch (e) {
    console.error("[agent/bounce] cadastro não respondeu, chamado nasce normal:", e instanceof Error ? e.message : e);
    return "nao-sei";
  }
}
