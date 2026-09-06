# Ronda das falhas — 06/09, 14h52Z (11h52 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** incidente e o levei até onde ele dava.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: grupo (ordem de 31/08).

> ⚠️ Nota de nomenclatura: o log anterior está gravado como `_15h` mas foi
> commitado às 13h49Z. Nomeei este pelo horário REAL (14h52Z) pra não empilhar
> mentira no nome do arquivo. Quem for ordenar a série, olhe o commit, não o nome.

---

## 0. A ronda em uma linha

**Peguei o incidente aberto mais antigo que ainda tinha aluno no título (`#222`,
"5 alunos presos fora da própria conta") e o medi pelos dois lados. O título
está REFUTADO: os 3 alunos que o próprio card nomeia têm conta paga funcionando
hoje. E os 4 pagantes que sobraram de verdade não são resgatáveis por código
nenhum — não existe conta pra casar. A fila não tem hoje NENHUM aluno sem
tratamento; o que trava o card é decisão, não investigação.**

---

## 1. Por que peguei este

Fila no início: **21 incidentes abertos**, 13 `aguardando_aluno`, 3 presos.

O mais antigo é o `d3d8d1b2` (30/07, timeout). **Não é meu hoje**: reconferi a
nota e ele está parado no mesmo passo de 38 dias — a **migration 82** não
aplicada, que depende de aval do Johnny. Dinheiro já conferido lá (8 timeouts,
100% estornados por `ref_type='generation_refund'`). Travado em decisão alheia →
pela regra de 21/08 eu digo o passo e sigo.

Próximo mais antigo com aluno afetado: **`3ca22d47` (#222), 01/09, 5 alunos**.
Peguei este.

---

## 2. O achado: o título do card não descreve mais a realidade

Medi pelos **dois lados**, sem herdar número de ronda anterior.

### 2.1 Lado órfão → 13 entitlements sem dono, ativos

Cruzei **um a um na Hotmart viva** (`pagou_de_verdade`: valor > 0 **E**
COMPLETE/APPROVED — nunca por `raw_event`, que é foto):

| grupo | n | quem |
|---|---|---|
| pagaram a **assinatura** FastCloner | 5 | josephgois, isaias.enf, scandovieri41, ezwaymotors, caplastica |
| pagaram **só produto avulso** | 3 | gabrielalouly, viniciusjc1903, altair.nunes — direito no FastCloner é decisão COMERCIAL, não decidi |
| trial R$0, sem pagamento | 5 | — |

### 2.2 Lado do aluno → os 3 nomes do próprio card

| aluno do card | estado HOJE | veredito |
|---|---|---|
| luciane.garcia19 | pro, acesso 08/09, 100.000 cr | resolvida |
| zicasantos37 | 2ª conta `zicasantos08` pro até 19/09, **93.305 cr, já gastou 6.695** | **não está presa** |
| fduartemachado13 | 2ª conta `fermachado.coach` pro até 26/09, **188.930 cr**, R$97 APPROVED 02/09 | **não está presa** |

Nos 3 casos **o casamento por e-mail FUNCIONOU** — a compra casou com a conta
criada com o e-mail da compra. A pessoa depois criou uma **segunda** conta e
reclamou da porta errada. Isso não é o defeito descrito no card.

Detalhe que fecha o caso da Fernanda: ela abriu o chamado às **15h50** de 01/09
e logou na conta boa às **23h55 do mesmo dia** — resolveu sozinha. É o caso (1)
da rotina, "já resolveu sozinho", que é mesmo o mais comum.

---

## 3. Por que NÃO mandei conserto de `claim.ts` pro coder

Essa era a ação óbvia, e ela seria desperdício. Rodei uma rede **nova** que
nenhuma ronda tinha rodado: casar órfã com entitlement **já vinculada pelo NOME
do comprador** (mesma fonte Hotmart).

- Deu **2 de 13** — Gabriela Louly e Carlos Augusto.
- **Os dois já têm conta funcionando.** Vincular seria no-op num caso e
  **cobrança em dobro** no outro.

Somado ao que a ronda de 04/09 já mediu (e-mail exato 0/42, normalizado 0/42,
CPF 2/42 com 9 ambíguos), fecha: **não existe chave automática que resgate esta
população.** Os 4 pagantes reais não têm conta em lugar nenhum — conferido em
`profiles` (2.268 perfis, **zero** com `display_name` vazio, então a rede por
nome não é cega) e em `auth.users`. Sem conta pra casar, nenhum algoritmo
resolve: só resposta humana.

---

## 4. O que eu NÃO fiz, e por quê

**Não escrevi para ninguém — e isso foi conferido, não presumido.** Abri o
`Sent` um por um antes de decidir:

| aluno | já avisado em | ficou pendente |
|---|---|---|
| josephgois / isaias / scandovieri | 03/09 (uid 492, 493, 481) | resposta dele |
| ezwaymotors | 26/08 | resposta dele |
| zicasantos (Maria) | 31/08 (uid 402), diagnóstico idêntico ao meu | "sim/não" dela |
| Carlos Augusto | 04/09 (uid 1035/1036), "qual quer manter?" | escolha dele |

Escrever de novo seria **ruído, não atendimento**. Pela regra de 21/08, mandou e
anotou a data = saiu do meu colo.

Também não mexi em crédito, acesso, plano; não apliquei migration, não mergeei
PR, não gastei GPU, não reabri incidente e não toquei em nada da planilha.

---

## 5. Os 3 "presos" da varredura: os 3 já têm dono

Conferi cada um em vez de tratar o alarme como verdade:

1. **marcelopersonalthe32** (27 dias) — **4 e-mails** (24/08, 27/08, 29/08,
   05/09), incluindo análise manual do áudio em 8 pontos. O arquivo é uma
   entrevista com 2 pessoas; ele precisa regravar. Bola com ele.
2. **tania-araujo** (2 dias, `awaiting_training`) — **não é falha nossa**.
   `awaiting_training` quer dizer que falta o aluno clicar em "Treinar"
   (`voice-cloning/page.tsx`, incidente 137 já melhorou o aviso em 26/08). Os 6
   takes (30 min) estão lá, íntegros, e nenhum `training_job` deveria existir
   ainda. Alarme da varredura, não incidente.
3. **luanmarcal** (8 dias) — carta longa em 30/08 explicando o link fechado do
   Drive **e** que o retomar automático foi desligado, + e-mail do SGP em 04/09.
   Bola com ele.

⚠️ **Registro pro detector**: "acesso vivo + crédito + sem voz pronta" está
disparando para aluno que só precisa clicar. Aos 2 dias isso é falso positivo.

---

## 6. Precisa de DECISÃO do Johnny

1. 🔴 **O que fazer com o `#222`.** Ele não tem mais aluno sofrendo sem dono —
   tem uma **fila de espera de resposta**, que não é bug. A causa em código
   (`claim.ts:39` / `entitlements.ts:127-139`, casamento só por e-mail) segue
   literalmente no repo, mas **medida hoje não está produzindo o dano do
   título**. Recomendo **reenquadrar ou fechar**. Mantido como está, vira card
   imortal. **Não fechei sozinho**: mudar o veredito de um card de 8 rondas em
   cima de uma medição minha de um turno pede o aval de quem manda.
2. 🔴 **Migration 82** — segue sendo o único passo do `d3d8d1b2` (38 dias).
3. 🟡 Herdadas da ronda anterior e ainda de pé: o caso `jmo.usa.007` (#284,
   janela vence **09/09**), o e-mail curto aos 9 restituídos, e os 21 PRs abertos.

---

## 7. Lição que fica

**"Órfã ativa" não é sinônimo de "aluno preso".** Das 13 órfãs ativas de hoje,
2 pertencem a gente que já tem conta pro funcionando. Quem contar órfãs e
reportar o número como "alunos presos" **infla o problema — e foi exatamente
assim que este card nasceu com "5"**.

E a lição de método: a ação que parecia óbvia (mandar o `coder` consertar o
casamento por e-mail) teria queimado uma ronda inteira num conserto que **não
resgataria ninguém**. O que impediu isso foi medir a população antes de
encomendar o conserto, e conferir o `Sent` antes de escrever para o aluno.
