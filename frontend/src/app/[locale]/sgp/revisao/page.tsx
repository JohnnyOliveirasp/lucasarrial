import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { formatDuration } from "@/lib/audio/duration";
import { lerPedido } from "@/lib/sgp/pedido";
import { SgpShell } from "@/components/sgp/sgp-shell";
import { SgpEnviarForm } from "@/components/sgp/sgp-enviar-form";

/**
 * /sgp/revisao — Tela 4: o REVIEW (decisão 29/08). Mostra tudo que ele fez,
 * cada bloco com "Alterar" que volta na tela do passo; LGPD + declaração;
 * Confirmar e Enviar. Sem "verificação de links": tudo já foi conferido ao subir.
 */
export const dynamic = "force-dynamic";

export default async function SgpRevisaoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/sgp", locale });
  const pedido = await lerPedido(user!.id);
  if (!pedido) redirect({ href: "/sgp", locale });
  if (["enviado", "processando", "pronto", "falhou"].includes(pedido!.status)) redirect({ href: "/app/sgp", locale });

  const t = await getTranslations({ locale, namespace: "sgp.revisao" });
  const tf = await getTranslations({ locale, namespace: "sgp.foto" });
  const { data: prof } = await getAdmin().from("profiles").select("display_name, whatsapp, email").eq("id", user!.id).maybeSingle();
  const p = prof as { display_name: string | null; whatsapp: string | null; email: string } | null;

  const bucket = imagesBucket();
  const fotos = await Promise.all(
    (pedido!.fotos ?? []).filter((f) => f.status === "aprovada").map(async (f) => ({ ...f, url: await createPresignedGet(bucket, f.key, 3600) })),
  );
  const audios = (pedido!.audios ?? []).filter((a) => a.status === "aprovado");
  const totalFala = audios.reduce((s, a) => s + a.segundos, 0);

  const bloco = "rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-4";
  const cab = "mb-3 flex items-center justify-between";
  const titulo = "text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--silver)]";
  const alterar = "text-[12px] text-[var(--silver)] underline decoration-[var(--hairline-bright)] underline-offset-[3px] hover:text-[var(--ink)]";
  const linha = "flex justify-between gap-4 py-1.5 text-[13px]";

  return (
    <SgpShell passo="revisao" titulo={t("titulo")} descricao={t("descricao")}>
      <div className="flex flex-col gap-4">
        <section className={bloco}>
          <div className={cab}><p className={titulo}>{t("dadosPessoais")}</p><Link href="/sgp" className={alterar}>{t("alterar")}</Link></div>
          <div className={linha}><span className="text-[var(--mute)]">{t("nome")}</span><span className="text-[var(--ink)]">{p?.display_name ?? "—"}</span></div>
          <div className={linha}><span className="text-[var(--mute)]">WhatsApp</span><span className="text-[var(--ink)]">{p?.whatsapp ? `+${p.whatsapp}` : "—"}</span></div>
          <div className={linha}><span className="text-[var(--mute)]">E-mail</span><span className="text-[var(--ink)]">{p?.email ?? user!.email}</span></div>
        </section>

        <section className={bloco}>
          <div className={cab}><p className={titulo}>{t("fotos", { n: fotos.length })}</p><Link href="/sgp/foto" className={alterar}>{t("alterar")}</Link></div>
          <div className="grid grid-cols-5 gap-2">
            {fotos.map((f) => (
              <figure key={f.slot} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="aspect-[3/4] w-full rounded-[var(--radius)] object-cover" />
                <figcaption className="truncate text-[10px] text-[var(--silver)]">{tf(`slots.${f.slot}`)}</figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[var(--silver)]">{t("cienciaFoto", { n: pedido!.ciencia_foto?.length ?? 0 })}</p>
        </section>

        <section className={bloco}>
          <div className={cab}><p className={titulo}>{t("audios", { n: audios.length, total: formatDuration(totalFala) })}</p><Link href="/sgp/audio" className={alterar}>{t("alterar")}</Link></div>
          <ul className="flex flex-col">
            {audios.map((a) => (
              <li key={a.key} className={linha}><span className="truncate text-[var(--ink)]">{a.nome}</span><span className="shrink-0 text-[var(--mute)]">{formatDuration(a.segundos)}</span></li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-[var(--silver)]">{t("cienciaAudio", { n: pedido!.ciencia_audio?.length ?? 0 })}</p>
        </section>

        <SgpEnviarForm />
      </div>
    </SgpShell>
  );
}
