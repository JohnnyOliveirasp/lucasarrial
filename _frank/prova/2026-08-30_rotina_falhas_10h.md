# Rotina das Falhas — 30/08/2026, ~10h40–11h UTC (= 07h40 BRT) — dono da fila

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia (`fa771c4`).
Índice de ordens lido antes de tocar em qualquer coisa, e a ordem de 29/08
(`2026-08-29_desligar_vigia_e_frank.md`) relida por inteiro **porque o nome dela sugere
que ela me desliga**: ela desliga as rotinas que atuam **pela planilha**, não o
atendimento a aluno. A fila de incidentes que não nasce da planilha segue minha.

Ronda anterior: **Vigia às 10h UTC** (sensor). Esta é a das falhas, como **dono**.

---

## Placar

| | |
|---|---|
| Abertos na chegada (`open`/`investigating`) | **5** |
| Abertos ao sair | **3** (`#192`, `#197`, `#198`) |
| **Incidentes que FECHEI** | **1** (`#195`, ignored) |
| Incidentes que passei pra `aguardando_aluno` | **1** (`#196`) |
| **Alunos para quem escrevi** | **2** (Tulio uid 350, Liliane uid 351) |
| Medição errada de outra ronda que corrigi | **1** (a contagem de imagens do `#196`) |
| Posts no grupo (regra 7, fato consumado) | **2** |
| Escalado ao Johnny | **1** (Telegram msg 645) |
| Código em produção | **nenhum** |
| Crédito / GPU / acesso / migration | **nada tocado** |
| Chaves de recado limpas | **1** (`para_frank_b64539e6`, por `DELETE`) |

---

## 1. `#195` (Tulio) — FECHADO: eram DUAS CONTAS, e não havia bug nenhum

Serial: peguei o mais antigo com aluno do outro lado que **não estava travado em
terceiro** (o `#192` está, ver §3) e levei até o fim.

**A premissa do chamado estava errada.** Ele dizia "assinou e os 100.000 créditos nunca
entraram". Os 100.000 **entraram** — na outra conta dele:

| conta | criada | acesso | saldo | compra |
|---|---|---|---|---|
| `tuliocanella@gmail.com` (onde ele reclamava, em `/app/credits`) | 02/08 | nenhum | 0 | nenhuma |
| `tuliocanella@hotmail.com` | 28/08 | até 04/09 | **99.475** | sim |

Mesmo nome nas duas (`Tulio Canella Bezerra Carneiro`). É o playbook **G passo 2** —
o caso "Rita" de 18/08 — e foi ele que resolveu.

**O webhook funcionou; não havia o que consertar.** `payment_events`:
`PURCHASE_APPROVED`, `buyer_email=tuliocanella@hotmail.com`, recebido 28/08 01:53:38,
`processed_at` 01:53:40, `error` **NULL**. O crédito caiu no e-mail **da compra**, que é
o comportamento correto. O que não bate é o e-mail com que ele faz login.

**Ele já tinha achado o caminho sozinho** — e isso mudou a classificação. Reclamou
30/08 01:54Z pelo gmail e às **02:49Z gerou uma imagem na conta hotmail**, gastando 525 cr
(100.000 → 99.475). Quando peguei o chamado, ele já estava usando a conta certa.

**Fechei `ignored`, não `fixed`, de propósito.** Não houve defeito nosso e não houve
conserto: marcar `fixed` inflaria a contagem de bug corrigido. Segui o critério do **#30**,
que também foi "resolvido sozinho" e foi `ignored` (o `#27` e o `#93` foram `fixed` porque
ali houve mudança/afirmação nossa a corrigir). Conferido depois de gravar: **1 linha
afetada**, relido pelo próprio `anotar_incidente`.

**Avisei o aluno** (o passo que faltava): ele estava há **~11h30** esperando **dentro do
app**, onde não há humano do outro lado. Antes do meu e-mail havia **zero** mensagem nossa
pra ele em Sent e **zero** dele no INBOX — o silêncio era real. E-mail 30/08 **10:43:56Z**,
Sent **uid 350**.

**O que deliberadamente NÃO afirmei a ele:** nada sobre situação de pagamento. A compra do
hotmail é **R$0 APPROVED** (trial) e `pagou_de_verdade` classifica como NUNCA PAGOU
(regra: `value > 0` **E** status COMPLETE/APPROVED). Ele usou a palavra "assinei"; o
registro diz trial. Não corrigi a palavra dele nem prometi renovação — não era o que ele
perguntou, e isso é decisão comercial. **Fica registrado porque tem prazo:** o acesso dele
morre em **04/09** e, pela regra do trial, depois disso ele não gasta o que sobrou.

---

## 2. `#196` (Liliane) — CORRIGI UMA MEDIÇÃO ERRADA DESTE PRÓPRIO CHAMADO

Este é o achado da ronda, e é sobre **não herdar número de nota alheia**.

### 2.1 A objeção das 10:15Z estava errada: são TRÊS imagens, não cinco

A nota do Vigia dizia: *"dissemos 'as TRÊS imagens' (são CINCO no banco, não três)"*.
**São três.** Não é briga de contagem: se eu tivesse herdado o "cinco", teria mandado à
aluna uma correção que ela **nunca conseguiria conferir na tela**, e ela voltaria
procurando duas imagens que não existem.

De onde veio o erro: `aluno.cjs` imprime **"Imagens (5 últimos)"** — é um **teto de
exibição**, não uma contagem. É a mesma armadilha do corte em 1000 linhas do PostgREST,
numa roupa nova.

O que a tabela tem: **9 linhas** em `image_generations`, todas `ready` — **6** com
`kie_model='upload'` (as **fotos que ela enviou**, em `/uploads/onboarding_*.jpg`) e
**3** com `kie_model='gpt-image-2-image-to-image'` (os **avatares gerados**,
`/images/<id>/result.png`). Bate com o extrato: **3** débitos de −525 "avatar do
onboarding". E a tela mostra 3 **por desenho**: `components/image/image-history.tsx:86`
filtra `g.kie_model !== "upload"`. O e-mail das 07:40Z falou "três" e **estava certo**.

### 2.2 Os 3 avatares existem mesmo no R2 — e o instrumento quase mentiu

Lição do `patch_9dc59356` aplicada **antes** de afirmar à aluna que a entrega existe.
`HeadObject` cru, bucket `voices-clone-ai-verse` (`BUCKETS.imagens()`):
1.921.247 / 2.048.989 / 2.033.465 bytes, todos `image/png`. **Os três abrem.**

⚠️ **Armadilha de instrumento, medida aqui.** `existe(bucket,key)` do `_comum.cjs` tem
`try { ... } catch { return false }` — ele **engole o erro**. Minha primeira rodada passou
o bucket errado (`BUCKETS` guarda **funções**, e `JSON.stringify` de objeto com função
imprime `{}`, o que escondeu o problema) e recebi `false, false, false` — que lê
**exatamente igual** a "os arquivos da aluna sumiram". Quase virou "entrega fantasma" num
relatório. **Sempre `HeadObject` cru, com `e.name`/`e.message` impressos, antes de concluir
que arquivo de aluno sumiu.**

### 2.3 O erro real do nosso e-mail das 07:40Z era outro — e nesse ponto o Vigia acertou

Mandamos ela ao **Vídeo Clone** "escolher imagem + áudio e gerar".
`videos/clone/page.tsx:47` usa `creditsTotal >= CLONE_MIN_CREDITS`; ela está com
**−11.575** e `access_until` **NULL**. Logo: **cadeado** — e como `hasActiveAccess` é
false, o CTA que aparece pra ela é "Assinar" apontando pra `/planos`. Mandamos a aluna
para uma porta trancada sem avisar. Era **isso** que ia fazer ela voltar irritada, não a
contagem das imagens.

Em compensação, **ela consegue ver as imagens**: `app/[locale]/app/images/page.tsx`
renderiza `<ImageHistory/>` nos **dois** ramos do `canGenerate` — travado ou não, o
histórico aparece. Só o **gerador** trava.

### 2.4 Pagamento: não há registro nenhum, e não acusei ninguém

`pagou_de_verdade` → NUNCA PAGOU. `payment_events` com `%liliane%`/`%sheyla%` → **zero
linhas**. Procurei **segunda conta** (o que resolveu o `#195` hoje) → **não existe**, só
homônimos de "Fonseca". Conclusão honesta: **no nosso sistema não existe compra ligada a
ela** — o que **não prova** que ela não pagou (pode ter comprado com outro e-mail ou no
"curso"). Playbook **G passo 4** manda escalar e **não prometer crédito**: pedi a ela o
e-mail da compra ou o código da transação, **sem afirmar que ela não pagou** e **sem
prometer liberação**.

E-mail 30/08 **10:51:02Z**, Sent **uid 351**. Disse o que está pronto (3 imagens + a voz de
40min), que o **vídeo clone não foi gerado e não sai sozinho**, e — de propósito — que
**hoje a conta dela não gera esse vídeo**, porque omitir isso foi o defeito do e-mail
anterior. Status → `aguardando_aluno`: a bola é dela.

**Duas correções que fiz no meu próprio rascunho antes de enviar:** eu tinha escrito "eu
ligo a compra e o acesso é liberado" (promessa que não é minha para fazer) e uma menção a
"outro aluno hoje" (informação de terceiro que não acrescentava nada). Ambas saíram.

### 2.5 Observação que NÃO virou chamado (ordem de 29/08)

`onboarding_runs` linha **539** (23/08): `ok=true` e `conta_criada=true`, mas o campo
`motivo` guarda *"Arquivo 1OczUURKZtS... tem 40MB (teto 31MB); frames: ffmpeg exit 234 ...
Output file does not contain any stream"*, com `imagens_pedidas=7`. **Run marcada OK
carregando falha de arquivo.** Isso é onboarding **da planilha**: a ordem de 29/08 proíbe
abrir chamado com causa nela e proíbe reprocessar. Fica **anotado**, sem virar incidente.
Não afirmei à aluna quantas imagens "deveriam" ter saído — não tenho certeza da semântica
de `imagens_pedidas=7` e **não invento número pra aluno**.

---

## 3. `#192` (Robert Ros) — TRAVADO, e digo em que passo

**Passo que falta: alguém OUVIR.** O pedido foi feito de verdade às **02:03Z** no grupo,
com três `.ogg` tocáveis (referência × voz real aos 30min × saída clonada) e IDs de envio
gravados no incidente. **~9h depois, ninguém respondeu.**

Não avancei um milímetro nele **de propósito**: eu não ouço, e a regra 9-D diz que veredito
de qualidade de voz não é meu. Inventar um veredito aqui seria o pior erro possível, porque
há uma promessa registrada ao aluno (00:51Z) de que a resposta viria "dando certo ou não".
Segue `investigating`. Levei o travamento ao Johnny (msg 645) em vez de deixar a sexta
ronda seguida anotar "falta ouvido humano".

---

## 4. O que ficou aberto e por quê

- **`#197`** (Natanael, cancelamento do curso) e **`#198`** (a Fast afirmou "você está
  dentro dos 7 dias" para compra de 12 dias atrás). Ambos do mesmo aluno e ambos **mais
  novos** que os que peguei. Regra 8 é serial: não abri frente nova antes de fechar as que
  peguei, e nenhum dos dois é "produção fora do ar" nem "dinheiro sendo cobrado errado
  agora" — o `#198` afirma uma frase falsa sobre reembolso, o que é grave, mas o dinheiro
  não está se movendo sozinho.
- **`#99`** (Luciano): nada técnico meu. **Garantia fecha em 02/09, faltam 3 dias**, e já
  foi escalado 3× sem resposta. Escalado de novo, com o prazo na cara.

---

## 5. Regra 7 — dois posts no grupo, só fato consumado

Via `avisar_grupo.cjs --fato`, rodado **por ssh no Hetzner** (a WAHA só escuta em
`127.0.0.1` de lá; desta máquina só sai `--seco`). Um pelo `#195` fechado, um pela resposta
à Liliane com a correção da contagem. Nenhum pede resposta, nenhum leva log de terminal.

---

## 6. Defeito de processo que confirmei (e que já tem 3 dias)

Os `para_frank_*` continuam empilhando porque o `03_ROTINA.md` (§1-B/§1-C) manda limpar com
`set_state` = null e `agent_state.value` é **NOT NULL** (o UPDATE volta `23502`). Limpei o
`para_frank_b64539e6` com **`DELETE`**, que é o que funciona. **A doc precisa passar a
dizer `DELETE`** — enquanto não disser, toda ronda "limpa" sem limpar. Não alterei a doc
nesta ronda para não misturar mudança de processo no commit do registro; fica como o
primeiro item da próxima.

---

## 7. Limites e o que eu NÃO fiz

- **Limite da minha prova, dito na cara:** `ler_caixa` só varre os **LIDOS**. Se Tulio ou
  Liliane responderam e a mensagem está não-lida (a fila de não-lidos é da Fast), eu não a
  veria.
- Não afirmei nada sobre a **tela logado como aluno** — falo do código e do dado, que é o
  que consigo provar.
- Não fechei incidente não resolvido, não reabri nada, não toquei em crédito, acesso ou
  GPU, não disparei migration, não reprocessei import, não abri chamado com causa na
  planilha e **não dei veredito sobre qualidade de voz**.
- **Não mergeei patch nenhum.** Os 3 do Vigia seguem parados e o mais velho (`patch_9dc59356`,
  ~48h — Vídeo Clone `ready` sem MP4 no R2, link 404, sem estorno) atinge aluno **e** mexe em
  dinheiro. Regra 14-B manda ler o código como segunda opinião, e ler três patches com
  convicção não cabia nesta ronda. **Sem convicção, backlog é melhor que regressão** — mas
  isso não pode envelhecer mais, e por isso está no Telegram do Johnny, não só aqui.
- `git log origin/main..HEAD` vazio na abertura; nesta ronda **não escrevi código de app**.
