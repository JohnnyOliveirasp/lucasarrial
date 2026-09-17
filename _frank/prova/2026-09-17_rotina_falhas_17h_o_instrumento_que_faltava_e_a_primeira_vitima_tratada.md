# Ronda das falhas — 17/09/2026, ~17hZ (14h BRT)

Dono da fila (14-A). **Estornei 1.320 cr e escrevi pro aluno.** Não fechei
incidente: o `#439` segue `investigating` porque o defeito segue no ar.

Ordens lidas antes de tocar em qualquer coisa: `_frank/ordens/README.md`, a de
**29/08** (planilha desligada) e a de **31/08** (canal). **Nada da planilha foi
lido, escrito, classificado ou reprocessado.** Aviso no **grupo**, com
`notify-grupo.sh`.

Patches do Vigia esperando revisão (§1-B, vem antes do resto): **0**.

Fila: **88 abertos** (medido, contra 85 às 16hZ). A cabeça segue travada em
decisão que não é minha; o item continua sendo o `#439`, pelo mesmo motivo
registrado às 16hZ — ele é o bloqueio declarado do `#296`, que é o mais velho
que eu posso tocar.

---

## 1. A dívida de três rondas foi paga: o QA VIU A TELA

Às 16hZ eu escrevi que a pergunta que decidia o `#439` **não tinha resposta no
banco**, porque a casa não grava se o aviso apareceu. Deixei card `40c21ef4`
pro `qa` com regra dura (não tocar em produção, não logar em conta de aluno,
não disparar animação). **Ele entregou, e o veredito é do que ele viu.**

**Em mobile 390×844, no cenário mais comum — vídeo já carregado — o aviso nasce
FORA DA VIEWPORT.** Player + "Baixar vídeo" + os 3 cards de tier + textarea
enchem a tela; ao clicar "Gerar de novo", só o **título** do aviso raspa o
rodapé, e o corpo do texto mais os dois botões ficam **totalmente fora, sem
rolar**. Sem `video_url` (presign falhou, sem player) o aviso inteiro cabe e
passa.

O QA foi honesto sobre o alcance da própria medição, e isso importa: ele montou
o painel **isolado** numa rota temporária, e no app real ainda existe o card da
imagem (thumbnail + nome + botões) **acima** dele. **O que ele mediu é um piso
otimista** — na tela de verdade fica igual ou pior.

O que passou com folga: a lógica de proteção (primeiro clique não despacha —
zero requisição pra `/api/v1/images/*/video` em 4 cenários), o contraste
(7,15:1 no título, 18,95:1 no corpo, medido por computed style e não a olho) e a
frase que substitui o botão quando não há `video_url`.

**Tradução:** a proteção que está em produção **não protege no mobile**, que é
onde a maior parte dos 195 afetados acessa. Das três histórias que às 16hZ eram
indistinguíveis, a segunda ("o aviso não apareceu") deixou de ser hipótese e
ganhou **mecanismo**.

---

## 2. Re-medi, e agora com denominador

Re-medi em vez de reusar o número de duas horas antes — mesma razão de sempre:
*um número certo na janela errada é só outro jeito de não ter olhado.* Último
evento do razão: **16:37:25Z**.

| | despachos | créditos | alunos |
|---|---|---|---|
| **bruto** | **451** | **1.122.940** | **195** |
| **líquido de estorno** | **398** | **1.010.200** | **183** |

Janela: **11/07 13:40Z → 17/09 14:30:37Z**. Estorno conferido por **`ref_type`
casado com `ref_id`**, nos **dois** nomes (`image_video_refund` e
`generation_refund`), **nunca por `kind`** — a armadilha de 20/08 que quase
pagou 13 alunos em dobro. Paginei de 1000 em 1000: são 2.310 despachos, o teto
teria cortado e mentido.

**O que faltava nas rondas anteriores era o denominador.** "Nenhum sobrescrito
novo" não é notícia se não houver tráfego. Então medi a base dos 7 dias
anteriores ao conserto (277 despachos, 54 sobrescritos → 1,65 despachos/h e
0,321 sobrescritos/h) e comparei:

| na janela de 2,74 h em que o conserto ficou no ar | esperado | observado |
|---|---|---|
| despachos `image_video` | 4,5 | **7** (2 alunos) |
| sobrescritos | 0,88 | **1** |

**O tráfego foi normal — acima da base, até.** O silêncio não é falta de gente.
E **1 observado contra 0,88 esperados é efeito nenhum que dê pra detectar.**

Sendo justo com o número: `n` esperado de 0,88 é pequeno demais pra **cravar**
que o conserto falhou. O que eu afirmo é mais modesto e mais útil: **ele não tem
efeito detectável, e o mecanismo que o QA achou explica exatamente por que não
teria.** As duas medições concordam, e nenhuma das duas sozinha bastava.

---

## 3. A vítima das 14:30 foi tratada

Não deixei mais uma pessoa virar linha de tabela.

**`tonimekautocenter@gmail.com`** (Tonimek Auto Center, `plan pro`, acesso
Hotmart até 24/09 — e **registro de novo que 24/09 é data de RENOVAÇÃO, não de
vencimento**, porque ler esse campo como prazo fez a casa inventar urgência pra
Leonice em 07/09). Conta criada **hoje, 12:04**. Era o **primeiro dia de uso
dele**.

Imagem `ccc7f4fe`: dois despachos de 1.320 cr às **14:30:37,7Z** e
**14:32:11,2Z** (94 s), a row ficou com **um** `video_kie_task_id`,
`video_status=ready`, e **zero estorno** no razão.

**Estornei 1.320 cr** pelo caminho de produção — RPC `add_extra_credits`,
`ref_type='image_video_refund'`, `ref_id` = id da imagem, o mesmo que
`video-sync.ts:129` usa quando a casa estorna sozinha. Insert na mão não
atualiza saldo e criaria extrato que não bate. **Conferi no banco, não na fala
da RPC:** 1 linha, `kind=extra_purchase` (exatamente a armadilha), saldo
**72.790 → 74.110**, delta 1.320. A ferramenta aborta se a releitura não
confirmar.

Autoridade: **9-B** — estorno de falha nossa até 20.000 cr/caso é meu, sozinho.
Somei o **dia inteiro do banco** antes de creditar, como a regra manda
(4.183 cr devolvidos hoje contra teto de 100.000).

**O estorno está certo nos DOIS ramos possíveis**, e é por isso que eu não
precisei resolver a ambiguidade das 16hZ pra fazer a coisa certa:

- se o primeiro vídeo estava `ready`, **nós destruímos um vídeo pago**;
- se ele falhou, **nós nunca estornamos**.

Nos dois casos ele pagou 2.640 e ficou com um vídeo. A dúvida era sobre a
**causa**, não sobre a **dívida** — e eu estava tratando as duas como se fossem
a mesma coisa.

**Escrevi pra ele** (chave `439-video-sobrescrito-estorno`, cópia confirmada nos
enviados, uid 2663): o que aconteceu, que o defeito é nosso e não erro dele, que
o crédito já voltou sem ele precisar pedir, e **como se proteger enquanto o
defeito vive** — baixar o vídeo antes de gerar de novo, ou animar a partir de
uma imagem nova. Não prometi data de conserto, porque não controlo a data.

Decisão individual, caso que eu estou tratando: **regra 8**, eu decido sozinho.

---

## 4. O que esta ronda NÃO resolve

1. **O defeito continua no ar.** A key segue por ID da imagem. Sem a DDL
   aplicada e o código no ar, a próxima animação apaga a anterior.
2. **A DDL `ed78a78`** (`video_paths_anteriores`, uma coluna aditiva, sem
   índice, sem backfill) segue **commitada e não aplicada**, esperando o "pode".
   O QA de hoje **aumenta a urgência dela**: a mitigação que a casa subiu como
   paliativo não mitiga no mobile.
3. **O estorno agregado** dos 1.010.200 cr líquidos (183 alunos) segue alçada do
   Johnny. Passa **10× o teto de 100k/dia** da 9-B — e a própria regra diz que
   quando o teto diário bate a resposta **não é devolver mais, é parar**, porque
   devolver em massa é sintoma de bug vivo. Tratei **um** caso, o de hoje, dentro
   da minha alçada; não tratei os outros 182 de propósito.
4. **Os 451 não têm de onde voltar.** A row guardava um `video_kie_task_id` só,
   sobrescrito junto: nem pela API do provedor dá pra reconsultar. **O defeito
   destruiu a própria prova.**
5. **O `#296`** (Leonice) segue travado no mesmo par: `#439` em produção + o
   dinheiro dela decidido.
6. **Card `31d4b753`** pro `coder` (aviso visível no mobile) estava **rodando**
   quando fechei esta ronda. Não declaro PR nem merge que eu não vi.

---

## 5. O que eu NÃO fiz

Não apliquei DDL. Não mergeei nada. Não mexi em acesso, entitlement, plano nem
assinatura. Não tirei crédito de ninguém (9-A: o lado que tira nunca é meu).
Não gastei GPU e não disparei animação. Não mandei e-mail em massa. Não li a
caixa do `suporte@` pra triagem. Não toquei em nada da planilha. Não mergeei
branch stale do origin — nem `feat/onedrive-401`, nem
`feat/fix-image-upload-retry`, nem
`fix/referencia-fronteira-de-frase-por-palavra`, nem
`feat/fabricar-referencia-fronteira-por-palavra`.

---

## 6. Lição

**Eu estava tratando "não sei a causa" como se fosse "não sei o que devo".**

Às 16hZ eu não escrevi pro aluno, e a frase que usei pra justificar era boa:
*quando o instrumento não existe, a resposta honesta é "não sei", não a hipótese
mais conveniente.* Ela continua certa **sobre a causa**. O erro foi deixar ela
decidir a **dívida** também.

Porque a dívida não dependia da causa. Ready ou failed, consentido ou não, o
extrato dizia a mesma coisa: **pagou dois, levou um.** Eu tinha esse número às
16hZ e ficou uma hora parado, porque eu estava esperando saber *por quê* pra
decidir *o quê* — e essas duas perguntas nunca foram a mesma.

O jeito de não repetir é a pergunta que eu não fiz: **"a decisão muda de acordo
com a resposta que falta?"** Se sim, investigue antes de agir. Se não, aja —
porque o que sobra não é prudência, é o aluno pagando a minha incerteza.

E tem um segundo pedaço, do §2. Às 16hZ eu tinha dois números (451 → 451, +1
depois do conserto) e nenhum dos dois julgava o conserto, porque faltava o
**denominador**. "Nada aconteceu" e "ninguém tentou" são a mesma linha no banco,
igual as três histórias das 16hZ eram a mesma linha. A cura é a mesma e é
barata: **medir a base antes de comemorar o silêncio.** Sete despachos onde a
base previa 4,5 é o que transforma "não vi nada" em "olhei e não tinha efeito".
