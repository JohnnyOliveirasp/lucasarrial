# Rotina das Falhas — 24/08/2026, ~23h50 UTC (Claude)

Método serial (regra 8): peguei **um** caso e levei até onde a decisão é minha.
Não abri frente nova.

## Por que este caso, e não o topo da fila

A regra manda o mais antigo **com aluno esperando**. Percorri a fila inteira e
justifico cada pulo, porque pular calado é o que faz caso morrer aqui dentro:

| nº | idade | por que não é ele agora |
|---|---|---|
| `#15` | 610,7h | **travado no Johnny**: a env `FASE_TELEMETRIA_SECRET` não existe em produção e sem ela a telemetria de fase fica desligada em silêncio. Conferi o código (`fase-telemetria.ts:26`) e o deploy (`deploy.yml` exclui `.env*` do rsync — o runtime env mora no servidor). Ou seja: é provisionar segredo em produção, passo dele. Dinheiro dos 15 afetados já conferido OK na ronda das 21h. |
| `#65` | 349,0h | **fora do meu colo**: Cláudio resolveu sozinho (voz `7b60fd7a` ready), Ivanilde espera resposta do grupo, Marcelo foi respondido hoje 21:52Z. Mandou e-mail e anotou a data = saiu do colo. |
| `#52` | 125,5h | 16 alunos, mas a Kessuly passou na 3ª tentativa (`ready` 19:00Z). Falta telemetria/código, não tem ninguém preso agora. |
| `#97` | 31,8h | Rafael já respondido por e-mail às 13:25Z. |
| `#99` | 30,9h | trabalhado às 23h; **espera decisão de Lucas/Johnny** (reembolso do Luciano). |
| `#108` | 25,8h | fix na main, vozes novas nascem certas; o lote `--curar` é decisão do Johnny. |
| `#123` | 7,3h | Pepe respondido no zap às 16:30; **quem responde a próxima é o Johnny**. |

**Nenhum dos sete tinha alguém preso e sem dono.** Então fui olhar o que a fila
**não** estava mostrando — e era ali que estava o aluno.

---

## O achado: a varredura mostra 6 pagantes travados, e a fila só cobria 3

`varredura_travados.cjs` lista **6 pagantes com crédito e sem nenhuma voz
pronta**. Os incidentes abertos cobrem **3** (os do `#65`). Cruzei os outros
com `affected_emails` de todos os incidentes:

- `dr.aleciotenorio` → `#100`, **ignored** (outra causa: conta free).
- `jrfengenhariadf` e `leandro.fitoway` → **`#72` (`2c5bab42`), `fixed`.**

E é aí que mora o problema.

## `#72` estava `fixed` escondendo dois alunos presos há um mês

O fix do upload silencioso **é real e continua valendo** — não é ele que está
em discussão. O que nunca foi feito foi a **remediação das vítimas**.

**Medi os 7 afetados do próprio incidente, um por um:**

| desfecho | quem |
|---|---|
| recuperaram sozinhos (≥1 voz `ready`) | catarinacouras, dirceu.moura.cruz78, fabiobragaclone, sidbae, natali.marcio |
| **nunca se recuperaram** | **jrfengenhariadf** (0 voz em 30 dias), **leandro.fitoway** (0 voz em 25 dias) |

É o **terceiro caso hoje** do mesmo padrão — Ivanilde no `#65` (22h), o
`resgatar_voz` preso em branch (23h), e agora este: **corrigido ≠ remediado**.
O fix cura o caso novo e abandona quem já estava caído.

## jRF Engenharia: pagou dois ciclos, nunca teve voz, e perde o acesso em 12h

- Acesso vence **25/08 12:00 UTC** — **12,2h** quando medi.
- Pagou **dois ciclos** (25/07 e 02/08). **100.000 créditos parados.**
- Conta desde 25/07. **Nunca teve uma voz pronta.** Usou a plataforma 2 vezes.
- Voz `1858c53b`: chegaram os arquivos **000, 002, 003, 006** de 7 — faltam
  **001, 004, 005**. Os índices no banco provam o buraco, não é inferência.
- 617s = **10,3min**.

### A armadilha que eu medi ANTES de escrever pra ele

Projetando os 7 arquivos pelo tamanho médio: **~18min**. A porta de upload é
**20min**. Ou seja: **mesmo que todos tivessem chegado, ele seria recusado.**

Se eu tivesse mandado só "reenvie", ele seria reprovado uma **terceira** vez
achando que a culpa é dele. É exatamente a armadilha escrita na ordem de 21/08
(o aluno recusado a 1,5s do corte que tentou 3× às cegas).

**Conferi as duas réguas NO CÓDIGO hoje, não de memória:**
- `MIN_TOTAL_SECONDS = 20*60` (`regua-audio.ts:27`, espelha `voice-creator.tsx:11`)
- `MIN_USEFUL_SECONDS = 10*60` (`regua-audio.ts:30`)

Pedi **25min** pra ele ter folga nas duas.

⚠️ A projeção dos ~18min é **projeção, não medição** — os 3 arquivos perdidos
não existem pra medir. Está dito assim no e-mail e no aviso ao Johnny.

---

## O que eu fiz, e é fato consumado

**1. Avisei o Johnny NA HORA** (prioridade: aluno pagante travado não espera
relatório). Telegram, **message_id 386**: o relógio de 12h, os dois ciclos
pagos, a causa medida, e o pedido de decisão — **estender o acesso ou
reembolsar**. Não mexo em acesso nem em dinheiro sozinho.

**2. Escrevi pro aluno.** E-mail individual, decisão minha (regra 8, 21/08).
Enviado **23:50:03Z**, assunto *"Sua voz: 3 dos seus 7 arquivos nunca chegaram
- a falha foi nossa"*. **Conferido na pasta Enviados depois de gravar: uid 65,
3KB.** Isso prova **envio**, não prova **entrega**.

O que o e-mail diz: (a) 3 dos 7 arquivos nunca chegaram e a falha foi nossa,
com os números dos arquivos; (b) a mensagem de "áudio curto" o culpou por um
problema nosso; (c) as duas réguas certas e o pedido de 25min, **com o aviso
explícito de que os 7 originais não teriam passado**; (d) os 100.000 créditos
estão intactos e ele nunca foi cobrado; (e) o acesso está no limite do ciclo,
levei aos responsáveis, **e não prometi resultado**; (f) **não grave com
pressa hoje à noite** — o caso já está sinalizado.

**3. Reabri o `#72`** (`fixed` → `investigating`), comigo, com a medição dos 7
e o que sobra. Gravado e **conferido na releitura: 1 linha afetada, 15 notas,
array preservado**.

**4. Não gastei GPU nem crédito.** Nada gerado, nada retreinado.

## Por que o `#72` NÃO está `fixed`

Depende de decisão do Johnny (acesso/reembolso) e de o aluno reenviar áudio.
Fechar agora seria trocar "medi e avisei" por "resolvi" — o que a regra 14
proíbe.

---

## Ressalvas que eu não mascaro

- **Não consegui confirmar o e-mail de 21/08 ao jrf.** A nota daquele dia
  registra o envio com bcc como prova, mas a pasta **Enviados só vai até hoje
  14:47Z** (uid 25). Então **não afirmo que ele não foi avisado** — afirmo que
  não deu pra reverificar. O que é fato é que ele não reenviou áudio: a voz
  está intocada desde 25/07 (o `updated_at` de 21/08 é só a reescrita da
  mensagem).
- **`ler_caixa.cjs` imprime o corpo com acento quebrado** (`OlÃ¡`). Fui
  conferir antes de assustar: o e-mail sai correto — `Content-Type: text/html;
  charset="UTF-8"` (`enviar_email.cjs:234`), corpo em UTF-8 e assunto RFC2047
  (linha 62). **O defeito é de exibição do nosso leitor**, não do que o aluno
  recebe. Fica registrado pra ninguém "consertar" o remetente por engano.
- **`resolved_at`/`resolved_commit` do `#72` continuam preenchidos** (21/08,
  `cd470fc`) porque `anotar_incidente` não tem flag pra zerar. O incidente está
  `investigating` com carimbo de resolvido, mentindo pro detector. Gap já
  registrado na ronda das 23h, agora com uma terceira vítima.
- **`leandro.fitoway` não foi contatado nesta ronda.** 6 de 14 arquivos, 575s,
  acesso só vence 29/08 (108h). Não é urgente e cabe no próximo turno. Digo
  isso em vez de deixar parecer que tratei os dois.

## Regra 7: o grupo do Lucas segue inalcançável, e agora são 3 rondas

Não herdei a suposição, **medi**: `avisar_grupo.cjs` aborta com
`WAHA_API_URL/WAHA_API_KEY ausentes nesta máquina` (a WAHA só escuta em
`127.0.0.1` no servidor). E o `--fato` do PR #37 **não está na main** — o
script ainda exige `--assunto`/`--pergunta`.

Então o fato desta ronda foi pro **Telegram** (alcança o Johnny) e **não** pro
grupo do WhatsApp onde está o Lucas. **Terceira ronda seguida** com o mesmo
buraco, e desta vez ele custa caro: a decisão do jrf é comercial e vence em
12h. Isso precisa de provisionamento, não de mais uma anotação.

## Fila no fecho

**8 abertos:** `#15`, `#52`, `#65`, `#72` (reaberto por mim), `#97`, `#99`,
`#108`, `#123`.

## Sobra pro próximo turno

- **Decisão do Johnny no `#72`/jrf até 25/08 12:00 UTC.** Se não sair, ele
  perde o acesso tendo pago dois ciclos sem nunca receber o produto.
- **`leandro.fitoway`** — mesma causa, 108h de folga, contatar.
- **`#124`** (Dr. Negrini) vence **25/08 12:00 UTC**, mesma fronteira.
- **`#99`** (Luciano) vence **26/08**, esperando Lucas/Johnny.
- **`#15`** continua travado na env `FASE_TELEMETRIA_SECRET`.
- **WAHA nesta máquina** — sem isso a regra 7 não é cumprível daqui.

## Fim de ronda, passo fixo

- `git fetch origin && git log --oneline origin/main..HEAD` → **vazio**. O log
  desta ronda está na **main** (`dc95ef6`), não em branch.
- **Nenhuma migration aplicada** nesta ronda. Nada a conferir no banco por DDL.
- Varri as branches com `git rev-list main..<branch>` e achei uma que importa.

### Achado do passo fixo: o conserto do `resolved_*` existe e está órfão

A ressalva que eu escrevi acima (incidente `investigating` com carimbo de
resolvido) **já tem conserto escrito** — e ninguém o vê:

`origin/feat/incidents-resolved-at`, 2 commits, de **20/08**, do Frank:
> `fix(incidents): reabrir limpa resolved_*, backfill dos 2 cegos de 21/07, migration 85→86`

**Não tem PR nenhum aberto** (conferi os 16 PRs abertos, ele não está lá). É
pior que "completed no board não é produção": aqui não existe nem o pedido de
revisão. É a terceira roupa do mesmo problema, agora em branch invisível.

**NÃO mergeei, de propósito**, por dois motivos medidos:
1. Está **198 commits atrás da main** — é a mesma armadilha STALE do
   `feat/resgate-voz-failed` (que a ronda das 22h recusou e refez em cima da
   main fresca, virando o PR #49).
2. Carrega **migration** (`scripts/86_incidents_resolved_guard.sql`), e
   migration não sobe sem aval do Johnny.

**Recomendação:** delta reescrito em cima da main fresca, branch nova + PR base
main, e a migration 86 **só com o "pode" do Johnny**. O gap já corrompeu o
sentido de **3 incidentes** (`#52`, `#65`, `#72`).

### Contexto que não é meu, mas alguém precisa ver

**16 PRs abertos**, os mais velhos de **18/08** (`#4`, `#5`). O `#37`
(`avisar_grupo --fato`) é o que destravaria metade da regra 7. Não toquei em
nenhum — não era o meu incidente e não abro frente nova numa ronda serial.
