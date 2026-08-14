"use client";

/**
 * R1 — quem reage ao vídeo.
 *
 * Gravar na hora ficou de FORA (decisão do Johnny 14/08: sai caro e tem
 * variável demais — webcam, luz, enquadramento). Sobraram três caminhos.
 *
 * ⚠️ A escolha aqui MANDA no layout do R5: só clone e HeyGen nascem de uma
 * FOTO, e é isso que permite gerar a versão em fundo verde e recortar a
 * pessoa por cima do viral (o formato do Lucas). Vídeo gravado na sala da
 * casa não tem como ser recortado — quem sobe o próprio vídeo fica com as
 * telas divididas, e é honesto avisar isso ANTES.
 */
import { UserSquare2, MonitorPlay, Upload } from "lucide-react";
import type { AvatarEscolhido, ReactDraft } from "./react-tipos";

const OPCOES: {
  kind: AvatarEscolhido["kind"];
  titulo: string;
  corpo: string;
  icone: typeof UserSquare2;
  recorta: boolean;
}[] = [
  {
    kind: "clone",
    titulo: "Meu clone",
    corpo: "Sua foto ganha voz e movimento aqui dentro. 105 créditos por segundo.",
    icone: UserSquare2,
    recorta: true,
  },
  {
    kind: "heygen",
    titulo: "HeyGen",
    corpo: "Usa o avatar da sua conta HeyGen — consome os créditos de lá, não os daqui.",
    icone: MonitorPlay,
    recorta: true,
  },
  {
    kind: "upload",
    titulo: "Meu vídeo",
    corpo: "Você já gravou e sobe o arquivo. Serve só pros layouts de tela dividida.",
    icone: Upload,
    recorta: false,
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
          Clone e HeyGen nascem de uma foto — por isso dá pra recortar você por cima do
          viral. Vídeo que você grava não tem recorte: fica em tela dividida.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-3">
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
                <span
                  className={`mt-auto pt-1 text-[10.5px] ${
                    o.recorta ? "text-[var(--silver)]" : "text-[var(--ash)]"
                  }`}
                >
                  {o.recorta ? "✓ permite o recorte por cima do viral" : "só tela dividida"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Regra do Johnny (14/08): a foto do avatar tem que ser do MEIO CORPO
          PRA CIMA. De corpo inteiro o rosto vira um ponto — e no React o
          avatar ainda aparece reduzido, sobreposto ao viral. */}
      {(draft.avatar?.kind === "clone" || draft.avatar?.kind === "heygen") && (
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

      {draft.avatar?.kind === "upload" && (
        <p className="rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-deep)] px-3 py-2 text-[12px] text-[var(--mute)]">
          Com vídeo próprio o layout &quot;você recortado por cima do viral&quot; não fica
          disponível — a gente não consegue separar você do fundo da sua sala de forma
          limpa. Os layouts de tela dividida funcionam normalmente.
        </p>
      )}
    </div>
  );
}
