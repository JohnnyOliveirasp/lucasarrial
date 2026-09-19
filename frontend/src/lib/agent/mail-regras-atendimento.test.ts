/**
 * Testes do bloco REEMBOLSO/CANCELAMENTO/COBRANÇA que a Fast recebe no E-MAIL.
 *
 * Rodar (Node ≥ 22, tsx resolve o alias `@/`):
 *   npx tsx --test src/lib/agent/mail-regras-atendimento.test.ts
 *
 * ⚠️ NÃO rode com `node --test` pelado: `mail-respond.ts` importa por `@/…` e o
 * arquivo morre na resolução, ANTES de qualquer `test()` — e um arquivo que
 * morre na compilação não falha em vermelho, ele simplesmente não existe na
 * contagem. Foi assim que "N pass" já escondeu um arquivo de prova inteiro.
 *
 * POR QUE ESTE ARQUIVO EXISTE (ordem do Johnny, 19/09):
 * até hoje a regra mandava a Fast "acolher, lamentar e dizer que a equipe
 * confirma a solicitação em breve" — ela não explicava caminho NENHUM. Medido
 * em 19/09: 7 chamados dessa classe abertos, o mais velho com 9,8 dias, cada um
 * com um aluno esperando uma confirmação que nunca veio. E o texto misturava
 * dois pedidos com donos OPOSTOS: cancelar assinatura é da CASA (regra 9-C,
 * 21/08) e reembolso dentro da garantia é do PRÓPRIO ALUNO, automático na
 * Hotmart.
 *
 * O QUE NÃO DÁ PRA TESTAR AQUI, e está dito assim de propósito: a RESPOSTA que
 * a Fast escreve é saída de modelo — nenhum teste determinístico prova que ela
 * citou a data. O que se prova aqui é a INSTRUÇÃO que chega até ela, e o
 * PROMPT MONTADO (regras + bloco da conta) nos três estados de garantia, usando
 * as strings REAIS de `garantia.ts` — não versões inventadas para o teste.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mailSystemExtra, WHATSAPP_SUPORTE_LINK } from "@/lib/agent/mail-respond";
import { WHATSAPP_SUPORTE_CURSO } from "@/lib/payments/sgp-boas-vindas";
import {
  blocoGarantiaMultiProduto,
  GARANTIA_ESCALAR,
  diaBR,
  type JanelaProduto,
} from "@/lib/agent/garantia";

/** O que a Fast recebe quando a conta do remetente foi identificada. */
const REGRAS = mailSystemExtra(true);
/** …e quando não foi (o outro ramo, que também não pode perder as regras). */
const REGRAS_SEM_CONTA = mailSystemExtra(false);

const FONTE = readFileSync(
  fileURLToPath(new URL("./mail-respond.ts", import.meta.url)),
  "utf8",
);

// ── o prompt montado, como o cérebro recebe ────────────────────────────────
// `buildAgentReply` recebe `account` e `systemExtra` separados e os junta. Aqui
// a junção é reproduzida para medir o TEXTO INTEIRO nos três estados — é o que
// o card pediu ("conta com GARANTIA DENTRO", "FORA", "linha ausente").
const promptCom = (garantia: string) => `${REGRAS}\n\n${garantia}`;

const HOJE = new Date("2026-09-19T12:00:00Z");
const produto = (nome: string, estado: JanelaProduto["estado"], fim: Date | null): JanelaProduto => ({
  produtoId: nome === "Video Clone" ? "111" : "222",
  produto: nome,
  identificado: true,
  compra: new Date("2026-09-15T12:00:00Z"),
  fim,
  estado,
  primeiraCobranca: null,
});

const FIM_DENTRO = new Date("2026-09-25T00:00:00Z");
const FIM_FORA = new Date("2026-09-01T00:00:00Z");

/** Bloco REAL de produção para uma conta DENTRO da janela. */
const GARANTIA_DENTRO = blocoGarantiaMultiProduto(
  [produto("Video Clone", "dentro", FIM_DENTRO), produto("Curso", "adesao0", null)],
  HOJE,
) as string;

/** Bloco REAL de produção para uma conta FORA da janela. */
const GARANTIA_FORA = blocoGarantiaMultiProduto(
  [produto("Video Clone", "fora", FIM_FORA), produto("Curso", "adesao0", null)],
  HOJE,
) as string;

test("os blocos de garantia usados no teste são os REAIS (não strings inventadas)", () => {
  // Guarda do guarda: se `blocoGarantiaMultiProduto` devolvesse null, os testes
  // abaixo rodariam contra a string "null" e ficariam verdes sem provar nada.
  assert.ok(GARANTIA_DENTRO && GARANTIA_DENTRO.includes("DENTRO da janela"));
  assert.ok(GARANTIA_FORA && GARANTIA_FORA.includes("FORA da janela"));
  assert.ok(GARANTIA_ESCALAR.includes("NÃO foi possível confirmar"));
});

// ── (B) REEMBOLSO: o caminho que o aluno percorre sozinho ──────────────────

test("DENTRO da garantia: o prompt leva a DATA da linha e o caminho da Área do Comprador", () => {
  const prompt = promptCom(GARANTIA_DENTRO);
  // a DATA vem da linha da conta, calculada por garantia.ts — não do texto fixo
  assert.ok(
    prompt.includes(diaBR(FIM_DENTRO)),
    "a data de fim da garantia não chegou no prompt — sem ela a Fast não tem o que citar e inventa",
  );
  // e o caminho a percorrer vem das regras
  assert.match(prompt, /Área do Comprador/i);
  assert.match(prompt, /compradores\.hotmart\.com/);
  assert.match(
    prompt,
    /solicitar reembolso/i,
    "sumiu o passo final do caminho (a opção de pedir o reembolso)",
  );
  assert.match(
    prompt,
    /MESMO e-mail da compra/i,
    "sem o aviso do e-mail da compra o aluno entra na Hotmart e não acha a compra",
  );
});

test("o caminho do reembolso é condicionado a DENTRO, e não oferecido a seco", () => {
  // Se a instrução não amarrar o caminho à linha da conta, ela vira permissão
  // pra mandar TODO mundo na Hotmart — inclusive quem está fora da janela.
  assert.match(
    REGRAS,
    /Só ofereça este caminho se a linha GARANTIA HOTMART do bloco da conta disser DENTRO/,
    "a condição que amarra o caminho do reembolso à linha da conta sumiu",
  );
});

test("FORA da janela: o prompt manda NÃO afirmar garantia e NÃO mandar pedir na Hotmart", () => {
  const prompt = promptCom(GARANTIA_FORA);
  assert.match(
    prompt,
    /NÃO afirme que há garantia/,
    "sumiu a proibição de afirmar garantia quando a linha diz FORA",
  );
  assert.match(
    prompt,
    /NÃO mande a pessoa pedir reembolso na Hotmart/,
    "sem isto a Fast manda quem está FORA bater numa parede na Hotmart",
  );
  assert.match(prompt, /NÃO prometa reembolso deste produto/, "a linha da conta perdeu a ordem do #198");
  // e a data que existe no prompt é a do FIM da janela vencida, dita como
  // vencida — não há data nenhuma apresentada como prazo ainda aberto
  assert.ok(prompt.includes(diaBR(FIM_FORA)));
});

test("linha de garantia AUSENTE (ESCALAR): nenhuma data e nenhuma promessa de janela", () => {
  const prompt = promptCom(GARANTIA_ESCALAR);
  assert.match(prompt, /NÃO afirme nada sobre prazo de garantia/);
  assert.match(prompt, /ou se ela não existir no bloco da conta/);
  // Nenhuma data em formato dd/mm/aaaa pode ter vindo do TEXTO FIXO das regras:
  // toda data que a Fast cita tem que vir da linha da conta, e aqui não há linha.
  assert.deepEqual(
    REGRAS.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) ?? [],
    [],
    "há data fixa escrita nas regras — data só pode vir da linha GARANTIA HOTMART",
  );
});

test("as regras NUNCA citam um número de dias de garantia (#265)", () => {
  // A janela real varia por produto (6, 7, 14, 15 ou 30 dias no que a Hotmart já
  // mandou). Um "7 dias" escrito aqui reintroduz pela instrução exatamente o
  // número que a conta parou de usar.
  for (const texto of [REGRAS, REGRAS_SEM_CONTA]) {
    const achados = texto.match(/\b\d+\s*dias?\b/gi) ?? [];
    assert.deepEqual(
      achados,
      [],
      `as regras voltaram a citar prazo em dias (${achados.join(", ")}) — só a DATA da linha da conta vale`,
    );
  }
  assert.match(REGRAS, /NUNCA um número de dias/, "sumiu a proibição explícita de citar dias");
});

// ── (A) CANCELAMENTO: o teste que fecha o #400 ─────────────────────────────

test("#400: as regras NÃO mandam o aluno cancelar a assinatura sozinho na Hotmart", () => {
  assert.match(
    REGRAS,
    /NUNCA mande a pessoa cancelar sozinha na Hotmart/,
    "sumiu a proibição que é o #400 inteiro: cancelamento é da casa, não do aluno",
  );
  assert.match(
    REGRAS,
    /NUNCA diga que ela precisa resolver o cancelamento com a Hotmart/,
    "a variante 'fale com a Hotmart' é o mesmo empurrão com outro nome",
  );
  assert.match(
    REGRAS,
    /quem cancela é A CASA, a pedido do titular/i,
    "sumiu a regra 9-C (21/08): a casa cancela a pedido do titular",
  );
});

test("#400: o cancelamento é CONFIRMADO como registrado, não deixado no ar", () => {
  assert.match(
    REGRAS,
    /pedido de cancelamento dela foi REGISTRADO/,
    "sem isto a carta volta a ser 'a equipe confirma em breve', que é o defeito medido",
  );
  assert.match(
    REGRAS,
    /continua valendo até o fim do período contratado/,
    "sem esta frase o aluno acha que cancelar apaga o crédito que ele já pagou (regra 9)",
  );
});

test("os dois pedidos são SEPARADOS, não tratados como um só", () => {
  assert.match(REGRAS, /são DOIS pedidos diferentes, com donos diferentes/);
  const iCancel = REGRAS.indexOf("(A) CANCELAR A ASSINATURA");
  const iReemb = REGRAS.indexOf("(B) REEMBOLSO");
  assert.ok(iCancel > -1, "o bloco (A) de cancelamento sumiu");
  assert.ok(iReemb > iCancel, "o bloco (B) de reembolso sumiu ou trocou de lugar");
});

// ── o que NÃO pode afrouxar ────────────────────────────────────────────────

test("a Fast continua proibida de confirmar reembolso ou cancelamento ela mesma", () => {
  assert.match(REGRAS, /NUNCA confirme um reembolso você mesma/);
  assert.match(REGRAS, /NUNCA diga que já cancelou ou já estornou/);
});

test("explicar o caminho NÃO substitui o [ESCALAR] — ele continua obrigatório", () => {
  // É o risco óbvio desta mudança: a Fast passar a achar que, tendo explicado, o
  // chamado não precisa existir. Aí o aluno some da fila.
  assert.match(REGRAS, /finalize SEMPRE com \[ESCALAR: resumo\]/);
  assert.match(
    REGRAS,
    /Explicar o caminho NÃO substitui o registro do chamado/,
    "sumiu a frase que impede a Fast de trocar o chamado pela explicação",
  );
  assert.match(REGRAS, /\[ESCALAR: pedido de cancelamento de assinatura\]/);
  // e o ramo FORA também termina escalando
  assert.match(REGRAS, /diga que a equipe vai verificar o caso dela, e escale/);
});

test("as regras saem nos DOIS ramos (com conta e sem conta identificada)", () => {
  // O ramo `accountFound=false` é o de quem escreve de outro e-mail — e é
  // justamente quem mais pede reembolso achando que não tem cadastro.
  for (const [nome, texto] of [["com conta", REGRAS], ["sem conta", REGRAS_SEM_CONTA]] as const) {
    assert.match(texto, /\(A\) CANCELAR A ASSINATURA/, `o bloco (A) sumiu do ramo ${nome}`);
    assert.match(texto, /\(B\) REEMBOLSO/, `o bloco (B) sumiu do ramo ${nome}`);
    assert.match(texto, /compradores\.hotmart\.com/, `o caminho da Hotmart sumiu do ramo ${nome}`);
  }
});

// ── (C) o WhatsApp de fallback ─────────────────────────────────────────────

test("o WhatsApp aparece como fallback, com o número OFICIAL e o link derivado dele", () => {
  assert.ok(
    REGRAS.includes(WHATSAPP_SUPORTE_CURSO),
    "o número oficial não está nas regras — sem ele a Fast não tem o que oferecer e inventa (#414)",
  );
  assert.ok(REGRAS.includes(WHATSAPP_SUPORTE_LINK));
  assert.equal(WHATSAPP_SUPORTE_LINK, "https://wa.me/5541991481573");
  assert.match(
    REGRAS,
    /SE A PESSOA NÃO CONSEGUIR pelo caminho acima/,
    "o zap virou primeira opção em vez de fallback",
  );
});

test("a casa OFERECE o número e NUNCA promete abordar o aluno no WhatsApp", () => {
  assert.match(
    REGRAS,
    /nunca prometa que alguém vai ligar, chamar ou entrar em contato por WhatsApp/i,
    "sumiu a regra da casa: quem começa a conversa no zap é o cliente",
  );
  assert.match(REGRAS, /ELA pode chamar por lá/);
});

test("o número vem da CONSTANTE, não de um literal colado no arquivo (#414)", () => {
  assert.match(
    FONTE,
    /import\s*\{[^}]*WHATSAPP_SUPORTE_CURSO[^}]*\}\s*from\s*"@\/lib\/payments\/sgp-boas-vindas"/,
    "mail-respond.ts parou de importar WHATSAPP_SUPORTE_CURSO — o número virou cópia solta",
  );
  assert.doesNotMatch(
    FONTE.replace(/^\s*\*.*$/gm, ""), // os comentários citam o número ao contar o #414
    /\(41\)\s*9\s*9148-1573/,
    "o número foi hardcoded no código; ele tem que vir da constante",
  );
});

test("NENHUM telefone fora do oficial aparece nas regras (o teste do #414)", () => {
  // Mesmo detector do `manual-contatos.test.ts`: máscara fixa não pega
  // "(41) 9 8878-6342", que foi a forma REAL que chegou na aluna.
  const so = (s: string) => s.replace(/\D/g, "");
  const alvo = so(WHATSAPP_SUPORTE_CURSO);
  const digitos = (REGRAS.match(/\+?\d[\d\s()+.-]{6,}\d/g) ?? [])
    .map(so)
    .filter((d) => d.length >= 8 && d.length <= 13);
  const forasteiros = [...new Set(digitos)].filter((d) => {
    const x = d.replace(/^55/, "");
    return !(x === alvo || alvo.endsWith(x) || x.endsWith(alvo));
  });
  assert.deepEqual(
    forasteiros,
    [],
    "apareceu telefone que não é o oficial nas regras da Fast — todo número aqui vira " +
      "cobrança na mão de estranho (#414: R$ 2.712,12 no zap de um comércio)",
  );
  assert.ok(digitos.length > 0, "o detector não achou nenhum telefone — ele ficou cego");
});
