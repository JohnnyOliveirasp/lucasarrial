# Ronda das falhas — 25/09/2026, ~21hZ

**Método: serial (regra 8).** Um caso levado até onde dá antes de pegar outro.

**Esta ronda fechou ZERO incidentes e ABRIU um.** O que ela entregou foi
**três pagantes que a casa não sabia que existiam**: R$ 2.926,09 + USD 40 pagos,
nenhum deles com conta, nenhum deles com cartão na fila. A fila subiu de 163 pra
**164** e isso é a coisa certa tendo acontecido, não o contrário.

**Produção tocada: ZERO.** Zero merge, zero deploy, zero GPU, zero migration,
zero DDL, zero crédito movido, zero carta a aluno, zero conta criada, zero
cobrança mexida.

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

- **1313** cartas lidas da pasta `Sent` (eram 1310 na ronda anterior: **3 cartas
  novas** saíram desde então), 1313 com cabeçalho lido.
- **1236** já tinham linha (eram 1233). **0 escrituráveis** dentro da janela.
- Contagem fecha: **1313 = 1236 + 0 + 77 + 0**. Nenhuma carta sumiu.
- Registro local (#210) não existe nesta máquina — *gitignored*, morre com o
  worktree. É o buraco que esta reconciliação compensa.

Instrumento independente (`2026-09-18_enviados_x_tabela.cjs`): **0 cartas** depois
do corte fora da tabela. Veredito: buraco **PASSIVO**. Bate.

> As 3 cartas novas entraram sozinhas, com linha. O controle compensatório está
> funcionando — é por isso que ele é passo fixo.

## Passo fixo 2 — percepção travada (ordem de 17/09)

`percepcao_travada.cjs`: **0** cartões travados em percepção · mais velho **0d**.
Controle positivo (#310) OK, controle negativo (#518) descontado, 565 incidentes
varridos. Nada a despachar pro `olho`/`qa`.

## Passo fixo 3 — estado da fila (início)

**163 abertos** · **95** com 7d+.

---

## A escolha do serial

O serial da ronda anterior era o `#249` (Glauber, pagante de R$ 694 sem acesso),
travado num pedido de canal externo. **Reconferi o bloqueio em vez de herdá-lo:**

| canal | estado hoje, medido |
|---|---|
| e-mail | único endereço devolve `550 5.1.1 user unknown`. Impossível por definição |
| WhatsApp | `WAHA_API_URL`/`WAHA_API_KEY` **ausentes** nos 3 `.env` desta máquina (conferida só a PRESENÇA, nunca o valor). O canal existe na casa, não no meu alcance |

Segue travado no mesmo passo, que é **uma frase de "pode" do Johnny**. Já foi
escalado ontem; re-escalar o mesmo cartão hoje seria ruído no grupo (regra 7).
Regra 8: travou, diz em que passo e segue. **Segui.**

Peguei então o `#250` (Anderson, mesma idade, caixa-cheia) porque ele estava
**disparando ao vivo** — 5ª ocorrência às **20:35Z**, 19 minutos antes desta ronda.

### O `#250` também está travado, e agora com uma medição nova

- **Anderson pagou R$ 733,60** (Fábrica R$ 312,64 em 06/08 + SGP R$ 420,96 em
  07/08, as duas COMPLETE). **50 dias.** Conta criada 04/09, `last_sign_in_at`
  **NULL — nunca logou.**
- Rodei o `segundo_email_por_cpf.cjs` (controle positivo OK, 15 transações do
  Glauber reencontradas). 37 endereços sob o mesmo nome, **nenhum passou**.
- ⚠️ **Mas o veredito honesto não é "não existe segundo e-mail".** O documento do
  próprio Anderson na Hotmart é `5083160840468333257735` — **22 dígitos, não é
  CPF**. Comparar isso com o CPF de 11 dígitos dos candidatos **nunca pode casar**.
  Ou seja: a rota de CPF está **estruturalmente fechada** pra ele, o que é
  diferente de "medi e não tem". A conclusão operacional não muda (homônimo não
  é rota — mandar a conta dele pra um estranho é o erro que a ferramenta existe
  pra impedir), mas a razão é outra e fica escrita.
- O telefone do cadastro é **celular de São Paulo** (rotulado "fixo" na Hotmart,
  mas é `11 9xxxx-xxxx`) — ou seja, é rota de WhatsApp, e cai no mesmo bloqueio
  do `#249`.

**Não fechei.** Ele não recebeu nada.

---

## O que esta ronda realmente achou

Com os dois seriais travados no mesmo "pode", fui pro passo (1) do playbook —
*"já resolveu sozinho?"* — via `2026-09-19_aberto_mas_ja_respondido.cjs`:
**65 abertos com carta já enviada** (ordem de visita, não veredito). O mais
parado era o `#305`, 9,1d.

### O `#305` e a coluna que ninguém tinha lido

O `#305` (Rodrigo, aviso de compra órfã que não disparou) estava travado entre
duas hipóteses desde 16/09, com uma contradição de datas registrada e não
resolvida. Cinco rondas apuraram aquilo no escuro.

**O que eu fiz de diferente:** a nota [6] do próprio cartão dizia que o **PR #315**
(merge `cbfffeb`, deploy 16/09 18:01Z) tinha passado a **gravar o motivo** em
`payment_events.error` — o dado que responderia a pergunta. Em vez de reapurar
06/09 pela sexta vez, **fui ler a coluna**. Ninguém tinha lido desde que subiu.
**Tinha 9 dias de dado novo esperando.**

```
25/09 17:50:07Z  PURCHASE_COMPLETE  josephgois@hotmail.com  [74A6IGVU]  motivo: JA_AVISADO
25/09 13:59:49Z  PURCHASE_APPROVED  ezwaymotors@gmail.com   [7D9WG7J8]  motivo: JA_AVISADO
18/09 13:45:33Z  PURCHASE_APPROVED  isaias.enf@gmail.com    [877A2RHB]  sem canal de aviso
```

Os dois `ja_avisado` são a **hipótese 1 do `#305` em estado puro**: a chave de
idempotência calando uma cobrança **paga** posterior. Deixa de ser hipótese sobre
um caso de 06/09 e passa a ser **comportamento medido em produção, duas vezes, hoje**.

### E os três são pagantes sem conta nenhuma

| pessoa | pago | ciclos | acesso |
|---|---|---|---|
| Joseph De gois oliveira | **R$ 1.483,13** | assinatura 17/07, 17/08, 17/09 — as três COMPLETE + 4 avulsas | **70 dias, nenhum** |
| Isaias Coutinho | **R$ 1.442,96** | 18/07, 18/08 COMPLETE, 18/09 APPROVED + 4 avulsas | **69 dias, nenhum** |
| EZ MOTORS | **USD 40** (moeda USD, não convertida) | 25/08 $0, 01/09 $20, **25/09 $20 cobrado HOJE** | nenhum |

**Como medi que não têm conta** — e por que o vazio é real:
`auth.users` por e-mail exato, por `lower(btrim())` e por `ilike`: **0**.
`profiles` por NOME (joseph/gois/isaias/coutinho/ez motors/ezway): os 6 parecidos
são **outras pessoas** (Jucilen Coutinho, Igor Coutinho, Isaias Batista de Lima
Junior, Patrícia De Gois Moreira…). **Contraprova de que a busca funciona:**
`auth.users` = 2.998, `profiles` = 2.998, `display_name ilike '%a%'` = **2.747**.

### O defeito NOVO, que não é o do título do `#305`

O `#315` fez a prova passar a **existir**. Mas **nada lê `payment_events.error` e
transforma em chamado.** Conferido: `incidents` por `affected_emails` com os três
endereços devolvia **0 linhas** — os três eram **invisíveis pra fila inteira**, e
a evidência do Isaias ficou **7 dias parada** na coluna.

> Consertar o REGISTRO sem consertar a LEITURA só troca silêncio por silêncio
> com carimbo. É o mesmo formato do buraco do `#101`/`#210`: o dado existe, e
> nenhum olho passa por ele.

---

## O que gravei na fila

| cartão | ação | o quê |
|---|---|---|
| **`#582`** (`b6036323`) | **ABERTO**, `investigating` | os três pagantes, o dinheiro, os códigos de assinatura, os 3 registros de `payment_events`, e o defeito de leitura. Conferido na releitura: `occurrences=3`, 3 e-mails, descrição de 2.608 chars |
| `#305` (`54c14038`) | **nota**, `investigating` mantido | a reprodução ao vivo da hipótese 1. Conferido: **6 → 7 notas, 1 linha afetada** |
| `#250` (`8c29740f`) | *sem escrita nesta ronda* | a medição do CPF inválido está neste log; entra no cartão na próxima |

⚠️ **Efeito colateral que registro em vez de esconder:** ao reanotar o `#305`, o
`anotar_incidente.cjs` **limpou `resolved_commit`** (era `4796aba`) por tratar a
escrita como reabertura. Os commits (`4796aba`, `cbfffeb`) seguem escritos dentro
da nota [6], então a informação não se perdeu — mas a **coluna** não carrega mais.
Quem for medir "o que já foi consertado" pela coluna vai ler a menos.

**O `#305` continua dono** da pergunta "o que aconteceu no UKC2COC2 em 06/09" —
a contradição de datas **não** foi resolvida e cravar uma hipótese seria inventar.
O `#582` é dono dos três pagantes vivos.

## Grupo (regra 7 + "pagante travado avisa NA HORA")

Uma mensagem pelo `notify-grupo.sh`, marcada urgente: os três, o total, por que
ninguém viu (o aviso calado), que é a hipótese 1 do `#305` ao vivo, e o pedido
concreto de "pode". **Telefone e documento não foram pro grupo** — dado pessoal
não circula em canal; está nos cartões.

## O que eu NÃO fiz, de propósito

Não criei conta, não concedi entitlement, não parei nem estornei cobrança, e
**não escrevi aos três**. Acesso e cobrança são produção com dinheiro no meio.
Carta que diz "achamos você" sem o acesso junto é meia carta, e convida resposta
que eu ainda não posso servir — os três não escreveram pra casa, então segurar
não fere a regra 8 (que é sobre não represar resposta a quem escreveu).

---

## Fila ao fim da ronda

**164 abertos** (163 + o `#582`). Percepção travada: **0**.

### Pendências nomeadas (paradas, não "em andamento")

1. 🔴 **`#582` — o "pode" pros três.** R$ 2.926,09 + USD 40 pagos, zero acesso, e
   o EZ Motors **foi cobrado hoje**. É a única da lista com dinheiro correndo agora.
2. 🔴 **`payment_events.error` não vira chamado.** Enquanto não virar, o próximo
   pagante cai no mesmo buraco e ninguém fica sabendo. Quem pegar, pega junto com
   o `#582`.
3. 🔴 **`#249` — o "pode" do WhatsApp** (Glauber, R$ 694, 42 dias). Bloqueio
   remedido hoje: canal existe na casa, ausente nesta máquina.
4. 🔴 **`#250` — mesmo bloqueio** (Anderson, R$ 733,60, 50 dias). Rota de CPF
   estruturalmente fechada: o documento dele na Hotmart não é CPF.
5. 🔴 **A decisão de curso × plataforma** (28 alunos + a carta do Rafael). Estava
   marcada como vencendo em 25/09. **Venceu.**
6. 🔴 **`#702cc916` — 25d**, decisão de produto; destrava a cabeça da fila
   (`#52`, 38d, 22 alunos).
7. **Fila de decisão do Johnny: 18 cartões, 53 alunos**, mais velho 25d. O lote
   segue sem ser montado.
8. **`#426`** — os 309/349 do lote de 04/09.
9. **`patch_cfde107d`** do Vigia esperando revisão. Não foi esta ronda.
10. **77 cartas anteriores a 14/09** — segue sem decisão de escrituração.
11. **`emails_enviados.bounce_em` sub-registra** — 1 caso provado (`#460`).
12. **`sgp_fracassos` com 0 linhas** — indistinguível entre "sem falhas" e "não grava".

### A lição desta ronda, pra próxima não repetir

**Conserto que passa a GRAVAR prova cria uma dívida de LEITURA.** O `#315` subiu
em 16/09 e ninguém leu a coluna por 9 dias — a resposta que cinco rondas
procuraram no escuro estava lá desde o terceiro dia, e junto com ela três
pagantes. Quando uma ronda subir instrumento novo, a ronda seguinte tem que
**ler o que ele gravou**, senão o instrumento vira enfeite.

---

## Achado de fim de ronda: o 7º branch concorrente, e este apaga o instrumento

O passo fixo de fim de ronda (`git rev-list main..<branch>`) encontrou
**`feat/orfa-carencia-sweeper`, 3 commits à frente da main, sem PR**:

```
71dac10d 08/09  webhook para de alertar compra órfã; quem decide é o sweeper, com carência de 6h
7f091351 09/09  guarda de estado no órfão: carência não pega PURCHASE_COMPLETE
540fdd28 09/09  trava de rajada no aviso de compra órfã, e o emissor volta a ligar
```

+1.493 linhas em `aviso-orfao.ts`, `orphan-outreach.ts` e no webhook da Hotmart —
**os mesmos arquivos** que os PRs #314/#315 mudaram em 16/09.

**Medido, não achismo:**

| marcador | main | branch |
|---|---|---|
| `tentativas` (campo do PR #314) | 6 | 1 |
| `sem aviso novo` (instrumento do PR #315) | **1** | **0** |

O branch é de 08–09/09 e **não conhece** os consertos de 16/09. **Mergear hoje
apaga a gravação em `payment_events.error`** — isto é, apaga exatamente a coluna
que produziu o achado desta ronda. A casa voltaria a ficar cega pro próximo
pagante sem conta, e desta vez **sem nem a prova ficando pra trás**.

É a **7ª vez** que a casa produz duas correções concorrentes pro mesmo defeito
(família do `feat/onedrive-401`, `feat/fix-image-upload-retry`, as 2 da cura de
referência, `fix/trava-foto-nova-8379549c`, `fix/ritmo-da-referencia-porta-73a60bb`
e `fix/estorno-treino-por-saldo-pendente`). **Não mergear.**

⚠️ **Mas a ideia do branch está certa e é a do `#582`:** *"quem decide é o sweeper,
não o webhook"* é precisamente o conserto do buraco de **leitura** — o webhook
grava o motivo e ninguém varre. Quem for consertar deve **reescrever a partir da
main de hoje**, aproveitando o desenho do sweeper, e **não** fazer merge do branch
velho. Isso está anotado no `#582`.

> Vale reparar no padrão: as duas correções concorrentes nascem sempre enquanto o
> cartão fica **aberto**. O branch é de 08–09/09; o `#305` estava aberto desde
> 08/09. Cartão parado é fábrica de branch concorrente.
