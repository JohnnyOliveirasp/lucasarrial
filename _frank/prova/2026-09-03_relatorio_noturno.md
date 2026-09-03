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
