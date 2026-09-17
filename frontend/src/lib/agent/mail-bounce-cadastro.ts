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
import {
  veredictoDoCadastro as veredictoCom,
  type Cadastro,
  type VeredictoCadastro,
} from "./mail-bounce-cadastro-pure";

/**
 * A REGRA mora em `mail-bounce-cadastro-pure.ts` (ZERO import) e é re-exportada
 * daqui porque este era o endereço dela desde o #440/#441 — quem já importava
 * não muda uma linha.
 *
 * ⚠️ A separação NÃO é arrumação: enquanto a decisão morava neste arquivo, o
 * `mail-bounce.test.ts` importava daqui, arrastava `@/lib/db/admin` e MORRIA no
 * `node --test` (que não resolve o alias `@/`). Isso não derrubava só os testes
 * novos: levava junto os do PARSER DE BOUNCE, vivos desde 30/08. O motivo
 * inteiro está no cabeçalho do módulo puro.
 */
export {
  decidirCadastro,
  notaDeObsoleto,
  type Cadastro,
  type VeredictoCadastro,
} from "./mail-bounce-cadastro-pure";

/**
 * Adaptador real. `ilike` SEM curinga é igualdade sem diferenciar maiúscula —
 * é de propósito: `.eq()` deixaria passar por fantasma um cadastro gravado com
 * outra caixa, e "não achei porque procurei errado" é o erro que a armadilha do
 * erro de consulta existe pra não cometer.
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
 * O endereço ainda é de cadastro? Mesma função do módulo puro, com a porta real
 * já ligada — é esta que a produção chama (`mail-bounce-registro.ts`).
 */
export async function veredictoDoCadastro(email: string, c: Cadastro = cadastroReal): Promise<VeredictoCadastro> {
  return veredictoCom(email, c);
}
