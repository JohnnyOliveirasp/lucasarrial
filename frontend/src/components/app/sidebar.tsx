"use client";

import { useState } from "react";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Mic2,
  Mic,
  AudioLines,
  History,
  Settings,
  ShieldCheck,
  ChevronDown,
  Images,
  PenLine,
  Video,
  Clapperboard,
  ShoppingBag,
  UserSquare2,
  Wand2,
  Flame,
  Bookmark,
  FlaskConical,
  MonitorPlay,
  Send,
  Camera,
  Music2,
} from "lucide-react";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";
import { GrupoPre, NavLeaf } from "./sidebar-nav";

type Props = {
  /** Saldo total de créditos do usuário (plano + avulsos). */
  creditsTotal: number;
  /** Equipe/admin: ilimitado, nunca trava. */
  unlimited: boolean;
  /** Assinatura ativa? Libera itens que fazem parte do pacote pago (API). */
  subscribed: boolean;
  /** É admin (allowlist)? Mostra o atalho pro painel /admin. */
  isAdmin: boolean;
  /** Tem ≥1 voz pronta? Libera "Gerar Áudio". */
  hasReadyVoice: boolean;
  /** Liberação individual do Publicador (social/access.ts) — mostra o grupo
   *  Instagram/TikTok mesmo sem ser admin (modelo "aluno pede", 13/08). */
  publisherAllowed: boolean;
};

export function Sidebar({
  creditsTotal,
  unlimited,
  subscribed,
  isAdmin,
  hasReadyVoice,
  publisherAllowed,
}: Props) {
  const t = useTranslations("app");
  const tShell = useTranslations("shell.sidebar");
  const pathname = usePathname();
  const inVoices =
    pathname.includes("/app/voice-cloning") || pathname.endsWith("/app/history");
  const [voicesOpen, setVoicesOpen] = useState(false);
  const showVoices = voicesOpen || inVoices;
  const inVideos = pathname.includes("/app/videos");
  const [videosOpen, setVideosOpen] = useState(false);
  const showVideos = videosOpen || inVideos;
  const inPublisher = pathname.includes("/app/lab/publicador");
  const [publisherOpen, setPublisherOpen] = useState(false);
  const showPublisher = publisherOpen || inPublisher;

  const lockTrainingTitle = tShell("lockTraining", {
    n: TRAINING_CREDIT_COST.toLocaleString("pt-BR"),
  });

  // 🧪 Publicador ("nosso Blotato"): grupo expansível com um submenu por rede.
  // Renderiza no bloco de pré-produção (admin) OU solto pra quem tem a
  // liberação individual (publisherAllowed) — mesmo JSX nos dois lugares.
  const publisherGroup = (
    <li>
      <button
        type="button"
        onClick={() => setPublisherOpen((o) => !o)}
        aria-expanded={showPublisher}
        className={[
          "group flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm transition-[background-color,color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
          inPublisher
            ? "text-[var(--ink)]"
            : "text-[var(--mute)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]",
        ].join(" ")}
      >
        <span className="flex items-center gap-3">
          <Send
            className={[
              "h-4 w-4",
              inPublisher ? "text-[var(--silver)]" : "text-[var(--ash)] group-hover:text-[var(--silver)]",
            ].join(" ")}
          />
          <span className="font-medium">{tShell("publisher")}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--ash)] transition-transform duration-[var(--dur-base)] ${
            showPublisher ? "rotate-180" : ""
          }`}
        />
      </button>
      {showPublisher && (
        <ul className="ml-[19px] mt-1 flex flex-col gap-1 border-l border-[var(--hairline)] pl-2">
          <NavLeaf
            href="/app/lab/publicador"
            icon={Camera}
            label="Instagram"
            active={pathname.endsWith("/app/lab/publicador")}
          />
          <NavLeaf
            href="/app/lab/publicador/tiktok"
            icon={Music2}
            label="TikTok"
            active={pathname.endsWith("/app/lab/publicador/tiktok")}
          />
        </ul>
      )}
    </li>
  );

  // Sub-itens de "Vozes". Travas iguais às de antes: Gerar Voz livre, Gravador
  // pede crédito p/ treinar; Gerar Áudio (novo) pede voz pronta.
  const voiceChildren = [
    {
      href: "/app/voice-cloning",
      icon: Mic2,
      label: t("nav.generateVoice"),
      locked: false,
      lockTitle: "",
    },
    {
      href: "/app/voice-cloning/generate",
      icon: AudioLines,
      label: t("nav.generateAudio"),
      locked: !unlimited && !hasReadyVoice,
      lockTitle: tShell("lockGenerateAudio"),
    },
    {
      href: "/app/voice-cloning/script",
      icon: Mic,
      label: t("nav.recorder"),
      locked: !unlimited && creditsTotal < TRAINING_CREDIT_COST,
      lockTitle: lockTrainingTitle,
    },
    {
      href: "/app/history",
      icon: History,
      label: t("nav.history"),
      locked: false,
      lockTitle: "",
    },
  ];

  // Sub-itens de "Vídeos". Entrada livre — o gate de créditos acontece dentro
  // do wizard, nos estágios pagos.
  // ✅ 13/08 (ordem Johnny): Estúdio Automático GRADUOU e entrou no lugar do
  // Vídeo História, que desceu pra pré-produção como histórico. Publicar no
  // Instagram continua atrás do gate do Publicador (App Review da Meta).
  const videoChildren = [
    {
      href: "/app/videos/edicao",
      icon: Clapperboard,
      label: t("nav.videoEdicao"),
      // Sem assinatura = trancado (Johnny 13/08, mesma regra do Roteiro).
      locked: !unlimited && !subscribed,
      lockTitle: tShell("lockPlan"),
    },
    {
      href: "/app/videos/vendas",
      icon: ShoppingBag,
      label: t("nav.videoSales"),
      locked: false,
      lockTitle: "",
    },
    {
      href: "/app/videos/clone",
      icon: UserSquare2,
      label: t("nav.videoClone"),
      locked: false,
      lockTitle: "",
    },
    // ✅ HeyGen BYOK GRADUOU 14/08 (ordem Johnny): o Lucas rodou e passou, e
    // o upload de áudio que faltava subiu em 507ae4c (13/08). Aluno usa a
    // própria API key — o gate de créditos daqui não se aplica.
    {
      href: "/app/lab/video-heygen",
      icon: MonitorPlay,
      label: t("nav.videoHeygen"),
      locked: false,
      lockTitle: "",
    },
  ];

  return (
    <aside className="hidden border-r border-[var(--hairline)] bg-[var(--surface-deep)] lg:flex lg:flex-col">
      <div className="border-b border-[var(--hairline)] px-5 py-5">
        <Link href="/app/dashboard" className="flex items-center gap-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)]">
            <Image src="/brand/fastcloner-glyph.png" alt="" width={16} height={16} className="size-4" />
          </span>
          <span className="font-sans text-[15px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
            FastCloner
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          <NavLeaf
            href="/app/dashboard"
            icon={LayoutDashboard}
            label={t("nav.dashboard")}
            active={pathname.endsWith("/app/dashboard")}
          />

          {/* Gerador de Roteiros — graduado 13/08 (ordem Johnny): porta de
              entrada do funil (roteiro → áudio → vídeo), logo abaixo do
              Dashboard. Sem assinatura = trancado (Johnny 13/08: quem não
              assina — ex. contas da planilha sem plano — não acessa). */}
          <NavLeaf
            href="/app/roteiro"
            icon={PenLine}
            label={t("nav.script")}
            active={pathname.endsWith("/app/roteiro")}
            locked={!unlimited && !subscribed}
            lockTitle={tShell("lockPlan")}
          />

          {/* Grupo Vozes (expansível) */}
          <li>
            <button
              type="button"
              onClick={() => setVoicesOpen((o) => !o)}
              aria-expanded={showVoices}
              className={[
                "group flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm transition-[background-color,color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
                inVoices
                  ? "text-[var(--ink)]"
                  : "text-[var(--mute)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]",
              ].join(" ")}
            >
              <span className="flex items-center gap-3">
                <Mic2
                  className={[
                    "h-4 w-4",
                    inVoices ? "text-[var(--silver)]" : "text-[var(--ash)] group-hover:text-[var(--silver)]",
                  ].join(" ")}
                />
                <span className="font-medium">{t("nav.voices")}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[var(--ash)] transition-transform duration-[var(--dur-base)] ${
                  showVoices ? "rotate-180" : ""
                }`}
              />
            </button>

            {showVoices && (
              <ul className="ml-[19px] mt-1 flex flex-col gap-1 border-l border-[var(--hairline)] pl-2">
                {voiceChildren.map((c) => (
                  <NavLeaf
                    key={c.href}
                    href={c.href}
                    icon={c.icon}
                    label={c.label}
                    active={pathname.endsWith(c.href)}
                    locked={c.locked}
                    lockTitle={c.lockTitle}
                  />
                ))}
              </ul>
            )}
          </li>

          <NavLeaf
            href="/app/images"
            icon={Images}
            label={t("nav.images")}
            active={pathname.endsWith("/app/images")}
          />

          {/* Grupo Vídeos (expansível) */}
          <li>
            <button
              type="button"
              onClick={() => setVideosOpen((o) => !o)}
              aria-expanded={showVideos}
              className={[
                "group flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm transition-[background-color,color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
                inVideos
                  ? "text-[var(--ink)]"
                  : "text-[var(--mute)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]",
              ].join(" ")}
            >
              <span className="flex items-center gap-3">
                <Video
                  className={[
                    "h-4 w-4",
                    inVideos ? "text-[var(--silver)]" : "text-[var(--ash)] group-hover:text-[var(--silver)]",
                  ].join(" ")}
                />
                <span className="font-medium">{t("nav.videos")}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[var(--ash)] transition-transform duration-[var(--dur-base)] ${
                  showVideos ? "rotate-180" : ""
                }`}
              />
            </button>

            {showVideos && (
              <ul className="ml-[19px] mt-1 flex flex-col gap-1 border-l border-[var(--hairline)] pl-2">
                {videoChildren.map((c) => (
                  <NavLeaf
                    key={c.href}
                    href={c.href}
                    icon={c.icon}
                    label={c.label}
                    active={pathname.endsWith(c.href)}
                    locked={c.locked}
                    lockTitle={c.lockTitle}
                  />
                ))}
              </ul>
            )}
          </li>

          <NavLeaf
            href="/app/settings"
            icon={Settings}
            label={t("nav.settings")}
            active={pathname.endsWith("/app/settings")}
            locked={!unlimited && !subscribed}
            lockTitle={tShell("lockApi")}
          />

          {/* Liberação individual do Publicador (13/08): não-admin com o gate
              liberado vê o grupo Instagram/TikTok aqui, fora da pré-produção. */}
          {!isAdmin && publisherAllowed && publisherGroup}

          {isAdmin && (
            <li className="mt-2 border-t border-[var(--hairline)] pt-2">
              {/* Área de PRÉ-PRODUÇÃO: produtos novos em validação, só admin vê.
                  Validou → o item migra pro grupo público (Vídeos etc.). */}
              <span className="block px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ash)]">
                {tShell("preProduction")}
              </span>
              {/* Dois MENUS dentro da pré-produção (correção do Johnny 14/08):
                  "Teste Apenas" guarda o que só existe pra conferência;
                  "Vídeo" ensaia a árvore que vai pra produção. */}
              <GrupoPre label="Teste Apenas" icon={FlaskConical}>
                {/* ✅ Estúdio Automático GRADUOU 13/08 → grupo Vídeos público.
                    O Vídeo História desceu pra cá como histórico (ordem
                    Johnny 13/08): alunos novos usam o wizard; projetos
                    antigos seguem acessíveis por aqui. */}
                <NavLeaf
                  href="/app/videos/history"
                  icon={History}
                  label={t("nav.videoHistory")}
                  active={pathname.endsWith("/app/videos/history")}
                />
                {/* F0 unificação: a ENTRADA é o wizard de 2 perguntas
                    (/app/videos/estudio); o workspace antigo (/studio) segue
                    acessível como destino interno do wizard. */}
                <NavLeaf
                  href="/app/videos/estudio"
                  icon={Wand2}
                  label={t("nav.videoStudio")}
                  active={
                    pathname.endsWith("/app/videos/estudio") ||
                    pathname.endsWith("/app/videos/studio")
                  }
                />
              </GrupoPre>

              <GrupoPre
                label="Vídeo"
                icon={Video}
                defaultOpen={pathname.includes("/app/lab/virais")}
              >
                {/* Galeria = o acervo COMUM (todo mundo vê o que qualquer
                    busca trouxe). Meus Virais = a prateleira de cada um. */}
                <NavLeaf
                  href="/app/lab/virais"
                  icon={Flame}
                  label="Galeria de Virais"
                  active={pathname.endsWith("/app/lab/virais")}
                />
                <NavLeaf
                  href="/app/lab/meus-virais"
                  icon={Bookmark}
                  label="Meus Virais"
                  active={pathname.endsWith("/app/lab/meus-virais")}
                />
                {/* Wizard do Video React — R0/R1 de pé, R2-R6 em construção. */}
                <NavLeaf
                  href="/app/lab/react"
                  icon={Clapperboard}
                  label="React"
                  active={pathname.endsWith("/app/lab/react")}
                />
              </GrupoPre>

              <ul className="mt-1 flex flex-col gap-1">
                {/* Gravador Celular GRADUOU (03/08): virou a seção "Ou grave
                    pelo celular" do Gravador oficial — saiu do menu 05/08
                    (pedido Johnny). A página /app/lab/gravador-celular segue
                    acessível por URL se precisar depurar. */}
                {/* 🧪 Padrão 2.0 GRADUOU (08/08): virou o tier Padrão público
                    do Vídeo Clone (V1 aposentado, Turbo 80 cr/s). */}
                {/* ✅ HeyGen BYOK GRADUOU 14/08 → grupo Vídeos público. */}
                {/* 🧪 Publicador (JSX compartilhado — ver publisherGroup). */}
                {publisherGroup}
              </ul>
              <div className="mt-2 border-t border-[var(--hairline)] pt-2">
                <NavLeaf
                  href="/admin"
                  icon={ShieldCheck}
                  label={tShell("admin")}
                  active={pathname.includes("/admin")}
                  bare
                />
              </div>
            </li>
          )}
        </ul>
      </nav>

      <div className="border-t border-[var(--hairline)] px-5 py-4">
        <p className="font-mono text-[10px] tracking-[0.04em] text-[var(--ash)]">v0.1 · dev</p>
      </div>
    </aside>
  );
}

