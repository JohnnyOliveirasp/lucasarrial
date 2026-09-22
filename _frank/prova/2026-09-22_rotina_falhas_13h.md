# Ronda das falhas — 22/09/2026, ~12h40–13h20Z

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`).
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou
reprocessado.

**Uma linha:** item serial foi o **#172** (o mais antigo com aluno afetado,
24d) — segunda tentativa enviada com um fato novo, carta confirmada na pasta
remota; e no caminho eu **quase escalei o quarto falso positivo** da classe
"pagante trancado", com 116 pessoas e 14,6 mi de créditos, que morreu quando
fui ler o gate antes de escrever.

**Cartões fechados: 0. Alunos escritos: 1. Fix em produção: 0. Dinheiro
devolvido: 0. Escritas em banco: 1 (nota do #172).**

---

## 0. Passos fixos

| passo | resultado |
|---|---|
| `git pull --ff-only` na main | atualizado, sem divergência |
| **Reconciliar envios da pasta** (#101) | 1009 lidas · 932 já tinham linha · **0 dentro da janela sem linha** · 77 fora do corte (decisão pendente, não é defeito) |
| `percepcao_travada.cjs` (ordem 17/09) | controle positivo OK (#310) · **0 cards travados em percepção** · mais velho 0d |
| `varredura_travados.cjs` | 1 linha obsoleta (escrituração, ninguém esperando) · 103 abertos · 35 aguardando aluno · 0 fechado sem retorno |
| `2026-09-19_idade_dos_abertos.cjs` | 103 abertos · **49 com 7d+** · mais velho 21d · 2 patches · 144 recados |

Nenhum `⚠️ <tabela>:` e nenhum "consulta FALHOU" na saída — os zeros são
**medidos**, não cegos.

---

## 1. O item com relógio: `#506` segue com o Johnny

Os 3 que vencem **23/09** (jununes42, joaov.cestaro, fastcloner@americanshowerglass)
continuam sem o "pode". O pedido foi ao grupo hoje **12:05Z** e o handoff de
ontem mandava **uma** cobrança — ela já foi feita, então **não repinguei**:
reescalar de hora em hora queima o canal e não acelera decisão de gente.

Varri `agent_state` (180 chaves, 144 recados) atrás de resposta: **não há**.
Reembolso é do Johnny pela 9-A; eu não ajo sem o sim. Se passar de 23/09 sem
resposta, o próximo **não deve fingir que ainda dá** — registra que a janela
fechou e vira caso de exceção, como o `#207`.

---

## 2. Item serial: `#172` (José Ricardo, 24d, o mais antigo com aluno)

**Por que este:** regra 8 — mais antigo com aluno afetado. Estava em
`aguardando_aluno` desde 01/09 com a bola legitimamente dele, mas **21 dias de
silêncio** passam muito da régua ("parado há 7d+ pede SEGUNDA tentativa, não
silêncio"). Último contato nosso uid 424 (01/09); último login dele 01/09.

**Conferi a pasta Enviados ANTES de escrever** (este cartão já produziu o erro
oposto): 8 cartas na história, protocolo enviado **duas** vezes (uid 287 de
28/08, uid 424 de 01/09). Não reprometi documento nenhum — foi exatamente a
repromessa da Fast (uid 422) que gerou a 3ª cobrança dele.

**O fato novo que ninguém tinha contado a ele:** a assinatura parou (rec#3
OVERDUE, última paga 24/08), `access_until` venceu 13/09 — e ele tem **183.673
créditos** e 2 vozes `ready`. `pagou_de_verdade.cjs` na Hotmart viva: **pagou**
(R$ 97 COMPLETE 24/08 + R$ 791,64 em duas avulsas COMPLETE de 12/08).

**Carta enviada:** Enviados **uid 3178**, cópia CONFIRMADA, registrada em
`emails_enviados` (chave `retreino-172-jose-ricardo-2a-tentativa`). Diz: o
protocolo já está com ele e eu reenvio na hora se não achar; os 183.673
créditos continuam valendo sem reassinar; o retreino da V2 segue de pé e **sem
custo**; e a dica medida (o arquivo **mais longo** tem que ser o do tom de
conversa normal, que é de onde sai a base da voz). Não prometi que o avatar
importado do HeyGen funciona — a carta de 01/09 corrigiu que **não** funciona.

**Dívida registrada no cartão:** prometi retreino sem custo, e
`start-training` debita 10.000. Quando o áudio chegar, sai pela conta da casa
ou com estorno casado por `ref_id`.

Status: `aguardando_aluno` com **data nova**. Não fechei (regra 14: nada foi
entregue ainda).

---

## 3. O que eu QUASE reportei errado — e vale mais que o cartão

Vendo "pagou + 183.673 cr + `access_until` vencido" eu montei o detector da
classe. Ele deu **144 pessoas / 19,4 mi de créditos**. Tirei a fronteira das
12:00 (28, armadilha conhecida) e sobraram **116 firmes / 14,6 mi**, sendo
**31 com login nos últimos 14 dias** e o mais velho com 45 dias. Ia escalar
como violação da REGRA FINAL DE CRÉDITO ("mantém o acesso, não há saldo
parado"). Validei os pagamentos de 3 deles na Hotmart viva: todos pagantes de
verdade.

**Fui ler o gate antes de escrever, e o número é falso:**

- `layout.tsx:95-101` — *"Entrada LIVRE: todo usuário logado entra na
  plataforma e vê os menus. O paywall não bloqueia mais o acesso."*
- `start-training/route.ts:101-121` e `generate/route.ts:175-191` — o **402 só
  dispara em `bal.total < COST`**; o `hasActiveAccess` ali só escolhe o
  **texto do CTA** do popup.
- `voice-cloning/page.tsx:53`, `roteiro/page.tsx:52`, `images/page.tsx` —
  escrito no fonte: *"`subscribed` continua existindo SÓ pra escolher o texto
  do aviso e o CTA"*. Nenhum redirect.

**`access_until` vencido não fecha porta nenhuma. O gate de gasto é SALDO.** A
regra do Johnny **está honrada em produção** e os 116 não estão trancados.
Seria o **quarto** falso positivo desta família (147 em 18/08, 68 em 19/08,
265 em 19/09). **Não abri cartão, não escalei e não escrevi para ninguém.**

A lição virou seção própria no manual (`_frank/03_ROTINA.md`), com os
arquivo:linha, pra quinta vez não acontecer.

---

## 4. Dívida que continua crescendo (reportada, não escondida)

- **144 recados `para_frank_*`** sem tratar (eram 144 ontem; o mais velho é de
  03/09, 19 dias). Um deles (`52b22304`, #245) é percepção e **já foi
  despachado** — o `percepcao_travada.cjs` dá 0 porque lê a última nota do
  cartão, e os recados são outra fila.
- **2 patches do Vigia** esperando revisão: `patch_b6b777eb` e `patch_b5073c91`.
- Não tratei nenhum: a regra 8 é serial de propósito e o #172 levou a ronda.

---

## 5. O que eu NÃO fiz, e por quê

- Não fechei nem reabri cartão nenhum. Nada podia fechar sem mentir.
- Não devolvi dinheiro (9-A, é do Johnny — e é o que o #506 está perguntando).
- Não escrevi a mais ninguém além do José Ricardo.
- Não repinguei o #506 (a cobrança única de hoje já saiu às 12:05Z).
- Não li a planilha (ordem de 29/08).
- Não mexi em crédito, acesso, plano, assinatura, migration, nginx, RunPod ou
  GPU. Nenhum merge, nenhum PR, nenhum retreino disparado.

---

## 6. Para a próxima ronda

1. **`#506` vence AMANHÃ (23/09).** Se o Johnny respondeu, execute no dia. Se
   passou sem resposta, **registre que a janela fechou** — não finja que ainda
   dá (família do `#207`, que custou R$ 97 a um aluno).
2. **`#172`**: se ele responder com áudio, o retreino sai **pela conta da
   casa** (dívida no item 5 da nota do cartão). Se passar 7d em silêncio,
   decida entre terceira tentativa e encerrar por desistência — **não** mande
   outra repromessa.
3. **Não remonte o detector de "pagante trancado" por `access_until`.** Está
   no manual agora, com os arquivo:linha. Quatro vezes já bastou.
4. **Recados (144) e patches (2)** seguem sem dono. Escolha um e trate.
5. `emails_enviados` só cobre a partir de **14/09 14:06Z** — nunca conclua
   "nunca escreveram pra este aluno" só com ela; use a pasta Enviados.
6. `sweep-clones` continua fora da varredura por bloqueio do guard; precisa de
   invólucro como o `ask_humans.cjs` ganhou.
