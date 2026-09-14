# 14/09 ~23h40Z–00h15Z — Rotina das falhas

Método serial (regra 8): peguei **um** incidente e levei até o fim. Fila **81
abertos** na abertura. Fecha em **80**.

Repo em `main`, `pull --ff-only` limpo (já estava em dia). `_frank/ordens/README.md`
lido antes de tocar em qualquer coisa, mais a ordem de **29/08** (planilha
desligada). **Nada da planilha foi lido, escrito, classificado ou reprocessado.**
Ordem de canal de **31/08**: o aviso desta ronda foi **no grupo**, com
`notify-grupo.sh`, e só lá.

Varreduras fixas, antes de tudo:

- **Travados:** 3 em "acesso vivo, com crédito e sem voz pronta", **nenhum
  novo** — Marcelo (36d, já tratado), Eric e Euneiva em `awaiting_training`
  esperando o clique **deles** (2d e 0d). Mais 1 `training_jobs` obsoleto (voz
  já `ready`, ninguém esperando). Nada a fazer.
- **Estorno:** 13 devolução + 13 não-devolução cadastrados, 3.252 linhas
  varridas, nenhum tipo por classificar.

## Qual peguei, e por que

Os mais velhos por `created_at` seguem em decisão alheia ou prazo datado e foram
reconferidos pelas rondas de hoje. Mantive o critério que a ronda das 22h
estreou e a das 23h usou: ordenar por **data da última nota** — quem está aberto
e ninguém encosta.

Deu o **`#281`** (`6da9056e`, u.brunojorge@gmail.com): última anotação **06/09
13:27Z**, **8,4 dias parado**, o campeão da fila. Aluno pagante esperando =
prioridade máxima, então não havia o que discutir.

## O que era, de verdade

**Não era bug nenhum, e o aluno já tinha resolvido sozinho — 55 minutos antes de
eu responder pela primeira vez.**

O chamado nasceu em 06/09 12:31Z: Bruno comprou curso + assinatura e ficou "sem
créditos". A causa era conta duplicada — comprou com `brunno.lopes@live.com` e
criou conta com `u.brunojorge@gmail.com`; o vínculo casa por e-mail e nada casou.

Medido agora, no banco:

| medição | resultado |
|---|---|
| `profiles` brunno.lopes@live.com (`7e36ec57`) | `plan=pro`, `access_source=hotmart`, `access_until=06/10`, **200.000 cr**, last_seen **11/09 15:58** |
| `profiles` u.brunojorge@gmail.com (`45f3f349`) | `free`, **0 cr**, last_seen 06/09 12:32 — duplicata morta, sem dinheiro em cima |
| `entitlements` | **uma só** (`18d00572`), `active`, **já vinculada** ao user_id certo, criada 06/09 12:10 |
| `credit_transactions` | 2× `subscription_grant` de 100.000 (`HP2643264260` 06/09 12:33 + `HP3815308904` 13/09 14:19) = os 200.000 do perfil, **zero débito** |

O perfil certo foi criado **06/09 12:33:04** — 2 min depois do chamado abrir.

## O erro que eu corrijo de mim mesmo

Minha nota de **06/09 13:27Z** dizia ao aluno que o acesso *"vai aparecer assim
que a conta certa for usada"*. Ele **já tinha usado**, às 12:33. Eu respondi em
cima de um retrato velho: medi o estado da abertura do chamado, não o estado do
momento em que escrevi.

Não causou dano (a carta mandava fazer exatamente o que ele já tinha feito), mas
é a mesma família de erro que o passo (1) da rotina existe pra evitar — *"já
resolveu sozinho? confira o estado ATUAL antes de qualquer coisa"*. Registro
aqui porque o caso só ficou 8 dias parado por isso: a nota dizia "esperando
resposta do aluno" quando não havia mais nada a esperar.

## O que MUDOU desde então, e por isso escrevi de novo

**O trial de R$ 0 virou assinatura paga.** `pagou_de_verdade` em
`brunno.lopes@live.com`:

- curso *Fábrica de Conteúdo Invisível* — **R$ 368,64 COMPLETE**, 06/09;
- assinatura FastCloner rec#1 — **R$ 0** COMPLETE, 06/09 (o trial);
- assinatura FastCloner rec#2 — **R$ 97,00 APPROVED**, **13/09** (`HP3815308904`).

Ou seja: ele agora é assinante **pagante da plataforma**, não só do curso — o
oposto do que a minha carta de 06/09 afirmava (e que, na data, estava certa).
Deixar isso sem aviso é o roteiro pronto de uma contestação daqui a uma semana.

Ele **nunca respondeu**: `ler_caixa --de` nos **dois** endereços = vazio, com
contraprova (`--ultimos 3` devolve normal, fila da Fast = 0). E **não gastou um
crédito sequer** desde que pagou.

## O que fiz

1. **E-mail ao Bruno** (Enviados **uid 2361**, bcc suporte@), com quatro pontos:
   qual conta usar; que a conta antiga do gmail vai mostrar zero crédito **pra
   sempre** e isso não é defeito novo; que o teste virou **R$ 97 cobrados em
   13/09**, com acesso até 06/10 e 200.000 cr; e que, se a cobrança não foi
   intencional, **basta responder que eu cancelo e trato a devolução aqui** —
   ainda dentro do prazo de arrependimento.
   **Não** mandei ele se virar no painel da Hotmart: isso é a regra 9-C, e é
   exatamente o defeito que está aberto contra `manual.ts:396-403`.
   Regra 8: e-mail individual sobre caso que estou tratando, decido sozinho.
2. **`#281` → `fixed`**, com `resolution_note` dizendo o que era, o que o banco
   confirma hoje e o que eu escrevi. Fechado porque o defeito relatado **não
   existe mais e está medido**, não porque o prazo venceu.
3. **Recado `para_frank_6da9056e` drenado** da `agent_state` (8,4 dias na fila).
   O roteiro dele — conferir entitlement, vincular se órfã, creditar, responder
   por e-mail — está **inteiro satisfeito**: entitlement única, já vinculada,
   crédito lá, aluno respondido. Deletado com `returning` e releitura: 1 linha
   apagada, 0 restantes.

Escritas conferidas na releitura: `#281` 1 linha afetada, `agent_notes` 4→5
(array preservado), `resolution_note` 0→981 chars (concatenado).

## O que NÃO fiz, e por quê

- **Não vinculei nem apaguei a conta duplicada do gmail.** Ela é gratuita,
  zerada e sem dinheiro em cima; juntar contas por semelhança de nome continua
  proibido, e ele não pediu.
- **Não toquei em crédito.** Não havia nada a estornar nem a liberar.
- **Não abri incidente novo** pelo "retrato velho". É lição de método, não
  defeito de sistema — fica registrada aqui e na nota do `#281`.

## Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` — conferido no fim.
Nenhum fix desta ronda ficou preso em branch (não houve código: a entrega foi
e-mail + escrituração).

### ⚠️ O trabalho em voo do `#402` SUMIU entre as 23h e agora

A ronda das 23h registrou `frontend/src/lib/agent/mail-bounce.ts` **modificado e
não commitado** (+35 linhas, o tipo `VeredictoDns` da virada do `#402`), e
escreveu de propósito que **não commitou nem descartou**, por ser trabalho
alheio.

Medido agora, na abertura desta ronda:

- `git status` do arquivo: **limpo**. `git diff --stat HEAD` nele: **vazio**.
- `grep -c VeredictoDns` no arquivo: **0**. O tipo não está lá.
- último commit que toca o arquivo: **`3461733`, de 13/09 13:54** — ou seja,
  **nada** daquele trabalho entrou na main.

Conclusão, sem suavizar: as +35 linhas foram **descartadas**, não commitadas.
Não fui eu — abri a ronda com o working tree já nesse estado e não rodei
`checkout`/`restore`/`stash` em nada. **O `#402` continua sem uma linha de
código em produção**, e quem for retomá-lo recomeça do zero.

Registro isso porque é a lição de 19/08 pelo avesso: lá o conserto ficou
invisível num branch; aqui ele evaporou do working tree. As duas terminam igual
— aluno sem o fix.
