# RONDA DAS FALHAS — 22/09/2026, ~10h40–11h05Z

Dono da fila (regra 14-A). Método serial da ordem de 21/08 (regra 8). Canal:
ordem de 31/08 — **tudo que é FastCloner sai no GRUPO** (`notify-grupo.sh`),
nada no privado do Johnny. Ordem de 29/08 respeitada: **nada da planilha** foi
lido, escrito, classificado ou reprocessado.

**Alunos escritos: 2** (Bárbara, Filipe). **Assinatura cancelada: 1**
(confirmada na fonte). **Fix em PR: 1 (#398).** **Cartões fechados: 0** — e
digo na primeira linha por quê: nenhum dos três estava pronto pra fechar sem
mentir. Dois dependem de resposta de aluno, um depende de merge + decisão de
dinheiro do Johnny.

---

## 0. Passos fixos — os três limpos

| passo | resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 998 lidas · 921 já tinham linha · 77 fora da janela · **0 escrituráveis** · contagem fecha 998=998 |
| `enviados_x_tabela.cjs` (irmão de leitura, independente) | **0 carta depois do corte** ✔ |
| `percepcao_travada.cjs` (ordem de 17/09) | controle positivo OK (#310) · 507 varridos · **0 travado em percepção**, mais velho 0d |

As 77 anteriores a 14/09 14:06:31Z seguem **sem decisão**. Não mexi:
`cobreDesde` é decisão de produção, não de ronda.

---

## 1. #519 Bárbara — respondi, e a resposta certa era o CONTRÁRIO do que o cartão supunha

Peguei primeiro por prioridade de aluno esperando: pergunta dela sem resposta
havia **~9h**, e era a pergunta que decidia se ia haver cobrança.

**Não aceitei a nota anterior. Fui à fonte viva** e o quadro tinha mudado:

| fonte | `barbaramuller` | `barbaramclone` |
|---|---|---|
| Hotmart viva | `7BETGK84` **CANCELLED_BY_CUSTOMER** | `FU0CVMYR` **ACTIVE** (próx. 29/09 12:00Z) |
| `entitlements` | canceled, até 24/09 | active, até 29/09 |
| `profiles` | pro, 100.000 cr | **pro, 100.000 cr** |
| voz `dfd7ca4f` "Minha Voz" (ready) | — | **aqui** |
| `payment_events` | `HP0284140386` R$ **0** | `HP1233307176` R$ **0** |

### Corrigi a classificação do vigia: **não é caso do #254**

O vigia das 10hZ marcou como "virou caso da classe #254" e alertou risco de
R$ 97 duplicado em 29/09. **Medi antes de somar:** o #254 é **duas pernas
ATIVAS** cobrando em paralelo porque o cancelamento pegou só numa. Aqui o
cancelamento **pegou na FONTE**, não só no nosso banco. Existe **uma**
assinatura viva, e **nenhuma das duas cobrou nada** — as duas em R$ 0. O risco
não se materializa: o que vence em 29/09 é o trial da única assinatura viva, e
R$ 97 de uma assinatura só é cobrança **correta**.

Não a incluí em `affected_emails` do #254, de propósito. Inflar a classe com
caso que não tem o defeito é o que faz a contagem parar de significar alguma
coisa — e essa classe é usada pra dimensionar prejuízo.

**O que o vigia acertou, e era o que importava:** ela estava sem resposta numa
pergunta que não tinha como responder sozinha.

### A nota de 01:28Z ficou velha em 9 minutos, e isso inverteu a resposta

Ela dizia "o material está numa conta sem crédito". Às 01:37Z a aluna assinou
na clone, e a conta virou pro/100.000 cr. **A conta que está ATIVA é exatamente
a que tem o material dela.** O conserto que a nota anterior procurava (mover
voz, dar crédito) deixou de ser necessário.

Respondi **NÃO cancele** — cancelar a clone e reassinar na muller prenderia o
material na conta cancelada, que é o laço que a trouxe até aqui. Avisei a data
de 29/09 e desfiz o aviso de 24/09 da carta anterior, que ficou obsoleto 9
minutos depois de sair. Heygen/ElevenLabs: disse que é do curso e **não chutei
plano**; foi ao grupo.

Carta **10:44:44Z**, `<frank-1790073882007-4ctzoohrnq2@fastcloner.com>`, linha
conferida em `emails_enviados`, cópia na pasta Enviados **uid 3167**.
→ `aguardando_aluno`.

---

## 2. #521 Filipe (Moyses) — cancelei, e achei um buraco maior que o pedido

Peguei porque a autorização já estava na mão e faltava **só executar**.

**Titularidade provada ANTES de agir, e não pela carta:** os `payment_events`
dos dois e-mails trazem o **mesmo telefone `11916506767`** — o mesmo que ele
assinou no e-mail. ⚠️ **O CPF existe num e vem VAZIO no outro**, e os nomes
diferem por uma inicial: **casar por nome+CPF não acha este par.** É a armadilha
da Gabriela Louly do `assinatura_em_dobro.cjs`, agora com segundo caso medido.

A ferramenta **recusou no ensaio** (sem perfil no qooqi) e só passou por
`--orfa`, com a prova forte dela: `external_id` == code da única ativa
(`OVPDAWS5` == `OVPDAWS5`).

**Conferido na fonte DEPOIS de gravar** (não aceitei a linha de sucesso do
script): `OVPDAWS5` → **CANCELLED_BY_SELLER**. Os R$ 97 de 21/10 não saem.

### O achado que ninguém tinha medido

As 3 cobranças (R$ 291) saíram da perna **órfã** — que nunca ligou em conta
nenhuma. A única conta dele: **plan=free, 0 crédito, acesso NULL, 0 geração,
0 voz, 0 transação**, um único login em 26/08.

> **Ele pagou R$ 291 e recebeu ZERO.** Não é "reembolso em análise" — é a casa
> com dinheiro de produto nunca entregue. Contradiz frontalmente a REGRA FINAL
> DE CRÉDITO ("aluno pagou, tem créditos").

**NÃO liguei o entitlement órfão nem dei crédito**, apesar de a regra apontar
pra isso: a Fast já prometeu a ele que a devolução está em análise, e entregar
acesso com um estorno em cima da mesa é o caminho pra **pagar duas vezes** — a
mesma armadilha que quase custou caro aos 13 alunos do estorno por `kind`.

Contei a verdade a ele ("você pagou R$ 291 e não recebeu nada", falha nossa),
ofereci **os dois caminhos** e pedi que **ele** escolha. Disse com todas as
letras que valor e prazo de devolução não são minha decisão — **não prometi
data nem número**. Cumpri a promessa que a Fast fez às 06:55.

Carta **10:48:11Z**, `<frank-1790074088595-bg4mdm9r0hn@fastcloner.com>`, linha
conferida, Enviados **uid 3168**. → `aguardando_aluno`.

`affected_emails` do #254: **15 → 17** (ele entra; a Bárbara não).

---

## 3. #469 — o mais velho da fila (39d), quatro rondas sem decisão. Fix em PR #398

### Varri a classe inteira antes de virar alarme

Todo `ref_id` com estorno > débito: são **4**.

| ref_id | aluno | débito | estorno | veredito |
|---|---|---|---|---|
| `600173a6` | heitorcamargo7 (18/09) | 10.000 (1×) | **20.000 (2×)** | **este bug, vivo** |
| `8aca0126` | csitya100 (15/08) | **0** | 10.000 | histórico |
| `b5ea6b9b` | personaltrainer.nelsonlopes (17/08) | **0** | 10.000 | histórico |
| `ca61b94d` | luisa13ra (14/08) | **0** | 10.000 | histórico |

Os 3 de agosto são **estorno sem débito nenhum** — classe **diferente**, e é a
que o Johnny já fechou em **17/08**; a guarda de débito nasceu em **09/09**
(`0b870d9f`) e já cobre. Não abri chamado nem escrevi pros 3.

⚠️ **O `first_seen_at` deste cartão (14/08 02:37:52.680292) é exatamente o
`created_at` da linha da luisa13ra.** O cartão nasceu do caso de agosto e foi
reaproveitado pro do Heitor, que é de **18/09**. Quem lê "39 dias" sem isso
conclui que o estorno duplo está solto há 39 dias — não está.

### O defeito, lido no código

`houveDebitoDeTreino` faz `select ... limit(1)` e devolve **boolean**.
**Existência não se gasta:** na 2ª falha da mesma voz o débito continua
existindo, passa de novo, estorna de novo. **Não é o estorno que está errado —
é a pergunta.** A voz do Heitor terminou `ready`: ele foi debitado 1×, recebeu
a voz funcionando, e levou 20.000 de volta.

### O que subiu — PR #398 (`c9d3bc75`)

Pergunta trocada por **saldo, que se gasta**: `saldoDeTreinoPendente` =
débitos(ref_id) − estornos já feitos(mesmo ref_id). O chamador devolve
`Math.min(TRAINING_CREDIT_COST, pendente)` — devolver o preço de tabela fixo
recriaria o bug por outro caminho. **Removi** `houveDebitoDeTreino` em vez de
deixar ao lado: 1 chamador só, e função com o bug intacto é como ele volta.

**Medido: 112/112 em credits+voices, `tsc --noEmit` exit 0.** Inclui
**contraprova** de que a 1ª falha continua estornando — sem ela o conserto
poderia só trocar o defeito de lado, e **crédito que sobra ninguém reporta**.
O tripwire de fonte é contra a **chamada**, não contra a menção: o comentário
cita o nome antigo de propósito, pra contar por que ela saiu.

⚠️ **PR aberto não é produção.** Enquanto o #398 não mergear, cada treino que
falhar 2× segue criando 10.000.

### O dinheiro: não executei, de propósito

Heitor hoje: 63.155 cr assinatura + **20.000 extra intactos**, acesso até
24/09. A retirada dos 10.000 não é minha (nota de 18/09, Johnny acionado) e
são **4 dias parada**. Levei ao grupo com o número. Não escrevi pro aluno: ele
está **a mais**, não em prejuízo, e anunciar retirada que pode não acontecer
seria pior que o silêncio.

### Gatilho a montante que este PR NÃO resolve

Disco cheio no worker (`training:infra_disk:no-space`, #9119254c aberto desde
10/08). O #398 impede o estorno duplo, **não** impede o treino falhar. Registro
pra não parecer coberto.

---

## 4. Falha de operação minha, registrada

Deleguei o conserto ao worker `coder`. Ele devolveu **"Coder completed (2s)"**
e o resultado real era **"Not logged in · Please run /login"**. Quase contei
como entrega. Fiz o fix eu mesmo e banquei a lição: **linha de "completed" não
prova entrega — tem que ler a saída.**

---

## 5. Placar honesto

- **Fechados: 0.** Dois aguardam aluno, um aguarda merge + decisão do Johnny.
  Nenhum podia virar `fixed` sem violar a regra 14.
- **Duas classificações do vigia corrigidas** (Bárbara não é #254; os 3 de
  agosto não são o bug vivo). As duas na direção de **não inflar** alarme.
- **Duas decisões esperando o Johnny**, ambas no grupo com número na mão: os
  R$ 291 do Filipe e os 10.000 cr do Heitor.
