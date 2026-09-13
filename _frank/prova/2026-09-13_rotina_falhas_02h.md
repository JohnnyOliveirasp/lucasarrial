# Ronda das falhas — 13/09/2026, ~02hZ (12/09, 23h BRT)

Dono da fila: Frank (regra 14-A). Método serial (regra 8, ordem de 21/08).
Canal: ordem de 31/08 — FastCloner sai **no grupo**, e só no grupo.

Repo em `main`, `pull --ff-only` limpo. `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa, mais as ordens de **27/08** (só erro de sistema vira
chamado) e **29/08** (planilha desligada). **Nada da planilha foi lido, escrito,
classificado ou reprocessado.**

**Item serial desta ronda:** `#52` / `37bacb68` — `qa_coverage`, 32 ocorrências,
20 alunos. **NÃO fechado**, de propósito. O defeito está vivo e eu não tenho
cura. O que a ronda entrega é a medição honesta, **um aluno atendido** e uma
**armadilha de instrumento** que enganou esta própria ronda.

---

## 1. Por que este cartão, e não o mais velho

Pela regra 8 o alvo é o mais antigo **com aluno afetado**. Passei por cima dos
dois primeiros com motivo, não por conveniência:

- `d3d8d1b2` (44,5d, timeout) — a ronda das 00hZ acabou de medi-lo e o deixou
  `investigating` com passo seguinte nomeado (instrumentar a fase do hang,
  exige dias de observação). Repegá-lo seria andar em círculo.
- `ce6e157d` (24,6d, Katia) — a bola está com a aluna desde 23hZ de ontem.
  Regra 8: e-mail mandado com data anotada **não é estar travado**.
- `#312` / `c726c5ae` (19 pagantes sem conta) — conferido: está corretamente em
  `aguardando_aluno`, segunda tentativa marcada para **15/09**. Não venceu.

Sobrou o `37bacb68`: 24,3 dias, em **meu** colo, e com ocorrência de ontem.

## 2. O cartão não está morto — e eu quase escrevi que estava

| janela | ocorrências |
|---|---|
| 19–27/08 | **30** |
| 28/08 – 10/09 | **0** (15 dias) |
| 11/09 20:53Z | 1 — `goudardexecutivo@gmail.com` |
| 12/09 15:41Z | 1 — `gabriel.reis2212.pt@gmail.com` |

O PR #70 (27/08, merge `965557a`) derrubou a frequência de ~4–6/dia para ~0,
mas **não zerou**. Duas em 19 horas depois de 15 dias quietos é retomada
possível, não ruído. Quem pegar na próxima ronda começa conferindo se virou 3.

## 3. A armadilha, que vale mais que o resto desta ronda

`incidents.occurrences` = **32**. `generations` (failed + `qa_coverage`) = **28**.

A diferença **não é contador inflado**: são ocorrências cuja linha em
`generations` **foi apagada**. O DELETE do histórico leva a row junto e deixa o
`ref_id` pendurado — mesma mecânica do "débito órfão" já fichada na ordem de
20/08. Conferido um a um em `incident_occurrences`: 32 linhas, 26 com geração
viva, **6 fantasma**.

**Eu caí nela nesta ronda.** Minha primeira medição partiu de `generations` e
concluiu *"28 falhas, a última em 11/09"*. Com essa moldura eu teria escrito no
log que o cartão passou 15 dias quieto — e teria **perdido a vítima mais
recente**, o Gabriel de 12/09, que era justamente a única ainda sem atendimento.
A ocorrência **mais nova de todas** era invisível pelo caminho natural de medir,
porque quem apaga o histórico é, com frequência, exatamente quem teve falha.

**Regra que fica:** para CONTAR ocorrência ou ACHAR vítima, a fonte é
`incident_occurrences` (guarda `email` e `error` próprios e sobrevive ao DELETE).
`generations` serve para DETALHAR o que ainda existe, nunca para definir o
conjunto.

Virou ferramenta, para ninguém repetir: **`_frank/ferramentas/ocorrencias_de_verdade.cjs`**
(somente leitura; `--dinheiro` confere estorno por `ref_type` contra
`REF_TYPES_ESTORNO`, nunca por `kind`). Provada nos dois sentidos no próprio
cartão: acha as 6 fantasma e nomeia a vítima de cada uma.

## 4. Dinheiro: ninguém no prejuízo — com a frase corrigida

Casei `ref_id` de cada ocorrência com `credit_transactions` somando o **sinal**.

- **28** têm extrato e **todas fecham em zero** (débito + estorno).
- **4 nunca foram cobradas** — zero linhas, conferido no extrato **do usuário**
  numa janela de ±1h (não só por `ref_id`, para não confundir "sem linha por
  ref_id" com "não cobrado"): `johnny.oliveirasp` (conta da casa), `serescastro6`
  e `kessulyl` ×2.

Minha primeira nota no cartão dizia *"as 32 fecham em zero"*. Imprecisão minha,
**retratada em nota própria** no mesmo cartão. A conclusão não muda — ninguém
está no prejuízo — mas o certo é "28 cobradas e estornadas, 4 nunca cobradas".
A ferramenta nova separa os dois contadores de propósito por causa disto.

## 5. Hipótese testada e REFUTADA (para ninguém gastar ronda nela)

Suspeitei que o PR #70 tivesse **migrado** o modo de falha: em vez de falhar e
estornar, passar a **entregar áudio incompleto em silêncio** — que seria o
`#702cc916` e seria muito pior, porque aí o aluno paga por áudio ruim.

**Medido** em 4.011 gerações desde 01/08 (1.294 com telemetria `qa`): gerações
com `coverage_exhausted > 0` e status ≠ failed = **ZERO**. As 13 desde 01/08
falharam e estornaram. **A migração não aconteceu.**

## 6. Os dois atingidos recentes

**`goudardexecutivo@gmail.com` (11/09) — resolveu sozinho.** Falhou 20:53:39 e
gerou com sucesso às 20:58:43 (19,4s) e 21:02:54 (21,1s). Estornado. **Não
escrevi**: ele já tem o áudio e um e-mail sobre falha que ele superou há 2 dias
seria ruído. ⚠️ O acesso dele vence **hoje, 13/09 12:00Z** — não é consequência
deste cartão, mas quem olhar acesso/crédito hoje cruze com isso.

**`gabriel.reis2212.pt@gmail.com` (12/09, a fantasma) — atendido nesta ronda.**
Perfil nasceu 11/09. **Pagou R$ 297** (avulsa *Fábrica de Conteúdo Invisível*,
`HP3837108775`, APPROVED 10/09, medido na Hotmart viva) e entrou no FastCloner
por assinatura de **R$ 0 (trial) que vence 18/09**. Teve UMA geração boa (14:18Z)
e a segunda falhou às 15:41Z; estorno de 400 entrou **56 segundos depois**, saldo
800, quitado. E ele **voltou**: `last_seen_at` 13/09 **01:47Z** — logou depois da
falha e não gerou mais nada.

Conferi a pasta **Enviados ANTES** de afirmar qualquer coisa sobre contato
(regra herdada do `#312`, que produziu esse erro três vezes): **vazia**, nunca
tinha sido contatado. **Escrevi para ele** — Enviados **uid 2059**, cópia
confirmada: assumi que a falha foi nossa e não do texto/voz dele, expliquei em
português claro que a checagem se recusou a entregar áudio incompleto, confirmei
o estorno, sugeri nova tentativa (com o dado real do goudard, que teve sucesso
na retentativa) e abri a porta para ele responder que eu olho a voz dele.
**Não pedi teste e não prometi conserto que eu não tenho.**

## 7. A melhor pista viva para a causa raiz (não é conclusão)

Telemetria do `67f28d0f` (pt-BR, 355 chars): `coverage_best` **0,095**,
`coverage_medio` 0,625 com piso 0,85. Junto: `coverage_idioma_detectado='en'`
com prob **0,513** (moeda no ar), `coverage_idioma_divergente=2` e
`coverage_idioma_corrigido=0` — a segunda opinião de idioma **rodou e não
salvou**. Mais `coverage_alucinado=6` e `intrusion_flagged=6`: o modelo estava
**alucinando** no chunk, não só cortando.

Há **dois fenômenos possivelmente empilhados** (whisper do QA lendo áudio pt como
en, e o VoxCPM alucinando de verdade) e a telemetria atual **não permite separar
um do outro**. **Não afirmo causa.**

**O que falta, nomeado:** (a) separar na telemetria "o QA leu errado" de "o
modelo gerou errado" — enquanto for um número só, `coverage_best` baixo não
distingue falso negativo de defeito real; (b) decidir o que fazer quando
`coverage_idioma_divergente > 0` e `corrigido = 0`. Nenhum dos dois se prova em
uma ronda: exigem mais ocorrências, e só houve 2 em 15 dias.

## 8. Achado lateral: trabalho não commitado na `main`

A árvore de trabalho da `main` tem **8 arquivos modificados e não commitados**
(`clone-studio.tsx` +122 linhas, `runpod.ts`, `failure-alert.ts`, os 3
`messages/*.json`, `clone-history.tsx`, `db/types.ts`) mais arquivos novos não
rastreados (`api/v1/video-clone/[id]/cancel/`, `sgp/destino.ts`,
`video-clone/cancelar-politica.ts`, `scripts/109_*.sql`). É uma feature de
**cancelamento de Video Clone** em andamento, de outro agente.

**Não toquei em nada disso** e não commitei junto. Registro porque é a mesma
família do que já mordeu a casa: código fora da `main` (ou pendurado sem commit)
é código que ninguém deploya e ninguém encontra. Em `failure-alert.ts` a
alteração é de **uma linha** (`refundOriginalDebit` virou `export`) — órfã, se o
resto não subir.

## 9. O que eu NÃO fiz

- Não fechei o cartão e **não mudei status** — o defeito está vivo.
- Não gastei GPU, não toquei em crédito, acesso, voz, assinatura nem migration.
- Não alterei código de produção. O único arquivo novo é ferramenta de leitura.
- Não mergeei nenhum branch marcado STALE no `README.md` das ordens.
- Nada da planilha (ordem de 29/08).

## 10. Fila

**79 abertos**, sem mudança líquida — este cartão continua aberto com razão. 1 em
30d+, 3 em 15–30d, 15 em 7–15d.

---

## Fechamento

Não fechei nada, e essa é a resposta honesta: o `37bacb68` não tem cura provada
e fechá-lo hoje seria violar a regra 14 para o número parecer melhor.

O que a ronda entrega de concreto: **um pagante que tinha caído num buraco de
medição foi encontrado e atendido**, o dinheiro das 32 ocorrências está
conferido, uma hipótese cara foi **refutada com número** (o fix não virou entrega
ruim silenciosa), e a armadilha que quase me fez perder a vítima mais recente
virou **ferramenta** em vez de virar só parágrafo de log.

O que essa ronda quase errou é o próprio achado: eu medi por `generations`,
cheguei a "28 falhas, última em 11/09", e essa frase estava a um passo de entrar
aqui como verdade. O aluno mais recente era invisível exatamente porque a linha
dele tinha sido apagada.
