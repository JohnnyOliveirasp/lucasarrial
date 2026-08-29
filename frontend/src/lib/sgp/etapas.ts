/**
 * SGP — as etapas do "pedido" que o aluno acompanha (estilo iFood).
 *
 * 29/08 (Johnny, depois do 1º envio real): a tela ficou congelada com o clone
 * de foto JÁ pronto, e ele não recebeu e-mail nenhum das etapas — só o
 * "plataforma pronta" no fim. Aqui vive a checagem: lê o estado real
 * (`statusOnboarding`), carimba `foto_pronta_em` / `voz_pronta_em` no pedido
 * e manda UM e-mail por etapa (o carimbo é o que garante o "uma vez só").
 *
 * Chamado pelo polling do acompanhamento e pela página /app/sgp, então quem
 * está de olho na tela vê a etapa virar na hora.
 */
import { getAdmin } from "@/lib/db/admin";
import { statusOnboarding } from "@/lib/onboarding/pronto";
import { avisoFotoPronta, avisoVozPronta } from "@/lib/onboarding/avisos";
import type { SgpPedidoRow, SgpStatus } from "./types";

export type EstadoEtapa = "feito" | "andamento" | "espera" | "falhou";
export type EtapasSgp = {
  status: SgpStatus;
  etapas: Array<{ chave: "recebido" | "foto" | "voz" | "pronto"; estado: EstadoEtapa }>;
  pronto: boolean;
  erro: string | null;
};

/**
 * Mesma checagem, mas a partir do DONO — é o que os webhooks do Kie e do
 * RunPod chamam quando a imagem/o treino termina. Sem isto, o e-mail de etapa
 * dependia de alguém estar com a tela aberta (Johnny 29/08: "se ele fechar a
 * tela os e-mails das etapas não vão ser enviados?"). Silencioso pra quem não
 * é do SGP.
 */
export async function avancarEtapasDoUsuario(userId: string): Promise<void> {
  try {
    const { data } = await getAdmin()
      .from("sgp_pedidos" as never)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const pedido = data as SgpPedidoRow | null;
    if (!pedido?.enviado_em) return;
    await estadoDasEtapas(pedido);
  } catch (e) {
    console.error("[sgp/etapas] avançar falhou:", e instanceof Error ? e.message : e);
  }
}

export async function estadoDasEtapas(pedido: SgpPedidoRow): Promise<EtapasSgp> {
  const base = (status: SgpStatus): EtapasSgp => ({
    status,
    etapas: [
      { chave: "recebido", estado: "feito" },
      { chave: "foto", estado: "espera" },
      { chave: "voz", estado: "espera" },
      { chave: "pronto", estado: "espera" },
    ],
    pronto: false,
    erro: pedido.erro,
  });
  if (!pedido.user_id) return base(pedido.status);

  const admin = getAdmin();
  const s = await statusOnboarding(admin, pedido.user_id);

  const fotoPronta = s.avatares_total > 0 && s.avatares_prontos >= 1;
  const fotoFalhou = s.avatares_total > 0 && s.avatares_prontos === 0 && s.falhou;
  const vozPronta = s.voz === "ready";
  const vozFalhou = s.voz === "failed" || s.voz === "rejected_too_short";

  // Carimbo + e-mail, uma vez por etapa. O update condicional é o cadeado.
  if (fotoPronta && !pedido.foto_pronta_em) {
    const { data } = await admin
      .from("sgp_pedidos" as never)
      .update({ foto_pronta_em: new Date().toISOString() } as never)
      .eq("id", pedido.id)
      .is("foto_pronta_em", null)
      .select("email");
    const email = (data?.[0] as { email?: string } | undefined)?.email;
    if (email) await avisoFotoPronta(email).catch(() => {});
  }
  if (vozPronta && !pedido.voz_pronta_em) {
    const { data } = await admin
      .from("sgp_pedidos" as never)
      .update({ voz_pronta_em: new Date().toISOString() } as never)
      .eq("id", pedido.id)
      .is("voz_pronta_em", null)
      .select("email");
    const email = (data?.[0] as { email?: string } | undefined)?.email;
    if (email) await avisoVozPronta(email).catch(() => {});
  }

  const status: SgpStatus = s.pronto ? "pronto" : s.falhou ? "falhou" : "processando";
  if (status !== pedido.status) {
    await admin.from("sgp_pedidos" as never).update({ status } as never).eq("id", pedido.id);
  }

  return {
    status,
    etapas: [
      { chave: "recebido", estado: "feito" },
      {
        chave: "foto",
        estado: fotoPronta ? "feito" : fotoFalhou ? "falhou" : s.avatares_total > 0 ? "andamento" : "espera",
      },
      {
        chave: "voz",
        estado: vozPronta
          ? "feito"
          : vozFalhou
            ? "falhou"
            : s.voz === "training" || s.voz === "awaiting_training" || s.voz === "validating"
              ? "andamento"
              : "espera",
      },
      { chave: "pronto", estado: s.pronto ? "feito" : s.falhou ? "falhou" : "espera" },
    ],
    pronto: s.pronto,
    erro: pedido.erro,
  };
}
