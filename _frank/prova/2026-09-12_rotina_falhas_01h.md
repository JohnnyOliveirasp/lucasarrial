# Ronda das falhas — 12/09/2026 01h40Z (11/09 22h40 BRT)

Canal: ordem de 31/08 — tudo de FastCloner vai pro **grupo**, e só pro grupo.
Este arquivo é o log técnico da ronda; a mensagem do grupo é o resumo dele.

Pauta herdada do relatório noturno de 11/09, seção 6, item 1: **a fila de
recados**. Estava em 68, com o mais velho em 247h, e não baixava há 24h.
Fechou esta ronda em **59**.

---

## 1. Triagem da fila inteira (68 recados)

Método: 61 dos 68 recados carregam `incident_id`. Em vez de reler recado por
recado, juntei a fila contra `incidents` e classifiquei pelo **estado atual do
incidente**.

| estado do incidente | recados |
|---|---|
| `investigating` | 49 |
| `fixed` | 9 |
| `aguardando_aluno` | 3 |
| sem incidente (`orfa_*`) | 7 |

**O status sozinho não bastou** — e essa é a parte que importa. Conferi os 12
`fixed`/`aguardando_aluno` um a um, lendo a `resolution_note` inteira, e
**4 não podiam ser apagados**:

- `c1673a34` — a 1ª nota falava de Wav2Vec2/transformers, assunto **diferente**
  do recado (botão Baixar do Vídeo História). Só a 2ª nota, de 09/09, cobre o
  caso (PR #227, merge `832be61`, deploy SUCCESS). Apagado por causa da nota
  certa, **não** por causa do status.
- `07a423ff` — incidente `fixed` desde 03/09, mas o recado nasceu em **10/09**
  com pergunta nova. Só apaguei porque a 2ª nota prova o aluno respondido em
  11/09 (Enviados uid 1839).
- `2245e0b0` (Priscyla) e `52b22304` (Igor Ramalho) — fechado/parado com
  `resolution_note` **vazia** ou com não-resposta ("não encontramos a compra na
  hotmart") **enquanto o aluno espera**. Ficaram na fila.
- `c726c5ae` — "19 pagantes sem conta, 4 há 91 dias" está `aguardando_aluno`
  com resolução vazia. **Não há aluno a esperar**: é bug de detector, rótulo
  errado. Ficou na fila.

**8 apagados**, todos com correção provada em produção **e** aluno avisado:
`3ad6b6da`, `8135ff66`, `c55786cd`, `f9e12b9b`, `b229e491`, `4d5fd1fa`,
`c1673a34`, `07a423ff`. `DELETE ... RETURNING`, 8 chaves confirmadas.
Recontagem depois: **59**.

---

## 2. O caso que peguei até o fim: Simone — `#86de22c6`

Escolhido pela regra 8 (serial): é dinheiro, e o incidente estava **fechado em
falso**, que é o estado em que ninguém olha de novo.

### O que estava escrito, e o que era verdade

O incidente estava `fixed` com `resolution_note` de 22 caracteres:
**"já resolvido via email"**. O fechamento saiu em **11/09 19:04Z — 4 minutos
depois** da resposta automática das 19:00Z (uid 1888). Fechou-se o cartão, não
o caso. **Nenhum centavo se moveu.**

### A medição

| verificação | resultado |
|---|---|
| Hotmart **viva**, `sales/history`, 01/07→12/09, **7.186 vendas varridas**, busca por CPF `69116180453` + nome "Simone Leal" + prefixo "simoneleal" | **zero ocorrências** |
| `entitlements` e `payment_events`, mesmas 3 chaves | **zero** |
| `pagou_de_verdade.cjs` no e-mail dela | **sem pagamento** (hotmart + stripe) |
| `sgp_pedidos` | `e51653b8`, `origem='planilha_antiga'`, status `dados`, criada 10/09 |

**A compra existe, mas fora do nosso checkout.** Ela comprou pelo **processo
antigo**, então os **R$ 975,40** (R$ 672,00 + R$ 303,40, 31/08) caíram numa
conta que a nossa API não enxerga. Não dá para estornar pelo caminho normal.

Varrer as 7.186 vendas foi o passo que mudou a conclusão: a busca pelo e-mail
sozinha (`pagou_de_verdade`) devolve "sem pagamento", que lido cru viraria
"ela não pagou" — e a própria ferramenta avisa que esse é o erro que mais nos
pegou (#214, #218). Buscar por **CPF e nome** na fonte viva é o que separa
"não pagou" de "pagou onde a gente não olha".

### O atendimento até aqui (por que isso já passou do ponto)

| quando | o quê |
|---|---|
| 07/09 13:41 | ela pede o reembolso das duas, com CPF e valores (uid 478) |
| 08/09 10:46 | "Ok, fico no aguardo" (uid 484) |
| **11/09 11:06** | recebe a campanha **"refaça seu envio"** do SGP (uid 1747) |
| 11/09 15:56 | cobra de novo e reclama que a resposta demora um dia (uid 582) |
| — | **4 respostas** da casa prometendo que "a equipe financeira vai verificar e processar". **Nenhuma ação.** |

O item de 11/09 11:06 é o pior: pedimos **40 minutos de áudio novo** a uma
pessoa que havia pedido o dinheiro de volta **4 dias antes**.

### O que eu fiz

1. **Reabri** o `#86de22c6` (`fixed` → `investigating`) com a medição inteira.
2. **Corrigi a `resolution_note`**: a frase "já resolvido via email" continuava
   lá depois da reabertura e, lida sozinha, seguia mentindo. Concatenei a
   correção dizendo que era falsa (22 → 371 chars).
3. **Escrevi para a aluna** (regra 8 — e-mail individual de caso que estou
   tratando é decisão minha). Enviados **uid 1945, cópia CONFIRMADA**. O e-mail
   assume a falha das 4 promessas, explica por que a compra não aparece no
   nosso gateway, garante que o pedido **vale a data original (07/09)** e que
   ela não perdeu prazo, manda desconsiderar a campanha de 11/09, e pede **um**
   de três itens para localizar o dinheiro (onde pagou / comprovante ou código
   da transação / linha do extrato). **Não prometi data de estorno** — não
   tenho como cumprir.
4. Apaguei o recado, já que o incidente aberto carrega o caso inteiro.

### Onde travou, e o que falta (regra 8)

Travou no **passo do gateway**. Faltam duas coisas, nenhuma delas minha:
(a) a resposta da Simone com a prova de pagamento;
(b) **decisão e acesso do Johnny** — os R$ 975,40 estão numa conta que a nossa
API não enxerga.

**Não é caso de planilha para efeito da ordem de 29/08.** O que está vivo aqui
é **atendimento** (reembolso pedido por e-mail), não reprocessar linha de
planilha. Nada foi reprocessado.

---

## 3. O que precisa do Johnny

1. **Simone, R$ 975,40** — *novo nesta ronda.* Compra do processo antigo,
   invisível no nosso gateway. Precisa de quem tem acesso à conta que recebeu.
   **Mesmo padrão da Teresa (`#356`)**, que o relatório de 11/09 já descreve
   como "a compra não existe na nossa base, só a Hotmart viva enxerga". Deixou
   de ser caso isolado: são **duas** pedindo dinheiro de volta de uma compra
   que o nosso sistema não sabe que existe.
2. Segue valendo tudo da seção 3 do relatório de 11/09 (Rodrigo — **vence hoje,
   12/09 21h BRT**; Teresa; Victor; Leandro; `#313`).

---

## 4. Achados que ficam registrados (não abri cartão)

- **Incidente fechado em falso não é acidente isolado.** Dos 12 recados cujo
  incidente estava fechado, **2** (`86de22c6`, `2245e0b0`) foram fechados com
  uma linha que não resolve nada — "já resolvido via email", "não encontramos
  a compra na hotmart" — e um deles escondia R$ 975,40 parados. A regra 14 já
  proíbe isso; o que faltou foi alguém reler. A triagem por `resolution_note`,
  e não por `status`, é o que pega.
- **A campanha "refaça seu envio" do SGP alcançou quem já tinha pedido
  reembolso.** Registro como fato, **sem abrir incidente**: a causa é o
  onboarding da planilha, e a ordem de 29/08 me proíbe de atuar nela.
- **`aguardando_aluno` está sendo usado como arquivo morto.** `c726c5ae` (19
  pagantes sem conta, 4 há 91 dias) é bug de detector e está nesse estado com
  resolução vazia — some do filtro de abertos e ninguém espera por aluno nenhum.

---

## 5. O que a próxima ronda pega, em ordem

1. **`c726c5ae` — 19 pagantes sem conta, 4 há 91 dias**, mais os **7 recados
   `orfa_*`** (neto_rocha, caplastica, herysilva, gabrielalouly, ezwaymotors,
   cachico3 e o da Simone). É a mesma classe e é a maior concentração de gente
   que pagou e não recebeu nada. Pelo critério serial (mais antigo com aluno
   afetado, empate no número de gente sofrendo), é o próximo.
2. **Priscyla (`2245e0b0`)** e **Igor Ramalho (`52b22304`)** — fechados/parados
   com não-resposta enquanto esperam.
3. **Rodrigo** — morre **12/09 21h BRT**.
4. Os 3 patches do Vigia, começando pelo `7578c587` (conferir se já está na main).
5. Os antigos que não andam: `#15`, `#47`, `#99`.

---

## 6. Higiene do repositório (inalterada, vigésima primeira ronda)

Seguem modificados e não commitados, em `frontend/**/sgp*` e
`frontend/messages/*`, mais não rastreados em `_frank/rascunhos/` e
`frontend/src/lib/sgp/`. **Não são meus e não toquei.** Meus arquivos de
trabalho ficaram em `/tmp`, fora do git. Este log foi commitado de uma worktree
limpa tirada de `origin/main`, pelo mesmo motivo do quase-acidente de 08/09.
