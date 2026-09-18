/**
 * POST /api/v1/auth/recuperar-senha  { email, idioma? } → sempre `{ ok: true }`
 *
 * O "esqueci a senha" saindo pelo SMTP DA CASA (suporte@fastcloner.com) em vez
 * do provedor de e-mail do Supabase. A decisão inteira mora em
 * `lib/auth/recuperacao-senha.ts` (puro e testado) — AQUI É SÓ I/O: ler o corpo,
 * contar abuso, ligar os canais de verdade e logar o desfecho.
 *
 * POR QUE (medido na ronda de 18/09 19hZ, incidente 1a37605a): o formulário
 * chamava `supabase.auth.resetPasswordForEmail`, que é chamada de CLIENTE — quem
 * mandava era o provedor do Supabase. Resultado medido na aluna
 * walsicleia_kaka@hotmail.com (pagante, ZERO login desde 04/09, 7 mensagens em 2
 * dias): `recovery_sent_at` carimbado em `auth.users` e NENHUMA linha em
 * `emails_enviados` — sem Message-ID nosso, sem cópia em Enviados, sem onde o
 * bounce cair. E o `suporte@` entrega na caixa dela perfeitamente. A casa tinha
 * um canal provado e usava outro, cego, no e-mail mais crítico que existe.
 *
 * O link continua sendo do Supabase (`generateLink`, que NÃO dispara e-mail —
 * mesmo que `/api/v1/admin/users/recovery-link` usa); o que muda é quem ENTREGA.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { criarLimitePorIp, ipDaRequisicao } from "@/lib/api/rate-ip";
import { getAdmin } from "@/lib/db/admin";
import { sendSupportMail } from "@/lib/agent/mail-smtp";
import { logger } from "@/lib/logger/server";
import {
  ORIGEM_RECUPERACAO,
  avaliarPedido,
  despacharRecuperacao,
  ehUsuarioInexistente,
  respostaDoVeredicto,
} from "@/lib/auth/recuperacao-senha";

export const dynamic = "force-dynamic";

/**
 * Tetos do anti-abuso. Endpoint público que dispara e-mail sem eles vira
 * canhão de spam com o nosso domínio no remetente — e é a reputação do
 * `suporte@` que paga, a mesma que entrega as cartas que funcionam.
 *
 * Por E-MAIL: 1 por minuto é o cooldown que o Supabase dava de graça (o
 * "For security purposes, you can only request this after N seconds" que o
 * formulário tratava). Saindo do caminho dele, a casa passa a dever esse limite.
 * O teto diário impede encher a caixa de alguém a pedido de terceiro.
 *
 * Por IP: cobre quem varre uma lista de endereços trocando o e-mail a cada
 * pedido — nesse caso o limite por e-mail nunca dispara.
 *
 * Em memória, como o resto dos canais públicos (pm2 = 1 processo). Se um dia
 * virar cluster, o lugar de trocar por Redis é `lib/api/rate-ip.ts`, um só.
 */
const limitePorEmail = criarLimitePorIp({ porMinuto: 1, porDia: 8 });
const limitePorIp = criarLimitePorIp({ porMinuto: 5, porDia: 30 });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);

  const veredicto = avaliarPedido({
    email: (body as { email?: unknown })?.email,
    idioma: (body as { idioma?: unknown })?.idioma,
    // ⚠️ NÃO é `NEXT_PUBLIC_SITE_URL`. Naquela variável, nesta máquina, está
    // `http://localhost:3000` — e o projeto do Supabase ACEITA esse destino
    // (allowlist de dev): o link redirecionaria o aluno pra máquina do dev,
    // queimando a credencial de uso único no caminho. Sem a variável abaixo o
    // destino é a produção; com ela, ainda passa pela peneira que recusa
    // localhost e http.
    destinoBruto: process.env.PASSWORD_RESET_SITE_URL ?? null,
    limitadoPorIp: limitePorIp.limitado(ipDaRequisicao(request.headers)),
    limitadoPorEmail: (email) => limitePorEmail.limitado(email),
  });

  const resposta = respostaDoVeredicto(veredicto);

  if (veredicto.acao === "recusar") {
    if (veredicto.status === 500) {
      // Configuração quebrada: grita no log. Não vaza nada sobre conta nenhuma
      // (esta peneira roda antes de qualquer consulta) e ninguém recebe link.
      logger.error("api", "auth.recuperar_senha.destino_invalido", { motivo: veredicto.mensagem });
    }
    return jsonError(veredicto.codigo, veredicto.mensagem, veredicto.status);
  }

  // ⚠️ O TRABALHO SAI DE FORA DA RESPOSTA, DE PROPÓSITO. Gerar link + SMTP leva
  // segundos; endereço sem conta não leva quase nada. Esperar aqui faria o TEMPO
  // da resposta dizer o que o corpo dela não diz — o mesmo vazamento de
  // enumeração, só que pelo relógio. E a tela não tem o que fazer com o
  // resultado: ela mostra a mesma frase nos dois casos.
  void despacharRecuperacao({
    email: veredicto.email,
    idioma: veredicto.idioma,
    redirectTo: veredicto.redirectTo,
    canais: {
      async gerarLink({ email, redirectTo }) {
        const { data, error } = await getAdmin().auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
        if (error) {
          return { link: null, semConta: ehUsuarioInexistente(error.message), erro: error.message };
        }
        return { link: data.properties?.action_link ?? null, semConta: false, erro: null };
      },
      // É ESTE canal que fecha o buraco: o `sendSupportMail` registra em
      // `emails_enviados` (mail-smtp.ts:183) e grava cópia em Enviados, então a
      // carta passa a ter Message-ID nosso e lugar pro bounce cair.
      enviar: ({ to, assunto, texto }) =>
        sendSupportMail({ to, subject: assunto, text: texto, origem: ORIGEM_RECUPERACAO }),
    },
  })
    .then((desfecho) => {
      // O desfecho NUNCA vai pra resposta — ele existe pra ronda ter onde olhar
      // quando o aluno disser "não chega". Hoje não existe esse lugar.
      if (desfecho.passo === "falhou") {
        logger.error("api", "auth.recuperar_senha.falhou", {
          target: desfecho.email,
          etapa: desfecho.etapa,
          erro: desfecho.erro,
        });
        return;
      }
      logger.info("audit", `auth.recuperar_senha.${desfecho.passo}`, { target: desfecho.email });
    })
    .catch((e: unknown) => {
      // `despacharRecuperacao` não lança; isto é só a rede pra não virar
      // unhandled rejection derrubando o processo do pm2 se um dia lançar.
      logger.error("api", "auth.recuperar_senha.excecao", {
        erro: e instanceof Error ? e.message : String(e),
      });
    });

  return jsonOk(resposta.corpo, resposta.status);
}
