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
