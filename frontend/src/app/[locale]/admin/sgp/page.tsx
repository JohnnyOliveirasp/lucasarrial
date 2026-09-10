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
 * Pedido do Lucas (10/09), com o print da tela na mão: as pílulas mostravam
 * onde o ALUNO está (cadastro / fotos / áudio / entregue), mas o time não via o
 * que a EQUIPE já fez. Na planilha antiga havia Realizado / Em Andamento /
 * Verificação / Erro marcados na mão, mais a coluna Responsável — e 54 pessoas
 * marcadas como Erro. Daí o filtro PRONTO × AGUARDANDO × ERRO e o botão de
 * marcar erro: o gesto que a planilha tinha e o sistema tinha perdido.
 *
 * A régua (tradução do status, frase de ação, contadores, ordem, silêncio da
 * cobrança, leitura do erro) mora em lib/sgp/painel.ts e lib/sgp/compradores.ts
 * e é calculada no servidor — aqui é só desenho.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageCircle,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import {
  ERRO_TEXTO_MAX,
  SGP_PARADO_HORAS,
  type EstadoTime,
  type LinhaPainel,
  type ResumoPainel,
} from "@/lib/sgp/painel";
import {
  telefoneLegivel,
  type AssinaturaFastCloner,
  type LinhaComprador,
  type ResumoCompradores,
} from "@/lib/sgp/compradores";

type EstadoCobranca = { disponivel: boolean; silencioHoras: number };

type Aba = "fila" | "todos";

/** O filtro dos três estados do time. `null` = mostrando a fila inteira. */
type FiltroEstado = EstadoTime | null;

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

  /** PRONTO × AGUARDANDO × ERRO (10/09). `null` = tudo. */
  const [filtro, setFiltro] = useState<FiltroEstado>(null);
  /** Id da linha com o campo de texto do erro aberto. */
  const [editandoErro, setEditandoErro] = useState<string | null>(null);
  const [salvandoErro, setSalvandoErro] = useState<string | null>(null);

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
   * Marca ou desmarca o erro. Igual à cobrança: recarrega em vez de mexer no
   * estado local, porque quem decide estado/ordem/contadores é o servidor.
   */
  const marcarErro = useCallback(
    async (id: string, texto: string | null) => {
      setSalvandoErro(id);
      try {
        const res = await fetch(`/api/v1/admin/sgp/${id}/erro`, {
          method: texto === null ? "DELETE" : "POST",
          ...(texto === null
            ? {}
            : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setErro(json?.error?.message || "Não consegui registrar o erro.");
          return;
        }
        setErro(null);
        setEditandoErro(null);
        await load();
      } catch {
        setErro("Não consegui registrar o erro.");
      } finally {
        setSalvandoErro(null);
      }
    },
    [load],
  );

  /** O filtro é só de VISTA: os contadores continuam contando a fila inteira. */
  const visiveis = useMemo(
    () => (filtro ? pedidos.filter((p) => p.estadoTime === filtro) : pedidos),
    [pedidos, filtro],
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

      {resumo && resumo.total > 0 && (
        <div className="flex flex-col gap-3">
          {/*
            COMO O TIME LÊ A FILA (pedido do Lucas, 10/09). As pílulas de baixo
            dizem onde o ALUNO está; estas dizem o que a EQUIPE tem em mãos —
            que é o que a planilha antiga mostrava e o sistema tinha perdido.
            Clicar filtra a tabela; clicar de novo volta pra fila inteira.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ash)]">
              Como está para o time
            </span>
            <PilulaEstado
              ativo={filtro === null}
              rotulo="Todos"
              n={resumo.total}
              tom="neutro"
              onClick={() => setFiltro(null)}
            />
            {resumo.porEstadoTime.map((e) => (
              <PilulaEstado
                key={e.estado}
                ativo={filtro === e.estado}
                rotulo={e.rotulo}
                n={e.n}
                tom={e.estado}
                onClick={() => setFiltro(filtro === e.estado ? null : e.estado)}
              />
            ))}
          </div>

          {/* Contadores por etapa: onde o ALUNO está. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ash)]">
              Em que passo o aluno está
            </span>
            {resumo.porEtapa.map((e) => (
              <Contador key={e.status} rotulo={e.etapa} n={e.n} />
            ))}
          </div>
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
        ) : visiveis.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">
            {/* Filtro vazio ≠ fila vazia: dizer só "nenhum pedido" com o filtro
                ligado faria o time achar que o SGP parou. */}
            {filtro
              ? `nenhum pedido neste estado — a fila tem ${pedidos.length}`
              : "nenhum pedido de SGP ainda"}
          </div>
        ) : (
          <table className="w-full min-w-[1420px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--hairline-strong)] bg-[var(--surface-deep)]">
                <Th>Nome</Th>
                <Th>Para o time</Th>
                <Th>E-mail</Th>
                <Th>WhatsApp</Th>
                <Th>Etapa atual</Th>
                <Th>Parado há</Th>
                <Th>O que fazer</Th>
                <Th>Cobrança</Th>
                <Th>Foto</Th>
                <Th>Voz</Th>
                <Th>Enviado em</Th>
                <Th>Erro</Th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
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
                  <Td>
                    <SeloEstado estado={p.estadoTime} rotulo={p.estadoTimeRotulo} />
                  </Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{p.email}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">
                    {p.whatsapp === "—" ? "—" : telefoneLegivel(p.whatsapp)}
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
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{p.foto}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{p.voz}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{dt(p.enviadoEm)}</Td>
                  <Td className="min-w-[260px] max-w-[300px]">
                    <CelulaErro
                      linha={p}
                      editando={editandoErro === p.id}
                      salvando={salvandoErro === p.id}
                      onAbrir={() => setEditandoErro(p.id)}
                      onCancelar={() => setEditandoErro(null)}
                      onSalvar={(texto) => marcarErro(p.id, texto)}
                      onDesmarcar={() => marcarErro(p.id, null)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[12px] text-[var(--ash)]">
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

      <p className="text-[12px] text-[var(--ash)]">
        <strong>Para o time</strong> é a leitura da EQUIPE, não a do aluno:{" "}
        <strong>Pronto</strong> é entregue, <strong>Erro</strong> é caso com problema (marcado por
        alguém do time ou registrado pelo próprio sistema) e <strong>Aguardando</strong> é todo o
        resto. Clique numa das pílulas para ver só aquele grupo. Use{" "}
        <strong>marcar erro</strong> quando o caso travar por algo que não é o passo do aluno (foto
        de outra pessoa, aluno pediu reembolso, material impossível de usar) e escreva em uma frase o
        que houve — fica registrado com seu e-mail e a data, e é o que o próximo atendente vai ler.
        Resolvido, clique em <strong>desmarcar</strong>. Erro que o <strong>sistema</strong> registrou
        não pode ser apagado aqui: é o diagnóstico que o time técnico usa.
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

/* ==========================================================================
 * PRONTO × AGUARDANDO × ERRO (pedido do Lucas, 10/09)
 * ========================================================================== */

type Tom = EstadoTime | "neutro";

/** Uma cor por estado, e a mesma nos dois lugares (pílula do topo e selo da linha). */
const TOM: Record<Tom, { on: string; off: string }> = {
  erro: {
    on: "border-[var(--status-error)] bg-[var(--status-error)]/10 text-[var(--status-error)]",
    off: "border-[var(--status-error)]/40 text-[var(--status-error)]",
  },
  aguardando: {
    on: "border-[var(--status-warn)] bg-[var(--status-warn)]/10 text-[var(--status-warn)]",
    off: "border-[var(--status-warn)]/40 text-[var(--status-warn)]",
  },
  pronto: {
    on: "border-[var(--status-online)] bg-[var(--status-online)]/10 text-[var(--status-online)]",
    off: "border-[var(--status-online)]/40 text-[var(--status-online)]",
  },
  neutro: {
    on: "border-[var(--ink)] bg-[var(--surface-deep)] text-[var(--ink)]",
    off: "border-[var(--hairline-strong)] text-[var(--mute)]",
  },
};

/**
 * A pílula que também é filtro. É botão de verdade (não um `div` clicável) pra
 * funcionar no teclado — o time usa isto o dia inteiro.
 */
function PilulaEstado({
  ativo,
  rotulo,
  n,
  tom,
  onClick,
}: {
  ativo: boolean;
  rotulo: string;
  n: number;
  tom: Tom;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`inline-flex items-center gap-2 rounded-[var(--radius-full)] border px-3 py-1 transition-colors ${
        ativo ? TOM[tom].on : `${TOM[tom].off} hover:bg-[var(--surface-deep)]`
      }`}
    >
      <span className="text-[12px]">{rotulo}</span>
      <span className="font-mono text-[12px] tabular-nums">{n}</span>
    </button>
  );
}

/** O mesmo estado, agora na linha do aluno. */
function SeloEstado({ estado, rotulo }: { estado: EstadoTime; rotulo: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-[var(--radius-full)] border px-2 py-0.5 font-mono text-[11px] ${TOM[estado].off}`}
    >
      {rotulo}
    </span>
  );
}

/**
 * A célula de erro: mostra o que houve E deixa marcar/desmarcar.
 *
 * Quatro estados:
 *  - erro do SISTEMA → o texto, dito que é do sistema, SEM botão (o time não
 *    apaga diagnóstico técnico — a rota recusaria de qualquer jeito);
 *  - erro do TIME → o texto, quem marcou e quando, com "desmarcar";
 *  - campo aberto → o textarea;
 *  - nada → o botão "marcar erro".
 */
function CelulaErro({
  linha,
  editando,
  salvando,
  onAbrir,
  onCancelar,
  onSalvar,
  onDesmarcar,
}: {
  linha: LinhaPainel;
  editando: boolean;
  salvando: boolean;
  onAbrir: () => void;
  onCancelar: () => void;
  onSalvar: (texto: string) => void;
  onDesmarcar: () => void;
}) {
  const [texto, setTexto] = useState("");

  if (editando) {
    const limpo = texto.trim();
    return (
      <div className="flex flex-col gap-1.5">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={ERRO_TEXTO_MAX}
          rows={3}
          autoFocus
          placeholder="O que aconteceu com este aluno?"
          className="w-full rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-2 py-1.5 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSalvar(limpo)}
            disabled={salvando || !limpo}
            className="rounded-[var(--radius)] border border-[var(--status-error)]/50 px-2 py-1 text-[11px] font-medium text-[var(--status-error)] transition-colors hover:bg-[var(--status-error)]/10 disabled:opacity-50"
          >
            {salvando ? "salvando…" : "salvar erro"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTexto("");
              onCancelar();
            }}
            disabled={salvando}
            className="text-[11px] text-[var(--mute)] underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-50"
          >
            cancelar
          </button>
          <span className="ml-auto font-mono text-[10px] text-[var(--ash)]">
            {limpo.length}/{ERRO_TEXTO_MAX}
          </span>
        </div>
      </div>
    );
  }

  if (linha.erroOrigem === "sistema") {
    return (
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11px] text-[var(--status-error)]">{linha.erro}</span>
        <span
          className="font-mono text-[10px] text-[var(--ash)]"
          title="Registrado pelo próprio sistema quando a geração falhou. Não pode ser apagado aqui."
        >
          registrado pelo sistema
        </span>
      </div>
    );
  }

  if (linha.erroOrigem === "time") {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-start gap-1.5 text-[12px] text-[var(--status-error)]">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {linha.erro}
        </span>
        {/* Requisito 4: quem marcou e quando. A data é formatada AQUI, no fuso
            de quem está lendo — o servidor manda ISO de propósito. */}
        <span className="font-mono text-[10px] text-[var(--ash)]">
          marcado por {linha.erroPor}
          {linha.erroEm ? ` em ${dt(linha.erroEm)}` : ""}
        </span>
        <button
          type="button"
          onClick={onDesmarcar}
          disabled={salvando}
          className="inline-flex w-fit items-center gap-1 text-[11px] text-[var(--mute)] underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-50"
        >
          <Undo2 className="size-3" />
          {salvando ? "desmarcando…" : "desmarcar"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setTexto("");
        onAbrir();
      }}
      className="rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2.5 py-1.5 text-[12px] text-[var(--mute)] transition-colors hover:border-[var(--status-error)]/50 hover:text-[var(--status-error)]"
    >
      marcar erro
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
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--hairline-strong)] bg-[var(--surface-deep)]">
                <Th>Nome</Th>
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
          Lista completa: quem comprou o SGP na Hotmart <strong>mais</strong> quem está no portal. Quem
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
