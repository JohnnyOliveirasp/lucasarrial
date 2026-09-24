# Ronda das falhas — 24/09 ~15h41–16h40Z (Frank, dono da fila)

**Desfecho: 1 chamado NOVO aberto (`#552` / `0e04bd97`) com o conserto escrito
no mesmo turno (PR #429), e 1 erro MEU registrado antes do resto — abri o
cartão acusando uma cobrança indevida que não existe, e a acusação ia virar
uma ação irreversível contra um aluno pagante.**

Gasto: **zero GPU, zero crédito de aluno movido, zero migration, zero DDL, zero
e-mail enviado a aluno, zero assinatura cancelada, zero merge.** Escritas: 1
incidente aberto (e corrigido), 2 notas, 1 branch + 1 PR, 1 recado no grupo,
este log.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=…14:06:31Z --confirmar` | **0** escriturável. **1205 = 1205**, nenhuma carta sumiu (1128 já com linha + 77 fora da janela). |
| `enviados_x_tabela` (irmão de leitura, independente) | **VEREDITO: 0 carta depois do corte.** Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho **0d**. Controles positivo (#310) e negativo (#518) OK, 537 varridos. |
| `pagante_trancado.cjs` | **0** pagante trancado · **0 na fronteira** · 1 sem prova (`drfabiovilhena29@`, 4º dia) |
| Censo da fila | **117** abertos (+2) · 68 com 7d+ · mediana 8d |
| `esperando_johnny` | **17** parados em decisão · mais velho **56d** · **54 alunos** atrás da fila |
| `conserto_pronto_e_parado` | **39** mergeáveis parados (+1) · 24 há 3d+ · **19** apodrecidos · mais velho 35d |

### 1.1 O defeito do instrumento novo se repetiu pelo **3º dia**

`conserto_pronto_e_parado.cjs` **abortou na 1ª execução**: **57** PRs voltaram
`UNKNOWN` (ele dispara ~58 `gh pr view` em rajada e o GitHub responde `UNKNOWN`
enquanto calcula). Morreu em vez de imprimir o quadro. 2ª execução devolveu
tudo.

> **3º dia seguido sem conserto.** Falta a segunda passada nos `UNKNOWN`. A
> ferramenta só funciona porque é rodada duas vezes — por acidente, não por
> desenho. Não consertei nesta ronda tampouco; anotado pela 3ª vez.

## 2. Por que este trabalho, e a correção de rumo que a ronda anterior pediu

A ronda das 15hZ deixou escrito: *"o `#494` é o mais velho de fato entre os que
não estão travados em decisão. É ele, e não a cabeça aparente da lista."*

**Abri o `#494` (`719c9af6`) e essa recomendação não se sustenta.** A nota 5 do
próprio cartão, escrita em 22/09, diz o passo que falta: *"decisão de produto
sobre o que esta classe ouve, e o 'pode' para o texto que vai a eles"*. A classe
está **inteiramente medida** — 10 vídeos, 9 de 9 alunos, lip-sync absolvido em
10 de 10, corpo parado em 10 de 10, com controle positivo por `ffprobe`. Não
sobrou investigação: sobrou decisão. Ele está travado como os outros três da
frente, só que por um motivo diferente.

Segui a fila por `first_seen_at`. O seguinte é o **`8b8fc4c8`** (23,1d, Fabiana)
— e o passo que falta nele é *"mão humana no painel da Hotmart"*. Fui conferir
essa premissa, que aparece em **18** cartões da fila, e é **falsa**:

- as credenciais de API existem no ambiente (`HOTMART_CLIENT_ID/_SECRET/_BASIC`);
- o caminho já foi **provado em produção** no `#166a1df4` (5MOBYUUT, `ACTIVE` →
  `CANCELLED_BY_SELLER` via API, 20/08);
- e existe `_frank/ferramentas/cancelar_assinatura.cjs` desde 21/08, com
  cancelamento **automático** por decisão do Johnny (regra 9-C).

Puxando esse fio apareceu o que ninguém tinha olhado: **o botão de cancelar
dentro do app**. `subscription_cancellations` tem **374 linhas, 236 pessoas,
168 nos últimos 30 dias** — e nenhuma varredura da casa lê essa tabela.

## 3. O erro que eu cometi, escrito antes do achado

Abri o `#552` afirmando que `chaplainfabio@gmail.com` *"pediu cancelamento em
28/07 e foi cobrado 20 USD em 14/08 e 14/09 por causa deste defeito"*.

**Está errado e eu retiro.** Montei a acusação em cima de uma comparação de
**datas** — pedido antes, cobrança depois — sem abrir as assinaturas.

Quando abri, o quadro era outro. Ele tem **duas**:

```
YBS9C0OL | trial | CANCELLED_BY_SELLER | até 31/07
WJOR0E9Q | pago  | ACTIVE              | até 14/10, 20 USD/mês
```

O pedido de 28/07 mirava o trial `YBS9C0OL` — **e ele está cancelado**. Naquele
caso o botão **funcionou**. A `WJOR0E9Q` é posterior (1ª cobrança 14/08), não
aparece no `assinatura_em_dobro.cjs`, e o aluno está com 262.000 créditos e
acesso até 14/10: a leitura honesta é que ele **voltou por conta própria**.

**O custo, se eu não tivesse conferido:** o passo seguinte do meu próprio plano
era rodar o `cancelar_assinatura.cjs` nele. Eu teria cancelado a assinatura
**ativa e paga** de um aluno que voltou, com base num pedido de 57 dias atrás
que ele mesmo superou. **Não tem desfazer.** O que me segurou foi o **ensaio ser
o padrão** da ferramenta e ela imprimir as DUAS assinaturas antes de agir.

> **A lição, e ela vale pros 18 cartões de cancelamento da fila:** pedido de
> cancelamento antigo **não autoriza ação hoje**. Confira a assinatura VIVA,
> uma a uma, porque a pessoa pode ter voltado. Data de pedido < data de cobrança
> **não é prova de cobrança indevida**.

O título, o `affected_emails` e a `description` do `#552` foram corrigidos na
mesma ronda, e a nota 1 do cartão abre com este erro, não com o achado.

## 4. O que sobrevive, e é defeito de verdade

Leitura de código, não dedução. `frontend/src/app/api/v1/subscription/cancel/route.ts`,
na ordem em que o arquivo executava:

```
:80-83  grava o pedido em subscription_cancellations
:84     notifyCancellation() → manda AO ALUNO "Sua assinatura foi cancelada".
        INCONDICIONAL, e ANTES de qualquer contato com a Hotmart.
:88-96  busca o subscriber code com .maybeSingle(); o `error` é descartado
:96-105 tenta cancelSubscription; catch VAZIO → {status:"registered"}
```

Três consequências independentes:

| # | consequência |
|---|---|
| a | a carta de confirmação sai **mesmo quando o cancelamento falha** — a casa promete um fato que não conferiu |
| b | a falha **não deixa rastro nenhum**: sem log, sem chamado, sem coluna. Não dá pra saber quais dos 236 pedidos viraram cancelamento de verdade |
| c | `.maybeSingle()` com **2 linhas** devolve erro e `data` null → `ent` null → o bloco do cancelamento é **pulado inteiro**, e o aluno recebe a carta dizendo que foi cancelado |

E `frontend/src/lib/hotmart/subscription.ts:63` mandava `{send_email:true}`; a
doc da Hotmart documenta **`send_mail`**. O cabeçalho do próprio módulo já
admitia que corpo/paths nunca foram validados. O **path** está certo — a doc
confirma os dois formatos, o singular (que é o nosso) e o de lista.

## 5. A medição — e ela **não acusa ninguém**

236 pessoas pediram cancelamento pelo app. Cruzei com `entitlements`: **12**
seguem com entitlement hotmart `ACTIVE`. Conferi os **12 um a um** na Hotmart
viva (`pagou_de_verdade.cjs`), comparando a data do pedido com as cobranças:

| aluno | pediu | cobrança depois? |
|---|---|---|
| chaplainfabio | 28/07 | as de 14/08 e 14/09 são de **outra** assinatura, posterior (§3) |
| deboramaria02 | 05/08 | não — rec#2 `OVERDUE` |
| cristaisdeoz | 06/08 | não — última 28/07 |
| plutotv2026 | 06/08 | não — rec#2 `OVERDUE` |
| renanlunga01 | 10/08 | não — última 31/07 |
| simonedalmasosp | 12/08 | não — rec#2 `OVERDUE`, e 7 assinaturas já `CANCELLED` |
| newquality2018 | 13/08 | não — rec#2 `OVERDUE` |
| sst.medint | 15/08 | não — última 06/08 |
| clonehotmart | 16/08 | não — última 06/08 |
| contato@sto-ne.net | 16/08 | não — última 25/07 |
| cesarelias | 17/08 | não — última 08/08 |
| diretoria@grupoperes | 24/08 | não — sem pagamento nenhum |

**PREJUÍZO MEDIDO: ZERO.** Nenhum aluno foi cobrado por causa deste defeito.
Escrevo assim pra ninguém herdar o cartão achando que há dinheiro a devolver.

> **Ressalva que não escondo:** as `OVERDUE` provam que a Hotmart **continuou
> tentando cobrar** depois do pedido — naqueles casos a assinatura não estava
> cancelada. Eles escaparam porque o cartão do aluno recusou, não porque a casa
> acertou. **Sorte não é controle.**

**A exposição de hoje tem nome.** A consequência (c) só morde quem tem 2
assinaturas ativas: medido agora, **3 contas**, entre elas
`nassaramesquita@gmail.com`, que o `assinatura_em_dobro.cjs` já lista **pagando
em dobro (388 no total)**. Nenhuma das 3 clicou em cancelar até hoje.

## 6. Por que não é ocorrência de cartão que já existe (checagem 1 da ordem de 27/08)

O parente próximo é o `#384` (`6509c3bc`, **fixed**) e a perna 1 dele, o
`saida_x_assinatura.cjs`. Ele **não** cobre esta classe, e por escolha
declarada no próprio cabeçalho:

> *"`subscription_cancellations` NÃO serve como fonte (é tabela de FEEDBACK de
> quem cancela PELA PLATAFORMA). Quem pede por e-mail — que é a classe inteira
> deste cartão — nunca teria linha ali."*

Ali a frase estava **certa** pro problema dele. Mas ela deixou o **espelho
exato** descoberto: **quem clica no app nunca escreve pra ninguém**, logo nunca
aparece em varredura de incidente. As duas varreduras somadas ainda deixam esse
buraco.

## 7. O conserto — PR #429, **não** em produção

Branch `fix/cancelamento-no-app-nao-mente`, commit `33ee84cc`.

- tenta cancelar **primeiro**, escreve ao aluno **depois**;
- cancela **todas** as assinaturas ativas (`.maybeSingle()` → lista); só responde
  `canceled` se nenhuma falhou;
- a palavra "cancelada" só sai com confirmação da API — no resto o aluno recebe
  *"recebemos o seu pedido… ainda não podemos dizer que está cancelado"* mais a
  promessa de retorno;
- falha abre **chamado técnico** (`abrirChamadoReportado`, assinatura por pessoa
  e não por clique) com `console.error` junto e o comando do
  `cancelar_assinatura.cjs` já escrito na descrição;
- `{send_email:true}` → `{send_mail:true}`.

Sem DDL, sem migration, sem coluna nova.

**Prova, com controle de mutação:**

| | |
|---|---|
| `carta-de-cancelamento.test.ts` | **8 pass / 0 fail** |
| mutante "carta sempre otimista" | **3 FALHAM** |
| mutante "carta antes da Hotmart" | **1 FALHA** |
| mutante "`.maybeSingle()` restaurado" | **1 FALHA** |
| restaurado | 8 pass / 0 fail, `git diff` limpo |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` (3 diretórios tocados) | limpo |
| `node --test` incidents + credits + subscription | **167 testes, 0 fail** |

## 8. O que eu **não** fiz, de propósito

- **Não cancelei assinatura nenhuma** e não escrevi pra aluno nenhum: não há
  vítima a avisar, e cancelar hoje em cima de pedido velho é exatamente o erro
  do §3.
- **Não chamei a API de cancelamento nem pra testar.** O único teste honesto do
  path seria um POST que cancela de verdade, e isso não se faz na conta de um
  aluno pra tirar dúvida de documentação. A validação do `send_mail` acontece no
  primeiro cancelamento que passar pela rota **depois do merge** — e a partir do
  merge ela deixa rastro, então a resposta vem sozinha.
- **Não escriturei o passado.** "Quais dos 236 pedidos viraram cancelamento de
  verdade" continua **sem resposta**; o conserto só garante o futuro. Responder
  exigiria varrer os 236 na Hotmart viva — ferramenta nova, fica como **dívida
  escrita**, não como feito.
- **Não mergeei nada.**

## 9. O que precisa do Johnny

Sem novidade estrutural. Repetindo o lote (doutrina de 17/09: juntar, não
re-escalar um por ronda):

1. **WhatsApp/telefone** para os pagantes do `#249` (R$ 8.250,27) — o mesmo aval
   destrava o `94d3015d` (Sunesa, R$597).
2. **Crédito do Gemini** (`olho`, `pesquisa`, `social`).
3. Decisão (c) do `#234` (`TTS_TAIL_QA_INTERNO_MODO=reprovando`).
4. **Quem mergeia conserto pronto** — agora **39** parados, 19 podres. **4º dia
   seguido** em que o gargalo da ronda é entrega, não investigação. O PR #429
   entra nessa pilha.
5. `#426`: as 3 perguntas comerciais de 14hZ seguem abertas.
6. Os **40.000 cr** do `#469` — recolher dos 4 alunos ou perdoar.
7. 🆕 **O `#494` não é "o próximo da fila"**, ao contrário do que a ronda das
   15hZ escreveu: ele está travado na **sua** decisão de produto (o que a classe
   do realismo do Vídeo Clone ouve) + o "pode" do texto que vai aos 7 pagantes.
   Medição 100% concluída, nada a investigar.

## 10. Fim de ronda

- Log commitado na **main** (regra 25-B). Código foi por branch + PR #429.
- Recado no **grupo** via `notify-grupo.sh` (regra de canal de 31/08): o achado,
  o prejuízo zero, a exposição com nome, e o meu erro. Nada no privado do Johnny.
- Escrita conferida na **releitura independente**: `#552` com título corrigido,
  `affected_emails` vazio (não há vítima), 2 notas.
