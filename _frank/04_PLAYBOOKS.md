# 04 — Playbooks: o que já quebrou e como se resolve

Cada um destes já aconteceu de verdade. Se o sintoma bater, siga a receita.

---

## A. Voz parada em "enviando" (uploading)

**Sintoma:** aluno diz que enviou o áudio e nada acontece; a voz fica
"enviando" pra sempre.

**Causa:** o envio vai do navegador direto pro R2 e só **depois** o navegador
avisa o servidor (`uploads-complete`). Se a aba fecha ou a rede cai no meio,
o áudio fica lá e a linha morre. (18/08: 43 vozes assim, 19 com áudio inteiro.)

**Hoje isso se resolve sozinho** — o sweep de 5 min tem
`lib/voices/rescue-stuck-uploads.ts`. O que fazer:
1. Rode o sweep (`03_ROTINA.md`, item 4) e veja `voice_rescue`.
2. Voz com áudio ≥20 min → vira **pronta pra treinar**; o aluno clica.
3. Áudio menor → vira **rejeitada** com o motivo visível.
4. Sem áudio nenhum e com 45 min+ → a linha é apagada (é fantasma).
5. Avise o aluno por e-mail (`ferramentas/enviar_email.sh`).

**Se o aluno esperou por culpa nossa, o treino é por conta da casa** — use
`ferramentas/resgatar_voz.cjs <voiceId> --confirmar` (não cobra).

---

## B. Aluno não consegue criar voz: "já tem um treino em andamento"

**Causa:** trava por nome. Antes ela pegava também upload morto e a pessoa
ficava barrada por um fantasma. Corrigido em 84f3197 (só barra 15 min).
**Se reaparecer:** procure linha `uploading` velha com o mesmo nome.

---

## C. Treino falha com "áudio insuficiente"

**Não é bug** na maioria das vezes: o mínimo é **20 min de gravação** e
**10 min de fala limpa** (sem pausa/silêncio). Quem fala pausado manda 25 min
e rende 6.
1. Confira `voices.error_message` — a mensagem já explica.
2. O estorno é automático; confirme em `credit_transactions`.
3. Oriente: falar contínuo, ambiente silencioso, pode somar arquivos.
⚠️ Se **muitos** falharem no mesmo dia, aí sim suspeite de bug nosso.

---

## D. Geração de imagem falha com "Error while downloading"

**Causa clássica:** a linha no banco aponta pra arquivo que **não existe** no
R2 (foto fantasma) ou a URL assinada venceu.
1. Confirme com `HeadObject` no R2 se o arquivo existe.
2. Não existe → a linha é lixo; a referência do aluno
   (`profiles.image_ref_key`) pode estar apontando pra ela — troque por uma
   foto real (`ferramentas/consertar_referencia.cjs`).
3. Existe mas deu erro → provavelmente URL vencida: reassine na hora.
4. Estorno é automático; confirme.

---

## E. Vídeo (clone/React) preso em "clonando"

1. Veja o status no RunPod. `COMPLETED` → o sweep finaliza; force uma rodada.
2. Status expirado (~30 min) → veja se o `clone.mp4` chegou no bucket
   `voices-clone-ai-verse`. Chegou = terminou; siga pra montagem.
3. `FAILED`/`TIMED_OUT` → o sweep marca falha e estorna.
4. Fila longa → é capacidade de GPU, não bug (`03_ROTINA.md`, item 5).

---

## F. Montagem de vídeo falha no ffmpeg

- **Viral sem áudio**: o vídeo baixado pode não ter faixa de som e o filtro
  quebra ("matches no streams"). Já tratado — mas se voltar, cheque com
  `ffprobe` antes de montar.
- **Duração do mp3 mente**: cabeçalho VBR diz menos do que o áudio tem e o
  corte come o fim da fala. Meça **decodificando** (`ffmpeg -f null -`), não
  pelo cabeçalho.
- Ao guardar o erro no banco, guarde o **fim** da mensagem (onde está o
  stderr do ffmpeg), não o começo.

---

## G. Aluno diz que pagou e não tem crédito

Em ordem:
1. Ache o perfil pelo e-mail. Tem `entitlements`? Tem crédito?
2. **Procure outra conta da mesma pessoa** (nome, telefone da compra). Em
   18/08 a "Rita" tinha duas contas: comprou numa e reclamava da outra.
3. Procure compra órfã (`entitlements` com `user_id` nulo e e-mail parecido).
4. Nada disso → o pagamento não chegou ao nosso sistema: **escale pro
   Johnny/Lucas** conferirem na Hotmart. Não prometa crédito por conta própria.

---

## H. A Fast parou de responder e-mail

1. `POST /api/v1/agent/mail-sweep` na mão e veja o retorno.
2. `pm2 logs aiverse` procurando `[agent/mail`.
3. Causa conhecida: anexo gigante travando a leitura (corrigido com teto de
   2 MB, mas fique atento).
4. Enquanto isso, responda os alunos você mesmo pelo SMTP.

---

## I. Onboarding pela planilha veio pela metade

Sintomas: aluno com fotos e sem voz, ou avatares que falharam.
1. Veja o que ele tem: `profiles.image_ref_key`, fotos em `image_generations`
   (`kie_model = 'upload'`), voz `Minha Voz`.
2. Áudio não veio do Drive → peça pro Johnny reprocessar a linha da planilha
   (o import é idempotente) ou oriente o aluno a enviar/gravar.
3. Avatares falhados por foto fantasma → veja o playbook D.

---

## J. Como mandar e-mail pro aluno

```bash
# 1) ENSAIO — imprime destinatário, remetente, assunto e corpo SEM enviar nada:
node _frank/ferramentas/enviar_email.cjs aluno@exemplo.com "Assunto" corpo.html --dry-run
# 2) envio de verdade:
node _frank/ferramentas/enviar_email.cjs aluno@exemplo.com "Assunto" corpo.html --bcc suporte@lucasarrial.com
```
Roda da sua máquina, sem SSH (a senha está no `.env.local`). O
`enviar_email.sh` (versão do servidor) aceita a mesma flag `--dry-run`.

- **Ensaie com `--dry-run` antes de todo envio** — e-mail é irreversível:
  destinatário errado já chegou na caixa da pessoa. Confira o endereço e o
  corpo na saída do ensaio, só então rode sem a flag.
- Corpo em HTML simples, tom humano, **sem jargão**.
- Diga **o que aconteceu de verdade** e o que você já fez. Se a culpa foi
  nossa, assuma — o Johnny prefere assim.
- Termine com **um passo claro** ("é só clicar em Treinar") ou **uma pergunta
  objetiva**, nunca com um menu de opções.
- Em lote: sem `--bcc` + um resumo único no fim.
- **Teste mandando pra você mesmo antes.** E-mail não tem desfazer.

---

## L. Aluno cobrado duas vezes pela mesma coisa

**Como aparece:** um registro parado na varredura que "não faz sentido" —
foi assim que o caso do Rafael apareceu (treino queued há 38h).

**Como investigar:** some as transações de crédito daquele recurso
(`credit_transactions` filtrando por `ref_id`). Se der mais negativo que o
preço de uma unidade, ele pagou mais de uma vez.

**O julgamento (não devolva no automático):**

| Evidência | Veredito |
|---|---|
| 2 débitos + **2 entregas concluídas** | cobrança **correta** — ele treinou duas vezes de propósito |
| 2 débitos + **1 entrega**, poucos segundos/minutos de intervalo | **duplo clique** → devolver a diferença |
| Débito sem entrega nenhuma e sem estorno | falha nossa → devolver |

Em 18/08, dos 6 casos encontrados, **5 eram retreino legítimo** e só 1 era
duplo clique. Devolver os 6 teria dado 50.000 créditos de graça por engano.

**Como devolver:** RPC `add_extra_credits` com
`ref_type: "voice_train_refund"` e `ref_id` = id do recurso. Confira antes se
já não existe estorno com esse mesmo par (o estorno é idempotente por
contagem). Depois **avise o aluno por e-mail** dizendo o que houve, quanto
voltou e que a causa foi corrigida.

**A causa desse caso já está fechada** (873ed1f): a rota do treino agora
reserva a voz de forma atômica, e o botão trava por ref síncrono. Se
aparecer cobrança dupla em OUTRO fluxo, procure o mesmo padrão: rota que
apenas **lê** o status antes de agir, em vez de **virar** o status.

---

## K. Publicar uma correção

1. Edite o código (`frontend/`).
2. `npx tsc --noEmit` + `npx eslint <arquivos>`.
3. `git add <arquivos>` → commit explicando o **porquê** → `git push origin main`.
   (Correção é fix pequeno: vai **direto na main**. Feature multi-card usa
   branch — regra 5 do `01_REGRAS_DURAS.md`.)
4. Espere ~3 min e confirme que a mudança está no ar.
5. Feche o incidente e avise quem estava travado.

---

## M. Provar que um gate REALMENTE bloqueia (antes de reportar)

Nasceu em 18/08: investigando uma aluna, encontrei 147 pagantes com crédito e
`access_until` vencido e reportei que **o botão Gerar estava travado** em cinco
telas. Não estava. Em quase todas, aquela função só escolhia o **texto do
aviso**. O número que mandei era maior que o real — e o Johnny lê relatório
dirigindo, no acostamento. Errar pra mais faz ele tratar como emergência o que
não é. Custa tanto quanto errar pra menos.

**Achar o `import` não prova nada.** Import é sintoma. Prova é o ponto onde a
variável **decide**.

### O método

1. **Siga a variável até onde ela decide.** Não pare no `import` nem na
   atribuição. Vá até onde ela aparece dentro de um `if`, de um `redirect`, de
   um `disabled`, ou na expressão que escolhe **o que renderiza**.
2. **Classifique o destino.** Toda variável dessas cai em um de três lugares:
   - **Bloqueia** — `redirect(...)`, `return jsonError(..., 403)`, ou entra no
     `canFazerAlgo` que decide se o componente de trabalho aparece.
   - **Só muda a aparência** — escolhe título, corpo do texto, rótulo do botão,
     destino do link. **Não bloqueia nada.**
   - **Só passa adiante** — vira `prop` de um componente. Não terminou: vá ao
     componente e recomece o passo 1 lá dentro.
3. **Backend e frontend são portões separados.** Confira os dois, sempre:
   - Tela trancada + API aberta = bug de interface. O aluno está sendo impedido
     de algo a que tem direito.
   - Tela aberta + API trancada = o aluno clica e toma erro na cara.
   - Neste projeto, o portão da API quase sempre é **crédito**
     (`if (total < cost)`), porque crédito é o gate do produto.
4. **Leia o comentário antes de julgar o código.** Aqui os comentários levam
   **data e quem mandou** — foi feito de propósito, pra isso. Em 18/08 havia
   `// Sem assinatura = trancado (Johnny 13/08 ...)` três linhas acima do gate
   que eu ia chamar de violação de regra. Não era bug: era **ordem**, mais nova
   que a regra do meu manual. A conclusão certa era *"achei um conflito entre o
   manual e uma decisão de 13/08"*.
5. **Cite arquivo e linha, sempre.** "`hasActiveAccess` em videos/clone" não é
   prova. "`edicao/page.tsx:35` → `redirect` pro dashboard" é. Se você não
   consegue apontar a linha, você ainda não provou.

### Separe o que provou do que deduziu

No relatório, duas listas diferentes:

- **Provei:** tem linha de código, saída de comando ou número do banco atrás.
- **Suspeito:** faz sentido, encaixa na história, e **ainda não tem prova**.

Misturar os dois é o jeito mais rápido de fazer alguém tomar a decisão errada
com confiança total. Se a sua conclusão muda a vida de mais de uma pessoa,
ela pertence à primeira lista ou não sai do rascunho.

### Antes de mandar um número no relatório

Pergunte: **"o que exatamente essas N pessoas não conseguem fazer?"** Se a
resposta é "estão bloqueadas", volte ao passo 1 — você ainda não sabe. A
resposta boa tem a forma *"N pessoas não conseguem X e Y, mas continuam
conseguindo Z"*.

---

## N. Crédito: o que é dinheiro que entrou e o que não é

**Leia isto ANTES de zerar, estornar ou julgar qualquer caso de crédito.**
Levantado em 18/08 varrendo todas as transações positivas de
`credit_transactions`.

### ⚠️ A armadilha principal

**`subscription_grant | payment_event` NÃO prova pagamento.** O trial gratuito
da Hotmart gera o **mesmo** carimbo de `+100.000` que uma venda de verdade.
Confirmado nos 4 trials que a API viva marcava `trial: true`, `price 0.00`:
todos tinham `payment_event` de 100.000.

Quem usar `payment_event` como prova de pagamento monta uma trava que **não
pega ninguém do trial** — que é justamente o grupo que ela existe pra pegar.

### As origens, por volume

| kind \| ref_type | É pagamento? |
|---|---|
| `subscription_grant \| payment_event` | ⚠️ **CONTAMINADO** — mistura trial e venda |
| `extra_purchase \| stripe_session` | ✅ **SIM** — dinheiro limpo |
| `extra_purchase \| video_clone_refund` | ❌ estorno |
| `extra_purchase \| voice_train_refund` | ❌ estorno |
| `extra_purchase \| image_refund` | ❌ estorno |
| `extra_purchase \| image_video_refund` | ❌ estorno |
| `extra_purchase \| generation_refund` | ❌ estorno |
| `extra_purchase \| studio_scene_refund` | ❌ estorno |
| `extra_purchase \| support_refund` | ❌ estorno |
| `extra_purchase \| admin_grant` | ❌ concessão da casa |
| `extra_purchase \| stock_seed` | ❌ carga inicial |
| `extra_purchase \| courtesy_grant` | ❌ cortesia |
| `extra_purchase \| courtesy_test_access` | ❌ cortesia |
| `extra_purchase \| courtesy_video_clone` | ❌ cortesia |
| `extra_purchase \| bonus_cortesia` | ❌ cortesia |
| `extra_purchase \| winback` | ❌ campanha |
| `extra_purchase \| incident_apology_bonus` | ❌ desculpa por falha nossa |
| `extra_purchase \| backlog_apology_bonus` | ❌ desculpa por falha nossa |
| `extra_purchase \| compensation` | ❌ compensação |
| `campaign_bonus \| credit_campaign` | ❌ campanha |

**Saldo alto não é sinal de pagamento.** Separe sempre por origem.

### Como saber de verdade se alguém pagou

O payload do webhook da Hotmart **não tem campo `trial`** (chaves de topo:
`buyer, product, producer, purchase, affiliates, commissions, subscription`).
O que ele tem, e resolve, é o valor cobrado no próprio evento:

- `purchase.price.value > 0` → entrou dinheiro naquele evento.
- `purchase.price.value = 0` com `recurrence_number = 1` → trial.

Isso é melhor que um rótulo: cupom de 100% também vem zerado, e continua
correto, porque o que importa é caixa e não nome.

⚠️ **`entitlements.raw_event` guarda UM evento só, não o histórico.** O
`ddfleury@gmail.com` tem o evento do trial gravado (`value=0`, `rec#=1`) e
mesmo assim recebeu recarga depois. Para histórico de pagamento use
`GET /sales/history` da API da Hotmart (testado 18/08, HTTP 200), nunca o
`raw_event`.

### Contra-exemplo que mata qualquer atalho

`martinmendezagiluilar7@gmail.com` está em **trial** na Hotmart e comprou
**120.000 pelo Stripe** em 14/08. Regra do tipo "está em trial → zera"
apagaria crédito de quem pôs dinheiro. **O critério é pagamento, e só ele.**

---

## O. Aluno diz "clico e não acontece nada" (o botão mudo)

**Nasceu do caso da Viviana em 17-18/08** — o incidente que terminou em
chargeback. Custou uma cliente que pagava US$22.

**O sintoma que identifica:** o aluno não descreve um **erro**, ele descreve
**ausência**. "Presiono generar y no pasa nada", "clico e não acontece nada",
"o botão não responde". Não há mensagem, não há tela vermelha, não há nada.

**Por que é traiçoeiro:** o clique **não chega ao backend**. Logo:
- não gera erro, não abre incidente automático, não aparece em log nenhum;
- a busca por erros da conta volta **limpa**, e isso parece boa notícia;
- é invisível para toda a nossa monitoria, por construção.

⚠️ **Conta sem erro nenhum + aluno insistindo = suspeite de botão mudo**,
não de aluno confuso. A ausência de erro é a *assinatura* desse bug.

### A receita

1. **Abra a conta antes de responder qualquer coisa** (regra 11). Na Viviana,
   `voices` = **zero** aparecia na primeira consulta e explicava tudo.
2. **Vá no `disabled=` do botão da tela citada** e leia o que ele exige. Se a
   expressão tem insumo do aluno (`!image || !audio`) e **não há tooltip,
   toast nem texto**, você achou: quem não tem o insumo clica no vazio para
   sempre.
3. **Pergunte de onde vem o insumo.** O áudio do Video Clone vem de voz
   clonada **ou** de MP3 do computador. Quem não tem voz e não sabe do MP3
   fica preso permanentemente — e "permanentemente" é o que faz virar revolta.
4. **Conserte a UI, não o caso.** Botão desabilitado só durante envio/upload;
   faltando insumo, o clique **escreve o que falta**. Em todos os idiomas.
   (Feito em `b9c4c9c` para o Video Clone.)
5. **Varra as outras telas atrás do mesmo padrão** antes de fechar.

### A regra que fica

> **Botão desabilitado sem explicação é bug, não é proteção.**
> Se a interface impede alguma coisa, ela tem que dizer o quê e o que fazer.
> Bloqueio silencioso vira "o site está quebrado" na cabeça do aluno — e ele
> tem razão.

---

## P. "O fix já está pronto" não é o mesmo que "o fix está no ar"

Também de 18/08. A nota de um incidente dizia que a correção estava pronta na
branch `agent/fix-video-clone-botao-silencioso`, com commit citado e
verificação descrita. **A branch não existia no repositório** e o código
quebrado seguia em `origin/main` **6 horas depois**. O agente anterior não
conseguiu dar push (403) e o trabalho morreu na máquina dele — mas a nota
lida de fora parecia entrega feita.

**Antes de acreditar que algo foi corrigido, confirme onde importa:**

```bash
git fetch origin
git show origin/main:<caminho/do/arquivo> | grep -n "<a linha do bug>"
```

- Bug ainda visível em `origin/main` → **não foi corrigido**, independente do
  que a nota diga. Refaça.
- Branch citada não aparece em `git branch -a` → **ela não existe aqui**.
- Deploy: confirme no **servidor** (`grep` no arquivo em
  `/mnt/volume/aiverse/frontend`), não só no verde do GitHub Action.

**Mesma família do `|| 'Done.'`** (ordem `2026-08-19_done_falso.md`): trabalho
não entregue se apresentando como concluído. A diferença é que aqui quem foi
enganado foi o próximo agente — e o aluno esperou mais 6 horas por isso.

### P2. A variante que pega VOCÊ: commit seu que nunca foi empurrado

Em 19/08 caí nisto sozinho, com o playbook acima já escrito. Commitei dois
fixes do incidente `d3d8d1b2` às 21:12 e 21:16 (-04). No mesmo intervalo outra
frente empurrou 3 commits de vendas; o `git pull` abortou com *"Not possible to
fast-forward"* e **os meus ficaram parados na máquina**. Duas horas depois eu
escrevi num relatório que *"o fix está no bundle"* — porque conferi que o
**commit existia**, não que ele estava **empurrado**.

`git log` sozinho responde a pergunta errada: ele mostra o que você escreveu,
não o que está em produção. A checagem de 1 segundo, que vale pra qualquer
repositório:

```bash
git fetch origin && git log --oneline origin/main..HEAD
```

**Qualquer linha aqui = você tem código que não está em produção.** Rode isso
como último passo de toda rodada, antes de escrever qualquer frase sobre o
estado de um fix. Se voltar vazio, aí sim a frase pode ser escrita.

⚠️ **Divergência é silenciosa.** `git status` diz "ahead 3, behind 3" numa
linha que se lê como rotina, e um `git pull` que falhou no meio da rodada some
do scrollback. Não confie em ter percebido na hora.

⚠️ **E "no ar" tem uma segunda camada:** código que depende de coluna nova só
funciona depois da **migration aplicada** (regra 21). No mesmo caso, mesmo
depois do push, `delay_seconds` não existia no banco — então o fix estava no
ar e **ainda assim não media nada**. Antes de dizer que uma instrumentação
está armada, consulte a coluna no banco de verdade; DDL commitado não é DDL
aplicado.

---

## Q. O incidente parado esperando uma prova que já evaporou

Nasceu em 18/08 no incidente `d3d8d1b2` (geração de áudio estourando o
tempo). Desde **07/08**, quatro rodadas de agentes diferentes fecharam a nota
com o mesmo pedido: *"ação humana pendente: puxar os logs RunPod dos jobs X e
Y"*. Ninguém puxou, e cada rodada seguinte **reforçava o pedido** em vez de
questioná-lo. O incidente ficou **11 dias** sem andar.

Bastou testar: `GET /v2/<endpoint>/status/<jobId>` devolveu **HTTP 404 "job
not found"** nos dois endpoints, **~2h** depois da falha. O status de job do
RunPod expira em **~30 min** — está escrito no `02_ACESSOS.md` desde sempre.
Aqueles logs sumiram em 07 e 08/08, minutos depois de cada falha.

> **Ninguém falhou em executar a tarefa: a tarefa era inexecutável.**

### A regra

**Antes de anotar "aguardando X", pergunte se X ainda é obtível.** Se a prova
tem prazo de validade (status de job, URL assinada, log rotacionado, cache),
"pego depois" quase sempre significa "não vou pegar nunca" — e o incidente
vira uma sala de espera educada.

### O que fazer no lugar

1. **Teste a obtenção agora**, na rodada em que você escreveu o pedido. Um
   `curl` responde se o plano é viável ou fantasia.
2. **Se a prova expira, o plano certo é capturá-la na hora da falha**, não
   buscá-la depois. Em geral o código **já tem o dado na mão** e o descarta:
   aqui o poll recebia a resposta inteira do RunPod
   (`generations/[id]/route.ts:83`) e guardava só o texto do erro, jogando
   fora `executionTime`/`delayTime` que já existem tipados
   (`runpod/client.ts:85-91`).
3. **Se ninguém executou um pedido depois de 2 rodadas, o problema é o
   pedido.** Releia-o como suspeito, não como pendência.

### ⚠️ Ao guardar diagnóstico junto do erro, cuidado com a assinatura

A assinatura do incidente é montada **a partir do texto do erro**
(`incidents/classify.ts:87-109`). Ela normaliza números (`\d+` → `#`), UUID e
hex longo — mas **não** normaliza identificador alfanumérico curto. Enfiar
`workerId` no `error_message` faz **cada worker abrir um incidente novo**.

Isso não é hipótese: com o Errno 28 (disco cheio) o path do cache
(`/tmp/torchinductor_root/fw/…` × `…/rh/…`) mudava a cada job e a **mesma**
falha abriu **4 incidentes de "1x" cada**. Uma falha recorrente disfarçada de
quatro acidentes isolados — e cada um parecia pequeno demais pra investigar.

**Campo estruturado (coluna nova, migration com aval — regra 21) ou fora da
string que gera a assinatura. Nunca concatenado no erro.**

---

## R. Falha sem log: descobrir COMO o job morreu pelo relógio do estorno

Nasceu em 18/08 (incidente `2663506d`, vídeo clone da fcdnanda). O log do
worker já tinha expirado (playbook Q) e o erro cru do RunPod era só
`Job processing failed` — string genérica que não diz nada. Mesmo assim dá pra
descartar metade das hipóteses **sem log nenhum**, usando o que o banco já
guarda.

### A régua: quanto tempo o job levou pra morrer

O débito e o estorno automático estão em `credit_transactions` com timestamp
de milissegundo. **A diferença entre os dois é, na prática, quanto tempo o job
durou.**

```sql
-- débito e estorno do aluno na janela da falha
select created_at, amount, reason from credit_transactions
where user_id = '<id>' and created_at > '<inicio>' order by created_at;
```

Compare com **quanto tempo leva um job que dá certo** (débito → arquivo no R2,
ou débito → `status: ready`). No caso real:

| | tempo |
|---|---|
| 3 falhas | **38,0s · 36,6s · 36,2s** |
| 2 sucessos do mesmo aluno, minutos depois | **~8 min** |
| orçamento de `executionTimeout` do tier | ~41 min |

### O que cada faixa significa

- **Morte em segundos, consistente (fast-fail)** → o worker **rejeitou a
  entrada** ou quebrou no carregamento. **Descarta** OOM durante difusão,
  `executionTimeout` e fila/capacidade — nenhum dos três mata em 37s.
  Procure a causa **na entrada**, não na GPU.
- **Morte perto do teto do timeout** → hang de verdade. Aí sim é worker
  travado (foi o caso do `d3d8d1b2`).
- **Tempo variável, sem padrão** → suspeite de capacidade/concorrência.

**Consistência importa tanto quanto o valor.** 36,2–38,0s em três tentativas é
caminho de código determinístico. Falha aleatória não repete o tempo.

### O outro par de olhos: quem MAIS rodou na mesma janela

Antes de culpar "instabilidade" ou "o endpoint caiu", liste **todos** os jobs
da janela, de todos os alunos, com o sufixo do endpoint (`-e1`/`-e2`):

```js
db.from("video_clones").select("id,user_id,status,created_at,runpod_job_id,num_frames")
  .gte("created_at", ini).lte("created_at", fim).order("created_at")
```

No caso real, **3 segundos depois** da falha em `-e1` outro aluno teve `ready`
em `-e1`, e **22 segundos depois** da falha em `-e2` outro teve `ready` em
`-e2`. Isso mata "queda global" e "endpoint ruim" em uma consulta só.

### Isolando a entrada culpada

Quando o mesmo aluno falha várias vezes e depois acerta, **compare as
entradas** — o próprio aluno fez o experimento pra você:

- mesma **imagem** no sucesso e na falha → a imagem está boa;
- **áudio** diferente no sucesso → o suspeito é o áudio;
- baixe os dois arquivos e rode `ffprobe` (codec, sample rate, canais,
  bitrate) **e** compare **bytes/segundo** — é assim que se prova que um
  arquivo **não** está truncado, em vez de chutar "arquivo corrompido".

### Antes de anunciar teto de tamanho/duração

Se a falha tem número maior que o sucesso (frames, duração, chars), a
tentação é gritar "achei o teto". **Não é teto até você olhar o tier inteiro:**

```js
// maior num_frames que DEU CERTO naquele tier, nos últimos 45 dias
```

No caso real as falhas eram 1100 frames e os sucessos 1075 — parecia teto. O
tier `480p-v3` tinha **478 jobs / 4 falhas** e sucessos em **2275** frames.
Hipótese morta em uma consulta.

⚠️ **Pagine.** O Supabase corta em **1.000 linhas**; use `.range(from, from+999)`
em laço. Analisar 1.000 de 1.407 linhas sem perceber é como concluir pela
amostra errada — irmão da armadilha nº 1 do `03_ROTINA.md`.

---

## S. A barreira que não existia: confira o esquema antes de pedir aval

Nasceu em 18/08 no `d3d8d1b2`, o incidente mais antigo da casa (aberto em
30/07, 23 falhas em 45 dias). Ele passou **19 dias** parado por um encadeamento
de bloqueios — e o último deles era **imaginário**.

A rodada das 20h concluiu certo que o diagnóstico precisava ser **capturado na
hora da falha** (playbook Q) e que o `executionTime` do RunPod já chegava na
nossa mão e era descartado. Aí escreveu: *"fazer isso direito = coluna nova
(migration, aval do Johnny, regra 21)"* e deixou a binária pro Johnny.

**A coluna já existia.** `generations.elapsed_seconds`, tipada em
`db/types.ts:127`, preenchida em 2.258 sucessos e **nula em toda falha** —
porque só o caminho do sucesso escrevia nela. O trabalho era de 4 linhas, cabia
inteiro em "decida sozinho", e ficou esperando uma aprovação que nunca foi
necessária.

### A regra

> **Antes de escrever "precisa de migration", liste as colunas da tabela.**
> Uma query. Se já existe campo com a semântica certa (mesmo que hoje só seja
> preenchido num caminho), não há migration, não há aval, não há espera.

```js
const { data } = await db.from("<tabela>").select("*").limit(1);
console.log(Object.keys(data[0] || {}));
```

É irmã do playbook Q: lá a pendência era **inexecutável**, aqui era
**desnecessária**. Nos dois casos o incidente virou sala de espera educada, e
nos dois casos bastou **testar a premissa** em vez de repassá-la adiante.
Pendência herdada de outra rodada é **suspeita**, não fato.

⚠️ E ao começar a preencher um campo que antes era nulo, **procure quem lê**.
Aqui o rodapé do `voice-generator` renderiza `elapsed_seconds` para take de
**qualquer** status: preencher na falha faria o aluno ler *"gerado em 1879.6s"*
embaixo da mensagem de erro vermelha. Campo novo preenchido = varra os
consumidores antes de subir.

---

## T. O aluno repetiu: ele montou o experimento controlado de graça

Também de 18/08, e foi o que finalmente provou a causa do `d3d8d1b2`.

Quando alguém falha e **insiste**, ele costuma repetir a MESMA entrada. Isso é
um experimento controlado que você não teria como montar (repetir por conta da
casa gasta GPU e precisa de aval). **Procure a repetição antes de pedir
qualquer coisa.**

No caso real: a aluna rodou o **mesmo texto de 456 chars 5 vezes** em 37 min.
Quatro entregaram em **60-78s**; uma queimou **31min19s** e morreu no teto.

### O que a repetição prova de uma vez

| Comparação | O que morre |
|---|---|
| Mesma entrada passou e falhou | entrada ruim, tamanho, formato — **todos** |
| Mesmo endpoint entregou minutos antes | queda global, endpoint ruim, fila |
| Sucesso ~1min × falha no teto | teto apertado, capacidade, lentidão |

### A régua: compare o tempo com o TETO, não com a média

- Morte **no teto**, com o trabalho real ordens de grandeza abaixo → **hang**.
  O que determinou a duração foi o limite, não o trabalho.
- Morte em **segundos consistentes**, muito antes do teto → **fast-fail na
  entrada** (playbook R).
- Morte em tempo **proporcional ao tamanho** → aí sim o teto está apertado.

⚠️ **Antes de dizer "o teto está apertado", meça o pior sucesso REAL.** Levante
`elapsed` de todas as entregas boas da janela, paginando (o Supabase corta em
1.000). Se o teto for 4x-13x o pior sucesso de 45 dias, ele não é o problema —
e qualquer fix que mexa nele vai falhar de novo, como falharam três seguidos
neste incidente.

---

## U. Dois relógios: a métrica que parece comparável e não é

Nasceu em 18/08, corrigindo uma entrega minha da rodada anterior — e quase
custou um corte de teto que mataria geração legítima de aluno.

### O caso

O incidente d3d8d1b2 estava parado porque o log do worker expira em ~30min.
A saída foi instrumentar: gravar o tempo de execução **na hora da falha**
(commit `1c09508`), pra comparar com a distribuição dos sucessos e separar
**HANG do worker** de **COLD START**.

O plano estava certo. A comparação, não:

| Caminho | Fonte | O que mede de verdade |
|---|---|---|
| Sucesso | `out.elapsed_s` → `lib/generations/finalize.ts` | relógio **interno do worker** |
| Falha | `executionTime` do RunPod | relógio **da plataforma** |

No `handler.py`, o `t0 = time.monotonic()` é setado **depois** de
`_ensure_model_downloaded()` e `VoxCPM.from_pretrained(...)`. A série histórica
mede **só o loop de inferência**, com o modelo já baixado e já na VRAM: ela
**exclui o cold start inteiro**. O `executionTime` da plataforma **inclui**.

Resultado: comparar os dois daria **falso "HANG"** — e cold start era
justamente a única hipótese que ninguém tinha conseguido matar.

### A regra

> **Duas medidas com o mesmo nome e a mesma unidade não são a mesma medida.**
> Antes de comparar, ache o ponto exato onde cada relógio **começa** e onde
> **para**. Segundo é segundo; começar depois de carregar o modelo não é.

E o corolário que dói mais:

> **Nunca corte um teto usando um número que não cobre o mesmo trabalho que o
> teto cobre.** "Pior sucesso real = 7,7min" era o pior tempo de *inferência*,
> não de *job*. Cortar o teto de 30min com esse número mataria job legítimo em
> worker frio.

### Como checar (3 minutos, e evita o estrago)

1. Ache **todo** lugar que escreve a coluna: `grep -rn "<coluna>" src/`.
   Se houver mais de um, desconfie: provavelmente são fontes diferentes.
2. Pra cada fonte, ache o **início do cronômetro** no código que a produz
   (no worker: onde está o `t0`, e o que roda **antes** dele).
3. **Meça a cobertura**, não só o valor:
   `total` vs `total com a coluna preenchida`. Se faltar pedaço, veja se o
   buraco é **temporal** (coluna nova, inofensivo) ou **constante todo dia**
   (caminho de código — e aí a amostra é enviesada por um mecanismo que você
   ainda não conhece). No caso: 78,4% de cobertura, com 20-25% faltando em
   **todos** os 45 dias.

### O que ainda vale quando os relógios não batem

Não jogue a instrumentação fora — **valor extremo continua conclusivo**.
Falha que queima o teto inteiro (~30min) é hang com certeza: nenhum cold start
plausível leva 30 minutos. O que se perde é a discriminação **fina** (uma falha
em 8-15min fica ambígua). E continua valendo o relógio do estorno (playbook R),
que é indireto mas honesto.

### Ao consertar

Se precisar do mesmo relógio nos dois lados, **não sobrescreva a coluna
existente**: ela já carrega a série histórica no relógio antigo e normalmente
alimenta alguma tela ("gerado em Xs"). Trocar o significado corrompe o
histórico e infla o número mostrado ao aluno. Coluna nova = migration = aval do
Johnny (regra 21).

## V. "Job processing failed" no Vídeo Clone: meça o áudio antes de teorizar

Nasceu em 18/08 (fcdnanda, 3 falhas em 3 min, `2663506d`). O worker
InfiniteTalk morre **sem erro estruturado** por várias causas diferentes e
todas chegam como a mesma string genérica `Job processing failed`. Ela não
distingue nada — quem tenta diagnosticar pela mensagem inventa.

**A entrada é barata de periciar e mata a maioria das hipóteses em 2 minutos.**
Faça isso ANTES de olhar GPU, capacidade, frames ou código.

### A receita

1. Pegue `audio_path` e `image_path` das falhas **e dos sucessos vizinhos** do
   mesmo aluno (`video_clones`, mesma conta, mesmo dia).
2. Baixe os áudios do R2 — bucket **`generations-ai-verse-clone`** (o
   `video-clone/uploads/` NÃO está no bucket de vozes nem no do worker; head
   nos três antes de concluir que sumiu).
3. Meça cada um:

```bash
ffmpeg -hide_banner -nostats -i a.mp3 -af astats=measure_perchannel=none -f null - 2>&1 | grep "Peak level"
ffmpeg -hide_banner -i a.mp3 -af silencedetect=noise=-50dB:d=0.3 -f null - 2>&1 | grep silence
ffmpeg -v warning -err_detect explode -i a.mp3 -f null -    # corrupção (causa do db17c668)
```

| Sintoma | Significa |
|---|---|
| `Peak level dB: -inf` + silêncio cobrindo o arquivo todo | **áudio mudo** — erro do usuário, `ignored` |
| erro no `-err_detect explode` | **MP3 corrompido** — família do `db17c668` |
| decodifica limpo, com sinal | a entrada está boa; a causa é outra |

### As armadilhas que já me pegaram nessa investigação

- **Compare com o sucesso do lado.** Se um job que **deu certo** usou a *mesma
  imagem* que os que falharam, a imagem está inocente — e o aluno montou esse
  experimento de graça (playbook T). Isso sozinho já elimina metade das
  hipóteses.
- **Cheque o endpoint no MINUTO da falha, não no dia.** Outro aluno `ready`
  um segundo depois mata "capacidade/GPU" sem precisar de log do RunPod.
- **Faixa de `num_frames` com taxa alta costuma ser contaminação.** A faixa
  1050–1075 aparecia com 36,8% de falha e era **uma pessoa só** numa única
  rajada. Sempre quebre a faixa por aluno antes de acreditar. Base real: >1000
  frames falha 4,2% contra 3,8% geral, e já houve sucesso com 2.275 frames.
- **Não herde a causa do incidente irmão.** A assinatura igual me fez começar
  pela hipótese "MP3 corrompido" (a causa fechada do `db17c668`). Era a mais
  atraente e estava errada — o arquivo decodificava perfeito.
- ⚠️ **Valide o próprio script antes de acreditar nele.** O meu imprimiu
  `ERRO_DECODE` nas 54 falhas, inclusive num arquivo que eu já sabia que
  decodificava — era `execFileSync` lendo `stderr` só no `catch`, não dado.
  O `astats` do ffmpeg escreve em **stderr mesmo quando dá certo**; use
  `spawnSync` e leia `stderr` sempre. Uma saída uniforme demais ("todos
  falharam") é sinal de bug seu, não de epidemia.

### Se for áudio mudo

Status **`ignored`** (origem é o arquivo do usuário — regra 14), mesma classe
de `8d370ef5` e `57d360e4`. Mas confira o outro lado: **o produto deixou
passar?** Se cobrou crédito e queimou GPU com um arquivo sem som, isso é
lacuna nossa e vira card separado — o treino de voz já barra desde
`f9f882a`/`ingest.ts`; o Vídeo Clone não barrava (card `4c82f566`).

**Limiar seguro: pico < −60 dBFS.** Medido em 18/08: 60 sucessos têm pico
mínimo de −19,09 dB e nenhum abaixo de −60 dB; das 54 falhas, só as 3 mudas
davam `-inf`. São 40 dB de folga.
⚠️ **Falso positivo é pior que o bug**: barrar áudio legítimo impede um
pagante de gerar, enquanto o bug ao menos estorna. Barre só silêncio
inequívoco e, se a medição falhar, **deixe passar**.

---

## W. Os dois zeros mentirosos: quando "está limpo" é bug seu

O `03_ROTINA.md` já ensina o zero mentiroso clássico: **consulta que erra volta
vazia**, e a defesa é checar o `error` antes de acreditar. Em 19/08 levei duas
mentiras que **passam por baixo dessa defesa**, porque em nenhuma das duas
existe erro para checar. Ficam aqui as duas.

### W1. Filtro em JavaScript sobre coluna que não existe

Puxei `select("*")` dos incidentes e filtrei **no JS**:

```js
inc.filter(i => i.updated_at && i.updated_at >= "2026-08-18")   // 0 resultados
```

Resultado: **"0 incidentes fechados hoje"**. A verdade eram **5**. A tabela não
tem `updated_at` — o campo é `resolved_at`. Em JS isso é `undefined`, o
`&&` corta, o filtro devolve `[]` e **ninguém reclama**: não houve erro de
consulta, porque a consulta foi `*` e veio inteira. A trava do `error` não
protege aqui.

**A defesa:** antes de filtrar por um campo, **imprima as colunas que voltaram**
e confirme que o nome existe.

```js
const { data, error } = await db.from("incidents").select("*").limit(1);
if (error) throw error;
console.log("COLUNAS:", Object.keys(data[0]).join(", "));
```

Custa uma consulta. Se eu tivesse pulado, o relatório da noite diria "dia sem
fechamento nenhum" num dia em que fechei 5 incidentes.

> Regra curta: **zero que confirma o que você já esperava merece uma segunda
> consulta.** Foi por esperar "dia calmo" que quase publiquei o zero.

### W2. Marcador de deploy que é comentário

Pra provar que um fix subiu (playbook P), grepei o bundle por uma string do
diff — e deu **0 arquivos**. Ia reportar "não subiu". A string só existia num
**comentário** do `.ts`, e o minificador apaga comentário. O fix estava no ar.

**Marcador de deploy tem que sobreviver ao build.** Em ordem de confiança:

| Marcador | Serve? |
|---|---|
| Texto de UI / chave de i18n (`"Escolha uma foto"`, `errors.audioMudo`) | ✅ o melhor |
| Literal usado em lógica (`"SUBSCRIPTION_CANCELLATION"`) | ✅ |
| Nome de coluna do banco (`elapsed_seconds`, `delayTime`) | ✅ |
| Nome de função exportada | ⚠️ mangla no minificador |
| Comentário, JSDoc, nome de arquivo `.ts` | ❌ some no build |

E lembre que **cliente e servidor moram em pastas diferentes**: componente vai
pro `.next/static`, rota de API vai pro `.next/server`. Grepar só um dos dois
dá zero e parece prova.

### O que as duas têm em comum

Nas duas o sistema respondeu **exatamente o que eu perguntei** — a pergunta é
que estava errada. Erro de consulta o script pega; **pergunta errada, não.**
Quando o resultado for um zero que fecha o dia, gaste 30 segundos provando que
a pergunta era possível de responder com "não-zero".

---

## X. Número do nosso banco não prova assinatura — pergunte pra fonte

Nasceu em 19/08, matando o "problema mais grave aberto" da véspera.

`prova_raio.cjs` contava *pagante com crédito e sem acesso* olhando só o nosso
banco: `entitlements.status='active'` + saldo > 0 + `access_until` vencido.
Deu **147** em 18/08 e **68** em 19/08. Conferido na Hotmart um por um:
**0 eram pagantes trancados.** 22 tinham cancelado, 25 estavam inadimplentes,
1 era trial que nunca pagou, e **20 eram só a virada das 12:00**.

### As três armadilhas

1. **`status` da linha ≠ status da assinatura.** Ninguém volta no
   `entitlements` pra escrever `cancelled` quando a pessoa sai. `active` ali
   quer dizer "essa linha foi criada", não "essa pessoa paga hoje".
2. **`raw_event` é uma foto do último webhook.** `subscription.status=ACTIVE`
   é o status **naquele dia**. Um aluno tinha ACTIVE guardado e, na Hotmart,
   a cobrança do mês em `WAITING_PAYMENT`.
3. **Métrica que vence à meia-noite (ou ao meio-dia) mede o lote, não o
   problema.** `access_until` recebe a data da **próxima cobrança**, então
   todo dia às 12:00 UTC um lote inteiro vence no mesmo segundo em que a
   cobrança fica devida. Essa gente não está travada, está **na fronteira**.
   Se a sua métrica balança 2x de um dia pro outro, desconfie dela antes de
   desconfiar do sistema.

### A regra

**Quem paga é a Hotmart que sabe.** A prova é o histórico de cobranças:
`GET /subscriptions/{code}/purchases` — última recorrência `APPROVED` ou
`COMPLETE` + acesso vencido = aí sim é bug nosso e é dinheiro.

Ferramenta pronta: **`ferramentas/pagante_trancado.cjs`** (use na varredura no
lugar do `prova_raio.cjs`). Ela separa vítima de fronteira e **diz quantos não
conseguiu provar** — desconfie de qualquer conta que não faça isso.

### Dois detalhes que custam caro

- **`/purchases` devolve ARRAY PURO**, não `{items:[...]}`. Ler `.items` traz
  `undefined`, todo mundo cai em "sem cobrança" e o script imprime
  **"0 pagantes trancados"** com confiança total. É o playbook W de novo, e eu
  caí nele em 19/08. Só peguei porque uma saída crua anterior contradizia o
  classificador. **Quando duas saídas suas discordam, a errada é a mais
  bonitinha.**
- A Hotmart usa **`APPROVED` e `COMPLETE`** pra pagamento aprovado. Filtrar só
  `APPROVED` esconde justamente quem pagou.

### Antes de chamar um número de "problema mais grave aberto"

Pergunte: *"eu consigo apontar UMA pessoa que pagou e está sem acesso?"*
Se não consegue nomear ninguém, você tem um **número**, não um **problema**.

---

## N. Para quem vai cada incidente (o roteamento)

Pergunta do Johnny em 19/08, olhando a fila parada: *"quem resolve? o Frank
precisa resolver, ou me avisar que preciso agir, ou avisar alguém pra ouvir um
áudio — como os e-mails de admin, né?"*. Exatamente. **Incidente que você não
resolve não fica parado: ele vai para alguém, com nome.**

| Tipo | Quem resolve | Como |
|---|---|---|
| Tem playbook (voz travada, imagem falha, vídeo preso, cobrança dupla, onboarding) | **você** | aplica a receita, fecha com nota, avisa o aluno |
| Técnico sem playbook (upload quebrado, erro novo) | **você investiga** | achou a causa → corrige e publica. Não achou em 24h → escala pro Johnny com o que já descartou |
| **Precisa de ouvido ou olho humano** (voz "sem entonação", áudio cortado, imagem feia) | **um humano** | você **não julga qualidade** — manda e-mail pros admins com link direto do arquivo, o aluno, e o que você já conferiu |
| **Dinheiro e comercial** (reembolso, bônus, cancelamento, desconto) | **o Johnny** | você acolhe o aluno, **não promete nada**, e manda a pergunta binária |
| Erro do próprio usuário | **você** | `ignored` com a nota explicando + orienta o aluno |

### ⚠️ Orientar aluno NÃO é escalar

Ordem do Johnny em 19/08: *"isto ele precisa orientar a pessoa
automaticamente, sem que eu tenha de ver"*.

Muita coisa que chega como "escalação" não é falha nenhuma — é gente que não
sabe onde clicar. **Isso é seu, e você resolve sozinho, sem passar por
ninguém.** O caso do Itamar (19/08): ele mandou fotos por e-mail pra criar o
clone e a mensagem de 13 MB não pôde ser aberta. Não havia nada quebrado — a
conta dele tinha 4 vozes prontas e 3 clones. Faltava dizer onde enviar a foto.

Antes de tratar como problema, **olhe a conta**: se está tudo funcionando,
escreva o passo a passo e feche o incidente com a nota. Não escale, não peça
decisão, não deixe parado.

O que sobe pro Johnny é o que está na tabela: **dinheiro, comercial e
qualidade que precisa de ouvido humano.** Orientação nunca.

### A regra que fecha o buraco

> **Nenhum incidente pode ficar `investigating` sem dono e sem nota.**
> Se você olhou e não é seu, escreva **para quem foi** e **quando**. Sem isso,
> `investigating` é indistinguível de "ninguém olhou" — e foi assim que a
> Josilene esperou de 23/07 a 18/08.

### Qualidade de áudio/imagem: por que não é você

Você não ouve o áudio nem enxerga a imagem. Já aconteceu duas vezes de o
veredito humano ser o oposto do técnico: a **Claudia** ("voz sem entonação" —
a voz estava excelente, o tom vinha do material) e a cura de referência que
**piorou** e foi revertida. Nos dois casos, quem decidiu foi um ouvido.

Então, nesses casos, monte o e-mail para os admins com:

- quem é o aluno e o que ele descreveu, **com as palavras dele**;
- **o link direto** do arquivo (URL assinada) — sem isso ninguém vai atrás;
- o que você já conferiu (o treino terminou? o material de referência estava
  bom? houve estorno?);
- e **a pergunta objetiva**: "isto está aceitável?".

### O caminho é o GRUPO, não o e-mail (19/08)

O Johnny pôs a **Carol** no grupo **FASTCLONER - Suporte**. E-mail pra admin
ninguém lê na hora; no grupo alguém olha. Então use:

```
node _frank/ferramentas/avisar_grupo.cjs --seco   --aluno maria@exemplo.com   --assunto "Voz saindo com letras cortadas"   --conferi "o texto de 30 letras gerou 0,4s — impossível; sem falha registrada"   --link "<URL assinada, 24h>"   --pergunta "alguém consegue ouvir e confirmar?"   --incidente ce6e157d
```

Rode **sempre com `--seco` primeiro** e leia o que vai sair. Sem `--seco` a
mensagem vai pro grupo — e mensagem no grupo não tem desfazer.

⚠️ A WAHA só escuta em `127.0.0.1` no servidor: da sua máquina o `--seco`
funciona, o envio real precisa ser disparado de lá.

**Regras da mensagem:**
- **A pergunta é obrigatória.** Recado sem pedido claro é mensagem que todo
  mundo lê e ninguém responde.
- **Link assinado sempre**, senão ninguém vai atrás e o caso morre no grupo.
- **Traga o que você já mediu.** "0,4s para 30 letras" faz a pessoa abrir; "a
  aluna reclamou da voz" não faz.
- **Grupo é da equipe.** Aluno continua sendo pelo `enviar_email.cjs`.

E lembre: a Carol só fala no grupo **quando chamam ela pelo nome** — o
burburinho normal não a acorda.

Depois disso, o incidente fica `investigating` **com a nota dizendo que foi
para o grupo e quando**. Ele volta a ser seu quando a resposta chegar.
