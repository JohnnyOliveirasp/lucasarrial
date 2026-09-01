#!/usr/bin/env node
/**
 * curar_msg_envio_incompleto.cjs — reescreve, na conta do aluno, a recusa por
 * envio incompleto que ficou gravada com a PROMESSA FALSA.
 *
 * POR QUE EXISTE (incidente `2c5bab42`/#72, medido em 25/08):
 *
 * `mensagemEnvioIncompleto()` terminava SEMPRE com *"Não é que você gravou
 * pouco — a MESMA gravação serve. Envie de novo"*. Isso é verdade quando o
 * total dos arquivos do aluno passa a porta de 20min, e MENTIRA quando não
 * passa: o aluno reenvia exatamente a mesma coisa e é recusado de novo,
 * achando que a culpa é dele. O caso do jrfengenhariadf: 4 de 7 arquivos =
 * 617s; projetando os 7, ~1080s ≈ 17min, abaixo da porta.
 *
 * A CAUSA foi corrigida na main em `9e97569` (PR #52) — mas o fix só vale pra
 * recusa NOVA: a mensagem já gravada não é reescrita por ninguém, porque a voz
 * está em `rejected_too_short` e o sweep de resgate só olha `uploading`. Sem
 * esta remediação, quem já foi recusado continua lendo a mentira na tela e
 * fazendo o que ela manda. Mesmo desenho do `curar_mp3_xing.cjs`: o código
 * novo cura o caso novo, o script cura o que já foi entregue.
 *
 * O QUE ELE NÃO FAZ, de propósito:
 *  - NÃO toca em voz cuja projeção FECHA a porta: ali "a mesma gravação serve"
 *    é verdade, e reescrever seria trocar uma frase certa por outra. Das 18
 *    vozes com esta mensagem em 25/08, só 6 carregavam a mentira.
 *  - NÃO muda `status`, `raw_audio_paths`, `duration_seconds` nem crédito.
 *    Só `error_message`.
 *  - NÃO dispara treino, não gasta GPU, não escreve pro aluno.
 *  - NÃO inventa texto: a frase nova sai da MESMA função de produção
 *    (`mensagemEnvioIncompleto`), então o que o aluno lê aqui é igual ao que
 *    ele leria se a recusa acontecesse hoje.
 *
 * Idempotente: rodar de novo não acha mais nada (a frase nova não casa com o
 * critério da mentira).
 *
 * Uso:
 *   node _frank/ferramentas/curar_msg_envio_incompleto.cjs               # ENSAIO
 *   node _frank/ferramentas/curar_msg_envio_incompleto.cjs --confirmar   # grava
 *   node _frank/ferramentas/curar_msg_envio_incompleto.cjs --voz <id8|id> [--confirmar]
 */
const { supa, fechamento } = require("./_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : null;
};
const SO_ESTA = arg("--voz");

(async () => {
  const R = await import("../../frontend/src/lib/voices/regua-audio.ts");
  const db = supa();

  console.log(
    `# curar_msg_envio_incompleto — ${CONFIRMAR ? "APLICANDO" : "ENSAIO (nada será gravado)"}`,
  );

  // A mensagem tem prefixo fixo desde que nasceu; é por ele que se acha.
  const { data, error } = await db
    .from("voices")
    .select("id,user_id,status,duration_seconds,raw_audio_paths,error_message")
    .like("error_message", "Recebemos apenas%");
  if (error) {
    console.error("ERRO ao ler voices:", JSON.stringify(error));
    process.exit(1);
  }
  console.log(`# vozes com a mensagem de envio incompleto: ${data.length}\n`);

  const alvos = [];
  for (const v of data) {
    if (SO_ESTA && !v.id.startsWith(SO_ESTA)) continue;
    const chaves = Array.isArray(v.raw_audio_paths) ? v.raw_audio_paths : [];
    const envio = R.contarSlotsDoEnvio(chaves, chaves);
    const total = v.duration_seconds ?? 0;
    const projetado = R.projetarTotalConservador(total, envio.chegaram, envio.esperados);

    /**
     * O CRITÉRIO É A DIVERGÊNCIA DA PRODUÇÃO DE HOJE — não "tem a frase da
     * mentira". Duas versões deste script erraram por olhar só a frase:
     *
     *  1ª: critério pela projeção CRUA enquanto a produção já usava a
     *      CONSERVADORA (PR #53). Pulava o leandro.fitoway, que crua fecha a
     *      porta (1342s) e conservadora não (1150s) — justamente quem a regra
     *      nova passou a considerar mentira.
     *  2ª: critério `/MESMA grava/` (a frase do ramo otimista). Cura a MENTIRA
     *      mas não o NÚMERO VELHO: quem já tinha sido curado antes do #53
     *      carrega "Acrescente ~Nmin" calculado pela projeção crua, que é
     *      OTIMISTA — pede menos gravação do que a regra de hoje exige.
     *      Medido em 25/08 nas 18 vozes com a mensagem: 3 divergentes, todas
     *      pedindo 1min a MENOS do que deveriam. A pior é a do
     *      jrfengenhariadf (voz 1858c53b): a tela dele mandava "acrescente
     *      ~3min" quando a conta conservadora (964s) pede 4 — obedecer a tela
     *      o levaria à TERCEIRA recusa, que é exatamente a classe que este
     *      incidente existe pra matar.
     *
     * Regenerar é seguro por construção: esta mensagem é 100% gerada pela
     * `mensagemEnvioIncompleto`, nunca escrita à mão, e as entradas
     * (`duration_seconds`, `raw_audio_paths`) são as MESMAS que a produção
     * usou. A única diferença possível é a versão do código — e a versão nova
     * é a regra que vale. Se nada mudou, `nova === error_message` e o script
     * não toca.
     *
     * Este critério ENGLOBA o da mentira: quando a frase otimista está certa
     * (a projeção conservadora fecha a porta), a produção regenera o MESMO
     * texto e o alvo cai fora sozinho — sem precisar de guarda separada.
     */
    const nova = R.mensagemEnvioIncompleto(total, envio.chegaram, envio.esperados);
    if (nova === v.error_message) continue; // já é o que a produção diria hoje
    alvos.push({ voz: v, nova, projetado, envio, total });
  }

  if (alvos.length === 0) {
    console.log("Nada a curar.");
    return fechamento ? fechamento() : undefined;
  }

  console.log(`ALVOS: ${alvos.length}\n`);
  let gravadas = 0;
  for (const a of alvos) {
    const { voz, nova, projetado, envio, total } = a;
    console.log(`── voz ${voz.id}  (${voz.status})`);
    // Sem projeção, `Math.round(null)` imprimia "projetado 0s (< 1200s da
    // porta)" — número inventado numa linha que existe pra ser conferida.
    const proj =
      projetado === null
        ? "projeção impossível (nada chegou ou duração não medida)"
        : `projetado ${Math.round(projetado)}s ` +
          `(${projetado >= R.MIN_TOTAL_SECONDS ? "≥" : "<"} ${R.MIN_TOTAL_SECONDS}s da porta)`;
    console.log(
      `   ${envio.chegaram}/${envio.esperados} arquivos · total ${total}s · ${proj}`,
    );
    console.log(`   ANTES: ...${(voz.error_message || "").slice(-120)}`);
    console.log(`   DEPOIS: ...${nova.slice(-160)}`);

    if (!CONFIRMAR) {
      console.log("   (ensaio — não gravado)\n");
      continue;
    }

    // `.select()` pra CONFERIR o nº de linhas: update por id inexistente
    // afeta 0 linhas EM SILÊNCIO. Trava o status também, pra não reescrever
    // mensagem de uma voz que mudou de estado no meio do caminho.
    const { data: upd, error: e2 } = await db
      .from("voices")
      .update({ error_message: nova })
      .eq("id", voz.id)
      .eq("status", voz.status)
      .select("id,error_message");
    if (e2) {
      console.error(`   FALHOU: ${JSON.stringify(e2)}\n`);
      continue;
    }
    if (!upd || upd.length !== 1) {
      console.error(`   FALHOU: afetou ${upd ? upd.length : 0} linhas, esperava 1\n`);
      continue;
    }
    if (upd[0].error_message !== nova) {
      console.error(`   FALHOU: o banco não devolveu o texto que eu mandei\n`);
      continue;
    }
    gravadas++;
    console.log(`   OK — 1 linha, conferida na volta\n`);
  }

  console.log(
    CONFIRMAR
      ? `\nGRAVADAS: ${gravadas} de ${alvos.length}`
      : `\nENSAIO: ${alvos.length} seriam reescritas. Rode com --confirmar.`,
  );
  return fechamento ? fechamento() : undefined;
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
