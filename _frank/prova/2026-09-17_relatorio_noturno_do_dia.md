# 17/09 ~01hZ(18/09) — Relatório noturno do DIA 17/09

Mensagem postada **no grupo** (ordem de canal de 31/08), texto integral em
`_frank/mensagens/` equivalente ao bloco abaixo. Números remedidos nesta ronda,
nada copiado de relatório anterior.

## Medições desta ronda (todas com hora)

| medida | valor | instrumento |
|---|---|---|
| chamados abertos | **92** (ontem 87) | `varredura_travados.cjs` |
| aguardando aluno | **32** (ontem 26), **12 com 7d+**, mais velho **20d** | idem |
| itens presos | **0** | idem |
| pagante trancado | **0** · 1 sem prova (`drfabiovilhena29@`) | `pagante_trancado.cjs` |
| fila de recados | **96**, mais velho **339h (14d)** | `agent_state like 'para_frank_%'` |
| fechado sem retorno humano | 1 (#407, Luciano) | `varredura_travados.cjs` |
| lista de estorno | em dia, 10 tipos, **3.386** linhas | idem |

## O achado da noite: o throttling que era o fator de risco passou

A ronda das 11:28 gravou os contadores do endpoint `9get7wv7trn3wg` de propósito,
para que **esta** ronda tivesse delta. Tem:

| | 17/09 15:21Z | 18/09 01:04Z | delta |
|---|---|---|---|
| workers throttled | **5 de 5** | **0 de 5** | ✅ liberou |
| idle / ready | 0 / 0 | 5 / 5 | ✅ |
| completed | 3787 | **3811** | **+24** |
| failed | 219 | **219** | **+0** |
| inQueue | 0 | 0 | — |

Cruzado com o banco: `video_clones` desde 15:21Z → **22 linhas, todas `ready`,
zero `failed`**. Nas 24h: **33 `ready`, 0 `failed`**.

**Leitura honesta:** isto é boa notícia de *carga*, não de *conserto*. A fórmula
do teto (`config.ts:96-101`) continua intocada desde `f2ce527a` (12/07). O §2 da
prova de hoje mostra 7 entregas boas passando a menos de 10% da guilhotina, uma
(`bc265531`) com **1 segundo** de folga. Os jobs estão cabendo porque a GPU está
folgada, não porque a linha se moveu. **Não declaro cura.**

## Deploy provado pelas 3 provas da regra 5-B

Descobri nesta ronda que **o clone local estava desatualizado** (parado em
`7bee6312`); `origin/main` tinha avançado para `c8077e05`. Se eu tivesse
reportado sem `git fetch`, teria dito "nada subiu hoje" — **falso**. Subiram
**5 PRs**.

| prova | valor |
|---|---|
| `BUILD_ID` | `2AJjuTKLE2aZMebT0JLXx`, mtime **17/09 23:57:51Z** (merge #334 foi 23:56Z) |
| pm2 `aiverse` | `online`, uptime desde **23:58:49Z** |
| md5 fonte no servidor vs `origin/main` | `erro-runpod-pure.ts` → `d6b52fc0…` **idêntico** · `generations/[id]/route.ts` → `7ecd20c9…` **idêntico** |

PRs no ar: `f9f296d6` (#457/#461 poll grava o mesmo nome do webhook) ·
`95f36a67` (#331 COMPLETED sem upload = transitória) · `88c3feb5`+`edd0ed19`
(#439 aviso de que animar de novo apaga vídeo pago) · `9c44e9f9` (#306 alias do
Gmail) · `8e9c474d` (#334 imports .ts).

⚠️ `ed78a78f` — DDL do #439 **committado e NÃO APLICADO** de propósito (migration
de banco é decisão do Johnny). Foi como pergunta binária no relatório.

## As 7 perguntas binárias que foram pro grupo

1. Verificar `fastcloner.com` no Resend (aviso interno morto desde 03/09, HTTP 403).
2. Subir o teto de tempo do Vídeo Clone 480p-v3.
3. Aplicar o DDL do #439.
4. Carta pessoal pra `leonicemleandrosociedadeadvoca@` — **78h** sumida após a
   falha (confirmado nesta ronda: última transação 14/09 19:55Z, o próprio
   estorno; nenhum retorno desde).
5. Fechar Renata / Paulo Moura — a promessa "já levei à diretoria e acompanho"
   (e-mail 06/09) **não era verdade** e o rascunho está parado há 11 dias.
6. Os **8.930.125 cr** de 118 pessoas vencidas (regra 9-A: saldo é sempre do Johnny).
7. Allowlist `bypasses_billing` **vazia** — religar a varredura de trial hoje
   repetiria o acidente de 18/08 (14 pagantes zerados, inclusive a conta do Lucas).

## Lição desta ronda

**Relatório noturno não começa no editor, começa no `git fetch`.** Eu ia relatar
"nada subiu pra produção hoje" com base num clone parado às 11:28 — e 5 PRs
tinham entrado, um deles 67 minutos antes de eu escrever. A regra 5-B protege
contra Action verde mentindo; não protege contra **clone velho**. Acrescento ao
roteiro: antes de escrever a seção 3, `git fetch` + `BUILD_ID` no servidor, nessa
ordem. Silêncio não é a única coisa que finge saúde — desatualização também.
