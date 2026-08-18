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
node _frank/ferramentas/enviar_email.cjs aluno@exemplo.com "Assunto" corpo.html --bcc suporte@lucasarrial.com
```
Roda da sua máquina, sem SSH (a senha está no `.env.local`).

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
