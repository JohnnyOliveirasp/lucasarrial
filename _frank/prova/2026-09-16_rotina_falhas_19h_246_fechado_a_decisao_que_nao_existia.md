# Rotina das falhas — 16/09 19h

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Fechado:** #246 (`933fd9d6`) → `fixed`, com carta final ao aluno conferida na
pasta de Enviados (uid 2517).
**Correção de nota antiga:** a ronda de 04/09 01hZ afirmou que o curso "Fábrica
de Conteúdo Invisível" concede acesso em produção. **Não concede**, e a prova
está no código e no relógio. Detalhe no §3.

Fila: **84 → 83 abertos.** 0 patch do Vigia. 100 recados `tell_frank` (não
tocados: método é serial e isso é item próprio).

---

## 0. Como escolhi o item

Os quatro cartões mais velhos não são trabalho nosso pendente, e isso foi
conferido antes de pular, não presumido:

- `9ac03612` (56,7d) e `d3d8d1b2` (48,1d) — travados em decisão do Johnny.
- `6c38c99d` (24,0d) — escalado, esperando resposta comercial.
- `#226` `702cc916` (14,9d) — número medido na ronda das 15h, decisão (a)/(b)/
  manter levada ao grupo.
- `#234` `f8587cef` (14,0d) — li a nota inteira antes de pular: os números do
  rollout foram medidos em 12/09 e a chave `TTS_TAIL_QA_INTERNO_MODO=reprovando`
  **gasta GPU contínua**, que a ronda não vira sem aval. Está com o Johnny.

Cabeça real com aluno afetado e **sem nota nenhuma**: **#246**, 12,6 dias,
`resolution_note` NULL desde 04/09. Sem empate — o seguinte nasceu 2 dias depois.

---

## 1. #246 — a dívida era uma resposta, e ela já existia

`jutai.santos@gmail.com`, 6 pedidos no chat do app em 04/09, todos dizendo a
mesma coisa: comprou um produto que (achava ele) incluía a plataforma, está sem
créditos, e teme estar pagando duas vezes.

### O que medi hoje, na fonte viva

| fonte | o que diz |
|---|---|
| Hotmart **viva** (`pagou_de_verdade.cjs`) | **PAGOU** R$ 313,32 em 29/05/2026, `HP0311339973`, *Fábrica de Conteúdo Invisível*, **COMPLETE**. Avulsa. Assinaturas FastCloner: 0. Stripe: 0. |
| nosso banco | `payment_events` **0** e `entitlements` **0** no e-mail dele |
| `profiles` | `plan='free'`, `access_source` NULL, `access_until` NULL, conta de 01/09 |
| créditos | saldo 0 e **nenhum débito** — não há nada a estornar |

**O zero enxerga.** Controle positivo na MESMA consulta: `peres` = 11 ocorrências
e a tabela tem **7.484** eventos. Não é zero cego.

### A causa é de DATA, não de bug

O **primeiro `payment_event` que este sistema recebeu na vida** é de
**09/06/2026 16:11Z**. A compra dele é de **29/05** — **11 dias antes da
integração existir**. Nunca houve webhook dele para processar. Nada quebrou no
caso dele; ele está fora da janela.

---

## 2. A carta, e o erro que eu tinha deixado lá

Fui à pasta de Enviados **antes** de escrever, e o que achei mudou a ronda: ele
**já tinha sido respondido duas vezes**, com **2 minutos** de diferença, em
04/09 — e as duas cartas **não diziam a mesma coisa**.

- **uid 506** (00:48Z) — minha. Confirmei a compra e disse que havia *"uma
  definição comercial em aberto"* sobre o caso dele e que eu voltaria com ela.
- **uid 507** (00:50Z) — disse ao aluno que o curso **não** inclui a plataforma
  e que ela é contratada à parte.

Medi qual das duas casa com produção (§3). **É a 507.** Ou seja: quem errou fui
eu. **Não havia decisão comercial pendente** — a resposta já existia, escrita no
código desde 09/06. Eu prometi voltar com algo que não existia e deixei o aluno
**12 dias** esperando, depois de ele já ter pedido 6 vezes.

**Carta final enviada** em 16/09, assunto *"Sua compra do curso e o acesso à
plataforma — resposta final"*, chave `jutai-246-resposta-final`. **Conferida na
pasta de Enviados: uid 2517** — não é "o script disse que mandou". Ela:

1. confirma a compra com valor, data e transação;
2. dá a resposta definitiva: curso e plataforma são produtos separados;
3. **assume o erro da promessa sem lastro**, com todas as letras;
4. deixa claro que não houve cobrança nem perda de crédito — o saldo é 0 porque
   nunca foi lançado, não porque sumiu;
5. roteia dúvida de curso para `suporte@lucasarrial.com` / WhatsApp
   (41) 99148-1573;
6. pede o print da página de vendas **caso** o FastCloner estivesse anunciado
   junto.

---

## 3. ⛔ Corrijo a nota da ronda de 04/09 01hZ

Ela afirmou: *"os 12 `PURCHASE_APPROVED` do curso geraram 12 entitlements
automaticamente (…) o curso **concede acesso em produção**"*, e registrou isso
como correção que devíamos ao aluno. **Está errada.** O curso não concede nada
há três meses.

**A prova está no código e no relógio:**

- `frontend/src/app/api/v1/webhooks/hotmart/route.ts:110-116` **descarta** evento
  de produto que não é o nosso (`"de_fora"` → 200 sem gravar nada).
  `HOTMART_PRODUCT_ID=7851642` (a assinatura). O SGP (`7283229`) entra desde
  03/09 **só** para disparar o e-mail do portal — o comentário do próprio
  arquivo diz que ele **não** ganha acesso, crédito nem entitlement.
- Esse descarte subiu em **`4688e40`, 09/06 18h50Z**.
- Os **12** entitlements do produto **`7283335`** (o curso) foram criados
  **todos** entre **16:14Z e 18:19Z do MESMO 09/06** — a janela de **2h26** antes
  do descarte entrar. Depois disso: **zero**. `max(created_at)` do produto =
  09/06.

Ou seja: os 12 são **legado de uma janela de 2h26**, não política da casa. O
único deles com conta criada é `drfabiovilhena29@gmail.com`, hoje `plan='pro'` /
`access_source='hotmart'` / `access_until` NULL — vitalício pelo gate que subiu
em `bf1fd6d` (06/09). Ele é beneficiário de uma janela, não de uma regra.

**Consequência prática:** a pergunta *"compra avulsa do curso dá acesso à
plataforma?"*, que três rondas seguidas mandaram pro grupo como decisão
comercial pendente, **já está respondida pelo código**: não dá. O que ainda é
decisão comercial é outra coisa — se a casa **quer** mudar isso —, e essa
ninguém está esperando pra atender aluno.

---

## 4. A ressalva que eu não escondo

`score` de veredito nenhum substitui a página de vendas. **Se a página da
Fábrica de Conteúdo Invisível anunciava o FastCloner junto, a resposta muda e o
caso volta.** Pedi o print a ele na carta. Até esse print existir, o veredito
acima é o que a casa faz — não é o que a casa prometeu na venda, porque essa
peça eu não li.

---

## 5. O que eu NÃO fiz

- **Não criei entitlement, não liberei acesso e não lancei crédito** para o
  Jutaí. Fazer isso seria inventar política: a política da casa, escrita no
  código, é que o curso não dá a plataforma.
- Não estornei nada (não havia débito), não gastei GPU, não apliquei migration,
  não abri PR e **não subi código — esta ronda não tem commit de código, só este
  registro**.
- Não virei a chave do `#234` nem decidi o `#226` no lugar do Johnny — os dois
  seguem com ele.
- Não toquei nos 100 recados `tell_frank`.
- **Não toquei no `#288`** (`df008dcf`, 9,9d): li e **não é a mesma classe** —
  lá o aluno tem o curso num e-mail e o FastCloner em outro e quer unificar.
  É item próprio da próxima ronda, e fica registrado aqui como candidato a
  cabeça.
- Não toquei em nada da planilha (ordem de 29/08).

## 6. Lição

Nota de ronda **não é fonte**. A afirmação "o curso concede acesso em produção"
sobreviveu 12 dias e virou promessa a um aluno pagante porque ninguém foi olhar
o `created_at` dos 12 registros — todos do mesmo dia, todos antes do commit que
fechou a porta. Contar linhas não basta: **olhe quando elas nasceram e o que
mudou depois.**
