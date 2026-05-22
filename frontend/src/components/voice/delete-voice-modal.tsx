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
  const [target, setTarget] = useState<Target>(hasLora ? "lora" : "voice");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameMatches = confirmText.trim() === voiceName;
  const canDelete = nameMatches && !deleting;

  function close() {
    if (deleting) return;
    setConfirmText("");
    setError(null);
    setTarget(hasLora ? "lora" : "voice");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="w-full max-w-lg border border-accent bg-bg p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-2xl uppercase tracking-tight text-fg">
            Apagar — ação irreversível
          </h3>
          <button
            type="button"
            onClick={close}
            className="text-muted-fg hover:text-fg"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Escolha do alvo */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
            O que apagar
          </span>

          {hasLora && (
            <label
              className={`flex cursor-pointer gap-3 border p-3 ${
                target === "lora" ? "border-accent bg-accent/5" : "border-border bg-surface"
              }`}
            >
              <input
                type="radio"
                name="delete-target"
                className="mt-1 accent-[var(--color-accent,#ff5500)]"
                checked={target === "lora"}
                onChange={() => setTarget("lora")}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-fg">Apagar só a LoRA</span>
                <span className="text-xs text-muted-fg">
                  Mantém os áudios enviados. A voz volta pra &quot;pronta pra treinar&quot; e você
                  pode retreinar sem subir áudio de novo.
                </span>
              </span>
            </label>
          )}

          <label
            className={`flex cursor-pointer gap-3 border p-3 ${
              target === "voice" ? "border-accent bg-accent/5" : "border-border bg-surface"
            }`}
          >
            <input
              type="radio"
              name="delete-target"
              className="mt-1 accent-[var(--color-accent,#ff5500)]"
              checked={target === "voice"}
              onChange={() => setTarget("voice")}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-fg">Apagar a voz inteira</span>
              <span className="text-xs text-muted-fg">
                Remove TUDO: áudios enviados, a LoRA, áudios gerados, referências e todos os
                registros no banco. Não dá pra recuperar.
              </span>
            </span>
          </label>
        </div>

        {/* Trava por nome (senha) — exigida nos DOIS modos */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirm-name"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg"
          >
            Pra confirmar, digite o nome da voz: <span className="text-accent">{voiceName}</span>
          </label>
          <input
            id="confirm-name"
            type="text"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={voiceName}
            className="border border-border bg-bg px-3 py-3 text-sm text-fg placeholder:text-muted-fg/50 focus:border-accent focus:outline-none"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent"
          >
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={close}
            className="border border-border px-5 py-3 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            className="flex items-center gap-2 bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
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
    <section className="border border-accent/40 bg-accent/[0.03] p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-accent" />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Zona de perigo
        </h2>
      </div>
      <p className="text-sm text-muted-fg">
        Apagar é <strong className="text-fg">irreversível</strong>. Remove os arquivos do
        armazenamento (R2) e os registros do banco — não dá pra desfazer.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 border border-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-accent hover:text-accent-fg active:scale-[0.99] w-fit"
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
