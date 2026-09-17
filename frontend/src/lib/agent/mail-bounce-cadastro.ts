/**
 * O endereço que quicou AINDA é endereço de cadastro? Tem IO (Supabase), por
 * isso vive fora do `mail-bounce.ts`, que é puro — igual ao que o
 * `mail-bounce-dns.ts` faz com o DNS. A porta (`Cadastro`) é injetável, e é o
 * que torna a regra testável sem banco.
 *
 * POR QUE EXISTE (medido 17/09). `registrarBounce` abria chamado pelo endereço
 * que quicou sem NUNCA conferir se aquele endereço ainda era o do cadastro.
 * Não havia consulta a `sgp_pedidos` nem a `profiles` em ponto nenhum do
 * caminho. Dos 16 chamados `fast-bounce:` dos últimos 30 dias, 5 eram de
 * endereço que não consta mais em cadastro nenhum (#339, #378, #401, #440,
 * #441) — quase um terço da fila era fantasma.
 *
 * O caso que custou caro foi o #440: o bounce do `...@gmmail.com` do Robério
 * chegou com DOIS DIAS de atraso (MX de domínio estacionado), quando o
 * cadastro certo (`roberioaraujohairstylist@gmail.com`) já estava verificado e
 * com 6 fotos enviadas. O chamado fantasma virou um pedido de "corrigir o
 * cadastro" com o e-mail da Hotmart (`roberioaraujo18@gmail.com`, que é um
 * TERCEIRO endereço) — obedecer teria trocado um endereço verificado e em uso
 * por um que ele não usa, quebrando a conta de um aluno que estava bem.
 *
 * ⚠️ O QUE ESTE ARQUIVO SE PROÍBE, E A MEDIÇÃO QUE PROVA O PORQUÊ:
 *
 *  1. NÃO ADIVINHA O ENDEREÇO SUBSTITUTO. Seria natural a nota dizer "cadastro
 *     atual é <x>", mas esse <x> não é computável com segurança: o endereço
 *     antigo é ATUALIZADO NO LUGAR (medido no pedido do Wanderley, #441 — a
 *     mesma linha `c1e8a715`, criada 01:04:08 com o typo e atualizada 01:11:48
 *     com o certo), então não sobra vínculo nenhum entre o que quicou e o que
 *     vale. O único link estruturado seria `emails_enviados.user_id`, e ele
 *     está preenchido em 45 de 309 linhas (14,6%) e em ZERO das 5 que
 *     quicaram. Resta semelhança de texto, que foi medida e REPROVA: o prefixo
 *     do Robério casa `roberioaraujo18@gmail.com` (o da Hotmart, errado, o
 *     mesmo que quase quebrou a conta dele) e NÃO casa o certo; e para o
 *     Hamilton (#339) não casa nada, porque `hamiltoc…` e `hamiltonc…` divergem
 *     no 8º caractere. Nomear o substituto por chute é o defeito que este
 *     arquivo existe pra impedir, não uma comodidade a mais.
 *
 *  2. NÃO SUPRIME O CHAMADO. Suprimir bounce é ficar cego: se a checagem
 *     errar, a casa perde sinal de entrega real. O chamado NASCE, com número,
 *     buscável — só já nasce marcado como obsoleto.
 *
 *  3. ERRO DE CONSULTA NUNCA VIRA "OBSOLETO". `data: null` com `error` é "não
 *     sei", não "não achei". Tratar os dois como a mesma coisa marcaria como
 *     fantasma um chamado legítimo toda vez que o banco piscasse — e a falha
 *     seria silenciosa, que é a pior classe. Na dúvida o chamado nasce ABERTO,
 *     que é o comportamento de hoje.
 */
import { getAdmin } from "@/lib/db/admin";

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
 * os dois últimos é a razão de existir da armadilha 3 lá em cima.
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
 * é exatamente o que a armadilha 1 proíbe — no #440 esse <x> chutado seria o
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
 * Adaptador real. `ilike` SEM curinga é igualdade sem diferenciar maiúscula —
 * é de propósito: `.eq()` deixaria passar por fantasma um cadastro gravado com
 * outra caixa, e "não achei porque procurei errado" é o erro que a armadilha 3
 * existe pra não cometer.
 */
export const cadastroReal: Cadastro = {
  emSgp: (email) => existeNaColunaEmail("sgp_pedidos", email),
  emProfiles: (email) => existeNaColunaEmail("profiles", email),
};

async function existeNaColunaEmail(tabela: string, email: string): Promise<boolean | null> {
  try {
    const { data, error } = await getAdmin()
      .from(tabela as never)
      .select("email")
      .ilike("email", email)
      .limit(1);
    // A ordem importa: `error` primeiro. Um erro vem com `data: null`, e ler o
    // `data` antes devolveria `false` ("não achei") para uma pergunta que nem
    // foi respondida — o bug exato da armadilha 3.
    if (error) {
      console.error(`[agent/bounce] não consegui conferir ${tabela}:`, error.message);
      return null;
    }
    return (data ?? []).length > 0;
  } catch (e) {
    console.error(`[agent/bounce] não consegui conferir ${tabela}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * O endereço ainda é de cadastro? NUNCA lança: roda dentro da varredura, e lá
 * uma exceção trava a fila inteira (ver o alerta no topo de `tratarSeForBounce`).
 */
export async function veredictoDoCadastro(email: string, c: Cadastro = cadastroReal): Promise<VeredictoCadastro> {
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
