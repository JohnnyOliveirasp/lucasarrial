# 14/09 ~22h30-23hZ — Rotina das falhas

Método serial (regra 8): peguei **um** incidente e levei até o fim. Fila **83
abertos** na abertura (1 com 30d+, 3 entre 15-30d, 29 entre 7-15d). Fecha em
**82**.

Repo em `main`, `pull --ff-only` limpo. `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa, mais a ordem de **29/08** (planilha desligada).
**Nada da planilha foi lido, escrito, classificado ou reprocessado.** Ordem de
canal de **31/08**: o aviso desta ronda foi **no grupo**, com `notify-grupo.sh`,
e só lá.

Varreduras fixas, antes de tudo:

- **Travados:** 3 em "acesso vivo, com crédito e sem voz pronta", **nenhum
  novo** — Marcelo (36d, já tratado), Eric e Euneiva em `awaiting_training`
  esperando o clique **deles** (2d e 0d). Mais 1 `training_jobs` obsoleto (voz
  já `ready`, ninguém esperando). Nada a fazer.
- **Estorno:** 13 devolução + 13 não-devolução cadastrados, 3.252 linhas
  varridas, nenhum tipo por classificar.

## Qual peguei, e por que

Os 8 mais velhos foram conferidos pelas rondas das 13h–22h de hoje e seguem em
decisão alheia ou prazo datado. Reconferir de novo em 1h seria teatro.

Ordenei pela **data da última nota** (quem está aberto e ninguém encosta) —
mesmo ângulo que a ronda das 22h estreou. Deu o **`#272`** (`e39e7980`,
ederonline1@gmail.com): última anotação **06/09 01:27Z**, **9,3 dias parado**.
Era o mais abandonado da fila.

## O que era, de verdade

**A casa deu ao aluno uma orientação que não podia funcionar, e ele passou 9
dias sem usar o produto por causa dela.**

Em 06/09 eu escrevi ao Eder: *"texto mais curto, ponto final no lugar de
vírgula"*. Fui medir hoje, no splitter **real** (`runpod-worker/tts_text.py`),
não por leitura de código:

| medição nos 2 áudios dele (05/09) | resultado |
|---|---|
| `tem_linha_branca` no `text_raw` | **false** nos dois |
| separador que ele usou | quebra **simples** (`\n`) |
| 221 chars, 4 frases | **2 chunks**, fronteira interna `fim_paragrafo=False` |
| pausas internas | **ZERO** |
| ritmo | 19,2 e 18,8 cps (natural ~14-16) |
| **contraprova**, mesmo texto com `\n\n` | 3-4 chunks, **pausas reais** |

A contraprova é o que autoriza concluir: o instrumento **distingue** os
conjuntos, então o zero é ausência de fato, não cegueira.

`split_text_for_tts` separa parágrafo por `re.split(r"\n\s*\n")` — **`\n`
sozinho não separa**. Ele *tentou* separar as frases apertando Enter uma vez, o
sistema ignorou, e o áudio saiu emendado. A "voz de bêbada" é o **`#393`**
(`a75b68cd`), não percepção dele.

⚠️ **Este defeito se disfarça de queixa de ritmo.** Chegou como
"lento/arrastado" e em 06/09 foi atribuído ao `702cc916`. Quem triar por "ritmo"
manda pro cartão errado.

## O achado que passa do caso dele

**A casa acredita num mecanismo que não existe, e isso está escrito no prompt
de produção.** `frontend/src/lib/llm/normalize.ts:86-89` afirma ao modelo:

> *"o sintetizador corta o áudio NAS FRONTEIRAS DE FRASE e faz uma pausa em cada
> uma. Cada ponto que você apaga é uma pausa que some."*

Conferi por conta própria, sem depender da medição do `#393`:
`tts_settings.py:236-237` → `silence_ms=0`, `crossfade_ms=60`;
`inference.py:561` exige `silence>0 AND crossfade==0`. As duas condições falham,
**o ramo é morto**. O único silêncio vivo é o de parágrafo
(`inference.py:555`, `ends_paragraph`), que só existe com `\n\n`.

**Precisão, pra não virar overclaim:** o splitter *até* corta em fronteira de
frase, mas só quando estoura os 160 chars, e os chunks saem emendados com
crossfade de 60ms. Cortar existe; a **pausa** em cada fronteira não.

É dessa crença que sai a orientação errada que a casa vem dando. **Não mexi no
`normalize.ts`**: a regra de não juntar frases provavelmente deve ficar
(fidelidade ao texto e `!`/`?` mudam entonação dentro do chunk, efeito real). O
errado é a **justificativa**. Mudar o prompt altera o LLM de normalização em
produção — não subo isso no meio da ronda sem o Johnny. Registrado no `#393`.

## Dinheiro, conferido

Ledger lido por `ref_type`, **nunca por `kind`** (armadilha medida):

- 4 `video_clone_refund` casados 1:1 com os 4 débitos do apagão de 05/09;
- 2× 400 `generation_refund` em 06/09 01:26 → os **800 cr** prometidos
  **entraram**;
- o `-1680` de 06/09 00:31 **não** tem estorno porque aquele clone deu certo.

Nada pendente.

## Estado do aluno

**Renovou hoje** (14/09 14:26, +100.000 cr, `payment_event HP2991959937`).
**Não deu churn.** 270.270 + 7.520 cr, acesso até 14/10. Não gera áudio desde
05/09 16:19 — seguiu a orientação errada, ou desistiu de tentar.

`ler_caixa --de ederonline1@` = vazio, com contraprova (`--ultimos 3` devolve
normal, fila = 0). Ele nunca respondeu de verdade.

## O que fiz

1. **E-mail ao Eder** (Enviados **uid 2354**, bcc suporte@): corrigi a minha
   orientação de frente, entreguei o contorno **medido** (linha em branco entre
   frases), disse que é **contorno** e não conserto, sem prometer data, e
   confirmei que os 800 cr já voltaram. Regra 8: e-mail individual sobre caso
   que estou tratando, decido sozinho.
2. **`#272` → `fixed`**, com `resolution_note` dizendo o que era e o que fiz.
   A nota deixa explícito que **o motor NÃO foi consertado** e que o defeito
   segue no `#393` — pra ninguém ler "fixed" como "ritmo curado".
3. **`#393`**: anotado o 2º caso confirmado (independente da Katia) e o achado
   do `normalize.ts`. Segue `investigating`, esperando decisão de custo.

Escritas conferidas na releitura: 1 linha afetada em cada, `agent_notes` 4→5 e
0→1 (array preservado, nota concatenada).

## O que NÃO fiz, e por quê

- **Não mergeei nada.** Os dois consertos possíveis do `#393` (uma frase por
  chunk, ou anexar o silêncio ao segmento) são decisão de custo de GPU do
  Johnny, já descritas naquele cartão.
- **Não reabri o `702cc916`.** A atribuição de 06/09 estava errada, mas o
  cartão tem dono e assunto próprio.
- **Não mandei carta genérica a mais ninguém.** A promessa "aviso quando o
  Vídeo Clone voltar" dos 4 alunos foi **conferida e já estava paga** em 06/09
  00:36–00:37Z (medido na ronda de 08/09, §4). Uma carta hoje seria a 3ª ou 4ª
  repetindo o mesmo — regra 11.

## Achado de fim de ronda: trabalho em voo, não commitado

O passo fixo de fim de ronda (`origin/main..HEAD` vazio, nenhum fix preso em
branch) passou: **nada desta ronda ficou pendurado**.

Mas o `git status` acusa `frontend/src/lib/agent/mail-bounce.ts` **modificado e
não commitado** (+35 linhas), que **não é meu** — é a virada do `#402` iniciada
na ronda das 22h: parar de classificar falha de MX pela *frase* do bounce e
passar a perguntar ao DNS.

Estado real, conferido:

- são só o tipo `VeredictoDns` + documentação. **Nenhuma mudança de
  comportamento.**
- o módulo que ele cita, `mail-bounce-dns.ts`, **não existe ainda** (citado só
  em comentário, não importado — por isso não quebra build).

Ou seja: é obra **em voo e pela metade**, não um fix pronto esquecido. **Não
commitei nem descartei** — não é minha e descartar apagaria trabalho alheio.
Registro aqui porque a lição de 19/08 é exatamente essa: conserto que fica
invisível no working tree não chega em produção. Quem retomar o `#402` continua
daqui.
