"use client";

/**
 * R4 — a voz do React.
 *
 * Dois caminhos (decidido em 14/08):
 *  · voz clonada da pessoa (TTS, mesma rota do wizard de Edição)
 *  · ela mesma grava — e aí **teleprompter é obrigatório**, com a velocidade
 *    saindo do tempo do viral. Sem isso ela fala 40s em cima de um trecho de
 *    15s e a montagem não fecha (regra do Johnny).
 *
 * O CTA entra no MESMO áudio, no fim: ele tem cena própria, então não
 * disputa o tempo do viral.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactDraft } from "./react-tipos";

type Voz = { id: string; name: string; status: string };

/** Uma linha do histórico de gerações (GET /api/v1/generations). */
type GenHist = {
  id: string;
  status: string;
  text_raw: string | null;
  audio_url: string | null;
};

const EM_VOO = ["pending", "generating"];

export function ReactPassoAudio({
  draft,
  update,
}: {
  draft: ReactDraft;
  update: (m: Partial<ReactDraft>) => void;
}) {
  const [vozes, setVozes] = useState<Voz[]>([]);
  const [vozId, setVozId] = useState<string>(draft.vozId ?? "");
  const [gerando, setGerando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** Vira false quando a tela sai — o poll para de escrever em componente morto. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  /** Texto final falado: comentário + CTA (quando existir). */
  const texto = [draft.roteiro.trim(), draft.cta.trim()].filter(Boolean).join("\n\n");
  const custo = Math.max(400, texto.length);

  useEffect(() => {
    void fetch("/api/v1/voices")
      .then((r) => r.json())
      .then((j) => {
        const vs = ((j?.data?.voices ?? j?.voices ?? []) as Voz[]).filter(
          (v) => v.status === "ready",
        );
        setVozes(vs);
        if (vs.length === 1 && !vozId) setVozId(vs[0].id);
      })
      .catch(() => setVozes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Acompanha uma geração até o fim. Vive fora do gerar() de propósito: ele
   * também roda na VOLTA pra tela. O id fica no rascunho desde o primeiro
   * segundo, então sair no meio não perde mais o áudio — nem faz pagar de novo.
   */
  const acompanhar = useCallback(
    async (genId: string): Promise<void> => {
      for (let i = 0; i < 120; i++) {
        const j = await fetch(`/api/v1/generations/${genId}`, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => null);
        // ⚠️ A rota devolve { generation: {...} } — NÃO tem envelope "data".
        // Ler errado aqui fazia o poll nunca ver "ready" (bug de 14/08).
        const g = (j?.generation ?? j?.data?.generation ?? j) as {
          status?: string;
          audio_url?: string | null;
          error_message?: string | null;
        } | null;
        if (g?.status === "ready" && g.audio_url) {
          update({ audioUrl: g.audio_url, audioGenId: genId });
          return;
        }
        if (g?.status === "failed") {
          setErro(g.error_message ?? "A geração do áudio falhou.");
          update({ audioGenId: null });
          return;
        }
        // Saiu da tela: para o loop, mas o id está guardado — retoma na volta.
        if (!vivo.current) return;
        await new Promise((s) => setTimeout(s, 3000));
      }
      setErro("O áudio está demorando demais. Volte a este passo em instantes.");
    },
    [update],
  );

  /** Na volta pra tela: retoma o áudio que ficou gerando (e renova a URL, que
   *  é presignada e vence em 1h). */
  useEffect(() => {
    if (!draft.audioGenId) return;
    setRecuperando(true);
    void acompanhar(draft.audioGenId).finally(() => setRecuperando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Resgate: áudio gerado numa visita anterior que o rascunho não guardou.
   * Procura no histórico da voz um áudio com EXATAMENTE este texto — se achar,
   * adota em vez de gerar (e cobrar) de novo.
   */
  const resgatado = useRef<string>("");
  useEffect(() => {
    if (!vozId || draft.audioGenId || draft.audioUrl || texto.length < 20) return;
    if (resgatado.current === vozId) return;
    resgatado.current = vozId;
    void (async () => {
      const j = await fetch(`/api/v1/generations?voice_id=${vozId}&limit=10`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .catch(() => null);
      const igual = ((j?.generations ?? []) as GenHist[]).find(
        (g) => (g.text_raw ?? "").trim() === texto.trim(),
      );
      if (!igual || !vivo.current) return;
      if (igual.status === "ready" && igual.audio_url) {
        update({ vozId, audioUrl: igual.audio_url, audioGenId: igual.id });
      } else if (EM_VOO.includes(igual.status)) {
        update({ vozId, audioGenId: igual.id });
        setRecuperando(true);
        await acompanhar(igual.id).finally(() => setRecuperando(false));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vozId, texto]);

  async function gerar() {
    if (!vozId) return;
    setGerando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/v1/voices/${vozId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: texto }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(j?.error?.message ?? "Não consegui gerar o áudio.");
        return;
      }
      const genId = (j?.generation_id ?? j?.data?.generation_id) as string | undefined;
      if (!genId) {
        setErro("O servidor não devolveu a geração.");
        return;
      }
      // Guarda o id ANTES de esperar: é isso que salva o áudio já cobrado se a
      // pessoa fechar a aba no meio.
      update({ vozId, audioGenId: genId, audioUrl: null });
      await acompanhar(genId);
    } catch {
      setErro("Falha de rede ao gerar o áudio.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">A sua voz</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--mute)]">
          O comentário e a chamada final entram no mesmo áudio.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { v: "clone", r: "Minha voz clonada" },
            { v: "gravar", r: "Eu mesmo gravo" },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => update({ modoAudio: o.v })}
            className={`h-9 rounded-full border px-4 text-[12.5px] ${
              draft.modoAudio === o.v
                ? "border-[var(--ink)] bg-[var(--ink)] font-semibold text-[var(--surface-deep)]"
                : "border-[var(--hairline-strong)] text-[var(--ink)]"
            }`}
          >
            {o.r}
          </button>
        ))}
      </div>

      {draft.modoAudio === "clone" && (
        <div className="flex flex-col gap-2">
          {vozes.length === 0 ? (
            <p className="text-[12.5px] text-[var(--mute)]">
              Você ainda não tem voz pronta. Crie uma em Vozes e volte aqui.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={vozId}
                onChange={(e) => {
                  setVozId(e.target.value);
                  // Guarda a voz no rascunho já na escolha: sem ela o resgate
                  // do áudio não tem onde procurar.
                  update({ vozId: e.target.value || null });
                }}
                className="h-10 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-[13px] text-[var(--ink)]"
              >
                <option value="" className="bg-[var(--surface-deep)] text-[var(--ink)]">
                  escolha a voz
                </option>
                {vozes.map((v) => (
                  <option
                    key={v.id}
                    value={v.id}
                    className="bg-[var(--surface-deep)] text-[var(--ink)]"
                  >
                    {v.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={gerar}
                disabled={gerando || recuperando || !vozId || texto.length < 20}
                className="h-10 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
              >
                {gerando
                  ? "Gerando o áudio…"
                  : recuperando
                    ? "Procurando o áudio…"
                    : draft.audioUrl
                      ? "Gerar de novo"
                      : "Gerar o áudio"}
              </button>
              <span className="text-[12px] text-[var(--mute)]">
                {custo.toLocaleString("pt-BR")} créditos
              </span>
            </div>
          )}
          {recuperando && !draft.audioUrl && (
            <p className="text-[12px] text-[var(--mute)]">
              Este áudio já foi mandado gerar — estou recuperando ele em vez de cobrar de novo.
            </p>
          )}
          {draft.audioUrl && (
            <audio src={draft.audioUrl} controls className="h-9 w-full max-w-md" />
          )}
        </div>
      )}

      {draft.modoAudio === "gravar" && <Teleprompter draft={draft} texto={texto} />}

      {erro && <p className="text-[12.5px] text-red-400">{erro}</p>}
    </div>
  );
}

/**
 * Teleprompter: rola o texto no ritmo que faz a fala CABER no vídeo.
 * A velocidade sai de palavras ÷ duração — não é enfeite, é o que impede a
 * pessoa de gravar 40s pra um trecho de 15s.
 */
function Teleprompter({ draft, texto }: { draft: ReactDraft; texto: string }) {
  const [rodando, setRodando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
  const duracao = draft.viral?.duracao_seg ? Math.round(draft.viral.duracao_seg) : null;
  /** Ritmo alvo: as palavras do roteiro no tempo do vídeo. */
  const ppm = duracao ? Math.round((palavras / duracao) * 60) : 150;

  useEffect(() => {
    if (!rodando || !caixa.current) return;
    const el = caixa.current;
    const total = el.scrollHeight - el.clientHeight;
    if (total <= 0) return;
    const segundos = duracao ?? Math.round(palavras / 2.5);
    const passo = 50; // ms
    const inc = total / ((segundos * 1000) / passo);
    const timer = setInterval(() => {
      el.scrollTop += inc;
      if (el.scrollTop >= total) {
        clearInterval(timer);
        setRodando(false);
      }
    }, passo);
    return () => clearInterval(timer);
  }, [rodando, duracao, palavras]);

  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[12px] text-[var(--mute)]">
        ⏱️ Leia acompanhando o rolar do texto: é esse ritmo que faz a sua fala caber nos{" "}
        <strong className="text-[var(--ink)]">{duracao ?? "?"} segundos</strong> do vídeo.
        {palavras > 0 && duracao ? ` São ${palavras} palavras — cerca de ${ppm} por minuto.` : ""}
      </p>
      <div
        ref={caixa}
        className="h-40 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-black/40 p-4 text-center text-[18px] leading-relaxed text-white"
      >
        {texto.split("\n").map((l, i) => (
          <p key={i} className="mb-3">
            {l}
          </p>
        ))}
        <div className="h-32" />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (caixa.current) caixa.current.scrollTop = 0;
            setRodando((v) => !v);
          }}
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-4 text-[12.5px] text-[var(--ink)]"
        >
          {rodando ? "Parar" : "Começar a rolar"}
        </button>
        <span className="text-[11.5px] text-[var(--mute)]">
          grave pelo celular e suba o arquivo no passo da montagem
        </span>
      </div>
    </div>
  );
}
