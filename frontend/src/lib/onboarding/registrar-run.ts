/**
 * Registro do que o robô da planilha tentou — tabela `onboarding_runs`.
 * Server-only.
 *
 * 22/08 (Johnny): "não é ler a nota, é entender o porquê no SISTEMA".
 * Até aqui a rota não gravava nada: o motivo ia pro Apps Script, que escrevia
 * numa nota de célula truncada. Investigar uma linha em Erro virava garimpo —
 * abrir o Drive na mão, baixar o arquivo, medir os bytes. Foi assim que o bug
 * do HEIC ficou 15 linhas escondido.
 *
 * Best-effort SEMPRE: registro não pode derrubar import de aluno.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** O que aconteceu com um arquivo — o `tipo_real` é o que resolve o caso. */
export type ArquivoRegistro = {
  id: string;
  resultado: "importado" | "ja_existia" | "ignorado" | "falhou";
  motivo?: string | null;
  tamanho_bytes?: number | null;
  /** o que o Drive DECLAROU (mente: serve HEIC e mp4 como octet-stream) */
  tipo_declarado?: string | null;
  /** o que o arquivo É, pelos magic bytes */
  tipo_real?: string | null;
};

export type RunRegistro = {
  linha: number | null;
  email: string;
  userId: string | null;
  contaCriada: boolean;
  ok: boolean;
  etapaFalha: "imagens" | "audio" | "conta" | null;
  motivo: string | null;
  erroDetalhe: string | null;
  imagensPedidas: number;
  audiosPedidos: number;
  imagesLink: string | null;
  audiosLink: string | null;
  arquivos: ArquivoRegistro[];
  resultado: unknown;
};

export async function registrarRun(
  admin: SupabaseClient,
  r: RunRegistro,
): Promise<void> {
  try {
    await admin.from("onboarding_runs").insert({
      linha: r.linha,
      email: r.email,
      user_id: r.userId,
      conta_criada: r.contaCriada,
      ok: r.ok,
      etapa_falha: r.etapaFalha,
      motivo: r.motivo,
      erro_detalhe: r.erroDetalhe,
      imagens_pedidas: r.imagensPedidas,
      audios_pedidos: r.audiosPedidos,
      images_link: r.imagesLink || null,
      audios_link: r.audiosLink || null,
      arquivos: r.arquivos,
      resultado: r.resultado ?? {},
    });
  } catch (e) {
    // Nunca derruba o import — o aluno importa mais que o registro.
    console.error(
      "[onboarding/run] falhou ao registrar:",
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Junta os `failed`/`ignored` que os importadores devolvem no formato do
 * registro. O motivo já vem com o número quando é tamanho ("tem 8944MB
 * (teto 419MB)") e com o tipo quando é conteúdo ("não é imagem (audio/mp4)").
 */
export function arquivosDoResultado(
  res: {
    failed?: Array<{ id: string; error: string }>;
    ignored?: Array<{ id: string; reason: string }>;
    imported?: number;
    skipped?: number;
  },
  pedidos: string[],
): ArquivoRegistro[] {
  const out: ArquivoRegistro[] = [];
  const vistos = new Set<string>();

  for (const f of res.failed ?? []) {
    vistos.add(f.id);
    out.push({ id: f.id, resultado: "falhou", motivo: f.error, ...pistas(f.error) });
  }
  for (const g of res.ignored ?? []) {
    if (vistos.has(g.id)) continue;
    vistos.add(g.id);
    out.push({ id: g.id, resultado: "ignorado", motivo: g.reason, ...pistas(g.reason) });
  }
  // Os que não aparecem em failed/ignored deram certo; não dá pra saber quais
  // foram importados e quais já existiam sem mudar os importadores, então
  // ficam como "importado" (o `resultado` jsonb guarda os totais exatos).
  for (const id of pedidos) {
    if (vistos.has(id)) continue;
    out.push({ id, resultado: "importado" });
  }
  return out;
}

/** Extrai tamanho e tipo declarado de dentro da mensagem de erro. */
function pistas(msg: string): Partial<ArquivoRegistro> {
  const out: Partial<ArquivoRegistro> = {};
  const mb = msg.match(/tem (\d+) ?MB/i);
  if (mb) out.tamanho_bytes = Number(mb[1]) * 1_000_000;
  const tipo = msg.match(/n[ãa]o é (?:imagem|áudio) \(([^)]+)\)/i);
  if (tipo) out.tipo_declarado = tipo[1];
  return out;
}
