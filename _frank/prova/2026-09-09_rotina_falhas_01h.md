# Ronda das falhas — 09/09/2026, ~00h40–01h10Z (Frank, dono da fila)

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido antes
de tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: **grupo** (ordem de 31/08) — posta feita.

**Caso levado adiante:** o **Edesio** (`grupouniprox@grupouniprox.com.br`), aluno
pagante travado, achado dentro da nota 5 do `#312`.
**Estado no fim:** aluno **escrito** (Enviados uid 1362, cópia confirmada),
defeito sistêmico aberto como **`#315`**, nota de correção no `#312`.
Zero GPU, zero crédito, zero migration, zero código, zero PR.

---

## 0. A ronda em uma linha

**Um aluno que pagou R$ 741 pelo SGP passou 8 dias sem entrega achando que já
tinha mandado o material, e a última coisa que a casa disse a ele foi para
procurar esse material dentro de um app em que ele nunca conseguiu entrar — e
que ele nem precisava abrir.**

## 1. Por que este caso, e não o topo da fila

Regra 8 manda pegar o mais antigo com aluno afetado, mas a prioridade escrita é
clara: **aluno esperando vem antes da limpeza da fila.** Os três mais antigos
seguem travados e não por falta de investigação (`#313` e `#312` na decisão
comercial do Johnny, `#15` esperando ocorrência nova). Antes de escolher, rodei
a varredura e fui atrás de quem está esperando **agora**.

O sintoma que puxei primeiro foi outro: **17 vozes em `awaiting_training`**,
nenhuma com `runpod_job_id`, a mais velha de 57 dias. Investiguei e **não é
defeito** — está tudo certo e registrado:

- `awaiting_training` espera um **clique do aluno** (`start-training/route.ts:93`).
- A classe já foi tratada (`#137`, `#164`) e existe o `lembrete-treino-sweep.ts`.
- O corte `SEM_LEMBRETE_ANTES_DE = 2026-09-06` exclui as antigas **de propósito**,
  porque foram triadas uma a uma.
- A única pagante viva sem voz pronta (**Tânia**, `tania-araujo@uol.com.br`) já
  recebeu **dois** e-mails à mão explicando o clique. **Conferi na fonte**, não
  aceitei a afirmação do comentário: Enviados uid 1071 (05/09) e uid 1158 (06/09),
  os dois claros e os dois oferecendo iniciar o treino por ela.

**Conclusão honesta:** a bola está com a Tânia, e treinar por conta própria
gastaria crédito que ela não pediu. Não escrevi uma terceira carta (a régua é de
2, e a 2ª saiu há 2 dias). **Não é aluno abandonado.** Segui procurando.

O caso real estava na **nota 5 do `#312`**, escrita pelo Vigia 40 min antes, que
terminava com "fica escrito para a próxima ronda que tiver esse dado". Essa ronda
era esta.

## 2. O que eu verifiquei, na fonte, sem herdar nada

| O que | Onde | Resultado |
|---|---|---|
| Pagou mesmo? | `pagou_de_verdade.cjs` (Hotmart viva) | **R$ 1.054,32**, 2 avulsas COMPLETE em 31/08: R$ 741 SGP + R$ 313,32 Fábrica |
| Nosso banco sabe? | `payment_events` | **0 linhas** — inclusive buscando `uniprox`/`Edesio` no payload cru |
| Entitlement? | `entitlements` | 0 |
| Boas-vindas registrado? | `agent_state.sgp_boas_vindas` | 0 |
| Entrou alguma vez? | `auth.users` | `last_sign_in_at` **NULL**; `recovery_sent_at` 04/09, tiro único |
| Material chegou? | `sgp_pedidos` / `storage.objects` / `voices` | **0 / 0 / 0** |

A conta nasceu 04/09 15:28:34Z e o e-mail de boas-vindas saiu 15:28:35Z
(Enviados uid 714) — **sem nenhum evento de pagamento por trás**.

## 3. O achado que inverte a nota 5

A nota 5 registrou, honestamente, que **não conseguia** conferir se a Fast tinha
respondido: *"a pasta de Enviados está vazia (o SMTP da Fast não salva cópia),
então NÃO tenho como conferir"*.

**Isso não procede.** As duas respostas estão lá, achadas com
`ler_caixa.cjs --enviados --para`:

- **uid 1324** (08/09 15:15Z) — repete o roteiro de boas-vindas.
- **uid 1342** (08/09 19:25Z) — *"Entra no menu **Vídeos** (no app) (…) essa voz
  fica no menu **Vozes**"*.

Não era lacuna de detecção. Era **resposta errada**. A diferença importa: quem
herdasse a nota 5 iria procurar um buraco de detecção que não existe e passar
batido pelo defeito que existe.

## 4. Por que aquela resposta é impossível de cumprir

Dois erros somados, e o segundo é o que dói:

1. **Ele não consegue entrar.** Nunca definiu senha; o link de 04/09 venceu.
   Mandar "entra no menu Vídeos" é mandar para uma porta trancada.
2. **Ele não precisa entrar.** O portal do SGP é **público**:
   `sgp/page.tsx:9-11` — *"Página PÚBLICA e SEM CONTA (…) a conta na plataforma
   só nasce no Confirmar e Enviar"*. Sem guarda de auth na rota (a com login é
   `/app/sgp`, que redireciona para `/login`).

O passo que destravava ele não exigia senha nenhuma, e **ninguém disse isso a ele**.

## 5. A causa, com arquivo:linha

`frontend/src/lib/agent/account.ts:196-283` → `buildAccountContext()`, que monta
**todo** o contexto que a Fast recebe sobre o aluno. Ele lê `profiles`, `voices`,
`generations`, `video_clones`, `image_generations`, `video_projects`,
`credit_transactions` e a garantia da Hotmart. `grep` no arquivo inteiro:
**zero** ocorrência de `sgp_pedidos`, `lerPedido` e `last_sign_in`.

A Fast estruturalmente **não pode** saber (a) que o aluno é comprador de SGP,
(b) em que passo o pedido está, (c) se ele algum dia entrou. Sem isso, o único
enquadramento disponível para "cadê o meu material" é a plataforma.

**Agravante:** com tudo vazio, o contexto emitido para ela continha literalmente
`"Nenhum trabalho ainda (conta sem uso)."` — e mesmo assim ela afirmou que o
projeto *"deve estar na lista de vídeos"*. Não é só falta de dado: é **afirmação
contra o dado presente**. Mesma família do `#260`.

## 6. O que eu fiz

- **Escrevi para o aluno** (Enviados **uid 1362**, cópia CONFIRMADA na tentativa 1):
  assumi o erro da orientação anterior, disse a verdade de que o material não
  chegou, expliquei que **enviar não exige login**, apontei
  `https://fastcloner.com/sgp`, e ofereci receber os arquivos por resposta ou
  link de Drive. Regra 8 (21/08): e-mail individual sobre caso que estou
  tratando, decido sozinho.
- **Abri o `#315`** (`a0669176`) com a causa, a prova e o conserto recomendado.
- **Anotei o `#312`** (nota 6, 1 linha afetada, conferida na releitura) com a
  correção factual da nota 5. **Status inalterado** — o que emperra ali continua
  sendo a decisão comercial do `#313`.

## 7. Tamanho, sem inflar

**Vítima confirmada: 1.** Não afirmo mais que isso.

Medi o pool onde o mesmo silêncio cabe: **411 contas** criadas desde 29/08 que
nunca logaram, sem pedido no `/sgp` e sem voz (401 delas desde 04/09), fora QA.
⚠️ **Esse número não é "411 alunos abandonados" e não deve ser citado assim:** o
lote cria conta para **todo** comprador, inclusive de curso (Fábrica de Conteúdo
Invisível), que não tem motivo nenhum para entrar. Não apurei quantos compraram
SGP e portanto deviam ter enviado material. É pool a apurar, não placar.

⚠️ **E `payment_events` não serve de censo para essa apuração** — o próprio
Edesio, comprador de R$ 741, tem zero linha lá.

## 8. O que NÃO está feito

1. **`#315` não tem conserto no ar.** É código de atendimento em produção;
   propus a mudança e pedi aval no grupo em vez de subir sozinho.
2. **Não sei se o Edesio mandou o material pelo WhatsApp.** O próprio e-mail de
   boas-vindas oferece o (41) 99148-1573 e **eu não leio o WhatsApp daqui**. Se
   ele mandou por lá, o material existe e quem não achou fomos nós. Perguntei a
   ele por qual canal enviou; a resposta decide o próximo passo.
3. **Não criei pedido no lugar dele, não disparei senha nova** (competiria com a
   única ação que destrava) e não mexi em crédito, acesso ou entitlement.
4. **`#312`, `#313` seguem travados** na decisão comercial do Johnny.
5. **A Tânia continua sem clicar.** Ball com ela, 2 cartas enviadas, acesso vence
   17/09. Se chegar perto disso sem clique, vale uma decisão humana.

## 9. Higiene de fim de ronda

- **Zero código, zero PR, zero migration** nesta ronda.
- Escritas: 1 incidente novo (`#315`), 1 nota (`#312` nota 6), 1 e-mail a aluno.
  Todas conferidas na releitura, com nº de linhas afetadas confirmado.
- O `anotar_incidente.cjs` **recusou** meu primeiro comando (passei `312`, que é
  o número, não o prefixo do uuid) em vez de dar UPDATE em 0 linhas em silêncio.
  A trava funcionou; refiz com `c726c5ae`.
- Este log vai **direto na `main`**.
- Nada da planilha tocado.
