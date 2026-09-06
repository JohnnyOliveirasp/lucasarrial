/**
 * Varredura das vozes paradas em `awaiting_training` (parte suja: Supabase +
 * SMTP). A régua, o texto e a trava moram em `lembrete-treino.ts`, que é puro
 * e testado — aqui só se pluga o mundo.
 *
 * Roda dentro do sweep de 5 min (`/api/v1/agent/sweep-clones`), junto com o
 * resgate de upload preso. É o par que faltava: o resgate conserta a voz que o
 * SERVIDOR perdeu; este avisa a pessoa quando a bola está com ELA.
 *
 * SEM MIGRATION: a trava vive em `agent_state` (chave `lembretes_treino`),
 * exatamente como o Vigia (`orphan_alerts`) e o `orphan-outreach`. A tabela
 * `avisos_enviados` NÃO serve aqui — a migration 104 dela não foi aplicada
 * (ver o cabeçalho de `lib/onboarding/registrar-aviso.ts`), então gravar lá
 * seria uma trava que falha em silêncio, e trava que falha calada é pior que
 * trava nenhuma: mandaria a mesma carta a cada 5 minutos.
 */
import { getAdmin } from "@/lib/db/admin";
import { sendSupportMail } from "@/lib/agent/mail-smtp";
import { bypassesBilling } from "@/lib/credits/access";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";
import {
  SEM_LEMBRETE_ANTES_DE,
  lembrarVoz,
  type EstadoLembretes,
  type VozParada,
} from "@/lib/voices/lembrete-treino";

/** Chave da trava em `agent_state`. */
const CHAVE_ESTADO = "lembretes_treino";

/**
 * Teto de e-mails por rodada. O cron roda a cada 5 min: sem teto, um backlog
 * novo viraria uma rajada de SMTP num minuto só. Com 6 por rodada o pior caso
 * escoa em minutos e continua parecendo gente escrevendo, não um robô.
 */
const MAX_POR_RODADA = 6;

export type LembreteSummary = {
  /** Vozes paradas que a varredura olhou. */
  checked: number;
  /** E-mails que saíram nesta rodada. */
  enviados: number;
  /** Saíram avisando que falta CRÉDITO (não "clique no botão"). */
  sem_saldo: number;
  /** Já lembradas antes / novas demais / anteriores ao corte. */
  pulados: number;
  errors: number;
};

function estadoIO() {
  return {
    ler: async (): Promise<EstadoLembretes> => {
      const { data } = await getAdmin()
        .from("agent_state" as never)
        .select("value")
        .eq("key", CHAVE_ESTADO)
        .maybeSingle();
      return (((data as { value?: EstadoLembretes } | null)?.value ?? {}) as EstadoLembretes) || {};
    },
    gravar: async (estado: EstadoLembretes): Promise<void> => {
      await getAdmin()
        .from("agent_state" as never)
        .upsert({
          key: CHAVE_ESTADO,
          value: estado,
          updated_at: new Date().toISOString(),
        } as never);
    },
  };
}

/** Primeiro nome — o e-mail abre com "Oi, Ana", não com o nome completo. */
function primeiroNome(nome: string | null | undefined): string | null {
  const limpo = (nome ?? "").trim();
  if (!limpo) return null;
  return limpo.split(/\s+/)[0] ?? null;
}

/**
 * Avisa quem está parado esperando o próprio clique.
 *
 * Best-effort de ponta a ponta: um e-mail que falha NÃO derruba os outros e
 * NÃO derruba o sweep. Mas a falha é contada e logada — foi exatamente o
 * `catch {}` vazio que deixou o aviso de compra órfã morrer calado por um mês
 * (#239).
 */
export async function lembrarVozesParadas(): Promise<LembreteSummary> {
  const resumo: LembreteSummary = {
    checked: 0, enviados: 0, sem_saldo: 0, pulados: 0, errors: 0,
  };
  const admin = getAdmin();

  // O corte de backfill entra na PRÓPRIA query: as vozes que o Johnny já
  // tratou à mão em 06/09 nem chegam a ser consideradas. (A régua pura checa
  // de novo — cinto e suspensório, porque o corte é a diferença entre lembrar
  // alguém e mandar a segunda carta igual no mesmo dia.)
  const { data: paradas, error } = await admin
    .from("voices")
    .select("id, user_id, created_at")
    .eq("status", "awaiting_training")
    .gte("created_at", SEM_LEMBRETE_ANTES_DE)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    resumo.errors += 1;
    console.error("[lembrete-treino] não consegui ler as vozes paradas:", error.message);
    return resumo;
  }

  const linhas = (paradas ?? []) as { id: string; user_id: string; created_at: string }[];
  resumo.checked = linhas.length;
  if (linhas.length === 0) return resumo;

  // Perfis num tiro só (e-mail + saldo) — uma query por voz seria N+1 dentro
  // de um cron de 5 min.
  const donos = Array.from(new Set(linhas.map((l) => l.user_id)));
  const { data: perfis } = await admin
    .from("profiles")
    .select("id, email, display_name, credits_subscription, credits_extra")
    .in("id", donos);

  type Perfil = {
    id: string;
    email: string | null;
    /** `display_name` é a coluna real de `profiles` (NÃO existe `full_name`:
     *  esse mora em `auth.users.user_metadata` e pedir ele aqui derruba a
     *  query inteira no PostgREST, deixando TODO mundo sem lembrete). */
    display_name: string | null;
    credits_subscription: number | null;
    credits_extra: number | null;
  };
  const porId = new Map<string, Perfil>();
  for (const p of (perfis ?? []) as Perfil[]) porId.set(p.id, p);

  const io = estadoIO();
  const estado = await io.ler();
  const agora = new Date();
  let mudou = false;

  for (const linha of linhas) {
    if (resumo.enviados >= MAX_POR_RODADA) break;

    const perfil = porId.get(linha.user_id);
    const email = perfil?.email ?? null;
    if (!email) {
      resumo.pulados += 1;
      continue;
    }

    const voz: VozParada = {
      voiceId: linha.id,
      userId: linha.user_id,
      email,
      nome: primeiroNome(perfil?.display_name),
      criadaEm: linha.created_at,
      saldo: (perfil?.credits_subscription ?? 0) + (perfil?.credits_extra ?? 0),
      equipe: bypassesBilling(email),
    };

    try {
      const r = await lembrarVoz(voz, estado, TRAINING_CREDIT_COST, agora, async (v, texto) => {
        await sendSupportMail({ to: v.email, subject: texto.assunto, text: texto.texto });
      });

      if (r.enviou) {
        mudou = true;
        resumo.enviados += 1;
        if (!r.comSaldo) resumo.sem_saldo += 1;
        console.log(
          `[lembrete-treino] voz ${voz.voiceId} → ${voz.email} ` +
            `(etapa ${r.etapa}d, ${r.comSaldo ? "com saldo" : "SEM saldo"})`,
        );
      } else {
        resumo.pulados += 1;
      }
    } catch (e) {
      // O e-mail não saiu: NÃO grava a etapa, então a próxima rodada tenta de
      // novo. Perder uma tentativa é recuperável; marcar como enviada uma
      // carta que nunca saiu deixa a pessoa presa em silêncio pra sempre.
      resumo.errors += 1;
      console.error(
        `[lembrete-treino] falhou pra voz ${voz.voiceId}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  // Grava UMA vez no fim: o estado é um documento só, e um upsert por e-mail
  // seria escrita à toa num cron de 5 minutos.
  if (mudou) {
    try {
      await io.gravar(estado);
    } catch (e) {
      // A trava não persistiu. Isso é grave (a próxima rodada repetiria as
      // cartas), então NUNCA sai calado.
      resumo.errors += 1;
      console.error(
        "[lembrete-treino] TRAVA NÃO PERSISTIU — risco de carta repetida:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  return resumo;
}
