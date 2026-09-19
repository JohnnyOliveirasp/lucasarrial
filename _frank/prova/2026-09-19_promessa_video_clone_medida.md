# 19/09 — Vídeo Clone: medido do zero pela 11ª vez. A cura segue de pé, e as duas decisões de 08/09 morreram sozinhas

Roteiro recebido de novo, em versão curta: *"PASSO 1 medir com prova; PASSO 2/3
só escrever com sucesso medido; Renata; PASSO 4 apagão"*. Medi do zero — **não
reusei nada de 08/09**, e foi certo remedir: **três coisas mudaram**, e uma
delas é uma decisão que quase executei e teria sido um erro caro.

**Resultado: cura confirmada · não escrevi a ninguém · não há apagão a noticiar ·
a Renata é o único caso que continua aberto, e piorou.**

---

## PASSO 1 — a cura, medida hoje (19/09 15:15Z)

### Lado do sucesso — arquivo real, não linha de banco

Instrumento: `_Bugs/2026-09-11_provar_clones_r2.cjs` (`HeadObject` no R2,
bucket `voices-clone-ai-verse`). **Não** `video_path is not null`: esse campo é
gravado na criação e existe também nas linhas `failed` — concluir por ele daria
100% de sucesso inclusive durante o apagão.

| janela | linhas | MP4 real no R2 |
|---|---|---|
| últimas 24h, status `ready` | 40 | **40** |
| suspeito (<100 KB) | — | **0** |
| ausente | — | **0** |

- **Hoje (00:00Z→15:15Z): 12 `ready`, 1 `generating`, 0 `failed`.**
- Última entrega materializada **19/09 14:28:39Z**, 9,28 MB, 47 min antes desta
  medição.

### Contraprova — o instrumento distingue, não carimba tudo de OK

Sem isso, 40/40 não vale nada. Rodei nos dois sentidos, agora há pouco:

| caso | esperado | medido |
|---|---|---|
| `aa80c44a` — `generating`, criada 14:57:18Z | sem objeto | **AUSENTE (NotFound)** ✅ |
| `54a5065d` — `ready`, criada 14:28:39Z | com objeto | **PRESENTE, 9,28 MB** ✅ |

O mesmo instrumento, na mesma chamada, responde as duas coisas. O 40/40 é
leitura, não eco.

### Lado da falha — pelo dinheiro, NUNCA pela tabela

Vale a descoberta de 06/09: **a tela do aluno deixa apagar o vídeo que falhou, e
isso apaga a linha.** Em 05/09 a tabela mostrava 6 falhas / 6 alunos onde o
razão mostrava 53 / 9. Falha se conta por `credit_transactions.ref_type =
'video_clone_refund'`.

Últimos 16 dias, pelo razão:

| dia | estornos | alunos | créditos |
|---|---|---|---|
| **05/09** | **53** | **9** | **200.350** |
| 14/09 | 7 | 6 | 43.050 |
| 15/09 | 7 | 6 | 31.935 |
| 18/09 | 2 | 2 | 16.545 |
| **19/09 (hoje)** | **0** | **0** | **0** |

Os demais dias: zero. Último estorno de Vídeo Clone: **18/09 20:14:00Z** →
**19h02m sem um único estorno** no fechamento desta medição.

---

## PASSO 4 (respondido antes do 2/3, porque ele decide o 2/3) — não há apagão

O apagão foi **um só**: 05/09, das 14:46:58Z às 23:12:25Z — **8h25m27s**,
encerrado há **14 dias**. Nada nos 16 dias medidos chega perto: 14/09 e 15/09
são 7 estornos espalhados por 6 pessoas, 18/09 são 2 por 2 pessoas — dispersão
normal, não evento.

**Então não existe notícia de apagão pra postar, e a condição do roteiro ("se o
apagão continuar") é falsa pela 11ª vez.** Não postei nada.

---

## PASSO 2/3 — sucesso está medido, e mesmo assim NÃO escrevi. Aqui está por quê

A promessa "aviso quando voltar" foi paga em **06/09 00:36–00:37Z**, e para
cinco dos nove foi paga **duas** vezes (duplicata de 01:08). Uma carta hoje
seria a **3ª ou 4ª** dizendo a mesma coisa, 13 dias depois — é a genérica que a
**regra 11** proíbe.

Mas o argumento que decide não é o histórico, é o uso. Estado dos **9** hoje
(são 9, nunca foram os 7 do roteiro — `clayton` e `bilaherrmann` sempre
faltaram nessa lista):

| aluno | falhas | devolvido | clones pós-cura | visto por último |
|---|---|---|---|---|
| pcezardireito | 11 | 30.030 | **6** | 17/09 19:01Z |
| renatarcpsi | 8 | 69.720 | 2 | **08/09 12:55Z** ⚠️ |
| smilefastrio | 6 | 18.975 | 4 | 07/09 03:18Z |
| costa.anaelson | 6 | 23.310 | **1** | 17/09 15:52Z |
| bilaherrmann | 6 | 16.375 | **8** | 16/09 18:15Z |
| rafaluanravi29 | 5 | 7.185 | 5 | 10/09 18:52Z |
| clayton | 4 | 19.425 | 2 | 13/09 23:57Z |
| ederonline1 | 4 | 6.720 | 1 | 11/09 19:15Z |
| lux.neuropsi | 3 | 8.610 | 4 | 11/09 16:02Z |

Soma: **53 falhas, 200.350 créditos** — casa exatamente com o razão do dia
05/09. Débito e estorno conferidos por `ref_id`: **nenhum aluno pagou por falha
nossa.**

**9 de 9 voltaram a gerar depois da cura.** Não há ninguém a quem avisar que
"voltou": eles já sabem, porque usaram.

### ⚠️ As duas decisões que pedi a humano em 08/09 morreram sozinhas — e uma delas eu quase executei errado

**1. Anaelson — a carta de retenção não é mais necessária.**
Em 08/09 ele era o **único dos 9 que não tinha voltado** (0 prontos pós-cura,
parado desde a 6ª falha seguida) e eu pedi sinal verde pra uma carta pessoal.
Ele voltou sozinho: clone em **14/09 19:28Z**, visto em **17/09**, acesso ativo
até 29/09, 147.459 créditos. **A carta virou desnecessária — e se tivesse saído
hoje, chegaria numa pessoa que já está usando o produto.**

**2. Paulo (pcezardireito) — zerar o saldo dele teria queimado um pagante.**
Em 08/09 ele estava cancelado, trial vencido ao meio-dia, sem pagamento achado
em Hotmart nem Stripe, com 46.007 créditos no bolso. Pela regra de 18/08 a
opção (c) era **zerar depois de confirmar**. Estado hoje:

- acesso **ativo até 06/10** · plano **pro** · **102.357 créditos**
- **6 clones depois da cura**, o último em 16/09 · visto em 17/09
- foi o **mais atingido do apagão** (11 falhas) e mesmo assim voltou e pagou

**Ele é cliente pagante ativo.** A regra que eu ia aplicar era a regra certa
lida num dia errado. Fica a lição: **decisão sobre saldo de aluno não pode ser
executada com medição de dias atrás** — e foi exatamente por isso que o pedido
foi ao grupo em vez de sair da minha mão.

---

## Renata — o único caso aberto, e ele piorou

`renatarcpsi@gmail.com`, 2ª mais atingida (8 falhas, 69.720 cr devolvidos).

**Ela nunca respondeu.**
- `ler_caixa --de renatarcpsi@gmail.com` → vazio.
- **Contraprova obrigatória** (consulta que erra volta vazia): `--ultimos 5`
  devolve mensagens normalmente e `--fila` = **0 não-lidos**. Não há resposta
  dela escondida. O vazio é ausência real, não instrumento cego.

**O que mudou desde 08/09 — e inverte o argumento daquele dia:**

| | 08/09 | hoje 19/09 |
|---|---|---|
| último clone | 06/09 13:48Z | 06/09 13:48Z — **13 dias** |
| visto por último | (ativa) | **08/09 12:55Z — 11 dias** |
| acesso | ativo até 30/09 | ativo até 30/09 |
| créditos parados | ~100.000 | **137.660** |

Em 08/09 eu não recomendei ação urgente porque **"ela voltou a gerar, 2 vídeos"**.
Esse argumento está morto: ela gerou dois vídeos, ficou mais dois dias, e sumiu.
**É a pessoa com o `last_seen` mais antigo dos nove** — todos os outros oito
foram vistos em 10/09 ou depois.

E o que ela fez no meio disso: **pagou um ciclo novo em 06/09** (`subscription_grant`
de 100.000 cr, `ref_type=payment_event`, 14:13:11Z) — **depois** do transtorno.
Hoje tem 137.660 créditos comprados e **parados**.

**Nossa promessa continua não paga.** O e-mail de 06/09 00:37 diz, no nome da
casa, que o caso foi levado adiante e que acompanharíamos **até ter um retorno**.
Desde então: nada saiu pra ela. Conferi em `emails_enviados` → **nenhum envio**
— com a ressalva honesta de que **essa tabela só tem linha a partir de 14/09**
(7–8 envios/dia desde então, então não está muda; ela simplesmente não cobre a
janela 06/09–13/09). Pelo que está documentado, o último contato é o de 06/09
00:37Z. **São 13 dias do nosso silêncio numa promessa que tem a palavra
"acompanho" escrita.**

Não mandei nada porque **compensação é decisão comercial e não é minha**. Mas
registro o que mudou: em 08/09 dava pra esperar; hoje não dá, porque a pessoa
parou de usar um produto que acabou de pagar.

---

## O que fiz, e o que não fiz

- **Fiz:** as medições acima, com contraprova nos dois instrumentos que
  importam (R2 e caixa de e-mail).
- **Não fiz:** não escrevi a nenhum aluno, não postei notícia de apagão, não
  mexi em saldo de ninguém, não mandei cortesia.
- **A decidir por gente (1 item só):** a compensação da Renata — e agora com o
  agravante do sumiço.

Anotação de margem, fora do escopo: `bilaherrmann@gmail.com` gerou 8 clones
pós-cura com `profiles.access_until = null`. Pode ser plano sem data ou pode ser
buraco. Não investiguei nesta rodada; fica o registro pra não se perder.

---

## A lição desta 11ª rodada

**A resposta de ontem não envelhece bem quando a decisão é sobre gente.**
Em 08/09 eu tinha duas perguntas abertas e uma recomendação (zerar o saldo do
Paulo depois de confirmar). Onze dias depois: o Paulo é pagante ativo e o
Anaelson voltou sozinho — **as duas perguntas se responderam, e a recomendação
teria queimado um cliente.** Não foi prudência que salvou, foi o hábito de
**remedir do zero em vez de reusar** e de **não executar decisão comercial
sozinho**. O que muda de um dia pro outro nunca é a promessa; é o dado.
