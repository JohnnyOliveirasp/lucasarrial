# 16/09 ~12hZ — Ronda das falhas: o #101 fechou depois de 24 dias

Item serial desta ronda, pela regra 8 (`03_ROTINA.md` §8): **um só, até o fim**.
Fechado: **#101** — *"NAO SABEMOS SE NOSSO E-MAIL CHEGA NO ALUNO: nao existe
registro do que foi enviado e os 17 bounces na caixa nao viram nada"*
(`b2651a6f`, aberto 23/08 20:54Z, 24 dias, 5 afetados).

---

## 1. Por que este e não outro

A regra manda pegar **o mais antigo com aluno afetado**. Os três mais velhos
foram conferidos por mim nesta ronda, não herdados do relatório de ontem, e os
três estão parados **em decisão que não é minha** — com o passo nomeado dentro
de cada cartão, que é o que a §8.4 exige de quem não fecha:

| cartão | idade | passo que falta | dono |
|---|---|---|---|
| #11 | 57 d | retentativa em OOM transitória (#422) — gasta GPU | Johnny |
| #15 | 48 d | env `FASE_TELEMETRIA_SECRET` (22 d) | Johnny |
| #99 | 24 d | posicionamento sobre os R$ 97 de 26/08 | Johnny/Lucas |

O #101 é o mais antigo **onde a bola é nossa** — e a ronda das 11h53Z tinha
deixado o handoff escrito com todas as letras: *"quem pegar ele deve reconferir
a OUTRA metade do titulo e decidir o fechamento com a regua toda"*.

## 2. As duas metades do título, medidas

**Metade 1 — "não existe registro do que foi enviado".** Três caminhos, vivos:

1. cópia na pasta Enviados desde 24/08 (APPEND retentado 3× e confirmado por
   `UID SEARCH` — #210);
2. tabela `emails_enviados` desde 14/09 14:06Z — **210 linhas, 7 origens**,
   contadas agora;
3. **a carta da RONDA**, desde hoje. `366e1cd8` (PR #311) está em `origin/main`,
   merge **11:26Z**.

O item 3 era o buraco. Conferi **no código de `main`**, não no branch:
`enviar_email.cjs:367` monta a linha pelo `linhaDoEnvio` do `mail-envio.ts` com
`origem: "ronda-manual"`. E conferi **em uso**: 2 linhas `ronda-manual`, e a de
**11:51:59Z** (Marcelo, #285) saiu **já de `main`**.

**Metade 2 — "os 17 bounces na caixa não viram nada".** Hoje o bounce faz duas
coisas: vira chamado (13+ fichas *"E-mail não chegou no aluno"*, a mais recente
#401 em 14/09) **e** carimba o envio como não-entregue (2 de 2 bounces da janela
carimbados).

## 3. A peça que eu ia herdar, e fui verificar

O raciocínio fácil era: *"a carta da ronda agora tem linha, logo o bounce dela
vai ser carimbado"*. Isso é **inferência**, e o cartão inteiro nasceu de uma
inferência parecida que não se sustentou.

Fui ao código de `main`: `mail-bounce-registro.ts:209` chama `marcarNaoEntregue`
casando **só pelo `Message-ID`** — é **agnóstico à origem**. Então a carta da
ronda será carimbada como qualquer outra. Melhor ainda: o próprio código já
contava o buraco antigo num contador chamado `envio-nao-registrado`.

Deixou de ser inferência e virou leitura de código.

## 4. Dinheiro — por `ref_type`, nunca por `kind`

Os 5 afetados, medidos nesta ronda (a armadilha de 20/08 é filtrar por `kind`:
o estorno grava `kind='extra_purchase'` e some do filtro):

| aluno | situação | devido |
|---|---|---|
| `pc.sul157@gmail.com` | `image_refund` +525 ×2 em 21/08 · avisado hoje 10:49:49Z (uid 2499) | — |
| `epotentia@gmail.com` | débitos de 22/08 zerados por `perdao_negativo_onboarding` +11.575 (30/08) | — |
| `betobass27@hotmail.com` | ZERO linha em `credit_transactions` | — |
| `leusousavedder@gmail.com` | ZERO linha em `credit_transactions` | — |
| `luctec@gmail.com` | ZERO linha em `credit_transactions` | — |

**Nenhum estorno pendente, nenhum aluno esperando.** Não mexi em crédito.

## 5. O quinto e-mail, que a auditoria das 10hZ não cobria

A nota das 10hZ auditou **4 pessoas** — as dos bounces originais. Mas
`affected_emails` tem **cinco**: `luctec@gmail.com` entrou em **13/09 17:30Z**,
bem depois da abertura, e por isso ficou fora da conta.

Auditei agora: conta de 22/08, **sem acesso, 0 créditos, 0 voz, nenhuma compra**.
A ronda de 13/09 já havia provado por **três identificadores independentes**
(e-mail, nome, telefone) que não existe compra dele em `payment_events`. Nada
devido, nenhum canal aberto.

O caso dele tem cartão próprio e **continua lá**: #379, corretamente em
`investigating` (*"se ele aparecer com prova de compra, o caso muda na hora"*).
Não fechei o #379 de carona.

## 6. O que fica fora deste cartão, de propósito

O recado do Executor em 13/09 mandou a causa sistêmica de **reputação** do
`suporte@` para cá (*"isso pertence ao #101"*). **Não pertence**, e já tem dono
fechado: **#201** (550 JFE040000, spam-saída no nosso próprio relay), `fixed`.

E a classe errada do #379 já tinha explicação medida às 10h54Z: o bounce chegou
**28 minutos antes** do commit `3461733`, que adicionou `/high probability of
spam/i` ao classificador. Bug nenhum vivo — por isso não abri cartão novo nem
segurei este.

## 7. O número que não bate, e eu fecho dizendo isso

O título diz **17 bounces**. A caixa tem **13** relatórios até o instante da
abertura (12 de aluno + 1 cópia interna). A ronda das 10hZ não conseguiu
reconstruir os 4 que faltam, e **eu também não consegui**.

Fecho com a diferença declarada, em vez de escolher o número que me convém.

## 8. O limite do que este cartão passa a garantir

Sem inflar: sabemos que o e-mail **não chegou** sempre que o servidor devolve
bounce — registro + ficha + carimbo. **Entrega silenciosa** (aceita no `250` e
descartada depois, sem relatório) continua invisível. Isso é limite do SMTP, não
buraco deste cartão.

**Não observado ainda, e declaro em vez de deixar implícito:** uma carta da ronda
quicando e sendo carimbada na vida real. O conserto tem ~40 min de idade. A
cadeia está provada até a linha existir (§2) e o carimbo está provado por leitura
de código (§3), mas o evento ponta a ponta ainda não aconteceu. Se acontecer e
falhar, o cartão reabre sozinho pela assinatura.

## 9. Estado final

`status = fixed` · `resolved_at = 2026-09-16T12:04:27Z` ·
`resolved_commit = 366e1cd8` · 23 notas (concatenadas, nada sobrescrito) ·
gravação conferida na releitura, 1 linha afetada.

⚠️ Usei o **UUID inteiro** no `anotar_incidente.cjs`, não o número. Ontem passar
`"407"` casou com `4071ee9a` (que é o #399) e a nota foi parar no cartão errado.
A ferramenta resolve por **prefixo de UUID**, não por número do chamado.

**Não fiz:** não mexi em crédito, não gastei GPU, não escrevi para aluno nesta
ronda (nenhum dos 5 está esperando), não apliquei migration, não toquei no #379
nem no #374.
