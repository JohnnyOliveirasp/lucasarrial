# Ronda das falhas — 04/09/2026, 00:49Z (21:49 BRT de 03/09)

Serial: **#222** (`3ca22d47`), oitava ronda. **Não fechei.** O recorte do título
("5 alunos presos fora da conta") está endereçado; o que segue vivo é o dano de
DINHEIRO que a nota 16 abriu, e ele tem data marcada.

Canal: os dois avisos desta ronda foram pro **grupo** (`notify-grupo.sh`),
ordem de 31/08. Ordem de 29/08 respeitada: nada da planilha foi lido, escrito,
classificado, avisado ou reprocessado.

---

## 1. Fila conferida antes de escolher

`varredura_travados.cjs`: **6 incidentes abertos**, 12 em `aguardando_aluno`,
2 presos.

| # | id | aberto | alunos | assunto |
|---|---|---|---|---|
| 47 | `ce6e157d` | 19/08 | 1 | Katia — palavra cortada (reaberto 02/09) |
| 222 | `3ca22d47` | 01/09 | 5 | compra órfã / acesso preso |
| 226 | `702cc916` | 01/09 | 1 | entrega áudio que o próprio QA reprovou |
| 234 | `f8587cef` | 02/09 | 10 | palavra decapitada no meio do áudio |
| 237 | `92b1cc85` | 02/09 | 0 | "não conta nada na plataforma" |
| 246 | `933fd9d6` | 04/09 | 1 | aluno pagou curso, conta free |

**Por que não peguei o #47, que é o mais antigo:** ele foi reaberto em 02/09
porque a causa residual dele **é** o #234 (mesma classe, envelope da geração
`81d4f3f4`). E o #234 está parado numa decisão do Johnny que não é técnica:
virar o `TTS_TAIL_QA_INTERNO_MODO` custa **+16 a 19% de regen de GPU**, medido
na ronda das 17hZ. Trabalhar o #47 hoje seria refazer áudio por conta da casa —
gasto de GPU sem o aluno pedir e sem aval. Não fiz.

**Por que o #234 também não andou:** mesma trava. E o `3bc1535` continua com
`coverage_rescue` **ausente em 42 de 42** entregas pós-build — n=0 pela quarta
ronda. Não há resultado a favor nem contra.

---

## 2. O que ANDOU no #222 — os 5 do título estão com acesso

Conferido **um a um pelo `aluno.cjs`**, que é instrumento independente do
UPDATE que os consertou:

| aluno | acesso | créditos |
|---|---|---|
| `jkakoalves@` | ATIVO até 19/09 | 168.566 |
| `ftfranzolin@` | ATIVO até 11/09 | 0 |
| `cdmarciofernandes@` | ATIVO até 10/09 | 0 |
| `diretoria@grupoperes` | ATIVO até 18/09 | 11.650 |
| `gabrielalouly@` | ATIVO até 07/09 | 100.000 |

**Os dois zeros NÃO são falha silenciosa** — e eu conferi em vez de assumir.
Fernanda e Márcio têm **0 transações de crédito na vida** (controle positivo na
mesma query: `jkakoalves` = 19 linhas, tabela inteira = 22.113 — então o zero
enxerga). É o desenho: o `claim.ts` concede os 100k **no próximo login**, como a
nota 15 já tinha registrado no caso do `qooqi`. Acesso restaurado é o que o
incidente pedia; o crédito cai quando eles entrarem.

---

## 3. 🔴 O que NÃO está resolvido, e é dinheiro saindo errado

`assinatura_em_dobro.cjs` sobre as **753 assinaturas ativas** do `7851642`
(23 pessoas com mais de uma). **5 alunos com duas assinaturas PAGAS
simultâneas**, excluído o Johnny Oliveira (conta de teste a R$1):

| aluno | assinaturas | próxima cobrança errada |
|---|---|---|
| **SOLON ANDRADE** | `lscontabilidade813@` + `solonandrade03@`, R$97 cada em 13/08 | **06/09** |
| Jackson N. Alves | `jkakorio@` (órfã) + `jkakoalves@`, R$97 cada em 26/08 | 19/09 |
| Carlos A. F. Moreira | `caplastica@` (órfã) + `gutoassuncao16@`, R$291 total | 22/09 |
| lucila blanco | `blancolucila539@` + `contatoecocannabis@`, R$291 total | 23/09 e 30/09 |
| Nassara B. M. Oliveira | `nassarab@` + `nassaramesquita@`, R$291 total, **mesmo `user_id`** | — (a 2ª venceu 30/08) |

**Conferido no banco, não herdado do script:** os 10 entitlements devolvem
`status=active` numa query por `external_id` (10 linhas). A da Nassara
(`ZKJBP56C`) tem `access_until` **no passado** e `updated_at` de 07/08 — parou
de renovar, então o dano dela é histórico.

**Parei aqui de propósito:** cancelar assinatura e estornar são ação de dinheiro
e para o mundo externo. Não é minha alçada sem o "pode". Pedido no grupo com a
data do 06/09 na frente.

**Ressalva que não escondo:** *quanto* estornar depende de qual das duas é a
legítima, e no Carlos e na lucila **as duas nasceram no mesmo dia** (22/07 e
30/07). Isso não se decide por script, e eu não decidi.

---

## 4. #246 — aluno pagante, 5 pedidos, zero resposta

`jutai.santos@gmail.com`. **Pagou R$313,32 em 29/05** (HP0311339973, "Fábrica de
Conteúdo Invisível", COMPLETE). Conta criada 01/09: **sem acesso, 0 créditos,
nenhuma compra vinculada**.

**Não é bug — e provei em vez de supor.** A hipótese da classe #222 (compra
órfã sob outro e-mail) foi descartada com **controle positivo**: busca por
`jutai` em `buyer_email` e no `raw_event` cru = **0**; o controle `peres` na
mesma query = **2**; tabela = **1.084**. A query enxerga.

E o sistema nunca iria liberar: a compra é de **29/05**, o entitlement mais
antigo da tabela é de **09/06**, e o produto do curso não gera entitlement
nenhum — 1.065 dos 1.084 são do `7851642` (a assinatura).

**Ele tinha pedido 5 vezes e ninguém tinha escrito** — conferi a pasta de
Enviados: zero. Escrevi (**uid 506**, relido do IMAP, não é "o script disse que
mandou"): confirmei a compra com valor/data/transação, expliquei que curso e
assinatura são produtos separados, deixei claro que não foi erro dele, e
**não neguei nem prometi acesso** — porque isso é decisão comercial, com
precedente idêntico parado (Jesus Peres, 03/09). Pedi o print da página de
vendas caso o FastCloner estivesse anunciado junto.

Não movi pra `aguardando_aluno`: **a bola está com a gente**, não com ele.

---

## 5. O que eu NÃO fiz

Não cancelei assinatura, não estornei, não mexi em crédito, não gastei GPU, não
refiz áudio de ninguém, não virei a chave do `#234`, não apliquei migration, não
mergeei PR, não fechei nem reabri incidente, e não toquei em nada da planilha.

## 6. Pendências que continuam com o Johnny

1. **Cancelar + estornar as duplicadas** — prazo real: **06/09**.
2. **`#246`/Jesus Peres:** compra avulsa do curso dá acesso ao FastCloner?
3. **`#234`:** virar o `TTS_TAIL_QA_INTERNO_MODO` (+16-19% de regen)? Décima
   ronda com a pergunta aberta — e ela trava o `#47` junto.
4. **Migration 102** (`102_incidents_resolved_guard.sql`) segue **não aplicada**.
