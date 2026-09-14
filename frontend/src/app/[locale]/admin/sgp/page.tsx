"use client";

/**
 * /admin/sgp — a fila do SGP para o TIME DE SUPORTE.
 *
 * Pedido do Lucas (02/09): o time precisa ver sozinho quem já foi feito e qual
 * o próximo passo. A tela toda é otimizada pra UMA pergunta: *quem precisa que
 * eu faça alguma coisa agora?* Por isso quem está parado há mais de 48h vem no
 * topo, marcado, e a coluna "O que fazer" vem antes de qualquer detalhe técnico.
 *
 * Pedido do Lucas (04/09): o time já cobra o aluno no WhatsApp, mas a tela
 * continuava gritando. Daí o botão "Já cobrei" — que NÃO some com a linha. O
 * aluno continua parado, então ele continua na tabela, só que sem o vermelho e
 * com quem cobrou e quando. Passada a janela, ele volta a gritar sozinho.
 *
 * Pedido do Lucas (08/09): a tela mostrava só quem ABRIU o portal — 27 pedidos.
 * Só que são 103 compradores pagos, e 90 deles nunca começaram: não têm linha em
 * `sgp_pedidos` e não apareciam em tela nenhuma. Daí a segunda aba, "Todos os
 * compradores", em formato de planilha pro time entrar em contato. A primeira
 * aba (a fila de trabalho) NÃO mudou: ela continua sendo o que se olha no dia a
 * dia, e a nova é a lista de prospecção.
 *
 * A régua (tradução do status, frase de ação, contadores, ordem, silêncio da
 * cobrança) mora em lib/sgp/painel.ts e lib/sgp/compradores.ts e é calculada no
 * servidor — aqui é só desenho.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, MessageCircle, Undo2, XCircle } from "lucide-react";
import {
  SGP_PARADO_HORAS,
  type LinhaPainel,
  type ResumoPainel,
  type SituacaoSgp,
} from "@/lib/sgp/painel";
import {
  telefoneLegivel,
  type AssinaturaFastCloner,
  type LinhaComprador,
  type ResumoCompradores,
} from "@/lib/sgp/compradores";

type EstadoCobranca = { disponivel: boolean; silencioHoras: number };

type Aba = "fila" | "todos";

/**
 * A etiqueta PRONTO / AGUARDANDO / ERRO (pedido do Lucas, 10/09).
 *
 * A régua de QUEM é o quê mora em lib/sgp/painel.ts › situacao e é calculada no
 * servidor; aqui é só cor. Ela fica ao lado da etapa, não no lugar dela: a etapa
 * diz *em que passo está* e a situação diz *pronto, esperando ou quebrado* — a
 * segunda é a que o time lê de longe, e é a leitura que a planilha antiga tinha.
 */
const CORES_SITUACAO: Record<SituacaoSgp, string> = {
  pronto: "border-[var(--status-online)]/40 bg-[var(--status-online)]/10 text-[var(--status-online)]",
  aguardando: "border-[var(--hairline-strong)] bg-[var(--surface-deep)] text-[var(--mute)]",
  erro: "border-[var(--status-error)]/40 bg-[var(--status-error)]/10 text-[var(--status-error)]",
};

function Etiqueta({
  situacao,
  rotulo,
  motivo,
}: {
  situacao: SituacaoSgp;
  rotulo: string;
  motivo: string;
}) {
  return (
    <span className="flex flex-col gap-1">
      <span
        title={motivo}
        className={`inline-flex w-fit items-center rounded-[var(--radius-full)] border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${CORES_SITUACAO[situacao]}`}
      >
        {rotulo}
      </span>
      {/* O motivo fica ESCRITO, não só no title: o time lê a tela de relance e
          num tablet não existe hover. Um rótulo sem porquê vira adivinhação. */}
      <span className="max-w-[220px] text-[11px] leading-snug text-[var(--mute)]">{motivo}</span>
    </span>
  );
}

const dt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** Só o dia, que é o que a planilha pede: "05/09/2026". */
const dia = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

export default function SgpPage() {
  const [pedidos, setPedidos] = useState<LinhaPainel[]>([]);
  const [resumo, setResumo] = useState<ResumoPainel | null>(null);
  const [cobranca, setCobranca] = useState<EstadoCobranca | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /** Id da linha com clique em voo — desabilita o botão e evita clique duplo. */
  const [salvando, setSalvando] = useState<string | null>(null);

  const [erroManualOk, setErroManualOk] = useState(false);
  /**
   * Qual linha está com o campo de "marcar erro" aberto, e o que já foi digitado.
   *
   * ⚠️ FICA FORA DO `pedidos`, e é o ponto do requisito: a tela recarrega sozinha
   * a cada 30s. Se o rascunho morasse na linha (ou se o refresh fechasse o
   * campo), o atendente digitaria metade do motivo e perderia no meio da frase.
   * `load()` só troca `pedidos` — estes dois estados atravessam o refresh
   * intactos, e a marcação já salva vem do servidor.
   */
  const [abertoErro, setAbertoErro] = useState<string | null>(null);
  const [rascunhoErro, setRascunhoErro] = useState<Record<string, string>>({});

  const [aba, setAba] = useState<Aba>("fila");
  const [compradores, setCompradores] = useState<LinhaComprador[] | null>(null);
  const [resumoTodos, setResumoTodos] = useState<ResumoCompradores | null>(null);
  const [carregandoTodos, setCarregandoTodos] = useState(false);
  const [erroTodos, setErroTodos] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/sgp", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setPedidos(json.pedidos ?? []);
        setResumo(json.resumo ?? null);
        setCobranca(json.cobranca ?? null);
        setErroManualOk(!!json.erroManual?.disponivel);
        setErro(null);
      } else {
        setErro(json?.error?.message || "Não consegui carregar a fila.");
      }
    } catch {
      setErro("Não consegui carregar a fila.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    const puxar = () => {
      if (vivo) void load();
    };
    puxar();
    const id = setInterval(puxar, 30_000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [load]);

  /**
   * A planilha de TODOS os compradores.
   *
   * ⚠️ FORA DO POLLING DE 30s, de propósito: a consulta dela varre os 1.917
   * PURCHASE_APPROVED do banco (o id do produto vive dentro do JSON, então o
   * filtro é em código). Pendurar isso num intervalo de 30s com a aba aberta
   * seria martelar o banco pra uma lista que muda algumas vezes por dia. Carrega
   * ao abrir a aba, e recarrega no botão.
   */
  const carregarTodos = useCallback(async () => {
    setCarregandoTodos(true);
    try {
      const res = await fetch("/api/v1/admin/sgp/compradores", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setCompradores(json.compradores ?? []);
        setResumoTodos(json.resumo ?? null);
        setErroTodos(null);
      } else {
        setErroTodos(json?.error?.message || "Não consegui carregar a lista de compradores.");
      }
    } catch {
      setErroTodos("Não consegui carregar a lista de compradores.");
    } finally {
      setCarregandoTodos(false);
    }
  }, []);

  useEffect(() => {
    if (aba === "todos" && compradores === null && !carregandoTodos) void carregarTodos();
  }, [aba, compradores, carregandoTodos, carregarTodos]);

  /** Marca ou desfaz a cobrança e recarrega — a régua toda é recalculada no servidor. */
  const marcarCobranca = useCallback(
    async (id: string, marcar: boolean) => {
      setSalvando(id);
      try {
        const res = await fetch(`/api/v1/admin/sgp/${id}/cobranca`, {
          method: marcar ? "POST" : "DELETE",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setErro(json?.error?.message || "Não consegui registrar a cobrança.");
          return;
        }
        setErro(null);
        await load();
      } catch {
        setErro("Não consegui registrar a cobrança.");
      } finally {
        setSalvando(null);
      }
    },
    [load],
  );

  /**
   * Marca ou desfaz o "deu erro" e recarrega — mesma forma do "Já cobrei": o
   * mesmo `salvando` (que trava o clique duplo), o mesmo reload, o mesmo lugar
   * de mensagem de erro. O motivo é opcional; vai truncado em 500 na rota.
   */
  const marcarErro = useCallback(
    async (id: string, marcar: boolean) => {
      setSalvando(id);
      try {
        const res = await fetch(`/api/v1/admin/sgp/${id}/erro`, {
          method: marcar ? "POST" : "DELETE",
          ...(marcar
            ? {
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ motivo: rascunhoErro[id] ?? "" }),
              }
            : {}),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setErro(json?.error?.message || "Não consegui marcar o erro.");
          return;
        }
        setErro(null);
        // Só limpa o rascunho DEPOIS de o servidor confirmar. Se falhar, o que a
        // pessoa escreveu continua na tela pra ela tentar de novo.
        setRascunhoErro((r) => {
          const resto = { ...r };
          delete resto[id];
          return resto;
        });
        setAbertoErro(null);
        await load();
      } catch {
        setErro("Não consegui marcar o erro.");
      } finally {
        setSalvando(null);
      }
    },
    [load, rascunhoErro],
  );

  const silencioHoras = cobranca?.silencioHoras ?? SGP_PARADO_HORAS;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Sistema de Geração Pronto
        </h1>
        <p className="mt-1 text-[14px] text-[var(--mute)]">
          {aba === "fila"
            ? "Quem pediu, em que pé está e o que o time precisa fazer · atualiza a cada 30s"
            : "Todo mundo que comprou o SGP, tenha começado o portal ou não · lista para entrar em contato"}
        </p>
      </div>

      {/* As duas leituras da mesma operação: o que fazer HOJE × com quem falar. */}
      <div className="flex gap-1 border-b border-[var(--hairline-strong)]">
        <BotaoAba ativa={aba === "fila"} onClick={() => setAba("fila")}>
          Fila de trabalho{resumo ? ` (${resumo.total})` : ""}
        </BotaoAba>
        <BotaoAba ativa={aba === "todos"} onClick={() => setAba("todos")}>
          Todos os compradores{resumoTodos ? ` (${resumoTodos.total})` : ""}
        </BotaoAba>
      </div>

      {aba === "todos" ? (
        <AbaCompradores
          linhas={compradores}
          resumo={resumoTodos}
          carregando={carregandoTodos}
          erro={erroTodos}
          onRecarregar={carregarTodos}
        />
      ) : (
        <>
      {/* Banner: a única pergunta que importa de longe. */}
      <div
        className={`flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3.5 ${
          resumo?.parados
            ? "border-[var(--status-error)]/40 bg-[var(--status-error)]/5"
            : "border-[var(--status-online)]/30 bg-[var(--status-online)]/5"
        }`}
      >
        {resumo?.parados ? (
          <AlertTriangle className="size-5 shrink-0 text-[var(--status-error)]" />
        ) : (
          <CheckCircle2 className="size-5 shrink-0 text-[var(--status-online)]" />
        )}
        <span className="text-[14px] text-[var(--ink)]">
          {resumo?.parados
            ? `${resumo.parados} aluno(s) parados há mais de ${SGP_PARADO_HORAS}h — precisam ser cobrados`
            : "Ninguém parado. Nada precisando de cobrança ✅"}
          {/* Cobrado NÃO é resolvido: continua contado à parte, à vista. */}
          {resumo?.cobrados ? (
            <span className="text-[var(--mute)]">
              {" "}
              · {resumo.cobrados} já cobrado(s), esperando o aluno responder
            </span>
          ) : null}
        </span>
      </div>

      {/* Os três buckets da planilha primeiro, a etapa detalhada depois: é a
          ordem em que o time lê — "quantos estão quebrados?" antes de "quantos
          estão gravando o áudio?". */}
      {resumo && resumo.total > 0 && (
        <div className="flex flex-wrap gap-2">
          <Contador rotulo="Total" n={resumo.total} />
          <Contador rotulo="PRONTO" n={resumo.situacoes.pronto} />
          <Contador rotulo="AGUARDANDO" n={resumo.situacoes.aguardando} />
          <Contador rotulo="ERRO" n={resumo.situacoes.erro} />
        </div>
      )}

      {/* Contadores por etapa. */}
      {resumo && resumo.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {resumo.porEtapa.map((e) => (
            <Contador key={e.status} rotulo={e.etapa} n={e.n} />
          ))}
        </div>
      )}

      {erro && (
        <p className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--status-error)]/5 px-4 py-3 text-[13px] text-[var(--status-error)]">
          {erro}
        </p>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        {loading ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">carregando…</div>
        ) : pedidos.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">
            nenhum pedido de SGP ainda
          </div>
        ) : (
          <table className="w-full min-w-[1500px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--hairline-strong)] bg-[var(--surface-deep)]">
                {/* ORDEM DAS COLUNAS = ALCANCE DO BOTÃO (14/09).
                    A tabela é larga demais pra caber na tela (medido: 1787px de
                    conteúdo contra 1158px de área útil num monitor de 1240px),
                    então ela SEMPRE vai rolar de lado. O que decide se o time
                    consegue clicar é o que cabe ANTES do corte.
                    Por isso E-mail e WhatsApp (que juntos custavam 404px e não
                    são usados pra DECIDIR, só depois de decidir) saíram da
                    frente e foram pra logo depois dos botões. Assim as sete
                    colunas de decisão + os dois botões somam 1050px e cabem
                    inteiros; o contato fica a um passo de rolagem, e nada
                    sumiu da tabela. */}
                <Th>Nome</Th>
                <Th>Situação</Th>
                <Th>Etapa atual</Th>
                <Th>Parado há</Th>
                <Th>O que fazer</Th>
                <Th>Cobrança</Th>
                <Th>Marcar erro</Th>
                <Th>WhatsApp</Th>
                <Th>E-mail</Th>
                <Th>Foto</Th>
                <Th>Voz</Th>
                <Th>Enviado em</Th>
                <Th>Erro</Th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-[var(--hairline)] align-top ${
                    p.precisaAcao
                      ? "bg-[var(--status-error)]/[0.07]"
                      : p.silenciado
                        ? // Já cobrado: sai do vermelho, mas não vira uma linha
                          // qualquer — o aluno continua travado.
                          "bg-[var(--status-warn)]/[0.07]"
                        : "bg-[var(--surface-card)]"
                  }`}
                >
                  <Td className="font-medium text-[var(--ink)]">
                    {p.parado && (
                      <span className="mr-1.5 inline-block align-middle text-[var(--status-error)]">●</span>
                    )}
                    {p.nome}
                  </Td>
                  <Td className="min-w-[180px]">
                    <Etiqueta
                      situacao={p.situacao}
                      rotulo={p.situacaoRotulo}
                      motivo={p.situacaoMotivo}
                    />
                  </Td>
                  <Td>{p.etapa}</Td>
                  <Td
                    className={`font-mono text-[11px] tabular-nums ${
                      p.parado ? "font-semibold text-[var(--status-error)]" : "text-[var(--mute)]"
                    }`}
                  >
                    {p.paradoTexto}
                  </Td>
                  {/* A coluna que o time realmente lê. */}
                  <Td className="max-w-[300px] text-[var(--body)]">{p.oQueFazer}</Td>
                  <Td className="min-w-[190px]">
                    <CelulaCobranca
                      linha={p}
                      disponivel={cobranca?.disponivel ?? false}
                      salvando={salvando === p.id}
                      onMarcar={() => marcarCobranca(p.id, true)}
                      onDesfazer={() => marcarCobranca(p.id, false)}
                    />
                  </Td>
                  <Td className="min-w-[210px]">
                    <CelulaMarcarErro
                      linha={p}
                      disponivel={erroManualOk}
                      salvando={salvando === p.id}
                      aberto={abertoErro === p.id}
                      rascunho={rascunhoErro[p.id] ?? ""}
                      onAbrir={() => setAbertoErro(p.id)}
                      onFechar={() => setAbertoErro(null)}
                      onDigitar={(v) => setRascunhoErro((r) => ({ ...r, [p.id]: v }))}
                      onMarcar={() => marcarErro(p.id, true)}
                      onDesfazer={() => marcarErro(p.id, false)}
                    />
                  </Td>
                  {/* Contato logo depois dos botões: é o que se usa DEPOIS de
                      decidir cobrar, não pra decidir. */}
                  <Td className="font-mono text-[11px] text-[var(--mute)]">
                    {p.whatsapp === "—" ? "—" : telefoneLegivel(p.whatsapp)}
                  </Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{p.email}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{p.foto}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{p.voz}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{dt(p.enviadoEm)}</Td>
                  <Td className="max-w-[220px] font-mono text-[11px] text-[var(--status-error)]">
                    {p.erro ?? "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[12px] text-[var(--ash)]">
        <strong>Situação</strong> é a leitura de planilha: <strong>PRONTO</strong> é entregue,{" "}
        <strong>ERRO</strong> é o que alguém precisa olhar (o sistema falhou, falhou em parte, ou o time
        marcou na mão) e <strong>AGUARDANDO</strong> é todo o resto — esperando o aluno, na fila ou
        gerando. ERRO ganha de PRONTO de propósito: material entregue errado é um pedido pronto que
        precisa de gente.{" "}
        {erroManualOk ? (
          <>
            Em <strong>Marcar erro</strong> o time registra o que descobriu por fora (o aluno avisou no
            WhatsApp, o material veio errado). Essa marca <strong>não vence sozinha</strong> — sai só no{" "}
            <strong>desfazer</strong>. Ela não muda nada na produção: não manda e-mail pro aluno e não
            mexe no andamento do pedido.
          </>
        ) : (
          <>
            O botão <strong>Marcar erro</strong> ainda não está liberado — falta uma atualização do
            sistema.
          </>
        )}{" "}
        &ldquo;Parado há&rdquo; conta desde a última vez que o pedido andou. Marcado em vermelho quando passa
        de {SGP_PARADO_HORAS}h no mesmo passo — é o único caso que precisa de alguém cobrando o aluno.{" "}
        {cobranca?.disponivel ? (
          <>
            Ao clicar em <strong>Já cobrei</strong> a linha sai do vermelho por {silencioHoras}h e{" "}
            <strong>continua na tabela</strong> — se o aluno não mexer nesse tempo, ela volta a avisar
            sozinha. Nada some daqui até o aluno andar.
          </>
        ) : (
          <>O botão de marcar cobrança ainda não está liberado — falta uma atualização do sistema.</>
        )}
      </p>
        </>
      )}
    </div>
  );
}

function BotaoAba({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] transition-colors ${
        ativa
          ? "border-[var(--ink)] font-medium text-[var(--ink)]"
          : "border-transparent text-[var(--mute)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A célula de cobrança. Três estados, e nenhum deles esconde a linha:
 *  - já cobrado e dentro da janela → quem cobrou, quando, e quando volta a avisar;
 *  - parado sem cobrança → o botão;
 *  - resto → um traço (não há o que cobrar).
 */
function CelulaCobranca({
  linha,
  disponivel,
  salvando,
  onMarcar,
  onDesfazer,
}: {
  linha: LinhaPainel;
  disponivel: boolean;
  salvando: boolean;
  onMarcar: () => void;
  onDesfazer: () => void;
}) {
  if (linha.cobradoTexto) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--body)]">
          <Clock className="size-3.5 shrink-0 text-[var(--mute)]" />
          {linha.cobradoTexto}
        </span>
        {linha.voltaAAvisarTexto && (
          <span className="font-mono text-[10px] text-[var(--ash)]">{linha.voltaAAvisarTexto}</span>
        )}
        {disponivel && (
          <button
            type="button"
            onClick={onDesfazer}
            disabled={salvando}
            className="inline-flex w-fit items-center gap-1 text-[11px] text-[var(--mute)] underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-50"
          >
            <Undo2 className="size-3" />
            {salvando ? "desfazendo…" : "desfazer"}
          </button>
        )}
      </div>
    );
  }

  // Só faz sentido oferecer o botão pra quem está de fato parado esperando cobrança.
  if (!linha.parado) return <span className="text-[12px] text-[var(--ash)]">—</span>;

  if (!disponivel) {
    return <span className="text-[11px] text-[var(--ash)]">registro ainda não liberado</span>;
  }

  return (
    <button
      type="button"
      onClick={onMarcar}
      disabled={salvando}
      className="rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-deep)] disabled:opacity-50"
    >
      {salvando ? "marcando…" : "Já cobrei"}
    </button>
  );
}

/**
 * "Marcar erro" (pedido do Lucas, 10/09): o time descobriu POR FORA que o pedido
 * deu errado — o aluno avisou no WhatsApp, o material veio errado — e o sistema
 * não tem como saber disso sozinho.
 *
 * Mesma forma da célula de cobrança de propósito (é o padrão que o time já usa e
 * que funciona): três estados, nenhum deles esconde a linha, e sempre há como
 * desfazer. Duas diferenças, as duas deliberadas:
 *
 *  1. O BOTÃO APARECE EM QUALQUER LINHA, inclusive nas ENTREGUES. "Material veio
 *     errado" é, por definição, um pedido que o sistema deu por pronto — limitar
 *     a marcação a quem está parado deixaria de fora justamente o caso do pedido.
 *  2. A MARCA NÃO VENCE. "Já cobrei" é um timer que volta a gritar; "deu erro" é
 *     uma afirmação de defeito. Ela sai por "desfazer", não pelo relógio.
 */
function CelulaMarcarErro({
  linha,
  disponivel,
  salvando,
  aberto,
  rascunho,
  onAbrir,
  onFechar,
  onDigitar,
  onMarcar,
  onDesfazer,
}: {
  linha: LinhaPainel;
  disponivel: boolean;
  salvando: boolean;
  aberto: boolean;
  rascunho: string;
  onAbrir: () => void;
  onFechar: () => void;
  onDigitar: (v: string) => void;
  onMarcar: () => void;
  onDesfazer: () => void;
}) {
  if (linha.erroManualTexto) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-start gap-1.5 text-[12px] text-[var(--status-error)]">
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          {linha.erroManualTexto}
        </span>
        {linha.erroManualMotivo && (
          <span className="max-w-[200px] text-[11px] leading-snug text-[var(--body)]">
            &ldquo;{linha.erroManualMotivo}&rdquo;
          </span>
        )}
        {disponivel && (
          <button
            type="button"
            onClick={onDesfazer}
            disabled={salvando}
            className="inline-flex w-fit items-center gap-1 text-[11px] text-[var(--mute)] underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-50"
          >
            <Undo2 className="size-3" />
            {salvando ? "desfazendo…" : "desfazer"}
          </button>
        )}
      </div>
    );
  }

  if (!disponivel) {
    return <span className="text-[11px] text-[var(--ash)]">marcação ainda não liberada</span>;
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={onAbrir}
        className="rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--status-error)]/50 hover:bg-[var(--status-error)]/5 disabled:opacity-50"
      >
        Marcar erro
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={rascunho}
        onChange={(e) => onDigitar(e.target.value)}
        rows={2}
        maxLength={500}
        autoFocus
        placeholder="O que aconteceu? (opcional)"
        className="w-[200px] resize-y rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-2 py-1.5 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--status-error)]/60"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMarcar}
          disabled={salvando}
          className="rounded-[var(--radius)] border border-[var(--status-error)]/50 bg-[var(--status-error)]/10 px-2.5 py-1.5 text-[12px] font-medium text-[var(--status-error)] transition-colors hover:bg-[var(--status-error)]/20 disabled:opacity-50"
        >
          {salvando ? "marcando…" : "Confirmar erro"}
        </button>
        {/* "cancelar" fecha o campo mas NÃO apaga o que foi digitado: reabrir
            devolve o texto. Perder o motivo por um clique errado é o tipo de
            atrito que faz o time voltar pra planilha. */}
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          className="text-[11px] text-[var(--mute)] underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-50"
        >
          cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * A planilha de TODOS os compradores (pedido do Lucas, 08/09).
 *
 * As colunas são as que ele pediu, nesta ordem: Nome, Status, Data de
 * Aquisição, Celular, E-mail, Data de envio. Nada além disso — a fila de
 * trabalho continua sendo o lugar do detalhe operacional.
 *
 * O celular é LINK de WhatsApp porque é o uso real do time: a lista existe pra
 * eles saírem chamando essa gente, e copiar número na mão a cada linha é o tipo
 * de atrito que faz a planilha ser abandonada.
 */
function AbaCompradores({
  linhas,
  resumo,
  carregando,
  erro,
  onRecarregar,
}: {
  linhas: LinhaComprador[] | null;
  resumo: ResumoCompradores | null;
  carregando: boolean;
  erro: string | null;
  onRecarregar: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* O número que motivou a tela: quanta gente pagou e nunca apareceu. */}
      {resumo && (
        <div
          className={`flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3.5 ${
            resumo.naoComecaram
              ? "border-[var(--status-warn)]/40 bg-[var(--status-warn)]/5"
              : "border-[var(--status-online)]/30 bg-[var(--status-online)]/5"
          }`}
        >
          {resumo.naoComecaram ? (
            <AlertTriangle className="size-5 shrink-0 text-[var(--status-warn)]" />
          ) : (
            <CheckCircle2 className="size-5 shrink-0 text-[var(--status-online)]" />
          )}
          <span className="text-[14px] text-[var(--ink)]">
            {resumo.naoComecaram
              ? `${resumo.naoComecaram} pessoa(s) compraram e ainda NÃO começaram o portal — é com elas que o time precisa falar`
              : "Todo mundo que comprou já começou o portal ✅"}
          </span>
        </div>
      )}

      {/* Os três buckets primeiro, pelo mesmo motivo da outra aba. */}
      {resumo && (
        <div className="flex flex-wrap gap-2">
          <Contador rotulo="PRONTO" n={resumo.situacoes.pronto} />
          <Contador rotulo="AGUARDANDO" n={resumo.situacoes.aguardando} />
          <Contador rotulo="ERRO" n={resumo.situacoes.erro} />
        </div>
      )}

      {resumo && (
        <div className="flex flex-wrap gap-2">
          <Contador rotulo="Total" n={resumo.total} />
          <Contador rotulo="Não começaram" n={resumo.naoComecaram} />
          <Contador rotulo="Começaram" n={resumo.comecaram} />
          <Contador rotulo="Entregues" n={resumo.entregues} />
          <Contador rotulo="Esperando +48h" n={resumo.parados} />
          {resumo.semTelefone > 0 && <Contador rotulo="Sem telefone" n={resumo.semTelefone} />}
          {/* Só quando a assinatura foi de fato consultada: contador zerado por
              ignorância mentiria "ninguém paga". */}
          {resumo.fastclonerConsultados > 0 && (
            <>
              <Contador rotulo="Pagam o FastCloner" n={resumo.fastclonerPagantes} />
              <Contador rotulo="Trial (não pagam)" n={resumo.fastclonerTrial} />
            </>
          )}
        </div>
      )}

      {erro && (
        <p className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--status-error)]/5 px-4 py-3 text-[13px] text-[var(--status-error)]">
          {erro}
        </p>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        {carregando && linhas === null ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">carregando…</div>
        ) : !linhas || linhas.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">
            nenhum comprador de SGP encontrado
          </div>
        ) : (
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--hairline-strong)] bg-[var(--surface-deep)]">
                <Th>Nome</Th>
                <Th>Situação</Th>
                <Th>Status</Th>
                <Th>FastCloner</Th>
                <Th>Data Aquisição</Th>
                <Th>Celular</Th>
                <Th>E-mail</Th>
                <Th>Data de envio</Th>
                <Th>Esperando há</Th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => (
                <tr
                  key={c.chave}
                  className={`border-t border-[var(--hairline)] align-top ${
                    c.concluido
                      ? "bg-[var(--surface-card)]"
                      : c.parado
                        ? "bg-[var(--status-warn)]/[0.07]"
                        : "bg-[var(--surface-card)]"
                  }`}
                >
                  <Td className="font-medium text-[var(--ink)]">{c.nome}</Td>
                  <Td className="min-w-[180px]">
                    <Etiqueta
                      situacao={c.situacao}
                      rotulo={c.situacaoRotulo}
                      motivo={c.situacaoMotivo}
                    />
                  </Td>
                  <Td>
                    {c.status}
                    {/* Quem nunca abriu o portal é o alvo da lista: fica dito. */}
                    {c.statusPedido === null && (
                      <span className="ml-1.5 rounded-[var(--radius-full)] border border-[var(--hairline-strong)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ash)]">
                        contatar
                      </span>
                    )}
                  </Td>
                  <Td>
                    <CelulaFastCloner a={c.fastcloner} />
                  </Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">
                    {c.semCompraRegistrada ? (
                      // NUNCA uma data inventada: quem entrou no portal antes de
                      // o webhook do SGP existir não tem compra registrada, e a
                      // tela diz isso em vez de chutar um dia.
                      <span
                        className="text-[var(--ash)]"
                        title="Está no portal, mas não temos a compra registrada — provavelmente entrou antes de o registro de compras do SGP existir."
                      >
                        — sem registro
                      </span>
                    ) : (
                      dia(c.dataAquisicao)
                    )}
                  </Td>
                  <Td className="font-mono text-[11px]">
                    {c.celularDigitos ? (
                      <a
                        href={`https://wa.me/${c.celularDigitos}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[var(--ink)] underline underline-offset-2 hover:text-[var(--status-online)]"
                      >
                        <MessageCircle className="size-3.5 shrink-0" />
                        {c.celular}
                      </a>
                    ) : (
                      <span className="text-[var(--ash)]">—</span>
                    )}
                  </Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{c.email}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{dt(c.enviadoEm)}</Td>
                  <Td
                    className={`font-mono text-[11px] tabular-nums ${
                      c.parado ? "font-semibold text-[var(--status-warn)]" : "text-[var(--mute)]"
                    }`}
                  >
                    {c.concluido ? "—" : c.esperandoTexto}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-[12px] text-[var(--ash)]">
          A coluna <strong>Situação</strong> é a mesma régua da fila de trabalho (as duas abas nunca
          discordam sobre o mesmo aluno); quem comprou e não abriu o portal é <strong>AGUARDANDO</strong>
          , porque não há defeito nenhum — falta contato. Marcar erro se faz na aba{" "}
          <strong>Fila de trabalho</strong>, que é onde existe o pedido. Lista completa: quem comprou o
          SGP na Hotmart <strong>mais</strong> quem está no portal. Quem
          aparece nos dois lugares vem numa linha só. &ldquo;Esperando há&rdquo; conta desde a compra
          para quem nunca começou, e desde a última movimentação para quem já está no portal — destacado
          acima de {SGP_PARADO_HORAS}h. A coluna <strong>FastCloner</strong> é o que a pessoa paga na
          plataforma <strong>hoje</strong>: &ldquo;Paga&rdquo; é assinatura com cobrança confirmada,
          &ldquo;Trial&rdquo; é acesso vivo sem pagamento (adesão de valor zero). Ela é só informativa e{" "}
          <strong>não</strong> tira ninguém da lista. Esta aba <strong>não</strong> atualiza sozinha.
        </p>
        <button
          type="button"
          onClick={onRecarregar}
          disabled={carregando}
          className="shrink-0 rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-deep)] disabled:opacity-50"
        >
          {carregando ? "atualizando…" : "Atualizar"}
        </button>
      </div>
    </div>
  );
}

/**
 * O que a pessoa paga no FastCloner HOJE (pedido do Lucas, 09/09).
 *
 * ⚠️ POR QUE NÃO É "TEM ASSINATURA: SIM/NÃO": medido em 09/09, dos 112
 * compradores de SGP 11 têm assinatura viva — e só DOIS pagam. Os outros 9 são
 * trial de R$0. Um sim/não faria o time ler "11 clientes" onde há 2, e é
 * exatamente esse número que decide contato comercial.
 *
 * `null` é "não consultado", NÃO é "não assina" — mostra "—" e cala a boca em
 * vez de carimbar um estado que ninguém mediu.
 */
function CelulaFastCloner({ a }: { a: AssinaturaFastCloner | null }) {
  if (!a) return <span className="font-mono text-[11px] text-[var(--ash)]">—</span>;

  if (a.estado === "nao_assina") {
    return (
      <span className="font-mono text-[11px] text-[var(--ash)]" title="Sem assinatura viva da plataforma.">
        não assina
      </span>
    );
  }

  const paga = a.estado === "paga";
  return (
    <span className="flex flex-col gap-0.5">
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-full)] border px-2 py-0.5 font-mono text-[11px] ${
          paga
            ? "border-[var(--status-online)]/40 bg-[var(--status-online)]/10 text-[var(--status-online)]"
            : "border-[var(--hairline-strong)] text-[var(--mute)]"
        }`}
        title={
          paga
            ? "Assinatura paga do FastCloner (valor da cobrança mais recente confirmada)."
            : a.cobrancaNaoConfirmada
              ? "Tem acesso, mas a cobrança mais recente NÃO foi confirmada como paga pela Hotmart (boleto/atraso)."
              : "Tem acesso, mas não paga: adesão de valor zero (trial)."
        }
      >
        {paga ? "Paga" : "Trial"} {a.valorTexto}
      </span>
      <span className="font-mono text-[10px] text-[var(--ash)]">
        {a.vitalicio ? "vitalício" : `até ${dia(a.ate)}`}
        {a.cobrancaNaoConfirmada && !paga ? " · cobrança não confirmada" : ""}
      </span>
    </span>
  );
}

function Contador({ rotulo, n }: { rotulo: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border border-[var(--hairline-strong)] px-3 py-1">
      <span className="text-[12px] text-[var(--mute)]">{rotulo}</span>
      <span className="font-mono text-[12px] tabular-nums text-[var(--ink)]">{n}</span>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] font-normal uppercase tracking-wider text-[var(--ash)]">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 text-[13px] ${className}`}>{children}</td>;
}
