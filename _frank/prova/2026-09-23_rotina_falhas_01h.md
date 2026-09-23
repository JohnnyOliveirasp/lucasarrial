# Ronda das falhas — 23/09/2026 ~00h40–01h00Z (Frank, dono da fila)

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`).
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou reprocessado.

Serial pela regra 8. Não mexi em crédito/acesso/entitlement, **não estornei**,
não cancelei assinatura, **não mergeei nada**, não liguei chave, **não gastei
GPU**, não toquei em migration, **não escrevi para aluno nenhum**.

**Uma linha:** não fechei cartão, e o motivo tem nome — **todos os mais velhos
com aluno atrás esperam decisão do Johnny, não apuração**; em compensação
consertei o **quarto falso positivo** do meu próprio detector de percepção, que
hoje ia reportar **1** onde a classe real é **0**, e **desmenti duas afirmações
minhas** no meio da ronda.

| fato | número |
|---|---|
| Cartões fechados | **0** (digo abaixo por quê) |
| Alunos escritos | **0** (nenhum caso meu pedia carta — justificado abaixo) |
| Fix em produção (produto) | **0** |
| PR aberto | **0** |
| Notas de incidente gravadas | **0** |
| Instrumento da ronda consertado | **1** (`percepcao_travada.cjs`, + 2 testes) |
| Dinheiro devolvido por mim | **0** |
| GPU gasta | **0** |

---

## 0. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 1079 lidas = 1002 já com linha + 77 fora da janela + **0 escrituráveis**. Contagem fecha (1079 = 1079). |
| `enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Buraco **PASSIVO**. |
| `percepcao_travada.cjs` | **1 antes do conserto → 0 real.** O único era falso positivo. Ver §1. |
| `garantia_na_fila.cjs` | 7 perderam a janela · **0 vence em 48h** · 0 na perna da renovação. |
| `idade_incidentes.cjs` | **108 abertos** (era 106 na ronda anterior). 30d+: 4 · 15–30d: 17 · 7–15d: **38** · 3–7d: 28 · <3d: 21. |
| `esperando_johnny.cjs` | **17** parados em decisão do Johnny · mais velho **54d** · **54 alunos** distintos · +1 não triado (`c726c5ae`). |

Duas observações honestas sobre a tabela: a fila **subiu** (106 → 108), e a
faixa 7–15d engordou (36 → 38). Não é ruído de medição; é a fila andando pra
direita porque a cabeça dela não sai.

---

## 1. O achado da ronda: o QUARTO falso positivo do meu detector

`percepcao_travada.cjs` apontou **1 cartão travado em percepção** — o `#518`
(`b4d64e4a`, Junqueira). Fui conferir antes de despachar, e a **última nota do
cartão diz o contrário do que o detector entendeu**:

> "...e **NÃO PEDI OUVIDO HUMANO** porque ele próprio já deu o veredito de
> ouvido que o caso precisava - eu não ouço e não afirmo nada sobre como o
> áudio saiu."

A marca `ouvido humano` casou **dentro de** "não pedi ouvido humano". Nenhum dos
anuladores existentes pegava isso: não há verbo em primeira pessoa
(`\bouvi\b` tem word boundary e **não** casa "ouvido"), não há "despacho
cumprido", não há "falso positivo".

É a **mesma família** dos três defeitos já documentados no cabeçalho do arquivo
— a nota fala SOBRE a marca em vez de pedir — mas por uma porta nova: antes era
**citação** e **relato**, agora é **recusa explícita**. Com **1 só cartão na
classe, um falso positivo é 100% do número do relatório**: a ronda de 22/09 23h
reportou 0, e esta reportaria 1, mandando despachar percepção de um caso em que
**o próprio aluno já tinha dado o veredito de ouvido** ("coloquei ó e resulta
melhor").

**O que eu fiz:** anulador de negação (`nao pedi (ouvido|olho|percepcao)`,
`ja deu o veredito`, `ninguem precisa olhar nada de novo`) + **CONTROLE
NEGATIVO embutido**: se o `#518` voltar a contar como pendência, o script
**morre** em vez de imprimir número — simétrico ao controle positivo do `#310`
que já existia. Mais 2 testes com o **texto real** da nota. **31/31 passando**
(eram 29).

**O que eu deliberadamente NÃO fiz:** não pus `"eu nao ouco"` / `"eu nao
enxergo"` sozinhos no anulador. Essas frases são o **pedido de socorro** — são
exatamente a marca do controle positivo `#310`. Anular por elas cegaria o
detector inteiro. Está escrito no código, no bloco de comentário, porque
instrumento cego não sobrevive à ronda seguinte (já aconteceu duas vezes nesta
família).

Depois do conserto: **controle positivo OK · controle negativo OK · classe = 0**.

---

## 2. Duas coisas que eu afirmei nesta ronda e tive de desmentir

Registro as duas porque afirmação errada minha custa mais caro que ronda vazia.

**(a) "A frota voltou."** Pinguei os 13 operários e li `hasResult:true` em 7
deles. Quase reportei que a casa tinha voltado a ter `coder`, `qa` e `gerente`.
**Estava errado:** o `delegate-cli` imprime o turno como concluído e **só
depois** erra com `Not logged in · Please run /login`. Eu estava medindo o campo
errado. Remedi checando a mensagem de erro, e o estado real é o **mesmo de
ontem**: 7 `SEM LOGIN` (coder, qa, gerente, generalist, analyst, critic,
strategist), `carol` sem login, 3 de resposta **vazia** (olho, pesquisa,
social). **12 de 13 fora.** Foi por isso que o conserto do §1 saiu na minha mão
depois de o `coder` devolver `Not logged in`.

**(b) "A autorização do Moysés está pendente e é minha pra executar."** A nota
do Vigia das 10:17Z entrega o caso assim ("autorizacao dada por escrito, acao
pendente ... quem executa e o dono da fila"), e eu ia executar. **Fui conferir o
estado atual antes de tocar em coisa irreversível — passo (1) da rotina — e o
cancelamento JÁ ESTAVA FEITO** desde 22/09 10:46:39Z, por uma ronda anterior,
conferido na fonte viva (`OVPDAWS5` → `CANCELLED_BY_SELLER`). Eu tinha lido a
nota das 10:17Z e parado antes da das 10:48Z. **Não cancelei duas vezes.** Fica
o registro de que "o recado diz que está pendente" não substitui ler o cartão
até o fim.

---

## 3. Por que NÃO fechei cartão (e por que isso é resposta, não desculpa)

Regra 8 manda pegar **o mais antigo com aluno afetado**. Peguei a cabeça da fila
um por um e **todos os que têm aluno atrás estão parados em decisão de dinheiro
ou de merge do Johnny** — nenhum espera apuração minha:

- `c726c5ae` (105d, 19 alunos) — "pode" do merge do **PR #214**.
- `d3d8d1b2` (54d, 19 alunos) — merge do **PR #404**.
- `b706b32e` (40d) — merge do **PR #398** + decisão dos 10.000 cr.
- `37bacb68` (34d) — trabalhado na ronda de 23h; o que falta é a decisão do
  `#226` e o "sim" do Diego. Confirmado hoje que **nada mudou**.
- `719c9af6` (22d), `702cc916` (21d) — fila de decisão.
- `8b8fc4c8` (21d) — falta **mão humana no painel da Hotmart**; já escalado.
- `7ed72ad0` (21d) — os 7.455 cr são **decisão de política de classe**, não de
  valor; o conserto da classe é o **PR #351**, aberto desde 19/09.

O único da cabeça cujo próximo passo era da casa era o do Moysés — e ele **já
tinha sido executado** (§2b).

**Não forcei um `fixed`** (regra 14) e **não desci a fila atrás de um cartão
fácil** só pra ter número: o placar desta ronda é 0 porque a fila está
bloqueada, e maquiar isso esconderia justamente o fato que precisa chegar no
Johnny.

**Não mandei carta pra aluno** porque nenhum caso meu pedia uma: o `#518` já foi
respondido 2x e a bola é dele (ele mesmo disse que vai testar e dar retorno), o
Moysés recebeu carta em 22/09 10:48Z e está escolhendo entre os dois caminhos, e
o Diego recebeu na ronda de 23h. Carta a mais na mesma conversa é ruído, não
atendimento — a lição já está escrita no `#518` ("antes de escrever, LER").

---

## 4. O lote levado ao grupo

O próprio `esperando_johnny.cjs` diz que o desfecho desta classe **não** é
re-escalar um caso por ronda, e sim **juntar num LOTE**. As rondas anteriores
vinham escalando um de cada vez (`ask_humans.cjs` caso a caso) e a fila não
baixou. Postei **uma** mensagem no grupo com os 17 organizados em três baldes
decidíveis — **MERGE** (4 PRs, nenhum com migration, e a 14-B diz que merge não
precisa dele), **DINHEIRO** (10 cartões, com os valores na frente) e **POLÍTICA**
(3, incluindo o piso do QA que trava a classe inteira).

Sem dado pessoal além de primeiro nome, sem bloco de código, sem saída de
terminal — regra do canal de 20/08.

---

## 5. O que NÃO estou dizendo

Não digo que a classe de percepção é zero **de verdade** no mundo — digo que é
zero **pelo critério do detector**, que agora tem controle nos dois sentidos.
Não ouvi nem vi artefato nenhum nesta ronda, e não precisei: o único candidato
era recusa escrita, não pedido.

Não afirmo que os 17 do lote são exatamente 17: o próprio instrumento marca **4
contestados** (teto 21) e **11 falsos positivos da marca**, e eu não re-triei os
contestados hoje.

Não toquei no `#518` (nem status, nem nota): o Vigia já o deixou correto e a
bola é do aluno. Mexer nele só pra carimbar presença seria ruído no cartão.

---

## 6. Fim de ronda

- Produção tocada por mim: **nenhuma**. Nenhum merge, nenhum crédito, nenhuma
  GPU, nenhuma carta, nenhuma nota de incidente, nenhum status mudado.
- Mudou no repo: `percepcao_travada.cjs` (anulador de negação + controle
  negativo), `percepcao_travada.test.cjs` (+2 casos, 31/31) e este log — tudo
  **na main**, que é onde registro fica visível pra próxima ronda.
- `git log --oneline origin/main..HEAD` conferido **vazio** após o push.
