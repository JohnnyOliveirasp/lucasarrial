# Ronda das 13h UTC — 21/08/2026 (Rotina das Falhas, dono da fila)

Card: `67ea46f9` · Início 12:40Z · Fila recebida: 6 abertos
(`2c5bab42`, `5c3f1f8b`, `ce6e157d`, `72e054ee`, `8379549c`, `c82c77e4`)
Estado da fila no fim: **6 abertos, 0 fechados nesta ronda.**

> **Resumo honesto:** nenhum incidente fechou. O que esta ronda entregou foi
> **um conserto pronto que estava parado há 25h e ninguém tinha visto**, dois
> consertos novos em PR, e **a demolição de um número que eu mesmo produzi**.
> Registro também um erro meu de método, cometido nesta ronda.

---

## 1. 🔴 O achado da ronda: PR #16 pronto, verde e parado há 25 horas

Saiu da **conferência de fim de ronda** — a que existe exatamente pra isso,
depois de um fix de aluno ter ficado 9h preso numa branch em 19/08. Este ficou
**25h**.

**PR #16**, branch `feat/ref-corte-em-palavra`, commit `93f9b3b` (20/08 07:24
-04, PR aberto 20/08 11:25Z). **Não está na main** — `git grep` por
`_snap_bounds_to_words` e `transcribe_words` na main volta vazio. **Zero
comentário, zero review, zero check de CI.**

É o **item 2 da ordem de 20/08** ("referências cortadas no meio da palavra").
Usa `word_timestamps` do whisper, que é **o método aprovado**. A heurística por
energia, a que foi **reprovada duas vezes**, não está nele.

O que faz: `_snap_bounds_to_words` + `_cut_snapped_candidate` em
`voice_pipeline/reference.py` — janela folgada ±1,5s, whisper com word
timestamps, primeira e última palavra **inteira**, re-corte com pad de 60ms.
Candidata curta demais (<60% de `ref_seconds`) ou sem palavra inteira é
descartada; whisper sem `words` cai no corte por tempo de hoje, então **nunca
quebra o treino**. `select_reference_clip` fica com a assinatura **intacta**.

**Conferido nesta ronda — medido, não suposto:**

| verificação | resultado |
|---|---|
| testes | **19 passed in 0.03s** (`test_reference_word_snap.py`, venv com pytest, sem GPU) |
| conflito com a main | **0 marcadores**, via `git merge-tree` na merge-base |
| branch stale? | não — a main mexeu em `runpod-worker` depois (`aae3ba5`) e ainda assim não conflita |
| treino em voo | **nenhum.** 29 vozes em estado intermediário, **as 29 `awaiting_training`** (esperando o aluno clicar). Zero em `training`/`processing` |

Pela mensagem do próprio commit, **1 em cada 3 vozes novas** nascia com a
referência decapitada. Cada dia parado é mais voz nascendo torta.

**Não mergeei, de propósito:** mexe no `runpod-worker` e o deploy **recicla o
worker de voz**. Errar ali quebra treino de todo mundo em silêncio e quem paga
é o aluno. Essa decisão não é minha. **Escalado ao Johnny 13:2xZ** com os
números acima; falta só o "pode".

⚠️ **O que este PR NÃO faz** (pra ninguém vender como bala de prata): cura o
**corte da referência**. **Não** cura a queixa da **pausa** da Katia. A pausa é
outro caminho — `handler.py:1530` só insere silêncio **entre chunks** e
`_split_text_for_tts` (`handler.py:661`) empacota várias frases no mesmo chunk
até 160 chars, então fronteira de frase **dentro** do chunk é estruturalmente
incapaz de receber pausa. Continua **em aberto**.

---

## 2. ⚠️ Erro meu nesta ronda: eu produzi um número inflado e o joguei fora

Pra checar se o `8379549c` ainda estava fazendo vítima, escrevi um **terceiro**
detector. Na janela do Vigia (19/08 15:10Z → 21/08 12:00Z) ele deu **23
vítimas** contra as **7** que o Vigia mediu.

O meu estava **errado**, e a causa é boba: quando a referência usada pela
geração **não está** em `<uid>/refs/`, o `Math.max(...[], 0)` devolve `0`, que
vira `1970-01-01`, e a comparação "a ref usada é mais velha que o upload"
passa **sempre**. **14 das 23** caíram nesse caminho — dá pra ver o `1970` na
saída. Sobram ~9 datáveis, perto dos 7 do Vigia.

**O número que vale continua sendo o 7 do Vigia**, com o critério estrito dele.
Registro aqui pra ninguém citar "23" depois. É a mesma armadilha que este repo
já cobrou: **conclusão grande em cima de um artefato do próprio script**.

Detector descartado em `_Bugs/` (fora do git), com o defeito anotado.

E a medição que eu queria fazer **não deu resposta**: desde 12:00Z houve
**1 geração**, sem referência de imagem. Zero vítimas num denominador de 1
**não é prova de que parou** — é falta de tráfego. Não conta como evidência.

---

## 3. `2c5bab42` — upload silencioso · achado novo, **não fechou**

**Achado:** a lista de extensões de áudio do **navegador** divergiu da fonte
única. `frontend/src/lib/audio/collect.ts` (`AUDIO_EXT_RE`) tem **10**
extensões; `EXTENSOES_AUDIO` em `lib/voices/regua-audio.ts`, que o `a0b58e1`
criou **hoje** como fonte única, tem **13**. Faltam `amr`, `mov`, `mkv`. O
`a0b58e1` unificou **import do Drive + régua (servidor)** e **não tocou no
navegador**. O `ACCEPT` (`voice-creator.tsx:17`) também não tem `wma`.

O descarte é **silencioso**: `filterAudioFiles` (call site linha 265) e
`gatherAudioFromDataTransfer` (linha 280) devolvem só os sobreviventes e o
número de descartados **nunca é calculado nem mostrado**. O input tem
`webkitdirectory` — a pessoa escolhe uma **pasta** — então `.amr` de gravador
Android some sem uma palavra e ela leva "áudio insuficiente" depois.

**O que isso NÃO é, e eu provei antes de escrever:** **não** é a causa dos 17
arquivos faltando na numeração. Arquivo descartado pelo navegador **nunca vira
slot** — os slots saem de `files[]` **já filtrado** (`voice-creator.tsx:305`,
`files.map` → `upload_slots`). Sem slot, `contarSlotsDoEnvio` não tem índice
pra contar e o caso **não aparece em `faltando`**. Ou seja: **esta classe é
invisível pro detector que mediu 17 de 24.** Não juntar com o número.

**Em correção:** card `70141486`, branch `feat/audio-descartado-com-aviso` —
**só o aviso**.

**Decidido NÃO fazer, com motivo:** não vou alinhar a lista do navegador com as
13. `mov` e `mkv` são container de **vídeo** e `measureAudioDuration` no
navegador provavelmente devolve `null` pra eles; como o envio só libera com
**20 min somados**, aceitar o arquivo e não conseguir medir a duração
**trancaria o aluno numa tela sem saída**. Trocar um defeito por um pior não
serve. Fica como decisão pro Johnny, não como pendência técnica.

`last_seen_at` segue **2026-08-21T04:17Z**. **Segue aberto** — o aviso não
conserta a perda.

---

## 4. `72e054ee` — Valtermir · anotado, **não fechou**

**O título deste card está com a data errada e isso quase matou o caso.** O
título gerado pela Fast diz "tentou upload ontem **(19/08, ~8h)** após a
correção do Frank". Impossível: o fix do `5bb774b8` entrou 19/08 **18:14Z**.
Quem lê o título conclui "testou antes do fix, não vale". O e-mail é de **21/08**
e ele escreve "ontem por volta das 8h" = **20/08 ~11h UTC**, ~17h **depois** do
fix. **O teste dele é pós-correção e falhou.**

**Não reabrir o `5bb774b8`**: as duas fotos **subiram** (R2, conferido pelo
Vigia). O retry no PUT funcionou.

**Causa real:** é a classe do `8379549c`. A geração `e2964045` (20/08 12:01:45Z,
**525 créditos**, `ready`) gravou `input_image_paths` com **um** arquivo
(`104339f5`) de **10:51:56Z**, uma hora e dez **antes**. Nenhuma das duas fotos
novas entrou no payload. Por isso a IA "inventou um óculos": **ela nunca viu a
foto**.

**Conferi a conta nesta ronda:** acesso **ativo até 2026-09-10**, 189.455
créditos, **última geração 20/08 12:01** — ele **não voltou a gerar** depois da
falha. Parou. Isso confirma "não gostaria de gastar meus créditos em tentativas
e erros".

**Escalado ao Johnny 12:52Z**, fora do relatório da noite, por ser pagante
travado. Duas perguntas binárias: **pode responder** e **devolvo os 525**.
Sem o "pode" não escrevo nem estorno.

---

## 5. `8379549c` — a classe · **PR aberto, não fechou**

**PR #27** (card `11cd0992`), branch `feat/aviso-foto-fora-da-geracao`, commit
`dac8920`. Aviso **persistente** (não toast) logo acima do botão Gerar, quando
a foto salva no banco nesta sessão **não está no quadro**.

**O que eu conferi no diff, não só no relato do operário:**
- `ShieldAlert` **já estava importado** (linha 6) — compila.
- **A comparação bate com o que é cobrado:** `bankPendingCount` compara contra
  `readyKeys`, e `readyKeys` é exatamente o que vai no payload
  (`input_image_keys: readyKeys`, linha 527). O aviso sai da mesma fonte de
  verdade que gera a cobrança. Esse era o ponto que podia estar errado e não
  está.
- O operário capturou a chave **adotada** (`refs/...`) que o POST devolve, não
  a original do upload — sem isso a comparação nunca fecharia.
- Nenhuma rota de API, nenhuma migration, nenhum crédito.
- Comportamento intencional de 19/08 (foto vai só pro banco) **preservado**.

**Honestidade sobre o teste:** `tsc --noEmit` exit 0 e lint limpo, rodados pelo
operário — que **reportou sozinho** que o primeiro "tsc exit 0" era **falso**
(stub do npx, ambiente com `omit=dev`) e refez com `--include=dev`. **Não foi
testado em navegador.** Não vou dizer que está provado.

---

## 6. `5c3f1f8b` e `c82c77e4` — sem mudança

- **`5c3f1f8b`** (5 pagantes sem voz): a varredura desta ronda lista **os mesmos
  5**, nenhum entrou, nenhum saiu. Pergunta 1 ("já resolveu sozinho?") = **não**
  para os 5. O que falta é **avisar que precisam reenviar** e isso depende do
  "pode". `jrfengenhariadf` perde acesso **25/08**.
- **`c82c77e4`** (1,50 GB duplicados): **não toquei**. Custo nosso, nenhum aluno
  prejudicado, e apagar objeto no R2 é destrutivo. Não era a prioridade com
  pagante esperando.

---

## 7. Verificações obrigatórias da rotina

- **Fechado que voltou a disparar:** **1 de 69** (`acf8acd6`), última ocorrência
  há **84h**, `vivo_48h = false`. **0 vivos nas últimas 48h.** O padrão do
  `8d370ef5` não se repetiu.
- **`d3d8d1b2` (timeout, `ignored` por decisão do Johnny): NÃO voltou.** Não
  aparece entre os fechados que dispararam depois do fechamento. **Sem reabrir**
  — e portanto sem instrumentar o handler, que era o combinado só "se voltar".
- **Consulta paginada e `error` cru impresso:** sim. Foi o que pegou o
  `column generations.input_image_paths does not exist` — a tabela certa é
  `image_generations`. Um zero silencioso ali teria virado "não tem vítima".

## 8. Produção e gasto

- Deploy: HEAD da main segue `a775bd5`. **Nada mergeado nesta ronda.**
- **Nenhuma geração nova, nenhum crédito, nenhum débito, nenhuma GPU.**
- **Nada escrito para aluno.**
- Duas mensagens ao Johnny (12:52Z e 13:2xZ), as duas por decisão travada com
  relógio, não por incidente. O relatório consolidado vai à noite.

## 9. Precisa do Johnny (5 itens, todos binários)

1. **Mergear o PR #16?** Pronto, verde, 0 conflito, 0 treino em voo. Cada dia
   parado é mais voz nascendo torta.
2. **"Pode" para responder o Valtermir** + **devolvo os 525 créditos?**
3. **Contato/estorno para os outros 5** do `8379549c`, ou só conserta a tela?
   (São suspeita medida, **não** vítima provada — só o Valtermir confirmou por
   escrito.)
4. **"Pode" para responder a Katia.** Vence **22/08 12:00Z**. 3ª ronda pedindo.
5. **"Pode" para avisar os 5 pagantes sem voz** que precisam reenviar.
   `jrfengenhariadf` perde acesso **25/08**.
