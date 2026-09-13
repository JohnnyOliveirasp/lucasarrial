/**
 * Grava o ENVIO e, quando ele volta, carimba que NÃO CHEGOU. Server-only.
 *
 * A decisão (formato da chave, o que entra na linha) é pura e vive em
 * `mail-envio.ts`. Este arquivo só executa contra o banco — mesma divisão de
 * `mail-bounce.ts` / `mail-bounce-registro.ts`, pelo mesmo motivo: a parte que
 * erra em silêncio precisa ser testável sem Supabase.
 *
 * O QUE ISTO FECHA (#201 e os quatro casos de 12–13/09: Sheila #374, Rodrigo
 * #378, Lucas #379, Priscyla). O bounce já virava ficha, mas a ficha nascia
 * solta: não havia como ligar "o e-mail que voltou" ao "e-mail que a casa
 * acha que mandou", porque o envio não deixava rastro consultável. Com a
 * tabela, a pergunta que ninguém conseguia responder vira uma linha de SQL:
 *
 *   select to_email, assunto, origem, enviado_em, bounce_classe
 *     from emails_enviados where bounce_em is not null order by bounce_em desc;
 *
 * ⚠️ BEST-EFFORT SEMPRE, NOS DOIS SENTIDOS, e isso não é preguiça — é a regra
 * que impede este arquivo de virar o próximo incidente. Registro NUNCA derruba
 * envio: o aluno ser avisado importa mais que o registro do aviso (mesma regra
 * do `registrar-aviso.ts` e do `registrar-run.ts`). E o carimbo do bounce nunca
 * derruba a varredura: `tratarSeForBounce` roda ANTES de tudo em `respondOne`,
 * e uma exceção ali deixaria a mensagem sem ser marcada como lida, pra sempre,
 * travando a fila inteira — foi assim que o e-mail de 33MB deixou a Fast dois
 * dias muda em 08/08. Detector que trava a fila é pior que detector que não
 * existe: em vez de um aluno em silêncio, todos.
 *
 * ⚠️ A MIGRATION `scripts/108_emails_enviados.sql` NÃO FOI APLICADA — quem
 * aplica é o Johnny (mesma regra das migrations 85, 104 e 107). Enquanto a
 * tabela não existir, todo insert/update aqui falha, vira UMA linha de log e a
 * vida segue: nenhum e-mail deixa de sair e nenhuma varredura quebra. Mas o
 * laço só fecha DE VERDADE depois de aplicada — sem ela a consulta acima não
 * tem o que ler. Isso está dito no PR de propósito, porque as migrations 85 e
 * 104 seguem pendentes e o código delas está em produção logando erro em
 * silêncio desde então.
 */
import { getAdmin } from "@/lib/db/admin";
import { linhaDoEnvio, marcacaoDeNaoEntregue, normalizarMessageId, type EnvioRegistro } from "./mail-envio";

/**
 * Registra que a casa mandou uma mensagem. NUNCA lança.
 *
 * Chamado de dentro do `sendSupportMail`, DEPOIS do envio dar certo — assim os
 * dez pontos do código que mandam e-mail passam a registrar sem que nenhum
 * deles precise lembrar de chamar nada. Espalhar a chamada pelos chamadores é
 * exatamente como o caminho do WhatsApp ficou sem abrir chamado: quem escreveu
 * um lado não replicou no outro.
 */
export async function registrarEnvio(r: EnvioRegistro): Promise<void> {
  try {
    const linha = linhaDoEnvio(r);
    if (!linha) {
      console.error(`[agent/envio] não registrou (chave inválida) → ${r.toEmail}`);
      return;
    }
    const admin = getAdmin();
    // `as never`: tabela nova, ainda fora dos types gerados do Supabase.
    // Mesmo padrão já usado com `sgp_pedidos` e `avisos_enviados`.
    const { error } = await admin.from("emails_enviados" as never).insert(linha as never);
    if (error) {
      // Tabela ausente (migration não aplicada) cai aqui: log e segue.
      console.error(`[agent/envio] não registrou ${linha.message_id} → ${r.toEmail}:`, error.message);
    }
  } catch (e) {
    console.error(`[agent/envio] não registrou → ${r.toEmail}:`, e instanceof Error ? e.message : e);
  }
}

export type ResultadoMarcacao =
  /** Achou o envio e carimbou (ou já estava carimbado). */
  | { achou: true; toEmail: string; jaEstava: boolean }
  /** Não existe envio registrado com esse Message-ID. */
  | { achou: false; motivo: "sem-message-id" | "envio-nao-registrado" | "erro" };

/**
 * Carimba "esta mensagem NÃO chegou" na linha do envio, casando por Message-ID.
 * NUNCA lança.
 *
 * ⚠️ CASA SÓ POR Message-ID, NUNCA POR ASSUNTO OU NOME. O assunto se repete
 * (oito alunos receberam "Começamos a preparar a sua plataforma" nos últimos
 * 30 dias) e casar por ele carimbaria de não-entregue a mensagem de quem
 * recebeu perfeitamente. Chave frágil aqui não degrada o resultado, ela o
 * inverte: transformaria aluno atendido em vítima e sujaria a única consulta
 * que este trabalho existe pra fazer confiável.
 *
 * ⚠️ NÃO INVENTA LINHA quando o envio não está registrado. Bounce de mensagem
 * anterior à tabela (ou de um caminho que não passa pelo `sendSupportMail`)
 * devolve `envio-nao-registrado` e vira log — o sinal desse aluno já existe na
 * ficha `fast-bounce:` que o `mail-bounce-registro.ts` abre. Fabricar aqui uma
 * linha de envio que a casa não tem prova de ter feito seria inventar dado.
 */
export async function marcarNaoEntregue(args: {
  messageId: string | null;
  classe: string;
  diagnostico?: string | null;
}): Promise<ResultadoMarcacao> {
  const messageId = normalizarMessageId(args.messageId);
  if (!messageId) return { achou: false, motivo: "sem-message-id" };

  try {
    const admin = getAdmin();
    const { data, error: erroLeitura } = await admin
      .from("emails_enviados" as never)
      .select("id, to_email, bounce_em")
      .eq("message_id", messageId)
      .maybeSingle();

    if (erroLeitura) {
      console.error(`[agent/envio] falhou ao procurar ${messageId}:`, erroLeitura.message);
      return { achou: false, motivo: "erro" };
    }
    const linha = data as unknown as { id: string; to_email: string; bounce_em: string | null } | null;
    if (!linha) return { achou: false, motivo: "envio-nao-registrado" };

    // Já carimbado: não reescreve. O `bounce_em` guarda DESDE QUANDO a casa
    // sabe que não chegou, e sobrescrever a cada varredura apagaria a idade do
    // problema — que é justamente o número que mostra há quanto tempo o aluno
    // está em silêncio. Reprocessar o mesmo bounce vira no-op (idempotente).
    if (linha.bounce_em) return { achou: true, toEmail: linha.to_email, jaEstava: true };

    const { error } = await admin
      .from("emails_enviados" as never)
      .update(marcacaoDeNaoEntregue({ classe: args.classe, diagnostico: args.diagnostico }) as never)
      .eq("id", linha.id);
    if (error) {
      console.error(`[agent/envio] falhou ao carimbar ${messageId}:`, error.message);
      return { achou: false, motivo: "erro" };
    }
    return { achou: true, toEmail: linha.to_email, jaEstava: false };
  } catch (e) {
    console.error(`[agent/envio] falhou ao carimbar ${messageId}:`, e instanceof Error ? e.message : e);
    return { achou: false, motivo: "erro" };
  }
}
