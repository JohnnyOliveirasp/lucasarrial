# Ronda das falhas — 04/09/2026 ~19:40–20:10Z (Frank, dono da fila)

Fila no início: **9 incidentes abertos**, 14 aguardando aluno, 4 itens presos.
Método serial (regra 8, ordem de 21/08): peguei **UM** item e levei até onde a
minha alçada alcança.

## Qual peguei e por quê

Ordenei os 9 abertos por `created_at` (não por `last_seen_at`, que é o que a
varredura mostra e teria me feito escolher errado). O mais antigo com aluno
afetado é o **#222** (`3ca22d47`, 01/09 15:54, 5 alunos).

## O que encontrei no #222 (e por que não fechei)

O defeito ORIGINAL — aluno preso fora da própria conta — **está endereçado**:
nenhum dos 5 está sem acesso hoje. Isso já tinha sido confirmado por 3 rondas
independentes (Frank 01hZ, Vigia 14hZ, Vigia 16hZ) e eu não gastei o turno
remedindo o que já foi medido três vezes.

A **causa** em `claim.ts:39` continua sem ser tocada — 7ª vez que a classe é
drenada no varejo. Por isso **segue `investigating`**. Não marquei `fixed`:
caso resolvido não é causa resolvida (regra 14).

As rondas anteriores já mediram e **descartaram** as duas chaves óbvias — não
refazer: e-mail exato **0 de 42**, e-mail normalizado (ponto/+sufixo) **0 de
42**, CPF **2 de 42** e ainda com 9 casos que casariam com mais de uma conta
(dinheiro na conta errada). Essa população simplesmente **não tem conta pra
casar**; o único caminho que atua onde a conta passa a existir é confirmação no
cadastro.

## O que eu decidi (estava parado há 2 rondas esperando "o dono")

O Vigia marcou **duas vezes** (14:15Z e 16:19Z) um risco de instrumento e
disse, corretamente, que mudar o escopo do chamado dos outros não era alçada
dele: a investigação de **cobrança em dobro** foi gravada dentro do #222, mas
`affected_emails` do #222 é outro conjunto e **não contém o Solon** — que é o
único item com **data**. Quem trabalhasse o card pela lista de e-mails não o
enxergava. Ele ficou **2 rondas invisível com o relógio correndo**.

A decisão era minha (regra 14-A: o Vigia abre e anota, eu decido). **Separei**
em card próprio — **#254** (`f1ada07e`) — em vez de só acrescentar e-mail,
porque o defeito também é outro: #222 é *"aluno preso fora da conta"*, #254 é
*"aluno pagando duas vezes"*. Empilhar as duas classes no mesmo card foi
exatamente o que produziu a invisibilidade.

A ligação causal entre os dois está registrada: em **4 de 4** casos a
assinatura órfã vem **antes** da recompra (Jackson 5min, Carlos 23min, Gabriela
24min, Boanerges 17h). O #222 faz o aluno **comprar de novo** pra conseguir
entrar. A cobrança em dobro é a consequência financeira do #222.

## O urgente — Solon Andrade (reconferido na fonte, não herdado)

| | conta |
|---|---|
| `lscontabilidade813@gmail.com` (IJA1SHDQ, até 13/09) | **a real** — voz "Solon - SGP" ready, 2 gerações, 3 imagens, 88.025 cr |
| `solonandrade03@gmail.com` (POTX6UYJ, até **06/09**) | **a duplicada** — 0 voz, 0 geração, 0 gasto, 200.000 cr intocados |

Dinheiro conferido na **Hotmart viva**, não só no nosso banco:
`HP3690808585` 97 BRL COMPLETE 13/08 14:44 e `HP3797964181` 97 BRL COMPLETE
13/08 22:13 — transações **diferentes**, 7h30 de intervalo → **R$194 reais em
dobro**. Corroborado por caminho independente: os dois `subscription_grant` de
+100.000 caem exatamente 14:44 e 22:13.

**Prazo: 06/09 12:00Z.** Eram 40,3h quando medi (a ronda anterior tinha
registrado 43,7h — reconferi em vez de repetir o número).

### Armadilha nova, medida hoje

O ensaio do `cancelar_assinatura.cjs` mostra POTX6UYJ como **`trial: true` /
"Plano Founder"** na Hotmart. Isso **não** significa que não houve pagamento: a
rec#1 foi R$0 (06/08) e a **rec#2 cobrou R$97** (13/08). Quem olhar só a flag
`trial` conclui que não há dano e arquiva o caso. Registrado no #254.

## O que fiz, só fato consumado

1. **Criei o #254** (`f1ada07e`), `payments`/`bug`, com os 5 alunos, o método
   que vale e o que já foi descartado — pra próxima ronda não redescobrir.
2. **Pedi o "pode" do Johnny no grupo** (~20hZ) com a data do 06/09 na frente.
3. **Escrevi pro Solon** — enviado, **cópia confirmada em Enviados uid 1024**.
   Conferi antes que ele **nunca** tinha sido contatado (`--enviados` nos dois
   e-mails = nada). Ele foi cobrado R$194 em dobro e estava a 40h do 3º R$97
   **sem ninguém ter dito uma palavra**. Não era aviso repetido; era silêncio.
   Pedi que confirme qual conta fica. **Não** prometi valor de estorno, **não**
   prometi data, **não** disse que já cancelei.
4. **Anotei o #222** com a separação e o porquê.

## O que NÃO fiz, de propósito

**Não cancelei, não estornei, não mexi em crédito de ninguém.** Cancelar e
estornar são ação de dinheiro e para o mundo externo — exigem o "pode" do
Johnny. Medir quem/quanto/quando é minha alçada; executar não é.

O cancelamento do POTX6UYJ depende de **duas** confirmações que agora correm
**em paralelo** dentro da mesma janela de 40h: o "pode" do Johnny e o ok do
Solon. Nenhuma das duas é minha pra dar. Foi por isso que disparei as duas na
mesma ronda em vez de esperar uma pra começar a outra.

**lucila blanco continua não decidida, de propósito**: as duas contas dela estão
zeradas, uso não desempata, e não se escolhe no chute qual conta da aluna morre.
Tem que ser perguntada a ela.

## Pendências que encontrei no repo (não são minhas, não commitei)

Havia trabalho **não commitado** de outra ronda na árvore, e eu não commito
código de terceiro que não revisei:

- `_frank/prova/cauda_decepada.jsonl` — 8 linhas de medição novas (04/09 17–18h),
  evidência do **#234** (palavra decapitada).
- `_frank/ferramentas/medir_palavra_decepada.cjs`, `medir_palavras_faltantes.cjs`,
  `ouvir_audio_gemini.cjs` — ferramentas novas, sem linha no README das ferramentas.
- `frontend/qa-users.mjs` — helper de QA do PR do botão "Alterar senha" (#243/#244).

Fica marcado pra quem é dono desses: **trabalho não commitado é mais invisível
que trabalho em branch `feat/`.**

## Fila no fim

10 abertos (9 + o #254 que eu criei ao separar). O número subiu porque um item
que estava **escondido dentro de outro card** virou visível — não porque entrou
defeito novo.
