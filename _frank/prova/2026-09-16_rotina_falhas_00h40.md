# Rotina das falhas — 16/09/2026, 00h40Z (21h40 BRT de 15/09)

Dono da fila (14-A). Li `_frank/ordens/README.md`, a de **20/08** (dono da fila),
a de **21/08** (serial + regra 8), a de **27/08** (só erro de sistema vira
chamado) e a de **29/08** (planilha desligada). **Nada da planilha foi lido,
escrito, classificado ou reprocessado.** Canal: por ordem de **31/08**, o aviso
desta ronda saiu **no grupo**, e só no grupo.

Ronda anterior das falhas: **23h40Z**. Abertura desta: **00h41Z**.

Peguei o **`#11`** (`9ac03612`) — **o mais velho da fila inteira, 56,1 dias**,
`investigating`, 4 e-mails afetados. Pela regra 8 não há empate: é o mais antigo
com aluno afetado. A ronda anterior o deixou com um **teste nomeado** para quem
pegasse. Esta ronda **rodou esse teste** e ele decide.

**O que esta ronda entrega:** (1) a hipótese que estava viva há 56 dias **caiu,
com número**; (2) o **4º e-mail do cartão nunca tinha sido apurado** em 14 notas
— apurei; (3) uma pista falsa foi **descartada com medição** antes de virar nota;
(4) resgatei trabalho de outra ronda que se perdeu na passagem entre um rebase e
um merge.

---

## 1. 🟢 O teste que a ronda das 23h40Z deixou foi rodado: **(B) cai**

A nota anterior fechou com duas hipóteses declaradas **valendo igual** para a OOM
do job `c90ff577`:

- **(A)** vizinho **externo** no mesmo físico da RunPod;
- **(B)** concorrência **nossa** — 2 jobs despachados nos últimos 62 s de vida do
  que morreu.

E deixou escrito o teste que decide: *"correlacionar sobreposição de jobs × OOM"*.

### 1.1 Método (e por que ele precisou ser reconstruído)

`training_jobs.started_at` **não serve**: é `NULL` em **1.361 de 1.361** linhas
(§3). Então a janela de **computo** foi reconstruída:

```
ini = finished_at - elapsed_seconds   (quando elapsed > 0)
ini = created_at                      (quando não há elapsed)
fim = finished_at
```

1.348 dos 1.361 jobs têm `finished_at`. Sobreposição = janelas que se cruzam.

### 1.2 O número que derruba (B)

No job que morreu, **exatamente 1** job nosso sobreposto — e a sobreposição real
é de **1,3 segundo**:

| | job | começa a computar | termina |
|---|---|---|---|
| morreu (OOM, `rc=1`) | `c90ff577` | 21:46:06Z (enfileiramento) | **21:52:15,119Z** |
| único sobreposto | `91f70b44` (`-e2`, completed) | **21:52:13,818Z** | 21:59:07Z |

O `91f70b44` pegou o slot **no instante da morte**; não dividiu a placa com ele.
E o `db399bb8`, que a nota anterior também citou, **nem aparece**: foi
enfileirado 21:51:58Z, mas a janela de computo dele começa **depois** do fim do
que morreu.

**Por que a suspeita anterior parecia forte:** ela mediu `created_at`
(**enfileiramento**), não computo. Enfileirar 3 jobs em 62 s não quer dizer 3
jobs na GPU ao mesmo tempo.

### 1.3 O controle — a parte que torna isto prova e não leitura

Dos **1.289 treinos `completed`**:

| sobrepostos | quantos completaram |
|---|---|
| ≥ 1 | **314** (24,4%) |
| ≥ 2 | **90** |
| máximo observado | **7** |

Em **14/08, 02:18–02:29Z**, rodaram **8 treinos nossos ao mesmo tempo** — e
**5 deles no mesmo sufixo `-e2`** — e os **8 entregaram** (281 s a 361 s cada).

**A casa sobrevive rotineiramente a 8 simultâneos. O que morreu tinha 1,3 s de
sobreposição.** A concorrência no instante da morte está no **piso** da
distribuição dos sucessos — o mesmo raciocínio que a ronda do `#404` usou para
mostrar que a folga estava dentro da distribuição.

### 1.4 Conclusão e o que ela muda

**(B) está derrubada.** Sobra **(A)**, coerente com a aritmética do próprio
traceback: nosso processo 11,93 GiB + `Process 560` 7,95 GiB ≈ **20 de 94,97
GiB**, e **~75 GiB sem dono visível** — agora também **sem nenhum job nosso a
quem atribuir**.

**Consequência para a decisão que está com o Johnny:** se quem enche a placa é
externo, **nenhuma disciplina de agendamento nossa previne**. Espaçar treino não
resolve. Sobram **(i)** retentativa em OOM transitória (**`#422`**) ou **(ii)**
GPU dedicada/reservada na RunPod. Isso **muda o custo-benefício do `#422`**: ele
deixa de ser paliativo e passa a ser **a única mitigação ao nosso alcance**.

---

## 2. 🟠 Pista falsa, descartada **com medição** (antes de virar nota)

Por sufixo do `runpod_job_id`, a taxa de falha parecia gritar:

| sufixo | jobs | falhas | % |
|---|---|---|---|
| `-u1` | 19 | 7 | **36,84%** |
| `-u2` | 18 | 4 | **22,22%** |
| `-e1` | 658 | 32 | 4,86% |
| `-e2` | 666 | 28 | 4,20% |

**Não é defeito.** As 12 falhas de `error_message` vazio (7 em `-u1`, 4 em `-u2`,
1 em `-e1`) têm **`finished_at` NULL e `elapsed_seconds` NULL**: são linhas
**abandonadas que nunca finalizaram**, não falha de trainer. O sinal é artefato
do recorte.

Registro porque quase virou "achado": 8× de diferença numa tabela de 1.361 linhas
é exatamente o tipo de número que entra em nota sem controle.

---

## 3. 🔧 Vão de instrumento (anotado, **sem abrir cartão**)

- `training_jobs.started_at`: **NULL em 1.361 de 1.361**. A coluna existe e
  **nunca foi escrita**.
- `elapsed_seconds = 0` nas **falhas** — inclusive nesta OOM.

O teste da §1 só foi possível **por reconstrução**. Não abri chamado: não travou
este diagnóstico e a fila já tem **84 abertos**. Fica registrado no cartão e aqui
para quem precisar do próximo.

---

## 4. 🔴 O 4º e-mail do `#11` nunca tinha sido apurado — em 56 dias

A nota de 27/08 diz *"os outros 3 e-mails do chamado já estavam apurados"*. São
**quatro** em `affected_emails`. Busquei o quarto no jsonb inteiro das 14 notas:
**zero ocorrência**. Ele não foi decidido — ficou de fora da conta.

**`diretoriastupendo@gmail.com`** (Diretoria Stupendo, CNPJ, Ribeirão Preto/SP) é
a **1ª ocorrência deste cartão**: 21/07 22:15:20Z, training `7d4f6465`,
`"trainer failed"`. O mesmo minuto abriu o **`#7`** pela voz `fa9136d8`
(22:15:11Z).

### 4.1 Dinheiro — pelo instrumento de produção, não pela minha leitura

Minha primeira leitura do `entitlements` foi **errada** e eu a corrigi antes de
escrever: vi `value = 0` e ia concluir "não pagou". Rodei o
`pagou_de_verdade.cjs` (a fonte de verdade que o README manda usar):

> **PAGOU** — avulsa **R$ 312,64** em **20/07**, *"Fábrica de Conteúdo
> Invisível"*, COMPLETE. Mais uma assinatura FastCloner de 21/07 com **value = 0**
> ("Plano Founder", oferta `ewxrfw9j`), hoje `canceled`, `access_until` 28/07.

E o próprio instrumento avisa, com o número do cartão: *"esta pessoa PAGOU, mas
não pela assinatura do FastCloner; o que a avulsa dá direito aqui é decisão
**COMERCIAL**, não de script"* (**`#173`**).

### 4.2 Onde ele está hoje: em lugar nenhum

- `auth.users`: **0 linhas**. `profiles`: **0 linhas**.
- A voz `fa9136d8` e o training `7d4f6465` **não existem mais** (consultei os dois
  por id: zero linhas). A conta e os dados dela foram **apagados**.
- Sobreviveu só a trilha em `incident_occurrences` — foi por onde cheguei.
- Procurei conta alternativa por **CNPJ** (`55325833000114`), por **telefone**
  (`16996505678`) e por nome: **nenhuma**. Não migrou de e-mail; sumiu.

### 4.3 O que eu **não** fiz, e por quê

**Não é "aluno pagante travado".** Não há conta, não há voz pendente, não há nada
em voo, e a entitlement de FastCloner que ele teve era de **valor zero** e já
estava cancelada em 28/07. Por isso **não disparei alerta de urgência**.

**Não escrevi para ele.** Oferecer acesso ao FastCloner em cima de uma compra
avulsa é **proposta comercial**, não atendimento — a regra 8 me autoriza a
responder aluno, **não a decidir preço/escopo pela casa**. Isso é do Johnny e do
Lucas, e foi para o grupo.

O que sobra é um fato desconfortável que o cartão escondeu por 56 dias: **a
primeira experiência de FastCloner de alguém que tinha pago R$ 312,64 na véspera
foi um treino que falhou, e hoje essa pessoa não tem mais conta.** Se há causa
entre uma coisa e a outra **eu não sei**, e não dá para saber daqui.

---

## 5. Por que o `#11` continua `investigating`

A régua de fechamento que a ronda anterior escreveu tem dois itens:

| item | estado |
|---|---|
| (i) o teste da §3 decidir entre (A) e (B) | ✅ **CUMPRIDO** nesta ronda |
| (ii) decisão do Johnny sobre retentativa, **em produção** | ⬜ pendente |

Metade da régua caiu. **Não fecho** — nada foi consertado, e a OOM pode repetir
amanhã e estrandar outro aluno do mesmo jeito. Marcar `fixed` aqui seria fechar
em cima de um diagnóstico, que é a regra 14 inteira.

**2 notas novas** (14 → 16).

---

## 6. 🟠 Processo: eu julguei uma branch abandonada e ela estava viva

Relato o erro porque ele quase custou caro.

O checkout principal estava em `feat/sgp-gerado-vs-entregue`, base velha
(`e4b8f05`), com 3 arquivos sem commit parados desde 23:03Z — o mesmo achado da
§10 da ronda anterior. Com **1h40 de silêncio**, concluí que estava **órfã**,
commitei os 3 arquivos (suíte `src/lib/sgp` inteira rodada antes: **268 testes,
268 passando**) e tentei `push`.

**O push foi recusado.** A dona estava **viva**: tinha feito `force-push` de um
rebase sobre `28e8c86`, com **2 commits novos** (migration 116 e o botão *"Avisei
o aluno"*). **Parei na hora** — não empurrei nada na branch dela e **não abri PR**.
Um trabalho, um dono; vale para branch também.

**O que ficou:** a dona mergeou como **PR #306** (`1c5d9f2`, já na main). Conferi
se o incremento sem commit tinha entrado junto:

```
paradosNaoIniciaram em main: 0
SITUACAO_ROTULO  em main: 0
```

**Não entrou.** O rebase partiu de um ponto que não tinha esses 3 arquivos, e o
merge levou o resto. Então empurrei o incremento para uma branch de resgate,
**sem PR**, para a dona decidir:

> `frank/resgate-sgp-banner-dois-numeros`

Conteúdo: `paradosNaoIniciaram` no `ResumoPainel`, o banner mostrando **os dois
números separados** ("travou no cadastro" × "comprou e nunca abriu o portal" — o
contador que saltou de ~137 para 320 ao ligar o requisito 4), o rótulo do filtro
usando `SITUACAO_ROTULO` em vez do `toUpperCase()` do código, e o teste que cobre
o corte.

**A lição, que é minha:** "parada há 1h40" **não** é "abandonada". O certo era
`git ls-remote` na branch **antes** de commitar, não depois de o push falhar.
Custou quase um clobber em trabalho alheio no meio de um rebase.

---

## Fim de ronda

- `#11` (`9ac03612`): `investigating`, **2 notas novas** (16 no total). Régua de
  fechamento com **item (i) cumprido**, item (ii) com o Johnny. **Não fechei.**
- `#422`: **não toquei** — segue esperando decisão de GPU. Esta ronda **reforça**
  o pedido: com (B) fora, ele virou a única mitigação ao nosso alcance.
- `#7`: **não toquei** (mesma origem que a 1ª ocorrência do `#11`; fica anotado
  aqui, não reabri nada).
- Aluno: **nenhum dos 4 do `#11` está esperando.** 3 têm voz `ready` com `lora`
  (Fernando 15/08, franwd82 27/08, Ricardo 15/09 22:53). O 4º não tem conta (§4).
- **E-mail a aluno: nenhum.** Ninguém esperando; o caso do §4 é decisão comercial,
  não atendimento.
- **GPU gasta: nenhuma. Crédito mexido: nenhum. Migration aplicada: nenhuma.**
- Branch de resgate criada, **sem PR**: `frank/resgate-sgp-banner-dois-numeros`.
- Log commitado **direto na main**, por worktree limpo (`/tmp/wt-ronda-0041`),
  sem tocar no checkout da outra ronda.
