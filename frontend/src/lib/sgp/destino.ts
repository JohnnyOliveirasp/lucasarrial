/**
 * SGP — "onde este pedido deve estar agora". Módulo PURO (roda no browser).
 *
 * POR QUE EXISTE: o mapa desta régua morava solto em `app/[locale]/sgp/page.tsx`
 * (`PROXIMA`) e tinha DOIS buracos que criaram beco sem saída de verdade:
 *
 *  1. **`dados` não tinha entrada.** Quem ficava com esse status e o e-mail já
 *     confirmado não era redirecionado pra lugar nenhum — voltava pra tela 1,
 *     preenchia tudo de novo, e caía na tela 1 outra vez. Laço fechado.
 *  2. **`processando`/`pronto`/`falhou` apontavam pra `/app/sgp`**, que está
 *     atrás do login (middleware). Mas o acompanhamento do SGP é a tela 5 do
 *     wizard e roda **sem login**, pelo cookie da sessão — é o que o próprio
 *     `POST /sgp/enviar` devolve (`proximo: "/sgp/acompanhar"`). Os dois lugares
 *     discordavam; aqui vale o que o fluxo faz, não o que o mapa dizia.
 *
 * Agora é UMA função, usada pela página, pelo `POST /sgp/codigo` e pela
 * retomada — ninguém mais escreve esse mapa na mão.
 */
// Extensão explícita: este módulo é testado por `node --test` (type-stripping
// nativo), que não resolve import sem `.ts`. Mesmo motivo do painel.ts.
import type { SgpStatus } from "./types.ts";

/**
 * A tela do wizard correspondente ao status, para quem **já confirmou o
 * e-mail**. `dados` cai em `/sgp/foto` de propósito: e-mail confirmado
 * significa que a tela 1 terminou, mesmo que o carimbo de status não tenha
 * acompanhado.
 */
const DESTINO: Record<SgpStatus, string> = {
  dados: "/sgp/foto",
  foto: "/sgp/foto",
  audio: "/sgp/audio",
  revisao: "/sgp/revisao",
  enviado: "/sgp/acompanhar",
  processando: "/sgp/acompanhar",
  pronto: "/sgp/acompanhar",
  falhou: "/sgp/acompanhar",
};

export function destinoDoWizard(status: SgpStatus): string {
  return DESTINO[status] ?? "/sgp/foto";
}

/** O pedido ainda está com o ALUNO preenchendo (dá pra retomar de onde parou). */
export function noWizardAberto(status: SgpStatus): boolean {
  return status === "dados" || status === "foto" || status === "audio" || status === "revisao";
}
