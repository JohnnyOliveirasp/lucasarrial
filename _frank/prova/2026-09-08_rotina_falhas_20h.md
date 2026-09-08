# Ronda das falhas — 08/09/2026, ~20h40–21h20Z (Frank, dono da fila)

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado,
aberto ou reaberto (ordem de 29/08). Canal: **grupo** (ordem de 31/08), com os
dois fatos consumados e o pedido de decisão postados lá, nada no privado.

**Card levado adiante:** `#312` (`c726c5ae`) — o mais antigo aberto com aluno
afetado (first_seen **09/06**, 91 dias) e o de mais gente sofrendo (19).
**Estado no fim:** `#312` segue `investigating`, agora com a causa real escrita
e o conserto proposto **refutado com prova**. Abri o `#313` (`2d0509b4`), que é
o defeito que estava escondido atrás dele. Zero GPU, zero crédito, zero e-mail,
zero migration, zero linha de código de produção alterada.

---

## 0. A ronda em uma linha

**O conserto que o `#312` pedia teria entregado a plataforma vitalícia de graça
a 4 compradores de curso. O filtro de produto que o chamado manda remover é
hoje a única coisa que segura esse vazamento — e o vazamento já está vivo em 1
pessoa desde 30/08.**

---

## 1. Por que o `#312`, e não outro

A regra 8 manda pegar o mais antigo com aluno afetado, e em empate o de mais
gente sofrendo. Ordenando os 43 abertos por `first_seen_at`, o `#312` é o
primeiro (09/06) **e** o de maior número de afetados (19). Não houve empate a
desempatar. Os outros candidatos de topo (`#15`, `#222`, `#226`, `#234`, `#290`)
são todos mais novos.

## 2. Primeiro passo do playbook: já se resolveu sozinho? Não

Conferido em 08/09 20hZ: os 19 seguem com **0 perfil e 0 pedido**, 4 dias depois
de o Vigia abrir. Refiz a consulta também com **normalização de ponto do Gmail**
(a armadilha do `#222`, comprar com um e-mail e usar a conta com outro): nenhum
deles tem conta sob variante. A medição do Vigia se sustenta inteira.

## 3. O que o chamado não tinha visto: são DOIS grupos, não um

| grupo | quem | e-mail de boas-vindas do SGP | conta | pedido |
|---|---|---|---|---|
| **A — 15 pessoas** (04–05/09) | jgmlusvarghi … deivididaa | **recebeu** (`agent_state.sgp_boas_vindas`, `canais:["email"]`, **sem** a chave `conta` = pré-`cc6edb2`) | não | não |
| **B — 4 pessoas** (09/06, 91 dias) | igorfigaro.nunes, leraqorganicos, pablomikael67, fabiosaadi | **nunca recebeu nada** | não | não |

Conferido transação a transação: as **7 transações** dos 4 do grupo B não
existem como chave em `sgp_boas_vindas`. Isso bate com o comentário do
`route.ts:98-102` — os eventos do 7283229 param em 09/06 17h37Z, 73 min antes do
commit que criou o tratamento do SGP. **O grupo B é o que a casa realmente
abandonou:** pagou, nunca foi contatado, 91 dias.

O grupo A não está quebrado do mesmo jeito: recebeu o e-mail certo, e o portal
`/sgp` **não exige login** (sessão por cookie), então eles podiam ter enviado o
material. Não enviaram, em 4 dias. Isso é acompanhamento, não apagão.

## 4. Por que eu NÃO fiz o conserto que o chamado pedia

O item (a) do `#312` pede que o varredor de órfãos enxergue mais de um produto.
Medi o que aconteceria:

- **Grupo A (15):** não tem entitlement nenhum → `compradorMereceConvite`
  devolve `false` já na primeira linha (`acesso-regra.ts:80`, `if (!ent) return
  false`). Alargar o filtro seria **no-op** para eles. Isso está **correto**:
  SGP não dá a plataforma.
- **Grupo B (4):** tem entitlement `active` com `access_until` **NULL** =
  **vitalício**, criado em 09/06. Eles passam em `hasAccount` (sem perfil), em
  `jaTemDono` (`user_id` null) e em `compradorMereceConvite`
  (`entitlementValeAcesso` = true). **O filtro do `orphan-outreach.ts:142` é a
  última guarda antes do e-mail.**

O texto que eles receberiam é *"seus créditos do FastCloner já estão reservados
— crie sua conta"*. Na Hotmart viva eles compraram **curso**: "Sistema de
Geração Pronto" + "Fábrica de Conteúdo Invisível", COMPLETE, **assinaturas 0**.
Mandar esse convite é o `#290` de novo (dizer ao aluno coisa errada sobre o que
ele comprou), com o agravante de que desta vez a promessa **se cumpre**.

## 5. O defeito que estava escondido atrás — `#313` (`2d0509b4`)

`reconcileUserEntitlements` (`entitlements.ts:128-139`) casa entitlement órfã
por e-mail com `.is("user_id", null).ilike("buyer_email", e)` e **não filtra
produto**. Depois chama `recomputeProfileAccess`. Então entitlement de **curso**
entra junto com a da plataforma e vira `access_until` + crédito.

Medido em 08/09, `active` + `access_until IS NULL`:

| produto | linhas | pessoas | com conta |
|---|---|---|---|
| 7283335 (Fábrica de Conteúdo Invisível) | 11 | 11 | 1 |
| 7283229 (Sistema de Geração Pronto) | 4 | 4 | 0 |
| **total** | **15** | **12 distintas** | **1** |

(3 pessoas compraram os dois cursos e aparecem duas vezes — por isso 15 linhas e
12 pessoas. Escrevi "15 pessoas" na primeira nota do `#312` e **corrigi na
própria nota**, na mesma ronda.)

**A assinatura do bug:** o produto legítimo `7851642` tem **794** linhas `active`
e **ZERO** vitalícios. Vitalício em produto de curso é anomalia, não regra.

**O vazamento já está vivo, não é teórico.** `drfabiovilhena29` criou conta em
30/08 e hoje tem `access_until = 2030-01-01`, `credits_subscription = 100.000`
e **zero** entitlement do produto `7851642`. Tem a plataforma até 2030 sem nunca
tê-la comprado. Os outros 11 estão a **um login** do mesmo resultado.

## 6. Por que isso trava a remediação, e não é desculpa

A remediação óbvia do `#312` item (b) é criar conta para os 4 do grupo B. Fazer
isso hoje **dispara o `#313` em 4 pessoas de uma vez**, porque a reconciliação
roda no login e não olha produto. Por isso a decisão comercial vem primeiro. Não
criei conta, não escrevi para aluno, não revoguei entitlement e não toquei em
crédito.

## 7. O que foi para o grupo

1. Abertura do `#313`, com o caso já vivo (sem identificar o aluno).
2. A recusa fundamentada do conserto do `#312`.
3. **Pedido de decisão, marcado urgente:** honrar ou revogar os 15 vitalícios —
   e o aviso de que os 4 alunos de 91 dias só podem ser tratados depois disso,
   porque o que eu diria a eles muda conforme a resposta.

## 8. Ressalva honesta

`pablomikael67` — a Hotmart viva **não** lista avulsa paga para ele
(assinaturas 0, avulsas 0); o "pagou" dele vem só do nosso `payment_events`, e
ele tem um `PURCHASE_CANCELED` (HP1885747200). É a armadilha do "instrumento
cego" ao contrário: as duas fontes discordam. **Conferir caso a caso antes de
prometer qualquer coisa a ele.** Registrado na nota do `#312`.

## 9. O que NÃO está feito

1. **O `#312` continua aberto.** O passo que emperra é a **decisão comercial**
   do `#313` — não é falta de investigação.
2. **O `#313` continua aberto**, esperando a mesma decisão. O conserto de código
   (filtrar produto na reconciliação) eu não subi de propósito: mexer em regra
   de acesso sem saber se as 15 linhas vão ser honradas ou revogadas é subir
   metade de uma decisão que não é minha.
3. **Os 4 alunos de 91 dias seguem sem contato**, e isso me incomoda — mas
   escrever antes da decisão significaria prometer ou negar a plataforma no
   escuro.
4. **`#15`, `#222`, `#226`, `#234` e `#290`** seguem como estavam; não os toquei.

## 10. Higiene de fim de ronda

- Nenhum código de produção mudou. Nada a mandar por PR.
- Este log vai **direto na `main`**, como manda a ordem.
- Nada de crédito, GPU, whisper, migration, assinatura cancelada ou e-mail
  (nem individual, nem em massa).
- Script de uso único fora do git em `_Bugs/`:
  `2026-09-08_novo_incidente_vitalicio.sql`.

## 11. QUASE ACONTECEU DE NOVO: o log foi parar em branch `feat/`

O passo fixo de fim de ronda **pegou um caso ao vivo** e vale escrever, porque a
causa é diferente da de 19/08 e o ritual atual não a cobre.

Abri a ronda com `git checkout main` (respondeu *"Switched to branch 'main'"*).
Na hora de commitar, o commit `8a26423` foi parar em
**`feat/fast-nao-promete-credito-sgp`**, e o `git push origin main` respondeu
**`Everything up-to-date` com exit 0** — porque o ref `main` de fato não tinha
mudado. Sucesso aparente, log invisível.

**A causa não fui eu trocar de branch: outro processo trocou o branch do repo
por baixo de mim, no meio da ronda.** A prova é o próprio working tree, que
estava **limpo** no começo e no fim tinha `M frontend/src/lib/agent/account.ts`
e o arquivo novo `frontend/src/lib/agent/compras.ts`, que não são meus e eu não
toquei. O `HEAD` é estado do repositório, não do meu shell, então `checkout` no
início da ronda **não garante nada** na hora do commit.

**O que salvou:** `git log --oneline origin/main..HEAD` não sair vazio, e eu ter
conferido `git ls-remote` em vez de acreditar no `PUSH OK`. `Everything
up-to-date` com exit 0 é exatamente o tipo de silêncio que a ordem manda
desconfiar — o mesmo padrão do UPDATE que afeta 0 linhas.

**Conserto aplicado, sem atropelar o outro processo:** `git branch -f main
8a26423` (fast-forward de verdade, conferido com `git merge-base
--is-ancestor`), depois `git push origin main`, e **não** dei `reset --hard` no
branch de feature — as alterações não commitadas do outro processo continuam
intactas. Confirmado no fim: `origin/main = 8a26423` e o arquivo existe em
`origin/main` (`git cat-file -e`).

**Para a próxima ronda:** conferir `git branch --show-current` **imediatamente
antes do commit**, não só no início; e nunca aceitar `PUSH OK`/`Everything
up-to-date` como prova — a prova é `git ls-remote` mais o arquivo existindo em
`origin/main`.
