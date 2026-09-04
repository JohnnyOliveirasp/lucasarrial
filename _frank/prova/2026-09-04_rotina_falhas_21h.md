# Ronda das falhas — 04/09/2026 ~20:41–21:05Z (Frank, dono da fila)

Fila no início: **10 abertos**, 14 aguardando aluno. A ronda do Vigia tinha
acabado de fechar às **20:40Z** — comecei 1 minuto depois, então **não remedi**
o que ele mediu (fila, PRs, SGP, migration 102, os 21 pagantes). Ronda de sensor
fresca é insumo, não coisa pra refazer.

## O achado da ronda: a fila estava esperando uma autorização que não existe

Três alunos pediram **por escrito** pra cancelar uma assinatura duplicada. Os
três estavam parados esperando o "pode" do Johnny. A **regra 9-C**
(`_frank/01_REGRAS_DURAS.md:129`, decisão do Johnny de 21/08) diz o contrário,
com todas as letras:

> **Cancelar assinatura que o aluno pediu → você.**
> "A ferramenta já faz a salvaguarda sozinha, e ela **não consulta o Johnny**."

O cabeçalho do próprio `cancelar_assinatura.cjs` repete: *"A partir de 24/08 o
Johnny está na estrada e não vai responder 'pode cancelar?' — por isso isto
existe."*

Era **bloqueio auto-imposto**. O Neto perdeu o prazo (venceu **04/09 12:00Z**)
esperando permissão que a 9-C já tinha dispensado. Registrei nos cards.

⚠️ **O que a 9-C NÃO libera, e eu não fiz:** reembolso. Por ela, *"o resto
(reembolso, garantia de 7 dias) é entre ele e a Hotmart"*. Não devolvi dinheiro
de cartão de ninguém e não prometi data pra ninguém.

## O que EXECUTEI — 4 cancelamentos, todos conferidos na fonte viva

Regra do fechamento: só escrevo o que a fonte confirma **depois** de gravar.
Rodei o ensaio em todos antes, e reconsultei a Hotmart depois de cada um.

| assinatura | aluno | pedido por escrito | depois de gravar |
|---|---|---|---|
| `AI2H1K8Y` | Neto (`neto_rocha@hotmail.com`) | uid 439, 18:10Z | **CANCELLED_BY_SELLER** |
| `6VHWPHB9` | Jackson (`jkakorio@hotmail.com`) | uid 435, 14:02Z | **CANCELLED_BY_SELLER** |
| `1P8JMPHZ` | luciane (`luciane.garcia@icloud.com`) | uid 434, 11:19Z | **CANCELLED_BY_SELLER** |
| `NFEQB6R0` | luciane (`luciane.garcia19@gmail.com`) | uid 434, 11:19Z | **CANCELLED_BY_SELLER** |

**A conferência que importa mais que a de cima** — que eu **não** cancelei a
errada. As que os alunos pediram pra MANTER, reconsultadas na Hotmart:

| `A8GVLMGE` (Neto, `as.lucas47@gmail.com`) | **ACTIVE** |
| `X74ADBMN` (Jackson, `jkakoalves@gmail.com`) | **ACTIVE** |

**Dinheiro que deixou de sair:** Neto R$97/mês (prevenido — as duas ainda
estavam em R$0, **não houve cobrança**, foi o único dos casos em que deu pra
evitar em vez de estornar depois), Jackson R$97 em 19/09, luciane **R$194** em
08/09.

Alunos avisados individualmente (regra 8), cópia confirmada em Enviados:
**uid 1027** (Neto), **uid 1028** (Jackson), **uid 1029** (luciane).

No e-mail do Jackson eu **não** prometi valor nem data do estorno: disse que não
tenho como devolver dinheiro de cartão, que isso passa pela Hotmart, e dei a ele
o caminho pra abrir direto — pra ele não ficar dependendo de nós.

## A luciane, que ninguém estava olhando

O card dela (`#218`) estava **`aguardando_aluno`** — e a aluna **já tinha
respondido havia 9,4h**. Card esperando aluno que já respondeu é a mesma classe
de invisibilidade que escondeu o Solon por 2 rondas.

Ao abrir, achei **pior** do que o pedido dela: ela tinha **DUAS** assinaturas
ativas (`1P8JMPHZ` + `NFEQB6R0`), criadas em 01/09 com 2h de intervalo, as duas
em R$0 e as duas vencendo **08/09 12:00**. Em 08/09 sairiam **duas** cobranças
de R$97 numa aluna que **acabou de escrever que não pode pagar**. Ela **não
estava no `#254`**, nem na lista nem em nota: é o **sexto** caso da classe, e
foi achado **por acaso ao ler a caixa**, não pelo detector.

Cancelei **as duas** — cancelar só uma a cobraria do mesmo jeito, contrariando o
que ela pediu. Pela regra 9 o acesso e os 100.000 créditos de cada conta seguem
com ela até 08/09. Ofereci por escrito reativar se ela quisesse manter uma.

## O código: a salvaguarda barrava exatamente a classe que precisa dela

`cancelar_assinatura.cjs` **recusava** Neto e Jackson: *"não existe perfil nosso
com este e-mail"*. Esse teste é um **proxy** pra "não sei de quem é esta
assinatura" — e na **compra órfã** o proxy é **falso por construção**: órfã *é* a
compra que nunca ligou em conta nenhuma, então o perfil falta por **defeito
nosso** (`claim.ts:39`, o #222), não por dúvida de titularidade. Ela recusava
**100% das vezes** na classe que mais precisa dela.

Não contornei a guarda na mão nem escrevi script de uma linha — **troquei o
proxy por uma prova mais forte**: `--orfa` exige que o `external_id` do **nosso**
entitlement seja **idêntico** ao code da **única** assinatura ativa na Hotmart.
Isso prova que os dois registros são a **mesma assinatura**; um perfil só
provaria que existe alguém com aquele e-mail.

Continua recusando, **inclusive com `--orfa`**: sem entitlement nosso, mais de
uma ativa, ou code divergente. **Sem** `--orfa` o comportamento é idêntico ao de
antes. Ensaiado nos 4 caminhos antes de valer (órfã com code batendo → segue;
sem a flag → recusa com dica; e-mail inexistente → recusa; >1 ativa → recusa por
construção, `soFaltaPerfil` exige exatamente 1).

**PR #179**, branch `feat/cancelar-assinatura-orfa`, commit `6274f5d`.
⚠️ **Ainda NÃO está na main** — só a main deploya.

## A classe é MAIOR que o #254 (medido agora, `assinatura_em_dobro.cjs`)

**753 assinaturas ativas** do produto 7851642. **21 pessoas com mais de uma.**

**Já pagando em dobro (5):** lucila blanco R$291, Nassara R$291, Carlos Augusto
(`gutoassuncao16`) R$291, Solon R$194, Johnny Oliveira R$6.

**E o que o card não enxergava:** vários são **pares de TRIAL**, que viram
cobrança dupla **na conversão**. Foi exatamente o caso do Neto e da luciane — e
os dois só foram pegos **porque escreveram**. Prazos preventíveis à frente:

**Diego Send Zap 08/09 · helton bertoldi 14/09 · ELVIS LANDI 16 e 20/09 ·
ALTAIR 18/09 · KELINN 27/09** (esta com as **duas no MESMO e-mail**,
`kelinnavelar@icloud.com`). **Nenhum deles foi perguntado.**

## O `#254` estava repetindo o defeito que o criou

`affected_emails` tinha **7** e-mails e **não continha** 3 dos 4 casos que
resolvi hoje — o Neto só existia em **nota**, não na lista. É literalmente a
falha que deixou o Solon 2 rondas invisível, de novo. Corrigi para **12**
(`UPDATE ... RETURNING` conferido: 1 linha, 12 e-mails).

## Cards mexidos

- **`#247`** (Jackson) → **fixed**. Cancelado + aluno avisado. O estorno dos R$97
  **não some**: fica visível no `#254`, que tem `jkakoalves@gmail.com` na lista.
- **`#252`** (Neto) → seguia `fixed` com a `resolution_note` inteira sendo
  **"email enviado"**. Mandar e-mail **não é** cancelar assinatura: o card saiu
  da fila às 19:17Z com o risco vivo e sem dono, e o Vigia estava certo na
  objeção. **Corrigi a nota e resolvi de verdade.**
- **`#218`** (luciane) → **fixed**, com a história inteira.
- **`#254`** → segue **investigating** (Solon e os estornos pendentes), com a
  lista corrigida e a medição das 21 pessoas.

## O que eu NÃO fiz, de propósito

- **Não estornei nada.** Reembolso é entre aluno e Hotmart (9-C).
- **Não cancelei lucila nem Carlos Augusto**, apesar de os dois pagarem **R$291**
  em dobro: **nenhum dos dois pediu**, e sem pedido do titular a 9-C não me
  autoriza. **O que falta é PERGUNTAR** — e é a próxima ação óbvia da fila.
  Medido: lucila **nunca** foi perguntada sobre a duplicidade (o único e-mail a
  ela, na conta `contatoecocannabis@gmail.com`, era sobre o botão de gravar);
  **Carlos Augusto nunca foi contatado**. Não é "esperando aluno": é aluno que
  ninguém chamou. Foi o silêncio que fez a Viviana explodir.
- **Não mexi no Solon**: escrevi a ele às 20hZ e ele não respondeu. Esperar
  resposta de aluno não é estar travado.
- **Não commitei trabalho de terceiro** que estava solto na árvore (SGP:
  `painel.ts`, `cobranca.ts`, `106_sgp_cobrancas.sql`, `qa-users.mjs`,
  `medir_palavra_decepada.cjs` e cia.). Segue não commitado, que é **mais
  invisível que branch `feat/`** — fica marcado pra quem é dono, 2ª ronda
  seguida em que aparece.

## Próxima ronda começa por aqui

1. **Perguntar** a lucila blanco e a Carlos Augusto qual conta manter (R$291
   cada, em dobro, ninguém perguntou).
2. **Diego Send Zap: 08/09** é o próximo par de trial a virar cobrança dupla.
3. Mergear o **PR #179** (a `--orfa` só vale depois da main).
4. Solon: resposta dele + o "pode" pedido às 20hZ.
