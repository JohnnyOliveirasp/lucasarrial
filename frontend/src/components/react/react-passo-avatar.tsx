"use client";

/**
 * R1 — quem reage ao vídeo.
 *
 * **Só clone ou HeyGen** (correção do Johnny 14/08). Gravar na hora ficou de
 * fora por custo, e subir vídeo próprio é coisa do R0 — lá o upload é do
 * vídeo VIRAL, não do avatar.
 *
 * Como os dois nascem de uma FOTO, todo React pode ser recortado por cima do
 * viral (o formato do Lucas) — e é por isso que a foto importa tanto.
 */
import { UserSquare2, MonitorPlay } from "lucide-react";
import type { AvatarEscolhido, ReactDraft } from "./react-tipos";

const OPCOES: {
  kind: AvatarEscolhido["kind"];
  titulo: string;
  corpo: string;
  icone: typeof UserSquare2;
}[] = [
  {
    kind: "clone",
    titulo: "Meu clone",
    corpo: "Sua foto ganha voz e movimento aqui dentro. 105 créditos por segundo de vídeo.",
    icone: UserSquare2,
  },
  {
    kind: "heygen",
    titulo: "HeyGen",
    corpo: "Usa o avatar da sua conta HeyGen — consome os créditos de lá, não os daqui.",
    icone: MonitorPlay,
  },
];

export function ReactPassoAvatar({
  draft,
  update,
}: {
  draft: ReactDraft;
  update: (m: Partial<ReactDraft>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Quem vai reagir?</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--mute)]">
          Os dois partem de uma foto sua — é isso que permite recortar você e colocar por
          cima do viral.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {OPCOES.map((o) => {
          const ativo = draft.avatar?.kind === o.kind;
          const Icone = o.icone;
          return (
            <li key={o.kind}>
              <button
                type="button"
                onClick={() =>
                  update({ avatar: ativo ? null : { kind: o.kind, label: o.titulo } })
                }
                className={`flex h-full w-full flex-col gap-1 rounded-[var(--radius-sm)] border p-3 text-left transition-colors ${
                  ativo
                    ? "border-[var(--ink)] bg-[var(--surface-deep)]"
                    : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icone className="h-4 w-4 text-[var(--silver)]" />
                  <span className="text-[13.5px] font-semibold text-[var(--ink)]">{o.titulo}</span>
                </span>
                <span className="text-[12px] leading-snug text-[var(--mute)]">{o.corpo}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Regra do Johnny (14/08): a foto do avatar tem que ser do MEIO CORPO
          PRA CIMA. De corpo inteiro o rosto vira um ponto — e no React o
          avatar ainda aparece reduzido, sobreposto ao viral. */}
      {draft.avatar && (
        <div className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2.5">
          <p className="text-[12.5px] font-semibold text-[var(--ink)]">
            📸 A foto tem que ser do meio do corpo pra cima
          </p>
          <p className="text-[12px] leading-snug text-[var(--mute)]">
            Enquadre da cintura ou do peito pra cima, rosto grande e de frente.
            <strong className="text-[var(--ink)]"> Foto de corpo inteiro não serve</strong>: no
            React você aparece reduzido em cima do viral, e o seu rosto — que é o que
            prende a atenção — vira um pontinho. Boca visível e sem óculos escuros ajudam
            o movimento a ficar natural.
          </p>
        </div>
      )}
    </div>
  );
}
