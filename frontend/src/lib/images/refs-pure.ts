/**
 * Parte PURA das referências salvas (`{user}/refs/`) — zero dependências,
 * para ser testável com `node --test` (mesmo padrão de regua-audio.ts).
 *
 * `refsPrefix`/`ehReferenciaSalva` moraram em refs.ts até 22/08; mudaram pra
 * cá SEM alterar comportamento (refs.ts reexporta — nenhum call site mudou).
 * O motivo da mudança é o incidente 1970fcaa: o DELETE em massa do histórico
 * (/api/v1/images) apagava as chaves de `refs/` junto com as pastas das
 * gerações — exatamente o defeito que a pasta refs/ foi criada pra curar em
 * 19/08. As guardas individuais (apagarStagingAdotado, apagarReferencia) já
 * existiam; faltava a do caminho em massa. Ela vive aqui, testada.
 */

export function refsPrefix(userId: string): string {
  return `${userId}/refs/`;
}

export function ehReferenciaSalva(userId: string, key: string): boolean {
  return key.startsWith(refsPrefix(userId));
}

/** O que uma row do histórico carrega de chaves R2 (colunas do DELETE). */
export type RowHistoricoImagem = {
  input_image_paths?: string[] | null;
  input_image_path?: string | null;
  image_path?: string | null;
  video_path?: string | null;
};

/**
 * Chaves R2 que o DELETE do histórico PODE apagar: o resultado (image_path),
 * o vídeo (video_path) e os inputs de staging (`{user}/images/{id}/…`).
 *
 * O que NUNCA sai daqui: chave dentro de `{user}/refs/`. Desde 19/08 as
 * gerações gravam como input a chave ADOTADA em refs/ — a MESMA foto é
 * compartilhada por várias gerações e pela referência fixa do estúdio.
 * Apagar a geração A não pode derrubar a referência usada pela geração B
 * (incidente 1970fcaa: 60 refs mortas, 17 alunos, 181 gerações órfãs).
 *
 * Deduplicada (a mesma chave aparece em várias rows selecionadas).
 */
export function chavesApagaveisDoHistorico(
  userId: string,
  rows: RowHistoricoImagem[],
): string[] {
  const keys = rows
    .flatMap((r) => [
      // todas as refs (array novo) + a legada singular + o resultado + vídeo
      ...(r.input_image_paths ?? []),
      r.input_image_path,
      r.image_path,
      r.video_path,
    ])
    .filter((k): k is string => !!k)
    .filter((k) => !ehReferenciaSalva(userId, k));
  return [...new Set(keys)];
}
