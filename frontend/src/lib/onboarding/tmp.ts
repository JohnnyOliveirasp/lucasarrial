/**
 * Onde o onboarding baixa arquivo grande — e a faxina do que ficou pra trás.
 * Server-only.
 *
 * 22/08: o `/tmp` do Hetzner é **tmpfs, ou seja RAM** (3,8GB). O import
 * baixava o vídeo do aluno pra lá com teto de 2GB — um único aluno com vídeo
 * de 1,7GB comia 1,7GB de RAM do servidor. Encontrado com o disco em **100%**
 * e 6 pastas órfãs somando ~3GB; a linha 359 morreu com
 * `ENOSPC: no space left on device`, e nesse estado QUALQUER coisa que precise
 * de /tmp falha — não só o onboarding.
 *
 * Por que sobrou lixo se o download tem `finally { rm(dir) }`: o `finally` não
 * roda quando o processo é MORTO no meio — e é o que o deploy faz (pm2
 * reinicia). Download de 20 minutos + deploy no meio = pasta órfã pra sempre.
 *
 * Duas defesas: (1) baixar no VOLUME em disco quando ele existir, não na RAM;
 * (2) faxinar os órfãos antes de cada import.
 */
import { mkdtemp, rm, readdir, stat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Nada que o onboarding cria dura mais que o teto de 6min do Apps Script. */
const IDADE_ORFAO_MS = 30 * 60 * 1000;
// ⚠️ Prefixo novo em `dirTemporario` ENTRA AQUI TAMBÉM, senão o órfão dele não
// é faxinado por ninguém. `onbaudsrc-` guarda o VÍDEO baixado inteiro (GB) e
// `onbaud-` a faixa extraída; o `finally` que apaga os dois não roda quando o
// pm2 mata o processo no deploy — que é exatamente como nasceram as 6 pastas
// órfãas de ~3GB e o `ENOSPC` de 22/08 documentado no topo deste arquivo.
// `vidmute-` não é do onboarding: é o corte da faixa de áudio do Animar Imagem
// (lib/video/strip-audio.ts, incidente #236). Entra nesta lista porque a faxina
// é esta — prefixo de fora dela vira órfão que ninguém apaga. Segura só um
// clipe de 4-6s por alguns milissegundos, então na prática só sobra órfão se o
// pm2 matar o processo exatamente no meio do corte.
const PREFIXOS = ["onbdl-", "onbvid-", "onbvidbuf-", "onbaudsrc-", "onbaud-", "vidmute-"];

let baseCache: string | null = null;

/**
 * Diretório base pros downloads — o TEMP DO SERVIDOR, em disco.
 *
 * Regra do Johnny (22/08): "o servidor tem 2 discos, salva no temp dele, não
 * no que usa os projetos". No Hetzner:
 *   /dev/sdb1  38G  →  /            sistema (15G livres)  ← é aqui
 *   /dev/sda   40G  →  /mnt/volume  PROJETOS               ← não encostar
 *   tmpfs     3.8G  →  /tmp e /var/tmp   os DOIS são RAM   ← nem pensar
 *
 * `/var/cache` mora no disco do sistema. `ONBOARDING_TMP_DIR` sobrescreve —
 * útil pra teste e pra quando o servidor mudar de layout.
 */
export async function baseTemporaria(): Promise<string> {
  if (baseCache) return baseCache;

  const candidatos = [
    process.env.ONBOARDING_TMP_DIR,
    "/var/cache/fastcloner/onboarding",
  ].filter(Boolean) as string[];

  for (const dir of candidatos) {
    try {
      await mkdir(dir, { recursive: true });
      baseCache = dir;
      return dir;
    } catch {
      /* tenta o próximo */
    }
  }
  baseCache = tmpdir();
  return baseCache;
}

/** Cria o diretório de trabalho de um download (mesmo contrato do mkdtemp). */
export async function dirTemporario(prefixo: string): Promise<string> {
  return mkdtemp(join(await baseTemporaria(), prefixo));
}

/**
 * Apaga o que ficou de execuções mortas. Só mexe no que tem prefixo nosso e
 * mais de 30 minutos — nunca no download de quem está rodando agora.
 * Best-effort: faxina não pode derrubar import.
 */
export async function faxinaOrfaos(): Promise<number> {
  let apagados = 0;
  const bases = new Set([await baseTemporaria(), tmpdir()]);
  const corte = Date.now() - IDADE_ORFAO_MS;

  for (const base of bases) {
    let nomes: string[];
    try {
      nomes = await readdir(base);
    } catch {
      continue;
    }
    for (const nome of nomes) {
      if (!PREFIXOS.some((p) => nome.startsWith(p))) continue;
      const alvo = join(base, nome);
      try {
        const info = await stat(alvo);
        if (!info.isDirectory() || info.mtimeMs > corte) continue;
        await rm(alvo, { recursive: true, force: true });
        apagados++;
      } catch {
        /* já sumiu ou sem permissão — segue */
      }
    }
  }
  if (apagados > 0) {
    console.warn(`[onboarding/tmp] faxina: ${apagados} diretório(s) órfão(s) apagado(s)`);
  }
  return apagados;
}
