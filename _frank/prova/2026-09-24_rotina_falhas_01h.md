# Ronda das falhas — 24/09 ~00h40 a ~01h20Z (Frank, dono da fila)

**Desfecho: ZERO incidente fechado. O que esta ronda entregou foi um critério de
fechamento DECIDIDO (condição (b) do `#290`, aberta desde 07/09), uma previsão
de dinheiro REFUTADA antes de virar decisão errada do Johnny (R$ 291 que a nota
de 16/09 disse que iam ser pagos e não foram), uma pergunta de 17 dias fechada
com instrumento canônico no `#294`, e duas armadilhas de instrumento medidas —
uma delas ia ao grupo com erro de 400x.**

Gasto: **zero GPU, zero crédito movido, zero migration, zero merge, zero código
de produção tocado, zero e-mail enviado.** As escritas foram 2 notas de
incidente. Nenhum incidente mudou de status.

Fila não baixou. Isso é resposta legítima e está explicado item por item: os
três cartões mais velhos que peguei estão travados em decisão que não é minha, e
eu digo em qual passo cada um parou (regra 8).

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável. **1145 = 1145**, nenhuma sumiu (1068 já com linha + 77 fora da janela). Subiu de 1142/1065 na ronda anterior: **3 cartas novas, todas já com linha**. |
| `enviados_x_tabela` (irmão de leitura, independente) | **VEREDITO: 0 carta depois do corte.** Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho **0d**. Controle positivo (#310) e negativo (#518) OK, 528 varridos. |
| Censo da fila | **115** abertos pelo `idade_dos_abertos` (146 contando `aguardando_aluno`) · **67 com 7d+** · mais velho **55d** |
| `esperando_johnny` | **17** parados em decisão do Johnny · mais velho **55d** · **54 alunos** atrás da fila |
| `fechados_que_disparam` | 16 fechados com sinal de vida, **1 vivo nas últimas 48h** — apurado abaixo (§5) |

**Não re-escalei o lote de decisões.** Ele foi ao grupo às 20hZ de hoje (23/09) e
a doutrina de 17/09 manda **lote, não repetição**. Repostar 4h depois é ruído, e
o Lucas está no grupo. Os números corrigidos ficaram gravados no cartão para
entrar no **próximo** lote com a redação certa.

---

## 2. Serial: `#290` / `446c3ae4` — "nosso e-mail diz ao assinante pagante que ele não tem a plataforma"

### 2.1 Por que este cartão

Regra 8: empate em **17d** entre `df008dcf` (1 aluno) e `446c3ae4` (**8 alunos**,
15 ocorrências, reincidiu hoje com aluno nomeado). Empate vai pro que tem mais
gente sofrendo.

### 2.2 DECIDI a condição (b), que a nota 11 deixou explicitamente para esta ronda

A nota 11 (16/09) escreveu: *"quem decide critério de fechamento deste card sou
eu na próxima ronda"*. Decidi, com medição nova.

**Medido:** das **130** cartas `"Seu Sistema de Geração Pronto: comece por aqui"`
em `emails_enviados`, todas as 130 saíram depois do fix `0b672b2` (07/09
01:51:59Z), e em **0 de 130** o destinatário tinha assinatura FastCloner **paga
antes** da carta sair. Critério que não erra (nota 11 item 4): produto 7851642 +
`price.value>0` + status APPROVED/COMPLETE/COMPLETED + `approved_date` anterior
ao `enviado_em` — **não** `created_at` de entitlement, que não data o que o aluno
sabia.

Em **17,0 dias** o ramo corretivo **não rodou uma única vez** (a nota 11 media
9,6 dias e 19 envios; hoje são 17,0 dias e 130 envios). O perfil dos 8 — SGP +
assinatura no MESMO checkout, order bump C1/C2 — não reapareceu nenhuma vez em
130 compras.

**A condição (b) como estava escrita mantinha o card aberto para sempre por um
evento fora da nossa mão. Ela SAI.** No lugar dela, como prova da metade de
**código**:

- **(b1)** lógica validada contra produção real: a consulta do fix devolve TRUE
  em 8 de 8 dos afetados (07/09, reconfirmado 17/09 na perna irmã);
- **(b2)** **zero vítima nova em 130 cartas reais** desde o fix — o ramo ELSE
  disparou nas 130 e nas 130 ele era VERDADE.

**A metade de código do `#290` está provada. O que sobra do cartão não é código.**
Limite declarado: `emails_enviados` só existe desde 14/09 14:06Z; a janela
07/09–14/09 foi medida pela pasta Enviados na nota 11 (19 envios, zero vítima) e
não foi remedida hoje. As duas juntas cobrem a janela inteira.

### 2.3 ⚠️ A nota 11 previu R$ 291 de cobrança. A realidade desmentiu, e eu corrigi

A nota 11 escreveu: *"nos próximos 4 dias, TRÊS pessoas pagam o SEGUNDO mês"* —
R$ 97 × 3 = R$ 291.

**Medido no payload cru: as três cobranças saíram e NENHUMA foi paga.**

| aluno | quando | ciclo | valor | meio | status final |
|---|---|---|---|---|---|
| `rmf174@gmail.com` | 19/09 13:56 | rec#2 | R$ 97,00 | PIX | BILLET_PRINTED → **DELAYED** |
| `flaviamalavazi@gmail.com` | 20/09 13:55 | rec#2 | R$ 97,00 | PIX | BILLET_PRINTED → **DELAYED** |
| `rutifortuna8@gmail.com` | 20/09 14:02 | rec#2 | 118.887 PYG (R$ 103,25) | cartão | **DELAYED** |

Cobrado e **não pago: R$ 297,25**. Pago de verdade pelos 8 desde a nota 11:
**R$ 0,00**.

**Quem reusar o cartão NÃO deve repetir "R$ 485 de silêncio":** os R$ 194 (max e
cris, 13/09) foram pagos de verdade; os R$ 291 **não entraram**. Corrigi em vez
de deixar o número inflado de pé — ele estava a caminho da mesa do Johnny como
argumento de decisão.

**O argumento não desaparece, troca de lado** — e isto é leitura, não medição,
e está marcado como tal: três pessoas que nunca entraram no produto estão agora
**inadimplentes** numa assinatura que a nossa própria carta disse que elas não
tinham. **NÃO afirmo causa** (não perguntei a nenhuma; boleto não pago tem
explicação banal). O que está medido é que o silêncio deste cartão deixou de
custar reputação e passou a custar **receita que não entrou**.

**O fato mais forte do cartão:** `cris_evangelista22@hotmail.com` pagou o
**terceiro** ciclo (rec#3, 13/09, R$ 97 APPROVED, acesso até 13/10) e **nunca
logou uma vez** — `auth.users.last_sign_in_at` NULL, 20 dias depois da carta que
disse a ela que a plataforma "é contratada à parte".

### 2.4 Estado dos 8, medido agora

**6 de 8 nunca logaram** (era 7 de 8 em 07/09, 13/09 e 16/09). Medido em
`auth.users`, coluna autoritativa — `profiles.last_seen_at` subnotifica.

**Mudança nova, a primeira boa deste cartão:** `rmf174@gmail.com` **logou em
22/09 23:26Z**, primeira vez em 34 dias de assinatura, 18 dias depois da carta
falsa. Conferi se ele encontrou porta trancada, porque seria dano novo: **não
encontrou.** Está `plan=free` com `access_until` vencido (19/09) mas com 100.000
créditos, e o portão das telas é **por crédito**, não por assinatura — conferido
no fonte em produção (`roteiro/page.tsx:57` `canGenerate = team || creditsTotal
>= ROTEIRO_COST`; `videos/edicao/page.tsx:44` `unlocked = bypassesBilling ||
creditsTotal > 0`). Com 100.000 créditos ele gera. A REGRA FINAL DE CRÉDITO
("mantém o acesso", 20/08) está sendo cumprida. **Nada a consertar, nada a
escalar.**

`atendimento@dropweb.com.br` passou de `active` para **`canceled`** com
`access_until` 02/10 (futuro) — pela regra única (`canceled` com data futura TEM
acesso) ele segue com acesso. Correto.

1.000.000 de créditos parados no conjunto. 8 de 8 sem nenhuma voz e sem nenhum
pedido no SGP.

### 2.5 Silêncio conferido, e ele é total

`emails_enviados` não tem **uma** carta para nenhum dos 8 — **0 linhas**. A
tabela existe desde 14/09: em **10 dias** a casa não escreveu nada a nenhum
deles. As últimas palavras nossas continuam sendo a carta falsa de 04/09 e a
carta individual do Max de 08/09.

Conferi se algum dos 8 nos procurou, porque aí a regra 8 me obrigaria a responder
hoje sem pedir permissão: **nenhum abriu chamado, nenhum escreveu.** Os dois
cartões que os citam (`cced114f`, `03e7b34b`) estão `fixed`.

**Não existe carta individual devida, e eu NÃO fatiei o lote de 8 em 8 cartas
"individuais" para driblar a regra 8** — isso seria e-mail em massa com outra
fantasia.

### 2.6 Passo exato em que emperrou

Falta **uma** coisa e ela não é minha: o **"pode" do Johnny** para o e-mail de
reparação dos 8 (lote; regra 8 de 21/08). Pedido desde 04/09 — **hoje são 20
dias**. O texto está escrito, conferido e corrigido desde 07/09 em
`_frank/rascunhos/2026-09-07_290_correcao_8_assinantes.md`.

Redação certa para o próximo lote: não é *"R$ 485 pagos por gente confusa"*, é
**"R$ 297,25 que não entraram, de 3 pessoas inadimplentes que nunca entraram no
produto, mais uma que já pagou 3 ciclos sem nunca logar"**.

---

## 3. `df008dcf` — lido e devolvido travado, sem nota nova

Segundo do empate de 17d. Li as 5 notas. A nota 5 é de **4 horas atrás** (23/09
19:46Z) e já fez o trabalho: o aluno voltou hoje 19:10Z, a **Fast já respondeu
corretamente** (Enviados uid 3280, conferido contra o fonte em
`avisos.ts:263-299`), e o que resta é a mesma **decisão comercial** de 16/09 —
honrar a promessa de 15/09 e devolver o trial de R$ 0 no `andreviana07`, ou
manter o gate. Foi no lote das 20hZ.

**Não escrevi nota** porque não tinha medição nova a acrescentar em 4 horas.
Nota que só repete a anterior é ruído no cartão.

---

## 4. `#294` / `94d3015d` — fechei a pergunta de 17 dias com o instrumento canônico

Terceiro cartão (16d, Sunesa, SGP de **R$ 597,00** pago e nunca entregue).

**O que ninguém tinha feito:** a ferramenta que responde a pergunta que decide
este caso — `_frank/ferramentas/2026-09-19_segundo_email_por_cpf.cjs`, "existe um
SEGUNDO endereço vivo da mesma pessoa?" — nasceu em **19/09**, **seis dias depois
da última nota daqui**, e nunca foi rodada contra esta aluna. A nota 4 (07/09)
afirmava "não existe outro endereço dela em lugar nenhum do nosso banco", mas
isso mediu o **nosso** banco, antes de existir instrumento pra perguntar à
Hotmart.

**Medido hoje:** `Sunesa C G Kazava` → **nenhum outro endereço sob este nome**.
Com **controle positivo OK na mesma execução** (glaubermed: nome resolvido, 15
transações) — o zero é **medido**, não instrumento cego.

**Consequência, e é o valor da nota:** **não existe rota de e-mail** para esta
aluna. O caminho que resolveu o `#249`/Glauber no mesmo dia por e-mail (canal
pré-autorizado, regra 8) **não se aplica**. O bloqueio é **real** e não é falta
de ter procurado. Nenhuma ronda futura precisa refazer esta pergunta.

Reafirmei o que a nota 4 acertou: **não adivinhar variação do endereço** —
entregar os dados de uma compra de R$ 597 a um homônimo é pior que o silêncio.

**Passo exato em que emperrou:** aval para o canal telefone/WhatsApp — (15)
99653-4224 — pedido ao grupo em 13/09, **11 dias**.

---

## 5. Armadilha listada: classe fechada que segue disparando

`fechados_que_disparam`: 16 fechados com sinal de vida, **1 vivo nas 48h** —
`#523` / `88550a1f`, `ignored`, fechado pelo **sistema em 0.000s** depois do
disparo, título já prefixado `[endereço obsoleto]`, 1 ocorrência, disparou 33h
atrás, aluno `ricongociosonline@gmail.com`.

Conferi antes de descartar, porque "fechado pelo sistema na hora com aluno
nomeado" é exatamente a forma da classe `#249`: `pagou_de_verdade` devolve **sem
pagamento neste endereço**. Com o endereço já marcado como obsoleto e sem
pagamento, **não há evidência de dano e não escalei**.

**Ressalva honesta:** "sem pagamento" carrega a cegueira medida na ronda das
00h50Z de hoje (`/sales/history` **não enxerga REFUNDED**), então isso **não
prova** que a pessoa nunca pagou — prova que este endereço não tem pagamento
visível. Com o marcador de obsoleto, não há ação; se o cartão voltar a disparar,
reabra por `--transacao`, não por nome.

---

## 6. ⚠️ Duas armadilhas de instrumento medidas hoje (as duas quase viraram fato)

**6.1 — `payment_events.payload` aninha em `payload.data.purchase`, não
`payload.purchase`.** Meu primeiro script leu `payload.purchase.price.value` e
imprimiu **"R$ 0"** e **"status ?"** em 7 eventos, concluindo "0 cobrança nova" —
que **por acaso batia com a conclusão certa, pelo motivo errado**. Zero de
instrumento cego não é zero medido. Só peguei dumpando o payload cru e vendo a
chave `data` no meio. **Confira sempre uma chave conhecida (`transaction`,
`status`) antes de acreditar num campo numérico.**

**6.2 — nunca some `price.value` sem ler `price.currency_value`.** A rutifortuna8
paga em **PYG**: `value` = 118887 com `currency_value` "PYG" (R$ 103,25 no
`original_offer_price` BRL). Somando cru, o script cuspiu **"R$ 119.275,00
cobrados e não pagos"** — número que, se tivesse ido ao grupo, era acusação falsa
com erro de **ordem de grandeza 400×**. Quando a moeda não é BRL, o campo
confiável é `original_offer_price`.

Ambas gravadas no item 6 da nota nova do `#290`.

---

## 7. Fim de ronda

- Log commitado na **main** (regra 25-B).
- **Nenhum código de produção tocado** — não há fix preso em branch de feature.
- Conferido de passagem e registrado: **PR #316 está MERGEADO** (17/09 14:48Z,
  merge `8e8729a`) e `origin/feat/290-irmao-pronto-le-entitlement` está **0
  commits à frente da main**. O cartão irmão `#434`/`2614845d` está `fixed` com
  `resolved_at`. Nada preso.
- Escritas conferidas na releitura: `#290` **1 linha afetada, 13 → 14 notas**;
  `#294` **1 linha afetada, 5 → 6 notas**. Não no que o script pretendia fazer.
- Grupo: postada **uma** linha — a correção do número que está na mesa do Johnny
  (os R$ 291 não entraram). Não postei ronda vazia nem progresso parcial.
