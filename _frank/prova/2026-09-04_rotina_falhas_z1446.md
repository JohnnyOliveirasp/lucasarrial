# Ronda das falhas — 04/09/2026, ~14:46Z (11:46 BRT)

Serial: peguei de novo o **`3ca22d47`** (#222), o **mais antigo dos abertos**
(01/09 15:54). **Não fechei.** Mas parei de drenar o chamado no varejo e fui
medir a **classe inteira** — e a medição inverte a premissa do card e
**desaconselha o conserto que estava na fila pra ser pedido**.

Canal: dois avisos foram pro **grupo** (`notify-grupo.sh`), ordem de 31/08.
Ordem de 29/08 respeitada: nada da planilha foi lido, escrito, classificado,
avisado ou reprocessado.

---

## 1. Por que não drenei mais um caso

Este card já foi drenado **7 vezes** no varejo, e a causa em
`reconcileUserEntitlements` nunca foi tocada. Drenar o 8º caso me daria uma
linha bonita no relatório e deixaria o defeito de pé. Fui medir a população.

## 2. A população real: 42, não 5 — e o reparo por e-mail nunca alcança nenhuma

`entitlements`: **89 órfãs, 42 ativas**. O título do card diz 5.

O que importa mais que o número: **das 42 ativas, ZERO tem perfil com aquele
`buyer_email`**. `reconcileUserEntitlements` (`entitlements.ts:133-137`) casa só
por `ilike(buyer_email)` — então **nenhuma delas se cura sozinha no login,
nunca**. Não é lentidão, é alcance zero.

## 3. As 42 são TRÊS populações — misturar inflava o card

Separei por `product_code`. O FastCloner é o **`7851642`** (1069 linhas, 991
usuários). Os **`7283335`/`7283229`** (R$252–512, vitalícios) são **16 linhas,
15 delas órfãs, 1 usuário** — são a dúvida comercial do **`#246`** (compra do
curso dá acesso ao FastCloner?), **não são compradores de FastCloner**.

Contar tudo junto produzia **"18 pagantes presos"**. O número honesto, no
produto certo, é **4**.

## 4. Dos 4, ninguém está preso — e todos já foram avisados

- `caplastica@` é a duplicada **já conhecida** do Carlos (ele usa
  `gutoassuncao16@`, com acesso normal). Não está preso.
- Sobram **3** sem conta nenhuma, conferidos um a um no `aluno.cjs`:
  `fmgimael@` (29/08), `malmeida313@` (31/08), `atendimento@dropweb` (02/09).

**Mas nenhum está abandonado:** os 3 já receberam **3 e-mails cada**
(*"Seus créditos estão prontos — falta só criar sua conta"*), começando no dia
seguinte à compra, pela régua automática das 14:00Z. Conferido em
`ler_caixa --enviados`. **Não mandei um 4º** — seria ruído, e a varredura avisa
exatamente isso.

**Veredito: pelo defeito deste card, hoje não há nenhum aluno pagante preso.**
Confirma a medição do Vigia das 14h por caminho independente. Falta só a causa.

## 5. A armadilha que peguei em mim antes de reportar

Usei match por **local-part** do e-mail (o caso Gabriela: comprou no `@hotmail`,
conta no `@gmail`). `atendimento@dropweb.com.br` devolveu **3 "contas
parecidas"**. Fui conferir antes de escrever: são **`clinicaelgra`,
`bibibrindes` e `clinicadrpepe`** — **empresas diferentes** com o mesmo
`atendimento@`. Se eu tivesse confiado, teria vinculado a compra de um na conta
de outro.

**Local-part é pista, não prova** — mesma família do *"cruzamento por nome"*
registrado em 03/09.

## 6. O achado principal: **não subir o fix óbvio**

A correção intuitiva — *"casa também por CPF"* — eu **medi antes de pedir**.

Controle primeiro, porque número sem controle não vale: o documento
**discrimina** (766 docs distintos em 777 linhas preenchidas; 311 sem doc).

Cruzando as 42 órfãs contra os entitlements **com dono**:

| resultado | quantas |
|---|---|
| casa com **exatamente 1** usuário (ganho real) | **2** |
| casa com **mais de um** usuário | **9** |
| sem par nenhum | 31 |

As 9 ambíguas não são ruído: são **pessoas com duas contas** (Jackson, Solon,
Carlos). Casar automático ali **joga dinheiro na conta errada**.

**Ou seja: o fix cura 2 linhas e cria risco de vínculo errado em 9. Não
recomendo, e por isso NÃO abri card pro `coder`** — abrir seria subir remendo
pela 8ª vez sem medir, que é o vício deste chamado.

**O caminho que presta é no CADASTRO, com gente no meio:** quem cria conta e tem
compra órfã batendo por CPF/telefone recebe *"achamos uma compra sua, é você?"* e
**confirma**. Vínculo por confirmação, não automático. É decisão de produto —
está com o Johnny, no grupo.

## 6-B. A segunda chave óbvia também foi medida — e também não serve

Descartado o CPF, testei **normalização de e-mail**: gmail ignora ponto e
ignora `+sufixo`, então `f.m.gimael@` e `fmgimael@` são **provadamente a mesma
caixa** — chave com risco **zero** de ambiguidade, ao contrário do CPF.

A pista não é invenção minha: existe conserto **neste repo** pra esse exato
defeito — `fix/cancelamentos-email-gmail`, commit `6c83211` (*"e-mail do gmail
com ponto dava 'sem conta' em quem tem conta"*). Só que ele conserta o
`cancelamentos_ontem.cjs`, **ferramenta de relatório**, não o caminho de
produção. (Esse branch está **só nesta máquina** — ver §11.)

**Medição:** normalizando os dois lados e cruzando as 42 órfãs ativas contra
`profiles` → **0 casariam**. Não ganha um caso.

### Consolidado das duas medições

| chave | resgata |
|---|---|
| e-mail exato (é o que roda hoje) | **0** de 42 |
| e-mail normalizado (ponto / `+sufixo`) | **0** de 42 |
| CPF | **2** de 42 — e 9 casariam com **mais de uma** conta |

Isso é evidência de que **o defeito não se resolve casando melhor**: essas
pessoas não têm conta nenhuma pra casar. Por isso o **vínculo por confirmação
no cadastro** não é preferência de estilo — é a única que atua onde a conta
**passa a existir**. Registrado no card pra próxima ronda não gastar o turno
redescobrindo as mesmas duas chaves.

## 7. O que foi pro grupo

1. **Urgente:** prazo do **Solon é 06/09** (2 dias), ~24h sem resposta; e o
   **Jackson respondeu por escrito** escolhendo a conta — falta cancelar a
   duplicada + estornar. Os dois são dinheiro: não faço sozinho.
2. O achado do #222 acima, incluindo o *"não subir o fix por CPF"* e as compras
   do curso virando acesso ativo (liga no `#246`).

## 8. Registro

Nota gravada no `3ca22d47` (`agent_notes` 25 → **26**, 1 linha afetada,
conferida na releitura). Status mantido em `investigating` — **não fechei,
porque não está resolvido**.

## 9. O que eu NÃO fiz

Não fechei, não reabri, não mudei status, não vinculei órfã na mão, não mexi em
crédito, não cancelei assinatura, não estornei, não escrevi pra aluno, não gastei
GPU, não apliquei migration, não mergeei PR, e não toquei em nada da planilha.

**Não respondi o Jackson de novo**: a Fast já respondeu às 14:05Z confirmando a
escolha dele (Enviados uid 657). O que ele espera é o cancelamento e o estorno,
não mais um e-mail.

## 10. Pendências que continuam com o Johnny

1. **Cancelar a duplicada do Solon** — prazo **06/09**, dois dias. *(sem resposta
   desde 13:49Z)*
2. **Cancelar a duplicada do Jackson + estornar R$97** — ele já escolheu por
   escrito; as duas cobram em 19/09.
3. **Estorno** das demais duplicadas (Carlos). A **lucila** segue sem decisão de
   uso — tem que ser perguntada a ela; prazo 23/09, há folga.
4. **#222:** decidir o vínculo-por-confirmação no cadastro (§6).
5. **`#246`:** compra avulsa do curso dá acesso ao FastCloner? Agora com número:
   **15 de 16** linhas desses produtos estão órfãs.
6. **`#234`:** virar o `TTS_TAIL_QA_INTERNO_MODO`.
7. **Migration 102** (`102_incidents_resolved_guard.sql`) segue não aplicada.
8. **14 branches que só existem nesta máquina** — §11.

## 11. Passo fixo: `origin/main..HEAD` vazio, mas **14 branches só locais**

`git fetch && git log --oneline origin/main..HEAD` → **vazio**. O log desta
ronda está na main (`78e8203`, pushado).

A ronda das 13:49Z achou **1** conserto preso só nesta máquina
(`feat/trocar-senha-conta`, hoje PR **#174**). Rodei o mesmo detector
(`merge-base --is-ancestor` + `branch -r --contains`) em **todos** os branches
locais: **14 não estão em nenhum lugar do servidor.** Se esta máquina morrer,
morrem com ela.

**Não vou inflar isso em "14 incêndios":** boa parte tem cara de rascunho
(`prova/…`, `frank/cancelamentos-2908`, `pr48-review`, `test/ref16-merged`).
Mas pelo menos um carrega trabalho real e útil — o `6c83211` do §6-B.

⚠️ **Tentei separar rascunho de conserto e o separador NÃO separou** — vou
dizer em vez de esconder: comparar `origin/main..<branch>` por nº de arquivos
devolve 7 a 353, e esse número é dominado por **o quanto o branch está atrasado
em relação à main**, não pelo que ele tem de único. **Não triei os 14**, e não
tenho base pra afirmar quantos carregam trabalho que a main não tem.

Fica como pendência declarada, com o método que **não** funciona já registrado.
