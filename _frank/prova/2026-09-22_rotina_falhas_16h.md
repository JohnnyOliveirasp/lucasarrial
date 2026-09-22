# Ronda das falhas — 22/09/2026, ~15h40–16h00Z

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`).
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou
reprocessado.

**Uma linha:** peguei o `d3d8d1b2` (#15) de novo — o mais antigo com aluno
afetado — e desta vez a **causa tem nome: worker degradado**, provada por um
controle que **não depende do `setup_s`** que nunca existe no job morto. No
caminho **corrigi duas leituras erradas: uma minha, de ontem, e uma do Vigia,
de hoje** — inclusive um "a taxa subiu 25x" que eu mesmo cheguei a medir e que
**não sobrevive** à correção do instrumento.

**Cartões fechados: 0. Alunos escritos: 0 (o do #15 já fora escrito às 14:46Z).
Fix em produção: 0 (PR pedido, card `dd73891e`). Dinheiro devolvido: 0 (estorno
automático já cobria). Escritas em banco: 2 (notas do `#15` e do `#506`).
Escalada urgente ao grupo: 1 (`#506`).**

---

## 0. Passos fixos

| passo | resultado |
|---|---|
| `git pull --ff-only` na main | atualizado, sem divergência |
| **Reconciliar envios da pasta** (#101) | 1025 lidas · 948 já tinham linha · **0 dentro da janela sem linha** · 77 fora do corte · fecha 1025 = 1025 |
| `2026-09-18_enviados_x_tabela.cjs` (independente) | veredito **0 carta depois do corte** fora da tabela — buraco PASSIVO |
| `percepcao_travada.cjs` (ordem 17/09) | controle positivo OK (#310) · 508 varridos · **0 travados em percepção** · mais velho 0d |
| `varredura_travados.cjs` | 1 preso · **105 abertos** · 36 aguardando aluno · 0 fechado sem retorno |
| `2026-09-19_idade_dos_abertos.cjs` | 105 abertos · **52 com 7d+** · 2 patches · 145 recados |

Nenhum `⚠️ <tabela>:` e nenhum "consulta FALHOU" — os zeros são **medidos**.

---

## 1. Item serial: `d3d8d1b2` / #15 — causa nomeada, e duas leituras corrigidas

**Por que este:** regra 8, o mais antigo com aluno afetado (54d, `open`, 19
alunos, `last_seen` hoje 12:54:18Z). Os seguintes (#214, #216, #224…) são de
21d ou menos.

Instrumento novo, **só leitura**, commitado nesta ronda:
`_frank/ferramentas/2026-09-22_worker_degradado_15.cjs`.

### 1.1 O controle que decide, e que dispensa o `setup_s`

A pergunta travada desde 20/08 era **(A) pico de setup** × **(B) worker
degradado**. Estava travada porque `qa.setup_s` **só é persistido no SUCESSO** —
no job morto por SIGKILL o número não existe.

Contornei comparando o morto com a **faixa de tamanho** dele:

| | |
|---|---|
| `342e54a1` · 981 chars · 7 chunks | morreu com `elapsed` **644,3s** |
| faixa 7–10 chunks, **n=149 sucessos** | p50 **146s** · p95 **244s** · **MÁX 324s** |

**Morreu com 2,0× o MÁXIMO de 149 jobs comparáveis** — fora da distribuição
inteira, não na cauda dela. Isso é **(B)**. E mata a tentação de alargar o teto:
régua maior não consertaria, só adiaria — o job não estava perto de terminar,
estava rodando ~3× lento. **Não toquei em `execucao.ts`.**

### 1.2 Corrijo a MINHA nota de ontem

Escrevi em 21/09: *"running_s=1,9 significa que o worker acabara de entrar no
chunk: estava avançando até o SIGKILL. **Não é hang**."* **Errado.**

O trace ao vivo do Vigia (14:26Z) mostra o heartbeat **congelando**: 84,4s →
114,9s → **idêntico**, `visto_em` e `running_s` parados juntos. Logo o valor
final gravado é **o último escrito antes de congelar**, e não prova de avanço.
`running_s` baixo é compatível com "congelou logo depois de entrar no chunk" —
que é exatamente hang.

Em 20/08 li a fase **sem** o `running_s` e errei. Em 21/09 li o `running_s`
**sem saber do congelamento** e errei de novo, na direção oposta.

> ⚠️ A premissa errada está **no fonte**: `runpod-worker/jobs/inference.py:161`
> afirma *"running_s=4,9: avançando, não pendurada"*. Entrou no card do coder.

### 1.3 Corrijo a nota do VIGIA de hoje (item 4, "a taxa subiu muito")

**Não se sustenta.** Eu mesmo cheguei a medir **"25× acima da base"** e a conta
estava enviesada de duas maneiras:

- **(a)** usei `(elapsed - setup)/chunks`. Mas em **sucesso** `elapsed` **não**
  inclui setup (em **falha** inclui). Medido: **159 de 829** jobs ficam com
  s/chunk **negativo** nessa fórmula. Foram os negativos na tabela crua que
  denunciaram o bug.
- **(b)** s/chunk **global** favorece texto **curto**: o overhead fixo por job
  não se amortiza. Medido: p50 de **30,1** s/chunk em job de 1 chunk contra
  **14,9** em job de 11+. Os "mais lentos" que eu tinha achado eram quase todos
  textos de 1 chunk — era **tamanho**, não lentidão.

Com limiar **por faixa**: hoje **1/18 (5,6%)** contra base **5/811 (0,62%)**.
`P(ver ≥1 lento hoje se a taxa fosse a da base) = 11%` → **esperado**.
**Não há surto medido hoje.** Houve 1 morte e 1 pane curada por retry, ambas
reais, nenhuma delas evidência de aumento de taxa.

As duas armadilhas viraram **controle positivo dentro do script**: se os
negativos vierem 0, ele **aborta** em vez de imprimir número (a premissa teria
mudado).

### 1.4 O item do Vigia que SE sustenta, e é o mais importante

**Pane curada por retry é invisível**: termina `ready`, não gera incidente, não
gera estorno, não entra em contagem de falha nenhuma. Mas deixa fingerprint
**persistente**: `request_attempts > 1` num job `ready`.

Medido desde 08/09: **5 gerações** (`d6d9ba71`, `2b65b301`, `3003bfda`,
`f4a1b74d`, `9555c0d0`).

**Consequência direta:** a frase que fechou este cartão em 21/09 — *"16 dias e
1.206 gerações sem reincidência"* — foi calculada **por status**, e status
**subconta esta classe por construção**. O cartão reincidiu **25h** depois. Não
foi azar: **a régua de fechamento estava cega.**

### 1.5 Fase do hang: confirmada, duas observações independentes

`342e54a1` (morreu) → `inference.chunk.generate`, chunk 6.
`9555c0d0` (salva) → `inference.chunk.generate`, chunk 7, congelou e reiniciou.

Descartados como local do hang: **download da referência** e **whisper do QA**
(no `9555c0d0` o QA rodou depois e voou: chunks 3, 8 e 13 em ~2 min). Descartado
**texto/voz/tamanho**: o `9555c0d0` tem **2000 chars**, o dobro do morto, e saiu
em 160s na 2ª tentativa.

### 1.6 Aluno e dinheiro: conferidos

Estorno **+981** por `ref_type='generation_refund'` (**nunca por `kind`**, que
grava `extra_purchase`), 21min37s após o débito — automático, correto.
`rsirahata@gmail.com` foi avisado **na ronda anterior**: `emails_enviados`
id `24503ad6`, enviado **14:46:36Z**, `bounce_em` null — **reconferido hoje**.
`combofav@gmail.com` recebeu o áudio, não perdeu crédito, nada devido.

### 1.7 Por que continua `open`

Causa nomeada **não é** causa consertada (regra 14). Conserto candidato:
**watchdog de heartbeat congelado** — o sinal já está publicado, não depende de
telemetria nova. Card `dd73891e` pro `coder`: aborta a tentativa pendurada cedo
e deixa o retry rodar, em vez de queimar os 640s do teto. Branch `feat/` + PR,
**sem merge** (decisão do Johnny), **sem GPU**, **sem migration**.

**A condição de fechamento MUDOU:** não basta "N dias sem falha". Exige (a) o
watchdog em produção e (b) contagem que **inclua os curados por retry**. Fechar
por silêncio de status é o erro que já custou duas reaberturas.

---

## 2. Item com relógio: `#506` — repinguei, contra a decisão da ronda anterior

A ronda das 15h decidiu **não** repingar e escreveu que 23/09 era o limite.
**Repinguei assim mesmo**, por um dado que estava na saída do próprio
instrumento e que nenhuma ronda anterior citou:

> `PRAZO DA DECISÃO: 2026-09-23 é LIMITE MÁXIMO.`
> `Aja UM DIA ANTES — a leitura tem margem declarada de ±1 dia.`

O dia seguro é **hoje**. Com margem de ±1 dia, a janela dos três pode estar
fechando hoje; esperar amanhã é **apostar na margem a favor** — foi assim que o
`#207` terminou com aluno perdendo R$97.

**Re-medi, não herdei número:** 90 pedidos vazios · 24 com compra aprovada
naquele endereço · 7 já fora · **5 ainda dentro** (3 vencem **23/09**, 2 vencem
28/09). Idênticos aos de ontem e aos das 12hZ. Os **78** sem compra naquele
endereço seguem **não** contados como não-pagantes.

Mandei ao grupo pedindo **uma palavra**: "pode" (devolvo aos três) ou "não"
(registro que a janela fechou por decisão). **Não colei e-mail de aluno no
Telegram** (regra de canal); apontei para o cartão. Devolver dinheiro é **9-A,
do Johnny** — não decidi por ele.

---

## 3. O que eu NÃO fiz, e por quê

- **Não alarguei o teto** (§1.1) — e agora com medição, não com susto.
- **Não fechei nada** — regra 14: causa nomeada ≠ causa consertada.
- Não li a planilha (ordem de 29/08). Não mexi em crédito, acesso, plano,
  assinatura, voz, migration, nginx, RunPod ou GPU.
- Nenhum merge, nenhum PR mergeado, nenhum retreino disparado.
- Não tratei os 145 recados nem os 2 patches: a regra 8 é serial de propósito.

---

## 4. Para a próxima ronda

1. **`#506`: se amanhecer 23/09 sem resposta, a janela dos TRÊS fechou.**
   Registre como fato e trate como exceção (família do `#207`). **Não invente
   prazo novo.** Os dois de 28/09 ainda têm margem — não misture.
2. **`#15`: não feche por silêncio de status.** A contagem tem de somar os
   `ready` com `request_attempts > 1`. Rode
   `2026-09-22_worker_degradado_15.cjs`, que já faz isso.
3. **Ao ler `qa.fase_corrente`: o heartbeat CONGELA na pane.** `running_s` baixo
   **não** prova avanço. Leia fase + `running_s` + o fato do congelamento.
4. **`elapsed_seconds` muda de significado**: sucesso **sem** setup, falha
   **com** setup. Subtrair `setup_s` no sucesso dá negativo — 159 de 829.
5. **s/chunk só vale DENTRO da faixa de tamanho.** Comparação global inventa
   lentidão que é só texto curto. Foi assim que nasceu meu "25×" errado.
6. **Antes de dizer que um aluno não pagou, rode
   `2026-09-20_achar_compra_por_nome.cjs`.**
7. `emails_enviados` só cobre a partir de **14/09 14:06Z** — use a pasta
   Enviados para concluir "nunca escreveram".
8. As **77 cartas** anteriores ao corte seguem sem decisão (§0).
