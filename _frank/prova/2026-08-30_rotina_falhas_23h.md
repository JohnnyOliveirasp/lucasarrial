# Rotina das Falhas — 30/08/2026, ~23h20–23h50 UTC (= 20h20–20h50 BRT) — dono da fila

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia,
árvore limpa. Índice de ordens lido antes de tocar em qualquer coisa. Ordem de
29/08 (`desligar_vigia_e_frank`) relida: **nada nesta ronda encostou na
planilha** — não li, não escrevi, não classifiquei, não reprocessei, e não abri
chamado com causa nela.

Ronda anterior: **falhas às 22h**, que deixou 6 itens de passagem.

---

## Placar

| | |
|---|---|
| Abertos na chegada (`open`/`investigating`) | **4** (#99, #192, #200, **#201 novo**) |
| Em `aguardando_aluno` | **2** (#196, #197) |
| **Alunos que eu avisei** | **2** — Túlio Canella e Reinaldo Guernelli, e-mail entregue e conferido |
| Incidentes que anotei com medição nova | **1** (#201) |
| Incidentes que FECHEI | **0** — motivo no §5 |
| Cards abertos | **1** (`ad4c6768`, coder, o fix do #201) |
| Crédito / GPU / migration / voz tocados por mim | **nada** |
| Custo da ronda | ~zero. SQL de leitura, IMAP e 2 e-mails. Zero whisper, zero GPU. |
| **`/tmp`** | **resolvido** (§0) |

## 0. O `/tmp` saiu do caminho

Item 1 da passagem. Escrita de 1 MB em `/tmp` passa (`1.0 GB/s`, sem `EDQUOT`),
uso caiu de **13G para 7,2G** e os inodes de 27% para 22%. Alguém limpou entre
as duas rondas. **Bash normal voltou** — esta ronda inteira rodou sem o contorno
do MCP `ruflo`, e o `guard.py` está de volta ao caminho.

Não sei quem limpou e não vou fingir que sei. O que continua de pé é a
observação da ronda das 22h: **limpar na mão conserta hoje e volta**, porque
cada ronda que cria scratch em `/tmp` empurra a próxima pro teto. O conserto de
verdade é a automação limpar o que cria.

## 1. Peguei o #201 e levei até onde dava: os dois alunos estão avisados

Escolha da fila pela regra 8. O mais antigo com aluno afetado é o **#99**, que
está parado em **decisão comercial do Johnny com prazo até 02/09** — não está no
meu colo e a ronda das 22h já escalou pela 10ª vez há duas horas; re-escalar
seria ruído. O seguinte com aluno em silêncio **agora** é o #201, e ele era o
único onde aluno estava sem resposta por culpa nossa. Peguei esse.

**O que era.** As respostas ao Túlio e ao Reinaldo (as do seletor Ritmo, #200)
foram recusadas às 18:48Z pelo **nosso próprio relay de saída**
(`prod-lbout-phx.jellyfish.systems`, 550 JFE040000, "high probability of spam").
A recusa pegou **todos** os destinatários da mensagem: não saiu para ninguém. O
aviso do fracasso voltou como e-mail para a INBOX do suporte, que ninguém tria.
A fila achava que os dois tinham sido respondidos.

**O que eu fiz.** Recuperei os dois originais — eles **estão no Sent** (uid 357
e 358). Isso corrige, num detalhe, a nota de abertura, que dizia não ser
possível conferir o conteúdo: não dá pelo **banco**, dá pelo **IMAP**. Reescrevi
os dois e reenviei **individualmente, espaçados, com assuntos diferentes e sem o
`--bcc suporte@lucasarrial.com`**. Ensaiei com `--dry-run` antes.

**Conferido, não torcido:** o bounce original chegou **2 segundos** depois do
envio. Reli a caixa duas vezes depois dos reenvios e o total de bounces
**continua 21, nenhum novo**. Os dois foram aceitos pelo relay.

## 2. O silêncio teve custo, e ele é mensurável

Isto é o que faz o caso valer a ronda. O Túlio não recebeu a mensagem das 18:48Z
e, às **22:20Z, treinou uma segunda voz: −10.000 créditos** (saldo 85.300 no
texto do e-mail → **64.320** agora).

**Retreinar não corrige o Ritmo.** O defeito está na caixa "Ajustar ao meu ritmo
de fala" nascer desmarcada, não na voz. Se a mensagem tivesse chegado, ele teria
essa informação antes de decidir gastar.

**O que eu não afirmo:** que ele retreinou *por causa* disso. Não leio a
intenção dele, e escrevi ao próprio aluno nesses termos — "não sei o seu motivo
e não vou supor". Afirmo o fato e a sequência.

**Não mexi em crédito.** Devolver ou não os 10.000 é decisão comercial, não
minha. Escalado ao Johnny.

## 3. Derrubei a suspeita principal que estava na nota

A nota do Executor apontava **SPF/DKIM/DMARC ou desalinhamento de domínio** como
suspeita principal. **Não se sustenta, e é importante dizer antes que alguém
gaste um dia nisso.**

Hoje saíram **12 mensagens** do mesmo remetente (`suporte@fastcloner.com`), pelo
mesmo relay: **10 entregues, 2 recusadas**. Autenticação de domínio é
propriedade do **domínio**, não da mensagem — se estivesse quebrada, as 12
teriam caído. **Quem for consertar não deve começar por SPF.**

**A hipótese que sobra, com o limite dito.** Os uids 357/358 são o **único par
do dia com assunto idêntico**, enviados com **6 segundos** de diferença, corpos
quase iguais para destinatários diferentes. As outras 10 tinham assunto único e
espaçamento de 30min+. É assinatura clássica de rajada quase-duplicada.

**Não está provado.** Não tenho o log de decisão do relay. E no reenvio eu mudei
**várias variáveis de uma vez** (assunto, corpo, espaçamento e o bcc), então o
sucesso de hoje à noite é **consistente** com a hipótese, **não a isola**. Quem
quiser provar precisa variar uma coisa por vez.

## 4. O escopo real: não são 2 bounces, são 21

A abertura enxergou só os 2 do `MAILER-DAEMON@mail.privateemail.com` e disse,
honestamente, não saber se havia mais. Havia. Buscando por `Mail Delivery
System` aparecem **21 bounces na INBOX, de 07/08 a 30/08 — 24 dias, 7
destinatários, nenhum triado**. E em **quatro** classes diferentes, que pedem
tratamentos diferentes:

| Classe | Quem | O que diz |
|---|---|---|
| (a) spam na saída, 30/08 | tuliocanella@hotmail.com, reinaldo.guernelli@gmail.com | 550 JFE040000 — o incidente como aberto. **Alunos ativos e pagantes.** |
| (b) **Microsoft bloqueou nosso IP**, 07/08 | betobass27@hotmail.com | `550 5.7.1 messages from [198.54.127.137] ... on our block list (S3150)`. **IP diferente do de hoje** (.244). Sem conta (compra cancelada 23/07). Risco vivo: o Túlio também é hotmail. |
| (c) endereço do aluno não existe | leusousavedder@gmail.com (14/08), epotentia@gmail.com (22/08, **8 bounces em 1h11**) | Os dois **têm conta no nosso banco, com voz `ready`**. O cadastro aceitou e-mail que não recebe: o aluno usa a plataforma e nunca recebe nada nosso. Trial, sem compra. |
| (d) caixa do aluno cheia | pc.sul157@gmail.com (4, 21–23/08), luctec@gmail.com (2, 22–24/08) | 452-4.2.2, até falha permanente. |

## 5. Conferi dinheiro na classe (d) e derrubei minha própria suspeita

`pc.sul157@gmail.com` tem **66.623 créditos e aparece SEM ACESSO** — cheiro
exato de pagante trancado, que é a coisa que a ordem manda avisar o Johnny **na
hora**. Antes de alertar, rodei `pagou_de_verdade.cjs`: **"NUNCA PAGOU"**,
registro único de **R$0 COMPLETE** em 19/08, ou seja **trial**. Pela regra final
de crédito (quem nunca pagou e saiu do trial não gasta), o estado dele está
**correto**. `luctec`: 0 crédito, sem compra.

**Nenhum alerta ao Johnny por esta via.** Registro que a suspeita existiu e caiu,
pra próxima ronda não gastar fôlego reabrindo — e porque alerta falso em canal
com o Lucas dentro custa mais caro que o silêncio.

## 6. Por que não fechei o #201

Os dois alunos foram atendidos, mas **o defeito do título continua inteiro**: o
aviso morre numa caixa que ninguém lê. 21 bounces em 24 dias provam que ninguém
lê, e o de hoje só foi visto por acaso. Fechar agora seria **done falso** (regra
14). Fica `investigating`, com a nota inteira gravada (1 → 2 notas, 1 linha
afetada, conferido na releitura).

**Passo que emperra:** não existe código que trate bounce; é mudança em infra de
e-mail e precisa de PR. Abri o card **`ad4c6768`** no `coder` com a especificação
(reconhecer o bounce, casar com a mensagem original, classificar as 4 famílias de
erro, não marcar o aluno como respondido, e ler com `EXAMINE`+`BODY.PEEK` pra não
consumir a fila da Fast).

## 7. Os outros da fila — conferidos, nenhum mexido

- **#200** (5 ocorrências, 3 alunos): item 4 da passagem, verificável em um
  comando. **PR #132 (`feat/ritmo-exige-rate-qa`) continua `OPEN`, `mergedAt`
  nulo.** Segue `investigating`. Card pronto e PR aberto não são produção.
- **#99**: vence 02/09. Escalado 10× e a última foi há duas horas. **Não
  re-escalei** — nada mudou no estado dele. Se chegar 02/09 sem resposta, o
  silêncio decidiu e isso tem que estar escrito no log daquele dia.
- **#192** (Robert Ros): **não avancei**. O passo único (transcrever o áudio
  entregue da `b298e5be`) ficou para a próxima — priorizei aluno em silêncio,
  que a ordem manda vir antes. Dito na cara: é item da passagem que eu não
  cumpri.
- **#196 / #197**: `aguardando_aluno`, não reinvestiguei, conforme a nota das
  duas manda.

## 8. Fechados que voltaram a disparar

Varri `fixed`/`ignored` com `last_seen_at` recente. **Nenhum disparou dentro de
24h.** #167 (`dd1da14e`) continua esfriando, sem ocorrência nova.

## 9. Regra 7 — grupo

**Postei**, em modo `--fato`: os dois alunos avisados e o achado dos 21 bounces.
Houve fato consumado (e-mail a aluno), que é exatamente o gatilho da regra.
Não pedi nada de volta no grupo.

## 10. Passagem pra próxima ronda, em ordem

1. **#192, 1 passo, atrasado por mim:** transcrever o áudio entregue da
   `b298e5be` e ver qual foi a palavra intrusa. Prova ou derruba a cadeia.
2. **#201:** conferir o card `ad4c6768` (coder) e se saiu PR. **Não fechar
   enquanto o bounce não virar sinal.**
3. **Túlio, −10.000 créditos:** decisão comercial pendente do Johnny.
4. **#200:** conferir se o PR #132 foi mergeado.
5. **#99 vence 02/09.** Sem fato novo, não re-escalar; se passar sem resposta,
   escrever que o silêncio decidiu.
6. **Classe (c) do §4:** dois alunos com conta e e-mail inexistente. O cadastro
   aceita endereço que não recebe. Ninguém está esperando, mas é buraco real.
7. **Classe (b):** Microsoft já bloqueou nosso IP de saída uma vez (.137). Se
   voltar a acontecer com hotmail, é a próxima da fila.
