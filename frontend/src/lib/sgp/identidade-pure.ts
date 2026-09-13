/**
 * SGP — as DUAS travas do nome do aluno (#377).
 *
 * O BUG, nas duas pernas que ele tinha:
 *
 *  1. VALIDAÇÃO. `POST /api/v1/sgp/inicio` só checava `nome.length < 3`. O
 *     aluno que digitava o próprio e-mail no campo "nome" passava reto — e o
 *     endereço virava o nome dele no cadastro. O regex de e-mail já existia no
 *     MESMO arquivo, usado no campo e-mail; ninguém o tinha apontado pro nome.
 *
 *  2. SOBRESCRITA. `processar.ts` gravava em `profiles` com
 *     `{ id, email, display_name: pedido.nome, whatsapp }` e `onConflict: id`
 *     FORA do `if (!userId)` que cria a conta. Quem já era cliente do
 *     FastCloner tinha o `display_name` da casa trocado pelo que digitou no
 *     wizard. Juntando as duas pernas: e-mail digitado no campo nome vira o
 *     `display_name` de uma conta que já estava certa.
 *
 * O TAMANHO REAL, medido em 13/09 antes do conserto: 2 pedidos com e-mail no
 * campo nome (ambos ainda em `status='foto'`, nenhum processado) e ZERO perfis
 * com '@' no `display_name`. Ou seja: bug real, exposição larga (150 pedidos
 * com `conta_existente=true`, 45 já processados), estrago consumado **zero**.
 * Isto aqui é trava preventiva, não limpeza de estrago.
 *
 * A ARMADILHA QUE ESTE ARQUIVO RESPEITA: comprador que quer CORRIGIR o próprio
 * nome pelo wizard é caso legítimo. O campo não é congelado e a tela não muda —
 * a regra é só **não sobrescrever valor que já está preenchido**. Valor vazio
 * continua sendo preenchido pelo wizard, normalmente.
 *
 * Puro de propósito (zero imports, igual `previa-pure.ts` e
 * `reconciliacao-pure.ts`): o alias "@/" não resolve em `node --test`, então a
 * decisão mora aqui e os routes só a chamam. Rodar, de dentro de frontend/:
 *   node --test src/lib/sgp/identidade-pure.test.ts
 */

/**
 * Formato de e-mail. Um regex só, usado nos DOIS campos de `/sgp/inicio`: no
 * e-mail (para exigir) e no nome (para recusar). Estava definido solto no
 * route; mora aqui para não haver duas cópias divergindo com o tempo.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mensagens de recusa — exportadas para o teste não depender de string solta. */
export const NOME_CURTO = "Informe o nome completo.";
export const NOME_EH_EMAIL = "Informe o seu nome e sobrenome, não o seu e-mail.";

/**
 * O que há de errado no nome digitado, ou `null` se está bom.
 * A ordem importa: "curto" antes de "é e-mail", porque um e-mail sempre tem
 * mais de 3 caracteres e a mensagem de tamanho é a mais útil pro campo vazio.
 */
export function problemaNoNome(nome: string | null | undefined): string | null {
  const limpo = (nome ?? "").trim();
  if (limpo.length < 3) return NOME_CURTO;
  if (EMAIL_RE.test(limpo)) return NOME_EH_EMAIL;
  return null;
}

function vazio(v: string | null | undefined): boolean {
  return v == null || v.trim() === "";
}

/** A linha de `profiles` que JÁ existe — só os campos que esta decisão lê. */
export type PerfilAtual = { display_name: string | null; whatsapp: string | null };

export type EntradaPerfil = {
  userId: string;
  /** Já em minúsculas, o mesmo que resolveu a conta. */
  email: string;
  /** A conta nasceu agora neste envio, ou já era do FastCloner? */
  contaCriada: boolean;
  /** O que o aluno digitou no wizard. */
  nome: string | null;
  whatsapp: string | null;
  /**
   * A linha de `profiles` de hoje, ou `null` quando ainda não existe linha
   * (acontece de verdade: `acharUsuarioPorEmail` acha usuário no `auth` que
   * ainda não tem perfil). Sem linha não há o que preservar.
   */
  atual: PerfilAtual | null;
};

/**
 * O objeto do upsert. Campo AUSENTE = coluna NÃO TOCADA (`onConflict: "id"`).
 *
 * ⚠️ ISTO SÓ VALE PORQUE O UPSERT RECEBE **UM OBJETO**, não um array. Conferido
 * no fonte do postgrest-js (`PostgrestQueryBuilder.ts`, `upsert`): o parâmetro
 * `columns=` da URL só é montado `if (Array.isArray(values))`. Com um objeto só
 * ele não vai, e o PostgREST deduz as colunas das chaves do corpo — então a
 * chave ausente fica fora do `ON CONFLICT ... DO UPDATE SET`.
 *
 * Quem um dia trocar este upsert por um array de linhas REABRE o bug: o
 * `columns=` passa a ser a UNIÃO das chaves de todas as linhas, e a linha que
 * omitiu `display_name` volta a escrever na coluna.
 */
export type CamposDoPerfil = {
  id: string;
  email: string;
  display_name?: string;
  whatsapp?: string;
};

/**
 * O que gravar em `profiles`.
 *
 * `id` e `email` vão sempre (é o que identifica a linha, e o e-mail é o mesmo
 * que achou a conta — normalizado em minúsculas).
 *
 * `display_name` e `whatsapp` só vão quando **não destroem nada**:
 *   - conta nova, ou sem linha em `profiles`: vão, igual antes do conserto;
 *   - conta que já existia com o campo VAZIO: vão (preencher não é sobrescrever);
 *   - conta que já existia com o campo PREENCHIDO: ficam de fora — a chave
 *     some do upsert e o PostgREST não toca na coluna.
 *
 * Valor vazio digitado no wizard nunca é gravado: não se apaga um campo bom
 * com um campo em branco.
 */
export function camposDoPerfil(e: EntradaPerfil): CamposDoPerfil {
  const campos: CamposDoPerfil = { id: e.userId, email: e.email };
  // Sem nada a preservar: conta recém-criada, ou conta de `auth` sem perfil.
  const semNadaAPreservar = e.contaCriada || e.atual === null;

  if (!vazio(e.nome) && (semNadaAPreservar || vazio(e.atual?.display_name))) {
    campos.display_name = (e.nome as string).trim();
  }
  if (!vazio(e.whatsapp) && (semNadaAPreservar || vazio(e.atual?.whatsapp))) {
    campos.whatsapp = (e.whatsapp as string).trim();
  }
  return campos;
}
