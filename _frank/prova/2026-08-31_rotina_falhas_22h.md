# Ronda das falhas — 31/08/2026, 22h00–22h55 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**; nenhum incidente de
causa-planilha aberto, reaberto ou comentado. Canal: tudo no **grupo**
(`notify-grupo.sh`), conforme a ordem de 31/08. **Nenhuma mensagem no privado.**

## Placar

- Fila no início: **9 investigating + 3 aguardando_aluno** (12 abertos).
- Fila no fim: **8 investigating + 3 aguardando_aluno** (11 abertos).
- Fechados: **1** (#213, como `ignored` — **não** como resolvido).
- Alunos respondidos: **1** (#213, Enviados uid **403**, cópia confirmada na 1ª tentativa).
- Fix subido: **0**. Nenhum código novo — nada preso em branch.

## O caso serial: #213, e o aluno estava queimando crédito ao vivo

Peguei o #213 como a ronda das 21h deixou marcado, e comecei **pela geração, não
pelo título**. O achado não estava na fila: estava no extrato dele.

**5 gerações, todas no tier `480p-v2` (Turbo), cada uma com uma FOTO DIFERENTE.**
Ele nunca usou o Padrão 2.0. Pelos carimbos:

| hora (31/08) | créditos | o quê |
|---|---|---|
| 01:48 | 2.000 | 25s |
| 20:17 | 400 | — |
| **20:45:15** | — | **reclamação entra** |
| 20:40 | 560 | — |
| 20:58 | 400 | foto nova |
| 21:19 | 400 | foto nova |

Depois de reclamar ele ainda gerou duas vezes, **mais 800 créditos**, trocando de
foto a cada tentativa. Ele já tinha refutado a hipótese da foto sozinho, pagando.

### Causa real, com arquivo:linha

`frontend/src/lib/video-clone/config.ts`: os **dois** tiers saem em
`width 480 / height 832`, fixo. Padrão 2.0 (`480p-v3`, 105 cr/s) e Turbo
(`480p-v2`, 80 cr/s) rodam o **mesmo motor** — a diferença é preço e
repetibilidade, nunca qualidade. Nessa resolução os dentes ocupam pouquíssimos
pixels: a perda é na **saída**, não na foto de entrada. Por isso trocar foto não
muda e trocar de modo não muda. O 720p existia e foi **removido em 04/08** por
decisão do Johnny.

### As duas armadilhas que eu apliquei em vez de repetir

Estão documentadas em `manual.ts:10-30` e este caso é a **terceira** vez do mesmo
padrão:

- **#178** — a Fast mandou uma aluna trocar de modo pra ficar "mais natural";
  claim que não existe, e ela **já estava** no Turbo.
- **#99** — mandaram o Luciano refazer com foto do peito pra cima; a foto que ele
  já tinha usado **já era** do peito pra cima. Pagou 630 créditos, o rosto foi de
  ~190 pra ~240px e o resultado foi o mesmo, **porque o teto é a resolução**.

Desta vez foi pego **antes** de eu mesmo mandar o aluno gastar de novo.

### Crédito da atendente: a Fast NÃO errou aqui

Às 20:45:16Z ela disse corretamente que o enquadramento estava ok e que os dois
modos rodam o mesmo motor, e **escalou**. Faltou a ela o fato da resolução e o
caminho alternativo — não a diagnose. Conferi o `manual.ts` procurando a lacuna e
**não há uma**: o teto 480×832 está escrito (linha 233), a ordem de escalar está
escrita, e o manual **proíbe** a Fast de oferecer ferramenta de fora por conta
própria. Ela seguiu o manual à risca. **Não subi PR** — não invento conserto onde
o instrumento está certo.

### O que eu respondi (Enviados uid 403, confirmado na 1ª tentativa)

Que a causa é a resolução de saída e não a foto dele; que **não** migre pro
Padrão 2.0 esperando realismo (pagaria 105 cr/s em vez de 80 pelo mesmo resultado
nos dentes); que pare de testar foto; e o caminho que existe hoje —
**Vídeos → HeyGen (BYOK)**. Conferi o gate **antes** de indicar, pra não mandar
aluno pra porta fechada: o HeyGen graduou do gate de admin em **14/08**, está na
sidebar e consome os créditos da conta **HeyGen dele**, não os do FastCloner —
disse isso com todas as letras pra não parecer empurrar gasto. **Não prometi data**
de aumento de resolução: é decisão de produto, não minha.

**Dinheiro:** nada a estornar. As 5 gerações estão `ready`, entregues; não houve
falha de cobrança. Conta: assinante ativo até 04/09, 84.640 créditos, nada travado.

**Por que `ignored` e não `fixed`:** nada foi consertado e a limitação continua de
pé (regra 14 inteira). Pela ordem de 27/08 só erro de **sistema** vira chamado, e
aqui nada quebrou. Também não deixei `investigating` fingindo que há investigação
em curso: o atendimento acabou, e o que sobra (subir a resolução) é decisão de
produto.

## Por que não mexi nos outros

Confirmei caso a caso em vez de herdar o parecer da ronda anterior:

- **#99 Luciano** — parado em prazo que fecha **01/09 (amanhã)**. Não é travamento:
  a bola saiu do meu colo com data anotada.
- **#173, #196, #202** — os três receberam retratação por escrito **hoje**
  (uids 387, 388 e a da Liliane). Bloqueados na decisão comercial, não em passo meu.
- **#205 Cristina** — **não escrevi de propósito.** Existe compromisso datado nas
  notas dela (15hZ e 17hZ) de escrever **na manhã de 01/09** se a decisão não vier,
  e ela já recebeu 3 e-mails hoje. Reverter isso 1h depois seria só ansiedade minha.
  ⚠️ **A dívida com ela é real e continua:** ela é a única dos quatro lidos como
  "nunca pagou" que **não recebeu retratação**, e a Fast a tratou por escrito como
  trial às 12h58Z tendo ela pago R$ 185,61. **A ronda da manhã escreve, mesmo sem
  decisão** — e escreve dizendo que ela pagou.
- **#192 Robert** — travado em ouvido humano (áudios no grupo desde 29/08).
- **#207 + #212 Márcio** — reembolso pedido, já escalado como urgente.
- **#214** — resolvido na apuração da ronda anterior (duas contas, não era compra
  órfã) e respondido; bola com a aluna.

Não postei no grupo a decisão comercial pendente: ela já foi postada 15hZ, 17hZ e
nas rondas seguintes. Quinta repetição no mesmo dia é o ruído que a regra 7 proíbe.

## Fim de ronda

`git fetch origin` + `git log --oneline origin/main..HEAD` **vazio** após o commit
deste log; `git status --short` limpo; `git branch --show-current` = main. Nenhum
código novo, logo **nada preso em branch**.

## Precisa de gente (nesta ordem)

1. **#99 Luciano — o prazo é HOJE (01/09).** Depois disso a decisão fica tomada
   pelo silêncio.
2. **#212 + #207 Márcio — reembolso pedido**, com promessa escrita de retorno.
3. **UMA decisão, não cinco:** o que a compra do curso dá direito dentro do
   FastCloner. Fecha #173, #192, #196, #202, #205 — R$ 7.644,13 de gente que pagou.
   **A Cristina (#205) é a mais exposta.**
4. **#192 — alguém precisa OUVIR os três áudios** que estão no grupo desde 29/08.
5. **Produto (não é fila):** o teto de 480×832 do Vídeo Clone já gerou três
   chamados de insatisfação (#99, #178, #213) e crédito de aluno queimado em pelo
   menos dois. Enquanto o teto existir, a resposta honesta é o HeyGen BYOK.
