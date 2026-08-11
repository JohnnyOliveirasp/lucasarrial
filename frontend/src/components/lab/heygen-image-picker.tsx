"use client";

/**
 * Foto do vídeo HeyGen (feedback Lucas 11/08): seleção da galeria com
 * destaque VISÍVEL (check + anel), botão "Criar clone" ancorado na imagem
 * selecionada (com campo de nome inline, sem window.prompt) e upload com
 * botão de verdade no lugar do input nativo invisível no tema escuro.
 */
import { useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";

export type PlatformImage = { id: string; name: string | null; url: string | null; status: string };
export type Look = { id: string; name: string; image_url: string | null };

export type HeygenImageSel =
  | { kind: "platform_image"; image_generation_id: string }
  | { kind: "heygen_look"; look_url: string }
  | { kind: "upload"; data_url: string };

type Mode = "platform_image" | "heygen_look" | "upload";

type Props = {
  images: PlatformImage[];
  selectedLook?: Look | null;
  onClearLook?: () => void;
  onGroupsChanged?: () => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  value: HeygenImageSel | null;
  onChange: (v: HeygenImageSel | null) => void;
};

export function HeygenImagePicker({
  images, selectedLook, onClearLook, onGroupsChanged, mode, onModeChange, value, onChange,
}: Props) {
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneBusy, setCloneBusy] = useState(false);
  const [cloneMsg, setCloneMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const selectedId = value?.kind === "platform_image" ? value.image_generation_id : null;
  const selectedImg = images.find((i) => i.id === selectedId) ?? null;

  // Cria um foto-avatar (clone) na conta HeyGen do aluno com a imagem escolhida.
  async function createClone() {
    if (!selectedId) return;
    setCloneBusy(true);
    setCloneMsg(null);
    try {
      const res = await fetch("/api/v1/heygen/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_generation_id: selectedId,
          name: cloneName.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setCloneMsg({ ok: false, text: json?.error?.message ?? json?.message ?? "Não foi possível criar o clone" });
        return;
      }
      setCloneMsg({ ok: true, text: "Clone criado na sua conta HeyGen — já aparece na galeria acima." });
      setCloneOpen(false);
      onGroupsChanged?.();
    } finally {
      setCloneBusy(false);
    }
  }

  function onFile(file: File | null) {
    if (!file) return onChange(null);
    const reader = new FileReader();
    reader.onload = () => onChange({ kind: "upload", data_url: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 text-[13px]">
        {(["platform_image", "heygen_look", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={[
              "rounded-full border px-3 py-1",
              mode === m ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--hairline)] text-[var(--mute)]",
            ].join(" ")}
          >
            {m === "platform_image" ? "Minhas imagens da plataforma" : m === "heygen_look" ? "Avatar do HeyGen" : "Enviar foto"}
          </button>
        ))}
      </div>

      {mode === "heygen_look" ? (
        selectedLook?.image_url ? (
          <div className="mt-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview externo do HeyGen */}
            <img src={selectedLook.image_url} alt={selectedLook.name} className="size-20 rounded-[var(--radius-sm)] border border-[var(--ink)] object-cover" />
            <div className="text-[13px]">
              <p className="font-medium text-[var(--ink)]">{selectedLook.name}</p>
              <button
                type="button"
                onClick={() => onClearLook?.()}
                className="text-[12px] text-[var(--mute)] underline underline-offset-2 hover:text-[var(--ink)]"
              >
                trocar
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-[var(--mute)]">
            Clique numa foto na galeria de avatares acima pra escolher.
          </p>
        )
      ) : mode === "platform_image" ? (
        images.length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--mute)]">
            Você ainda não tem imagens prontas no Gerador de Imagens.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[12.5px] text-[var(--mute)]">Clique numa foto pra selecionar.</p>
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {images.slice(0, 18).map((img) => {
                const sel = img.id === selectedId;
                return (
                  <li key={img.id} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ kind: "platform_image", image_generation_id: img.id });
                        setCloneOpen(false);
                        setCloneMsg(null);
                      }}
                      className={[
                        "block w-full overflow-hidden rounded-[var(--radius-sm)] border-2 transition-opacity",
                        sel ? "border-emerald-400" : "border-transparent opacity-80 hover:opacity-100",
                      ].join(" ")}
                      title={img.name ?? undefined}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 */}
                      <img src={img.url ?? ""} alt={img.name ?? "imagem"} className="aspect-square w-full object-cover" />
                    </button>
                    {sel && (
                      <span className="pointer-events-none absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-400 text-black">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {selectedImg && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-card)] p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 */}
                <img src={selectedImg.url ?? ""} alt="" className="size-12 flex-none rounded-[var(--radius-sm)] object-cover" />
                <div className="min-w-0 text-[12.5px]">
                  <p className="truncate font-medium text-[var(--ink)]">{selectedImg.name || "Imagem selecionada"}</p>
                  <p className="text-[var(--mute)]">Esta foto vai no vídeo.</p>
                </div>
                {!cloneOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCloneName(selectedImg.name ?? "Meu avatar FastCloner");
                      setCloneOpen(true);
                      setCloneMsg(null);
                    }}
                    className="ml-auto rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 py-1.5 text-[12.5px] text-[var(--ink)] hover:bg-[var(--surface-raised)]"
                  >
                    Criar clone no HeyGen com esta imagem
                  </button>
                ) : (
                  <div className="ml-auto flex items-center gap-2">
                    <input
                      value={cloneName}
                      onChange={(e) => setCloneName(e.target.value)}
                      placeholder="Nome do avatar"
                      className="w-44 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)]"
                    />
                    <button
                      type="button"
                      disabled={cloneBusy}
                      onClick={() => void createClone()}
                      className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
                    >
                      {cloneBusy && <Loader2 className="size-3.5 animate-spin" />}
                      {cloneBusy ? "Criando…" : "Criar clone"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {cloneMsg && (
              <p className={["mt-1.5 text-[12.5px]", cloneMsg.ok ? "text-emerald-400" : "text-red-400"].join(" ")}>
                {cloneMsg.text}
              </p>
            )}
          </>
        )
      ) : (
        <div className="mt-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--ink)] hover:bg-[var(--surface-raised)]"
          >
            <Upload className="size-4" />
            Escolher foto do computador (JPG ou PNG)
          </button>
          {value?.kind === "upload" && (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local
            <img src={value.data_url} alt="prévia" className="mt-2 max-h-40 rounded-[var(--radius-sm)]" />
          )}
        </div>
      )}
    </div>
  );
}
