# Relatório noturno — 11/09/2026 (fechado 12/09 ~01h20Z / 11/09 22h20 EDT)

Canal: ordem de 31/08 — tudo de FastCloner vai pro **grupo**, e só pro grupo.
Este arquivo é o log técnico da ronda; a mensagem do grupo é o resumo dele.

---

## 1. O que eu resolvi nesta ronda (o que é meu, não o do dia inteiro)

### Hellen — pagante parada há 5 dias que ninguém tinha visto

Achado cruzando a `varredura_travados` com `pagou_de_verdade`. É o caso mais
concreto da noite e foi tratado até onde dava.

| fato | valor |
|---|---|
| conta | `hellengrasso@gmail.com`, criada 05/09 |
| pagou | **GBP 47,94** (Fábrica de Conteúdo, `HP0846368115`) + **R$ 597,00** (Sistema de Geração Pronto, `HP0919870480`), as duas APPROVED em 05/09 |
| assinatura FastCloner | GBP 0 APPROVED 05/09 (trial) — **não é trial disfarçado de pagante: ela pagou por fora, em duas moedas** |
| crédito | 95.375, intactos |
| voz | `9bb9fccf` criada 06/09 20:26Z, `rejected_too_short` |
| erro gravado | "Recebemos apenas **2 dos 7 arquivos** que você enviou — 5 não chegaram até nós" |
| chamado aberto por isso | **nenhum**, em 5 dias |
| linha nossa pra ela | **nenhuma**, em 5 dias |

O que prova o abandono: ela usou a plataforma normalmente em 06/09 (3 imagens
`ready`, 2 Vídeo Clone `ready`, −2.625 e −2.000 cr), tentou a voz às 20:26Z,
levou a recusa, e **não houve mais nenhuma atividade na conta**.

**Dinheiro:** nada a estornar. `credit_transactions` não tem débito de treino
pra essa voz — conferi **antes** de escrever pra ela, pra não prometer errado.

**O que fiz:**
1. **E-mail individual** (regra 8 de 21/08 — caso que estou tratando é decisão
   minha). Ensaio seco, depois **cópia de teste pra mim** (Enviados uid 1936) e
   só então o envio real: **Enviados uid 1937, cópia CONFIRMADA**. O e-mail diz
   a verdade (a falha foi nossa), confirma que nada foi cobrado, ensina a
   reenviar um arquivo por vez e oferece tratar na mão sem custo se falhar de
   novo.
2. **Abri o incidente `#362`** com a medição inteira.

**Por que o `#362` nasceu `investigating` e não `fixed` (regra 14):** tratei a
**pessoa**, não a **causa**.

### A causa que o #362 registra, e que continua de pé

O `#72` (fixed em 21/08) consertou a **mensagem**: antes o aluno levava a culpa
de "áudio insuficiente" quando o upload é que tinha se perdido. A mensagem ficou
honesta. **O atendimento não existe.** Voz recusada por falha nossa de upload:

- não abre chamado,
- não entra em fila de atendimento,
- não dispara contato nenhum.

A recusa fica **só na tela**. Quem desiste em silêncio vira invisível até alguém
cruzar duas listas na mão, como aconteceu agora. Conserto proposto no incidente:
quando uma voz cai em `rejected_too_short`/`failed` por causa reconhecidamente
nossa, abrir chamado e disparar contato — o mesmo raciocínio do convite de
compra órfã.

---

## 2. O dia inteiro (consolidado das rondas de 11/09)

**9 incidentes fechados** — `#351`, `#237`, `#243`, `#352`, `#354`, `#353`,
`#355`, `#241`, `#301` (7 `fixed`, 2 `ignored`).
**11 abertos.** Saldo do dia: **+2**. Ontem foi +10 (17 abertos, 7 fechados).

**6 PRs mergeados e conferidos no ar** (detalhe na seção 4).

Dois casos de dinheiro tratados pelas rondas do dia, os dois **escalados**
porque a decisão não é minha:
- **Rodrigo Lima** (`#305`/`#306`) — pagou R$ 97,00 em 06/09 (`HP2955203673`,
  `PURCHASE_APPROVED` rec#2), **nunca criou conta**, cancelou em 07/09; o convite
  "crie sua conta" só saiu em 08/09, um dia **depois** de ele desistir. Foi
  contactado (Enviados uid 1935) com as duas saídas na mão dele. **Garantia
  vence 13/09 00:00Z = 12/09 21h BRT.**
- **Marcelo** — a casa mandou a ele, hoje 11:26Z, uma promessa que o gate
  recusa: o áudio de 47min tem **duas pessoas** (IQR de F0 152,4 Hz contra
  limiar de 100; 46,3% masculina / 53,7% feminina). Cumprir exigiria
  diarização, que não temos. Registrado na nota do `71410a81` pra ninguém
  rodar `--ignorar-locutor` e repetir o `#65`.

---

## 3. O que precisa do Johnny (nada aqui é meu pra decidir)

Todas são decisão de dinheiro, preço ou acesso de gente — lista do
`06_RELATORIO_E_LIMITES.md`.

1. **Rodrigo Lima, R$ 97,00.** Devolver? **Prazo real: 12/09 21h BRT.**
2. **Teresa (`#356`), R$ 2.809,32** — maior pedido da fila, 5 compras; a compra
   **não existe na nossa base**, só a Hotmart viva enxerga. Autoriza a
   devolução total?
3. **Victor, R$ 662,74** — garantia venceu com uma promessa escrita nossa em
   cima. Honra fora do prazo?
4. **Leandro (`#254`)** — assinatura em dobro **ativa nos dois e-mails**. A
   garantia deste ciclo já morreu, mas o próximo ciclo não depende dela:
   `access_until` pago até **28/09 e 30/09**. Cancelo a duplicada antes da
   próxima cobrança? (~2,5 semanas, não é emergência.)
5. **`#313`, 15 entitlements vitalícios de produto de CURSO** (12 pessoas, 1 já
   com plataforma viva até 2030). Honrar ou revogar? É decisão comercial
   sua/do Lucas, está parada desde 09/06.

---

## 4. O que subiu pra produção (e a prova de que está no ar)

6 PRs mergeados em 11/09:

| PR | commit | o que muda |
|---|---|---|
| #239 | `f486fe9` | varredura cruza pedido de reembolso ABERTO com o prazo (`#350`) |
| #240 | `b5a8856` | Kie: retenta 429 antes de falhar (throttle vinha como HTTP 200 + code 429) |
| #242 | `36886fa` | `reconcile` deixa de adotar entitlement de produto de CURSO (`#313`) |
| #243 | `dc3d941` | SGP: dHash 16x16 para de trancar aluno com foto DIFERENTE (`#349`) |
| #244 | `5623934`+`011bd89` | exaustão da QA de cobertura ganha reenvio automático (`#52`) |
| #245 | `1f4397a` | `#15`: refuta o "quarto cego" e registra a reserva de 360s estourada |

**Prova pelas três medidas da regra 5-B — `grep` no bundle não entra:**

1. **Hash do fonte no servidor == hash do meu `origin/main`**, 4 arquivos
   tocados hoje, todos idênticos:

| arquivo | md5 (local == servidor) |
|---|---|
| `src/lib/kie/client.ts` | `009f91fc830769263a82c632422705dc` |
| `src/lib/sgp/impressao-foto.ts` | `d2f340261cc228f22aa58ab77fee6eaf` |
| `src/lib/payments/entitlements.ts` | `e1370d3330b4845fb8597fb21f6d7ac8` |
| `src/lib/generations/reenviar.ts` | `4e1920c3fd3168685e7d61aedf18e09b` |

2. **`BUILD_ID` = `xVqAZBlpy5VjU0GZZp4YJ`**, mtime **11/09 23:53:45Z** — depois
   do último commit de código do dia (`e6868ca`, 22:52Z).
3. **pm2 `aiverse` reiniciou 11/09 23:54:39Z**, `online`, 81 restarts. Build com
   restart = código que está de fato executando.

---

## 5. Estado geral (e o que mudou de ontem pra hoje)

| medida | 10/09 | 11/09 | |
|---|---|---|---|
| incidentes abertos | 71 | **76** | +5 (um é o meu `#362`) |
| — por categoria | — | 41 atendimento / 35 técnico | |
| aguardando aluno | 12 | **10** | −2 |
| recados `para_frank_*` parados | 64 | **68** | **+4** |
| idade do recado mais velho | 223h | **247h** (01/09 18:25Z) | **+24h** |
| patches do Vigia parados | 2 | **3** | +1 |

**Idade dos 76 abertos:** 30 com menos de 3 dias · 31 entre 3 e 7 · 9 entre 7 e
14 · **5 com mais de 14 dias**.

**Varredura de filas:** nenhum aluno esperando numa fila travada. O único item
preso é **1 linha obsoleta de escrituração** (`training_jobs ebf5cc56`, cujo job
nunca saiu de `queued` mas a voz `f4b9b0f2` já está `ready`) — ninguém do outro
lado esperando. Lista de estorno em dia: 10 tipos, 3.129 linhas varridas,
nenhum tipo desconhecido.

**Pagantes com crédito e sem nenhuma voz pronta: 2.**
- `marcelopersonalthe32@gmail.com` — **33 dias**, 298.950 cr. Depende de
  **gravação nova dele**; o material atual é irresgatável sem diarização.
  Não é fila parada, é limite técnico registrado.
- `hellengrasso@gmail.com` — 5 dias. **Tratada nesta ronda** (acima).

### 🔴 O número que está piorando, e é o mesmo de ontem

**A fila de recados.** Ontem o relatório apontou 64 parados há 223h. Hoje são
**68 parados há 247h**. Ninguém processou a fila em 24 horas: ela só cresceu.
Isso é **pior que o caso que originou a regra** — 28 recados a ~70h.

Somado a isso, **3 patches do Vigia parados**, e o Vigia não consegue subir
código sozinho (regra 14-B): patch parado é conserto que **não existe**.

| chave | desde | assunto |
|---|---|---|
| `patch_7578c587` | 10/09 00:13Z | corpo de e-mail em mojibake por 1 byte ISO-8859-1 da citação do Gmail |
| `patch_81438b60` | 10/09 12:13Z | face-gate do Vídeo Clone mede o tamanho do rosto e avisa **antes de cobrar** (`#335`) |
| `patch_3dbd2bf0` | 11/09 12:12Z | SGP tela 2: dedup de foto barra foto DIFERENTE e tranca o aluno |

⚠️ O `patch_7578c587` merece conferência **antes** de aplicar: `mail-charset.ts`
foi mexido hoje pelo `#351`/`#337`, então parte dele pode já estar na `main`. Se
estiver, a chave sai com `DELETE` (nunca `set_state` com value null — `23502`,
e a chave fica).

---

## 6. O que a próxima ronda pega, em ordem

1. **A fila de recados.** Ela é a pauta, não um item da pauta. 68 recados e o
   mais velho com 10 dias — enquanto ela não baixar, o resto está sendo
   decidido às cegas.
2. **Os 3 patches**, começando pelo `7578c587` (conferir se já está na `main`).
3. **A resposta do Rodrigo** e a palavra do Johnny sobre os R$ 97 — morre
   **12/09 21h BRT**.
4. **`#356` (Teresa, R$ 2.809,32)** — rodar o `detector_preso_fora_da_conta.cjs`
   nela antes de qualquer resposta.
5. **Os antigos que não andam:** `#15` (30/07, 18 afetados), `#47`, `#99`.
   Sexta ronda seguida sem movimento.

---

## 7. Higiene do repositório (inalterada, vigésima ronda)

Seguem modificados e não commitados, em `frontend/**/sgp*` e
`frontend/messages/*`, mais não rastreados em `_frank/rascunhos/` e
`frontend/src/lib/sgp/`. **Não são meus e não toquei.** Meus arquivos de
trabalho ficaram em `/tmp`, fora do git. Este relatório foi commitado de uma
worktree limpa tirada de `origin/main`, justamente pra não varrer índice alheio
— foi o quase-acidente registrado na ronda das 20h de 08/09.
