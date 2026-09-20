# Ronda das falhas — 20/09, ~15h40–16h30Z (Frank)

Item serial: **#371 / `23f8123d`** (Alice Silveira, `alicearnaldo@gmail.com`) —
**7,0 dias sem ninguém encostar**, o mais antigo por data de criação entre os
intocados. Levado até onde dava pela regra 8. **Não fechado** — o conserto não
está no ar, e fechar agora seria `fixed` sem resolver (regra 14).

O achado da ronda: **o placar que reprovou o conserto em 13/09 foi medido
contra um gabarito errado**, e foi isso que deixou o fix 7 dias parado enquanto
o defeito barrava **20 alunos**. Detalhe no §3.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — mensagem no **grupo**
(`notify-grupo.sh`). Nada no privado do Johnny.

## Placar

- Fila: **89 abertos** no início da ronda (era 88 no fim da ronda das 14h30: +1).
- Fechados `fixed`: **0** — e isto é o resultado honesto, não omissão (§6).
- Alunos respondidos: **1** (Alice, Enviados uid 3022).
- Crédito devolvido: **0** — não havia nada a devolver (§4).
- Passo fixo dos envios: **853 lidas, 0 carta fora da tabela** depois do corte.
- Percepção travada: **1** pelo instrumento (falso positivo conhecido) · **15**
  pela consulta crua da ordem de 17/09.
- Pagante trancado: **0** · fronteira **0** · sem prova **1**.
- Cartões abertos: **2** (`9c2f6751` para o `coder`; `98b9b30f` desta ronda).

---

## 0. Passos fixos, antes de qualquer coisa

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **853**
cartas lidas da pasta `Sent`, 776 já tinham linha, 77 fora da janela do corte,
**0 escrituráveis, 0 recusadas**. A contagem fecha (853 = 853).

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

(Ronda das 14h30: 848 lidas / 771 com linha. **+5 cartas, todas já com linha.**)

As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão, como o README manda.

**Percepção travada**, os dois números, sem escolher o menor: instrumento **1**,
SQL cru **15**. O único do instrumento é o **#450**, e ele é **falso positivo
conhecido** — a própria nota dele, de 18/09, diz "NÃO é caso de percepção; o
`percepcao_travada.cjs` casou este cartão pelo texto". O casador continua
re-levantando um cartão que já foi declarado fora da classe. Registro sem
consertar o casador (não é item desta ronda).

---

## 1. Por que este cartão

Ranqueei os abertos com aluno afetado por **"há quanto tempo ninguém encosta"**
(data da última nota), que é a prática firmada em 14/09 — idade bruta põe no
topo os cartões travados em decisão do Johnny.

O topo era o `86de22c6` (Simone, 7,7d), **lido e descartado de propósito**: a
ronda das 14h30 já o documentou como bloqueio declarado e legítimo (devolução é
da equipe da Liz; a conta não é enxergada pela nossa API; a aluna foi respondida
com a verdade em 12/09). Mexer ali seria fingir movimento.

Empate em 7,0d entre `0d18df31` (nome do SGP, 2 alunos) e `23f8123d` (Alice, 1
aluno). Peguei o **`23f8123d`**: é o mais antigo **por data de criação** (12/09
contra 13/09), tem aluna nomeada barrada do produto, e caía na classe de
percepção da ordem de 17/09 — que manda despachar na mesma rodada.

---

## 2. O defeito está vivo em produção, e agora tem tamanho

Conferido **no fonte da main hoje**, não em nota herdada:
`frontend/src/lib/video-clone/face-gate.ts` não manda `temperature` no corpo da
chamada (linhas 70-71 têm `model` e `max_tokens`, e só). O default da API é
**1.0**. A loteria medida em 13/09 **continua no ar**, 7 dias depois: um
classificador binário que decide se o aluno pode usar um produto pago está
sorteando.

Em 13/09 ninguém conseguia medir o tamanho disso, porque a recusa não deixava
rastro. **Agora deixa** — a tabela `face_gate_recusas` nasceu com o #372
(commit `e3b67466`, migration 108 aplicada em 13/09). Medido nesta ronda:

| | |
|---|---|
| recusas | **31** |
| alunos distintos | **20** |
| janela | 15/09 → 19/09 |

Por dia (recusas/alunos): `15/09 8/7 · 16/09 5/4 · 17/09 3/3 · 18/09 6/5 ·
19/09 9/4`.

**Isto deixou de ser o caso de uma aluna.** São ~4 alunos por dia batendo na
parede, e o número só existe a partir de 15/09 porque antes disso o rastro não
existia — o período 13–15/09 é invisível, não vazio.

---

## 3. O achado: o conserto foi reprovado por um gabarito errado

O branch `origin/feat/371-gate-deterministico` (commit `d3824d1`,
`face-gate.ts` +53/-3) foi empurrado em 13/09 11:45Z e **segue sem PR**.
Re-medido hoje, não herdado: `gh pr list --state all --limit 400` filtrado por
`371`/`determinismo` devolve **vazio** — nem aberto, nem fechado, nem mergeado.
O branch continua no origin (`git ls-remote` confirma).

Li o diff inteiro. Ele faz duas coisas, e as duas são boas: `temperature: 0`, e
reescreve o SYSTEM **separando pose da cabeça de direção do olhar**, tirando a
ancoragem do exemplo único que fazia o modelo repetir "olhando para baixo".

**Por que ele nunca subiu:** a nota de 13/09 11:46Z registrou *"7 de 14 casos
batem com o esperado, 7 divergem — e os 7 que divergem são todos dela"* e
concluiu que a cláusula de gaze ficou agressiva demais.

**Aquele placar foi medido contra um gabarito errado.** A régua
`_Bugs/2026-09-13_gate371_determinismo.cjs` rotula as **sete** imagens da Alice
com papel `"alvo"` (= tem que passar). Abri as imagens nesta ronda, uma por uma:

| imagem | o que eu vejo | papel certo |
|---|---|---|
| `4100fc07` (GERADA, 525 cr) | rosto de frente, **olhos na lente**, boca visível | alvo ✔ |
| `b5c6dea7` | de frente, câmera acima da linha dos olhos, **olhos na lente** | alvo ✔ |
| `128b3050` | de frente, mas **olhar claramente desviado** pro lado | **negativo** ✘ |
| `0e6a538a` | **olhar desviado** pro lado, queixo recolhido | **negativo** ✘ |
| `5f610dda` / `8cd4c73c` | mesmo arquivo (md5 idêntico), **olhar desviado** | **negativo** ✘ |

Ou seja: **parte dos "7 que divergem" era o gabarito errando, não o gate.** O
fix pode estar bem mais perto do certo do que o placar sugeriu — e foi esse
placar que o manteve 7 dias na gaveta enquanto 20 alunos batiam na parede.

**O que eu NÃO estou afirmando:** que o fix está certo. Estou afirmando que **o
placar que o reprovou não serve pra reprovar nada**. Quem for afrouxar a
cláusula de gaze tem que re-medir com o gabarito corrigido primeiro —
afrouxar em cima de gabarito errado é exatamente como o portão virou enfeite
nas duas tentativas anteriores.

**Ressalva que eu não consegui reconciliar:** a nota de 13/09 afirma *"controle
negativo SEGURA, 6 de 6"*, mas o array `IMAGENS` da régua tem **uma só** imagem
com papel `"negativo"` (a do Itamar, #131). Não sei de onde saiu o "6 de 6".
**Não herdei o número** e mandei o `coder` declarar o que realmente medir.

---

## 4. A aluna: o que é verdade e o que eu quase reportei errado

- `access_until` = **2026-09-20 12:00:00Z**: o acesso dela **expirou hoje**,
  ~4h antes desta ronda.
- `video_clones` = **ZERO linhas**. Ela atravessou a janela de acesso inteira
  **sem conseguir um único vídeo clone** — que é exatamente o produto que o
  gate guarda.
- Não escreveu de novo desde 13/09 00:53Z. Conferido na caixa: **1 mensagem
  dela no total**. A última palavra é dela e está certa: *"Mas vocês mesmo
  disseram que a foto estava correta. Eu já fiz a produção correta. Não é
  necessário outras fotos."*

**ERRO MEU, PEGO ANTES DE VIRAR RELATÓRIO.** Ia reportar "pagante travada".
`pagou_de_verdade.cjs` e a busca por nome na Hotmart viva dizem outra coisa: a
única compra é **HP3716014833, R$ 0, 20/08**, e as recorrências de R$ 97 estão
**OVERDUE** e **WAITING_PAYMENT**. Ela teve um mês **cortesia**, não pago.
Conferi antes de escrever pro grupo — o número cru (`plan=pro`,
`access_source=hotmart`, 77.365 créditos) sustentava confortavelmente a
conclusão errada.

**Compensação de acesso: não há o que decidir.** `pagante_trancado.cjs` nesta
ronda: **0 pagantes trancados, 0 na fronteira**, e ela cai na faixa em que
trancar **está certo** pela ordem permanente do Johnny de 13/08 (sem assinatura
= trancado). Não estendi acesso, não devolvi crédito (as recusas não cobram — o
gate roda antes da cobrança) e **não escalei uma não-pergunta** pro Johnny.

**Escrevi pra ela** (Enviados **uid 3022**, registrado em `emails_enviados`,
chave `video-clone-371-status`). Contei, nesta ordem: que a casa prometeu em
13/09 avisar quando subisse e **ficou 7 dias muda, e que a falha foi nossa**;
que a causa é o sorteio, não a foto dela; que **ela não precisa tirar foto
nova** (respondendo à objeção dela diretamente); que eu **corrijo o diagnóstico
do queixo que a própria casa tinha mandado** — em 2 fotos o olhar está na lente
e o gate erra, em outras o olhar vai pro lado e o gate acerta; que o conserto
está em revisão e **não está no ar**; e **não dei data, de propósito**, porque
já quebramos uma promessa com ela. Falei dos dois lados porque ela merece saber
o que é erro nosso e o que não é.

---

## 5. Frota

Cartão **`9c2f6751`** despachado pro `coder`: partir do `d3824d1`, **corrigir o
gabarito** da régua conforme o §3, **ampliar o controle negativo**, re-medir
ANTES × DEPOIS com 5 rodadas, e **só então** mexer na cláusula de gaze se os
alvos ainda não passarem. Critério de aceite exigindo os **dois lados** (alvos
5/5 **e** negativos barrando 5/5 **e** zero flip), PR com a tabela, **sem
mergear**.
