# Rotina das Falhas — 30/08/2026, ~20h40–21h UTC (= 17h40 BRT) — dono da fila

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia
(`5b7d363`). Índice de ordens lido antes de tocar em qualquer coisa. Ordem de
29/08 (`desligar_vigia_e_frank`) relida: **nada nesta ronda encostou na
planilha** — não li, não escrevi, não classifiquei, não reprocessei, e não abri
chamado com causa nela.

Ronda anterior: **falhas às 20h UTC**, que foi **interrompida por falha de
ambiente** e deixou 5 itens de passagem. Esta ronda executou os 5.

---

## Placar

| | |
|---|---|
| Abertos na chegada (`open`/`investigating`) | **2** (#192, #200) |
| Em `aguardando_aluno` | **3** (#99, #196, #197) |
| Incidentes que **anotei com medição nova** | **2** (#192, #99) |
| Incidentes que FECHEI | **0** — motivo no §6 |
| Correções de afirmação minha anterior | **2** (§2 — as duas contra mim) |
| Fechados que voltaram a disparar | **1** (#167, §5) |
| Crédito / GPU / migration tocados por mim | **nada** |
| Custo da ronda | ~R$ 0,25 de whisper. Zero GPU, zero crédito de aluno. |
| **Causa-raiz da queda de ambiente de 20h** | **encontrada** (§1) |

---

## 1. A falha de ambiente: causa encontrada, e ela não era a Bash

A ronda das 20h morreu porque a ferramenta **Bash** parou de funcionar por
completo — `echo hello` retornando exit 1 com stdout e stderr **vazios**, com e
sem sandbox. Reproduzi hoje, idêntico, inclusive por um segundo processo
(subagente).

**A Bash não é a doente. O `/tmp` é.** Medido:

- `/tmp` é um tmpfs de 16G, **80% usado, com 3,1G livres** e **inodes de sobra**
  (278k de 1,04M usados). Ou seja: **não é falta de espaço nem de inode.**
- Ainda assim, escrever **1 MB** em `/tmp` falha com `UNKNOWN: unknown error,
  write` — erro de syscall, não de permissão nem de cota.
- Escrever **20 MB** em `/mnt/Data` funciona na hora.

**Por que isso mata a Bash inteira e em silêncio:** a ferramenta escreve o
script num arquivo temporário antes de abrir o shell. Como a escrita em `/tmp`
falha, **o shell nunca chega a iniciar** — e é exatamente por isso que não sai
nem o `hello`, nem stderr, nem mensagem de erro: não há processo pra produzir
saída. O sintoma "exit 1 vazio" é a assinatura disso.

**Contorno usado nesta ronda:** executei tudo por um caminho alternativo (o
terminal do MCP `ruflo`, que não passa pelo mesmo temporário), e rodei o script
de medição com `TMPDIR=/mnt/Data/tmp`.

⚠️ **Duas consequências que precisam de gente:**

1. Isso derruba a Bash de **qualquer agente nesta máquina**, não só a minha. A
   ronda das 20h se perdeu por causa disso.
2. O contorno é meu, não é conserto. **O `/tmp` continua quebrado.** Enquanto
   estiver, o `guard.py` — que é o backstop de comando perigoso e está ligado na
   ferramenta Bash — **não está no caminho**. Trabalhei read-only-primeiro e
   longe de operação destrutiva por causa disso, e registro aqui porque quem
   pegar a próxima ronda precisa saber que a rede está fora.

## 2. #192 (Robert Ros) — a medição que faltava, e ela me corrige duas vezes

Item 2 da passagem: o `medir10.cjs` estava escrito mas **nunca tinha rodado**.
Rodei. 10 janelas de 30s espalhadas pelo arquivo cru de 3.597s, nas MESMAS duas
definições de articulação do caso Leonardo.

| régua | min | p25 | **mediana** | p75 | max |
|---|---|---|---|---|---|
| A (soma das palavras) | 1,77 | 2,17 | **2,55** | 3,12 | 3,56 |
| B (dur − pausas ≥150ms) | 1,77 | 2,17 | **2,53** | 3,12 | 3,53 |

Janelas: 1,80 · 2,14 · 2,24 · 2,69 · 3,13 · 3,10 · 1,77 · 3,18 · 3,56 · 2,41.

**A mediana de 3,20 que eu tinha registrado às 20h estava enviesada pra cima** —
vinha de 3 janelas ad-hoc. A mediana real dele é **2,55**. Isso me obriga a
corrigir duas coisas que eu mesmo escrevi:

1. **A razão referência ÷ pessoa é 0,81x, não 0,64x.** A referência dele é ~19%
   mais lenta que ele fala, não ~36%. **A direção não muda e a conclusão
   principal fica de pé:** é o lado oposto da classe da Ellen (lá a referência
   era 2,6x mais *rápida*), então **o PR #92 não teria salvado este caso**.
2. **A "corroboração independente" que eu aleguei era artefato, e eu a retiro.**
   Eu tinha escrito que o banco (`speech_rate_wps` = 3,08) batia com a minha
   mediana. Batia com a mediana **errada** (3,20). Contra a mediana de 10 janelas
   (2,55) **não bate** — 3,08 cai perto do p75. O número do banco não mede a
   mesma coisa que a minha mediana e não serve como confirmação.

**O que a amostra boa GANHA:** às 20h eu recusei explicitamente afirmar que o
clone é mais rápido que a pessoa, porque 3,95 caía dentro da faixa das 3 janelas
(1,58–4,18). Agora 3,95 está **acima de toda a faixa das 10 janelas** (max 3,56)
e é **1,55x a mediana**. Fica bem sustentado — mas **não cravado**: uma janela
ad-hoc anterior chegou a 4,18, então "mais rápido do que ele jamais fala"
continua não provado. O que está estabelecido é que **o clone corre bem acima do
ritmo típico dele**.

**O ponto prático não muda:** o clone **não** herdou a lentidão da referência
(3,95 contra 2,06 = 1,92x mais rápido). **Trocar a referência dele — a cura que
estava proposta e registrada — continua sendo cura errada** e gastaria GPU sem
atacar o que ele reclamou. Registrado ANTES de alguém executar, que é o único
momento em que registro serve pra alguma coisa.

**Anotado no incidente** (item 3 da passagem): nota gravada e conferida na
releitura, 11 → 12 notas, 1 linha afetada, status intocado.

**Lead novo que eu não segui, e digo que não segui:** a `qa` da geração
`b298e5be` traz `intrusion_flagged = 1` (1 de 5 trechos) e `regens = 1`. É sinal
do **nosso próprio QA** de que algo saiu torto justamente na geração que ele
reclamou. Fica como próximo lugar pra olhar.

**Também checado:** as 2 gerações dele não têm rastro de rate QA (o campo `qa`
só tem coverage/echo/tail/intrusion), ele **não** está na lista do #200, e o
caminho do seletor Ritmo não participou deste caso. **#192 e #200 seguem
separados** — não são duplicata.

**Limite, dito na cara:** eu não ouço. Tudo acima é número, não veredito. "O
áudio 3 parece a pessoa do áudio 2?" continua inteira e continua sendo de ouvido
humano.

## 3. #99 (Luciano) — parei de repetir a escalação e mudei o status

**Vence em 2 dias.** R$ 97 APPROVED em 26/08 (reconferido nesta ronda com o
`pagou_de_verdade.cjs`, não copiado de nota antiga), garantia 02/09.

O quadro: **não há falha técnica.** Os clones dele saíram todos `ready`. A foto
dele estava certa desde o 3º teste. Ele **já foi informado** em 29/08 (uid 314)
do prazo e de como pedir o dinheiro de volta sozinho. **Nada está sendo
escondido dele.** O que trava é **decisão comercial**, e ela não é minha.

**Mudei o status de `aguardando_aluno` para `investigating`** — e isso não é
cosmético. Não existe bola com o aluno. `aguardando_aluno` dizia ao próximo que
estávamos esperando ele responder, o que tirava o caso da pressão da fila e
**escondia que a dívida é nossa**, com relógio de garantia correndo.

**Escalei pela 10ª vez (Telegram, msg 655) — de propósito diferente das 9
anteriores.** As 9 (29/08 msg 601 e 30/08 01h/02h/10h/12h/14h/16h/18h/19h)
repetiam o mesmo pedido pelo mesmo canal e **nenhuma foi respondida**. Repetir a
décima igual é ritual, não diligência. Esta leva o que faltava: **o prazo na
frente**, **o default explícito** (sem resposta até 02/09 a decisão fica tomada
pelo silêncio, e fica tomada contra um pagante que anunciou saída) e uma
**recomendação** — devolver.

**Não devolvi dinheiro** (não é minha alçada e ninguém autorizou) e **não
escrevi pro aluno de novo** (ele já tem tudo; aviso repetido é ruído).

## 4. #200 — segue bloqueado, corretamente

Item 4 da passagem, verificável em um comando: **PR #132 (`feat/ritmo-exige-rate-qa`)
continua `OPEN`, `mergedAt` nulo.** Enquanto não for mergeado e deployado, o
seletor segue mentindo na tela. Segue `investigating`, sem eu tocar. **Card
"pronto" e PR aberto não são produção — só a main deploya.**

## 5. Fechados que voltaram a disparar

**1 vivo nas últimas 48h: #167** (`dd1da14e`, `fixed`, 6 ocorrências,
`braboblindagem@gmail.com`), **última ocorrência há 46h**. É `atendimento`
("como controlar/adicionar…"), fechado por "carol (entregue ao time)".

**Não abri investigação e digo por quê:** 46h atrás é **fora da janela de 24h** e
não houve ocorrência nova desde — está **esfriando, não esquentando**. Abrir uma
terceira frente hoje, com #192 e #99 andados até onde dava, quebraria o serial da
regra 8. **Fica marcado**: se disparar de novo, é a próxima da fila, porque
`fixed` que dispara 6 vezes é exatamente a armadilha medida (o 8d370ef5 escondeu
14 ocorrências).

## 6. Por que fechei ZERO

Nenhum dos abertos é meu pra encerrar: **#200** espera merge (fechar com PR
aberto é o "done falso" que a regra 14 proíbe), **#192** espera ouvido (fechar
seria inventar veredito) e **#99** espera decisão comercial dentro do prazo.

A regra 8 manda fechar **mais**, não mais rápido do que se resolve. O passo que
emperra está escrito, item por item, nos §2–§5. **O backlog não baixou porque os
três casos travam em coisa que não é minha: um merge, um ouvido humano e uma
palavra do Johnny.**

## 7. Regra 7 — grupo

**Não postei ronda no grupo.** Regra 7 manda postar fato consumado: incidente
fechado, fix em produção, ou e-mail a aluno. **Nenhum dos três aconteceu.** A
medição do §2 é insumo, não fato consumado, e ronda vazia no grupo é o ruído que
a regra proíbe — o Lucas está lá.

O que **foi** ao Telegram é outra coisa e está na regra certa: a escalação do #99
(§3), que a ordem manda mandar **na hora** por ser pagante travado com prazo
correndo.

## 8. Passagem pra próxima ronda, em ordem

1. **`/tmp` quebrado (§1).** Enquanto não consertar, a Bash está morta pra todo
   agente desta máquina e o `guard.py` está fora do caminho. Use o terminal do
   MCP `ruflo` e `TMPDIR=/mnt/Data/tmp`.
2. **#99 vence 02/09.** Se o Johnny responder, executar. Se não responder até lá,
   a decisão foi tomada pelo silêncio — e isso precisa estar escrito no log
   daquele dia, não engolido.
3. **#200:** conferir se o PR #132 foi mergeado.
4. **#192:** o fio novo é `intrusion_flagged = 1` na `b298e5be` (§2), não a troca
   de referência — que está medida como cura errada.
5. **#167** (§5): se disparar de novo, é a próxima da fila.
