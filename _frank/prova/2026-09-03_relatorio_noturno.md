# Relatório noturno — 02/09/2026 (fechado 03/09 01:40Z)

Ronda de fecho do dia. Tudo abaixo foi medido nesta ronda, não herdado de
registro anterior. Onde eu não medi, está escrito que não medi.

## A descoberta do dia: 43 pessoas pagaram e nunca entraram

Números meus, desta ronda:

- `entitlements` com `user_id` nulo: **92** no total, **46** com status `active`.
- Desses 46, **43 e-mails únicos**.
- Cruzei os 43 contra `profiles`: **0 têm conta com o mesmo e-mail.**

Os 43 não são resgatáveis pelo caminho automático. O `claim.ts` credita
sozinho quando a conta nasce com o MESMO e-mail da compra — e nenhum deles
tem conta nenhuma. O acesso está ativo no nosso banco e a pessoa não existe
do lado de cá.

### Por que ninguém soube

O aviso existia. `alertOrphanPurchase`, no webhook da Hotmart, mandava
e-mail pra equipe em toda aprovação sem conta. Ele **nunca chegou em ninguém**:
665 e-mails varridos na conta do Resend entre 05/08 e 02/09, contra ~46
aprovações órfãs no mesmo período, e **zero** e-mails "Compra aprovada SEM
conta na plataforma".

A causa não foi o e-mail falhar. Foi o código não ter como saber que falhou:

```ts
await sendEmail({...});   // boolean descartado
} catch { /* best-effort */ }   // exceção engolida, catch vazio
```

Visto de fora, "avisou" e "não avisou ninguém" eram o MESMO estado. É o
mesmo defeito de forma que a casa já pagou caro duas vezes (as 43 vozes
paradas por semanas; os 28 recados que empilharam até ~70h): **silêncio
indistinguível de saúde.**

### O conserto — PR #165, não subiu sozinho

`fix/aviso-compra-orfa` (93d8f87), PR
https://github.com/JohnnyOliveirasp/lucasarrial/pull/165

1. Canal passa a ser o Telegram (mesmo par de envs do `tell_frank`); e-mail
   vira reforço, não o único caminho.
2. Registro durável em `agent_state` ANTES de tentar qualquer canal, com o
   resultado de CADA canal gravado.
3. Idempotência por entitlement — renovação não avisa de novo.
4. Aviso que não entrou em NENHUM canal vira erro em `payment_events.error`.
   HTTP segue 200 de propósito: reenvio da Hotmart não conserta canal caído.

De propósito, **não adivinha a conta do comprador**. Casar por nome ou por
prefixo de e-mail é chute, e chute aqui libera produto pago pra quem não
pagou. O vínculo continua humano.

Verificações minhas, do zero: `npx tsc --noEmit` limpo; `eslint` limpo nos 5
arquivos; **11/11** testes em `aviso-orfao.test.ts`, incluindo o payload real
do Tiago.

Foi como PR e não direto na main porque mexe no caminho do webhook de
pagamento. O código estava UNTRACKED na árvore quando esta ronda começou —
sem este commit, sumia.

## #202 reaberto: fechado com "enviado email", aluno segue com nada

`vlorandi@gmail.com` — medido agora: SEM ACESSO, 0 créditos, NENHUMA compra,
nenhum entitlement com esse `buyer_email`. O chamado tinha sido fechado às
16:17Z com `resolution_note = "enviado email"` e `resolved_commit = 5b8afad`,
que é commit de outro subsistema — o mesmo padrão já medido no #232.

Mandar e-mail não resolve o que o aluno pediu: ele diz que pagou, e só a
busca na Hotmart por CPF/nome/cartão confirma. Reaberto como `open` com nota.

⚠️ Na reabertura, `resolved_commit` **continuou** 5b8afad. É exatamente o
buraco que o PR #161 fecha, e ele segue aberto.

## Fila de recados: 22 → 16

Apaguei 6, e só os 6 cujo PEDIDO eu conferi que foi cumprido (`DELETE`, nunca
`update value = null` — `agent_state.value` é NOT NULL):

| chave | por que saiu |
|---|---|
| `33ec7f5b` | #239 Tiago: +100.000 cr em 00:27Z, conferido na conta |
| `51d86460` | #232: PR #150 merged em c26d260 |
| `d48e6a45` | #235 Alana: 993632f/16bd72e/fb06a43, PR #154 em 4782871 |
| `506b7c3a` | #223 Alana: prints lidos (uid 426/428), aluna respondida |
| `b444afcb` | #220 Alana: eb55f4f |
| `91f15c99` | #217: manual.ts em 9f1e452 |

**Os 16 que ficaram, ficaram de propósito.** O mais velho tem 121h (#99,
Luciano). Não limpo recado de caso que não foi resolvido: limpar por limpar
é o que faz o número parecer saudável enquanto a pessoa continua esperando.

## Produção — prova de ENTREGA, não de deploy

- `BUILD_ID` = `p2FogkpdKhR2apOGOGfvw`, gravado 02/09 **22:42:47Z**.
- pm2 `aiverse`: online, uptime 2h, 0 restarts instáveis.
- Rotas do dia respondendo ao vivo em `localhost:3002`:
  `/api/v1/admin/sgp` → 401, `/api/v1/voice-clips` → 401. 401 é a resposta
  certa: a rota existe e o gate funciona.
- Presentes no build: `.next/server/app/[locale]/admin/sgp` e
  `.next/server/app/api/v1/admin/sgp`.

⚠️ Correção de método minha: na primeira checagem eu procurei
`.next/server/app/admin/sgp` e dei "AUSENTE". O caminho real tem o segmento
`[locale]`. **A rota estava no ar; meu teste é que estava errado.** Registro
porque um "ausente" desses vira alarme falso na próxima ronda.

Commits depois das 22:42Z (`dae70ee`, `0c26b89`, `3f59a31`) são só registro
em `_frank/prova/` — conferi com `--stat`, nenhum toca código.

## Estado geral medido

- **Abertos: 4** — #47 (14d, 7x), #226 (1d, 290x), #234 (0d, 609x / 237
  alunos), #237 (0d).
- **Fechados hoje: 17. Abertos hoje: 10.** Saldo do dia negativo em 7.
- **Aguardando aluno: 10**, o mais velho #99 há 10 dias.
- **Presos na varredura: 2** — `marcelopersonalthe32@gmail.com` (198.950 cr,
  sem voz há 24 dias, voz `f6f82819` failed) e `luanmarcal.com@gmail.com`
  (import quebrou 29/08: arquivo do Drive não estava público).
- **Patches do Vigia esperando: 3** (`f8587cef`, `687890f5`, `702cc916`).
- **PRs abertos: 20.** #41/#42 no 11º dia.
- **GPU:** fila zero nos três endpoints (train inQueue 0; infinitetalk
  inQueue 1 com 2 em execução; voxbr 0). 3 workers `throttled`, nada a fazer
  no código.
- **Estornos:** 10 tipos, 2.690 linhas varridas, nenhum tipo desconhecido.
- **Migration 102:** 7ª ronda sem resposta.

## O que eu NÃO fiz, e por quê

- Não procurei Zica Santos nem Vinícius Lorandi na Hotmart: não tenho acesso
  à conta. Só o Johnny ou o Lucas confirmam pagamento lá.
- Não escrevi pros 43: é e-mail em massa com conteúdo novo, precisa do sim
  do Johnny (regra do 06).
- Não respondi o Márcio sobre reembolso: falar em nome da empresa sobre
  devolução de dinheiro não é minha decisão.
- Não subi o PR #165 pra produção: mexe no webhook de pagamento e merece
  segunda leitura.

---

## ⚠️ RETRATAÇÃO acrescentada em 03/09 01h55Z (ronda das falhas)

**Johnny: duas afirmações deste relatório estão erradas, e a decisão que ele te
pede está apoiada numa delas.** Não reescrevi as linhas originais de propósito —
ficam como estavam, com a correção aqui embaixo.

**1. "`vlorandi@gmail.com` — NENHUMA compra" (linha 66) está errado.** Medido
agora pela fonte de verdade (`pagou_de_verdade.cjs`, Hotmart viva):

| data | valor | transação | status |
|---|---|---|---|
| 29/08 | R$ 297,00 | HP3517088140 | APPROVED |
| 29/08 | R$ 597,00 | HP2540995505 | APPROVED |
| 30/08 | R$ 1.803,60 | HP0167002846 | APPROVED |
| | **R$ 2.697,60** | | **no próprio e-mail dele** |

O que é verdade é outra coisa, e não é a mesma: ele não tem compra **do
FastCloner**. `aluno.cjs` (nosso banco) diz "compras: NENHUMA" por isso. Ler
esse campo como verdade de pagamento é a cegueira do **#173** reencenada por
outro instrumento — as duas frases são verdadeiras em ferramentas diferentes e
foram somadas como se fossem uma.

**2. "Não procurei na Hotmart: não tenho acesso à conta. Só o Johnny ou o Lucas
confirmam pagamento lá" (linhas 132-133) está errado.** Temos acesso desde o
**PR #138** (`c5955f7`, em produção 31/08 19:39Z): o `pagou_de_verdade.cjs` lê
`/sales/history?buyer_email=`. Rodei nesta ronda, nos dois nomes citados.

**Zica Santos não precisava de busca nenhuma:** o caso dela (**#214**) já estava
apurado desde 31/08 nas notas do próprio chamado — a assinatura dela está paga e
ativa em **`zicasantos08@hotmail.com`** (entitlement até 19/09, +100.000
créditos), e ela entra na conta gratuita do gmail. Ela já foi avisada por e-mail
(uid 402) e já está usando a conta paga.

**Por que isso importa pra tua decisão:** o relatório te apresenta o caso do
Vinícius como *"não dá pra saber se ele pagou"*. Dá, e está medido: **ele pagou
R$ 2.697,60**. A pergunta que é tua não é se houve pagamento — é se **compra de
CURSO dá direito a crédito dentro do FastCloner**, a mesma do #173 (Johnathan,
R$ 2.391,00), da Cristina (R$ 185,61) e do Robert (R$ 684,92).

**O risco concreto de deixar a frase errada de pé:** a conclusão *"só a busca por
CPF/nome/cartão confirma"* manda a próxima ronda pedir o CPF ao Vinícius — prova
da qual ele já foi dispensado **por escrito** em 31/08, depois de termos pedido
a ele uma vez e ao Johnathan duas. Seria a quarta vez que a casa pede a um
pagante que prove uma compra que está na nossa mão.

Detalhe e medição na nota 9 do **#202** e no log
`_frank/prova/2026-09-03_rotina_falhas_02h.md`.
