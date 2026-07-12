"use client";

/**
 * Painel do Agente (F0): status da conexão do WhatsApp (QR quando
 * desconectado) + lista de conversas + mensagens da conversa aberta.
 * Poll leve; leitura apenas — assumir/devolver e resposta entram na F2.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, RefreshCw, Smartphone, Users } from "lucide-react";

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
  const [chats, setChats] = useState<Chat[]>([]);
  const [open, setOpen] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/agent/status", { cache: "no-store" });
      if (r.ok) setStatus(await r.json());
    } catch { /* próximo tick */ }
  }, []);

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
        <button
          type="button"
          onClick={() => { loadStatus(); loadChats(); }}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-4 text-[13px] text-[var(--ink)] hover:border-[var(--hairline-bright)]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
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

        <section className={`${CARD} flex max-h-[560px] flex-col`}>
          <div className="border-b border-[var(--hairline)] px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
            {open ? (open.name || open.wa_jid.split("@")[0]) : "Selecione uma conversa"}
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
                    {m.from_me ? (m.role === "agent" ? "🤖 IA" : "Você") : (m.sender_name || "Aluno")}
                  </span>
                  <span className="font-mono text-[9px] text-[var(--ash)]">{fmtTime(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">
                  {m.content || kindLabel(m.kind) || "(sem conteúdo)"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
