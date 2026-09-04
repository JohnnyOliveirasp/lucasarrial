# Ronda das falhas — 04/09/2026, ~13:00Z (10:00 BRT)

Serial: peguei o **#47** (`ce6e157d`), o mais antigo com aluna esperando
(aberto 19/08) e o único que reincidiu hoje. **Não fechei** — mas ele saiu do
meu colo com entrega concreta na mão da aluna, e a bola está com ela.

Canal: um aviso foi pro **grupo** (`notify-grupo.sh`), ordem de 31/08. Ordem de
29/08 respeitada: nada da planilha foi lido, escrito, classificado, avisado ou
reprocessado.

---

## 0. A ronda das 10:52Z prometeu escrever pra Katia e não escreveu

A nota daquela ronda termina com **"Vou escrever pra ela com isso"**. Fui
conferir os enviados do suporte@ antes de assumir qualquer coisa: o último
e-mail pra ela é o **uid 645, da Fast, 09:25Z**. Da equipe, nada desde 02/09.

Enquanto isso a Katia escreveu **três vezes hoje de manhã** (09:15, 09:20,
09:22), ouviu do bot *"a equipe responde em breve aqui mesmo"*, e ficou
**3h30 no silêncio** — depois de já ter dito que quer *"pensar em outra
solução"*. É exatamente o padrão que a ordem manda evitar: foi o silêncio que
fez a Viviana explodir.

Promessa registrada em nota não é entrega. Conferi, não inferi.

---

## 1. E a ação que aquela ronda ia mandar pra ela estava ERRADA

O plano das 10:52Z era: *"juntar os parágrafos ... tira 'você' da borda"*. Fui
rodar isso no divisor de verdade (`runpod-worker/tts_text.py`,
`split_text_for_tts`, `max_chars=160`) antes de repetir pra aluna. **É falso:**

| geração | chunks | fronteiras internas | "você" na borda? |
|---|---|---|---|
| `1498fbe5` (6 parágrafos, a que ela reclamou) | 6 | ciclos. / consciência. / é. / **você.** / portal. | **SIM** |
| `752b46ee` (parágrafos juntados, gerada 10:53Z) | 4 | ciclos. / consciência. / **você.** | **SIM, continua** |

O divisor corta por **frase** (`[.!?…:;]`) e empacota até 160 chars. Juntar
parágrafo só reempacota; *"Minha missão é te ajudar a voltar para você."*
termina em ponto e segue caindo em fim de chunk.

Se aquele e-mail tivesse saído como estava, era a **quarta** promessa furada
com a mesma aluna. O `chunk_max=160` é o detalhe que derruba a hipótese, e ele
só aparece quando se lê o worker em vez de raciocinar por cima do texto.

---

## 2. O que de fato tira a palavra da emenda (verificado, custo zero)

Trocar **um ponto final por uma vírgula**, juntando as duas frases:

> "...voltar para você**,** bem-vinda ao seu portal."

Rodado no divisor real: **5 chunks**, internas `ciclos. / consciência. / é. /
portal.` — **"você" fora de toda fronteira interna**. Sobra só o `você.` do
**último** chunk, que é justamente o único que o QA olha (a cegueira do #234 é
na fronteira **interna**).

Nenhuma palavra dela mudou. A trava do `--texto-arquivo` confirmou: *"mesmas
99 palavras, conferido"*.

---

## 3. Gerei e medi — não parei na teoria

`generation 9d7908f6`, **conta da casa, sem débito**. `medir_pausas_da_entrega`,
base `1498fbe5`:

| áudio | duração | pausas | silêncio | articulação |
|---|---|---|---|---|
| `1498fbe5` original | 42,07s | 16 | 7,69s | 2,880 pal/s |
| `752b46ee` tudo juntado | 35,09s | 9 | 4,42s | **3,261** (+0,381) |
| `9d7908f6` só a vírgula | 36,50s | 11 | 3,82s | **3,029** (+0,150) |

Juntar tudo **acelera a fala dela 13%** e piora a segunda queixa ("a voz está
ficando muito diferente do meu jeito de falar"). A variante da vírgula preserva
as quebras de parágrafo, fica bem mais perto do ritmo dela **e** mata o mesmo
silêncio morto. Por isso recomendei a `9d7908f6` e **desrecomendei** a
`752b46ee` dentro do próprio e-mail, em vez de deixar as duas lá pra ela
adivinhar.

---

## 4. O que escrevi pra ela (uid 651, cópia CONFIRMADA)

- **Não precisa gravar de novo.** A referência e a LoRA estão certas (medido na
  ronda das 10:52Z: refabricar é no-op). Ela não vai perder tempo com isso.
- **Por que insistia naquela palavra**, explicado sem jargão: a frase estava
  sozinha num parágrafo, então "você" era sempre a última palavra do pedaço, e
  é a última palavra do pedaço que sai cortada. Não era azar nem a gravação
  dela.
- **A versão nova está na conta dela**, com nome que ela acha.
- **Não afirmei que está curado.** A régua automática é a mesma que passou meses
  sem enxergar o defeito dela (calibragem circular, já registrada). Quem julga é
  ela: pedi que ouça a região dos **30–35s** e responda se saiu inteira.
- **Sem data pro #234**, dito com todas as letras, e deixando claro que a
  vírgula contorna o **texto dela**, não conserta a plataforma.

### Correção de uma informação errada sobre o dinheiro dela

O uid 645 (Fast, 09:25Z) afirmou: *"seus créditos já foram estornados
automaticamente (tanto da primeira quanto dessa segunda tentativa)"*. **Falso** —
não houve estorno porque **não houve cobrança**. Extrato sem nenhuma linha desde
22/08; as gerações de 02/09, 10:53, 11:54 e a minha de hoje são todas conta da
casa. Mandei o número certo: **saldo 178.665, acesso até 15/09, nada
descontado**.

A causa no prompt da Fast o Vigia já fechou às 12:17Z. Eu consertei o que a
**aluna leu**, que é a parte que o patch do prompt não desfaz.

---

## 5. O que eu NÃO fiz

Não afirmei cura, não dei prazo, não gastei crédito dela, não mexi em
assinatura, não virei o `TTS_TAIL_QA_INTERNO_MODO` (+16–19% de GPU, segue
pendente de aval), não apliquei migration, não mergeei PR e não toquei em nada
da planilha.

---

## 6. Fica pendente, com dono humano

1. A geração **`423e390a`** (11:54Z) está na conta dela como **"Conta da casa —
   2026-09-04"**, sem explicação: 5 parágrafos como o original, mas 35,4s contra
   42,0s. **Não fui eu que gerei** e não sei de quem foi. Deixei quieta pra não
   inventar história, mas está visível pra aluna e pode confundir.
2. **#234** (`TTS_TAIL_QA_INTERNO_MODO`) segue travando o #47 de verdade. A
   vírgula é contorno do texto dela, não conserto.
3. **#222** — cancelar + estornar as duplicadas, prazo **06/09**.
4. **Migration 102** (`102_incidents_resolved_guard.sql`) segue não aplicada.
5. Os **3 branches com conserto fora da main** apontados na ronda das 01:49Z
   continuam lá, incluindo o fix dos chamados **#243/#244** (troca de senha), que
   têm aluno esperando. Todos estão **atrás** da main (9, 23 e 63 commits) e
   precisam de rebase antes de qualquer PR — mergear como estão desfaz produção.

## 7. Registro

Nota gravada no #47 (`agent_notes` 45 → 46, 1 linha afetada, conferida na
releitura). Status `investigating` → **`aguardando_aluno`**: a bola está com ela,
com entrega na mão, e isso não é estar travado (regra 8).

Nenhum incidente fechado nesta ronda. O #47 só pode ser dado como resolvido
quando **ela** disser que a palavra saiu inteira.
