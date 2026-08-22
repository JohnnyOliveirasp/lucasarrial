# 22/08 23h UTC — Rotina das Falhas (dono da fila)

`git checkout main && git pull --ff-only origin main` → já em dia, nada a trazer.
Índice de ordens conferido: vale a `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐)
+ método serial e comunicação de `2026-08-21_passagem_incidentes_para_claude.md`
(commit `fd0b0f5`).

Método: backlog serial. **Um** incidente, até onde deu pra levar.

---

## Qual eu peguei, e por que não foi o que a ronda anterior indicou

A Rotina das 22h deixou escrito que o próximo da fila era o `7963388e`
(kessuly/Katia). **Refiz a escolha pela regra, com os carimbos na mão**, e deu
outro:

| incidente | criado | aluno |
|---|---|---|
| **`1970fcaa`** | **22:01:07** | alexguardabsb (pagante de hoje) |
| `69f0aec5` | 22:08:33 | 3 alunos, rows já curadas |
| `7963388e` | 22:10:22 | kessuly + Katia |

A regra é "o mais antigo com aluno afetado". O `1970fcaa` foi aberto pelo
detector às 22:01, **antes** dos outros dois — a Rotina das 22h simplesmente não
o viu (ele nasceu no meio da ronda dela; quem o anotou foi o Vigia às 22:20).
Peguei o `1970fcaa`.

---

## `1970fcaa` (#91) — Alexandre · causa raiz achada e **medida**

**O que era.** Pagante que abriu a conta **hoje** (grant +100.000 às 20:56) e
teve **3 falhas de imagem** na primeira sessão, entre 21:53 e 22:01, intercaladas
com gerações que deram certo. Erro cru: `Image fetch failed. Check access
settings or use our File Upload API instead.` — o Kie dizendo que **não
conseguiu baixar a foto de entrada que nós passamos**.

### A causa (leitura de código, confirmada)

`frontend/src/app/api/v1/images/route.ts`, handler `DELETE` (~L111). Ele monta a
lista do que apagar assim:

```
...(r.input_image_paths ?? []), r.input_image_path, r.image_path, r.video_path
```

e manda pro `deleteKeys()` **sem nenhuma guarda pra chave que mora em
`<user>/refs/`**.

Isso reintroduz **exatamente** o defeito que a pasta `refs/` foi criada pra curar
em 19/08. O cabeçalho de `lib/images/refs.ts` promete, com todas as letras: *"O
DELETE do histórico continua apagando as pastas das gerações; `refs/`
sobrevive."* Hoje **não sobrevive**. Desde 19/08 a geração grava como entrada a
chave **adotada em `refs/`** — então apagar **uma** geração do histórico apaga a
foto de referência **compartilhada**, e leva junto as outras gerações que usam a
mesma foto.

O detalhe que fecha o diagnóstico: `refs.ts` **já tem essa trava** nos outros dois
caminhos — `apagarStagingAdotado()` recusa chave dentro de `refs/` (duas guardas,
comentadas como incidente `c82c77e4`) e `apagarReferencia()` só aceita dentro do
`refs/` do dono. **Só o DELETE em massa ficou sem.**

### Por que ele foi cobrado e depois estornado

`generate/route.ts` checa `objectExists` **antes** de cobrar. Se a referência já
estivesse morta, ele levaria `400 reference_missing` e **não seria cobrado**. Ele
**foi** cobrado → a foto existia no t0 e **sumiu antes de o Kie baixar**. Ou seja:
apagou geração do histórico com outra geração **em voo**. Bate com o intervalo
débito→estorno de **8 segundos** das três falhas.

### Blast radius — censo, não amostra

Rodei um censo próprio no R2 (leitura pura, `HeadObject`), paginando a consulta
pra não cair no corte de 1000 linhas:

| | |
|---|---|
| chaves `refs/` referenciadas por geração **viva** | 522 |
| **dangling** (row viva aponta, objeto sumiu) | **60** |
| **alunos atingidos** | **17** |
| gerações vivas com referência morta | **181** |

**Não é caso isolado deste aluno.** Lista em `/tmp/refs_dangling.json` (regerável
pelo censo).

### Segundo defeito, de dinheiro, no mesmo puxão

`lib/images/finalize.ts` (~L87) reivindica a row pra falhar assim:

```
.eq("id", id).in("status", ["pending","generating"]).select()
const row = (claimed ?? [])[0];
if (!row) return;   // <— sai SEM estornar
```

Se o aluno apagar do histórico uma geração **em voo**, a row some, o claim volta
vazio e **ninguém estorna**. Aluno cobrado, sem imagem, sem estorno, **em
silêncio**. Não movi crédito por isso — conserto e crédito retroativo passam pelo
Johnny.

### Estado do aluno (conferido row a row, nunca por `kind`)

Acesso até 29/08, saldo 94.225. **14 débitos** de 525:

- **3 falhas estornadas** — conferidas por `ref_type='image_refund'`, **nunca por
  `kind`** (o estorno grava `kind='extra_purchase'`; filtrar por `kind` foi o que
  quase pagou 13 alunos em dobro).
- **4 gerações `ready`** vivas, com o arquivo conferido no R2.
- **7 débitos órfãos** (row apagada pelo próprio aluno). O Vigia observou uma
  delas — `c1039c0c` — **`ready` às 22:20**, antes de o aluno apagá-la: aqui
  órfão é entrega-depois-apagada, não falha. Débito órfão segue sendo o
  comportamento normal já medido, não detector de bug.

**Ele não está travado agora.**

### Ressalva honesta

Dos 7 órfãos eu confirmei o desfecho de **1**. Os outros **6** eu **não consigo**
separar entre "entregue e apagado" (cobrança legítima) e "apagado em voo sem
estorno" (o defeito acima) — o extrato não guarda essa diferença. Por isso **não
estornei por conta própria** e **perguntei ao aluno** no e-mail se ficou faltando
alguma imagem. Se ele disser que sim, viro estorno na hora.

---

## O que ficou feito

- **E-mail enviado** 22:5x UTC pra `alexguardabsb@gmail.com` (bcc suporte@,
  aceite SMTP confirmado): as 3 falhas **não foram cobradas**, a causa **era
  nossa**, o contorno enquanto o fix não sobe (não apagar do histórico com
  geração rodando), e duas perguntas — faltou alguma imagem? e quer o passo a
  passo da voz. Escrito **sem jargão**: nada de "R2", "Kie" ou "refs/".
  - Sobre a voz eu segui a ressalva do Vigia: ele tem 0 vozes, mas **não há
    evidência de que tenha tentado treinar e falhado** (passou a sessão inteira
    em imagem). Ofereci ajuda, **não** tratei como aluno travado em voz.
- **Card `f8edc1f3`** aberto pro `coder` com os **dois** consertos, mandando
  reaproveitar o `ehReferenciaSalva()` que já existe em vez de regex nova.
  Branch `feat/delete-nao-apaga-refs` + PR base `main`.
- **Incidente `1970fcaa`**: nota gravada, **1 linha afetada conferida na
  releitura**. Segue **`investigating` de propósito** — nada subiu pra produção.

---

## O que eu NÃO fiz (não conte como saudável)

- **Nada subiu pra produção.** O fix é do card `f8edc1f3`, ainda não escrito.
  Rule 14 inteira: não marco `fixed` o que não resolvi.
- **Os outros 16 alunos com referência morta não foram avisados.** É e-mail em
  massa, precisa do "pode" do Johnny (regra 8). Eles **não estão perdendo
  dinheiro** — referência morta dá `400 reference_missing` **antes** de cobrar.
  O sintoma é a foto sumir da tela, e o conserto é subir a foto de novo.
- **Não peguei o `7963388e` (kessuly/Katia) nem o `69f0aec5`.** Regra serial:
  um até o fim. Continuam sendo os próximos.
- **GPU e sweep por SSH** — não olhei. É a quarta ronda seguida com esse buraco.
- **`acf8acd6`** (fechado que segue disparando) — não reexaminei nesta ronda.
- Não confirmei **deploy** de nada, nem os commits `74ae65a`/`1e5a893` que o
  Vigia deixou pendentes.

---

## Higiene do repositório

Continuam **não commitados** na `main`, de rondas anteriores (**não são meus, não
toquei**):

- `_frank/prova/lgpd/` — untracked, dado pessoal de aluna (Kelly). A Rotina das
  22h decidiu conscientemente não commitar. **Mantenho a decisão**: evidência de
  remoção de dados não vai pro git sem alguém decidir o que pode ser versionado.
- modificados: `_frank/ferramentas/resgatar_voz.cjs`,
  `_frank/ferramentas/2026-08-21_medir_8379549c.cjs`.

Commito **apenas este arquivo**, por caminho explícito.

---

## Placar

| | |
|---|---|
| Incidentes fechados | **0** (o defeito é real e não está corrigido) |
| Causa raiz achada e medida | **1** (com censo, 17 alunos) |
| Alunos avisados | **1** (Alexandre) |
| Crédito movimentado | **0** |
| GPU gasta | **0** |
| Migration | nenhuma |
| Cards pro `coder` | 1 (`f8edc1f3`, dois consertos) |
