/**
 * O TEXTO que o aluno recebe quando clica em "cancelar assinatura" no app.
 *
 * ── POR QUE ISTO É UM MÓDULO PRÓPRIO, E PURO (#552) ───────────────────────
 * Até 24/09 a rota `subscription/cancel` mandava a carta "Sua assinatura foi
 * cancelada" no passo 1b, ANTES de falar com a Hotmart no passo 2 — e o
 * `catch` do passo 2 era vazio. Então a casa afirmava ao aluno um fato que não
 * tinha conferido, e quando a API recusava ninguém ficava sabendo: sem log,
 * sem chamado, sem coluna. Medido em 24/09: 236 alunos já usaram esse botão e
 * não existe como saber, hoje, quais pedidos viraram cancelamento de verdade.
 *
 * A regra que este arquivo carrega, e que o teste ao lado trava: **a palavra
 * "cancelada" só pode sair quando a Hotmart confirmou**. Enquanto não
 * confirmou, o aluno recebe "recebemos o seu pedido" — que é verdade — e a
 * casa promete UMA coisa: escrever de novo quando estiver feito.
 *
 * É puro de propósito (entra booleano, sai texto): assim a regra é testável
 * sem rede, sem Supabase e sem Resend.
 */

export type CartaDeCancelamento = { subject: string; html: string };

/**
 * @param confirmadoNaHotmart `true` SÓ quando a chamada de cancelamento
 *   devolveu sucesso. Em qualquer outro caso — falhou, não tentou, não havia
 *   código de assinante, credenciais ausentes — passe `false`. "Não sei" é
 *   `false`: a carta otimista é a que já mentiu.
 */
export function cartaDeCancelamento(confirmadoNaHotmart: boolean): CartaDeCancelamento {
  if (confirmadoNaHotmart) {
    return {
      subject: "Sua assinatura foi cancelada — AICloneVerse",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2>Assinatura cancelada</h2>
          <p>Confirmado: a sua assinatura foi cancelada e não vai renovar.</p>
          <p>Seu acesso continua ativo até o fim do período que você já pagou,
          e os créditos que já estão na sua conta continuam seus.</p>
          <p>Mudou de ideia? É só reativar a assinatura quando quiser.</p>
          <p style="color:#666;font-size:13px">Obrigado por usar a AICloneVerse.</p>
        </div>`,
    };
  }
  return {
    subject: "Recebemos o seu pedido de cancelamento — AICloneVerse",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2>Pedido de cancelamento recebido</h2>
          <p>Registramos o seu pedido agora. Ainda estamos concluindo o
          cancelamento junto à Hotmart, que é quem processa a cobrança — por
          isso <strong>ainda não podemos dizer que está cancelado</strong>.</p>
          <p>Assim que estiver concluído, escrevemos de novo confirmando. Se
          aparecer qualquer cobrança nova antes disso, responda este e-mail com
          a data e o valor que nós resolvemos.</p>
          <p>Seu acesso e os seus créditos continuam seus enquanto isso.</p>
          <p style="color:#666;font-size:13px">AICloneVerse.</p>
        </div>`,
  };
}
