# Ronda das falhas — 22/09/2026 ~22h40–23h00Z (Frank, dono da fila)

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`).
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou reprocessado.

Serial pela regra 8. Não mexi em crédito/acesso/entitlement, **não estornei**,
não cancelei assinatura, **não mergeei nada**, não liguei chave, **não gastei
GPU**, não toquei em migration.

**Uma linha:** o `#52` (`37bacb68`) **reabriu sozinho às 22:23Z**, 17 min antes
desta ronda, num **cliente que pagou hoje às 18:22Z**; a falha que reabriu o
cartão está estornada, mas a geração que **passou** é a **pior entrega da casa**
na janela limpa (cobertura ZERO num pedaço entregue, média abaixo do piso,
18 palavras perdidas) — e **eu derrubei meu próprio número no meio da ronda**.

| fato | número |
|---|---|
| Cartões fechados | **0** (digo abaixo por quê) |
| Alunos escritos | **1** (Diego, carta individual — regra 8 de 21/08) |
| Fix em produção | **0** |
| PR aberto | **0** |
| Notas de incidente gravadas | **1** (#52, conferida na releitura: 60 → 61, 1 linha afetada) |
| Ferramentas novas (só leitura) | **2** |
| Dinheiro devolvido por mim | **0** (o estorno do caso foi automático, conferido) |
| GPU gasta | **0** |

---

## 0. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 1073 lidas = 996 já com linha + 77 fora da janela + **0 escrituráveis**. Contagem fecha (1073 = 1073). |
| `enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Buraco **PASSIVO**. |
| `percepcao_travada.cjs` | **0** card travado em percepção · controle positivo #310 reencontrado, 510 varridos. |
| `garantia_na_fila.cjs` | 6 perderam a janela · **1 vence em 48h** · 0 na perna da renovação. |
| `idade_incidentes.cjs` | **106 abertos** (era 105 na ronda anterior; +1 = a reabertura do #52). 30d+: 4 · 15–30d: 17 · 7–15d: 36 · 3–7d: 28 · <3d: 21. |
| `esperando_johnny.cjs` | **19** parados em decisão do Johnny · mais velho **54d** · **60 alunos** distintos · +1 não triado (`c726c5ae`). |

---

## 1. Por que este cartão, e não os mais velhos

Os quatro mais velhos que o `#52` foram lidos, **não re-medidos** (re-medir é o
que queimou três rondas no `#479`), e os dois primeiros estão parados em ação do
**Johnny**, escrito na própria nota deles:

- `c726c5ae` (105d) — espera o **"pode"** do merge do **PR #214** + semear o
  dedupe na mesma janela. Medido em 22/09: `orphan_invites_sgp` com "a
  registrar: 4", igual a 08/09. O PR está a **um comando** de ficar seguro.
- `b706b32e` (39,8d) — espera **merge do PR #398** + a decisão dos 10.000 cr do
  Heitor.
- `d3d8d1b2` (54d) e `719c9af6` (21,9d) — já na fila de decisão.

O `#52` (34,2d) é o mais antigo com aluno afetado **cujo próximo passo é da
casa** — e reabriu sozinho 17 min antes da ronda. Peguei ele.

## 2. Quem reabriu: cliente pagante no PRIMEIRO DIA

`diegoavnunes@gmail.com`, geração `a53e8f7b`, 21:55:54Z. O perfil **nasceu hoje
às 18:16:57Z** e a compra entrou às **18:22Z** (100.000 cr, `payment_event`
HP286184). A falha pegou um cliente novo **~3h30 depois de ele pagar**, na
primeira vez que ele testou a própria voz.

**Dinheiro conferido, nada devido nesta:** −1944 às 21:55:54 e **+1944 às
22:00:45**, casados por `ref_type='generation_refund'` — **nunca por `kind`**
(o `kind` é `extra_purchase`, exatamente a armadilha de 20/08). Estorno
automático funcionou.

**Ele não está travado:** voz `Diego` ready (44 min de áudio cru) e às 21:47 ele
já tinha recebido um áudio. `last_seen` 22:07Z.

## 3. O achado não é a falha — é a entrega que PASSOU

Ferramenta nova (só leitura):
`_frank/ferramentas/2026-09-22_par_natural_alucinacao.cjs` — procura **par
natural**: duas gerações do mesmo aluno, mesma voz, mesma referência e texto
equivalente, com desfechos **opostos**. Achou 1:

```
READY  1c761a52 21:47:13 · elapsed 255,3s · dur 111,1s
FAILED a53e8f7b 21:55:54 · elapsed 128,9s · coverage_best 0,056
8,7 min · mesma voz · mesma referência · texto IGUAL em letras (1620 vs 1620)
```

Logo **a entrada não explica a falha**. Mas o que importa está no lado **READY**:

```
coverage_min_visto = 0        <- um pedaço ENTREGUE não é o texto
coverage_medio     = 0,8376   <- ABAIXO do próprio piso (0,85)
faltantes_total    = 18 em 23 pedaços · pior pedaço 5
faltantes_amostra  = minha / maneira / de / me / comunicar
regens 41 · coverage_alucinado 33 · exhausted 10 · intrusion_flagged 26 de 66
```

**O aluno foi COBRADO 1.944 cr por este.** É literalmente o `#226`/`702cc916`
("entregamos áudio que o nosso próprio QA reprovou"), agora com cliente de
primeiro dia. Ler estes campos como ENTREGA é legítimo: `registrar_faltantes` e
`registrar_cobertura` são chamados **pelo chamador**, só pro pedaço que virou
entrega (correção de 26/08, está no docstring), e o LIMITE HONESTO deles
("só descrevem entrega quando `ready`") está satisfeito.

## 4. Medi a classe — e derrubei meu próprio número no meio da ronda

Ferramenta nova (só leitura):
`_frank/ferramentas/2026-09-22_entrega_abaixo_do_piso.cjs`, com **controle
positivo embutido** (se não reencontrar o `1c761a52` nos 3 eixos, ela **morre**
em vez de imprimir número).

Primeira passada, 30 dias, 1.492 entregas: eixo C deu **70,5%**. **Quase
reportei.** Não reportei porque um dos meus 15 piores, `0a0c9413`
("vírgula zero por cento"), é **literalmente o exemplo do docstring do
`canon.py`** como falso positivo conhecido. O 70% era régua contaminada.

Fui medir se o `canon` estava no ar. Cortei pelo **commit** (`e16d990e`, main
18/09 20:18Z) e conclui **"canon não surte efeito"** — 21 ocorrências de
palavra-alvo depois, "pra" liderando. **Essa conclusão estava ERRADA e eu a
desfiz na mesma ronda:** commit na main **não é worker no ar**. O corte certo é
o último **"Build RunPod Worker"** com sucesso, **21/09 18:56:21Z**:

```
entre commit e build: 16 de 85 entregas com amostra tinham palavra-alvo ('pra' 9x)
DEPOIS do build:       1 de 33
```

> **O `canon.py` ESTÁ no ar e funcionando desde 21/09 18:56Z**, provado por
> **comportamento** ("pra" sumiu da amostra), não por git. Ninguém tinha essa
> prova. E o caminho errado (cortar por commit) é o mesmo erro de família do
> sha-vs-squash que já mordeu esta casa.

### O número que vale (janela limpa, pós-build)

67 entregas `ready` com medição, desde 21/09 18:56Z:

| eixo | resultado |
|---|---|
| A. pedaço entregue com cobertura **ZERO** | **1 de 67** (1,5%) |
| B. média dos pedaços **abaixo do piso** | **1 de 67** (1,5%) |
| C. perdeu alguma palavra | 33 de 67 (49,3%) |

**A e B têm um caso cada, e é o MESMO: o `1c761a52` do Diego.** Na janela em que
a régua está limpa, a entrega deste cliente novo é **a pior da casa** nos dois
eixos graves.

**O eixo C (49,3%) eu NÃO levo como conta de dano** — sobra nele a família (c)
do `canon.py`: nome próprio e palavra estrangeira ("stato di famiglia",
"licurgo", "acetilcisteína", "pi cofins"), que o canon deliberadamente **não
trata** e que quem cuida é `classificar_ausencias`/`grafia_*`.

## 5. O que eu NÃO estou dizendo

Não digo que a régua está certa nem que está inflada — continua sendo a decisão
do Johnny parada no `#226` há **21 dias**. **Não ouvi** o áudio do Diego: o
`olho` devolveu **resposta vazia** nesta ronda e a Z.AI segue **sem saldo**.
Bloqueio de percepção **declarado com motivo concreto** (ordem de 17/09,
opção 2) — não carimbei "o áudio está ruim" por escuta que não houve. O que
tenho é a telemetria da própria casa, e ela basta pros números acima.

## 6. Carta ao aluno (regra 8 de 21/08 — individual, decido sozinho)

Mandada às ~22h50Z, `--chave qa-coverage-primeiro-dia`, bcc `suporte@`.
**Registrada em `emails_enviados` e CONFIRMADA na pasta de enviados: uid 3244.**

Conteúdo: (a) os créditos da que falhou **já voltaram** — fato conferido no
extrato; (b) o áudio que saiu **também não ficou bom**, e digo isso antes de ele
perguntar; (c) **ofereço refazer por conta da casa**, sem gastar crédito dele,
**mediante resposta** — não executei, porque gasta GPU e ele não pediu.

**Correção que fiz no meu próprio rascunho antes de enviar:** eu tinha escrito
que "o mesmo texto com a mesma voz saiu direito em outras tentativas". **É
falso** — as outras gerações dele são a amostra do treino (texto diferente) e a
que falhou. Reescrevi para o que o banco sustenta: o treino ficou bom e a falha
foi da geração. Carta com frase bonita e não verificada é como se perde um
cliente de primeiro dia.

## 7. Por que NÃO fechei

Regra 14. Medi e nomeei, **não resolvi**: o defeito segue no ar e o áudio ruim
segue cobrado. O que o cartão espera agora:

1. o `1c761a52` é o caso **vivo, barato e recente** que a decisão do `#226`
   precisava — cliente de primeiro dia, cobrado, entrega abaixo do piso;
2. devolver ou não os **1.944 cr** é decisão de dinheiro da mesma classe do
   `52b22304` ("9-A: devolver crédito das gerações que nosso laudo chamou de
   fracas", parado há **19d**) — **não estornei** por isso;
3. refazer por conta da casa depende do "sim" do Diego.

## 8. ⚠️ FROTA: PIOR que na ronda anterior — 12 de 13 fora

Medido um por um agora, não impressão:

- **`Not logged in · Please run /login`** (8): `coder`, `qa`, `gerente`,
  `generalist`, `analyst`, `critic`, `strategist`, `carol`;
- **resposta VAZIA** (3): `olho`, `pesquisa`, `social` — na ronda anterior eles
  ao menos respondiam "OK" ao ping; agora **nem isso**;
- **de pé: só o `glm`**.

A casa está sem quem escreva código, sem quem teste em navegador, sem quem
revise entrega e **sem olho/ouvido** — a perna de que a ordem de 17/09 depende.
Por isso as duas ferramentas desta ronda e a carta saíram na minha mão. Precisa
do `/login` do Johnny.

## 9. Ferramentas novas (só leitura, nenhuma escreve linha)

- `2026-09-22_par_natural_alucinacao.cjs` — acha par de mesma entrada com
  desfecho oposto; imprime a **diferença crua** dos textos e **descarta** o par
  se a READY não tiver áudio/duração de verdade.
- `2026-09-22_entrega_abaixo_do_piso.cjs` — mede os 3 eixos sobre **entregas**
  (`status='ready'`), pagina de 1000 em 1000, **morre em qualquer `error`** e
  tem **controle positivo embutido**.

## 10. Fim de ronda

- `git log --oneline origin/main..HEAD` conferido **vazio** após o push.
- Produção tocada por mim: **uma nota de incidente** (conferida na releitura),
  **uma carta a aluno** (confirmada na pasta de enviados), **duas ferramentas de
  leitura** e este log. Nenhum merge, nenhum crédito, nenhuma GPU.
