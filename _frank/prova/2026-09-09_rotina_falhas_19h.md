# Ronda das falhas — 09/09 ~19h20–20h00Z (Frank, dono da fila)

**Card:** `#47` / `ce6e157d` — *"aluna testou hoje (09/09) a geração de áudio
após a última correção e o problema persiste"* (Katia). **NÃO fechado.**
Segue `investigating`, agora **com nota do que foi descartado** (nota 58).

**Onde emperrou, em uma linha:** a queixa de hoje não se reproduz no arquivo, e
o que sobrou é **decisão do dono**, não investigação — escalado ao grupo às
~19h55Z. Não fechei porque a queixa de entonação continua sem causa medida, e
fechar no ouvido já custou uma retratação neste mesmo card em 02/09.

---

## §1 — Por que o `#47` e não outro

Varredura: **52 abertos**, 11 aguardando aluno, 4 presos. A regra 8 manda o mais
antigo com aluno afetado. Conferido um a um:

| card | idade | por que não é ele |
|---|---|---|
| `#15` `d3d8d1b2` | 30/07 | espera **próxima ocorrência**. Última em 04/09, instrumentação viva, dinheiro 19/19 conferido. Sem evento novo não há o que fazer |
| **`#47` `ce6e157d`** | **19/08** | **disparou hoje 18:35Z, aluna pagante, e dá pra medir agora** ← pegue este |
| `#223` / `#226` | 01/09 | esperam **decisão do Johnny** |
| `#234` | 02/09 | espera **"pode"** pro retreino que gasta GPU |

O `#47` é o mais antigo que **não está bloqueado por terceiro**, e é o único do
topo da fila com gente sofrendo agora: a aluna escreveu hoje dizendo que
**desistiu do áudio** e vai gastar os créditos em imagem *"ao menos não perco
todo o dinheiro"*. Isso é churn consumado de aluna pagante, não fila.

**Aluna em silêncio? Não.** A Fast respondeu hoje 18:35Z (enviados uid 1437).
Conferido antes de escrever qualquer coisa, pra não empilhar aviso repetido.

---

## §2 — O que foi medido, e o controle de cada régua

A queixa de hoje foi sobre a geração **`b6df1a7e`** (18:26Z, 121 chars, 7,5s):
*"continua com a entonação estranha, final de frase estranho e cortou a última
palavra do final do áudio"*.

**(1) Palavra decapitada (`#234`).** Rodei `cauda_decepada.cjs --ensaio`
**antes** de medir: a régua reproduziu os 3 casos classificados à mão
(`81d4f3f4` cortado, `47dc0f6e` e `1498fbe5` limpos). Só então apontei pro
arquivo de hoje:

| | fronteiras | release | platô | veredito |
|---|---|---|---|---|
| `81d4f3f4` (dela, 25/08, quebrado conhecido) | 6 | **10 ms** @34,494s | **−27,9 dB** | decapitada |
| `b6df1a7e` (hoje) | **1** | **190 ms** | **−51,5 dB** | **limpa** |

Régua: quebrado é `release <= 35ms` **E** `plato > -40dB`. O de hoje está longe
dos dois limiares.

⚠️ **E isto NÃO refuta o `#234`.** Texto de 121 chars cabe em **1 chunk**: sem
emenda, o defeito de emenda não tem onde acontecer. O teste mostra que o áudio
de hoje não carrega o defeito — não que o defeito acabou. Registro isso porque
a leitura preguiçosa ("medi e deu limpo, então está resolvido") é exatamente o
que produziu o fechamento errado de 02/09.

**(2) Corte do player (Xing, `a2b528a4`).** `curar_mp3_xing.cjs --aluno` varreu
as **20** gerações dela. `b6df1a7e`: `Xing=sim`, header 7,536s × real 7,503s,
perda **−0,033s**. **Nenhuma das 20 é alvo.** Não é o player comendo o fim.

**(3) A última palavra.** Whisper põe **"Morgana" em 6,88s, durando 0,44s**, e
depois dela há 190ms de decaimento limpo até o fim. A palavra está no arquivo.
(Whisper sozinho seria régua cega aqui — quem responde de verdade é o envelope
do item 1. Os dois concordam.)

---

## §3 — O zero que eu quase reportei como bug

`voices.tts_silence_ms` está **NULO em 1220 de 1220 vozes**. Parece a descoberta
do dia. **Não é.** É a **reversão deliberada de 24/08** (ordem do Johnny, caso
Kessuly), documentada em `finalize-training.ts:387-403`: o worker segue
**medindo** `reference_pause_ms`, e o backend só **loga**, não grava.

O controle que provou que a leitura não era cega, antes de eu acreditar no zero:

| janela | vozes ready | `tts_silence_ms` | `speech_rate_wps` |
|---|---|---|---|
| antes de 21/08 | 730 | 0 | 1 |
| 21/08 em diante | 391 | **0** | **208** |

`speech_rate_wps` sai do **mesmo** caminho de escrita e **aterrissa** (1/730 →
208/391). Logo o caminho grava; o pacing é que foi desligado de propósito. Se a
minha consulta estivesse errada, as duas colunas leriam zero.

➜ **Fica a regra:** zero de instrumento merece um controle positivo do MESMO
caminho antes de virar manchete. Aqui o controle transformou "bug sistêmico em
1220 vozes" em "decisão do dono funcionando como escrito" — e eu estava a um
passo de postar a manchete errada no grupo.

---

## §4 — O que sobrou, e por que não decidi sozinho

O `tts_silence_ms = 466` **desta voz** foi ajustado à mão em 21/08 e
**aprovado por ouvido humano** num A/B contra 220 (nota de 21/08 no próprio
card). Em 24/08 ele foi zerado **junto com as outras 92** pela reversão global —
que mirava **outro modo de falha**: crossfade 0 + silêncio de 1,5–1,9s inserido,
que expunha cada borda suja de pedaço. **Ninguém conferiu se a reversão valia
pra ela**, cujo ajuste já tinha passado por ouvido humano.

Repor 466 só na voz dela **não gasta GPU nem crédito**. Mas contraria ordem
vigente do dono, e o manual é explícito: *"na dúvida entre duas, pergunte; nunca
escolha em silêncio quando envolve dinheiro de aluno"*. **Escalado ao grupo,
não executado.**

**Referência: descartada como pendência.** `fabricar_referencia.cjs` com a regra
nova (pós `ff06195`) devolve **115 candidatas** e a **#1 é a MESMA janela** que a
voz já usa (1017,5s→1042,6s). Refabricar não é ganho óbvio, e mexer nisso no
escuro já deixou voz *"muito pior"* (Kessuly). **Não mexido.**

---

## §5 — Aluna: o que foi feito e o que não foi

- **Não escrevi pra ela nesta ronda, de propósito.** Ela foi respondida hoje
  18:35Z e não está em silêncio. O que eu teria a acrescentar depende do "pode"
  do Johnny (§4) — escrever agora seria ou repetir a Fast, ou prometer o que
  ainda não está decidido, que é o defeito do `#323` que fechei há 3 horas.
- **Crédito:** nada indevido. As versões refeitas saíram por conta da casa.
- **⚠️ Prazo correndo:** acesso dela vence **15/09**. A decisão de estender foi
  escalada em **08/09** e continua sem resposta — e a Fast **já prometeu a ela
  hoje** que "está em andamento". A promessa está de pé há 24h+ com 6 dias pro
  vencimento. Cobrado no grupo junto com o §4.

---

## §6 — Fecho da ronda

- Nota 58 gravada no `#47` (conferida na releitura: 1 linha afetada,
  `agent_notes` 57 → 58, `resolution_note` 2.644 chars).
- Grupo avisado às ~19h55Z, marcado urgente, com as duas pendências dela.
- Nenhum fix de código nesta ronda — não havia defeito de código a corrigir no
  que foi medido.
- `_frank/rascunhos/` tem 5 arquivos untracked da ronda do `#324` (não são
  meus; deixados como estão).
