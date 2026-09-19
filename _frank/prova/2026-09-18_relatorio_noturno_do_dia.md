# 18/09 ~01hZ(19/09) — Relatório noturno do DIA 18/09

Mensagem postada **no grupo** (ordem de canal de 31/08). Todos os números desta
página foram **remedidos nesta ronda**, com o instrumento nomeado. Nada copiado
de relatório anterior — quando um número veio de outra ronda e eu **não**
reconferi, está dito com todas as letras (§5).

## 1. Medições desta ronda (com instrumento e comparação com ontem)

| medida | hoje | ontem | instrumento |
|---|---|---|---|
| itens presos | **0** | 0 | `varredura_travados.cjs` |
| chamados abertos | **91** (1 `open` + 90 `investigating`) | 92 | idem + SQL |
| aguardando aluno | **34**, **12 com 7d+**, mais velho **21d** | 32 / 12 / 20d | idem |
| pagante trancado | **0** · 1 sem prova (`drfabiovilhena29@`) | 0 · 1 sem prova | `pagante_trancado.cjs` |
| fila de recados (`para_frank_%`) | **107**, mais velho **03/09 22:24Z (~15d)** | 96 / 339h | SQL |
| patches do Vigia esperando | **0** | — | SQL `agent_state like 'patch\_%'` |
| fechado sem retorno humano | 1 (#407, Luciano, **85h**) | 1 (#407) | `varredura_travados.cjs` |
| lista de estorno | em dia, 10 tipos, **3.420** linhas | 3.386 | idem |
| **chamados FECHADOS hoje** | **13** | — | SQL `resolved_at >= 18/09 04hZ` |
| PRs abertos | **34** (1 draft), **8 nascidos hoje** | — | `gh pr list --state open --limit 200` |

### 1-A. Os 13 fechados, com hora (fonte: `incidents.resolved_at`, todos `by frank`)

| # | hora (Z) | o que era |
|---|---|---|
| #74 | 11:48:26 | upload de foto não entrava na geração (aberto desde 19/08) |
| #52 | 12:48:08 | áudio gerado com chunk alucinado |
| #465 | 13:38:45 | treino de voz: `[Errno 28] No space left on device` |
| #101 | 15:10:14 | não sabíamos se nosso e-mail chega no aluno |
| #466 | 15:37:48 | treino de voz: System error |
| #467 | 15:40:22 | aluno comprou clone e estava sem acesso |
| #468 | 16:03:16 | disco cheio no worker de treino voltou (4 falhas) |
| #449 | 16:45:18 | aluno enviou áudios e ficou esperando |
| #453 | 16:45:18 | gravou +20 min no Gravador (cobrança) |
| #454 | 16:45:19 | gravou +20 min no Gravador (crédito) |
| #330 | 16:46:12 | caso Welrisson |
| #471 | 17:26:57 | nenhuma tela do repo era verificável em navegador |
| #448 | 21:44:07 | Janice Silva — voz pronta, 10.000 cr devolvidos |

## 2. Deploy provado pelas 3 provas da regra 5-B

Comecei pelo `git fetch` (lição de ontem: o clone local estava 5 PRs atrás e eu
quase relatei "nada subiu"). Hoje o clone local estava **muito** atrás — 37
commits entraram em `origin/main` no dia.

| prova | valor |
|---|---|
| `BUILD_ID` no servidor | `mgz4wq5yx6xt1mrkT4j9_`, mtime **18/09 20:13:31Z** |
| último merge de código | `11aeebf9` (#344) às **20:11:43Z** — **108 s** antes do build |
| pm2 `aiverse` | `online`, uptime 53 min na hora da medição (01:05Z) |
| md5 fonte servidor × `origin/main` | `retiradas-calc.ts` → `8cf901bb…` **idêntico** · `admin/retiradas/route.ts` → `92e089f3…` **idêntico** |

PRs no ar hoje: `11aeebf9` (#344 retiradas só pros três sócios, pedido do Johnny
hoje) · `c6b0cfb4` (#335 trainer/disco cheio) · `f4c0824e`+`fcf938ca` (#339/#101
reconciliar envios da pasta) · `9d157083` (#337 prova de infra em
`error_message`).

## 3. As 4 perguntas binárias que foram pro grupo

1. **Janela de merge** — 34 PRs parados, dois deles (#346 link de acesso, #347
   detector de disco) consertam classes que machucaram aluno **hoje**. Pedida às
   18h por três rondas seguidas; **7h sem resposta** quando escrevi.
2. **#469 — 10.000 cr criados do nada.** Medido por mim nesta ronda, não herdado:
   `credit_transactions` da voz `600173a6-…` tem **1 débito de −10.000**
   (14:43:26Z) e **DOIS estornos de +10.000** (14:44:28Z e 15:31:18Z). Tirar do
   aluno não é decisão minha.
3. **#341 — 168.400 cr para 16 compradores** do SGP debitados pelo material que a
   casa entrega. Acima do teto da regra 9-B, **esperando o Johnny desde
   10/09 — 8 dias**.
4. **Walsicleia** (`walsicleia_kaka@`) — pagante, `last_sign_in_at` **NULL** há
   14,4 dias, 4 links mandados, **zero consumidos** (`recovery_token` intacto,
   não-`pkce_`). E-mail já se provou insuficiente: autorizar telefone/WhatsApp.

## 4. O que PIOROU, dito como piora

- **Fila de recados interna subiu de 96 → 107** e o mais velho já tem **15 dias**
  (03/09 22:24Z). Ninguém está drenando isso, e ela é justamente a garantia de
  que recado de robô não se perde.
- **#11 fechou 16:03Z e REABRIU sozinho 22:40Z.** Não está resolvido. A aluna se
  destravou **em 59 min por conta própria** — dinheiro 1:1, não estornar de novo.
- **Aguardando aluno subiu de 32 → 34**, com os mesmos 12 parados há 7d+.

## 5. Correções e limites desta ronda — o que eu NÃO provei

**Correção que eu devo à ronda das 22h:** ela escreveu "12 PRs abertos" e depois
"o mais velho é o #42 (24/08, 25 dias)". Medido agora com
`gh pr list --state open --limit 200`: são **34 abertos**, e os mais velhos são
**#9 e #11, ambos de 19/08 — 30 dias**. O #42 é o terceiro grupo, não o primeiro.

**Número que NÃO reconferi e por isso não virou pedido de dinheiro:** a ronda das
22h mediu **27 alunos do SGP cobrados em 270.000 cr**. Tentei reproduzir com uma
consulta ampla (`training`, `-10000`, sem estorno) e ela devolve **1.236 débitos
/ 12.360.000 cr** — ou seja, minha consulta **não isola a coorte do SGP** e não
serve de confirmação. Fica registrado como medição **dela**, e eu reconfiro
amanhã com o filtro de origem antes de pedir aprovação de estorno.

**Instrumento que caiu no meio da ronda:** o `delegate-cli.js` da frota falhou com
`DB_ENCRYPTION_KEY is missing or too short` — a delegação da leitura dos 25 logs
do dia morreu e eu fiz a extração por outro caminho. Não afeta os números acima
(todos vieram de SQL/`gh`/ssh medidos por mim), mas a frota de operários está
fora do ar e isso é conserto pra amanhã.

## 6. Lição desta ronda

**Relatório é onde as contas dos outros são conferidas, não repetidas.** Dois
números que chegaram prontos das rondas do dia estavam errados ou não eram
reproduzíveis: o "12 PRs" (era 34) e o "#11 fechado" (reabriu 6h depois, o banco
diz `investigating`). Os dois teriam passado se eu tivesse confiado no log em vez
de medir. O custo de medir de novo é um minuto de SQL; o custo de não medir é o
Johnny decidir em cima de número falso.
