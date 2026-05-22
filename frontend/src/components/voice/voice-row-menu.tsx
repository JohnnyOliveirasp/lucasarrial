"use client";

import { useState } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { DeleteVoiceDialog } from "./delete-voice-modal";

type Props = {
  voiceId: string;
  voiceName: string;
  /** proxy: só tem LoRA quando status === "ready" */
  hasLora: boolean;
};

/** Menu ••• por linha na lista de vozes (estilo ElevenLabs). Por ora só "Apagar". */
export function VoiceRowMenu({ voiceId, voiceName, hasLora }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        aria-label="Ações da voz"
        onClick={() => setMenuOpen((v) => !v)}
        className="px-3 self-stretch text-muted-fg transition-colors hover:bg-surface hover:text-fg"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {menuOpen && (
        <>
          {/* backdrop invisível pra fechar ao clicar fora */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-2 top-full z-50 mt-1 min-w-[150px] border border-border bg-bg shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setDialogOpen(true);
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide text-accent transition-colors hover:bg-accent hover:text-accent-fg"
            >
              <Trash2 className="h-4 w-4" />
              Apagar
            </button>
          </div>
        </>
      )}

      <DeleteVoiceDialog
        voiceId={voiceId}
        voiceName={voiceName}
        hasLora={hasLora}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
