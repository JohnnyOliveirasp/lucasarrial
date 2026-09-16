/**
 * Sync de falhas cruas (admin_failures) → incidentes agrupados. Idempotente:
 * cada falha (kind, ref_id) só conta uma vez (incident_occurrences é o gate).
 * Reincidência: falha nova com assinatura de incidente CORRIGIDO → reabre.
 * Server-only. Chamado lazy pelo GET de incidentes (admin) e pelo health-report
 * do agente — quem chegar primeiro sincroniza.
 *
 * Tabelas da mig 47 ainda não estão nos types gerados → casts `as never`
 * (mesmo padrão de help_messages/mig 42).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdmin } from "@/lib/db/admin";
import { classifyCause, errorSignature, incidentTitle } from "./classify";
import type { DiagnosticoTrainer } from "./diagnostico-trainer";
import { inserirChamadoUnico } from "./gravar";
import { logger } from "@/lib/logger/server";
import { PREFIXO_FALHA_TECNICA } from "@/lib/voices/falha-de-treino";

type RawFailure = {
  kind: string;
  id: string;
  at: string;
  error: string | null;
  email: string | null;
};

type AgentNote = { at: string; by: string; note: string };

type ExistingIncident = {
  id: string;
  status: string;
  occurrences: number | null;
  affected_emails: string[] | null;
  agent_notes: AgentNote[] | null;
};

/**
 * O DIAGNÓSTICO DO TRAINER PARA AS FALHAS DE TREINO — conserto de 16/09 (#11).
 *
 * `admin_failures()` entrega o campo `error` lendo `training_jobs.error_message`,
 * e nesta família de falha esse campo é literalmente `trainer failed` — três
 * palavras iguais em toda ocorrência. Classificar só por elas produziu, medido
 * no banco vivo, exatamente um incidente: o #11 (`training:bug:trainer failed`,
 * aberto 21/07, "investigating" há 56 dias, 4 ocorrências) — e a falha de GPU
 * de 15/09 foi engolida por ele sem avisar ninguém, carimbada como BUG NOSSO.
 *
 * O diagnóstico existe, só não passava por aqui: mora nas colunas
 * `training_jobs.trainer_stderr` / `trainer_returncode` (mig 97, aplicada).
 * Uma leitura a mais, pelo `ref_id` que a própria falha já traz.
 *
 * DECISÕES, todas medidas:
 *
 *  · SÓ `kind === "training"`. É o único kind cujo `ref_id` é um
 *    `training_jobs.id` (conferido: a ocorrência de 15/09 tem ref_id
 *    `c90ff577…`, que é o id da linha, não o `runpod_job_id`). Falha de
 *    `voice` aponta para a voz e não tem o que buscar aqui.
 *
 *  · ERRO DE LEITURA NÃO ABORTA A VARREDURA — ao contrário da guarda do dedupe
 *    logo acima, que dá `throw`. A assimetria é o ponto: lá, seguir com o Set
 *    vazio RECONTA falha já contada (estraga dado). Aqui, seguir com o mapa
 *    vazio classifica exatamente como o código classificava ontem. Falhar
 *    aberto é voltar ao comportamento antigo; derrubar a sync inteira por causa
 *    de um enriquecimento seria trocar um defeito por um pior.
 *
 *  · BLOCOS DE 200, pelo mesmo motivo já documentado na guarda do dedupe: o
 *    `.in()` do PostgREST devolve no máximo 1000 linhas EM SILÊNCIO (incidente
 *    72a4c9db). Aqui o estrago seria mais quieto ainda — as falhas além do teto
 *    voltariam a ser classificadas sem stderr e ninguém notaria.
 */
async function diagnosticosDoTrainer(
  admin: SupabaseClient<never>,
  pending: RawFailure[],
): Promise<Map<string, DiagnosticoTrainer>> {
  const mapa = new Map<string, DiagnosticoTrainer>();
  const ids = pending.filter((f) => f.kind === "training" && f.id).map((f) => f.id);
  if (!ids.length) return mapa;

  const CHUNK = 200;
  try {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data, error } = await admin
        .from("training_jobs" as never)
        .select("id, trainer_stderr, trainer_returncode")
        .in("id", ids.slice(i, i + CHUNK));
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as unknown as Array<{
        id: string;
        trainer_stderr: string | null;
        trainer_returncode: number | null;
      }>) {
        mapa.set(row.id, {
          stderr: row.trainer_stderr,
          returncode: row.trainer_returncode,
        });
      }
    }
  } catch (e) {
    // Fica com o que já carregou; o resto classifica como antes.
    logger.warn("api", "incidents.sync.diagnostico_trainer_indisponivel", {
      pedidos: ids.length,
      carregados: mapa.size,
      motivo: e instanceof Error ? e.message : String(e),
    });
  }
  return mapa;
}

export async function syncIncidentsFromFailures(limit = 200): Promise<number> {
  const admin = getAdmin();
  const { data } = await admin.rpc("admin_failures", { p_limit: limit });
  const failures = (data ?? []) as unknown as RawFailure[];
  if (!failures.length) return 0;

  // Falhas já contabilizadas — a GUARDA do dedupe. ⚠️ Teto de 1000 do
  // PostgREST (incidente 72a4c9db): .in() com a lista inteira devolve no
  // máximo 1000 linhas em silêncio; com o dedupe cego a MESMA falha seria
  // recontada (occurrences inflado, incidente fechado reaberto à toa).
  // Blocos de 200 ref_ids: URL curta e, no pior caso teórico (3 kinds pro
  // mesmo ref_id), 600 linhas por bloco — sempre abaixo do teto.
  // Guarda que falha ABORTA (throw): seguir com Set vazio é recontar tudo.
  const seen: Array<{ kind: string; ref_id: string }> = [];
  const refIds = failures.map((f) => f.id).filter(Boolean);
  const CHUNK = 200;
  for (let i = 0; i < refIds.length; i += CHUNK) {
    const { data: seenRaw, error: seenErr } = await admin
      .from("incident_occurrences" as never)
      .select("kind, ref_id")
      .in("ref_id", refIds.slice(i, i + CHUNK));
    if (seenErr) throw new Error(`[incidents.sync] guarda do dedupe falhou: ${seenErr.message}`);
    seen.push(...((seenRaw ?? []) as unknown as Array<{ kind: string; ref_id: string }>));
  }
  const seenSet = new Set(seen.map((s) => `${s.kind}|${s.ref_id}`));

  let created = 0;
  // Ordem cronológica: first_seen/last_seen ficam corretos no replay
  const pending = failures
    .filter((f) => f.id && !seenSet.has(`${f.kind}|${f.id}`))
    // Ruído conhecido (guarda-chuva f830fd4e): a falha vista pela tabela
    // `voices` traz a mensagem AMIGÁVEL genérica, sem diagnóstico — e a MESMA
    // falha sempre existe CRUA em training_jobs (kind training). Agrupar pela
    // amigável fundia causas diferentes num incidente eterno. Pula a duplicata.
    //
    // ⚠️ O prefixo é IMPORTADO de quem escreve a mensagem (`falha-de-treino.ts`),
    // não repetido aqui: em 15/09 a mensagem passou a variar por desfecho
    // (estornado × não cobrado × chamado aberto ou não) e, com a string copiada,
    // qualquer variante nova deixaria de casar em silêncio — o guarda-chuva
    // f830fd4e voltaria pela porta de trás. Com o import, só a ABERTURA precisa
    // ser estável, e ela é travada por teste nos dois lados.
    .filter((f) => !(f.error ?? "").startsWith(PREFIXO_FALHA_TECNICA))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // Uma só ida ao banco para todas as falhas de treino da rodada. Ver o
  // cabeçalho de `diagnosticosDoTrainer`: sem isto, `trainer failed` é tudo
  // que a classificação enxerga.
  const diagnosticos = await diagnosticosDoTrainer(admin, pending);

  for (const f of pending) {
    const error = f.error ?? "";
    const diag = diagnosticos.get(f.id);
    const signature = errorSignature(f.kind, error, diag);
    // Erro do USUÁRIO (dataset ruim/arquivo sem áudio): o sistema já estorna
    // e explica na tela — regra do Johnny (17/08): fecha SOZINHO como
    // "ignored", em código, sem depender do Sentinela. A reincidência também
    // NÃO reabre: cada aluno novo errando o upload não é notícia. O caso que
    // importa (aluno travado repetindo falha SEM nenhuma voz pronta) tem
    // incidente PRÓPRIO via escalateStuckUser — a lição do chunking (08/08)
    // continua coberta por lá.
    const userError = classifyCause(error, diag) === "user_dataset";
    const { data: existingRaw } = await admin
      .from("incidents" as never)
      .select("id, status, occurrences, affected_emails, agent_notes")
      .eq("signature", signature)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const existing = existingRaw as unknown as ExistingIncident | null;

    let incidentId: string;
    if (existing) {
      const closed = existing.status === "fixed" || existing.status === "ignored";
      const reopened = closed && !userError;
      const emails = new Set<string>(existing.affected_emails ?? []);
      if (f.email) emails.add(f.email);
      const notes: AgentNote[] = Array.isArray(existing.agent_notes)
        ? existing.agent_notes
        : [];
      if (reopened) {
        notes.push({
          at: new Date().toISOString(),
          by: "system",
          note: `REINCIDÊNCIA: falha voltou após status "${existing.status}" — incidente reaberto.`,
        });
      }
      await admin
        .from("incidents" as never)
        .update({
          status: reopened ? "open" : existing.status,
          occurrences: (existing.occurrences ?? 1) + 1,
          affected_emails: [...emails],
          last_seen_at: f.at,
          sample_error: error.slice(0, 1000) || null,
          agent_notes: notes,
        } as never)
        .eq("id", existing.id);
      incidentId = existing.id;
    } else {
      const gravado = await inserirChamadoUnico(admin, {
          kind: f.kind === "voice" ? "training" : f.kind,
          // Sync de falhas do sistema: sempre fila TÉCNICA (mig 93).
          categoria: "tecnico",
          cause: classifyCause(error, diag),
          // user_dataset já nasce fechado: estornado + explicado ao aluno.
          status: userError ? "ignored" : "open",
          signature,
          title: incidentTitle(f.kind, error, diag),
          occurrences: 1,
          affected_emails: f.email ? [f.email] : [],
          sample_error: error.slice(0, 1000) || null,
          ...(userError
            ? {
                resolution_note:
                  "Fechado automaticamente (regra 17/08): erro do usuário no material enviado — " +
                  "créditos estornados e mensagem explicativa mostrada na tela. " +
                  "Aluno travado (repetição sem nenhuma voz pronta) abre incidente próprio.",
                resolved_at: f.at,
                // ⚠️ resolved_by junto (20/08): sem ele o incidente fica com data
                // de fechamento e ninguem responsavel, e toda auditoria de "quem
                // fechou isso?" da em branco. Eram 6 assim quando isto foi escrito.
                resolved_by: "sistema (regra 17/08: erro do usuario)",
              }
            : {}),
          first_seen_at: f.at,
          last_seen_at: f.at,
      });
      if (!gravado) {
        logger.error("api", "incidents.sync.insert_failed", { signature });
        continue;
      }
      incidentId = gravado.id;
      // Chamado que já existia (corrida) não conta como criado — senão o
      // relatório da ronda diz "abri 6" quando abriu 1.
      if (!gravado.jaExistia) created++;
    }

    await admin.from("incident_occurrences" as never).insert({
      kind: f.kind,
      ref_id: f.id,
      incident_id: incidentId,
      at: f.at,
      email: f.email,
      error: error.slice(0, 500) || null,
    } as never);
  }

  if (pending.length) {
    logger.info("api", "incidents.sync", { processed: pending.length, created });
  }
  return pending.length;
}
