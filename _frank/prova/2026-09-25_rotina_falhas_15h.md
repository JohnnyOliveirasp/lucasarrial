# Ronda das falhas — 25/09, ~14:41–15:0xZ (Frank, dono da fila)

**Item serial (regra 8):** o **#404** (`7405e5aa`) — *"O teto de execução do Vídeo
Clone começou a derrubar aluno hoje e nunca antes"*, parado **11d** em
`investigating`, 6 alunos nomeados. **NÃO fechado** — e o motivo está no item 5.

**O que entreguei:** a revisão que o próprio commit do conserto (`03adea8`)
marcou para **~22/09** e que ninguém fez. Estava **3 dias vencida**. Fiz com 7
dias a mais de dado, respondi a pergunta de calibragem que estava parada como
*"precisa de humano"*, e conferi o dinheiro e o produto das 8 vítimas, uma a uma.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1290 lidas · 1213 já tinham linha · **0 escrituráveis**. Fecha **1290 = 1290**. |
| `2026-09-18_enviados_x_tabela.cjs` (irmão de leitura) | Veredito: **0 carta depois do corte** fora da tabela. Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0 cartões** travados em percepção · mais velho **0d**. Controles ± OK, **559** varridos. |
| `2026-09-24_escolher_o_abandonado.cjs` | **164 abertos** (open 14 · investigating 114 · aguardando_aluno 36) · 152 com aluno nomeado. |
| `2026-09-22_esperando_johnny.cjs` | **18 cartões** parados em decisão dele · **53 alunos** · mais velho **24d**. |

As **77 cartas** anteriores a 14/09 14:06:31Z seguem **sem decisão** (é o que o
`--corte` exclui) — continua decisão de produção, não de ronda.

### Por que não peguei o que o instrumento escolheu (4ª ronda seguida)

O `escolher_o_abandonado` apontou o **#380** pela **quarta** vez. Abri e confirmei
o descarte em vez de repetir de cabeça: o Ricardo foi respondido por carta
(uid 2163), a nota fecha com *"a próxima ação é dele"*, e a ordem de 21/08 diz em
letra que **esperar resposta de aluno não é estar travado**.

O segundo da lista, **#398** (`88b0e5a3`, welrisson), também está
`aguardando_aluno` com a bola do aluno — **mas o conteúdo dele é de classe**, e
foi por ali que cheguei ao **#404**, que é o cartão de classe de verdade:
`investigating` (a casa deve o passo), 11 dias, 6 alunos.

> O limite do instrumento, agora com quatro rondas de evidência: ele ordena por
> idade da última nota e **não distingue "ninguém olhou" de "a bola está com o
> aluno"**. Quem seguir o ranking sem abrir o cartão reescreve a mesma nota toda
> ronda — e, pior, **não chega no cartão de classe que está atrás do individual**.

---

## 2. O item serial: o #404

### 2.1 O conserto está mesmo em produção — conferido por conteúdo, não por run

`git cat-file` no sha **deployado** (`1a8fad41`, deploy SUCCESS 25/09 01:51:34Z):
`CLONE_FIXED_OVERHEAD_SECONDS = 40 * 60` (linha 118) e o retorno
`(FIXED + billed * perAudioSecond) * 1000` (linha 144). `03adea8e` é **ancestral**
desse sha.

Régua do #400 aplicada de propósito: **deploy se confere por ancestralidade +
conteúdo do sha deployado**, nunca pela conclusão do run daquele commit.

### 2.2 Uso do teto, três janelas

Só `480p-v2`/`480p-v3`, só jobs com `elapsed` gravado, teto recalculado com a
régua vigente de cada job (1200s até 15/09 20:45:28Z, 2400s depois):

| janela | n | mortes | uso médio | uso máx | ≥85% | ≥90% |
|---|---|---|---|---|---|---|
| A · 15–19/09 (antes do degrau) | 155 | **1** | 34,2% | **100,2%** | 7 | 5 |
| B · 19–21/09 (a nota de 21/09) | 87 | 0 | 19,6% | 52,1% | 0 | 0 |
| **C · 22–25/09 (DADO NOVO)** | **179** | **0** | 27,6% | 83,3% | **0** | **0** |

### 2.3 O degrau não explicado recuou em parte — e a calma não dependia só dele

A nota de 21/09 registrou uma melhora abrupta **sem causa nomeada** e avisou:
*"melhora que eu não sei nomear pode voltar atrás sem aviso"*. **Voltou em
parte**: uso médio subiu de 19,6% (B) para 27,6% (C). Mesmo assim C não teve
**nenhum** job ≥85%.

Ou seja: o piso de segurança de hoje **não é emprestado inteiro** daquela
melhora. Mas a causa dela **segue sem nome**, e isso não mudou nesta ronda.

### 2.4 A faixa que matou foi exercitada e aguentou

80–90s de áudio em C: **n=18, máx 83,3%, 0 morte, 0 job ≥85%**. Não é ausência de
tentativa.

### 2.5 A hipótese de concorrência sobreviveu a uma segunda janela independente

`corr(jobs simultâneos, uso do teto)` = **0,456** até 21/09 e **0,351** em C.
Positiva nas duas. O `elapsed` que o `executionTimeout` mede **inclui
espera/contenção**, não só compute — calibrar só contra duração de áudio erra de
novo no próximo pico.

**Mas o pico que matou não se repetiu, e por isso C não prova segurança.** A
única morte do teto novo (`c4af003d`) rodou com **8 simultâneos**. Em C o pico foi
**7**; 8 nunca aconteceu.

Contraste que mede o conserto: o pior job de alta concorrência em C
(`10f40e9b`, 25/09 12:42, 6 simultâneos, áudio 62,69s) usou **63,3%** do teto
novo. Esses mesmos **2715s** sob o teto **antigo** (1200 + 63×30 = 3090s) seriam
**87,9%** — quase-morte. A subida de 20 → 40min **está fazendo trabalho visível**.

### 2.6 Dinheiro e produto das 8 vítimas: inteiros, um a um

Estorno conferido por `ref_type='video_clone_refund'` casado por `ref_id`,
**nunca por kind** — as 7 linhas gravam `kind='extra_purchase'`, e quem filtrar
por `kind` conclui que ninguém foi estornado e **paga em dobro**. Exatamente **1
estorno por job**, zero pagamento duplo. E **todos receberam vídeo depois**.

O que fecha a leitura da variância: **3 vítimas repetiram com o MESMO áudio e deu
certo.**

| aluno | morreu | voltou pronto, mesmo áudio |
|---|---|---|
| utaiaguia | `c4af003d` 18/09 18:38 (88,53s) | `773f9dc0` 18/09 20:12 |
| nettosl | `b69471fe` 15/09 18:44 (14,85s) | `fbe41ee1` 15/09 19:15 |
| wendell | `999fa01a` 15/09 03:24 (57,36s) | `9a04d407` 15/09 09:44 |

Mesma entrada, desfecho oposto. **A variância não está no que o aluno manda.**

### 2.7 Alarme falso que eu persegui e matei

O extrato tem um `video_clone_refund` em **21/09 20:45:56Z**, *depois* do
*"último estorno 18/09 20:14Z"* que a nota de 21/09 cravou. Parecia morte
escondida por linha apagada.

**Não é morte de teto:** o `ref_id` `f028733d` é job de **01/09 15:00Z**, status
`ready`, **com `video_path` presente** — estorno de cortesia sobre vídeo
**entregue** (grupohcmarketing, que está na classe de realismo `#719c9af6`).

> Quem ler o extrato só por data **reabre este cartão sem motivo**.

### 2.8 A objeção do item 5 do próprio cartão, respondida na fonte certa

O cartão avisa que contagem feita em `video_clones` é **piso**, porque a RLS
`video_clones_delete_own` deixa o aluno dar `DELETE` na própria linha. Então
conferi no **extrato**, que o aluno não mexe: entre 18/09 20:14:00Z e agora há
**exatamente 1** `video_clone_refund`, e é o de cortesia do item 2.7.

**Zero estorno de teto em 6,8 dias, medido onde o aluno não apaga.**

---

## 3. A decisão que estava parada como "precisa de humano" — e não gastei o Johnny

O item 7 da nota 18 listava: (a) esticar a parcela fixa de novo, (b) limitar
`480p-v3` a áudio <80s, ou (c) esperar 22/09 com o dado.

Com o dado na mão: **(a) e (b) miram um risco que 179 jobs novos não exibiram** —
zero ≥85%, máx 83,3%, faixa 80–90s pisada 18× sem morte.

> **Recomendação: nenhuma mudança.** Isso não é decidir por ele — é **deixar de
> agir**, que é o default seguro. Não toquei em produto, GPU, crédito nem
> migration.

---

## 4. O que eu NÃO fiz, de propósito

Não fechei o cartão. Não mexi em crédito, acesso, GPU nem migration. Não escrevi
para nenhum aluno. Não mergeei nenhuma das branches STALE do índice. Não mudei
`status` no `anotar_incidente` **de propósito**: o ensaio mostrou que passar
`--status` limparia `resolved_commit=324aaf6`, e ensaio existe pra isso.

---

## 5. Por que NÃO fechei, apesar de tudo acima

`utaiaguia` morreu a **100,2% do teto NOVO**, três dias depois de ele subir. O
defeito foi **reduzido, não eliminado**. E a condição exata daquela morte (**8
simultâneos**) não voltou a acontecer — então a calma atual está **não testada
justamente onde quebrou**.

Fechar agora repetiria o **#15**, fechado com *"16 dias limpos"* e **reincidente
em 26h**. Segue `investigating`, e **o backlog não baixa hoje por esse motivo** —
que é resposta legítima, não preguiça.

**Gatilho mecânico de reabertura** (pra isto não virar parada permanente):
qualquer um de (a) um job **≥90%** do próprio teto; (b) **qualquer**
`executionTimeout`; (c) **concorrência ≥8** observada de novo — a condição ainda
não testada. Sem nenhum dos três, a calma é real e o cartão não precisa de ronda.

---

## 6. Lacuna que eu nomeio e não fecho

Das 8 vítimas, **só `daniel` (14/09 23:52) e `welrisson` (14/09 18:31) receberam
carta sobre o teto**. `danicale`, `claytonpc10`, `wendellaraujo`, `nettosl` e
`utaiaguia` **nunca foram avisados** — foram estornados automaticamente e
resolveram sozinhos repetindo. `leonice` tem 3 cartas, **nenhuma sobre o teto**
(a última, 24/09, é de b-roll).

Ninguém está travado e ninguém perdeu dinheiro, então isto é **silêncio, não
urgência**. Não escrevi nesta ronda: os 5 já contornaram há dias, e carta
retroativa sobre incidente que o aluno já superou confunde mais do que informa.
**Fica registrado pra quem discordar reverter.**

---

## 7. Réguas que ficam desta ronda

> **Cartão de classe se esconde atrás do individual.** O instrumento apontou o
> #380 (individual, bola do aluno) quatro rondas seguidas. O #398, logo abaixo,
> também era individual e também estava com o aluno — mas o **conteúdo** dele era
> de classe, e foi por ali que apareceu o #404, `investigating` há 11 dias com 6
> alunos. **Ranking por idade não enxerga classe; só abrir o cartão enxerga.**

> **Revisão datada que o próprio conserto agenda não se cobra sozinha.** O
> `03adea8` escreveu *"reveja com o dado"* com vencimento ~22/09. Venceu e passou
> 3 dias. **Prazo escrito em comentário de código não tem quem o cobre** — foi a
> mesma família do #400 (*"segue até o PR entrar"*) e dos 16 dias de silêncio da
> ordem de 17/09.

> **Estorno novo no extrato não é morte nova.** O `video_clone_refund` de 21/09
> parecia furar a janela limpa; era cortesia sobre vídeo **entregue**, de job de
> 01/09. Antes de reabrir por uma data, **abrir o `ref_id`**.

---

## 8. Fim de ronda

- `git fetch origin && git log --oneline origin/main..HEAD` → conferido ao fim
- **Nenhum código subiu nesta ronda**: o conserto já estava em produção desde
  15/09. **Nenhum fix preso em branch** — nada foi escrito.
- `#404` anotado (nota 21, 6.154 chars), `status` **inalterado**,
  `resolved_commit=324aaf6` **preservado**. **1 linha afetada, conferida na
  releitura** — não confiei no silêncio do update.
- Não gastei GPU, não mexi em crédito, não mandei carta, não toquei em migration.
