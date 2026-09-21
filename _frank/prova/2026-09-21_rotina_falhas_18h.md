# Ronda serial 21/09 ~18hZ — FastCloner

Serial (regra 8). Cartão do Mission Board: `7b716e4c`.

**Resumo em uma linha:** o item serial (`#207`, o mais antigo com aluno
afetado) revelou que **um alerta de 11,7h do Vigia virou 10 dias de silêncio e
uma garantia perdida** — e a causa não foi azar: **o detector de percepção é
cego a `aguardando_aluno`, então a classe real é 31 e não 18.** Aluno
respondido, decisão de dinheiro escalada, dois defeitos do detector com card.

---

## 1. Passos fixos

### 1.1 Reconciliação de envios — fecha, dois instrumentos concordando

`2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar`:

| | |
|---|---|
| lidas da pasta "Sent" | 942 |
| já tinham linha | 865 |
| fora da janela (`--corte`) | 77 |
| recusadas | 0 |
| **dentro da janela sem linha** | **0** |

Contagem fecha (942 = 942). O irmão de leitura independente
(`2026-09-18_enviados_x_tabela.cjs`) dá o mesmo veredito: **0 carta depois do
corte** fora da tabela. As 77 pré-tabela seguem sem decisão.

*(Cresceu de 937 → 942 desde a ronda das 17h; as 5 novas já nasceram com linha.)*

### 1.2 Percepção — 🔴 **a contagem que a casa vinha usando está ERRADA**

A ronda das 17h reportou "18 casam o detector, todos falso positivo". Os 18
continuam lá. **Mas o 18 é um número cego**, e isto é o achado da ronda:

```
mesma condição de palavra-chave, agrupada por status:
  investigating     18   <- o único que a casa reportava
  aguardando_aluno  13   <- NINGUÉM CONTA
  CLASSE REAL =     31
```

O `percepcao_travada.cjs` filtra, na **linha 91**,
`['open','investigating'].includes(i.status)`. Quem está em `aguardando_aluno`
não existe para nenhuma contagem.

**E `aguardando_aluno` mente sobre quem trava.** Quando o que falta é a casa
VER/OUVIR alguma coisa, quem deve o próximo passo é a **casa**, não o aluno. O
cartão recebe o rótulo, sai da fila, e ninguém volta.

Os 13, todos com aluno nomeado: `#207` (21d), `#216` (20d), `#224` (20d),
`#229` (20d), `#245` (18d), `#298` (14d), `#344` (11d), `#380` (8d), `#406`
(6d), `#444` (4d), `#455` (4d), `#472` (3d), `#473` (2d).

⚠️ **Isto já estava escrito e se perdeu.** A ronda de 20/09 ~23hZ registrou a
mesma cegueira na nota do `#245`. A ronda das 17h de hoje reportou "18" mesmo
assim. Por isso virou **card de código** e não mais uma nota: nota sobre
instrumento cego não sobrevive à ronda seguinte.

**Falso negativo é pior que falso positivo.** Os 18 fazem ruído; os 13 escondem
aluno esperando. O §2 é o preço disso, medido em dinheiro.

### 1.3 Fila

93 abertos (2 `open` + 91 `investigating`), 42 com 7+ dias. Não-lidos do
`suporte@`: **0** — logo, não há resposta de aluno por ler.

---

## 2. O item serial: `#207` (Márcio, `contato@fotoatleta.com`) — 21 dias

Peguei por ser **o mais antigo com aluno afetado**. O que o prendia era um
alerta do Vigia de **11/09 12:17Z que nunca foi executado**.

### 2.1 A sequência, medida ao vivo — não herdada da nota

| quando | o quê |
|---|---|
| 31/08 18:52Z | ele pede **cancelamento e reembolso POR ESCRITO** (INBOX uid 393) |
| 31/08 19:00–19:05Z | a casa promete retorno **4×** (Enviados 395/396/397/398), uma delas *"ainda hoje"* |
| 01/09 17:53Z | **última** carta a ele (uid 425) — e era sobre a **voz**, não sobre o dinheiro |
| 05/09 14:29Z | **R$ 97 APPROVED** (HP2131614976) |
| 06/09 | assinatura cancelada (essa parte funcionou) |
| 11/09 12:17Z | Vigia avisa: garantia vence em **~11,7h**. **Ninguém age.** |
| 11/09 fim do dia | garantia vence |
| 13/09 09:39Z | a cobrança **COMPLETA**, sem devolução |
| 21/09 | 20 dias de silêncio sobre o reembolso |

**A janela automática morreu DENTRO do nosso silêncio, não do dele.**

### 2.2 O que eu medi, e com que instrumento

- **`payment_events` por `buyer_email`**: HP2131614976, R$97, APPROVED 05/09,
  COMPLETED 13/09. **Nenhum** evento de reembolso/chargeback. O dinheiro está
  com a casa.
- **Garantia** pela ferramenta da casa (`2026-09-15_garantia_por_produto.cjs`):
  `compra 05/09 · fim 11/09 · FORA`. Bate com o 12/09 00:00Z do Vigia (mesmo
  instante).
- **Cartas**: 15 na pasta Sent; a última é de 01/09 e é sobre a voz.

### 2.3 Aluno respondido — carta enviada, cópia confirmada

Enviada 21/09, **Enviados uid 3111**, chave `reembolso-207-marcio`, registrada
em `emails_enviados`.

O que a carta faz, para a próxima ronda não me desmentir: assume o silêncio de
20 dias sem desculpa; confirma que o cancelamento saiu e não haverá cobrança
nova; diz que os R$97 **não foram devolvidos e estão com a casa**; explica que
o prazo automático fechou em 11/09 e que isso torna a devolução **uma decisão,
não um assunto morto**, e que venceu por culpa nossa.

**Não prometi valor. Não prometi data. Não prometi que haverá reembolso.**
Prometi **uma** coisa: resposta sim-ou-não **com motivo**, e escrever mesmo se
demorar. **Essa promessa virou dívida da casa** — quem pegar o cartão honra.

Status mantido `aguardando_aluno` porque agora ele espera **duas** coisas de
naturezas diferentes: a resposta dele (opcional) e a **decisão da casa sobre o
reembolso** (obrigatória). Quem decidir o reembolso fecha.

---

## 3. 🔴 Carlos — cobra amanhã 12:00Z, e eu corrijo a ronda das 17h

### 3.1 Dois erros meus, corrigidos

1. **Não eram 7 cartas, são 10** — 6 para `caplastica@hotmail.com`, 4 para
   `gutoassuncao16@gmail.com`, conferidas na pasta remota. A de prazo concreto
   saiu **hoje 14:45Z** nos dois endereços.
2. **Armadilha nova:** procurei primeiro por `caplastica@GMAIL.com` e recebi
   **"0 cartas"**. O endereço dele é **hotmail**. *Zero num endereço que não
   existe parece silêncio da casa e não é* — quem repetir isso manda carta em
   cima de 6. **O endereço vem do detector, nunca da memória.**

**Não mandei a 11ª carta.** O canal e-mail está esgotado, medido: 10 cartas,
2 endereços, zero resposta nos dois, fila de não-lidos = 0.

### 3.2 O argumento mudou — e isso é o que esta ronda entrega no caso

A ronda das 17h barrou o cancelamento com *"cancelar é tirar dele"*. Isso vale
para a perna **viva** e é **fraco para a órfã**:

- `MY5O3KWB` (`caplastica@hotmail.com`) é **ÓRFÃ**: `user_id` NULL, sem perfil,
  sem conta, **sem crédito entregue**. As duas cobranças dela (R$194) **não
  deram nada a ele**.
- Pela mesma orfandade, **ele não tem tela onde cancelar sozinho** — a tela só
  enxerga a assinatura da conta logada. **Mesma família do Filipe** (medido
  hoje 17:30Z) **e da Herineth**.

Logo não é *"tirar do aluno"*, é *"parar de cobrar por nada"*. **Isso não me
autoriza a cancelar** — a 9-C pede pedido escrito do titular e eu não a revogo
sozinho. Mas muda o fato com que o Johnny decide, e por isso foi ao grupo.

**Canal ainda não tentado:** o telefone que aparece nas duas compras. Não
liguei nem mandei WhatsApp — é ação externa.

Estado remedido ao vivo: as duas pernas renovam **22/09 12:00 UTC**, total
R$291. O comando `--orfa` já está ensaiado e provado (card `32ffdf4c`); **falta
só autorização, não falta técnica.**

---

## 4. Escalado ao GRUPO (canal correto)

Duas mensagens, ambas com relógio e ambas de decisão que **não é minha**:
o Carlos (vence amanhã, com o argumento corrigido) e o Márcio (R$97 fora de
garantia + o achado dos 13 invisíveis). Nada foi para o privado.

---

## 5. Despachado para o `coder` (dois defeitos, mesmo arquivo)

| card | defeito |
|---|---|
| `0ffd721c` (já rodando) | varre o **jsonb inteiro** de `agent_notes`; o estado mora na **última nota**. Card que um dia escreveu "assistir" casa para sempre → os 18 falsos positivos |
| novo | **cego a `aguardando_aluno`** (linha 91) → os 13 invisíveis, a classe real é 31 |

O segundo card avisa **explicitamente da colisão** com o primeiro e manda
rebasear em cima do branch dele. Dois PRs concorrentes no mesmo arquivo é a
família de branch STALE que já derrubou fix em produção 5 vezes nesta casa.

---

## 6. O que eu NÃO afirmo

- **Não afirmo que os 13 em `aguardando_aluno` estão todos travados.** O `#245`
  está nessa lista e foi **corretamente** respondido em 20/09. Afirmo que
  **ninguém os mede** — e que o `#207`, que estava lá, custou uma garantia.
- **Não afirmo que o Márcio tem direito ao reembolso.** A garantia venceu; isso
  é decisão comercial e não é minha.
- **Não afirmo a data da garantia pelo payload.** `warranty_date` vem **NULL**
  no webhook desta compra — quem consultar por ali conclui "não há garantia". A
  fonte é a **ferramenta de garantia**, não o payload. (Armadilha nova.)
- **Não afirmo que o Carlos vai responder.** 10 cartas, 17 dias, zero resposta.
- **Não afirmo que o Márcio vai responder.**

## 7. O que eu NÃO fiz

Não cancelei assinatura. Não estornei. Não mexi em crédito, carteira, acesso
nem plano. Não convoquei os 90 do SGP. Não liguei nem mandei WhatsApp. Não
gastei GPU, não apliquei migration. **Não li a planilha** (ordem de 29/08).
Hotmart só por GET. **Escrevi para UM aluno** (Márcio, §2.3) — nenhum outro.

## 8. Fica nomeado para a próxima ronda

1. 🔴 **Carlos** — se o "pode" chegou, cancelar a órfã na hora pelo 9-C. Se não
   chegou e passou de 12:00Z, a 3ª R$97 caiu e o caso vira devolução.
2. 🔴 **Márcio `#207`** — a casa **deve** a ele uma resposta sim-ou-não com
   motivo sobre os R$97. Promessa minha, feita por escrito.
3. **Os 12 restantes em `aguardando_aluno` travados em percepção** (§1.2) — o
   `#207` era o mais velho e está tratado; sobram `#216`, `#224`, `#229` (20d,
   última nota 02/09 → 19 dias de silêncio), depois `#298`, `#344`, `#380`,
   `#406`, `#444`, `#455`, `#472`, `#473`.
4. 🔴 **Os 90 do SGP** — segue sem o "pode"; 18 pagam hoje por janela que não
   usam.
5. **Conferir os 2 PRs do detector** e que não ficaram branches concorrentes.
6. **Segunda perna do `#510`**: `ingest` casa por assinatura sem filtro de status.
7. **Ponto cego da Nassara**: quem tem 2+ assinaturas e foi creditado só numa.
8. **`#407`**, **`#226`**, **`#343`/`#324`** — sem retorno humano / falta escolha.
9. **`feat/resumo-diario-grupo-suporte`** — decisão do Lucas de 04/09 nunca subiu.

## 9. Armadilhas registradas nesta ronda

1. **Endereço errado devolve zero que parece silêncio.** `caplastica@gmail.com`
   → 0 cartas; o real é `@hotmail.com` → 6 cartas. Endereço sai do detector,
   nunca da memória. (§3.1)
2. **`warranty_date` vem NULL no payload** do webhook. Use a ferramenta de
   garantia. (§6)
3. **`payment_events` não tem coluna `transaction`** — é
   `payload->'data'->'purchase'->>'transaction'`. Imprimi o erro cru (42703)
   em vez de aceitar vazio.
4. **Supabase devolveu 502 (Cloudflare) 3× seguidas** numa consulta pesada
   (jsonb de 111KB) enquanto uma consulta leve passava. **502 não é zero** —
   reconferi que o banco estava de pé antes de concluir qualquer coisa.
5. **Filtro de status é a mesma família do "0 abertos" de 19/08.** Já mordeu a
   casa 3 vezes (o `fast-email:%`, o limbo de 01/09, e agora este). Instrumento
   que recorta por status precisa dizer o que deixou de fora.

## 10. Passo fixo de fim de ronda

Registro direto na `main`. Nenhum código meu nesta ronda (medição, uma nota em
cada um de 2 cartões, uma carta e dois cards) — o código dos dois defeitos do
detector vai por **PR do `coder`**, não por mim.
