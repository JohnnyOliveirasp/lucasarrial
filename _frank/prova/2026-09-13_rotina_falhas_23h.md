# Ronda das falhas — 13/09/2026, ~23hZ (20h BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais as ordens de
**27/08** (só erro de sistema vira chamado), **29/08** (planilha desligada) e
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.**

**Escrevi para 2 alunos**, **cancelei 1 assinatura que impedia uma cobrança
indevida de R$ 97**, **abri 1 chamado** (`#384`) e **desmenti a minha própria
escalação urgente de 09/09**, que estava parada há 4,2 dias em cima de um
obstáculo que não existe.

O que esta ronda tem de diferente: os dois casos estavam **bloqueados por uma
afirmação nossa que nunca foi medida**. Nos dois, a medição levou 5 minutos e
derrubou dias de espera.

---

## 0. Handoff da ronda das 22h — fechado

A ronda anterior pediu: *"confira bounce para os três antes de considerar
qualquer um deles entregue"*. **Conferido.** O bounce mais recente da caixa é
`drrodrigoribero7@gmail.com`, **13/09 16:57:37Z** — horas **antes** dos três
envios (21:49/21:52/21:55Z). Nenhum bounce para Alfredo, André ou Jaqueline.
Agora são 5h+ decorridas, não os 8 min que a ronda das 22h corretamente recusou
tratar como prova.

---

## 1. `#223` / `506b7c3a` (Alana) — eu inventei o bloqueio, e ela esperou por ele

Item serial: o mais velho **acionável** com aluno esperando. Os 5 mais velhos
seguem travados por motivo próprio (conferido na ronda das 22h, nada mudou).

A minha nota de 09/09 neste card diz, com todas as letras: *"O BLOQUEIO: ela não
tem como abrir o Gravador"*, e escalou ao Johnny a reabertura do acesso dela
**marcada como urgente**. **As duas coisas eram falsas.**

### 1.1 Acesso nunca fechou a porta do Gravador — `arquivo:linha`

| onde | o que decide |
|---|---|
| `middleware.ts:46-52` | `APP_PATH_RE` redireciona só por `!user`. **Não lê `access_until`** |
| `app/[locale]/app/layout.tsx:58` | único `redirect` é `if (!user)`. O `subscribed` da linha 101 escolhe **texto e cadeado de sidebar**, não é tranca |
| `voice-cloning/script/page.tsx:18` | `if (!user) redirect(login)` **e nada mais**. Sem gate de acesso, sem gate de crédito |

Fumaça em produção: `GET https://fastcloner.com/app/voice-cloning/script` →
**307 para `/login?redirectTo=%2Fapp%2Fvoice-cloning%2Fscript`**. Redireciona pro
**login**, não pra `/planos` nem pra paywall — e o `redirectTo` devolve ela
**direto no Gravador** depois de logar.

### 1.2 As gravações dela estavam no servidor havia 11 dias

No uid 1420 eu escrevi a ela que as 5 gravações subiriam sozinhas *se* ainda
estivessem no navegador, e que **"isso eu não consigo ver daqui"**. Eu conseguia:
era uma listagem de R2. Medido hoje em
`70fca289-.../gravador/` (bucket `voices-clone-ai-verse`), com **`minBytes=0` de
propósito** pra o clipe de 2s não sumir por tamanho:

| arquivo | bytes | dur |
|---|---|---|
| `take_1788384156781_2s.mp3` | 28.461 | 2s |
| `take_1788384196140_300s.mp3` | 4.801.581 | 300s |
| `take_1788384196612_300s.mp3` | 4.801.581 | 300s |
| `take_1788384196631_300s.mp3` | 4.801.581 | 300s |
| `take_1788384196682_300s.mp3` | 4.801.581 | 300s |
| **total** | | **1202s = 20,0 min** |

Bate **exatamente** com os prints dela (4×5min + 1×1s, barra 20:01/20:00).
Gravados em **02/09 21:22-21:23Z**. **Controle** (pra "zero no gravador" não virar
zero de instrumento cego): a conta tem **21 objetos** no total, logo a listagem
enxerga. E `GET /api/v1/voice-clips` (`route.ts:99-103`) lista **exatamente esse
prefixo** com `authenticate` e nada mais — ela loga e **vê as 5 na lista**.

### 1.3 A urgência que eu mandei ao Johnny era falsa

Em 09/09 eu escrevi a ele: *"IndexedDB morre com limpeza de cache / cada dia
parado é risco de perder os 20min dela em definitivo."* No instante em que
escrevi isso, **o áudio já estava no R2 havia 7 dias**. Não havia relógio
correndo. **Marquei de urgente o que não era**, e a pergunta de verdade ficou
4,2 dias atrás do alarme falso. Retratado no grupo hoje, sem rodeio.

### 1.4 O que escrevi, e o que deixei de fora de propósito

Enviados **uid 2150**, cópia confirmada na 1ª tentativa (corpo lido antes, no
uid 2149 — sem entidade HTML literal, a armadilha das 21h). Disse: as 5
gravações estão salvas desde 02/09 18h22 BRT, **ela não precisa regravar nada**,
o link direto, e que **o obstáculo do acesso foi invenção minha**.

**Não mandei ela treinar.** Criar a voz dispara `start-training`, que cobra
`TRAINING_CREDIT_COST = 10.000`. Ela tem 99.475 créditos e **nunca nos pagou**
(`payment_events`: 2 linhas, produto 7851642, valor 0). Pela linha do README das
ordens, *"quem nunca pagou e saiu do trial não gasta"* — **decisão de dinheiro,
não minha**.

⚠️ **Medido, e é desconfortável:** essa trava **não existe em produção**.
`start-training/route.ts:104` só barra por `bal.total < TRAINING_CREDIT_COST`; o
`hasActiveAccess` da linha 112 só monta a **mensagem** do erro. `credits/service.ts:53-75`
(`debitCredits`) só falha por `insufficient`/`no_profile`. **Se ela clicar, treina.**
E a casa já prometeu a ela **por escrito, 2×** (uid 467 e uid 468) que os créditos
são dela pra usar.

Por isso **não inventei um bloqueio novo pra ela** — seria o terceiro puxão de
tapete. Pedi que **me responda antes de clicar**, honrando a promessa do uid 468
de acompanhar o envio do começo ao fim: segura o gasto dos 10.000 num portão
humano **natural e já prometido**, sem mentir pra ela. Card segue `investigating`.

**Não abri chamado sobre a trava ausente**, de propósito: a ordem de 20/08 fecha
o assunto crédito (*"não escale, não proponha refinamento"*). Caso vivo de aluna
não é licença pra relitigar política.

---

## 2. Marcelo — a casa disse "cancelado" 3 vezes e a assinatura estava viva

Peguei pelo 🚨 da própria varredura (*acesso vivo, com crédito e sem voz pronta*,
35 dias). **Pagante**: recargas em 05/08, 12/08 e 05/09.

**O que eu achei:** ele pediu pra sair **por escrito** em 09/09 16:37 (uid 517):
*"Eu não quero mais seguir no programa."* A casa respondeu **3×** (uids 1592,
1715, 1719) que o pedido estava **registrado**. Medido hoje, 4,2 dias depois:

- `subscription_cancellations` → **ZERO linhas** para o `user_id` dele.
- Hotmart → **`SUR21VU9 | status ACTIVE`**.

**O cancelamento nunca foi executado.** Ele seria cobrado **R$ 97 em 05/10**
acreditando que tinha saído, porque foi isso que escrevemos 3 vezes.

**Cancelei** (regra 9-C: pedido do titular por escrito é automático e não
consulta o Johnny). Conferência de titularidade passou (1 assinatura, e-mail bate
com perfil e entitlement). **Conferido NA FONTE depois de gravar**, não no "ok"
da ferramenta: a Hotmart passou a responder **`CANCELLED_BY_SELLER`**. Crédito e
acesso **intocados** (298.950 cr, acesso até 05/10) — cancelar recorrência não
tira o que já foi pago (regra 9).

**Escrevi pra ele** (enviados **uid 2155**, cópia confirmada; corpo lido antes no
uid 2151), assumindo que as 3 mensagens anteriores diziam feito o que não estava.

### 2.1 A contradição que eu quase repeti

O rascunho repetia a oferta do uid 1719 (*"é só responder 'pode treinar'"*).
Antes de enviar, **conferi os arquivos da voz** (armadilha registrada: *liste os
ARQUIVOS da voz PRIMEIRO*): `f6f82819`, **1 arquivo real, 45,2MB, 47min05s**,
passa o portão de 20min com folga. **O áudio existe.**

Só que o `#128` (10/08, `ignored`) diz que esse arquivo é **entrevista com mais
de uma pessoa falando**, e o e-mail de 05/09 disse isso a ele — enquanto o
`error_message` gravado na voz culpa **infra nossa** (`#32`, *No space left on
device*). **As duas explicações estão registradas e se contradizem.** A oferta de
11/09 foi feita sem reconciliar isso.

Corrigi o e-mail antes de enviar: mantive a oferta, **disse a contradição na cara
limpa**, e combinei que **eu escuto o resultado antes de entregar** — se sair
misturado, ele não gastou nada. Evitou a 4ª decepção.

### 2.2 O dinheiro, que não é meu

`payment_events`: R$ 97 em **12/08** + R$ 97 em **05/09** = **R$ 194 pagos**, e
**ZERO refund**. Ele pediu sair em 09/09, **dentro** da janela da cobrança de
05/09 (garantia até 12/09 00:00) — **a janela fechou em 12/09 enquanto ele
esperava na nossa fila**. Escalado ao grupo, marcado urgente. **Não prometi
reembolso a ele.**

---

## 3. `#384` aberto — e por que o instrumento não pegou o Marcelo

Dois achados, um chamado:

1. **O pedido de cancelamento vira recado e nunca vira ação.** O
   `cancelar_assinatura.cjs` existe desde 21/08 pra isso ser automático, mas
   **nada o dispara**: o pedido chega por e-mail, vira nota, e depende de um
   humano lembrar. Mesmo desenho do `#350` (a casa só olha a garantia quando vai
   **responder**) aplicado ao cancelamento.
2. **`garantia_na_fila.cjs` só varre incidente ABERTO.** Todos os cards do
   Marcelo estão `fixed`/`ignored` (`#32`, `#128`, `#337`, `#351`), então ele é
   **invisível** justamente pra ferramenta feita pra achar quem perde a janela na
   fila. **Card fechado está escondendo aluno que ainda perde dinheiro** — mesma
   família da armadilha já registrada (*cheque também `ignored`/`fixed` com
   `last_seen_at` recente*).

---

## 4. Placar honesto

- **Alunos escritos: 2** (Alana uid 2150, Marcelo uid 2155), os dois com cópia
  confirmada na 1ª tentativa e **corpo lido antes de enviar**.
- **Cobrança indevida evitada: R$ 97** (renovação de 05/10 do Marcelo).
- **Chamado aberto: 1** (`#384`).
- **Incidentes fechados: 0.** Os dois casos que peguei **não fecham**: o da Alana
  depende de decisão de dinheiro do Johnny, o do Marcelo depende de devolução que
  não é minha alçada. **Não vou marcar `fixed` o que não resolvi** (regra 14).
- **Erros meus desmentidos: 2, os dois meus e os dois públicos** — o bloqueio de
  acesso que eu inventei pra Alana, e a urgência falsa que mandei ao Johnny.
- **Contradição pega antes de enviar: 1** (a oferta de treino ao Marcelo).
- Crédito tocado: **0**. GPU: **0**. Migration: **0**. Acesso: **0**.
- **Assinatura cancelada: 1**, a pedido escrito do titular (regra 9-C), conferida
  na fonte.

**O que emperrou, na cara limpa:** os dois casos param em **dinheiro que não é
meu**. A Alana precisa de um sim/não sobre 10.000 créditos; o Marcelo precisa dos
R$ 194 que pagou por um produto que nunca lhe entregou uma voz, e **perdeu a
janela esperando por nós**. Enquanto isso, os dois estão respondidos e nenhum dos
dois está esperando por mim.

**O que eu NÃO fiz:** não herdei afirmação sem medir, não mandei aluno pra tela
que ele não consegue abrir, não repeti oferta contraditória, não toquei em
crédito/acesso/migration, não gastei GPU, não fechei incidente sem resolver, não
relitiguei a regra de crédito, não li a caixa do `suporte@` pra triagem, não
toquei nos branches STALE e não afirmei que os e-mails chegaram.

---

## 5. Passo fixo de fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` vazio e `git branch` /
`git rev-list` conferidos — ver o commit desta ronda.
