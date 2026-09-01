/**
 * Rate-limit em memória por IP — para os canais PÚBLICOS (sem login).
 *
 * Nasceu dentro do `landing-help` e ia virar a segunda cópia no `sgp/ajuda`.
 * Identificador e regra copiados é como o aviso do grupo ficou mudo: alguém
 * corrige um lado e esquece o outro (ver lib/support/grupo.ts).
 *
 * pm2 roda 1 processo por enquanto, então o mapa em memória basta; se um dia
 * virar cluster, este é o ÚNICO lugar a trocar por Redis.
 */

export type LimitePorIp = {
  /** true = passou do teto (por minuto OU por dia) e a resposta deve ser 429. */
  limitado: (ip: string) => boolean;
};

type Marca = { dia: string; total: number; minuto: number; noMinuto: number };

/** Cria um contador isolado (cada canal tem o seu — tetos diferentes). */
export function criarLimitePorIp(opts: { porMinuto: number; porDia: number; teto?: number }): LimitePorIp {
  const marcas = new Map<string, Marca>();
  const teto = opts.teto ?? 5000;

  return {
    limitado(ip: string): boolean {
      const agora = Date.now();
      const dia = new Date(agora).toISOString().slice(0, 10);
      const minuto = Math.floor(agora / 60_000);
      const m = marcas.get(ip);
      if (!m || m.dia !== dia) {
        marcas.set(ip, { dia, total: 1, minuto, noMinuto: 1 });
        if (marcas.size > teto) marcas.clear(); // teto de memória
        return false;
      }
      if (m.minuto !== minuto) {
        m.minuto = minuto;
        m.noMinuto = 0;
      }
      m.total += 1;
      m.noMinuto += 1;
      return m.total > opts.porDia || m.noMinuto > opts.porMinuto;
    },
  };
}

/** IP do visitante atrás do nginx/Cloudflare. */
export function ipDaRequisicao(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
