# Rotina das falhas — 16/09 ~17hZ

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Fechado:** **#286** (`9491ca31`) → `ignored`, com prova de entrega relida do
IMAP e controle positivo na busca de bounce.
**Medição nova:** a premissa do **#249** (Glauber) deixou de ser suposição de 12
dias e virou medição de hoje — e o controle que quase me fez errar está no §2.
**Promessa sem lastro pega com 1 dia:** **#288** (André) — §4.

Fila: **83 → 82 abertos.** 0 patch do Vigia. 100 recados `tell_frank` (não
tocados: método é serial). Nenhum commit de código nesta ronda — só este
registro e as notas nos cartões.

---

## 0. Como escolhi o item, e por que os quatro primeiros não eram trabalho meu

Conferi a cabeça um a um **antes** de pular, e não por memória de ronda passada:

| cartão | idade | por que não é a bola nossa hoje |
|---|---|---|
| `9ac03612` | 56,7d | decisão do Johnny |
| `d3d8d1b2` | 48,1d | `ignored` por aceite de risco do Johnny |
| `6c38c99d` | 24,0d | escalado, resposta comercial |
| `#226` `702cc916` | 15,0d | chave de GPU, com o Johnny |
| `#234` `f8587cef` | 14,0d | idem |
| **`#249` `132f7808`** | **12,0d** | aval de WhatsApp pedido em **13/09** — 3 dias |
| **`#250` `8c29740f`** | 12,0d | mesmo aval |
| `#263` `5c68eb33` | 11,1d | definição dos R$ 97, com o Johnny |
| `#270` `9d9baab6` | 11,1d | estorno de 25.000 cr / 14 alunos, com o Johnny |

**A cabeça inteira da fila está parada em palavra alheia.** O `#286` (10,0d) era
o mais velho com aluno do outro lado onde a bola é **nossa e só nossa**.

---

## 1. #249 — gastei a ronda tentando derrubar o bloqueio antes de aceitá-lo

Tudo neste cartão depende de uma frase escrita em **04/09**: *"glaubermed@ig.com.br
não existe"*. Ela vinha de **um** bounce, de **um** envio, e ninguém reencostou
nela em 12 dias. Se o endereço tivesse voltado à vida, o caso se resolvia por
e-mail — **canal que a regra 8 já me autoriza**, sem aval de ninguém. Então
medir valia mais que escrever "bloqueado" pela terceira vez.

Medi com conversa SMTP **read-only** (EHLO + MAIL FROM + RCPT + RSET, **sem
DATA**): não entrega nada, não gera bounce, não custa nada.

```
RCPT glaubermed@ig.com.br      -> 550 5.1.1 User unknown in virtual mailbox table
RCPT elianecaurim@ig.com.br    -> 250 2.1.5 Ok      <= CONTROLE POSITIVO
RCPT contato@ig.com.br         -> 250 2.1.5 Ok      <= CONTROLE POSITIVO
RCPT zz9q7x3k2m8v4t@ig.com.br  -> 550 5.1.1 user unknown    (controle negativo)
```

O 550 de hoje é **palavra por palavra** o texto do bounce de 04/09. Endereço
morto, confirmado **hoje**. O bloqueio é real — não era desleixo meu.

## 2. ⚠️ O controle que quase me fez concluir errado

Minha **primeira** rodada usou só `postmaster@ig.com.br` como controle, porque a
**RFC 5321 obriga** todo domínio a aceitá-lo. Ele voltou **550 igual ao do
aluno**. Com esse controle a leitura honesta seria *"este servidor recusa tudo,
não dá pra afirmar nada"* — e eu teria parado ali, com a conclusão certa pelo
motivo errado.

O `ig.com.br` simplesmente **não honra** `postmaster@` nem `abuse@`. Só um
endereço **real do mesmo domínio** desempatou — e ele existia na nossa própria
base.

> **Regra pra próxima ficha de bounce:** controle negativo (endereço aleatório)
> **não basta**, e `postmaster@` **não é controle confiável** no mundo real. O
> único que decide é **um endereço do mesmo domínio que o servidor ACEITA**.

## 3. O limite da técnica — dito antes de alguém se animar, e por isso NÃO virou ferramenta

Ela funcionou aqui por sorte de reputação. Contra provedor rigoroso **não mede
nada**:

- **iCloud**, da minha máquina: `550 5.7.1 Mail from IP ... Spamhaus PBL` —
  recusa **por IP, antes** de olhar o destinatário. Ler isso como "caixa morta"
  seria erro grave.
- **Do Hetzner** (`91.99.15.213`) não dá pra medir: porta 25 de saída não passa
  (pendurou até o timeout). Esperado — a Hetzner bloqueia 25 por padrão.
- E o IP que **de fato** entrega o nosso e-mail não é nenhum dos dois: a saída
  vai pelo relay `mail.privateemail.com:587`.

**Conclusão honesta: ela responde "este endereço existe?" quando o destino
colabora, e NÃO responde "a nossa carta vai chegar?".** Em particular não tem
nada a dizer sobre o **#250** (caixa cheia no iCloud), onde eu tentei e ela é
cega.

**Por isso não virou `_frank/ferramentas/`.** Uma ferramenta que acerta no
skymail e cospe "morto" no iCloud viraria, na terceira ronda, um instrumento
cego carimbando aluno vivo como inalcançável — o mesmo defeito que a casa já
pagou em 07/09 e em 13/09. Fica como técnica documentada no cartão, com o limite
colado nela.

## 4. #288 — promessa sem lastro, pega com 1 dia em vez de 12

O cartão estava **cego**: última anotação de 10/09 dizendo "aluno respondido,
nada a fazer". Mas o caso andou **fora** dele. Relido do IMAP hoje:

- **15/09 13:40Z (INBOX uid 638)** — André respondeu: quer tudo em
  `andreviana07@gmail.com`, e pergunta *"certifique-se o curso está ativo ou
  tenho que refazer a compra"*.
- **15/09 13:40Z (Sent uid 2443)** — a casa prometeu **reverter o cancelamento**
  e *"eles vão confirmar direto com você"*. **Ninguém executou e não estava
  anotado em lugar nenhum.**

Medido na fonte viva: `contatogrupoavip@gmail.com` **pagou R$ 2.824,10** em
05/09 (Fábrica R$ 279,50 · **SGP R$ 741,00** · Comunidade R$ 1.803,60).
`andreviana07@gmail.com` **não pagou nada**: o que há lá é a assinatura
`HP1727469932` de **R$ 0,00** — **entrada de trial**, cancelada — com 100.000 cr
e `SEM ACESSO`.

**A correção que muda a resposta certa:** "reverter o cancelamento" não é
restaurar uma compra dele, é **re-conceder um trial gratuito** que ele mesmo
cancelou. O `SEM ACESSO` é o gate **funcionando** (curso não dá plataforma, SGP
não dá plataforma — cravado hoje no #246).

**E a parte boa, também medida:** `sgp_pedidos` tem linha dele (`5ba4dd59`,
status `foto`). O SGP de R$ 741 **começou** — ao contrário do #249 e do #250,
que estão em zero.

**Não escrevi pra ele hoje, e isso é decisão, não preguiça.** A única coisa
aberta pra ele é exatamente o que está sob decisão. Se eu disser hoje "era teste
grátis" e o Johnny mandar devolver amanhã, a casa diz duas coisas opostas em dois
dias — foi o erro do Jutaí (#246), duas cartas com 2 minutos de diferença. Ele
não sofre enquanto isso: sem cobrança indevida, sem crédito debitado, entrega
andando.

> **Decisão pro grupo:** honrar a promessa de 15/09 e devolver o trial de R$ 0
> (acesso + os 100.000 cr que já estão lá), ou manter o gate? Ele pagou
> R$ 2.824,10 na casa — por isso é decisão comercial, não regra automática.

## 5. #286 — FECHADO (`ignored`)

Dúvida de **capacidade de produto**, não defeito: `danielrfp@gmail.com` queria
vídeo de 30s-1min do clone **falando e gesticulando**.

**Respondido em 06/09 17:30:03Z** — e eu **reli a cópia no IMAP hoje**, não
aceitei "o script disse que mandou": `Sent uid 1167`, critério `ALL TO
danielrfp@gmail.com` = **1 mensagem no total**. A resposta tinha sido medida no
código antes de sair (`CLONE_MAX_AUDIO_SECONDS=90`, o aviso da tela sobre derivar
acima de ~40s): **sim** pra duração com a ressalva em voz alta, **não** pra
gesticulação.

**Chegou?** Nenhuma ficha de bounce pro endereço. **Controle positivo na mesma
consulta:** `glaubermed` devolve o #249 com signature `fast-bounce:inexistente` —
a consulta **enxerga** ficha quando ela existe. O zero do Daniel não é cego.

**Estado hoje:** conta de 06/09, sem acesso, 0 crédito, **nenhuma compra**, 0 voz,
`occurrences` ainda em 1. Prospect avaliando. Nada a consertar, nada a estornar.

**Por que ficou 10 dias na fila:** a resposta saiu no **mesmo dia**, mas o cartão
ficou `investigating` com `resolution_note` **NULL**. Caso resolvido sem nota é
indistinguível de trabalho pendente — ele subiu à cabeça da fila em rondas
seguidas e foi relido várias vezes sem nada novo pra fazer.

> **Lição:** o "done falso" ao contrário. Não anotar custa tempo de ronda do
> mesmo jeito que fechar errado custa confiança.

## 6. Achado lateral, registrado pra não se perder

Meu controle positivo, **`elianecaurim@ig.com.br`**, tem endereço **vivo**
(250 Ok) e mesmo assim: `last_seen_at` **NULL** (nunca entrou), 0 vozes, acesso
**ATIVO até 08/10**, **300.000 créditos** e **três** recargas de ciclo (08/08,
15/08, 08/09), com `compras: 2026-08-08 canceled` na ficha. **Outra classe** —
assinante que recebe ciclo após ciclo e nunca usou. Não é bounce e eu **não vou
empurrar conclusão sobre ela numa nota de outro caso**. Fica como candidata a
cartão próprio na próxima ronda.

## 7. O que eu NÃO fiz

Não mandei WhatsApp, não liguei, não escrevi pro endereço morto, não "consertei"
endereço chutando domínio parecido, não restaurei acesso, não reverti
cancelamento na Hotmart, não migrei compra entre e-mails, não mexi em crédito,
não gastei GPU, não apliquei migration, não abri PR. **Não repeti pela terceira
ronda o pedido de aval do #249/#250** — isso vira ruído no canal e não move nada;
ficou cravado no cartão.
