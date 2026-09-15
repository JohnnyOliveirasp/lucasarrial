# Rotina das falhas — 15/09/2026, 15hZ (12h BRT)

Dono da fila (14-A). Repo em `main`, `pull --ff-only` limpo antes de tocar em
nada. Li `_frank/ordens/README.md`, a ordem de **20/08** (dono da fila), a de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha
desligada). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.** Canal: por ordem de **31/08**, o aviso desta ronda saiu **no
grupo**, e só no grupo.

Ronda anterior das falhas: **13hZ**. Ronda do Vigia mais recente: **14hZ**.
`now()` medido no banco na abertura = **2026-09-15 14:41:09,141Z**.

---

## 1. O serial: peguei o `#312`, e por que ele e não outro

A ronda das 13hZ conferiu os seis mais velhos e achou todos travados fora do
alcance dela. **A tabela dela começa no `#15`, de 47,0 d.** Ordenei a fila por
`first_seen_at` sem filtrar por status e apareceu, acima de todos:

| card | idade | status | alunos |
|---|---|---|---|
| **`#312`** `c726c5ae` | **97,9 d** | `aguardando_aluno` | **19** |
| `#15` `d3d8d1b2` | 47,1 d | `investigating` | 18 |

O `#312` é **o mais antigo com aluno afetado E o de mais gente sofrendo** — os
dois critérios da regra 8 apontam para ele. Ele não aparecia nas tabelas das
rondas anteriores porque `aguardando_aluno` sai do filtro de abertos.

E o motivo de ele ser desta ronda e não de outra: a nota 12 do próprio cartão
(12/09 20:54Z) agendou o passo seguinte para **hoje** — *"PROXIMO PASSO, COM
DATA: 15/09, segunda tentativa para quem nao respondeu"*. O prazo venceu nesta
ronda. **O mecanismo funcionou**: o cartão cobrou sozinho, no dia certo.

---

## 2. Cumpri a regra que o cartão deixou escrita pra quem pegasse ele

O `#312` já produziu **três vezes** o mesmo erro — afirmar que a casa nunca
falou com essas pessoas, deduzindo de ausência no nosso banco (08/09 20:50Z,
retratado em 11/09; refeito em 12/09 10:49Z, retratado em 12/09 14:46Z). A nota
12 deixou a ordem: *"Quem for reagir a este card na proxima ronda abre Enviados
ANTES de escrever qualquer frase sobre contato."*

**Abri Enviados primeiro.** Não escrevi uma linha sobre contato antes disso.

---

## 3. O achado: os 19 não são um grupo, são dois

A nota 11 afirma *"19 de 19 TEM e-mail enviado"*. **É verdade, e eu confirmei.**
Mas o que está em Enviados **não é a mesma coisa para todo mundo**, e a
diferença decide o que se escreve agora:

| grupo | quem | o que recebeu | quando |
|---|---|---|---|
| **A** | os **4** de 09/06 | uids 1345-1348, **4KB**, *"desculpa a demora, veja como comecar"* — e-mail de **remediação**, escrito à mão | 08/09 20:27Z (**7 d**) |
| **B** | os **14** de 04-05/09 | um e-mail **2KB**, *"Seu Sistema de Geração Pronto: comece por aqui"* — o **boas-vindas automático** | **no minuto da compra** (10-11 d) |

O carimbo prova qual é qual: `jgmlusvarghi` compra 04/09 16:10 → e-mail uid 822
às **16:10:49Z**; `ak@aknetzwork` compra 19:06 → **19:07:00Z**; `deivididaa`
compra 01:55 → **01:55:02Z**. Li o corpo inteiro de um (uid 1017): é um e-mail
bom, aponta `fastcloner.com/sgp` e avisa que o SGP não inclui a assinatura.

**Por que a distinção importa:** o Grupo B **nunca recebeu acompanhamento
nenhum**. O único contato deles com a casa é um recibo automático de 10-11 dias
atrás. Chamar isso de "já foi contatado" é verdadeiro no sistema e falso na
experiência da pessoa. A régua da casa (7d+ pede segunda tentativa) **já venceu
para os 14, e venceu há mais tempo que para os 4.**

`victor.inscriptio` fica fora de qualquer leva: caso próprio, `#309`/`#350`.

---

## 4. O que remedi, com o instrumento conferido antes

- **Nada se resolveu sozinho:** 19 de 19 com **zero perfil** e **zero pedido**
  em `sgp_pedidos`, chave normalizada (ponto do Gmail + domínio).
- **Ninguém respondeu:** varri a INBOX um a um. 18 de 19 devolvem *"nada
  encontrado"*. **Validei o instrumento antes de acreditar no zero** — controle
  positivo com `tuquinha36@` devolveu **15** mensagens na mesma chamada. Não é
  zero cego. **Limite declarado:** o critério é `SEEN`, então resposta ainda
  não-lida na fila da Fast não apareceria.
- **Bounce:** tentei por `emails_enviados` e voltou zero — **e eu não concluí
  nada disso.** Fui ver a tabela: ela **só começa em 14/09 14:06:31Z** e não
  alcança envios de 04-08/09. O que posso afirmar vem de outra via: nenhuma
  ficha de bounce, aberta ou fechada, tem qualquer um dos 19 em
  `affected_emails`. Sem sinal de bounce por duas vias, **com o buraco de
  cobertura declarado em vez de escondido**.

---

## 5. 🔴 A base da rejeição do conserto EXPIROU, e ninguém tinha remedido

A conclusão continua a mesma — **não widenar o `PRODUCT_ID`** — mas o **motivo
escrito no cartão já não vale**, e isso é perigoso: quem ler agora vê "`#313`
fixed" e conclui que o bloqueio caiu.

O que as notas 5 e 7 dizem: widenar seria danoso porque os 4 *"receberiam
convite para ativar a plataforma DE GRACA"*. **As duas notas são de 11/09 e
12/09 — anteriores ao fix.** O `#313` foi fechado em **13/09 00:45Z** (`36886fa`,
PR #242) e `reconcileUserEntitlements` **passou a filtrar entitlement de curso**.
O vazamento está fechado.

Medido no fonte de `origin/main` hoje, e no banco:

- `orphan-outreach.ts:215-232` monta `ultimoEnt` **sem filtrar `product_code`**.
- Os 4 têm **7 linhas**, todas de curso (`7283229`/`7283335`), todas `active`,
  todas `access_until` **NULL**, todas `user_id` **NULL**.
- `pagou` viraria true pela avulsa de curso APPROVED. `hasAccount` e `jaTemDono`
  não barram.
- ⇒ **Com o filtro widenado, os 4 receberiam o convite. Isso não mudou.**

**O que mudou é o estrago, e ele trocou de forma:** antes terminava em
plataforma vitalícia de graça (**perda de dinheiro**); depois do `#313` a conta
criada não adota mais o entitlement de curso, então o convite promete *"seus
créditos estão reservados"* e **entrega nada**. Passaríamos a mentir por escrito
para 4 pessoas que esperam há 98 dias. **O vazamento virou promessa falsa.**

Conclusão igual, motivo diferente — registrado assim de propósito.

---

## 6. Armadilha adormecida: medida, e medida como adormecida

O `ultimoEnt` sem filtro de produto é vão real: quem tivesse compra da
plataforma **e** um entitlement de curso mais novo teria o curso escolhido como
"o último". **Fui medir em vez de supor:** 13 e-mails na base têm entitlement de
curso como o mais recente, e os 13 têm **ZERO** evento de compra do `7851642`.
Como `buyers` só é alimentado por esse produto, nenhum entra no laço.
**Vítimas hoje: ZERO.** É latente, mascarada pelo próprio filtro da linha 142.

### O que eu fiz com isso: **PR #293**

Este cartão provou **três vezes** que aviso escrito em nota não sobrevive à
ronda seguinte. Então a guarda virou **código**: `ultimoEnt` passa a ignorar
linha de curso via `entitlementDaPlataforma()`, com a lista de
`produtosDeCurso()` do ambiente (a mesma do conserto e do detector, não cópia).

- `jaTemDono` **segue olhando toda linha**, de propósito — a pergunta dele é
  *"já está ligada a alguma conta?"*; filtrar produto antes dele reabriria o
  **72a4c9db** (convite pra cliente ATIVO).
- `product_code` NULL segue valendo como plataforma (guarda do `#222`).
- **Prova:** 22/22 em `orphan-outreach.test.ts` (4 testes novos, um travando o
  caso real dos 4 de 09/06), 24/24 nos vizinhos, `tsc --noEmit` **exit 0**.

**É PR ABERTO, não produção — só a `main` deploya.** Enquanto não mergear, o vão
segue aberto no código que roda. E ele **não fecha o `#312`**, não entrega nada
às 19 pessoas e **não** atende ao pedido (a) do título.

---

## 7. Status do cartão: **não mexi**, e o impulso contrário estava errado

Meu primeiro impulso foi passar para `investigating`: a espera venceu, o cartão
não espera aluno nenhum, espera **duas decisões do Johnny**. Não fiz, e escrevo
por quê:

O cartão já girou de status **três vezes**, e as duas últimas foram uma
corrigindo a outra no mesmo dia. Um quarto giro cobra dois preços já medidos e
não entrega nada: (a) o Vigia mediu que abrir este cartão faz o
`garantia_na_fila.cjs` saltar de **6 para 24** — instrumento de **dinheiro** com
número inflado, que some no ruído a dúzia que é de verdade; (b) o motivo
original do relabel não existe mais, porque o `varredura_travados.cjs` tem hoje
bloco próprio de `aguardando_aluno` com idade e aviso de 7d+ — **foi por esse
bloco que o cartão chegou na minha mão hoje, no dia previsto.**

E `investigating` também seria mentira: **não há investigação pendente.** Falta
decisão de gente. O status certo pra isso não existe no banco, e forçar o campo
errado pra expressar urgência é o que produz churn.

> **Regra que fica:** quando o bloqueio é decisão do Johnny, isso se diz no
> grupo e na nota — não se diz torcendo o campo `status`.

---

## 8. O que foi pro grupo, e o que ficou pendente com dono

Duas perguntas fechadas, porque são as duas coisas que destravam 18 pessoas:

1. **"Posso mandar a segunda carta pras 14 do Grupo B?"** — é leva, e pela regra
   8 precisa do "pode". **Com a moldura certa desta vez:** é acompanhamento de
   quem só recebeu recibo automático, **não** é primeiro contato nem segundo
   pedido de desculpas. Foi exatamente a moldura errada que a nota 11 retirou em
   12/09.
2. **"Honrar ou revogar os 15 vitalícios do `#313`?"** — parado com ele desde
   **13/09**. O Grupo A depende disso: a carta muda conforme a decisão. Se
   honrar, diz *"você tem a plataforma"*; se revogar, não pode dizer. **Escrever
   antes é escolher por ele no escuro**, pra quem já foi mal servido por 98 dias.
   Isso é bloqueio preciso, e é diferente de "aguardando aluno".

**Não escrevi para nenhum dos 19.** O Grupo B por falta do "pode"; o Grupo A
porque o conteúdo da carta depende de decisão aberta.

---

## 9. O que esta ronda diz

As rondas recentes vinham fechando um arco sobre **instrumento que mente**.
Esta é sobre outra coisa: **nota que envelhece**.

Três rondas rejeitaram o conserto deste cartão pelo mesmo argumento, e o
argumento estava certo quando foi escrito. Em 13/09 o `#313` foi fechado e
matou a premissa — e a nota continuou lá, idêntica, parecendo atual. Ninguém
mentiu e ninguém errou a medição: o texto simplesmente parou no tempo enquanto
o sistema andou. Quem chegasse hoje leria uma conclusão certa apoiada num
motivo morto, e o caminho mais natural seria concluir que o bloqueio caiu.

A conclusão sobreviveu por sorte — o novo motivo também manda não widenar. Não
era garantido. Se o `#313` tivesse fechado de outro jeito, a nota velha estaria
defendendo o contrário do que os fatos pedem.

Por isso a guarda virou PR em vez de virar a quarta nota. Este cartão tem o
registro mais denso da fila, quinze notas, e mesmo assim repetiu o **mesmo** erro
de contato três vezes. Não é falta de escrita — é que texto não é executável.
`if (!entitlementDaPlataforma(...)) continue;` não depende de ninguém ler.

O que não andou, e é o que importa pras pessoas: **18 delas continuam sem conta,
sem pedido e sem notícia** — 98 dias para quatro, 11 para catorze. Nenhuma linha
de código muda isso. Muda uma carta, e a carta depende de duas respostas que não
são minhas.

---

**O que eu NÃO fiz:** não fechei incidente, não reabri incidente, **não mudei
status de cartão nenhum**, não escrevi para nenhum aluno, não criei conta, não
mexi em crédito, acesso ou entitlement, não estornei, não cancelei assinatura,
não prometi devolução, não mandei e-mail em leva sem o "pode", não decidi sobre
os 15 vitalícios (é decisão comercial), **não afirmei "não quicou" com base numa
tabela que não alcança a data** (declarei o buraco), não li a caixa de entrada
para triagem, não mergeei nada, não mexi nos branches STALE
(`feat/fix-image-upload-retry`, `feat/onedrive-401`,
`fix/referencia-fronteira-de-frase-por-palavra`,
`feat/fabricar-referencia-fronteira-por-palavra`), não subi migration, não rodei
nada que gastasse GPU ou crédito de aluno, **não afirmei que o PR #293 está em
produção** (é PR aberto; só a `main` deploya), e **não li nem reprocessei nada da
planilha** (ordem de 29/08).
