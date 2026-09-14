"use client";

/**
 * Conexão BYOK do HeyGen + galeria importada (Lab · Vídeo HeyGen).
 * - Sem conexão: campo pra colar a API key (com passo a passo de onde pegar).
 * - Conectado: COTA DE API da conta (número cru, medido ao vivo) + grupos de
 *   foto-avatar (só os do aluno) + desconectar. A key NUNCA volta do servidor
 *   (nem mascarada).
 *
 * ⚠️ O que aparece aqui é a cota de API do HeyGen, NÃO o saldo FastCloner —
 * são carteiras separadas e os créditos daqui não pagam o HeyGen (14/09).
 */
import { useCallback, useEffect, useState } from "react";
import { HeygenGenerate } from "./heygen-generate";
import type { HeygenAudioSel } from "./heygen-audio-picker";

/**
 * Cota de API do HeyGen, medida AO VIVO pelo GET /account (14/09).
 * `raw` é o `remaining_quota` como o HeyGen devolveu; `credits` é o mesmo
 * número dividido por 60. Mostramos o CRU porque a divisão escondia a ordem
 * de grandeza e o aluno não conseguia distinguir "minha cota acabou" de "a
 * integração deles quebrou" — e tentava reconectar a chave, que nunca resolve.
 */
type Quota = {
  raw: number | null;
  credits: number | null;
  stale: boolean;
  error: string | null;
  error_kind: "auth" | "quota" | "heygen" | "network" | null;
} | null;

type Look = { id: string; name: string; image_url: string | null };
type Group = { id: string; name: string; preview_url: string | null; num_looks: number; looks?: Look[] };

type Props = {
  /** Wizard Vídeo Edição (W3): áudio travado da estação anterior + aviso de
   *  vídeo pronto — repassados direto pro HeygenGenerate. */
  presetAudio?: HeygenAudioSel;
  presetAudioLabel?: string;
  onVideoReady?: (v: { id: string; video_url: string | null }) => void;
};

export function HeygenConnect({ presetAudio, presetAudioLabel, onVideoReady }: Props = {}) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [quota, setQuota] = useState<Quota>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Look escolhido na galeria → vira a foto do vídeo (feedback Lucas 11/08:
  // "nada é clicável"). O estado mora aqui pra galeria e o gerador conversarem.
  const [selectedLook, setSelectedLook] = useState<Look | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const acc = await (await fetch("/api/v1/heygen/account")).json();
      setConnected(Boolean(acc?.data?.connected ?? acc?.connected));
      setQuota(acc?.data?.quota ?? acc?.quota ?? null);
      if (acc?.data?.connected ?? acc?.connected) {
        const av = await (await fetch("/api/v1/heygen/avatars")).json();
        setGroups(av?.data?.groups ?? av?.groups ?? []);
      } else {
        setGroups([]);
      }
    } catch {
      setError("Não foi possível carregar o estado da conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/heygen/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? json?.message ?? "A chave não foi aceita.");
        return;
      }
      setApiKey("");
      await loadState();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Desconectar sua conta HeyGen? A chave salva será apagada.")) return;
    setBusy(true);
    try {
      await fetch("/api/v1/heygen/account", { method: "DELETE" });
      await loadState();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-[14px] text-[var(--mute)]">Carregando…</p>;
  }

  if (!connected) {
    return (
      <div className="max-w-xl rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">Conectar minha conta HeyGen</h2>
        <ol className="mt-3 list-decimal pl-5 text-[13.5px] leading-relaxed text-[var(--mute)]">
          <li>Entre em <span className="font-mono text-[12.5px]">app.heygen.com</span></li>
          <li>Vá em <strong>Settings → Subscriptions &amp; API</strong></li>
          <li>Na seção <strong>HeyGen API</strong>, copie o token e cole aqui:</li>
        </ol>
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Cole sua API key do HeyGen"
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 font-mono text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ash)]"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy || apiKey.trim().length < 20}
            className="rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {busy ? "Validando…" : "Conectar"}
          </button>
        </div>
        {error && <p className="mt-2 text-[13px] text-[var(--danger,#e5484d)]">{error}</p>}
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--ash)]">
          A chave fica criptografada e nunca aparece de volta. Os vídeos gerados aqui consomem a
          cota de API da <strong>sua conta HeyGen</strong> — os seus{" "}
          <strong>créditos FastCloner não pagam o HeyGen</strong>, são saldos separados.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-[13.5px] text-[var(--ink)]">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            Conta HeyGen conectada
          </span>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={busy}
            className="ml-auto text-[12.5px] text-[var(--mute)] underline underline-offset-2 hover:text-[var(--ink)]"
          >
            Desconectar
          </button>
        </div>

        {/* O NÚMERO, cru. Quem vê "0" entende; quem via só "sem créditos"
            achava que o bug era nosso e ia reconectar a chave. */}
        {typeof quota?.raw === "number" ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[13px] text-[var(--mute)]">Cota de API restante na sua conta HeyGen:</span>
            <span
              className={[
                "font-mono text-[18px] font-semibold tabular-nums",
                quota.raw <= 0 ? "text-[var(--danger,#e5484d)]" : "text-[var(--ink)]",
              ].join(" ")}
            >
              {quota.raw.toLocaleString("pt-BR")}
            </span>
            <span className="font-mono text-[12px] text-[var(--ash)]">
              (remaining_quota — equivale a ~
              {(quota.raw / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} créditos de vídeo)
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[13px] text-[var(--mute)]">Cota de API restante na sua conta HeyGen:</span>
            <span className="font-mono text-[13px] text-[var(--ash)]">
              não foi possível consultar agora
              {typeof quota?.credits === "number"
                ? ` — última leitura: ~${quota.credits.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} créditos`
                : ""}
            </span>
          </div>
        )}

        {/* Cota ZERADA: não mandar reconectar. Reconectar não devolve cota. */}
        {typeof quota?.raw === "number" && quota.raw <= 0 && (
          <div className="rounded-[var(--radius-sm)] border border-[var(--danger,#e5484d)]/40 bg-[var(--danger,#e5484d)]/10 px-3 py-2 text-[13px] leading-relaxed text-[var(--ink)]">
            <strong>Sua cota de API do HeyGen chegou a zero.</strong> Enquanto ela estiver em 0,
            nenhum vídeo vai gerar aqui.{" "}
            <strong>Reconectar a chave não resolve</strong> — a sua chave está válida, o que
            acabou foi a cota. Recarregue no site do HeyGen em{" "}
            <strong>Settings → Subscriptions &amp; API</strong> e volte aqui.
          </div>
        )}

        {/* Falha de leitura que NÃO é cota zerada nem chave recusada. */}
        {quota?.error && quota.error_kind !== "quota" && (
          <p className="text-[12.5px] leading-relaxed text-[var(--mute)]">{quota.error}</p>
        )}

        <p className="text-[12px] leading-relaxed text-[var(--ash)]">
          Essa cota é da <strong>sua conta no HeyGen</strong>, comprada por você lá, e é gasta
          com a sua chave. Os seus <strong>créditos FastCloner não pagam o HeyGen</strong> — são
          saldos separados, e ter crédito aqui não gera vídeo lá.
        </p>
      </div>

      <div>
        <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">Seus avatares de foto</h2>
        <p className="mt-0.5 text-[13px] text-[var(--mute)]">
          Importados da sua conta HeyGen. <strong>Clique numa foto</strong> pra usá-la no vídeo.
        </p>
        {error && <p className="mt-2 text-[13px] text-[var(--danger,#e5484d)]">{error}</p>}
        {groups.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-[var(--mute)]">
            Nenhum foto-avatar próprio encontrado nesta conta HeyGen.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {groups.map((g) => {
              // grupo sem looks listáveis: a capa vira o look clicável
              const looks: Look[] =
                g.looks && g.looks.length > 0
                  ? g.looks
                  : g.preview_url
                    ? [{ id: g.id, name: g.name, image_url: g.preview_url }]
                    : [];
              return (
                <li
                  key={g.id}
                  className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-3"
                >
                  <p className="text-[13.5px] font-medium text-[var(--ink)]">
                    {g.name} <span className="text-[12px] font-normal text-[var(--mute)]">· {looks.length} foto{looks.length === 1 ? "" : "s"}</span>
                  </p>
                  {looks.length === 0 ? (
                    <p className="mt-1 text-[12.5px] text-[var(--ash)]">sem fotos neste grupo</p>
                  ) : (
                    <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                      {looks.map((l) => (
                        <li key={l.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedLook(l)}
                            title={`Usar "${l.name}" no vídeo`}
                            className={[
                              "block w-full overflow-hidden rounded-[var(--radius-sm)] border-2 transition-colors",
                              selectedLook?.id === l.id
                                ? "border-[var(--ink)]"
                                : "border-transparent hover:border-[var(--hairline-bright)]",
                            ].join(" ")}
                          >
                            {l.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element -- preview externo do HeyGen
                              <img src={l.image_url} alt={l.name} className="aspect-square w-full object-cover" />
                            ) : (
                              <div className="flex aspect-square w-full items-center justify-center bg-[var(--surface-deep)] text-[11px] text-[var(--ash)]">
                                sem prévia
                              </div>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <HeygenGenerate
        selectedLook={selectedLook}
        onClearLook={() => setSelectedLook(null)}
        onGroupsChanged={() => void loadState()}
        presetAudio={presetAudio}
        presetAudioLabel={presetAudioLabel}
        onVideoReady={onVideoReady}
      />
    </div>
  );
}
