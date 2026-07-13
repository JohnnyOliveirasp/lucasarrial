"use client";

/**
 * Painel do Agente (F0+F2): status da conexão (QR quando desconectado),
 * interruptor GERAL da Mary, conversas em tempo real, Assumir/Devolver por
 * conversa e resposta manual pelo painel (sai pelo número do suporte).
 */
import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, MessageSquare, Power, RefreshCw, Send, Smartphone, UserRound, Users } from "lucide-react";

type Status = { instance: string; state: string; qr: string | null };
type Chat = {
  id: string; wa_jid: string; kind: "private" | "group"; name: string | null;
  mode: "auto" | "human"; last_message_at: string | null;
  preview: { content: string | null; kind: string; from_me: boolean } | null;
};
type Msg = {
  id: string; sender_name: string | null; from_me: boolean;
  role: string; kind: string; content: string | null; created_at: string;
};

const CARD = "rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)]";

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function kindLabel(kind: string): string {
  return { audio: "🎤 áudio", image: "🖼️ imagem", video: "🎬 vídeo", document: "📄 arquivo", sticker: "sticker", other: "mensagem" }[kind] ?? "";
}

export function AgentPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [open, setOpen] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/agent/status", { cache: "no-store" });
      if (r.ok) setStatus(await r.json());
      const s = await fetch("/api/v1/agent/settings", { cache: "no-store" });
      if (s.ok) setEnabled((await s.json()).enabled);
    } catch { /* próximo tick */ }
  }, []);

  async function toggleEnabled() {
    const next = !(enabled ?? true);
    setEnabled(next);
    try {
      await fetch("/api/v1/agent/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    } catch { /* o poll corrige */ }
  }

  async function setMode(chat: Chat, mode: "auto" | "human") {
    setOpen({ ...chat, mode });
    setChats((cs) => cs.map((c) => (c.id === chat.id ? { ...c, mode } : c)));
    try {
      await fetch(`/api/v1/agent/chats/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
    } catch { /* o poll corrige */ }
  }

  async function sendDraft(chat: Chat) {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/v1/agent/chats/${chat.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (r.ok) {
        setDraft("");
        setOpen({ ...chat, mode: "human" });
        await loadMessages(chat, false);
      }
    } catch { /* mantém o rascunho */ } finally {
      setSending(false);
    }
  }

  const loadChats = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/agent/chats", { cache: "no-store" });
      if (r.ok) setChats((await r.json()).chats ?? []);
    } catch { /* próximo tick */ }
  }, []);

  const loadMessages = useCallback(async (chat: Chat, showSpinner: boolean) => {
    if (showSpinner) setLoadingMsgs(true);
    try {
      const r = await fetch(`/api/v1/agent/chats/${chat.id}`, { cache: "no-store" });
      if (r.ok) setMessages((await r.json()).messages ?? []);
    } catch { /* próximo tick */ } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadChats();
    const t = setInterval(() => { loadStatus(); loadChats(); }, 10_000);
    return () => clearInterval(t);
  }, [loadStatus, loadChats]);

  useEffect(() => {
    if (!open) return;
    loadMessages(open, true);
    const t = setInterval(() => loadMessages(open, false), 7_000);
    return () => clearInterval(t);
  }, [open, loadMessages]);

  const connected = status?.state === "open";

  return (
    <div className="flex flex-col gap-6">
      {/* ───── status da conexão ───── */}
      <section className={`${CARD} flex flex-wrap items-center gap-4 p-5`}>
        <Smartphone className={`h-5 w-5 ${connected ? "text-emerald-400" : "text-[var(--status-error)]"}`} />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[var(--ink)]">
            {status === null ? "Verificando conexão…" : connected ? "WhatsApp conectado" : "WhatsApp desconectado"}
          </span>
          <span className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
            instância {status?.instance ?? "…"} · estado {status?.state ?? "…"}
          </span>
        </div>
        {!connected && status?.qr && (
          <div className="flex items-center gap-4">
            {/* QR base64 vindo da Evolution — imagem dinâmica, não estática */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={status.qr} alt="QR code pra conectar o WhatsApp" className="h-44 w-44 rounded-[var(--radius)] bg-white p-2" />
            <p className="max-w-xs text-xs leading-relaxed text-[var(--mute)]">
              No celular do suporte: <strong>WhatsApp Business → Aparelhos conectados →
              Conectar aparelho</strong> e escaneie este QR. Ele renova sozinho a cada ~30s.
            </p>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleEnabled}
            title="Liga/desliga a IA em TODAS as conversas (desligada = admins respondem na mão)"
            className={`inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border px-4 text-[13px] font-medium ${
              enabled === false
                ? "border-[var(--status-error)]/50 text-[var(--status-error)]"
                : "border-emerald-500/40 text-emerald-400"
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {enabled === null ? "…" : enabled ? "Mary LIGADA" : "Mary DESLIGADA"}
          </button>
          <button
            type="button"
            onClick={() => { loadStatus(); loadChats(); }}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-4 text-[13px] text-[var(--ink)] hover:border-[var(--hairline-bright)]"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
      </section>

      {/* ───── conversas + mensagens ───── */}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <section className={`${CARD} max-h-[560px] overflow-y-auto`}>
          <div className="border-b border-[var(--hairline)] px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
            Conversas ({chats.length})
          </div>
          {chats.length === 0 && (
            <p className="px-4 py-6 text-sm text-[var(--mute)]">
              Nenhuma mensagem ainda — assim que alguém falar no grupo ou no privado, aparece aqui.
            </p>
          )}
          <ul>
            {chats.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpen(c)}
                  className={`flex w-full flex-col gap-0.5 border-b border-[var(--hairline)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-card)] ${open?.id === c.id ? "bg-[var(--surface-card)]" : ""}`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                    {c.kind === "group" ? <Users className="h-3.5 w-3.5 text-[var(--silver)]" /> : <MessageSquare className="h-3.5 w-3.5 text-[var(--silver)]" />}
                    {c.name || c.wa_jid.split("@")[0]}
                    <span className="ml-auto font-mono text-[10px] text-[var(--ash)]">{fmtTime(c.last_message_at)}</span>
                  </span>
                  <span className="truncate text-xs text-[var(--mute)]">
                    {c.preview ? (c.preview.content || kindLabel(c.preview.kind)) : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${CARD} flex max-h-[640px] flex-col`}>
          <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4 py-2.5">
            <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
              {open ? (open.name || open.wa_jid.split("@")[0]) : "Selecione uma conversa"}
            </span>
            {open && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] ${open.mode === "human" ? "border-amber-500/40 text-amber-400" : "border-emerald-500/40 text-emerald-400"}`}>
                {open.mode === "human" ? <UserRound className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                {open.mode === "human" ? "Humano" : "IA ativa"}
              </span>
            )}
            {open && (
              <button
                type="button"
                onClick={() => setMode(open, open.mode === "human" ? "auto" : "human")}
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-3 text-[12px] text-[var(--ink)] hover:border-[var(--hairline-bright)]"
              >
                {open.mode === "human" ? <><Bot className="h-3.5 w-3.5" /> Devolver pra IA</> : <><UserRound className="h-3.5 w-3.5" /> Assumir</>}
              </button>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {loadingMsgs && <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />}
            {open && !loadingMsgs && messages.length === 0 && (
              <p className="text-sm text-[var(--mute)]">Sem mensagens.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`max-w-[75%] rounded-[var(--radius)] border px-3 py-2 ${m.from_me ? "self-end border-[var(--hairline-bright)] bg-[var(--surface-elevated)]" : "self-start border-[var(--hairline)] bg-[var(--surface-card)]"}`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-medium text-[var(--silver)]">
                    {m.from_me ? (m.role === "agent" ? "🤖 Mary" : "👤 Equipe") : (m.sender_name || "Aluno")}
                  </span>
                  <span className="font-mono text-[9px] text-[var(--ash)]">{fmtTime(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">
                  {m.content || kindLabel(m.kind) || "(sem conteúdo)"}
                </p>
              </div>
            ))}
          </div>

          {/* ───── responder pelo painel (sai pelo número do suporte) ───── */}
          {open && (
            <div className="flex items-center gap-2 border-t border-[var(--hairline)] p-3">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendDraft(open)}
                placeholder="Responder como equipe (assume a conversa)…"
                className="h-10 flex-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 font-sans text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => sendDraft(open)}
                disabled={sending || !draft.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-4 text-[13px] font-medium text-[var(--pill-ink)] disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
