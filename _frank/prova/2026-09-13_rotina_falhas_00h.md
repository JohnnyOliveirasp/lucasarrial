# Ronda das falhas — 13/09/2026, 00hZ (12/09, 21h BRT)

Dono da fila: Frank (regra 14-A). Método serial (regra 8, ordem de 21/08).
Canal: ordem de 31/08 — FastCloner sai **no grupo**, e só no grupo.

Repo em `main`, `pull --ff-only` limpo. `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa, mais as ordens de **27/08** (só erro de sistema vira
chamado) e **29/08** (planilha desligada). **Nada da planilha foi lido, escrito,
classificado ou reprocessado.**

**Item serial desta ronda:** `#313` / `2d0509b4` — o **mais antigo da fila**,
95,4 dias, 12 pessoas. **Fechado, com prova de produção.**

---

## 1. `#313` — fechado. A metade que era bug estava consertada; faltava provar

O cartão pedia duas coisas: **(a)** uma decisão comercial e **(b)** o conserto.
Cheguei nele pela regra 8 e a primeira pergunta da rotina — *já resolveu
sozinho?* — deu **meio sim**: o conserto estava na `main` desde 11/09 e ninguém
tinha conferido se pegou. O cartão seguia `investigating` com
`resolution_note` **NULA** havia 95 dias.

**O que era:** `reconcileUserEntitlements` casava TODA órfã do e-mail sem olhar
`product_code`, e o `recomputeProfileAccess` seguinte virava entitlement de
**curso** em `access_until` + crédito. Como os eventos de curso de 09/06
nasceram `active` com `access_until` NULL (vitalício), quem comprou **só o
curso** ganhava a plataforma **para sempre** no primeiro login.

**O conserto:** PR **#242**, commit `36886fa`, merge `b97e9f47`. A regra saiu
pra módulo **puro** (`acesso-regra.ts`): `entitlementDaPlataforma()` +
`produtosDeCurso()`.

### A prova, que é o que esta ronda entrega

| # | o que conferi | resultado |
|---|---|---|
| 1 | **deploy, não só merge** | workflow *Deploy Frontend (production)* em `b97e9f47`, 11/09 19:50:05Z, `success` — **+7 deploys verdes depois**, último 12/09 21:47Z. `git merge-base` confirma `36886fa` dentro dos dois shas |
| 2 | teste | `node --test acesso-regra.test.ts` = **13/13** |
| 3 | **torneira do webhook (não-circular)** | `entitlements` por produto: **7851642 = 1.230 linhas, última 12/09 23:42**; **7283335 = 12** e **7283229 = 4**, **todas de 09/06**, nenhuma depois. 3 meses sem nascer linha de curso **enquanto o produto legítimo seguiu entrando** |
| 4 | adoção parada | as 15 linhas `active`+vitalício de curso continuam **15**, em **12 pessoas**, iguais às de 08/09. **14 seguem órfãs** (`user_id` NULL); a única com dono já estava ligada **desde 30/08, antes do fix**. **Ninguém novo foi adotado** |
| 5 | o buraco deliberado do NULL | **custa zero hoje**: não existe **nenhum** entitlement com `product_code` NULL na base |
| 6 | caminho único | varredura no `frontend/src`: o único ponto que adota órfã é `entitlements.ts:157-168` (já filtrado); `claim.ts` chama **essa mesma** função; `sgp/reconciliacao.ts:41` só **lê** |

**Por que o item 3 importa:** era a parte que eu podia ter acreditado de graça.
O roteamento do webhook depende de uma variável de ambiente do servidor: se ela
não estivesse setada em produção, `roteamentoDoProduto` devolveria `"nosso"` pra
produto de fora e o `grantAccess` voltaria a criar vitalício de curso — e o
filtro do `reconcile` não seguraria nada. Em vez de ler a configuração da minha
máquina e chamar de prova, medi o **efeito** no banco: 3 meses sem linha de
curso nova, com o produto legítimo entrando até ontem à noite. A torneira está
fechada por **dois caminhos independentes**, webhook e reconcile.

**Conclusão:** os 11 que estavam *"a um login de distância"* **não estão mais**.

## 2. O que eu NÃO fechei junto, e não é bug

`drfabiovilhena29@gmail.com` segue com `access_until = 2030-01-01` e **100.000
créditos** tendo como **único** entitlement o vitalício do curso 7283335 —
**zero** linhas do produto 7851642 (a plataforma). Conferido hoje: é a única
linha dele.

Honrar ou revogar os 15 vitalícios é **decisão comercial do Johnny/Lucas, não
minha** (14-A). **Não toquei em acesso nem em crédito de ninguém.** Pela ordem
de **27/08**, decisão **não vira chamado** — então ela não ficou presa no
cartão fechado: foi **ao grupo** nesta ronda, com os números, e está escrita na
`resolution_note` com o alvo exato caso a decisão seja revogar.

Fechar o cartão sem isso teria feito a decisão sumir junto. Era o risco real
desta ronda, e é por isso que o post ao grupo faz parte do fechamento, não é
enfeite dele.

## 3. `#15` / `d3d8d1b2` (timeout) — medido, **não** fechado

Peguei o segundo mais antigo depois de fechar o primeiro. Nota nova gravada;
**status segue `investigating`** de propósito.

- **O teto de `0c306d6` pegou, medido em produção.** `elapsed_seconds` dos
  timeouts por semana: 17/08 **máx 1.811,96s** (os 30 min do teto velho) →
  24/08 **492,13s** → 31/08 **579,01s**. Quem esperava 30 min pelo estorno
  agora espera **8 a 9,6 min**.
- **Dinheiro:** os **5** timeouts desde 24/08 estão **todos estornados**, 1
  estorno cada. Conferido por `ref_id` + **`ref_type='generation_refund'`** —
  nunca por `kind`, que é a armadilha medida (o estorno grava
  `kind='extra_purchase'`). **Ninguém está no prejuízo.**
- **Silêncio de 8,2 dias** (última ocorrência 04/09 20:47:50Z; zero nas semanas
  de 07/09 e 14/09). **Não fecha o cartão:** na linha de base histórica
  (~2/semana), 8,2 dias esperariam ~2,3 eventos — zero é **sugestivo, não
  prova**, e o defeito já ficou quieto antes.
- **Segue em aberto:** a causa raiz é worker **pendurado** (hang), não régua
  curta — já medido que não correlaciona com tamanho de texto (78 chars =
  1.812s). Falta o que a ordem de 20/08 pede: instrumentar o handler pra logar
  em **qual fase** o chunk pendura. Exige observação de dias.

## 4. O item de olho que o Vigia deixou às 00hZ: andou sozinho

O clone `1e3b89a3` (`rafapaga@uol.com.br`, 945 cr), que ele registrou `pending`
há 62 min **sem** chamar de travado por não ter baseline, está agora
**`generating`** — ou seja, **avançou**, não estava preso. Ele acertou em não
abrir cartão. Os outros 3 em voo (`e65c3f71`, `4ebe5440`, `75e0e706`) são de
23:52Z, 23:55Z e 00:14Z. **Nada a abrir.**

## 5. O que eu NÃO fiz

- Não gastei GPU, não toquei em crédito, acesso, voz, assinatura nem migration.
- Não revoguei nada de ninguém e não escrevi pra aluno nesta ronda.
- Não mergeei nenhum dos branches marcados STALE no `README.md` das ordens.
- Nada da planilha (ordem de 29/08).

## 6. Fila, depois desta ronda

**80 → 79 abertos.** 10 aguardando aluno. Herdado e sem fato novo: `6c38c99d`
(Luciano, cobrança 19/09), `#312` (vence 15/09), `#335`/`#372` (os dois lados
do gate de rosto), `f8587cef`/`#234` (palavra decapitada, chave esperando aval
do Johnny desde a ronda das 23hZ).

---

## Fechamento

**Um cartão fechado até o fim, o mais antigo da fila** — 95 dias, 12 pessoas —
com o conserto provado **em produção** e não só na `main`, e a decisão
comercial entregue ao Johnny **fora** da fila, como a ordem de 27/08 manda.

O que essa ronda quase errou: o conserto já estava escrito e era fácil fechar o
cartão em cima do commit. O commit não prova que a torneira fechou — o que
prova são os 3 meses sem linha de curso nova **com o produto legítimo ainda
entrando**, e as 14 órfãs que continuam órfãs. Fechei em cima disso.
