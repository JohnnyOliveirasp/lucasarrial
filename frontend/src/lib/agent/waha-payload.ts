/**
 * Leitura do payload da WAHA — a parte que decide QUAL mídia a mensagem
 * carrega. Mora fora do route.ts porque route.ts só pode exportar handlers
 * HTTP, e esta decisão precisa ser testável: ela é o que faz a Carol enxergar
 * (ou não) a foto que a pessoa mandou.
 */

export type WahaMessagePayload = {
  id?: string;
  from?: string;
  to?: string;
  fromMe?: boolean;
  /** "api" = enviado pelo nosso sistema · "app" = digitado no celular/web. */
  source?: string;
  participant?: string | null;
  body?: string;
  hasMedia?: boolean;
  media?: { url?: string; mimetype?: string } | null;
  mentionedIds?: string[];
  /** A mensagem CITADA (reply). O WAHA manda ela inteira, com mídia e tudo. */
  replyTo?: {
    id?: string;
    participant?: string | null;
    body?: string | null;
    hasMedia?: boolean;
    media?: { url?: string; mimetype?: string } | null;
  } | null;
  _data?: { notifyName?: string; Info?: { PushName?: string } };
};

/**
 * Reply numa FOTO ("Carol, olha isso" respondendo a uma imagem) — pedido do
 * Johnny 22/08: é o gesto natural de quem já mandou o print antes de pedir.
 *
 * O WAHA entrega a mensagem citada em `replyTo`, com `media.url` próprio.
 * Adotamos a imagem dela e mantemos o TEXTO do pedido como legenda; daí pra
 * frente é o mesmo caminho de "foto com legenda", que já funciona ponta a
 * ponta (a Carol vê a imagem, e ela entra como anexo no chamado do Frank).
 *
 * ⚠️ Só IMAGEM, e só quando a mensagem NÃO traz mídia própria:
 *  - adotar um áudio citado faria a Carol transcrever o áudio antigo e perder
 *    o que a pessoa acabou de escrever;
 *  - se a pessoa mandou foto nova, a foto nova é que vale.
 */
export function escolherMidia(p: WahaMessagePayload): {
  midia: { url?: string; mimetype?: string } | null | undefined;
  temMidia: boolean;
} {
  const citada = p.replyTo;
  const citadaEhFoto =
    p.hasMedia !== true &&
    citada?.hasMedia === true &&
    (citada.media?.mimetype ?? "").startsWith("image") &&
    Boolean(citada.media?.url);

  return {
    midia: citadaEhFoto ? citada?.media : p.media,
    temMidia: p.hasMedia === true || citadaEhFoto,
  };
}
