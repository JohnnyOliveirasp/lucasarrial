#!/usr/bin/env node
/** Abre o incidente do defeito de codigo medido na ronda de 10/09 ~22hZ. */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const TITULO =
  "O DEDUP DE FOTO DO SGP BARRA FOTO DIFERENTE COMO 'REPETIDA' E TRANCA O ALUNO NA TELA 2: " +
  "ehRepetida (impressao-foto.ts:82-88) usa dHash 8x8 (64 bits) com DHASH_LIMITE=5, e nos 64 bits " +
  "a faixa de 'mesma imagem re-salva' (0..1) SE SOBREPOE a de 'fotos diferentes da mesma pessoa' (1..4) " +
  "— nenhum limiar separa. Anexadas 2 fotos, TODAS as outras do aluno passam a ser recusadas e " +
  "retentar nunca resolve. 1 pagante travado ~6h em 10/09";

const DESCRICAO = `MEDIDO POR MIM (FRANK) NA RONDA DAS FALHAS DE 10/09 ~22hZ, EM PRODUCAO.
Nasceu do #346/#345 (Igor Moraes, clonedoigor@gmail.com, sessao 42454b04).
Aquele cartao fecha o caso DO ALUNO (destravei e avisei). Este e a PORTA, que
continua quebrada em producao.

O DEFEITO
frontend/src/lib/sgp/impressao-foto.ts:
  - dhash() (linhas 39-66) reduz a imagem a 9x8 cinza => 8x8 = 64 bits.
  - DHASH_LIMITE = 5 (linha 26), comentado como "~8% de diferenca".
  - ehRepetida() (linhas 82-88) barra se sha256 igual OU distancia <= 5.
Espelhado no banco em scripts/103_sgp_anexo_atomico.sql (sgp_dhash_distancia +
sgp_anexar_foto, parametro p_dhash_limite), que e quem decide de verdade.

A MEDICAO (32 objetos reais da sessao 42454b04, funcao de distancia da producao)
  MESMA imagem re-salva/reconvertida  IMG_7845.png x IMG_7845.jpg = 1
  MESMA imagem, reupload              IMG_7841     x IMG_7841     = 0
  FOTOS DIFERENTES                    IMG_7841 x IMG_7837 = 1
                                      IMG_7843 x IMG_7839 = 2
                                      IMG_7841 x IMG_7847 = 4
                                      IMG_7843 x IMG_7845 = 4
As faixas se SOBREPOEM: mesma = 0..1, diferente = 1..4. Em 64 bits NAO EXISTE
limiar que separe as duas coisas. Baixar o limite nao conserta (a 1 e 2 ja
sao fotos diferentes); manter em 5 barra tudo. O parametro nao e o problema:
a RESOLUCAO do hash e.

CONSEQUENCIA MEDIDA
Depois que o aluno anexou 7841 e 7843, as 6 fotos distintas restantes dele
batiam <=5 contra uma das duas. Conferido uma a uma: 7845, 7847, 7837, 7838,
7839 — TODAS barradas. Ele nao tinha uma unica foto capaz de entrar, e o
minimo e 4 (SGP_FOTOS_MIN). Reenviar, trocar de formato (jpg->png) e mudar
o tamanho nao mudam nada: ele tentou os tres, 30 objetos no R2, ~6h travado.

A MENSAGEM PIORA O QUADRO (anexar.ts:99)
"Voce ja enviou esta foto. Escolha outra, de um angulo diferente."
A NOSSA PROPRIA visao classificou 7847 como rosto_frente e 7841 como
meio_corpo — angulos diferentes. A casa manda o aluno fazer exatamente o que
ele ja esta fazendo. Mesma familia do "tente de novo" do #344.

O QUE NAO E A CAUSA (para nao repetir a hipotese errada)
Nao e tamanho de arquivo. A nota anterior deste caso dizia ">=14MB nunca
anexa". Rodei o julgarFoto de producao contra os arquivos: PNG de 18,78MB e
19,77MB voltam HTTP 200, pessoas=1, aprovada. Se a casa tivesse seguido aquela
hipotese, teria mandado o aluno reduzir a foto — instrucao impossivel, a
terceira dada a ele.

CORRECAO PROPOSTA, COM O NUMERO JA MEDIDO
Subir a resolucao do dHash de 8x8 para 16x16 (256 bits, scale=17:16). Medido
nos MESMOS arquivos:
  mesma imagem re-salva = 0..1   |   fotos diferentes = 5, 6, 35, 55, 56
Passa a SEPARAR, com folga. Limiar sugerido 3 (ou 2), que fica dentro da
janela vazia entre 1 e 5.
Precisa mudar juntos: dhash() no TS, DHASH_LIMITE, e o espelho no SQL
(sgp_dhash_distancia ja e generico no comprimento; sgp_anexar_foto recebe o
limite por parametro, entao muda no chamador).
COMPATIBILIDADE: dhash antigo tem 16 chars e o novo 64. distancia() devolve 64
quando os comprimentos diferem (TS linha 69-70 e o mesmo no SQL), ou seja,
foto velha x foto nova nunca sera lida como repetida. Isso FALHA ABERTO (deixa
passar), nunca trava aluno — que e a regra declarada do proprio modulo: "a
impressao nunca pode DERRUBAR um upload". Pedido antigo no meio do caminho
perde o dedup contra as fotos ja anexadas ate ele reenviar; e o lado seguro.

ALCANCE HONESTO HOJE: 1 aluno (o Igor). Varri os 23 pedidos parados na tela da
foto: thiagotca100 tem 6 anexadas (o TETO) e as 2 orfas dele foram recusadas
CERTO por 'max'; wallanadaphiny e do #238 (lost update, sessao 3e2a184d, o
caso-prova do proprio script 103) e nao deste bug; os outros 20 tem 0 anexadas
e 0 orfas (nunca subiram nada). O numero e 1 — mas e 1 por dia de sorte: o
gatilho e "as fotos da pessoa se parecem", que e o caso NORMAL de quem tira 6
selfies no mesmo lugar.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system", cause: "bug", categoria: "tecnico", status: "investigating",
    signature: "frank:sgp-dedup-foto-dhash-8x8-barra-foto-distinta",
    title: TITULO, description: DESCRICAO,
    occurrences: 1, affected_emails: ["clonedoigor@gmail.com"],
    reported_by: "frank", first_seen_at: agora, last_seen_at: agora, agent_notes: [],
  };
  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: "<" + DESCRICAO.length + " chars>" }, null, 2));
    return;
  }
  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify({ id: data[0].id, numero: data[0].numero, status: data[0].status }, null, 2));
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
