# 14/09 ~19h40-20h20Z — Rotina das falhas

Método serial (regra 8): peguei **um** caso e levei até o fim do que era meu.
Fila **81 abertos** na abertura (1 com 30d+, 3 entre 15-30d, 29 entre 7-15d) —
mesmo número da ronda das 18h.

Varreduras fixas da ronda, antes de tudo:

- **2 (travados):** 3 em "acesso vivo, com crédito e sem voz pronta", **nenhum
  novo**: Marcelo (35d, já tratado), Eric e Euneiva em `awaiting_training`
  esperando o clique **deles** (1d e 0d, prazo normal). Mais 1 `training_jobs`
  obsoleto (voz já `ready`, ninguém esperando). Nada a fazer.
- **2-B (pedido de saída × assinatura viva):** **0 sangrando**, com os dois
  controles OK (esquerda reencontrou o Marcelo, direita devolveu `SUR21VU9`).
  Zero de instrumento com controle vivo é zero de verdade.

## Qual peguei, e por que

A cabeça da fila segue parada em decisão alheia, e conferi antes de pular:

| incidente | por que não peguei |
|---|---|
| `d3d8d1b2` #15 (46,3d) | trabalhado hoje 13:47Z |
| `ce6e157d` #47 (26,3d) | trabalhado hoje 14:48Z |
| `6c38c99d` #99 (22,1d) | decisão com data: e-mail sai 16-17/09 |
| `b2651a6f` #101 (21,9d) | trabalhado hoje 10:22Z |
| `506b7c3a` #223 (13,2d) | bola com a aluna + dinheiro do Johnny |
| `702cc916` #226 (13,1d) | parte autorizada subiu 12/09; resto é produto |
| `f8587cef` #234 (12,1d) | usado hoje às 15h como **régua**; a classe não andou, mas foi olhado |
| `933fd9d6` #246 (10,8d) | ponta (a) fechada 14/09 00hZ; ponta (b) é dinheiro do Johnny, reescalada ontem |

Sobrou o **`#250`** (`8c29740f`, 10,1d) — pagante, e com um passo que era **meu**
e estava parado havia **8 dias**.

## O que era, de verdade

**Uma ficha esperando permissão para um canal enquanto o outro canal nunca foi
retentado.** A ronda de 13/09 achou o telefone do aluno na Hotmart e parou ali,
no aguardo do aval para WhatsApp — o que estava certo. Mas a última tentativa de
**e-mail** era de **06/09**. Oito dias sem ninguém reencostar no único canal que
eu posso usar sozinho (regra 8).

**E eu tinha um motivo novo para retentar, medido no cartão vizinho.** O `#338`
(Valdeni, mesma classe, caixa-cheia no MSN) produziu o contra-exemplo:

| | caixa cheia desde | 3ª tentativa | resultado |
|---|---|---|---|
| Valdeni `#338` | 10/09 | 13/09 22:13Z | **sem bounce — entrou** |
| Anderson `#250` | 04/09 | 06/09 20:48Z | bounce |

A nota de 06/09 do `#250` tinha **refutado** "caixa cheia se resolve sozinha" com
3 tentativas em 3 dias. A refutação era honesta **para aquela janela**. Em janela
maior ela cai: a caixa da Valdeni esvaziou entre 10/09 e 13/09 e a carta entrou.

## O que fiz

- **Mandei a 4ª tentativa pro Anderson** (Enviados **uid 2331**, cópia
  confirmada na 1ª tentativa). Assumi as 3 falhas nossas com data, dei o portal,
  o material e o WhatsApp, e convidei endereço alternativo.
- **Mudei o desenho da carta**, por causa de um defeito que medi nesta ronda:
  **não mandei link de senha nenhum**. Toda a classe manda link recovery de
  **1 hora** para quem está com a caixa entupida há dias — a carta fica presa,
  entra depois e o botão principal chega **vencido**. Levei só o caminho que não
  expira (`login` → "Esqueci minha senha") e disse a ele por quê.
- **Corrigi o balde do `#338`**: `investigating` → `aguardando_aluno`. É a
  primeira vez que isso é verdade nessa ficha — ela **foi alcançada, com prova**.
  Com decisão datada: se não logar até **16/09**, vira segunda tentativa +
  escalada de canal.
- **Anotei `#250` (2 notas), `#338` e `#328`** — todas com releitura conferida e
  1 linha afetada.

## O que a 4ª tentativa respondeu — e me obrigou a me corrigir

**Quicou também.** `14/09 19:45:43Z`, 552 caixa cheia.

A minha primeira varredura pós-envio deu **zero** e eu a registrei como "sinal
bom, **não** veredito — revarrer antes de concluir". Revarri, e o bounce estava a
caminho. A ressalva salvou a ficha de gravar uma entrega falsa; o placar é
**4 tentativas, 4 bounces**, caixa cheia sem interrupção **de 04/09 a 14/09**.

**Isso corrige a minha própria tese desta ronda.** "Espace as tentativas e volte
para conferir" está certo e é **insuficiente**: caixa-cheia não tem prazo
previsível (3 dias na Valdeni, 10+ no Anderson), então sem um **corte** o retry
vira espera infinita com cara de diligência. O corte deste caso foi atingido em
06/09 e a ficha passou 8 dias sem retentar **nem** escalar.

**Regra que proponho pra classe:** retentar **uma** vez com folga (~7 dias). Se
quicar, o e-mail está morto e o caso vira **escalada de canal**, não mais
tentativa.

## Achado colateral: o nosso IP de envio segue bloqueado

Medido ao vivo, 4,8 dias depois do pedido no recado `para_frank_9430d4bd`:

- `48.68.207.104.dnsbl.spfbl.net` → **`127.0.0.4` (LISTADO)**
- limpo em **spamhaus zen, barracuda, spamcop, sorbs, psbl** — conferidas uma a uma

Não é reputação podre generalizada, e registro isso de propósito para a próxima
ronda **não** pendurar todo bounce da fila aqui: `#250` e `#338` são caixa-cheia
do destinatário, não bloqueio. Mas spfbl é brasileira e muito consultada por
provedor corporativo BR — que é o nosso público. Duas vítimas conhecidas:
`#328` (`diretoria@ollem.com.br`, o MX cita a lista pelo nome) e `#379`
(`luctec@gmail.com`).

## O que NÃO fiz, e por quê

- **Não mandei WhatsApp** pro Anderson nem pra Valdeni: canal externo não é minha
  alçada sozinho. O pedido de aval de 13/09 continua de pé e agora tem prova de
  que o e-mail acabou.
- **Não submeti o delist na spfbl**: é formulário a terceiro em nome da casa, não
  é leitura. Levado ao Johnny com o link.
- **Não escrevi pra Valdeni de novo**: são ~21h, atravessadas por uma noite de
  domingo, e a carta que chegou já traz o caminho que não expira. Uma 4ª carta em
  menos de um dia é ansiedade nossa, não ajuda pra ela.
- **Não gerei link recovery novo** pra ela: reescreveria `recovery_sent_at` e
  apagaria a prova que a nota usa.
- **Não marquei nada como `fixed`** (regra 14): ninguém entrou na conta.
- Não mexi em crédito, acesso, plano, entitlement; não apliquei migration, não
  mergeei PR, não gastei GPU, não toquei na planilha (ordem de 29/08).

## Lições

1. **Ficha pode ficar parada esperando aval de um canal enquanto o outro canal,
   o que não precisa de aval, nunca é retentado.** O `#250` passou 8 dias assim.
   Quando escalar algo, pergunte também: sobrou algum passo que já é meu?
2. **Refutação é válida na janela em que foi medida, e só nela.** "Caixa cheia
   não se resolve sozinha" era verdade em 3 dias e falsa em 3+. Nota que refuta
   deveria carimbar o tamanho da janela, senão ela congela o caso para sempre.
3. **Entregar a carta não é entregar o acesso.** A Valdeni recebeu e continua
   sem entrar, porque o link que ia dentro morreu 1h depois. A ficha media a
   primeira coisa e chamava de sucesso.
4. **Mandar link de 1 hora para caixa entupida é garantir que ele chega morto.**
   O defeito é da classe inteira, não de uma carta.
5. **Varredura logo após o envio pode dar falso negativo.** A ressalva "sinal,
   não veredito" é o que separou uma nota honesta de uma entrega inventada.

## Estado do repo ao fim da ronda

- **nenhum código subiu nesta ronda** — só este log, 1 e-mail e 4 notas de
  incidente. Logo não há branch `feat/` com commit preso.
- `git log origin/main..HEAD` conferido vazio após o push.
