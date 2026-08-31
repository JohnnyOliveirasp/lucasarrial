# Ronda das falhas — 31/08/2026, 14h40–15h40 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**; nenhum incidente de
causa-planilha foi aberto, reaberto ou comentado. Canal: tudo saiu **no grupo**
(`notify-grupo.sh`), conforme a ordem de 31/08 — nada foi para o privado.

## Placar

- Fila no início: **8 investigating + 4 aguardando_aluno**.
- Fila no fim: **10 investigating + 4 aguardando_aluno** — subiu, e subiu **de
  propósito**: abri 2 incidentes (`#209` e `#210`) para defeitos que eu mesmo
  medi hoje. Fila que sobe porque a gente enxergou mais é resultado honesto;
  seria fácil não abrir e o placar ficaria mais bonito.
- Alunos respondidos: **1** (Márcio/#207, pagante).
- Fechados como `fixed`: **0** — e nenhum dos casos de hoje podia ser fechado.
  Detalhe de cada um abaixo, com o passo que emperrou.
- Fix escrito e enviado: **1** (PR #136). **Em produção: 0.**

---

## Caso 1 — #205/#208 Cristina: a causa não estava na conta dela, estava no nosso manual

Peguei pelo serial (mais antigo acionável com aluno afetado). O #99, mais
velho, segue travado na decisão dos R$ 97 do Johnny — vence amanhã, e o aluno
já tem o prazo certo por escrito (Enviados uid 365).

### 1. Primeiro, uma correção da minha própria nota anterior

A ronda das 14h registrou que o e-mail para a Cristina saiu mas **a cópia não
foi gravada em Enviados** (IMAP timeout), e concluiu: "ausência em Enviados não
é prova de silêncio". Agora tem prova positiva do outro lado:

> **INBOX uid 385, 31/08 14:00:33Z** — ela respondeu **citando o meu e-mail
> inteiro**.

O envio funcionou. O que falhou foi só a **escrituração**. Registro porque a
dúvida encerrou para este caso — mas o defeito continua de pé e voltou a
acontecer 90 minutos depois (ver #210).

### 2. A conversa que eu não tinha lido, e que muda tudo

Fui ler o `help_messages` inteiro. A Fast errou **três vezes** com ela:

| horário | o que a Fast disse | verdade medida |
|---|---|---|
| 12:57:05Z | "pacote avulso (compra única, não expira): 25k/R$19 · 60k/R$42 · 120k/R$78" | a rota **barra com 403** quem não tem acesso ativo |
| 12:58:21Z | "Você fez o **período de teste** (R$0, primeiros 7 dias) que veio com créditos" | `access_until` NULL, 0 `purchases`, Hotmart sem nenhum `PURCHASE_APPROVED` |
| 13:50:54Z | "com a assinatura cancelada você ainda pode usar SIM — comprando pacotes avulsos" | ela nunca teve assinatura para cancelar; e o avulso segue barrado |

O detalhe que fecha o caso: **um minuto antes** do trial inventado, às
12:57:05Z, a própria Fast tinha lido o estado certo — *"você tem 0 créditos no
momento"*. O trial saiu de dedução pela data de cadastro, não de dado.

**Consequência:** ela passou a exigir *"os MEUS 100.000 créditos"*. Esses
100.000 nunca existiram na conta dela — 100.000 é o `subscription_grant` de
quem assina. **A premissa da cobrança fomos nós que demos a ela.**

### 3. Por que NÃO escrevi para ela de novo (decisão, não esquecimento)

Ela já recebeu **três** respostas hoje: a minha das 13h55Z e duas da Fast (a
última às 15h25 BRT, prometendo retorno da equipe). Um quarto texto nosso no
mesmo dia, sem trazer **a** resposta, é enrolação com cara de atendimento.

O que falta é a decisão — liberar ou não os 100.000 de cortesia — e ela é
**comercial, do Johnny**. Postei no grupo como urgente, com o SIM/NÃO formulado
para ele responder numa palavra. Estado dela agora (INBOX uid 386, 14:28:47Z):
urgência declarada, pedido de prioridade, e *"tentei o WhatsApp, sem sucesso"*.

**Compromisso datado, gravado na nota do #205 para quem pegar depois:** se até a
manhã de 01/09 a decisão não vier, **escreva para ela mesmo assim** com a
verdade completa (os 100.000 são a mensalidade de quem assina e nunca estiveram
na conta dela; quem afirmou o contrário foi a nossa Fast, por defeito nosso, já
em conserto; a decisão está com a equipe; ela não tem cobrança nenhuma). Ela não
pode passar de 24h achando que a gente escondeu crédito dela — foi o silêncio
que fez a Viviana explodir.

### Status: os dois seguem `investigating`

Nada quebrou **na conta dela** (conta criada, voz `ready` 32min, imagens
`ready`) e nada foi resolvido. `fixed` está fora de questão. Deixei o #208 aberto
junto com o #205 de propósito: o pedido chegou pelos dois canais, e fechar um
agora arriscaria a resposta sair por um só.

---

## Caso 2 — #209 (NOVO): o manual da Fast contradiz a produção em dois pontos

Aberto por mim ao investigar o #205. **Não é caso único por construção** — as
duas instruções estão no manual como regra permanente, então valem para
qualquer aluno com 0 crédito e sem assinatura. A varredura de hoje contou
**117 perfis** exatamente nesse estado.

### O que o código diz, e o que o manual mandava dizer

- `api/v1/credits/checkout/route.ts:55` → `forbidden("Assine o plano antes de
  comprar créditos avulsos.")`, gate `hasActiveAccess`.
- `app/[locale]/app/credits/page.tsx:75` → sem assinatura a tela nem mostra os
  pacotes ("avulso é complemento do plano, não porta de entrada — regra travada
  com o Lucas").
- O manual mandava oferecer avulso em **dois** lugares: `"Créditos
  insuficientes"` e `"Achei caro"` (playbook de cancelamento).

Ou seja: **a Fast oferecia a venda de uma porta que o app tranca.**

### O conserto

Branch `feat/fast-manual-avulso-gate`, commit `b3b0f62`, **PR #136** (base
`main`). Muda **só texto** de `frontend/src/lib/agent/manual.ts`:

1. Item novo: avulso **exige acesso ativo**; com a linha `Acesso` = *SEM
   assinatura ativa*, não se oferece avulso em hipótese nenhuma.
2. Ressalva no item "crédito é o único bloqueio": vale para **gastar** o que já
   se tem; **comprar** avulso é outra coisa.
3. Item novo: **nunca afirmar que a pessoa fez o período de teste** — ler a
   linha `Acesso` e as "Últimas movimentações de crédito"; sem rastro, dizer a
   verdade e escalar.
4. `"Créditos insuficientes"` e `"Achei caro"` passam a condicionar a oferta ao
   acesso ativo.

`npx tsc --noEmit` limpo. Nenhum comportamento de código, nenhuma migration,
nenhum crédito tocado.

**O desenho que eu copiei, não inventei:** o manual já tinha essa disciplina
para o assunto **garantia** (*"você NUNCA decide isso sozinha, use SÓ a linha
GARANTIA HOTMART"*, que nasceu do #198). Faltava aplicá-la aos outros dois
campos que também são histórico de conta e não dedução.

**O que eu deliberadamente NÃO consertei:** não mexi no gate do checkout nem na
tela de créditos. A regra de negócio está travada com o Lucas e não é minha para
mudar — o defeito é a Fast desconhecer a regra, não a regra.

> ⚠️ **PR aberto não é produção (regra 14).** Enquanto o #136 não mergear na
> main, a Fast continua oferecendo avulso para quem leva 403. Só a main deploya.

---

## Caso 3 — #207 Márcio (pagante): promessa da Fast honrada, sem gastar GPU no escuro

Peguei porque o #205 travou em decisão de terceiro, e este tem **aluno pagante**
com promessa nossa pendurada: às 14:02:16Z a Fast disse a ele que *"a equipe pode
retreinar ela sem custo"* e que responderiam por e-mail. Até eu pegar, ninguém
tinha escrito.

O chamado dele inteiro é uma frase: **"minha clonagem ficou muito abaixo"**.

### O que eu medi antes de escrever

- Voz `343545ac` "Minha Voz", `ready`, 1 arquivo, **34min41s** de fala real —
  bem acima do portão de 20min. **O material dele não é a causa.**
- `reference_transcript` **íntegro nas duas pontas** ("Fiz uma associação…" →
  "…nas próximas páginas."). O defeito do Negrini `#124` (palavra fantasma na
  ponta, que faz o VoxCPM ecoar) **não aparece aqui**. Reduz a hipótese, não
  fecha.
- **Não ouvi o áudio e não vou fingir que ouvi.** Não julgo qualidade.

### Por que perguntei em vez de já retreinar

O Executor recomendou rodar a cura de referência direto. Não fiz, por três
motivos que se somam:

1. Retreinar com o **mesmo material bom** tende a devolver o **mesmo
   resultado** — e o aluno espera de novo para nada.
2. O próprio manual da Fast proíbe: *"NUNCA mande refazer geração pra melhorar a
   naturalidade sem um defeito concreto identificado — refazer sem causa é
   crédito do aluno gasto à toa."*
3. GPU sem causa nomeada bate na regra do Johnny.

"Ficou muito abaixo" são **cinco defeitos diferentes com cinco consertos
diferentes**. Então o e-mail (~15h25Z) faz três coisas: honra a promessa (o
retreino é por nossa conta, não sai do saldo dele), entrega o que já foi
descartado (não regrave, seus 34 minutos estão ótimos) e pede a única coisa que
falta — qual dos cinco: timbre de outra pessoa · rápido/devagar demais ·
robótico · corta-engole-repete · chiado/eco. Mais: qual das gerações ficou pior
(ele tem 4 áudios de 31/08 01:20–01:27Z e um Vídeo Clone), para eu comparar com
a referência. Sem prometer data.

### A hipótese do Vigia que eu NÃO decidi

O Vigia levantou que isto pode ser ocorrência do **#192** (mesmo enunciado:
aluno com áudio bom, insatisfeito com o clone; lá a causa medida é **ritmo**).
Não mesclei nem fechei: **a resposta do Márcio decide.** "Fala rápido demais" →
mesma classe do #192/#200. "Não parece minha voz" → outra coisa. Perguntar custa
um e-mail; mesclar errado custa o caso do aluno.

### Status: `investigating`, com a bola com o aluno

Não vai para `fixed`: eu perguntei, ele ainda não respondeu. Nada foi resolvido.

---

## Caso 4 — #210 (NOVO): o e-mail sai e não fica registrado

Medido **duas vezes hoje**, com erros diferentes:

| horário | destinatário | o que o script disse |
|---|---|---|
| 13:55Z | Cristina | "enviado" + *"a cópia NÃO foi gravada em enviados: **IMAP timeout**"* |
| 15:25Z | Márcio | "enviado" + *"a cópia NÃO foi gravada em enviados: **read ECONNRESET**"* |

Entre as duas, o envio para a Wallana (13:51Z) gravou a cópia normalmente
(uid 371). **Intermitente, não permanente** — o pior caso para detectar.

**Por que isso não é cosmético:** a pasta Enviados é a única fonte que a ronda
seguinte tem para saber se um aluno já foi respondido — a própria varredura
manda conferir antes de escrever (*"aviso repetido é ruído, silêncio é
abandono"*). Com a cópia faltando, a ronda seguinte lê silêncio onde houve
resposta, e ou escreve de novo, ou conclui abandono e refaz trabalho.

**Não é falha de entrega**, e isso está provado: o e-mail da Cristina não ficou
em Enviados **e mesmo assim chegou** (ela respondeu citando o texto). O defeito é
de **escrituração**. O que resta hoje como prova de envio é fraco: aceite do SMTP
+ ausência de bounce.

É literalmente a **metade não consertada do `b2651a6f`** ("não existe registro
do que foi enviado"), fechado como `fixed` tendo consertado só o lado da Fast.
Agora o mesmo buraco aparece no canal do próprio Frank.

**Caminho anotado, não tentado** (eu estava no meio do serial de outro
incidente): não depender de um único APPEND — repetir com backoff e, se ainda
assim falhar, gravar um registro local do que foi enviado, para a ronda seguinte
ter fonte além do IMAP.

---

## Por que não peguei os outros

Conferi cada um antes de seguir, em vez de herdar a leitura da ronda anterior:

- **#99 Luciano** — trava na decisão dos R$ 97, que **vence na virada de
  amanhã**. Ele já tem o prazo certo por escrito (Enviados uid 365) e o caminho
  que não depende de nós (pedido direto pela Hotmart). Reforcei no grupo hoje:
  depois de amanhã não dá mais.
- **#192 Robert** — PR #135 esperando decisão binária do Johnny, mais um humano
  **ouvir** o timbre. Aberto desde 30/08 02h. Nenhum dos dois passos é meu.
- **#200 Ritmo** — causa medida, conserto escrito, **PR #132 OPEN**.
- **#201 Bounce** — branch `feat/triagem-de-bounce` pronta e não mergeada.
- **#203 Jussara** — aluna já escrita, **PR #134 OPEN**.
- **#196, #197, #202, #206** — `aguardando_aluno`, nenhum com 7d+ de silêncio.

## Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` conferido **antes** de
commitar este registro. O código de hoje está em `feat/fast-manual-avulso-gate`
(PR #136) — **nada de fix preso em branch sem PR**. Este log vai direto na
`main`, como manda a ordem.

## Precisa de gente (nesta ordem)

1. **#99 Luciano — VENCE AMANHÃ (01/09).** Devolver ou segurar os R$ 97.
   Último dia.
2. **#205/#208 Cristina — SIM ou NÃO** nos 100.000 de cortesia. Ela declarou
   urgência hoje e cobrou prioridade. Se não vier decisão, a próxima ronda
   escreve para ela mesmo assim (compromisso já gravado no incidente).
3. **PR #136** — aval de merge. Enquanto não mergear, a Fast segue oferecendo
   avulso a quem leva 403 e podendo inventar trial. É o único item da lista que
   protege alunos que **ainda não** reclamaram.
4. **#132 / #133 / #134** — aval de merge; 3 incidentes fecham no mesmo dia.
5. **#135** — decisão binária (a recomendação registrada é só o bucket
   reverte-protegida).
6. **#192** — alguém **ouvir** o timbre.
7. **Os 117** — decisão de comunicação do onboarding. O #209 conserta a Fast,
   não conserta a régua de e-mails que só menciona a assinatura no quarto
   e-mail, depois do aluno já ter trabalhado.
