# Rotina das falhas — 01/09/2026, ~23h50Z (20h50 BRT)

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, a
ordem de canal de 31/08 (tudo do FastCloner vai no GRUPO, nunca no privado),
`2026-08-29_desligar_vigia_e_frank.md` e `2026-08-20_dono_da_fila_e_fila_zerada.md`.
Método serial (regra 8, 21/08).

Placar de entrada, consulta **sem cláusula de status**: **19 não-fechados**
(1 open + 10 investigating + 8 `aguardando_aluno`). Mesmo número das duas rondas
anteriores; composição igual à das 22hZ.

## O incidente que peguei: `#173` / `954ca6c9` (Johnathan)

**Por que este.** É o mais antigo aberto com aluno pagante travado **agora**, e
era o único da fila com um prazo correndo contra ele. Os mais velhos do relógio
não estavam no meu colo: `#99`, `#197`, `#206`, `#207`, `#214`, `#218`, `#222` em
`aguardando_aluno`; `#171` respondido em 01/09 e parado em escolha de arquitetura
do Johnny; `#202` respondido em 31/08 e parado na mesma decisão comercial que
este.

### O achado: um prazo de dinheiro que ninguém tinha calculado, e ele vence em 24h

Fui à Hotmart pelo `sales/history` e li o `warranty_expire_date` das 3 compras,
transação por transação: `1788393600000` nas três = **03/09 00:00 UTC = 02/09 às
21h BRT**. **A garantia dele vence amanhã às 21h.**

Em **20 notas e 5 dias**, nenhuma continha essa data. O e-mail que a Fast mandou
às 19:00Z (uid 427) chegou a citar "os 7 dias de garantia", mas **sem data e sem
conferir** — e 7 dias contados de 27/08 dariam 03/09, **um dia a mais** que a data
real da Hotmart. Quem fizesse a conta de cabeça queimaria o prazo do aluno em 24h.

### Por que isso inverte a natureza do chamado

Até agora o caso estava escrito como **risco de churn** (ele ameaça cancelar). O
risco real é o oposto, e é nosso: **se ele confiar na gente e esperar**, às 21h de
amanhã ele perde o cancelamento automático e passa a depender de negociação —
tendo esperado desde 27/08 por atraso que é nosso, com **três promessas
quebradas**. Nós teríamos consumido a garantia dele com a nossa própria demora.
Isso não é churn: é dano ao aluno, causado por nós.

### Conferi antes de escrever, em vez de herdar nota alheia

- `aluno.cjs`: SEM ACESSO, 0 créditos, 0 compras na nossa base. O único crédito
  que ele já teve foi o perdão do saldo negativo do onboarding (30/08, +1575 —
  zera, não concede).
- `ler_caixa --enviados --para`: o uid 427 (19:00:19Z) **era mesmo** o último
  envio nosso. A promessa de ligação até as 18h BRT (21:00Z) venceu e nada saiu
  depois. Confirmei a medição do Vigia das 22hZ em vez de repetir a afirmação.
- `ler_caixa --de`: ele **não responde** desde o uid 411 (18:56Z). O silêncio
  agora é dele, não nosso — o que combina com quem já desistiu de cobrar.

### Entregue

E-mail individual às 23h50Z, **cópia CONFIRMADA em Enviados (uid 438)**:

1. Assumi que o prazo das 18h não foi cumprido, e que foi a terceira vez.
2. Dei a ele **a data exata do fim da garantia**, dizendo com todas as letras que
   é contra o nosso interesse dar.
3. Repeti o que não muda: 3 compras aprovadas (R$ 2.391), parte dele completa,
   nada a provar, nada pendente.
4. Disse que **não tenho a decisão** e que não ia inventar a quarta data.
5. Na escolha dele, **não empurrei para nenhum lado**: avisei que esperar
   significa abrir mão do cancelamento automático. É a frase que prova que não
   estamos manipulando, e é a única razão de o e-mail valer mais que o silêncio.

**Por que escrevi, se ele pediu telefone e não e-mail.** Ele pediu humano; um
quarto e-mail de suporte não é o que ele pediu e eu sei disso. Mas a alternativa
era silêncio atravessando a noite com o prazo de reembolso dele correndo. O
e-mail não repete "estamos trabalhando nisso" — ele entrega **um fato novo que
custa dinheiro à casa**. Isso não é a mesma mensagem pela quarta vez.

### O que decidi NÃO fazer, de propósito

- **Não mandei o telefone (41) 99148-1573.** A nota do `#202` cita esse número
  como canal humano, mas `grep` no repositório inteiro **não acha esse número em
  lugar nenhum**. Mandar um telefone que eu não sei se atende, a um aluno que já
  levou três promessas quebradas, seria a quarta.
- **Não me apresentei como pessoa com nome e sobrenome**, que foi exatamente o
  que ele pediu. Inventar um humano seria mentira, e mentira descoberta neste
  caso destrói o resto.
- **Não liberei crédito nem acesso, não criei cortesia.** A decisão é do Johnny.

### Escalado ao grupo

Postado às 23h55Z com o prazo explícito e a pergunta **reduzida a sim ou não**:
compra de CURSO dá direito ao processamento de voz dentro do FastCloner? A mesma
resposta destrava os outros 5 pagantes parados — **R$ 7.644 no total** (medição do
Vigia, 31/08 20hZ).

### Pista para a próxima ronda, com o limite dela declarado

A pergunta que trava tudo é **o que foi vendido**. O `tracking` da compra guarda a
origem: anúncio no Instagram `AD_54_JEITINHO-PREGUICOSO-CONTEUDO`, landing
`www.lucasarrial.com/fci/`. Abri a página: é SPA e o conteúdo é um **VSL** (player
converteai) — a promessa está **falada em vídeo, não escrita**. Baixei o bundle JS
(143KB) e **não há uma linha de copy em português nele**.

**Conclusão honesta: não dá para responder o que foi prometido lendo a página —
precisa transcrever o VSL.** Não fiz nesta ronda por tempo, e registro como o
próximo passo especificado. Isso vale para **6.727 compradores de FCI**, não só
para ele.

## Conferido e devolvido (não era meu)

- **Marcelo (`marcelopersonalthe32@gmail.com`)** — o sweep o marca como "acesso
  vivo, com crédito e sem voz há 23 dias", que lido sozinho parece aluno
  abandonado. **Não é.** Foi respondido três vezes (24/08, 27/08 e 29/08), e o
  e-mail de 29/08 confirma a análise manual (duas pessoas no arquivo de 47min,
  conferido de ouvido em 8 pontos), dá os números certos para regravar, e já
  avisa que o acesso vence 05/09 oferecendo levar o caso ao time. Bola com ele há
  3 dias — a régua de segunda tentativa é 7 dias, então **ainda não venceu**.
  Registro para a próxima ronda não reabrir isso como abandono.

## Erro meu nesta ronda

`anotar_incidente.cjs 173` foi **recusado** — a ferramenta pede prefixo de uuid, e
o `173` é o `numero`. A ferramenta se comportou como devia: recusou em vez de dar
UPDATE que afeta 0 linhas em silêncio. Refiz com `954ca6c9`. Depois de gravar,
reli do banco e conferi tamanho (3992 chars), fim do texto e a presença das duas
frases-chave — a lição da ronda das 22hZ (nota gravada corrompida com sucesso).

## Perímetro da ordem de 29/08

Nada de planilha foi lido, escrito, classificado, avisado ou reprocessado. Nenhum
incidente de planilha foi aberto ou reaberto.

## Dinheiro

Nada estornado, nada cobrado, nada liberado, nenhuma cortesia criada, nenhum
órfão vinculado na mão. Uma pendência apontada ao Johnny, **não decidida por
mim**: a liberação (ou não) do processamento de voz para quem comprou curso —
R$ 2.391 no caso do Johnathan, R$ 7.644 na classe.

## Passo fixo de fim de ronda

Registrado abaixo, depois do commit.

## Estado final, sem maquiagem

**Nenhum incidente foi fechado nesta ronda, e a fila não baixou.** O que mudou é
que o caso mais quente da fila deixou de depender de uma decisão sem prazo e
passou a ter **hora marcada**: 02/09, 21h BRT. O aluno foi avisado do que precisa
para se proteger, inclusive contra nós, e a pergunta que trava R$ 7.644 foi
entregue ao Johnny reduzida a um sim ou não.

O que **não** aconteceu: ninguém ligou para o Johnathan, que é o que ele pediu
desde 28/08. Isso continua em aberto e não tem executor — e é a quarta ronda
seguida em que essa frase precisa ser escrita.
