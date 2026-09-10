#!/usr/bin/env node
/**
 * Abre o incidente medido na ronda das falhas de 10/09 ~11hZ:
 * o gate de rosto do Video Clone checa ANGULO e BOCA VISIVEL, mas nao checa
 * o TAMANHO do rosto no quadro — que e a causa que a propria casa recita
 * para "boca robotica".
 *
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();

const CONFIRMAR = process.argv.includes("--confirmar");

const AFETADOS = ["contato@mastroiannioliveira.com.br"];

const TITULO =
  "O GATE DE ROSTO DO VIDEO CLONE NAO MEDE O TAMANHO DO ROSTO NO QUADRO: " +
  "checkFrontalFace (face-gate.ts:28-73) so decide 'frontal' e 'mouth_visible', entao cena larga " +
  "com rosto pequeno passa e e COBRADA, e sai com a boca grosseira — que e exatamente a causa que " +
  "a propria Fast recita ao aluno. 7 clones cobrados (3.920 a 6.800 cr cada) num pagante em 09-10/09";

const DESCRICAO = `MEDIDO POR MIM (FRANK) NA RONDA DAS FALHAS DE 10/09 ~11hZ, EM PRODUCAO.
Nasceu do caso do mastroianni (#331 / 3528dd59), mas o defeito NAO e dele: e da regra do gate.

O DEFEITO
frontend/src/lib/video-clone/face-gate.ts, checkFrontalFace() (linhas 28-73):
o SYSTEM prompt (linhas 17-21) pede ao modelo de visao APENAS tres campos —
{"frontal", "mouth_visible", "reason"} — e a decisao (linha 65) e
  if (parsed.frontal === true && parsed.mouth_visible === true) return { ok: true };
Nao existe NENHUMA condicao sobre o TAMANHO do rosto dentro do quadro.
Chamado em frontend/src/app/api/v1/video-clone/route.ts:152-161, ANTES de cobrar.

POR QUE ISSO IMPORTA (a casa ja sabe a regra, so nao a aplica)
A saida do Video Clone e 480x832. Quando o rosto ocupa pouca altura do quadro,
sobram poucos pixels para a boca e o lip-sync sai grosseiro. Essa regra e
RECITADA PELA PROPRIA FAST ao aluno, palavra por palavra (uid 1553, 10/09 02:00Z):
  "Quanto menor o rosto no quadro, menos pixels sobram pra boca e a sincronia
   fica grosseira" ... "vale recortar a foto mais de perto — cabeca e ombros"
  e o limiar que ela cita e "rosto ~1/3 da altura".
Ou seja: a casa tem o criterio, comunica o criterio ao aluno depois do prejuizo,
e NAO o aplica no gate que roda antes de cobrar.

A MEDICAO (caso mastroianni, pagante, conta de 08/09)
7 video_clones, TODOS status=ready, TODOS tier=480p-v2, todos com image_path
apontando para imagem GERADA NA PLATAFORMA (<uid>/images/<id>/result.png):
  23:43Z 84.92s  6.800 cr   img b832ef36
  00:59Z 66.60s  5.360 cr   img 8f1e389c   <- o "clone de 1:04" que ele reclamou
  01:23Z 84.92s  6.800 cr   img f3cd2b0e
  02:16Z 48.37s  3.920 cr   img f3cd2b0e
  02:55Z 48.37s  3.920 cr   img c72b6615
  03:25Z 48.37s  3.920 cr   img 4304d732
  03:54Z 49.08s  4.000 cr   img ba81cc49   <- ultima tentativa, ainda cena larga
Baixei 5 das 6 imagens-fonte distintas do R2 (b832ef36 = NoSuchKey). TODAS
940-941 x 1672 (proporcao 0,562 = 9:16 exato, ou seja NAO ha perda por
keep_proportion:"crop") e TODAS sao cena larga de estudio/escritorio: a pessoa
sentada, microfone/mesa/cenario no quadro, rosto ocupando por volta de 1/6 da
altura. Todas passaram no gate (frontal OK, boca visivel OK) e foram cobradas.

CONTRA-PROVA NO MESMO CASO
O aluno recortou a foto certo por conta propria (cabeca e ombros, rosto perto de
metade da altura) e tentou mandar por e-mail QUATRO vezes para confirmar se
estava certo — e a caixa recusou SEIS vezes pelo teto de anexo (classe #331/#98,
PRs #41/#42/#187/#230 parados). Ele nunca usou esse recorte em nenhum clone.
Ou seja: o enquadramento certo existia, e nem o gate nem o suporte o colocaram
no caminho dele. Ele terminou a madrugada pedindo reembolso as 23:06 BRT.
Estimativa do desperdicio: os ~34.720 creditos dos 7 clones foram gastos em
material que o proprio criterio da casa prevê que sairia grosseiro.

O QUE ESTE INCIDENTE NAO E
Nao e o teto de anexo (isso e #331/#98, ja tem 4 PRs escritos).
Nao e falha de GPU nem de modelo: os 7 jobs sairam ready, sem raw_error.
Nao e proporcao de imagem: as fontes ja estao em 9:16 exato.

CORRECAO PROPOSTA (barata: mesma chamada de visao, zero latencia extra)
1. Acrescentar ao SYSTEM de face-gate.ts o campo "face_height_pct" (altura do
   topo da cabeca ao queixo, em % da altura da imagem) — e so mais um campo no
   MESMO JSON da MESMA chamada; nao ha custo nem round-trip novo.
2. Regra nova, NAO bloqueante e sim de AVISO, para nao repetir o erro do gate
   duro: se face_height_pct < ~25, devolver ao aluno o alerta acionavel ANTES de
   cobrar ("o rosto esta pequeno no quadro; recorte cabeca e ombros ou o
   lip-sync sai duro"), deixando ele escolher seguir assim ou trocar a foto.
   Bloquear direto arriscaria travar caso legitimo, e o gate ja e fail-open.
3. O limiar deve ser calibrado numa amostra real antes de subir, NAO chutado:
   medir face_height_pct contra reclamacao de boca em video_clones ready.
   Este incidente NAO afirma que 25 e o numero certo — afirma que hoje o numero
   nao existe.
4. Cuidado ja conhecido: o gate e fail-open de proposito (linha 70). O aviso
   novo deve herdar isso — visao fora do ar nao pode virar bloqueio nem susto.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "investigating",
    signature: "frank:face-gate-sem-tamanho-de-rosto",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 7,
    affected_emails: AFETADOS,
    reported_by: "frank",
    first_seen_at: agora,
    last_seen_at: agora,
    agent_notes: [],
  };

  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: "<" + DESCRICAO.length + " chars>" }, null, 2));
    return;
  }

  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify(data[0], null, 2));
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
