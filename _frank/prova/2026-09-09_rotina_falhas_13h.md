# Rotina das falhas — ronda de 09/09, 12h42–13h30Z

Método serial (regra 8). Um card, levado até onde a evidência deixou. O
resultado principal desta ronda é **negativo**: testei uma hipótese e o teste
morreu no instrumento. Está escrito como negativo de propósito — a leitura
apressada dele seria uma refutação falsa, e é exatamente esse tipo de frase que
as rondas de 08/09 tiveram que revogar duas vezes.

Fila na entrada: **47 abertos**, 12 aguardando aluno, 4 presos. Na saída: **47**.
**Nada fechado, e explico por quê em cada um.**

---

## 1. A escolha do card, medida em vez de assumida

Listei os abertos por idade (`created_at asc`) antes de escolher, pra não pegar
o que estava mais fresco na memória:

| # | criado | alunos | situação |
|---|---|---|---|
| 15 | 30/07 | 18 | `last_seen_at` **04/09 20:47Z** — cinco dias sem ocorrer |
| 226 | 01/09 | 290 ocor. | travado por **relógio** até 18hZ |
| **234** | **02/09** | **237** | **o mais antigo que anda** |

Conferi #15 e #226 no banco em vez de herdar do log anterior — que é a lição que
a própria ronda das 10h30 escreveu depois de uma nota nossa não sobreviver à
conferência. Os dois estão como as notas diziam, e não há o que fazer neles sem
ocorrência nova (#15) ou sem entrega nova (#226, cuja nota manda explicitamente
não gastar turno medindo antes das 18hZ). Peguei o **#234**.

## 2. #234 — a pendência que a descrição gritava está encerrada

A descrição do card avisa em caixa alta que `cauda_decepada.cjs`,
`cauda_alcance.cjs` e `cauda_decepada.jsonl` estavam **untracked**, e que se
ninguém commitasse, a varredura de 20min/2GB e o alcance de 237 alunos
"evaporam e a próxima ronda começa do zero". Era pendência nominal do dono da
fila, ou seja, minha.

`git ls-files`: os **três estão rastreados e limpos**. Encerrada. Ninguém
precisa refazer a varredura.

## 3. O instrumento reproduz — e só por isso o resto vale

| | manchete da abertura (02/09) | hoje |
|---|---|---|
| base | 4.258 entregas | 4.345 |
| gerações | 609 (14,3%) | **624 (14,4%)** |
| alunos | 237 | 246 |
| vozes | 272 | 281 |

A diferença é o dataset ter crescido (o JSONL foi reescrito em 04/09), **não** a
régua ter mudado. Reproduz.

Continua de pé o alerta da nota 29, e repito porque é o que impede o card de ser
mal usado: o limiar cai na **subida** da distribuição (6,4% a 15ms → 14,4% a
35ms → 18,2% a 45ms). O número-manchete serve pra afirmar **que existe**, não
pra dimensionar dano nem pra priorizar aluno.

## 4. A hipótese que eu testei, e por que o "zero" dela não vale nada

O que já se sabia, e que estreita bem o problema: a nota 27 mostrou que a taxa é
**propriedade da voz** — 17 vozes com **zero** decepadas em até 85 fronteiras,
contra 12 vozes entre 29,9% e 54,1%. Zero em 85 a uma taxa base de 13% tem
probabilidade da ordem de **6e-6**, então não é amostra pequena: exclui sorteio
por chunk. A nota 28 testou *como o texto da referência termina* e caiu.

Faltava o candidato mais óbvio: o **áudio** da referência, que é o que o modelo
imita. Apliquei a **mesma régua e as mesmas funções de medição** (cópia literal —
régua diferente nos dois lados não compara nada) ao `reference_audio_path` das 12
vozes do polo ALTO e das 17 do polo ZERO.

Saiu **0 decepadas em 29 de 29 vozes**. Um resultado limpo demais, e é aí que a
casa já se queimou. Fui conferir antes de escrever, e o teste está **morto**:

> Em **28 das 29 vozes a medição devolveu `n=0` fronteiras** — não havia o que
> classificar. O zero não é "a referência é limpa", é "o detector não enxerga
> este arquivo".

A causa está medida, não deduzida. `fronteiras()` exige uma corrida de **≥120ms**
com `|amostra| ≤ 3e-5` (−90dB, silêncio digital):

| | janela mais silenciosa | conclusão |
|---|---|---|
| entrega (mp3 de TTS) | **−200 dB** (zeros exatos) | régua funciona |
| referência `7fbeb738` (polo ZERO) | **−65,9 dB** | **24 dB acima do limiar** — nunca haverá 120ms de silêncio digital |
| referência `0c5ec8ab` (polo ALTO) | −91,6 dB, mas os 5,5% de amostras abaixo do piso estão **espalhadas**, sem corrida de 120ms | também `n=0` |

A entrega é sintética e tem silêncio digital entre frases; a referência é
**gravação humana e tem piso de ruído**. A régua é válida na ENTREGA e
**estruturalmente inaplicável** na REFERÊNCIA.

**Então: a hipótese "a decapitação é herdada do áudio da referência" segue NÃO
TESTADA. Não marquem como caída.** Quem retomar precisa de um detector com
**piso relativo ao próprio arquivo** (percentil do envelope daquele áudio), não o
piso absoluto de silêncio digital.

Dado colateral que vale guardar: quase toda `reference_audio_path` do recorte é
um `ref/auto.wav` de **exatamente 30,0s**. A referência que o modelo usa é um
recorte curto — não o áudio bruto de treino (o da Katia, citado como 2.979s, é o
bruto). São coisas diferentes e já se confundiram em nota anterior.

## 5. Armadilha nova, registrada pra não custar duas vezes

`.like()` em coluna **uuid** não casa nada e devolve vazio **em silêncio**. Bati
nisso aqui: o script imprimiu "sem linha" como se a voz não existisse. O
`cauda_decepada.cjs` já resolve isso em `faixaUuid()` (faixa lo/hi). O README das
ferramentas já avisava pra *prefixo de id*; fica registrado que vale pro filtro
do PostgREST também.

## 6. Próximo passo do #234, na ordem em que eu faria

1. Escrever o detector de **piso relativo** e **validá-lo na âncora** `81d4f3f4`
   em t=34,494 (release=10ms, platô=−27,9dB) **antes** de apontar pra qualquer
   base. A nota 29 fixou essa âncora e ela é o único positivo confirmado por
   gente.
2. Só então remedir referência do polo ALTO × polo ZERO.
3. Se cair de novo, o próximo candidato por voz é o parâmetro de síntese gravado
   em `request_params`, que este card ainda não olhou.

## 7. O que eu NÃO fiz

Não mexi em crédito, acesso, plano, GPU, migration nem DDL. Não gastei whisper.
Não escrevi pra aluno. Não abri PR. Não toquei em nada da planilha (ordem de
29/08). **Não fechei incidente nenhum** — e o #234 continua `investigating` com o
passo que emperra escrito na nota 30, que é o que a regra 14 manda fazer em vez
de fechar pra o número cair.

Efeitos externos desta ronda: **nenhum**. Uma nota de incidente e este log.

## 8. A fila

Entrou **47**, sai **47**. Ronda sem fechamento, e o motivo é honesto: o card que
a regra mandou pegar é investigação crônica, e o passo que eu escolhi para
avançá-lo **falhou no instrumento**. Registrar isso corretamente vale mais do que
o número cair — a leitura errada deste mesmo resultado ("a referência é limpa,
hipótese refutada") teria fechado uma porta que continua aberta, e já houve duas
revogações desse tipo em 08/09.

Ficou fora do meu alcance nesta ronda, e registro pra quem pegar a próxima: o
Vigia abriu o **#320** às 12:21Z (a Fast lê 25 de 60 alunos com o texto
corrompido, `mail-respond.ts:86-91`). É mais novo que o #234, então a regra
serial não o escolheu, mas ele tem aluno pagante prejudicado **hoje** e causa já
localizada — é o candidato natural da próxima ronda.
