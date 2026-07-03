"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, X } from "lucide-react";

type Target = "lora" | "voice";

// ──────────────────────────────────────────────────────────────────
// Dialog controlado (reutilizado no detalhe e na lista)
// ──────────────────────────────────────────────────────────────────
type DialogProps = {
  voiceId: string;
  voiceName: string;
  hasLora: boolean;
  open: boolean;
  onClose: () => void;
};

export function DeleteVoiceDialog({ voiceId, voiceName, hasLora, open, onClose }: DialogProps) {
  const router = useRouter();
  // Padrão = voz INTEIRA. Antes o padrão era "lora" quando a voz estava pronta,
  // e quem queria excluir a voz apagava só a LoRA sem perceber — a voz seguia
  // na lista ("pronta pra treinar") e parecia que o delete não funcionava.
  const [target, setTarget] = useState<Target>("voice");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameMatches = confirmText.trim() === voiceName;
  const canDelete = nameMatches && !deleting;

  function close() {
    if (deleting) return;
    setConfirmText("");
    setError(null);
    setTarget("voice");
    onClose();
  }

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/voices/${voiceId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: target, confirm: confirmText.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message || "Falha ao apagar");
        setDeleting(false);
        return;
      }
      if (target === "voice") {
        router.push("/app/voice-cloning");
        router.refresh();
      } else {
        setDeleting(false);
        setConfirmText("");
        onClose();
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede");
      setDeleting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="flex w-full max-w-lg flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
            Apagar — ação irreversível
          </h3>
          <button
            type="button"
            onClick={close}
            className="text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Escolha do alvo */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] tracking-wide text-[var(--mute)]">
            O que apagar
          </span>

          <label
            className={`flex cursor-pointer gap-3 rounded-[var(--radius)] border p-3 transition-colors ${
              target === "voice"
                ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)]"
                : "border-[var(--hairline-strong)] bg-[var(--surface-deep)]"
            }`}
          >
            <input
              type="radio"
              name="delete-target"
              className="mt-1 accent-[var(--ink)]"
              checked={target === "voice"}
              onChange={() => setTarget("voice")}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-[var(--ink)]">Apagar a voz inteira</span>
              <span className="text-xs text-[var(--mute)]">
                Remove TUDO: áudios enviados, a LoRA, áudios gerados, referências e todos os
                registros no banco. Não dá pra recuperar.
              </span>
            </span>
          </label>

          {hasLora && (
            <label
              className={`flex cursor-pointer gap-3 rounded-[var(--radius)] border p-3 transition-colors ${
                target === "lora"
                  ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)]"
                  : "border-[var(--hairline-strong)] bg-[var(--surface-deep)]"
              }`}
            >
              <input
                type="radio"
                name="delete-target"
                className="mt-1 accent-[var(--ink)]"
                checked={target === "lora"}
                onChange={() => setTarget("lora")}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-[var(--ink)]">Apagar só a LoRA</span>
                <span className="text-xs text-[var(--mute)]">
                  Mantém os áudios enviados. A voz volta pra &quot;pronta pra treinar&quot; e você
                  pode retreinar sem subir áudio de novo.
                </span>
              </span>
            </label>
          )}
        </div>

        {/* Trava por nome (senha) — exigida nos DOIS modos */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirm-name"
            className="font-mono text-[10px] tracking-wide text-[var(--mute)]"
          >
            Pra confirmar, digite o nome da voz: <span className="text-[var(--silver)]">{voiceName}</span>
          </label>
          <input
            id="confirm-name"
            type="text"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={voiceName}
            className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-deep)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={close}
            className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium text-[var(--status-error)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Apagando…" : target === "lora" ? "Apagar LoRA" : "Apagar voz"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// "Zona de perigo" da página de detalhe (botão + dialog)
// ──────────────────────────────────────────────────────────────────
type ModalProps = { voiceId: string; voiceName: string; hasLora: boolean };

export function DeleteVoiceModal({ voiceId, voiceName, hasLora }: ModalProps) {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--status-error)]/30 bg-[var(--surface-card)] p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />
        <h2 className="font-mono text-[12px] tracking-wide text-[var(--status-error)]">
          Zona de perigo
        </h2>
      </div>
      <p className="text-sm text-[var(--body)]">
        Apagar é <strong className="text-[var(--ink)]">irreversível</strong>. Remove os arquivos do
        armazenamento (R2) e os registros do banco — não dá pra desfazer.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium text-[var(--status-error)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
      >
        <Trash2 className="h-4 w-4" />
        Apagar voz / LoRA
      </button>

      <DeleteVoiceDialog
        voiceId={voiceId}
        voiceName={voiceName}
        hasLora={hasLora}
        open={open}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
