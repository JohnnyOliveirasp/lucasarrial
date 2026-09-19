# RONDA DAS FALHAS — 19/09, ~22hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_21h.md`.

**Método serial (regra 8):** peguei **UM** cartão — o `94843173` / **#363**
(Rodrigo), o mais antigo com aluno afetado e dinheiro em cima. Ele **não fechou**,
e o passo em que travou é o mesmo de 12/09: **decisão do Johnny**. Segui para o
`132f7808` / **#249** (Glauber), que travou **no mesmo lugar**.

**E esta ronda tem uma errata contra mim, gravada 5 minutos depois do erro.**
Acusei dois cartões de estarem abandonados. Não estavam: eu li **uma coluna que
não existe**. §2.

> **O achado que resume a noite:** os dois casos que eu peguei estão parados no
> **mesmo** ponto, e não é apuração. É uma palavra. E hoje o custo de não
> decidir **deixou de ser hipótese**: a garantia do Rodrigo venceu com ele na
> nossa fila. §3.

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
767 lidas da pasta "Sent" = 690 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`): **0 carta
depois do corte**, veredito "buraco é PASSIVO".

Pasta **756 → 767** desde as 21hZ; tabela **679 → 690**. As 11 do intervalo
nasceram com linha. As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** —
decisão de produção, não de ronda, e eu não a tomei.

## 1. Estado da fila

| status | 21hZ | 22hZ |
|---|---|---|
| investigating | 80 | 82 |
| abertos 7d+ | 37 | 37 |

Não fechei nenhum cartão nesta ronda. **Isso é resposta legítima** (regra 14, e o
lembrete da ordem de 21/08: fechar mais, não mais rápido do que resolve) — os
dois que peguei estão travados em decisão que não é minha, e eu prefiro dois
cartões abertos e honestos a um `fixed` fabricado.

---

## 2. >>> ERRATA CONTRA MIM: os cartões NÃO estavam abandonados

Escrevi, na primeira nota que gravei hoje no #363, que o cartão **"estava com
ZERO nota depois de 7 dias"**. Repeti isso no grupo.

**É falso.** O #363 tinha **7** notas e o #305 tinha **6**.

### 2.1 Como eu errei

Meu script consultou a coluna **`notes`**, que **não existe** nesta tabela. O
supabase devolveu `undefined`, meu código fez `|| []` e imprimiu alegremente
`0 NOTA(S)`. Eu li isso como "ninguém olhou este caso" e **acusei a fila de
abandono**.

Quem me denunciou foi o próprio `anotar_incidente.cjs`, que ao gravar imprimiu
**`agent_notes: 7 -> 8 notas`**. A coluna certa é `agent_notes`.

Isto é, **literalmente**, a armadilha 1 do `_frank/03_ROTINA.md` — *"consulta que
erra volta VAZIA e o script imprime 0 alegremente"* — e é a **mesma família** do
erro que a ronda das 21hZ escreveu contra si mesma (confundir o padrão do
instrumento com o alcance do instrumento). **Repeti a família em menos de 24h.**

> **Regra que fica:** não existe "zero" vindo de `select` que eu não tenha
> conferido **contra o schema**. Antes de acusar abandono, confira o **nome da
> coluna**. Zero de instrumento cego não é zero medido.

### 2.2 O que as notas mostram — e é pior para a casa, não melhor

Ninguém abandonou nada. O trabalho foi feito, e foi **bem** feito:

- A nota [4] do #363 (12/09 10:45Z) **já media** os mesmos R$ 1.194,90 que eu
  "re-descobri" hoje, com as 4 transações, a garantia e o telefone.
- A nota [5] (12/09 10:46Z) registra a carta **uid 1955** e diz, textualmente:
  *"escalado ao grupo às 10:49Z marcado como urgente… **Não há mais nada que eu
  possa executar neste caso sem o Johnny**."*

**A escalada que eu fiz hoje às 21:45Z já tinha sido feita em 12/09 às 10:49Z.**
O caso não está parado por falta de apuração. Está parado na **decisão**, há
7 dias. Corrigi a mensagem do grupo assim que medi isso.

---

## 3. `94843173` / #363 — Rodrigo, e o dano previsto que virou fato

`rodrigo.limas.1978@gmail.com` · aberto **12/09 01:40Z** · pediu **devolução
total** em 11/09 23:45Z.

### 3.1 O que eu medi hoje, na fonte

- **O valor que ele cobra está certo.** Hotmart viva: R$ 741,00 SGP
  (`HP2729612767`) + R$ 356,90 Fábrica (`HP1502648524`), ambas 30/08, + R$ 97,00
  mensalidade (`HP2955203673`, 06/09) = **R$ 1.194,90 exatos**.
- **Ele não recebeu nada.** `aluno.cjs`: zero perfil para este e-mail e para
  variações. Playbook G.
- **O estorno não saiu.** Varri os **7.917** `payment_events`: 6 eventos dele,
  **nenhum** de estorno ou chargeback. O último (14/09 09:06Z) é
  `PURCHASE_COMPLETE` **consolidando** os R$ 97. As 3 transações seguem
  `COMPLETE`.
- **A casa prometeu urgência duas vezes.** Li as cartas: **uid 1955** (12/09) e
  **uid 2212** (14/09) dizem as duas que o caso subiu *"marcado como urgente para
  quem decide"*. De 14/09 para cá, silêncio.

### 3.2 A GARANTIA VENCEU COM ELE NA NOSSA FILA

O Vigia mediu em 12/09 10:17Z: `warranty_date = 2026-09-13T00:00:00Z`, e avisou
por escrito — *"se passar sem decisão, ele vira o 7º nome da lista 'perdeu a
janela enquanto esperava na nossa fila'"*.

**Hoje é 19/09. A janela fechou há 6 dias. A previsão se cumpriu**, e ninguém
tinha registrado o vencimento no cartão até agora.

Isso **não extingue o direito dele**: a casa se comprometeu por escrito (uid
1955) a valer a **data do pedido dele**, 11/09 23h45, que estava **dentro** da
janela. O que mudou é que a devolução deixou de sair pelo caminho automático da
garantia e passou a depender de **alguém da casa executar** — ficou mais cara de
fazer por termos demorado.

### 3.3 Por que eu não escrevi uma 3ª carta

Ele já recebeu duas cartas dizendo "está escalado". Uma terceira sem o dinheiro
repetiria **a mesma promessa sem dono** — que é exatamente o erro que a nota [5]
nomeou no caso Simone (*"4 promessas, zero ação"*). **Sem o "pode" do Johnny,
a carta não teria fato novo.** Assim que a decisão vier, ela sai.

---

## 4. `132f7808` / #249 — Glauber, e a classe remedida

35 dias de silêncio, **R$ 694,00** pagos em 15/08, `last_seen_at` NULL.

### 4.1 A classe cresceu de novo

`contato_hotmart.cjs --fichas` (controle positivo passou): **11 fichas de bounce
abertas**, 10 com telefone. **Pagantes com bounce: NOVE, somando R$ 7.400,82.**

| aluno | telefone | pago | desde |
|---|---|---|---|
| Glauber | (38) 99919-8156 | R$ 694,00 | 15/08 — **35d** |
| Anderson | (11) 97397-4029 | R$ 733,60 | 06/08 — **44d** |
| Sunesa | (15) 99653-4224 | R$ 849,45 | 07/09 |
| Renato | (22) 97403-4515 | R$ 1.038,00 | 09/09 |
| Valdeni | (62) 98464-1654 | R$ 1.054,32 | 10/09 |
| Ulysses | (21) 97926-3535 | R$ 993,45 | 10/09 |
| Sheila | (31) 98449-6405 | R$ 649,45 | 13/09 |
| Eliane | (55) 99169-7201 | R$ 1.091,55 | assinante |
| **Thallita** | (31) 98891-7604 | R$ 297,00 | 06/09 — **nova** |

Em 17/09 eram **8** e **R$ 7.103,82**. Fora da conta de propósito: `luctec@`
(nenhuma compra paga) e `pc.sul157@` (tem telefone, nenhuma compra paga).

### 4.2 Corrigi uma imprecisão que eu mesmo ia cometer

Tratar os 9 como "inalcançáveis por e-mail" **inflaria** o caso. A classe **não é
homogênea**:

- **permanente** (endereço não existe): Glauber, Sunesa, Ulysses — não volta só.
- **temporário** (caixa cheia): Anderson, Thallita, Eliane — **podem** voltar a
  receber, e para esses o e-mail **ainda é rota viva e pré-autorizada**.
- **outros**: Renato (bloqueio de destino), Valdeni, Sheila — cujo endereço é
  `horta.pericias@gmail.**com.br**`, com `.br` sobrando: **erro de digitação no
  checkout**, não caixa morta.

Não peço aval de telefone para quem ainda pode ser alcançado por e-mail.

---

## 5. O que esta ronda ENTREGA de novo: a rota barata morreu com prova

A pergunta que decide esses casos é *"existe um SEGUNDO endereço vivo do mesmo
ser humano?"*. Se existir, o caso se resolve **hoje**, por e-mail, que é canal
**pré-autorizado** (regra 8) — **sem aval de ninguém**.

Em 17/09 essa pergunta foi respondida para o Glauber com um **script de ocasião
que não foi salvo**: a resposta sobreviveu como texto numa nota, e a ferramenta
morreu com o worktree. É o buraco do **#101/#210 na perna de medição**. Como a
classe tem nove pagantes, a pergunta ia se repetir — então virou peça commitada:

**`_frank/ferramentas/2026-09-19_segundo_email_por_cpf.cjs`** (só leitura), com
as três armadilhas de 17/09 **codificadas como guarda**:

1. **janela curta**: `/sales/history` sem `start_date` some com compra antiga
   (Anderson e as 5 da Eliane sumiam) → `start_date` sempre explícito;
2. **`buyer_name` casa por PREFIXO e as duas pontas da API divergem**:
   `/sales/users` devolve *"Glauber jiordany o lopes"*, que em `/sales/history`
   dá **zero**, enquanto *"Glauber jiordany"* dá 2 → **escada de prefixos**;
3. **nome parecido não é pessoa, CPF é** → veredito por **documento**, e
   candidato sem CPF conferível sai como **NÃO PROVADO**, que é diferente de
   "é ele".
4. **controle positivo obrigatório**, que **aborta** em vez de relatar
   "ninguém tem segundo e-mail".

**Validação:** rodada contra o Glauber, reproduz a resposta de 17/09
**exatamente** — os mesmos 5 homônimos, os mesmos CPFs, incluindo o
`glauber.neurologia@gmail.com` (CPF 03360297563 ≠ 00668768690).

### 5.1 O resultado da varredura

```
TEM 2º endereço (mesma pessoa por CPF): 0
SEM 2º endereço: 9
NÃO MEDIDO (sem nome na Hotmart): 1
```

**Nenhum dos nove tem segundo endereço.** A Sheila, que era a aposta mais
promissora (domínio digitado errado), tem **8 homônimas, todas com CPF
diferente** — então **nem para ela** o palpite `@gmail.com` se justifica: ele
entregaria a conta de uma pagante na caixa de uma estranha.

> **O que isso muda:** até hoje "e-mail esgotado" estava provado **só para o
> Glauber**. Agora está provado **para a classe inteira**. A última rota que eu
> poderia percorrer **sozinho** está eliminada **com medição**, não por memória.

---

## 6. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 767 = 767, 0 escrituráveis, conferida por
   instrumento independente.
2. **Errata contra mim** gravada no #363: os cartões não estavam abandonados; eu
   li a coluna errada. Grupo corrigido.
3. **#363 medido na fonte**: R$ 1.194,90 corretos, nada recebido, **zero evento
   de estorno** em 7.917 eventos, e a **garantia vencida há 6 dias com o aluno na
   fila** — primeira vez que o dano previsto vira fato.
4. **Classe de bounce remedida**: 9 pagantes, **R$ 7.400,82** (era 8 / R$ 7.103,82).
5. **Ferramenta nova e commitada** (`segundo_email_por_cpf.cjs`), validada contra
   resposta conhecida, que **mata a rota de e-mail da classe com prova**.
6. **Três notas gravadas** (#363 ×2, #249), todas conferidas na releitura.

## 7. O que eu NÃO fiz

- **Não fechei nenhum cartão.** Nada foi resolvido; `fixed` seria fabricado.
- **Não estornei nada** e não mexi em crédito, acesso ou assinatura de ninguém.
- **Não liguei, não mandei WhatsApp** e não escrevi para endereço morto.
- **Não "consertei" o endereço da Sheila** chutando `@gmail.com` — §5.1.
- **Não escrevi 3ª carta ao Rodrigo** (§3.3).
- **Não gastei GPU**, não apliquei migration, não abri PR, não mergeei nada.
- **Não decidi o backfill das 77 cartas** do #101.
- **Não li a caixa do suporte@ para triagem.**
- **Nada da planilha** (ordem de 29/08).

## 8. Para quem pegar a próxima ronda

1. **Confira o NOME DA COLUNA antes de acusar abandono** (§2.1). A coluna é
   `agent_notes`, não `notes`. Zero de `select` torto não é zero.
2. **A rota de e-mail da classe de bounce está morta com prova** (§5.1). Não
   gaste ronda reabrindo essa pergunta: rode o `segundo_email_por_cpf.cjs` e
   leia o veredito por CPF.
3. **Os dois casos que eu peguei travam no mesmo ponto**: uma palavra do Johnny.
   Não repita o pedido a cada ronda — vira ruído. Repita só com **fato novo**
   (foi o critério de 16/09 e de 17/09, e é o que justificou hoje).
4. **Se a decisão vier**, as duas cartas já têm conteúdo pronto: ao Rodrigo, o
   encaminhamento do estorno valendo a data de 11/09; à classe, o contato pelo
   telefone que a Hotmart guarda.

---

## 9. Passo fixo de fim de ronda — o git

Registrado abaixo, depois de rodar: log e ferramenta vão **direto na `main`**,
sem branch de feature (regra do registro), e **nenhum código de produto** foi
tocado nesta ronda — logo não há PR a abrir nem fix a prender em branch.
