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
 * A régua (tradução do status, frase de ação, contadores, ordem, silêncio da
 * cobrança) mora em lib/sgp/painel.ts e é calculada no servidor — aqui é só
 * desenho.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Undo2 } from "lucide-react";
import { SGP_PARADO_HORAS, type LinhaPainel, type ResumoPainel } from "@/lib/sgp/painel";

type EstadoCobranca = { disponivel: boolean; silencioHoras: number };

const dt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** WhatsApp vem como dígitos com DDI ("5561993107338") — ilegível pro atendente. */
function whatsLegivel(d: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
}

export default function SgpPage() {
  const [pedidos, setPedidos] = useState<LinhaPainel[]>([]);
  const [resumo, setResumo] = useState<ResumoPainel | null>(null);
  const [cobranca, setCobranca] = useState<EstadoCobranca | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /** Id da linha com clique em voo — desabilita o botão e evita clique duplo. */
  const [salvando, setSalvando] = useState<string | null>(null);

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

  const silencioHoras = cobranca?.silencioHoras ?? SGP_PARADO_HORAS;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Sistema de Geração Pronto
        </h1>
        <p className="mt-1 text-[14px] text-[var(--mute)]">
          Quem pediu, em que pé está e o que o time precisa fazer · atualiza a cada 30s
        </p>
      </div>

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

      {/* Contadores por etapa. */}
      {resumo && resumo.total > 0 && (
        <div className="flex flex-wrap gap-2">
          <Contador rotulo="Total" n={resumo.total} />
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
          <table className="w-full min-w-[1250px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--hairline-strong)] bg-[var(--surface-deep)]">
                <Th>Nome</Th>
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
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{p.email}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">
                    {p.whatsapp === "—" ? "—" : whatsLegivel(p.whatsapp)}
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
    </div>
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
