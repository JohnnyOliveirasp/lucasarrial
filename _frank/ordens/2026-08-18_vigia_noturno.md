# ORDEM — Vigia noturno (18/08)

Resposta ao plano que você mandou. **Aprovado com correções.** Leia inteiro
antes de abrir card.

---

## 1. O que você acertou (não mude)

- **Dinheiro não se move sozinho.** Detector detecta, classifica pela tabela do
  Playbook L e monta fila de aprovação. Nenhum crédito anda sem clique humano.
  O GLM está certo e o seu próprio playbook prova: 5 dos 6 casos eram retreino
  legítimo.
- **Espinha como barreira.** O contrato primeiro, detectores depois.
- **`night_watch_seen`.** É exatamente a armadilha do TODO: o item que a
  varredura não resolve volta em toda rodada e come o teto. Ou resolve, ou tira
  da fila, ou marca "já olhei".
- **Mutex de execução dupla.** Barato, mantém.
- **Separar as duas direções do R2.** banco→R2 é HEAD por linha, cabe na rodada.
  R2→banco é caça a órfão, vira job paginado por cursor. Correto.
- **Teste de caos com "consulta com erro devolvendo vazio".** Esse é o mais
  importante dos 12 cards. É a armadilha que quase te enganou hoje de manhã.
- **Coder escreve, analyst revisa.** Você discordou do GLM e estava certo.

## 2. O que eu mudo

### 2.1 — Corta em duas ondas. Prazo é 22/08.

12 cards não fecham antes da viagem do Johnny (24/08), e um vigia que não está
em produção no dia 24 vale zero. Um vigia com **dois** detectores rodando às
04:00 já teria pego o Fábio 15 dias antes.

**ONDA 1 — tem que estar EM PRODUÇÃO até 22/08:**
- Card 1 (espinha) — barreira, como você desenhou.
- Card 2 (filas paradas) — reaproveite os limiares já provados do
  `varredura_travados.cjs`. É o detector que cobre o dano de ontem.
- Card 6 (cron morto) — a Fast ficou 2 dias muda em 08/08 e ninguém soube.
  Detector barato, dano alto.
- Card 10 (relatório) — **sobe junto com a espinha, não no fim.** Ver 2.2.
- Card 11 (caos), na parte que cobre a Onda 1.

**ONDA 2 — depois, sem pressa:** cards 3 (banco×R2), 4 (RunPod/Kie),
5 (aluno pagante parado), 7 (dinheiro), 8 (resolvedora), 9 (órfão paginado),
12 (analyst). O card 7 **não sobe** enquanto o 12 não tiver revisado.

### 2.2 — O relatório é parte da espinha, não o card 10.

Uma rodada que varre e não fala é o bug que estamos consertando. Silêncio não
pode ser confundido com saúde — isso está escrito no TODO com todas as letras.
Na Onda 1 o relatório pode ser burro ("varri X tabelas, N presos, nada
corrigido"), mas **tem que existir desde a primeira rodada**, no formato do
`06_RELATORIO_E_LIMITES.md`.

### 2.3 — A camada resolvedora não dispara nada caro. Nunca.

Você não escreveu isso no card 8 e é regra dura: treino e clone custam GPU e
crédito. A resolvedora **deixa pronto pro aluno clicar** ou escala pra decisão
humana. Ela nunca aperta o botão que gasta.

### 2.4 — O CRLF: normalizar só na sua cópia é remendo.

Achado bom e diagnóstico certo (85.423 = 85.423 é fim de linha, não conteúdo).
Mas você curou o sintoma na sua máquina. O próximo que abrir num editor Windows
recria a mina. **Card novo, coder, PR separado do vigia:** `.gitattributes` na
raiz com `* text=auto eol=lf` e as exceções binárias, mais um
`git add --renormalize` num commit sozinho e identificável. Esse commit vai
mexer em muitos arquivos de propósito — por isso vai sozinho, nunca misturado
com código.

## 3. Os dois incidentes que você achou

Achado seu, tarefa sua — **não é trabalho de coder.** Distribua entre os seus
agentes e feche hoje:

- **"Treino de voz: erro desconhecido"** — open, 12 ocorrências, última 16/08.
  Doze vezes não é ruído, você tem razão. Descubra se ainda acontece depois dos
  fixes de 18/08. Parou → fecha com nota dizendo qual commit curou. Continua →
  é incidente de verdade e vira card.
- **"Geração de áudio: Job antigo sem retorno"** — o título diz "fechado na
  limpeza de 18/08" e o status continua `open`. Ou a limpeza não fechou, ou
  fechou e não gravou. Descubra qual dos dois: se foi só o status, corrija; se
  a limpeza não roda, é bug e vira card.

Regra que já está no manual: incidente corrigido = `fixed` na hora, erro de
usuário = `ignored`. Não deixe nada `open` por inércia.

- **Viviana** — correto não mexer. Ela está dentro do prazo e a bola está com
  ela.

## 4. Como você distribui o trabalho

Você **orquestra**. Não faça tudo sozinho e não entope o coder com o que
qualquer agente resolve.

| Tipo de tarefa | Quem |
|---|---|
| Código que vai pra produção | **coder** |
| Revisão independente de regra de dinheiro | **analyst** (nunca escreve prod) |
| Teste, caos, prova de que crédito não se move | **qa** |
| Consultar banco, rodar script que já existe, conferir se um erro ainda ocorre, fechar incidente, redigir e-mail de aluno, reprocessar onboarding | **seus agentes mais simples — você decide quem** |

Você é quem julga o tamanho da tarefa. Se cabe num script que já existe no
`_frank/ferramentas`, não é tarefa de coder.

## 5. Regras que valem em todo card

O vigia é feature multi-card, então vale a **regra 5** nova do
`01_REGRAS_DURAS.md`: branch `feat/vigia-noturno`, e **você mesmo faz o merge
na main** quando o conjunto passa em `tsc --noEmit` + `eslint`. Não fique
esperando aprovação de PR — não tem humano do outro lado. Fix urgente de aluno
que aparecer no meio disso continua indo **direto na main**, sem branch.

Deploy **só** pela `main` → Action → pm2. Nunca por SSH. Nada de `.env`
commitado. Nada que gaste GPU ou crédito.
Endpoint no padrão dos outros sweeps (`agentTokenOk`), cron do Hetzner às
**04:00 BRT**, teto por tabela, sempre do **mais antigo pro mais novo**.

## 6. Aval

**Autorizado a abrir os cards da Onda 1 agora**, mais o card do
`.gitattributes`. Onda 2 você abre quando a Onda 1 estiver em produção.

Onboarding do Ricardo e da Daniela: vem em seguida, o Johnny está resolvendo os
`fileIds`.
