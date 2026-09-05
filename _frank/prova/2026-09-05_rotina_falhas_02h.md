# Ronda das falhas — 05/09/2026 ~01:40–02:20Z (Frank, dono da fila)

Fila no início: **12 abertos**, 13 aguardando aluno, 3 itens presos.
A ronda anterior deixou 4 itens numerados. Fiz os 3 primeiros e o 4º virou o
achado do dia.

## 1. `setup_s` — a prova pedida ainda NÃO existe, e não é porque falhou

A ronda das ~00:55Z pediu para conferir `qa->>'setup_s'` nas gerações após o
deploy (`2026-09-05T00:52:38Z`). Rodei: **zero linhas**. Não é `setup_s` vindo
`null` — é **nenhuma geração ter rodado** depois do deploy.

**Conferi se isso era sintoma antes de reportar**, porque "nenhuma geração"
também é a cara de produção parada. Contei geração por hora nas últimas 30h:
a casa roda **1 a 5 por hora** nesse período (00hZ=4, 23hZ=1, 22hZ=1, 21hZ=1,
20hZ=4, 19hZ=4, 18hZ=5, 17hZ=6). **49 minutos sem geração está na faixa normal
da madrugada.** Não há o que investigar: falta tráfego, não instrumento.

Não disparei geração pra testar, de propósito — gastaria GPU sem aluno pedir.

**Critério pra próxima ronda não ler errado** (mesmo corte, `00:52:38Z`):
linha **com** `setup_s` preenchido = PR #184 provado; linha existindo **com**
`setup_s` null = o problema é **outro**; vazio de novo = só falta tráfego.

## 2. PR #179 mergeado — fix que estava preso fora da main

`feat/cancelar-assinatura-orfa` → merge **`249b275e`**. Revisei antes de mergear:
toca **só** `_frank/ferramentas/cancelar_assinatura.cjs` (ferramenta, não código
de produção), e a guarda nova é estreita de verdade — `soFaltaPerfil` exige
`semPerfil && ents.data.length === 1 && canceláveis.length === 1`, então o único
"problema" que ela pode engolir é o perfil ausente; mais de uma assinatura ativa
ou `external_id` divergente continuam recusando. Era um fix de 04/09 que só a
main deploya.

## 3. O achado: o Solon nunca recebeu a pergunta

O card #254 registrava *"Solon — escrito às 20hZ, sem resposta"*, com a cobrança
indevida em **06/09 12:00Z**. Antes de escalar "ele não respondeu", fui ver
**o que** ele recebeu.

O e-mail de 04/09 19:47Z (Sent uid 1024) foi mandado **só** para
`solonandrade03@gmail.com` — que é exatamente a caixa da **conta morta**
(0 voz, 0 geração, 200.000 créditos intocados). A caixa que ele usa de verdade é
`lscontabilidade813@gmail.com` (voz *"Solon - SGP"* ready, 5 áudios, 3 imagens,
88.025 cr) e a busca na pasta Sent devolveu **"nada encontrado"** para ela.

**Pedimos a confirmação no endereço que ele não lê e registramos como silêncio.**

Não foi descuido isolado: a própria ronda das 21:50Z **aprendeu a lição** e
escreveu para os **dois** endereços da lucila (1033/1034), do Carlos (1035/1036)
e do Diego (1037/1038), justificando *"quem só lê o e-mail da compra não ia ver,
e o custo de não ver é mais R$97"*. O Solon foi escrito às 19:47Z, **antes** da
lição, e nunca foi reenviado — a lição não foi aplicada retroativamente no único
caso que já tinha relógio correndo.

**O que fiz:** reescrevi para `lscontabilidade813@gmail.com` (Sent **uid 1047**,
cópia confirmada), assumindo o erro de endereço, com o prazo explícito e o pedido
de confirmação por escrito. Conferi na fonte viva antes: `POTX6UYJ` active,
`access_until` 2026-09-06 12:00Z, e as duas contas pelo `aluno.cjs`. **Não
prometi valor, prazo nem reembolso** — só o que eu controlo.

### Varri a lista atrás de outro Solon

Os **10** endereços do #254 têm pelo menos 1 e-mail na Sent — ninguém ficou sem
contato. Por data de renovação, os únicos relógios são **Solon 06/09** e
**Diego 08/09** (`4UKYMN4L` órfã + `MYEXXEMA`, R$194). O resto é 13/09+.

### Falso alarme que descartei antes de reportar

`nassaramesquita` / `ZKJBP56C` aparece `active` com `access_until` **30/08, no
passado** — pela regra do `recomputeProfileAccess` isso seria aluna pagando e
trancada. **Não é:** ela tem outro entitlement (compra de 24/07) que lhe dá
acesso até **24/09**, confirmado pelo `aluno.cjs`. Validade vencida de **uma**
linha não é sinônimo de aluno sem acesso.

## 4. #222 — a causa, com o escopo cravado

Medi a população na fonte, sem herdar número: **89** entitlements com
`user_id NULL`, dos quais **34** `active` com acesso vivo. A classe **não está
drenando sozinha**.

**Não refiz as medições de chave, de propósito** — a nota de 04/09 ~15hZ já
fechou que nenhuma chave automática resgata essa população (e-mail exato 0/42,
normalizado 0/42, CPF 2/42 com 9 ambíguos) e pediu que a próxima ronda não
gastasse o turno redescobrindo o mesmo. Obedeci.

Li a causa pra deixar o escopo cravado: `reconcileUserEntitlements`
(`entitlements.ts:127-139`) casa órfão por **um** critério —
`.is("user_id", null).ilike("buyer_email", email)`. É igualdade de e-mail, e é
por isso que as medições deram zero: **essa gente não tem conta com aquele e-mail
pra casar**. O cabeçalho do `claim.ts:12-14` já admite o limite por escrito.
Não é bug de implementação, é **limite de desenho** — nenhuma melhora de
casamento automático fecha isso.

O único caminho que atua onde a conta **passa a existir** é vínculo por
**confirmação** (aluno logado declara o e-mail da compra → link de confirmação
**para aquele e-mail** → vincula só quando ele prova que controla a caixa).
Nota técnica: dá pra fazer **sem migration**, com token assinado (HMAC) no
próprio link — o DDL não é o obstáculo. O obstáculo é que é **fluxo novo
visível pro aluno e mexe com acesso**, e eu não subo isso sozinho às 2h da
manhã. Levado ao grupo com o número medido.

## O que continua aberto (sem maquiagem)

- **Solon:** bola com ele, agora no endereço certo. Se não responder até
  ~06/09 09hZ, cancelar sem pedido escrito é **decisão do Johnny** — a 9-C não
  me autoriza sozinho.
- **Diego:** 08/09, R$194, ainda evitável.
- **Estornos** de todo mundo no #254: sem mandato.
- **4 pares de trial preventivos:** esperando o "pode".
- **#15:** causa do hang segue desconhecida; subiu o instrumento, não o conserto.

## Próxima ronda começa por aqui

1. **Solon** — conferir resposta; se nada e o relógio virou, é decisão do Johnny.
2. Repetir a consulta do `setup_s` (corte `00:52:38Z`), com o critério de leitura
   do item 1.
3. **Diego (08/09)**.
4. **#222** — se o Johnny liberar, implementar o vínculo por confirmação.
