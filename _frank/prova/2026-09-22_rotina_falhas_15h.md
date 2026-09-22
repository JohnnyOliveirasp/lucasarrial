# Ronda das falhas — 22/09/2026, ~14h40–15h30Z

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`).
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou
reprocessado.

**Uma linha:** o item serial foi o **`d3d8d1b2` (#15, 54d, o mais antigo com
aluno afetado)**, que eu tinha fechado ontem 11:46Z com "16 dias limpos" e que
**reincidiu 25h depois** — e a leitura que eu deixei escrita na nota de
fechamento **estava errada**: eu li o nome da fase e ignorei o `running_s`, que
é o campo que separa hang de avanço.

**Cartões fechados: 0. Alunos escritos: 1. Fix em produção: 0 (PR pedido).
Dinheiro devolvido: 0 (o estorno automático já tinha coberto). Escritas em
banco: 1 (nota do `d3d8d1b2`).**

---

## 0. Passos fixos

| passo | resultado |
|---|---|
| `git pull --ff-only` na main | atualizado, sem divergência |
| **Reconciliar envios da pasta** (#101) | 1017 lidas · 940 já tinham linha · **0 dentro da janela sem linha** · 77 fora do corte (decisão pendente, não é defeito) · contagem fecha 1017 = 1017 |
| `2026-09-18_enviados_x_tabela.cjs` (instrumento independente) | veredito **0 carta depois do corte** fora da tabela — buraco PASSIVO |
| `percepcao_travada.cjs` (ordem 17/09) | controle positivo OK (#310) · 508 varridos · **0 cards travados em percepção** |
| `varredura_travados.cjs` | 1 preso (escrituração) · **104 abertos** · 36 aguardando aluno · 0 fechado sem retorno · lista de estorno em dia |
| `2026-09-19_idade_dos_abertos.cjs` | 104 abertos · **51 com 7d+** · 2 patches · 145 recados |

Nenhum `⚠️ <tabela>:` e nenhum "consulta FALHOU" — os zeros são **medidos**.
(Dois scripts meus morreram em `column profiles.full_name does not exist` e
`column credit_transactions.description does not exist`: é o comportamento
certo, recusaram imprimir zero de instrumento cego.)

---

## 1. Item serial: `d3d8d1b2` / #15 — reincidiu em 25h, e eu tinha lido errado

**Por que este:** regra 8, o mais antigo com aluno afetado. 54d, `open`,
`last_seen` **hoje 12:54:18Z**. Os dois mais velhos seguintes (#172, #206) estão
em `aguardando_aluno` — bola com o aluno, fora do meu colo.

Instrumento novo, só leitura:
`_frank/ferramentas/2026-09-22_reincidencia_do_teto.cjs`.

### 1.1 O erro que eu mesmo deixei escrito ontem

A nota de fechamento de 21/09 diz: *"na amostra que capturou, pendura na
GERAÇÃO do chunk"*. Isso lê o **nome** da fase e ignora o `running_s`. Os dois
samples dizem o **oposto**:

| geração | fase | running_s |
|---|---|---|
| `a07e9278` (04/09) | `inference.chunk.generate` | **4,9s** |
| `342e54a1` (22/09) | `inference.chunk.generate` | **1,9s** (chunk 6, regens 0) |

O heartbeat bate a cada ~30s. Se o job estivesse **pendurado** num chunk, o
`running_s` do último tick seria **grande** (30, 60, 90...). 1,9s significa que
o worker **acabara de entrar** no chunk: estava avançando até o SIGKILL.
**Não é hang.** O comentário em `runpod-worker/jobs/inference.py:161` já dizia
isso certo ("avançando, não pendurada") — foi a nota do cartão que leu errado.

### 1.2 A conta do teto fecha exata

981 chars → `ceil(981/160)` = 7 chunks → `max(480, 360 + 7×40)` = **640s**
(`lib/generations/execucao.ts`). Morreu com `elapsed_seconds` = **644,3s**.
Bateu no teto, não num travamento.

### 1.3 O controle que mata "é o texto / a voz / a conta"

Mesmo aluno, mesma voz (`c8ba6ae8` "Minha Voz"):

| dia | geração | chars | resultado |
|---|---|---|---|
| 16/09 | `e1f9ad33` | **1.002** | READY em **91,9s** |
| 20/09 | `e97fe273` | 885 | READY em 101,5s |
| 22/09 | `342e54a1` | 981 | **MORTO em 644,3s**, no chunk 6 de 7 |

Texto **maior** saiu em 92s seis dias antes. (Armadilha já catalogada:
`elapsed_seconds` significa coisas diferentes em sucesso — sem setup — e em
falha — com setup. Mesmo somando o p95 de setup, 94,2s, os sucessos ficam em
~190s contra 644s. A conclusão não muda.)

### 1.4 O bloqueio real: duas causas opostas e nenhum jeito de separar

- **(A) pico de setup** comendo a base do teto — causa já nomeada em 10/09. Se
  o setup levou ~400s, sobraram ~240s para 6 chunks = 40s/chunk, exatamente o
  orçamento. Nada novo.
- **(B) worker degradado** — se o setup foi o típico (p50 73,7s), 6 chunks
  levaram ~569s = **~95s/chunk**, contra um p95 medido de 34,4s/chunk. Causa
  **nova**, e não é régua: é o worker rodando ~3× lento.

**`qa.setup_s` só é persistido no SUCESSO.** Num job morto por SIGKILL, o único
número de que a régua depende não existe. Não escolhi entre (A) e (B) no
escuro — este cartão já nomeou causa errada duas vezes.

### 1.5 Por que eu NÃO alarguei a régua

O topo de `execucao.ts` diz, em letras próprias: *"se a cauda andar de novo, a
resposta provavelmente não é régua maior"* e *"decida com dado, não com susto"*.
Alargar hoje seria o **4º ciclo** de esticar o teto, e a régua também protege o
aluno de worker pendurado (o piso de 30 min da era antiga segurava gente 1.812s
por um texto de 78 chars). **Nenhuma linha de `execucao.ts` foi tocada.**

### 1.6 O que virou conserto (card `coder`, telemetria pura)

O worker já calcula `self.setup_s` e `self.t0`; o heartbeat já tem carona para
contadores acumulados (`_STATS_NO_HEARTBEAT` em `worker_log.py`). Faltam
`setup_s` e `since_t0_s` nessa carona. Com eles, **a próxima morte responde (A)
vs (B) na própria row**, sem esperar os "dias de observação" que a ordem de
20/08 pedia e que nunca aconteceram. Sem migration, sem tocar na régua.

### 1.7 Aluno: coberto, e avisado por mim

`rsirahata@gmail.com` (Rodrigo Andrade Sirahata, plano pro).
Débito **-981 às 12:54:18Z**, estorno **+981 às 13:15:55Z** (21min37s),
conferido por `ref_type='generation_refund'` — **nunca por kind**, que grava
`extra_purchase`. Saldo 86.043.

Ele **não tinha sido avisado**: 9 cartas na pasta remota "Sent", nenhuma sobre
esta falha (a última é de 11/09). Escrevi hoje — chave
`d3d8d1b2-timeout-rodrigo-2209`, bcc suporte@, **cópia CONFIRMADA uid 3186**.
A carta diz explicitamente que o texto dele **não** é o problema, com o
controle do dia 16/09. **Não repeti o erro da carta da `debbie994`**, que
culpou o tamanho do texto contra a medição do próprio cartão.

### 1.8 O defeito de processo segue vivo: o aviso é MANUAL e já falhou 2 de 3

04/09: `debbie994` avisada, `renanjuste` **não**. 22/09: `rsirahata` **não**,
até eu chegar 2h depois. Enquanto for manual, o aluno descobre sozinho.

**Não fechei.** Fica `open`. Condição para fechar: causa nomeada com o
`setup_s` de uma morte real — não com a ausência de mortes.

---

## 2. O que eu NÃO fiz, e por quê

- **Não alarguei o teto** (§1.5). Não toquei em `RESERVA_SETUP_S` nem em
  `SEGUNDOS_POR_CHUNK`.
- **Não marquei fixed** — regra 14: a causa não tem nome.
- Não li a planilha (ordem de 29/08).
- Não mexi em crédito, acesso, plano, assinatura, voz, migration, nginx, RunPod
  ou GPU. Nenhum merge, nenhum PR mergeado, nenhum retreino disparado.
- Não repinguei o `#506` (a cobrança única saiu 12:05Z; ver §3).
- Não tratei os 145 recados nem os 2 patches: a regra 8 é serial de propósito.

---

## 3. O item com relógio: `#506`

Os 3 que vencem **23/09** (jununes42, joaov.cestaro,
fastcloner@americanshowerglass) continuam sem o "pode" do Johnny. A ronda das
14h já cobrou 12:05Z e decidiu não repingar; mantive a decisão — repingar 3h
depois queima o canal e não acelera quem está na estrada.

⚠️ **Para a próxima ronda: 23/09 é o LIMITE MÁXIMO.** Se amanhecer sem
resposta, **registre que a janela fechou** e vire caso de exceção (família do
`#207`). Não invente um prazo novo.

---

## 4. Para a próxima ronda

1. **`#506` vence amanhã.** Ver §3.
2. **`d3d8d1b2`**: quando o PR do `setup_s` estiver em produção, a **próxima**
   morte por timeout decide (A) vs (B). Leia `qa.fase_corrente.meta.setup_s`
   **antes** de qualquer hipótese. E não feche este cartão por ausência de
   mortes de novo — foi isso que me fez errar duas vezes seguidas.
3. **Ao ler `qa.fase_corrente`, leia o `running_s` junto do nome da fase.**
   Fase sozinha não distingue hang de avanço. Custou-me uma nota errada.
4. **O aviso da classe de timeout é manual e falha ~2/3 das vezes.** Ninguém é
   dono disso ainda. Vale um cartão próprio se reincidir mais uma vez.
5. **Antes de dizer a QUALQUER aluno que ele não pagou, rode
   `2026-09-20_achar_compra_por_nome.cjs`** (lição da ronda das 14h, #206).
6. **Não remonte o detector de "pagante trancado" por `access_until`** (ronda
   das 13h). Quatro vezes bastou.
7. `emails_enviados` só cobre a partir de **14/09 14:06Z** — nunca conclua
   "nunca escreveram pra este aluno" só com ela; use a pasta Enviados.
8. `sweep-clones` continua fora da varredura por bloqueio do guard.
