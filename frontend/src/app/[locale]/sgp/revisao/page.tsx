import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { formatDuration } from "@/lib/audio/duration";
import { somaFalaDistinta } from "@/lib/sgp/fala-distinta";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { SgpShell } from "@/components/sgp/sgp-shell";
import { SgpEnviarForm } from "@/components/sgp/sgp-enviar-form";

/**
 * /sgp/revisao — Tela 4: o REVIEW. Mostra tudo que ele fez, cada bloco com
 * "Alterar"; a senha, a LGPD e a declaração ficam no formulário de envio —
 * é lá que a conta é criada.
 */
export const dynamic = "force-dynamic";

export default async function SgpRevisaoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const pedido = await pedidoDaSessaoOuNull();
  if (!pedido?.email_verificado_at) redirect({ href: "/sgp", locale });
  // `enviado` entrou em 15/09: era o único status pós-envio fora desta lista E
  // fora da lista do idempotente em /api/v1/sgp/enviar, então o aluno que já
  // tinha enviado via a tela de revisão, clicava, e levava "Complete as etapas
  // anteriores antes de enviar". A porta da rota (lib/sgp/porta-envio.ts) é
  // quem garante de verdade; este redirect é a mitigação de UI, e as duas
  // listas precisam concordar — foi a discordância delas que abriu o buraco.
  if (["enviado", "processando", "pronto", "falhou"].includes(pedido!.status)) {
    redirect({ href: "/app/sgp", locale });
  }

  const t = await getTranslations({ locale, namespace: "sgp.revisao" });
  const bucket = imagesBucket();
  const fotos = await Promise.all(
    (pedido!.fotos ?? [])
      .filter((f) => f.status === "aprovada")
      .map(async (f) => ({ ...f, url: await createPresignedGet(bucket, f.key, 3600) })),
  );
  const audios = (pedido!.audios ?? []).filter((a) => a.status === "aprovado");
  // Fala DISTINTA (#501): a mesma régua dos portões — o total que o aluno
  // revisa aqui não pode contradizer o que o envio vai aceitar.
  const totalFala = somaFalaDistinta(audios);

  const bloco = "rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-4";
  const cab = "mb-3 flex items-center justify-between";
  const titulo = "text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--silver)]";
  const linha = "flex justify-between gap-4 py-1.5 text-[13px]";

  return (
    <SgpShell passo="revisao" titulo={t("titulo")} descricao={t("descricao")}>
      <div className="flex flex-col gap-4">
        <section className={bloco}>
          <div className={cab}>
            <p className={titulo}>{t("dadosPessoais")}</p>
            <Link href="/sgp" className="sgp-btn sgp-btn--ghost sgp-btn--xs">{t("alterar")}</Link>
          </div>
          <div className={linha}><span className="text-[var(--mute)]">{t("nome")}</span><span className="text-[var(--ink)]">{pedido!.nome ?? "—"}</span></div>
          <div className={linha}><span className="text-[var(--mute)]">WhatsApp</span><span className="text-[var(--ink)]">{pedido!.whatsapp ? `+${pedido!.whatsapp}` : "—"}</span></div>
          <div className={linha}><span className="text-[var(--mute)]">E-mail</span><span className="text-[var(--ink)]">{pedido!.email}</span></div>
        </section>

        <section className={bloco}>
          <div className={cab}>
            <p className={titulo}>{t("fotos", { n: fotos.length })}</p>
            <Link href="/sgp/foto" className="sgp-btn sgp-btn--ghost sgp-btn--xs">{t("alterar")}</Link>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {fotos.map((f) => (
              <figure key={f.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="aspect-[3/4] w-full rounded-[var(--radius)] object-cover" />
              </figure>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[var(--silver)]">{t("cienciaFoto", { n: pedido!.ciencia_foto?.length ?? 0 })}</p>
        </section>

        <section className={bloco}>
          <div className={cab}>
            <p className={titulo}>{t("audios", { n: audios.length, total: formatDuration(totalFala) })}</p>
            <Link href="/sgp/audio" className="sgp-btn sgp-btn--ghost sgp-btn--xs">{t("alterar")}</Link>
          </div>
          <ul className="flex flex-col">
            {audios.map((a) => (
              <li key={a.key} className={linha}>
                <span className="truncate text-[var(--ink)]">{a.nome}</span>
                <span className="shrink-0 text-[var(--mute)]">{formatDuration(a.segundos)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-[var(--silver)]">{t("cienciaAudio", { n: pedido!.ciencia_audio?.length ?? 0 })}</p>
        </section>

        <SgpEnviarForm email={pedido!.email ?? ""} contaExistente={pedido!.conta_existente} />
      </div>
    </SgpShell>
  );
}
