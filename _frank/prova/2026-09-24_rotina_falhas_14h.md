# Ronda das falhas — 24/09 ~13h41–14h05Z (Frank, dono da fila)

**Desfecho: 1 incidente FECHADO até o fim (`#312` / `c726c5ae`, 15,7 dias, 19
pagantes) — fix em produção + todos os 19 com contato conferido + cartão `fixed`
com nota e commit. O conserto não precisou ser escrito: ele existia desde 08/09
no PR #214 e apodreceu 16 dias em CONFLICTING. E o achado da ronda é o que eu
NÃO fechei: esse mesmo conserto NÃO conserta o `#426`, e fechar os dois juntos
teria sido sucesso falso em cima de 349 pagantes.**

Gasto: **zero GPU, zero crédito de aluno movido, zero migration, zero DDL, zero
e-mail enviado.** Escritas: 1 merge em produção, 1 semeadura de dedupe (4
e-mails **calados**, não escritos), 1 fechamento de incidente, 2 notas de
incidente, 1 comentário de PR, este log.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=…14:06:31Z --confirmar` | **0** escriturável. **1187 = 1187**, nenhuma carta sumiu (1110 já com linha + 77 fora da janela). |
| `enviados_x_tabela` (irmão de leitura, independente) | **VEREDITO: 0 carta depois do corte.** Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho **0d**. Controles positivo (#310) e negativo (#518) OK, 534 varridos. |
| `pagante_trancado.cjs` | **0** pagante trancado · **23 na fronteira** (eram 24) · 1 sem prova (`drfabiovilhena29@`, mesmo de ontem) |
| Censo da fila | **117** abertos (−1) · **69 com 7d+** · mais velho **56,0d** |
| `esperando_johnny` | **17** parados em decisão · mais velho **56d** · **54 alunos** atrás da fila |
| `conserto_pronto_e_parado` | **38** mergeáveis parados · 24 há 3d+ · 20 apodrecidos · mais velho 35d |

### 1.1 O instrumento novo de ontem quase entregou zero cego — e ele mesmo se recusou

`conserto_pronto_e_parado.cjs` **abortou** na primeira execução: os 58 PRs
voltaram `UNKNOWN`. Ele foi escrito ontem pra **morrer** nesse caso em vez de
imprimir "0 mergeável", e foi exatamente o que fez.

A causa, medida: ele dispara os ~58 `gh pr view` **em rajada**, e o GitHub
devolve `UNKNOWN` enquanto ainda calcula a mergeabilidade. Sondando 3 PRs **um a
um**, os 3 responderam `CONFLICTING` na hora. Na segunda execução do script
(com o cálculo já disparado pela rajada anterior) ele devolveu o quadro cheio.

> **Defeito real do instrumento, anotado e não consertado nesta ronda:** falta
> uma segunda passada nos `UNKNOWN`. Hoje a ferramenta depende de ter sido
> rodada duas vezes — o que funciona por acidente, não por desenho.

## 2. Por que este cartão, e não a cabeça da fila

Desci a fila em ordem de idade. Os três primeiros seguem **fora da minha
alçada**, e conferi um a um em vez de herdar a leitura de ontem:

- **`d3d8d1b2` (56,0d, 19 alunos)** — a nota do Vigia diz "esperando merge do PR
  #404". Fui ao PR: ele é `MERGEABLE`/`CLEAN`, mas o **corpo do próprio PR
  carrega `❌ NÃO mergear — decisão do Johnny`**. Não é conserto parado por
  descuido, é decisão. Segue com ele.
- **`37bacb68` (35,8d, 22 alunos)** — a nota de ontem refutou o **4º** remédio
  da família com número e concluiu que o gargalo é a decisão (a)/(b)/(c) do
  `702cc916`. Confirmo a leitura; não é falta de investigação.
- **`f8587cef` (21,9d, 10 alunos)** — o próximo passo declarado é **esperar n
  crescer** (acumular gerações com posição) e re-medir em ~3 dias. Foi medido às
  02hZ de hoje; não há o que fazer 12h depois.

Peguei o **`#426` (8,0d, 349 contas)** pela pergunta que o Vigia deixou
explicitamente pro dono da fila em 21/09 — *"decisão de alargar o recorte deste
cartão é do dono da fila, não minha"* — e ela me levou ao `#312`.

## 3. `#312` — o conserto estava pronto e apodrecendo havia 16 dias

### 3.1 O que era

`orphan-outreach.ts` filtrava por **um** product id (`7851642`) num `continue`
**cego**, rodado **antes de todas as guardas**. Comprador do SGP (produto
`7283229`) era apagado da varredura inteira: 19 pagantes sem conta, invisíveis
ao único instrumento que os caçaria.

### 3.2 Por que ninguém tinha entregado

O PR **#214** existe desde **08/09**. Ficou **16 dias** em `CONFLICTING`. É a
medição de ontem (validade de ~8 dias do conserto nesta casa) cobrando o preço
em cima de um cartão com 19 pagantes — e o PR não é fraco: ele **refuta a
correção óbvia**. Alargar o filtro sem separar o texto mandaria *"seus créditos
do FastCloner já estão reservados"* pra quem comprou um **curso** (promessa
falsa) e, ao mesmo tempo, **não mandaria e-mail nenhum pra 15 dos 19**, porque a
guarda seguinte exige `entitlement` e o SGP não cria `entitlement` por desenho.

### 3.3 O conflito era UNIÃO, e resolvê-lo a favor do branch regrediria a main

Um arquivo conflitou, 3 hunks. A main mexeu nele **3 vezes** depois da base do
branch (`9c44e9f9`, `f9f333cf`, `dccf6472`). Os dois lados entraram:

| hunk | resolução |
|---|---|
| imports | os dois |
| guarda `hasAccount` | **main ganha** — `normalizarEmailParaComparacao` (#306, alias do Gmail). O branch trazia a versão **pré-#306** |
| envio do convite | `origem:"orfao-convite"` (main, laço do bounce) **+** `info.fastcloner.pagoEm` (estrutura nova do branch) |

**Controle de mutação, porque teste que passa só vale se pegaria a regressão:**
revertendo aquela linha pro lado do branch, `orphan-hasaccount.test.ts` vai a
**3 pass / 1 fail**; restaurada, **4/4**. Ou seja o rebase mecânico teria
desfeito **em silêncio** o conserto do `herysilva.27@` × `herysilva27@`. Mesma
família do `onedrive-401` e do `trava-foto-nova` — só que desta vez medida
**antes**.

### 3.4 Medição

- `tsc --noEmit` **exit 0** — com o binário do projeto. ⚠️ `npx tsc` nesta
  árvore imprime *"This is not the tsc command you are looking for"* e **sai 0**:
  zero cego, não vale como verde.
- suíte `payments`: **branch 263 pass / 0 fail** × **baseline `origin/main` 245
  pass / 0 fail**, mesmo comando nos dois lados. Delta **+18**, exatamente os
  testes novos.
- ⚠️ `node --test src/lib/payments/` (diretório) devolve **`fail 1`** — é o
  runner tentando `require` a pasta, não regressão. Com glob, 263/263.

### 3.5 O passo obrigatório antes do merge, executado

O PR avisava: sem semear o dedupe, 4 pessoas levam e-mail repetido. Os 4 do dry
run de 08/09 continuam sendo **exatamente os mesmos 4** hoje (as compras de
09/06). Semeados **13:54:04Z**, conferidos por releitura independente.

**Volume de e-mail no dia 1, medido: 0.** Dos 368 compradores pagos do SGP em
`payment_events`, **364 já estavam calados** e os 4 restantes foram semeados.
**Não é envio em massa** — por isso não precisou do "pode" do Johnny.

### 3.6 Zero cego que eu produzi no caminho (meu, não do código)

Medi o dedupe cruzando pelas **chaves** do `agent_state` e obtive
`calado: 0` — com 365 chaves existindo. As chaves são **transação** (`HP…`); o
e-mail mora em `.buyerEmail`, **no valor**. **O código do PR já fazia certo e
documentado**; errado estava o meu instrumento. Refeito: **364 de 368**.

> Régua: quando a minha medição discorda do código, o primeiro suspeito é a
> minha medição.

### 3.7 O que está em produção, e como sei

merge **`c81e739d`** 13:54:58Z · deploy run **36009002745** **SUCCESS** no
**mesmo sha** · conteúdo conferido **na `origin/main`** (`git cat-file`), não no
que o PR prometia. Guarda do #306 **viva** na main (linha 437).

### 3.8 Os 19 afetados

**15** com boas-vindas do webhook + **4** semeados (escritos à mão em 08/09) =
**19**. **Zero sem nenhum contato**, conferido no banco. Nenhum crédito
envolvido: SGP é **curso**, não dá crédito da plataforma (regra do Lucas 31/08).

## 4. O achado da ronda: o conserto entregue NÃO conserta o cartão que o esperava

Era tentador fechar o `#426` junto — a causa escrita nele é justamente o filtro
de produto. **Não fechei.** O lote de 04/09 é invisível por **dois motivos
independentes do filtro**:

```
349 contas  (auth.users … origem='sgp_hotmart')
            TODAS numa janela de 2h18 em 04/09 (15:07:10Z → 17:25:03Z)
            323 nunca logaram

322 / 349   NÃO TÊM NENHUMA LINHA em payment_events   ← o varredor lê só essa tabela
  0 / 349   têm registro em sgp_boas_vindas            ← ninguém foi avisado
```

E mesmo que tivessem linha, a guarda `hasAccount` as pula — elas **têm** conta.
O título do cartão já dizia isso ("a própria criação da conta os tornou
invisíveis"); o que faltava era medir que o filtro de produto é um **terceiro**
problema, não a causa deste.

**O caso nomeado:** Anderson (`#250`/`8c29740f`), **R$ 733,60 COMPLETE** na
Hotmart viva, **48 dias**. `payment_events` para ele: **ZERO** linhas — por
busca exata, `ilike`, texto cru do payload e as **duas** transações. **Controle
positivo na mesma execução:** outro comprador devolve 4 linhas, a tabela tem
**8.594**. O zero não é cego. **Corrigi a minha própria nota de 20/09 naquele
cartão**, que dizia que o que o destrava é "a entrega do #426" — a entrega
aconteceu hoje e **não o destrava**.

**O zero das boas-vindas é medido, não falta de instrumento:** o registrador
estava **vivo dentro da janela do lote** (registro mais antigo `04/09 16:10:49Z`,
11 anteriores a 05/09). Ele escrevia naquelas mesmas horas, para outras pessoas,
e não escreveu para nenhuma das 349.

**Limite que não estico:** isso prova ausência de **registro**, não que ninguém
nunca escreveu por outro caminho. O livro `emails_enviados` só começa em
**14/09 14:06:31Z**, depois do lote — dele saem 337 das 349 sem carta, mas esse
número **não responde** pela janela de 04/09 a 14/09.

## 5. O que precisa do Johnny

Sem novidade além do item 4 (doutrina de 17/09: **lote, não repetição**):

1. **WhatsApp/telefone** para os pagantes do `#249` (R$ 8.250,27) — o mesmo aval
   destrava o `94d3015d` (Sunesa, R$597, 12 dias parada nisso).
2. **Crédito do Gemini** (`olho`, `pesquisa`, `social`).
3. Decisão (c) do `#234` (`TTS_TAIL_QA_INTERNO_MODO=reprovando`) — lembrando que
   a recomendação contrária de 21/09 **foi retirada** pelo próprio Frank em
   02hZ de hoje.
4. **Quem mergeia conserto pronto** (38 parados). O `#312` de hoje é o segundo
   caso seguido em que o conserto existia e só faltava entregar.
5. 🆕 **O `#426` virou decisão comercial, não técnica.** A pergunta técnica está
   respondida. Falta: (a) o que a compra do SGP dá direito dentro do FastCloner
   (hoje: nada, regra do Lucas 31/08); (b) **"pode" pra escrever às 349** — isso
   é e-mail em massa, não mandei nada; (c) se o dinheiro das compras que **não
   entraram** em `payment_events` vai ser reconciliado da Hotmart viva. Enquanto
   (c) não sair, a casa só sabe quem pagou consultando **um a um**, à mão.

## 6. Fim de ronda

- Log commitado na **main** (regra 25-B), via worktree isolado em `/mnt/Data`.
- Conferência corrigida conforme o adendo de ontem: **`HEAD == origin/main`**
  depois do `fetch` (não `origin/main..HEAD` vazio, que passa de olhos fechados
  num checkout atrasado), e os commits da ronda conferidos por
  `merge-base --is-ancestor`.
- Escritas conferidas **na releitura**: `#312` → `fixed`, `resolved_commit`
  gravado, `resolution_note` 3.078 chars, notas 17 → 18. `#426` → nota de 5.380
  chars, 6 notas. `#250` → nota de 1.637 chars, 12 notas.
- Semeadura conferida por releitura: `orphan_invites_sgp` = **4 chaves**.
