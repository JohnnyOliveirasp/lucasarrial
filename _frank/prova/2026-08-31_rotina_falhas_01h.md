# Rotina das Falhas — 31/08/2026, ~01h20–02h00 UTC (= 22h20–23h00 BRT) — dono da fila

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia.
Índice de ordens lido antes de tocar em qualquer coisa, mais a de 29/08
(`desligar_vigia_e_frank`) e a de 27/08 (`vigia_so_erro_de_sistema`).

**Ordem de 29/08 — nada nesta ronda encostou na planilha**: não li, não escrevi,
não classifiquei, não reprocessei e não abri chamado com causa nela.

**Janela**: 22h20 BRT, dentro do turno 08h–23h BRT. Não rodou de madrugada.

Rondas anteriores: falhas 23h UTC, vigia 00h UTC, e **duas sessões de falhas que
não deixaram log** (notas 14 e 15 do #192, 00h01Z e 00h47Z). Conferi que **não
havia sessão paralela viva** — o único processo `claude` da máquina era o meu.

---

## Placar

| | |
|---|---|
| Abertos na chegada (`open`/`investigating`) | **6** (#99, #192, #200, #201, #202, #203) |
| Em `aguardando_aluno` | **2** (#196, #197) |
| Abertos ao sair | **6** — mesmos |
| **Fix resgatado do chão** | **1** — 491 linhas que estavam a um `git checkout` de sumir |
| PR que abri | **1** (#135) |
| Testes escritos | **21**, todos passando |
| Incidentes que anotei | **1** (#192, 15 → 16 notas, 1 linha afetada) |
| Incidentes que FECHEI | **0** — motivo no §5 |
| Aluno avisado por mim | **0** — motivo no §5 |
| Crédito / GPU / migration / voz / referência tocados | **nada** |
| Custo | ~zero. SQL de leitura + transpilação local. Zero whisper, zero GPU. |

---

## 1. O achado da ronda: um fix de aluno estava LARGADO no chão da `main`

Não é sobre o aluno. É sobre nós, e por isso vem primeiro.

A nota das 00h47Z do #192 disse ter pedido ao `coder` uma "guarda de
substituição". Fui conferir se o card virou PR. **A guarda já existia, pronta,
491 linhas** — `frontend/src/lib/llm/mandato-normalizacao.ts` — **solta na
árvore de trabalho da `main`**:

- em **nenhum** branch, local ou remoto (conferido com `git branch -a`);
- em **nenhum** commit, em **nenhum** PR;
- **referenciada por nenhum arquivo** do projeto (`grep` no `src/` inteiro);
- `mtime` **01h11Z** — escrita **depois** da nota das 00h47Z, por uma sessão que
  terminou sem subir nada.

Qualquer `git checkout` ou `git clean` da próxima ronda teria destruído o
trabalho, e ninguém saberia que existiu. É o modo de falha que a ordem nomeia
(19/08, fix de aluno 9h preso em branch) — **só que pior, porque nem em branch
estava**. O `git log origin/main..HEAD` do fim de ronda, que é o passo fixo que
existe justamente pra pegar isso, sai **vazio** neste caso: o arquivo nunca foi
commitado, então o teste de fim de ronda **não o enxerga**. Fica registrado que
o passo fixo tem esse ponto cego.

## 2. O que ninguém tinha feito com essa guarda: **executar**

Ela estava escrita, comentada, argumentada — e nunca tinha rodado uma vez.
Transpilei com o `typescript` 5.9.3 do próprio `frontend` e rodei sobre as
**2.489 gerações reais** com `text_raw <> text_normalized`. Scripts descartáveis
(`_Bugs/192_prova_da_guarda.cjs`, `_Bugs/192_falsos_positivos.cjs`), **só
leitura**, zero GPU, zero crédito, zero escrita. Paginei de propósito — a
armadilha do corte em 1000 está na minha ordem.

**O que ela acerta:**

| | |
|---|---|
| gerações com alguma reversão | **290** (451 reversões) |
| `pra` → `para` desfeito | **143×** — a troca nº 1 do defeito |
| `digital` → `dijital` desfeito | **11×** (7 `digital` + 4 `digitais`) |
| imperativo do Robert | `clica`→`clique` e `escolhe`→`escolha`, os dois pares exatos da `b298e5be` |
| **invariante `[.!?]`** | **0 de 290** alteraram a contagem de fins de frase |

Trabalho legítimo **preservado** no mesmo passe: `3`→`três`, `dr`→`doutor`,
`vc`→`você`, `marketing`→`marketin`, `design`→`dizain`,
`tecnologia`→`tecnolojia`, `oolha`→`olha`. Conserto de acento é invisível pra
guarda por construção.

O `digital`→`dijital` é o achado que fecha o argumento: o prompt lista
"digital" **nominalmente** entre as palavras a não tocar, e o modelo troca assim
mesmo, 11 vezes. **Instrução não é garantia; por isso tem que ser código.**

## 3. Dois limites que só apareceram **porque eu rodei**

**(a) `creator` → `criador` não é revertido.** A regra 5 (parece estrangeira →
mantém) dispara **antes** da regra 7 (troca lexical), embora o **cabeçalho do
próprio módulo** cite esse par como exemplo da regra 7. O módulo se
contradizia, e ninguém tinha visto porque ninguém tinha executado. 7
ocorrências. Eu previ isso lendo o código e a execução confirmou.

**(b) ~10% das 451 reversões desfazem conserto de digitação LEGÍTIMO**, quando
o typo do aluno está longe da palavra certa: `creie`→`criei` (5×),
`clode`→`claude` (3×), `acrodei`→`acordei`, `estmaos`→`estamos`,
`depios`→`depois`, `laser`→`lezer`, `people`→`pipl`. Separar typo de troca
indevida exige um léxico do português, que o módulo não tem.

**Não tentei consertar (b) nesta ronda, de propósito.** Inventar heurística às
23h sem conseguir validá-la direito é exatamente o que a minha ordem permanente
proíbe ("heurística por energia foi REPROVADA duas vezes, não subir").

## 4. O que subiu

- Branch `feat/guarda-mandato-normalizador`, commit `e111979`, **PR #135**.
- 21 testes em `frontend/src/lib/llm/mandato-normalizacao.test.ts`
  (`node --test`, **21/21**), seguindo a convenção do repo (type-stripping
  nativo). **Dois deles se chamam `BURACO CONHECIDO` e `CUSTO CONHECIDO`** e
  travam o comportamento defeituoso do §3 — documentam o buraco em vez de
  escondê-lo. Se alguém consertar, o teste quebra e aparece no diff.
- `tsc --noEmit --strict` limpo.

**NÃO liguei o módulo no `normalize.ts`, de propósito.** Ligar hoje trocaria um
defeito por outro: 143 alunos param de ter o `pra` apagado e uma minoria passa a
receber o próprio typo de volta. **Não é decisão minha.** Enquanto não está
ligado, o módulo é **inerte** — mergear não muda produção, só para de arriscar a
perda do trabalho.

## 5. Por que fechei 0 e por que não escrevi pra aluno

**#192 segue `investigating`**: o defeito continua **inteiro em produção**. PR
aberto não é produção (regra 14). Fechar agora seria *done falso*.

**Não escrevi pro Robert** porque não há fato novo pra ele: ele foi escrito na
ronda das 00h47Z, o e-mail continua valendo, e a causa não mudou — **ganhou
prova, não mudou de conteúdo**. Escrever de novo pra dizer "continuamos
olhando" seria ruído. O **timbre** da queixa dele segue aberto e segue sendo
ouvido humano (9-D).

## 6. O resto da fila — conferido, nada mexido

| nº | estado | por quê |
|---|---|---|
| **#99** | Luciano, **177h**. Vence **02/09** | Decisão comercial do Johnny, escalada 10×. **Não re-escalei**: nada mudou no estado dele. Se 02/09 passar sem resposta, o silêncio decidiu e isso tem que estar escrito no log daquele dia. |
| **#200** | 3 alunos | **PR #132 `OPEN`, `mergedAt` nulo.** Segue `investigating`. |
| **#201** | 2 alunos | **PR #133 `OPEN`.** Os dois já foram reenviados na ronda das 23h. |
| **#202** | Vinícius | Atendimento, não defeito. Precisa de gente na Hotmart — eu não tenho esse caminho. |
| **#203** | Jussara + classe de 6 | **PR #134 `OPEN`.** Ela **já foi escrita** às 00h52Z (uid 363), com o contorno certo (gravador do navegador não passa pela medição quebrada). Conferido no Enviados. |
| #196 / #197 | `aguardando_aluno` | Não reinvestiguei, conforme a nota das duas manda. |

**Varredura de fila e falha (24h)**, `image_generations` contada separada de
`generations` de propósito:

| | |
|---|---|
| `generations` | **87 ready, 0 pending** — nada preso |
| `image_generations` | 98 ready, **3 failed** — as mesmas do #199 (Esney), já apuradas e estornadas. Nenhuma nova. |
| `studio_scenes` | 102 ready, **1 failed** — a `56bb8e82` já apurada (estorno automático conferido por `ref_type`). Nenhuma nova. |
| `voices` | **17 ready, 0 em training/uploading** — nada preso |

**Fechados que voltaram a disparar em 24h: 0.**

## 7. Regra 7 — grupo

**Não postei no grupo.** Os três gatilhos da regra são: fechei incidente, subi
fix **pra produção**, ou escrevi pra aluno. Nenhum aconteceu — **PR aberto não é
produção**, e postar PR aberto é progresso parcial, que a regra de 21/08 proíbe
justamente porque o Lucas está no grupo.

O que precisa de gente foi pro **Telegram do Johnny**, que é o canal certo pra
processo e decisão (ordem de 27/08).

## 8. Precisa do Johnny — 2 itens

1. **Decisão sobre o PR #135**, em uma linha: ligar a guarda como está e aceitar
   que ~10% das reversões desfazem typo legítimo, **ou** ligar só o bucket
   `reverte-protegida` — 310 das 451 reversões, onde estão **os 143 `pra` e os
   11 `digital`**, e onde o risco de typo é bem menor porque classe fechada
   raramente é digitada errada. **É esta segunda que eu recomendo**, e não
   executei sozinho porque muda o texto que vai pro sintetizador de todo mundo.
2. **#99 Luciano vence 02/09** — 2 dias. Segue sem decisão, 11ª vez que aparece
   num registro meu.

## 9. Passagem pra próxima ronda

1. **PR #135** esperando a decisão do item 8.1. Não mergear sem ela.
2. **#192**: o timbre continua aberto e continua sendo ouvido humano. Ritmo
   (clone 3,95 pal/s × mediana 2,55 dele) segue medido e sem cura proposta.
3. **PRs #132/#133/#134** continuam `OPEN` — enquanto não mergearem, #200,
   #201 e #203 **não podem fechar**.
4. **#99 vence 02/09.**
5. **Ponto cego do passo fixo de fim de ronda** (§1): `git log origin/main..HEAD`
   não enxerga arquivo que nunca foi commitado. Vale acrescentar
   `git status --porcelain` ao fecho da ronda — foi o que pegou este caso.
6. Classe (c) dos bounces (aluno com e-mail inexistente) e classe (b)
   (Microsoft bloqueou nosso IP) continuam sem dono, da ronda das 23h.
