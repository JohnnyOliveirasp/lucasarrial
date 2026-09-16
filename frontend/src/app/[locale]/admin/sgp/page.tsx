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
 * Pedido do Lucas (recado 5): duas coisas que o time faz todo dia e que a tela
 * não fazia. (a) BUSCA por nome, e-mail e WhatsApp, nas duas abas — o atendente
 * abre a tela pra atender UMA pessoa que acabou de chamar, e varria a tabela com
 * o olho. (b) PAINEL por aluno com o que já foi GERADO (voz, imagens, vídeo) —
 * pra saber se a voz saiu, ele saía da tela e ia perguntar pra alguém.
 *
 * ⚠️ ONDE AS DUAS COISAS NOVAS PODEM FICAR, e isso é conserto, não gosto: os
 * botões de ação desta tela já ficaram FORA do campo de visão uma vez, e o Lucas
 * reclamou 3x. Medido em Chrome headless a 1267px (a largura real de uso), eles
 * vivem em x=631..1177. Por isso: a BUSCA vai ACIMA da tabela, nunca como
 * coluna; e o PAINEL abre em LINHA NOVA, nunca como coluna lateral. Nenhuma das
 * duas pode comer a folga até a borda — ver a medição no PR.
 *
 * A régua (tradução do status, frase de ação, contadores, ordem, silêncio da
 * cobrança, e o que pode aparecer no painel de gerados) mora em lib/sgp/painel.ts,
 * lib/sgp/compradores.ts, lib/sgp/busca.ts e lib/sgp/geracoes-pure.ts, e é
 * calculada fora daqui — nesta tela é só desenho.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  MessageCircle,
  Search,
  Undo2,
  XCircle,
} from "lucide-react";
import { filtrarBusca } from "@/lib/sgp/busca";
import type { SgpGeracoes } from "@/lib/sgp/geracoes";
import { videoLegivel, vozLegivel } from "@/lib/sgp/geracoes-pure";
import {
  SGP_CANAIS_AVISO,
  SGP_PARADO_HORAS,
  ordenar,
  resumir,
  type LinhaPainel,
  type ResumoPainel,
  type SituacaoSgp,
} from "@/lib/sgp/painel";
import {
  filaComNaoIniciados,
  telefoneLegivel,
  type AssinaturaFastCloner,
  type LinhaComprador,
  type ResumoCompradores,
} from "@/lib/sgp/compradores";

type EstadoCobranca = { disponivel: boolean; silencioHoras: number };

type Aba = "fila" | "todos";

/** O painel de gerados de UMA linha: o que veio, se está indo, ou por que não veio. */
type EstadoGeracoes = { carregando: boolean; erro: string | null; dados: SgpGeracoes | null };

/**
 * A etiqueta PRONTO / AGUARDANDO / ERRO (pedido do Lucas, 10/09).
 *
 * A régua de QUEM é o quê mora em lib/sgp/painel.ts › situacao e é calculada no
 * servidor; aqui é só cor. Ela fica ao lado da etapa, não no lugar dela: a etapa
 * diz *em que passo está* e a situação diz *pronto, esperando ou quebrado* — a
 * segunda é a que o time lê de longe, e é a leitura que a planilha antiga tinha.
 */
const CORES_SITUACAO: Record<SituacaoSgp, string> = {
  // CONCLUÍDO é o único que o TIME declara. Cor sóbria de propósito: não é
  // comemoração (o aluno pode não ter recebido nada) nem alarme.
  concluido:
    "border-[var(--ink)]/25 bg-[var(--ink)]/[0.06] text-[var(--ink)]",
  // ENTREGUE é o único VERDE agora, e isso é o ponto do recado 6 (15/09): verde
  // significa "acabou de verdade — o clone ficou pronto E o aluno foi avisado".
  entregue:
    "border-[var(--status-online)]/40 bg-[var(--status-online)]/10 text-[var(--status-online)]",
  // GERADO (antigo PRONTO) virou AMARELO porque virou PENDÊNCIA: o material
  // existe e o aluno pode não saber. Deixá-lo verde manteria a tela dizendo
  // "acabou" exatamente nos 82 casos que o recado veio corrigir.
  pronto: "border-[var(--status-warn)]/40 bg-[var(--status-warn)]/10 text-[var(--status-warn)]",
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

  /**
   * Pill clicada = FILTRO da lista. Nunca move o aluno de etapa: filtrar é
   * reversível, mexer no estado real brigaria com o robô (decisão do Lucas).
   * `situacao` casa com LinhaPainel.situacao; `etapa` casa com LinhaPainel.status.
   */
  const [filtro, setFiltro] = useState<{ tipo: "situacao" | "etapa"; valor: string } | null>(null);

  /**
   * O que foi digitado na busca. FICA FORA DO `pedidos` pelo mesmo motivo dos
   * rascunhos de erro/conclusão: a tela recarrega sozinha a cada 30s, e o time
   * digita o nome do aluno enquanto fala com ele no WhatsApp. Se a busca morasse
   * na linha, o refresh limparia o campo no meio do atendimento.
   */
  const [busca, setBusca] = useState("");

  /**
   * Qual linha está com o painel de gerados aberto, e o que já foi carregado.
   *
   * UMA POR VEZ de propósito: cada painel custa 5 consultas + assinatura de URL
   * no servidor. Deixar várias abertas com o refresh de 30s rodando seria
   * marteladas no banco pra mostrar o que ninguém está olhando.
   *
   * O cache por id (`geracoes`) faz fechar-e-reabrir não custar nada, e também
   * atravessa o refresh — quem fecha a linha não perde o que já viu.
   */
  const [expandido, setExpandido] = useState<string | null>(null);
  const [geracoes, setGeracoes] = useState<Record<string, EstadoGeracoes>>({});

  /**
   * "Avisei o aluno" (migration 116). Só um par: aqui não há rascunho de texto
   * livre pra proteger do refresh — o canal é uma escolha de lista (ver
   * `SGP_CANAIS_AVISO`), e escolha não se perde no meio de uma frase.
   */
  const [avisoOk, setAvisoOk] = useState(false);
  const [abertoAviso, setAbertoAviso] = useState<string | null>(null);

  /** Mesmo trio pro "Concluir atendimento" (migration 110), e pelo mesmo motivo:
   *  o rascunho tem que atravessar o refresh de 30s sem sumir do meio da frase. */
  const [conclusaoOk, setConclusaoOk] = useState(false);
  const [abertoConcluir, setAbertoConcluir] = useState<string | null>(null);
  const [rascunhoConcluir, setRascunhoConcluir] = useState<Record<string, string>>({});

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
        setConclusaoOk(!!json.conclusao?.disponivel);
        setAvisoOk(!!json.aviso?.disponivel);
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

  /**
   * ⚠️ MUDOU EM 15/09 (requisito 4 do recado 6): a lista de compradores passa a
   * carregar em QUALQUER aba, e não só ao abrir a segunda.
   *
   * Motivo: quem comprou e nunca abriu o portal tem que aparecer na FILA DE
   * TRABALHO (*"hoje eles são invisíveis fora dos 267 pedidos — e são a maior
   * fatia do funil"*), e essa gente só existe na união compras+pedidos que esta
   * consulta faz.
   *
   * O que NÃO mudou, e é o que protege o banco: ela continua FORA do polling de
   * 30s. É uma varredura por CARREGAMENTO DE PÁGINA, não a cada meio minuto —
   * exatamente o mesmo custo que já se pagava quando o time clicava na outra
   * aba, só que agora ele é pago mesmo que ninguém clique.
   */
  useEffect(() => {
    if (compradores === null && !carregandoTodos) void carregarTodos();
  }, [compradores, carregandoTodos, carregarTodos]);

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

  /**
   * Conclui ou reabre o atendimento. Mesma forma das outras duas (mesmo
   * `salvando`, mesmo reload, mesmo lugar de mensagem), porque é o padrão que o
   * time já usa. Sem UI otimista: a régua inteira volta recalculada do servidor.
   */
  const marcarConclusao = useCallback(
    async (id: string, marcar: boolean) => {
      setSalvando(id);
      try {
        const res = await fetch(`/api/v1/admin/sgp/${id}/conclusao`, {
          method: marcar ? "POST" : "DELETE",
          ...(marcar
            ? {
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ motivo: rascunhoConcluir[id] ?? "" }),
              }
            : {}),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setErro(json?.error?.message || "Não consegui concluir o atendimento.");
          return;
        }
        setErro(null);
        // Só limpa o rascunho DEPOIS de o servidor confirmar.
        setRascunhoConcluir((r) => {
          const resto = { ...r };
          delete resto[id];
          return resto;
        });
        setAbertoConcluir(null);
        await load();
      } catch {
        setErro("Não consegui concluir o atendimento.");
      } finally {
        setSalvando(null);
      }
    },
    [load, rascunhoConcluir],
  );

  /**
   * Registra (ou desfaz) o aviso ao aluno. Mesma forma das outras três — mesmo
   * `salvando`, mesmo reload, mesmo lugar de mensagem.
   *
   * ⚠️ ISTO NÃO MANDA MENSAGEM NENHUMA. É o registro de um aviso que a pessoa
   * já deu, pelo canal dela. O sistema não fala com aluno sozinho, e o nome do
   * botão é a única coisa aqui que poderia sugerir o contrário — por isso a
   * tela escreve isso embaixo da tabela, e não só neste comentário.
   */
  const marcarAviso = useCallback(
    async (id: string, canal: string | null) => {
      setSalvando(id);
      try {
        const res = await fetch(`/api/v1/admin/sgp/${id}/aviso`, {
          method: canal ? "POST" : "DELETE",
          ...(canal
            ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ canal }) }
            : {}),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setErro(json?.error?.message || "Não consegui registrar o aviso.");
          return;
        }
        setErro(null);
        setAbertoAviso(null);
        await load();
      } catch {
        setErro("Não consegui registrar o aviso.");
      } finally {
        setSalvando(null);
      }
    },
    [load],
  );

  /**
   * Busca o que já foi gerado pra UMA linha. Só sob clique (ver o comentário do
   * estado): nunca entra no polling de 30s.
   */
  const carregarGeracoes = useCallback(async (id: string) => {
    setGeracoes((g) => ({ ...g, [id]: { carregando: true, erro: null, dados: null } }));
    try {
      const res = await fetch(`/api/v1/admin/sgp/${id}/geracoes`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setGeracoes((g) => ({ ...g, [id]: { carregando: false, erro: null, dados: json } }));
      } else {
        setGeracoes((g) => ({
          ...g,
          [id]: {
            carregando: false,
            erro: json?.error?.message || "Não consegui carregar o que foi gerado.",
            dados: null,
          },
        }));
      }
    } catch {
      setGeracoes((g) => ({
        ...g,
        [id]: { carregando: false, erro: "Não consegui carregar o que foi gerado.", dados: null },
      }));
    }
  }, []);

  /** Abre/fecha o painel. Fechar NÃO descarta o que já veio (reabrir é de graça). */
  const alternarGeracoes = useCallback(
    (id: string) => {
      const fechando = expandido === id;
      setExpandido(fechando ? null : id);
      // Recarrega só o que falhou ou o que nunca foi buscado — reabrir uma linha
      // que já deu certo não gasta consulta nenhuma.
      if (!fechando && !geracoes[id]?.dados && !geracoes[id]?.carregando) void carregarGeracoes(id);
    },
    [expandido, geracoes, carregarGeracoes],
  );

  const silencioHoras = cobranca?.silencioHoras ?? SGP_PARADO_HORAS;

  /** Clicar na pill já ligada DESLIGA o filtro — sem isso não há como voltar atrás. */
  function alternarFiltro(tipo: "situacao" | "etapa", valor: string) {
    setFiltro((f) => (f && f.tipo === tipo && f.valor === valor ? null : { tipo, valor }));
  }

  /**
   * O filtro é só de LEITURA, em cima do que já veio: não refaz busca e não
   * altera nada no banco. Some da tela, não some do mundo.
   *
   * A BUSCA entra depois da pill e se SOMA a ela (as duas valem ao mesmo tempo):
   * o time filtra por ERRO e procura o aluno dentro daquele recorte. A régua de
   * quem casa mora em lib/sgp/busca.ts, testada lá.
   */
  /**
   * A FILA COMPLETA: os pedidos mais quem comprou e nunca começou (requisito 4).
   *
   * A união é feita pela MESMA função da outra aba (`filaComNaoIniciados` chama
   * o resultado de `montarCompradores`), como o recado pediu em caixa alta:
   * *"reuse essa lógica, não escreva outra"*. Aqui não há régua nenhuma — só a
   * junção e a reordenação, as duas de lib/sgp.
   *
   * Enquanto os compradores não chegaram, a fila é só os pedidos: a tela nasce
   * útil em vez de esperar a consulta pesada pra mostrar qualquer coisa.
   */
  const fila = useMemo(
    () => (compradores ? ordenar(filaComNaoIniciados(pedidos, compradores)) : pedidos),
    [pedidos, compradores],
  );
  // Os contadores do topo têm que contar a fila que está NA TELA. Usar o resumo
  // do servidor aqui faria o cabeçalho dizer 267 enquanto a tabela mostra a base
  // inteira — e um contador que não bate com a lista embaixo dele é pior que
  // contador nenhum. É a mesma função pura que a rota usa.
  const resumoVisivel = useMemo(
    () => (compradores ? resumir(fila) : resumo),
    [compradores, fila, resumo],
  );

  const porPill = filtro
    ? fila.filter((p) => (filtro.tipo === "situacao" ? p.situacao === filtro.valor : p.status === filtro.valor))
    : fila;

  const visiveis = filtrarBusca(busca, porPill, (p) => ({
    nome: p.nome,
    email: p.email,
    // Vem "—" quando não há telefone; a régua ignora, porque não tem dígito.
    telefone: p.whatsapp,
  }));

  const rotuloDoFiltro =
    filtro?.tipo === "situacao"
      ? filtro.valor.toUpperCase()
      : (resumoVisivel?.porEtapa.find((e) => e.status === filtro?.valor)?.etapa ?? filtro?.valor ?? "");

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
          Fila de trabalho{resumoVisivel ? ` (${resumoVisivel.total})` : ""}
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
          resumoVisivel?.parados
            ? "border-[var(--status-error)]/40 bg-[var(--status-error)]/5"
            : "border-[var(--status-online)]/30 bg-[var(--status-online)]/5"
        }`}
      >
        {resumoVisivel?.parados ? (
          <AlertTriangle className="size-5 shrink-0 text-[var(--status-error)]" />
        ) : (
          <CheckCircle2 className="size-5 shrink-0 text-[var(--status-online)]" />
        )}
        <span className="text-[14px] text-[var(--ink)]">
          {resumoVisivel?.parados
            ? `${resumoVisivel.parados} aluno(s) parados há mais de ${SGP_PARADO_HORAS}h — precisam ser cobrados`
            : "Ninguém parado. Nada precisando de cobrança ✅"}
          {/* Cobrado NÃO é resolvido: continua contado à parte, à vista. */}
          {resumoVisivel?.cobrados ? (
            <span className="text-[var(--mute)]">
              {" "}
              · {resumoVisivel.cobrados} já cobrado(s), esperando o aluno responder
            </span>
          ) : null}
          {/* Concluído tira a linha do vermelho PARA SEMPRE (não é um timer como
              o "já cobrei"), então o número fica à vista — e, principalmente, o
              recorte de quem foi encerrado SEM ter recebido o produto. É o
              contador que mantém a decisão de precedência auditável. */}
          {resumoVisivel?.concluidos ? (
            <span className="text-[var(--mute)]">
              {" "}
              · {resumoVisivel.concluidos} atendimento(s) concluído(s)
              {resumoVisivel.concluidosComPendencia
                ? `, sendo ${resumoVisivel.concluidosComPendencia} de gente que ainda não recebeu o clone`
                : ""}
            </span>
          ) : null}
        </span>
      </div>

      {/* ⚠️ O BANNER QUE O RECADO 6 EXISTE PRA CRIAR (15/09).
          Clone gerado e sem registro de aviso é gente que pagou, cujo material
          está pronto, e que pode não saber. Era invisível: a tela chamava todos
          eles de "Entregue" e escrevia "Nada a fazer". Fica em banner próprio, e
          não numa pill no meio das outras, porque é a ÚNICA pendência da tela
          que não grita sozinha — o aluno não reclama do que ele não sabe que
          existe. */}
      {resumoVisivel && resumoVisivel.geradosSemAviso > 0 && (
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--status-warn)]/40 bg-[var(--status-warn)]/5 px-4 py-3.5">
          <MessageCircle className="size-5 shrink-0 text-[var(--status-warn)]" />
          <span className="text-[14px] text-[var(--ink)]">
            <strong>{resumoVisivel.geradosSemAviso}</strong> clone(s) prontos SEM registro de aviso
            ao aluno — o material existe e ele pode não saber.{" "}
            <button
              type="button"
              onClick={() => alternarFiltro("situacao", "pronto")}
              className="underline underline-offset-2 transition-colors hover:text-[var(--status-warn)]"
            >
              ver quem é
            </button>
          </span>
        </div>
      )}

      {/* Os três buckets da planilha primeiro, a etapa detalhada depois: é a
          ordem em que o time lê — "quantos estão quebrados?" antes de "quantos
          estão gravando o áudio?". */}
      {resumoVisivel && resumoVisivel.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {/* "Total" é o limpar-filtro: é onde a mão vai quando quer tudo de volta. */}
          <Contador rotulo="Total" n={resumoVisivel.total} ativo={filtro === null} onClick={() => setFiltro(null)} />
          <Contador
            rotulo="CONCLUÍDO"
            n={resumoVisivel.situacoes.concluido}
            ativo={filtro?.tipo === "situacao" && filtro.valor === "concluido"}
            onClick={() => alternarFiltro("situacao", "concluido")}
          />
          {/* ENTREGUE e GERADO são DOIS contadores desde 15/09 (recado 6), e é o
              ponto inteiro da mudança: antes os dois eram o mesmo "PRONTO", e
              por isso 82 pedidos eram contados como entregues sem que ninguém
              soubesse se o aluno tinha sido avisado. */}
          <Contador
            rotulo="ENTREGUE"
            n={resumoVisivel.situacoes.entregue}
            ativo={filtro?.tipo === "situacao" && filtro.valor === "entregue"}
            onClick={() => alternarFiltro("situacao", "entregue")}
          />
          <Contador
            rotulo="GERADO"
            n={resumoVisivel.situacoes.pronto}
            ativo={filtro?.tipo === "situacao" && filtro.valor === "pronto"}
            onClick={() => alternarFiltro("situacao", "pronto")}
          />
          <Contador
            rotulo="AGUARDANDO"
            n={resumoVisivel.situacoes.aguardando}
            ativo={filtro?.tipo === "situacao" && filtro.valor === "aguardando"}
            onClick={() => alternarFiltro("situacao", "aguardando")}
          />
          <Contador
            rotulo="ERRO"
            n={resumoVisivel.situacoes.erro}
            ativo={filtro?.tipo === "situacao" && filtro.valor === "erro"}
            onClick={() => alternarFiltro("situacao", "erro")}
          />
        </div>
      )}

      {/* Contadores por etapa. */}
      {resumoVisivel && resumoVisivel.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {resumoVisivel.porEtapa.map((e) => (
            <Contador
              key={e.status}
              rotulo={e.etapa}
              n={e.n}
              ativo={filtro?.tipo === "etapa" && filtro.valor === e.status}
              onClick={() => alternarFiltro("etapa", e.status)}
            />
          ))}
        </div>
      )}

      {/* ⚠️ A BUSCA VIVE AQUI, ACIMA DA TABELA — nunca como coluna. Coluna nova
          empurraria os botões de ação pra fora da tela de 1267px, que é o
          defeito que o Lucas reclamou 3x. Ver o ⚠️ do topo do arquivo. */}
      <CampoBusca
        valor={busca}
        onMudar={setBusca}
        placeholder="Buscar por nome, e-mail ou WhatsApp…"
        achados={visiveis.length}
      />

      {/* Recorte ligado precisa DIZER que está ligado: sem isto, "sumiram alunos"
          vira chamado. Mostra o que está recortando e como sair num clique — e
          fala dos DOIS (pill e busca), porque eles se somam. */}
      {(filtro || busca.trim() !== "") && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--body)]">
          <span>
            Mostrando <strong>{visiveis.length}</strong> de {pedidos.length}
            {filtro ? (
              <>
                {" "}
                — filtrado por <strong>{rotuloDoFiltro}</strong>
              </>
            ) : null}
            {busca.trim() !== "" ? (
              <>
                {" "}
                — procurando por <strong>{busca.trim()}</strong>
              </>
            ) : null}
            .
          </span>
          {filtro && (
            <button
              type="button"
              onClick={() => setFiltro(null)}
              className="rounded-[var(--radius-full)] border border-[var(--hairline-strong)] px-3 py-1 text-[12px] text-[var(--ink)] transition-colors hover:border-[var(--hairline-bright)]"
            >
              limpar filtro ✕
            </button>
          )}
          {busca.trim() !== "" && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="rounded-[var(--radius-full)] border border-[var(--hairline-strong)] px-3 py-1 text-[12px] text-[var(--ink)] transition-colors hover:border-[var(--hairline-bright)]"
            >
              limpar busca ✕
            </button>
          )}
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
            {/* "Nada encontrado" precisa dizer POR QUE está vazio. Sem isso, o
                time lê "nenhum pedido de SGP ainda" com a busca ligada e conclui
                que o aluno não existe — quando ele só não casou com o texto. */}
            {busca.trim() !== ""
              ? filtro
                ? "nenhum aluno com esse texto DENTRO deste filtro — tente limpar o filtro"
                : "nenhum aluno com esse texto"
              : filtro
                ? "nenhum aluno neste filtro"
                : "nenhum pedido de SGP ainda"}
          </div>
        ) : (
          /**
           * ORDEM DAS COLUNAS = ORDEM DO TRABALHO, e isso é um conserto, não gosto.
           * Antes: Cobrança e Marcar erro eram a 8ª e a 9ª coluna, depois de "O que
           * fazer" (prosa longa). Numa tela de ~1240px só entravam as 7 primeiras,
           * então os dois ÚNICOS botões da tela ficavam fora do campo de visão e o
           * time não conseguia clicar — reclamado 3x pelo Lucas.
           * Agora vêm logo depois de quem-é/como-falar, e a prosa foi pro fim.
           *
           * O `min-w-[1500px]` fica como está DE PROPÓSITO: medido, não é ele que
           * corta a tela. A tabela renderiza com ~1780px porque quem manda é a soma
           * dos `min-content` das 13 colunas, então baixar o min-w não move um
           * pixel. (Medição do PR #281, confirmada aqui: com min-w 1200 a tabela
           * seguiu em 1773px.) Mexer nele só criaria conflito à toa com o #277.
           */
          <table className="w-full min-w-[1500px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--hairline-strong)] bg-[var(--surface-deep)]">
                <Th>Nome</Th>
                <Th>Situação</Th>
                <Th>Parado há</Th>
                <Th>WhatsApp</Th>
                {/* Era "Cobrança". Virou o guarda-chuva das duas conversas com o
                    aluno: cobrar quem travou e avisar quem já tem o clone. */}
                <Th>Contato com o aluno</Th>
                <Th>Marcar erro</Th>
                <Th>Atendimento</Th>
                <Th>Etapa atual</Th>
                <Th>E-mail</Th>
                <Th>O que fazer</Th>
                <Th>Foto</Th>
                <Th>Voz</Th>
                <Th>Enviado em</Th>
                <Th>Erro</Th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
                <Fragment key={p.id}>
                <tr
                  className={`border-t border-[var(--hairline)] align-top ${
                    p.concluido
                      ? // Encerrado pelo time: some do vermelho e perde destaque,
                        // mas NÃO some da tabela — quem pagou e não recebeu tem
                        // que continuar visível.
                        "bg-[var(--surface-deep)] opacity-70"
                      : p.precisaAcao
                      ? "bg-[var(--status-error)]/[0.07]"
                      : p.silenciado
                        ? // Já cobrado: sai do vermelho, mas não vira uma linha
                          // qualquer — o aluno continua travado.
                          "bg-[var(--status-warn)]/[0.07]"
                        : "bg-[var(--surface-card)]"
                  }`}
                >
                  {/* min-w: sem ele o nome é a primeira coluna a ser espremida e
                      "Stella Maris Gomes Pereira Pontes Pinheiro" vira 6 linhas,
                      inflando a altura da linha inteira.

                      ⚠️ O gatilho do painel mora AQUI DENTRO, na primeira coluna,
                      e de dentro do mesmo `min-w-[190px]`: é a única posição que
                      não empurra as colunas 2–4 e, com elas, os três botões de
                      ação. Ele é o próprio NOME (alvo grande, e o nome é onde a
                      mão já vai), com a seta como aviso de que abre. */}
                  <Td className="min-w-[190px] font-medium text-[var(--ink)]">
                    {/* Sem pedido não há nada gerado pra abrir: o nome deixa de
                        ser botão em vez de abrir um painel que só diria "erro". */}
                    {p.naoIniciou ? (
                      <span className="flex w-full items-start gap-1">
                        <span className="mt-[3px] size-3.5 shrink-0" aria-hidden />
                        <span>
                          {p.parado && (
                            <span className="mr-1.5 inline-block align-middle text-[var(--status-error)]">●</span>
                          )}
                          {p.nome}
                        </span>
                      </span>
                    ) : (
                    <button
                      type="button"
                      onClick={() => alternarGeracoes(p.id)}
                      aria-expanded={expandido === p.id}
                      title="Ver o que já foi gerado para este aluno"
                      className="flex w-full items-start gap-1 text-left transition-colors hover:text-[var(--status-online)]"
                    >
                      {expandido === p.id ? (
                        <ChevronDown className="mt-[3px] size-3.5 shrink-0 text-[var(--mute)]" />
                      ) : (
                        <ChevronRight className="mt-[3px] size-3.5 shrink-0 text-[var(--mute)]" />
                      )}
                      <span>
                        {p.parado && (
                          <span className="mr-1.5 inline-block align-middle text-[var(--status-error)]">●</span>
                        )}
                        {p.nome}
                      </span>
                    </button>
                    )}
                  </Td>
                  <Td className="min-w-[180px]">
                    <Etiqueta
                      situacao={p.situacao}
                      rotulo={p.situacaoRotulo}
                      motivo={p.situacaoMotivo}
                    />
                  </Td>
                  {/* REQUISITO 3 DO RECADO 6: entregue PARA DE CONTAR. O número
                      não some (ele diz quanto tempo o caso ficou parado ANTES do
                      aviso, que aconteceu de verdade) — ele só congela, e a tela
                      diz que congelou pra ninguém ler como "ainda esperando". */}
                  <Td
                    className={`font-mono text-[11px] tabular-nums ${
                      p.parado
                        ? "font-semibold text-[var(--status-error)]"
                        : p.relogioParado
                          ? "text-[var(--ash)]"
                          : "text-[var(--mute)]"
                    }`}
                  >
                    {p.relogioParado ? (
                      <span title={p.avisadoTexto ?? undefined}>parou em {p.paradoTexto}</span>
                    ) : (
                      p.paradoTexto
                    )}
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-[11px] text-[var(--mute)]">
                    {p.whatsapp === "—" ? "—" : telefoneLegivel(p.whatsapp)}
                  </Td>
                  {/* ⚠️ Linha de quem NUNCA COMEÇOU não tem pedido, logo não tem
                      onde escrever: os três botões viram um aviso só. Oferecer o
                      clique daria 404 em `/api/v1/admin/sgp/<sem-pedido>/…`, que
                      é pior que não oferecer — o time clicaria, veria erro
                      vermelho e perderia a confiança na tela inteira. */}
                  {p.naoIniciou ? (
                    <Td className="min-w-[190px] text-[12px] text-[var(--ash)]" colSpan={3}>
                      Ainda não há pedido pra marcar — esta pessoa comprou e nunca abriu o portal.
                    </Td>
                  ) : (
                    <>
                  {/* ⚠️ UMA COLUNA SÓ pras duas conversas com o aluno, e isso é
                      medida, não economia de espaço: a tabela já sai em ~1780px
                      e os botões de ação só cabem na tela porque estão nas
                      primeiras colunas (defeito reclamado 3x pelo Lucas). Uma
                      15ª coluna empurraria "Atendimento" pra fora da viewport.
                      Elas nunca disputam a mesma linha: "Já cobrei" só aparece
                      pra quem está travado no wizard, "Avisei" só pra quem já
                      tem clone gerado — e um pedido nunca está nos dois. */}
                  <Td className="min-w-[190px]">
                    <CelulaContato
                      linha={p}
                      disponivel={cobranca?.disponivel ?? false}
                      avisoDisponivel={avisoOk}
                      salvando={salvando === p.id}
                      abertoAviso={abertoAviso === p.id}
                      onAbrirAviso={() => setAbertoAviso(p.id)}
                      onFecharAviso={() => setAbertoAviso(null)}
                      onAvisar={(canal) => marcarAviso(p.id, canal)}
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
                  {/* Atendimento vem junto dos outros dois botões: é AÇÃO, e ação
                      fora do campo de visão foi o defeito reclamado 3x pelo Lucas. */}
                  <Td className="min-w-[210px]">
                    <CelulaConcluir
                      linha={p}
                      disponivel={conclusaoOk}
                      salvando={salvando === p.id}
                      aberto={abertoConcluir === p.id}
                      rascunho={rascunhoConcluir[p.id] ?? ""}
                      onAbrir={() => setAbertoConcluir(p.id)}
                      onFechar={() => setAbertoConcluir(null)}
                      onDigitar={(v) => setRascunhoConcluir((r) => ({ ...r, [p.id]: v }))}
                      onMarcar={() => marcarConclusao(p.id, true)}
                      onDesfazer={() => marcarConclusao(p.id, false)}
                    />
                  </Td>
                    </>
                  )}
                  <Td>{p.etapa}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{p.email}</Td>
                  {/* Prosa longa: foi pro fim porque era ela que empurrava os botões
                      pra fora da tela. Texto inteiro preservado (o time lê), só
                      mais estreito — era o que mais esticava a tabela. */}
                  <Td className="w-[240px] min-w-[240px] text-[var(--body)]">{p.oQueFazer}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{p.foto}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{p.voz}</Td>
                  <Td className="font-mono text-[11px] text-[var(--mute)]">{dt(p.enviadoEm)}</Td>
                  <Td className="max-w-[220px] font-mono text-[11px] text-[var(--status-error)]">
                    {p.erro ?? "—"}
                  </Td>
                </tr>
                {/* ⚠️ LINHA NOVA, não coluna lateral: é o que mantém os três
                    botões de ação onde estão. A tabela é larga (~1780px) e rola
                    na horizontal, então o miolo do painel é `sticky left-0` —
                    sem isso ele nasceria na largura do colSpan e o time teria
                    que rolar pro lado pra ler o que acabou de abrir. */}
                {expandido === p.id && (
                  <tr className="border-t border-[var(--hairline)] bg-[var(--surface-deep)]">
                    <td colSpan={14} className="px-3 py-4">
                      <div className="sticky left-0 w-fit max-w-[1100px]">
                        <PainelGeracoes
                          estado={geracoes[p.id]}
                          onTentarDeNovo={() => carregarGeracoes(p.id)}
                        />
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[12px] text-[var(--ash)]">
        <strong>Situação</strong> é a leitura de planilha: <strong>CONCLUÍDO</strong> é o time dizendo
        que encerrou o atendimento, <strong>PRONTO</strong> é entregue, <strong>ERRO</strong> é o que
        alguém precisa olhar (o sistema falhou, falhou em parte, ou o time marcou na mão) e{" "}
        <strong>AGUARDANDO</strong> é todo o resto — esperando o aluno, na fila ou gerando. A ordem de
        prioridade é essa mesma: CONCLUÍDO ganha de ERRO, e ERRO ganha de PRONTO. Material entregue
        errado é um pedido pronto que precisa de gente; e um caso que o time já resolveu não pode
        continuar gritando para sempre só porque o sistema não sabe que foi resolvido.{" "}
        {conclusaoOk ? (
          <>
            Em <strong>Atendimento</strong> o time encerra o caso (aluno reembolsado, desistiu,
            resolvido por fora). Concluir <strong>não</strong> é dizer que o aluno recebeu:{" "}
            <strong>a linha continua aqui</strong>, o &ldquo;parado há&rdquo; continua contando, e quem
            não recebeu o clone fica marcado na própria célula e no contador do topo. A marca{" "}
            <strong>não vence sozinha</strong> — sai no <strong>reabrir</strong>. E se o aluno voltar a
            mexer depois, ela vira histórico e a linha volta a alertar por conta própria.
          </>
        ) : (
          <>
            O botão <strong>Concluir atendimento</strong> ainda não está liberado — falta uma
            atualização do sistema.
          </>
        )}{" "}
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
 * A BUSCA (pedido do Lucas, recado 5) — nome, e-mail ou WhatsApp.
 *
 * ⚠️ MORA ACIMA DA TABELA, NAS DUAS ABAS, e isso não é estética: coluna nova
 * empurraria os três botões de ação pra fora da tela de 1267px, que é o defeito
 * reclamado 3x. Aqui em cima ela não disputa um pixel com a tabela.
 *
 * `type="search"` de propósito: o Chrome desenha o ✕ de limpar sozinho, e o time
 * apaga a busca sem ter que selecionar o texto na mão entre um atendimento e
 * outro.
 *
 * O contador ao lado existe porque zero resultados precisa ser um FATO na tela,
 * não uma tabela vazia que o atendente lê como "esse aluno não existe".
 */
function CampoBusca({
  valor,
  onMudar,
  placeholder,
  achados,
}: {
  valor: string;
  onMudar: (v: string) => void;
  placeholder: string;
  achados: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-[420px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ash)]" />
        <input
          type="search"
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] py-2 pl-9 pr-3 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ash)] focus:border-[var(--ink)]/60"
        />
      </div>
      {valor.trim() !== "" && (
        <span
          className={`font-mono text-[12px] tabular-nums ${
            achados === 0 ? "text-[var(--status-warn)]" : "text-[var(--mute)]"
          }`}
        >
          {achados === 0 ? "nenhum aluno com esse texto" : `${achados} encontrado(s)`}
        </span>
      )}
    </div>
  );
}

/**
 * O PAINEL "o que já foi gerado" (pedido do Lucas, recado 5), que abre em linha
 * nova embaixo do aluno.
 *
 * Quem decide o QUE pode aparecer é lib/sgp/geracoes-pure.ts (com os testes);
 * aqui é só desenho. Três decisões que NÃO são de desenho e por isso estão
 * escritas:
 *
 *  1. VÍDEO NÃO É ENTREGA DO SGP. As etapas são recebido → foto → voz → pronto:
 *     não existe passo de vídeo. O que aparece ali é o que a pessoa fez na
 *     PLATAFORMA depois de entrar, e a seção DIZ isso — senão o atendente
 *     afirmaria pro aluno uma entrega que o SGP nunca prometeu.
 *  2. O QUE NÃO DEU PRA LER APARECE. Consulta que falhou vira aviso, não lista
 *     vazia: "nenhuma imagem" tem que significar que não há imagem, e não que a
 *     tela não conseguiu olhar.
 *  3. TETO DIZ QUE CORTOU. "12 de 30" em vez de 12 caladas.
 */
function PainelGeracoes({
  estado,
  onTentarDeNovo,
}: {
  estado: EstadoGeracoes | undefined;
  onTentarDeNovo: () => void;
}) {
  if (!estado || estado.carregando) {
    return (
      <span className="font-mono text-[12px] text-[var(--ash)]">carregando o que foi gerado…</span>
    );
  }

  if (estado.erro) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-[var(--status-error)]">{estado.erro}</span>
        <button
          type="button"
          onClick={onTentarDeNovo}
          className="rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2.5 py-1 text-[12px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-card)]"
        >
          tentar de novo
        </button>
      </div>
    );
  }

  const g = estado.dados;
  if (!g) return null;

  // Aluno que ainda não terminou o envio: não há conta, logo não há nada gerado.
  // A frase vem do servidor pronta pro atendente ler (nada de "user_id null").
  if (g.motivo) {
    return <p className="max-w-[640px] text-[13px] text-[var(--body)]">{g.motivo}</p>;
  }

  const vazio = !g.voz && g.imagens.length === 0 && g.videos.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Decisão 2: o que não deu pra ler vem ANTES de tudo, senão a lista vazia
          embaixo seria lida como resposta. */}
      {g.falhas.length > 0 && (
        <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--status-warn)]/40 bg-[var(--status-warn)]/5 px-3 py-2">
          {g.falhas.map((f, i) => (
            <span key={i} className="text-[12px] text-[var(--status-warn)]">
              {f} Isso é falha da tela, não do pedido — não dá pra dizer ao aluno que não existe.
            </span>
          ))}
        </div>
      )}

      {vazio && g.falhas.length === 0 && (
        <p className="text-[13px] text-[var(--body)]">
          Nada gerado ainda para este aluno — nem voz, nem imagem, nem vídeo.
        </p>
      )}

      <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
        <SecaoGerados titulo="Voz do pedido">
          {g.voz ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-[var(--ink)]">{vozLegivel(g.voz.status)}</span>
              <span className="font-mono text-[11px] text-[var(--ash)]">{dt(g.voz.data)}</span>
              {g.voz.erro && (
                <span className="max-w-[300px] font-mono text-[11px] text-[var(--status-error)]">
                  {g.voz.erro}
                </span>
              )}
              {g.voz.amostraUrl ? (
                <audio
                  controls
                  preload="none"
                  src={g.voz.amostraUrl}
                  className="mt-1 h-9 w-[280px]"
                >
                  <track kind="captions" />
                </audio>
              ) : (
                <span className="text-[12px] text-[var(--ash)]">
                  {g.voz.status === "ready"
                    ? "a amostra de áudio não foi encontrada"
                    : "ainda não há áudio para ouvir"}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[12px] text-[var(--ash)]">
              Este pedido ainda não tem voz criada.
            </span>
          )}
        </SecaoGerados>

        <SecaoGerados
          titulo="Imagens do clone"
          // Decisão 3: teto que corta em silêncio faz o atendente afirmar um
          // número menor do que o aluno tem.
          nota={
            g.imagensTotal > g.imagens.length
              ? `mostrando ${g.imagens.length} de ${g.imagensTotal}`
              : null
          }
        >
          {g.imagens.length === 0 ? (
            <span className="text-[12px] text-[var(--ash)]">Nenhuma imagem gerada ainda.</span>
          ) : (
            <div className="flex max-w-[460px] flex-wrap gap-2">
              {g.imagens.map((img) => (
                <a
                  key={img.id ?? img.url}
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Abrir em tamanho real · ${dt(img.criadoEm)}`}
                  className="block overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] transition-colors hover:border-[var(--hairline-bright)]"
                >
                  {/* <img> cru, não next/image: são URLs assinadas de 1h de um
                      bucket R2, que o otimizador não tem como pré-processar. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" loading="lazy" className="size-[72px] object-cover" />
                </a>
              ))}
            </div>
          )}
        </SecaoGerados>

        <SecaoGerados
          titulo="Vídeos na plataforma"
          // Decisão 1: escrito na própria seção, não só no comentário do código.
          nota="não faz parte da entrega do SGP"
        >
          {g.videos.length === 0 ? (
            <span className="text-[12px] text-[var(--ash)]">
              Esta pessoa ainda não fez vídeo na plataforma.
            </span>
          ) : (
            <div className="flex flex-col gap-1.5">
              {g.videos.map((v) => (
                <span key={v.id ?? `${v.origem}-${v.criadoEm}`} className="flex items-center gap-2">
                  {v.url ? (
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink)] underline underline-offset-2 hover:text-[var(--status-online)]"
                    >
                      <ExternalLink className="size-3.5 shrink-0" />
                      {v.nome ?? "vídeo sem nome"}
                    </a>
                  ) : (
                    <span className="text-[13px] text-[var(--mute)]">
                      {v.nome ?? "vídeo sem nome"}
                    </span>
                  )}
                  <span
                    className={`font-mono text-[11px] ${
                      v.status === "failed" ? "text-[var(--status-error)]" : "text-[var(--ash)]"
                    }`}
                  >
                    {videoLegivel(v.status)} · {dt(v.criadoEm)}
                  </span>
                </span>
              ))}
              {g.videosTotal > g.videos.length && (
                <span className="font-mono text-[11px] text-[var(--ash)]">
                  mostrando {g.videos.length} de {g.videosTotal}
                </span>
              )}
            </div>
          )}
        </SecaoGerados>
      </div>
    </div>
  );
}

function SecaoGerados({
  titulo,
  nota = null,
  children,
}: {
  titulo: string;
  nota?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ash)]">
        {titulo}
        {nota ? <span className="ml-2 normal-case tracking-normal">({nota})</span> : null}
      </span>
      {children}
    </div>
  );
}

/**
 * A coluna "Contato com o aluno": as DUAS conversas que o time tem com ele, na
 * mesma célula porque nunca acontecem ao mesmo tempo.
 *
 *  · o aluno travou no wizard  → "Já cobrei"      (migration 106)
 *  · o clone dele ficou pronto → "Avisei o aluno" (migration 116, recado 6)
 *
 * Um pedido está no wizard OU já foi gerado, nunca nos dois — então dividir a
 * célula não esconde nada. O que se ganha é a tabela não crescer uma 15ª coluna:
 * ela já sai em ~1780px e foi preciso mover os botões pras primeiras colunas
 * pra caberem na tela (defeito reclamado 3x pelo Lucas). Coluna nova empurraria
 * "Atendimento" pra fora da viewport de novo.
 */
function CelulaContato({
  linha,
  disponivel,
  avisoDisponivel,
  salvando,
  abertoAviso,
  onAbrirAviso,
  onFecharAviso,
  onAvisar,
  onMarcar,
  onDesfazer,
}: {
  linha: LinhaPainel;
  disponivel: boolean;
  avisoDisponivel: boolean;
  salvando: boolean;
  abertoAviso: boolean;
  onAbrirAviso: () => void;
  onFecharAviso: () => void;
  /** `null` = desfazer. */
  onAvisar: (canal: string | null) => void;
  onMarcar: () => void;
  onDesfazer: () => void;
}) {
  // Clone gerado: a conversa aqui é "o aluno sabe?", não "já cobrou?".
  if (linha.status === "pronto") {
    return (
      <CelulaAviso
        linha={linha}
        disponivel={avisoDisponivel}
        salvando={salvando}
        aberto={abertoAviso}
        onAbrir={onAbrirAviso}
        onFechar={onFecharAviso}
        onAvisar={onAvisar}
      />
    );
  }
  return (
    <CelulaCobranca
      linha={linha}
      disponivel={disponivel}
      salvando={salvando}
      onMarcar={onMarcar}
      onDesfazer={onDesfazer}
    />
  );
}

/**
 * "Avisei o aluno" (recado 6, 15/09). Quatro estados:
 *
 *  - já há registro de aviso   → quem avisou, quando e por qual canal;
 *  - sem registro, migration ok → o botão, que pergunta POR ONDE antes de gravar;
 *  - sem registro, sem migration → diz que não dá pra registrar, sem sumir com
 *    a pendência (a linha continua em GERADO e continua pedindo o aviso);
 *  - registro do SISTEMA → sem "desfazer", porque não há o que desfazer.
 *
 * ⚠️ O BOTÃO NÃO MANDA MENSAGEM. Ele REGISTRA um aviso que a pessoa já deu pelo
 * canal dela. É o mesmo princípio do "Já cobrei", e a regra do SGP inteiro: o
 * sistema não fala com aluno sozinho.
 *
 * ⚠️ O CANAL É OBRIGATÓRIO, e por isso o clique abre a escolha em vez de gravar
 * direto. "Avisado" sem dizer por onde é quase tão vago quanto o "Entregue" que
 * este PR aposentou — WhatsApp e e-mail têm chances de chegar muito diferentes,
 * e sem essa coluna não dá pra auditar nada depois.
 */
function CelulaAviso({
  linha,
  disponivel,
  salvando,
  aberto,
  onAbrir,
  onFechar,
  onAvisar,
}: {
  linha: LinhaPainel;
  disponivel: boolean;
  salvando: boolean;
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  onAvisar: (canal: string | null) => void;
}) {
  if (linha.avisado) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-start gap-1.5 text-[12px] text-[var(--body)]">
          <CheckCheck className="mt-[2px] size-3.5 shrink-0 text-[var(--status-online)]" />
          {linha.avisadoTexto}
        </span>
        {/* Só o carimbo do TIME tem desfazer: o do sistema é o e-mail automático,
            e "desfazer" ali limparia colunas vazias sem mudar a linha. */}
        {linha.avisadoPeloTime && disponivel && (
          <button
            type="button"
            onClick={() => onAvisar(null)}
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
    // A pendência NÃO some junto com o botão: a linha segue em GERADO, o banner
    // segue contando, e o atendente fica sabendo que o aviso é dele mesmo assim.
    return (
      <span className="text-[11px] text-[var(--ash)]">
        avise o aluno — o registro do aviso ainda não está liberado
      </span>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={onAbrir}
        disabled={salvando}
        className="rounded-[var(--radius)] border border-[var(--status-warn)]/50 px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-deep)] disabled:opacity-50"
      >
        Avisei o aluno
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-[var(--mute)]">Por onde você avisou?</span>
      <div className="flex flex-wrap gap-1">
        {SGP_CANAIS_AVISO.map((canal) => (
          <button
            key={canal}
            type="button"
            onClick={() => onAvisar(canal)}
            disabled={salvando}
            className="rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2 py-1 text-[11px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-deep)] disabled:opacity-50"
          >
            {canal}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onFechar}
        disabled={salvando}
        className="w-fit text-[11px] text-[var(--mute)] underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-50"
      >
        {salvando ? "registrando…" : "cancelar"}
      </button>
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
 * "Concluir atendimento" (pedido do Lucas, 14/09).
 *
 * Mesma forma das outras duas células (é o padrão que o time já usa e que
 * funciona): nada esconde a linha e sempre há como desfazer. Três diferenças,
 * todas deliberadas:
 *
 *  1. O BOTÃO APARECE EM QUALQUER LINHA, como o de erro. Concluir é uma decisão
 *     sobre o ATENDIMENTO, e ela cabe tanto num pedido entregue quanto num que
 *     nunca vai ser (aluno reembolsado, desistiu).
 *  2. É A MARCA QUE MAIS SILENCIA: tira o vermelho, o contador de parados e a
 *     posição no topo, e NÃO vence por tempo. Por isso o botão de desfazer fica
 *     sempre visível, e não escondido atrás de nada.
 *  3. QUANDO O ALUNO MEXE DEPOIS a conclusão vira HISTÓRICO em vez de sumir: a
 *     tela diz isso com todas as letras e oferece concluir de novo. Apagar a
 *     declaração de alguém seria destruir rastro; ignorá-la seria deixar um caso
 *     reaberto calado para sempre.
 */
function CelulaConcluir({
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
  // Concluído e valendo: quem, quando, por quê, e como desfazer.
  if (linha.concluido) {
    return (
      <div className="flex flex-col gap-1">
        {/* ⚠️ `max-w-[200px]` entrou em 16/09, e NÃO é cosmético: esta era a
            ÚNICA linha da célula sem teto de largura (o motivo e o aviso logo
            abaixo já tinham o mesmo). Sem ele a coluna cresce até caber o texto
            mais longo — hoje um e-mail comprido de atendente — e é assim que a
            tabela empurra as colunas de ação pra fora da viewport de 1267px,
            que é a largura real de uso e que já foi reclamada três vezes.
            MEDIDO em Chrome headless a 1267px: sem o teto a tabela sai com
            2284px e a borda direita da coluna "Atendimento" cai em x=1367; com
            o teto, 2237px e x=1320 — 47px devolvidos. Com ele a largura fica
            limitada POR CONSTRUÇÃO: o texto quebra de linha, a tabela não anda. */}
        <span className="inline-flex max-w-[200px] items-start gap-1.5 text-[12px] leading-snug text-[var(--ink)]">
          <CheckCheck className="mt-0.5 size-3.5 shrink-0" />
          {linha.concluidoTexto}
        </span>
        {linha.concluidoMotivo && (
          <span className="max-w-[200px] text-[11px] leading-snug text-[var(--body)]">
            &ldquo;{linha.concluidoMotivo}&rdquo;
          </span>
        )}
        {/* O aviso que impede a etiqueta de virar tampa: encerrado NÃO quer
            dizer entregue, e quando não foi entregue isso fica escrito.
            ⚠️ `!== "entregue"` desde 15/09: com o corte do recado 6, "pronto"
            passou a significar GERADO SEM AVISO — que é justamente uma pendência.
            Manter a comparação antiga faria este aviso calar no caso novo. */}
        {linha.situacaoPorBaixo !== "entregue" && (
          <span className="max-w-[200px] text-[11px] leading-snug text-[var(--status-warn)]">
            o aluno não recebeu o clone
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
            {salvando ? "reabrindo…" : "reabrir"}
          </button>
        )}
      </div>
    );
  }

  if (!disponivel) {
    return <span className="text-[11px] text-[var(--ash)]">conclusão ainda não liberada</span>;
  }

  if (!aberto) {
    return (
      <div className="flex flex-col gap-1">
        {/* Conclusão superada: a decisão anterior continua à vista, mas a linha
            já voltou a se comportar como aberta. */}
        {linha.conclusaoSuperada && linha.concluidoTexto && (
          <span className="max-w-[200px] text-[11px] leading-snug text-[var(--mute)]">
            {linha.concluidoTexto}
          </span>
        )}
        <button
          type="button"
          onClick={onAbrir}
          className="w-fit rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-deep)]"
        >
          {linha.conclusaoSuperada ? "Concluir de novo" : "Concluir atendimento"}
        </button>
      </div>
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
        placeholder="Como foi resolvido? (opcional)"
        className="w-[200px] resize-y rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-2 py-1.5 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--ink)]/60"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMarcar}
          disabled={salvando}
          className="rounded-[var(--radius)] border border-[var(--ink)]/30 bg-[var(--ink)]/[0.06] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--ink)]/[0.12] disabled:opacity-50"
        >
          {salvando ? "concluindo…" : "Confirmar conclusão"}
        </button>
        {/* Igual ao de erro: fecha o campo mas NÃO apaga o que foi digitado. */}
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
  /**
   * A busca desta aba é INDEPENDENTE da da fila de propósito: são duas listas
   * diferentes e dois momentos diferentes do trabalho (atender quem chamou ×
   * prospectar quem nunca começou). Uma busca só, compartilhada, faria o time
   * trocar de aba e encontrar a lista já recortada sem ter pedido.
   */
  const [busca, setBusca] = useState("");

  // Mesma régua da outra aba (lib/sgp/busca.ts). Só o telefone mora com outro
  // nome aqui: `celularDigitos`, que já vem só com dígito e `null` quando falta.
  const visiveis = filtrarBusca(busca, linhas ?? [], (c) => ({
    nome: c.nome,
    email: c.email,
    telefone: c.celularDigitos,
  }));

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
          <Contador rotulo="CONCLUÍDO" n={resumo.situacoes.concluido} />
          {/* Os mesmos dois buckets da outra aba (recado 6): as duas nunca podem
              discordar sobre o mesmo aluno, e as duas leem o mesmo `situacao`. */}
          <Contador rotulo="ENTREGUE" n={resumo.situacoes.entregue} />
          <Contador rotulo="GERADO" n={resumo.situacoes.pronto} />
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

      {/* Acima da tabela, igual à outra aba — e pelo mesmo motivo. */}
      <CampoBusca
        valor={busca}
        onMudar={setBusca}
        placeholder="Buscar por nome, e-mail ou WhatsApp…"
        achados={visiveis.length}
      />

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        {carregando && linhas === null ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">carregando…</div>
        ) : !linhas || linhas.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">
            nenhum comprador de SGP encontrado
          </div>
        ) : visiveis.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">
            {/* A lista TEM gente; quem não achou foi a busca. Sem esta distinção
                o atendente lê "nenhum comprador" e conclui que a pessoa não
                comprou — exatamente a afirmação que ele não pode fazer. */}
            nenhum dos {linhas.length} compradores casa com esse texto
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
              {visiveis.map((c) => (
                <tr
                  key={c.chave}
                  className={`border-t border-[var(--hairline)] align-top ${
                    c.entregue
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
                    {c.entregue ? "—" : c.esperandoTexto}
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
          , porque não há defeito nenhum — falta contato. Marcar erro e concluir o atendimento se fazem
          na aba <strong>Fila de trabalho</strong>, que é onde existe o pedido. Lista completa: quem comprou o
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

/**
 * Pill de contagem. Com `onClick` ela é um BOTÃO de verdade (`<button>`), não um
 * `<span>` com handler: assim pega teclado, foco e leitor de tela de graça.
 *
 * O estado ligado precisa ser óbvio à distância — o Lucas relatou 3x que "não dá
 * pra clicar", e parte disso era não haver NADA na tela dizendo que a pill era
 * clicável. Daí o hover, o cursor e a borda acesa no estado ativo.
 */
function Contador({
  rotulo,
  n,
  ativo = false,
  onClick,
}: {
  rotulo: string;
  n: number;
  ativo?: boolean;
  onClick?: () => void;
}) {
  const miolo = (
    <>
      <span className={`text-[12px] ${ativo ? "text-[var(--ink)]" : "text-[var(--mute)]"}`}>{rotulo}</span>
      <span className="font-mono text-[12px] tabular-nums text-[var(--ink)]">{n}</span>
    </>
  );
  const base = "inline-flex items-center gap-2 rounded-[var(--radius-full)] border px-3 py-1";

  if (!onClick) {
    return <span className={`${base} border-[var(--hairline-strong)]`}>{miolo}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`${base} cursor-pointer transition-colors ${
        ativo
          ? "border-[var(--hairline-bright)] bg-[var(--surface-deep)]"
          : "border-[var(--hairline-strong)] hover:border-[var(--hairline-bright)]"
      }`}
    >
      {miolo}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] font-normal uppercase tracking-wider text-[var(--ash)]">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  /** Usado pelas linhas de "Não iniciou", que fundem as 3 células de ação. */
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-3 py-3 text-[13px] ${className}`}>
      {children}
    </td>
  );
}
