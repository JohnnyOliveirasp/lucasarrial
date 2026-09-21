# Ronda das falhas — 21/09 ~22h30-22h50Z

**Uma linha:** o contador de percepcao travada estava **inflado 6x**; subi o
conserto que ja estava escrito e parado (PR #393), o numero real foi de **6 para
1**, e o 1 que sobrou nao era percepcao — era decisao. Resgatei tambem a 12a
medicao do Video Clone, que estava presa numa branch `feat/`.

---

## §0 — Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `git checkout main && git pull --ff-only` | ok, sem divergencia |
| Reconciliar envios da pasta (`--corte=2026-09-14T14:06:31Z`) | **0 carta** a escriturar. 974 lidas da pasta Sent, 897 ja tinham linha, 77 fora da janela (decisao do `--corte`, nao defeito). Contagem fecha: 974 = 974 |
| Irmao de leitura (`2026-09-18_enviados_x_tabela.cjs`) | **0 carta depois do corte** fora da tabela. Veredito: buraco PASSIVO |
| `percepcao_travada.cjs` | 6 no inicio da ronda -> **0 no fim**. Controle positivo (#310) intacto nas 3 medicoes |

⚠️ O registro local (#210) segue devolvendo **0 cartas** — o ledger e gitignored
e morre com o worktree. E exatamente por isso que a reconciliacao le a **pasta
Enviados** (remota) e e passo fixo: o controle e compensatorio, nao conserto.

---

## §1 — O achado: o instrumento canonico da ordem de 17/09 mentia PRA CIMA

A ronda das 20hZ reportou `#406` e `#455` como **"os dois que merecem o nome de
travado"** (6,3 e 4,0 dias). O handoff da ronda anterior (§6, item 1) mandava
**despachar os dois ao `olho`**.

**Os dois ja estavam resolvidos ha dias.** Fui ler as notas antes de despachar:

- **`#406` (drrodrigoribeiro7@gmail.com)** — as 4 geracoes foram baixadas do R2 e
  comparadas uma a uma com o pedido em **15/09**; a referencia `Facetune_15-09-2026`
  foi baixada e comparada com a saida; o `prompt_en` foi conferido (`standing`).
  Veredito: **nao ha defeito**. Aluno respondido (Enviados uid 2425). O proximo
  passo e **dele** — aqui `aguardando_aluno` esta CERTO.
- **`#455` (consultornovoolhar14@gmail.com)** — o audio foi periciado em **17/09**
  (F0 por autocorrelacao, 901 quadros, unimodal, mediana 148 Hz + transcricao
  Whisper de 2 amostras distantes 700s), **LIBERADO** (`sgp_pedidos` 7269cb2a) e o
  aluno avisado (uid 2691).

**Por que casavam:** o detector lia a NARRATIVA de percepcao cumprida como pedido
pendente. O `#455` casava justamente pela frase *"Eu NAO ouco audio. Entao provei
por dois caminhos independentes..."* — a linha em que a limitacao e **declarada e
contornada**. O `#450` casava por *"NAO e caso de percepcao"* citado entre aspas.

**Credito onde e devido:** quem pegou isso foi o **Vigia**, nas declaracoes de
bloqueio real das 22:16Z — depois da ronda das 20hZ. Sem elas eu teria executado o
handoff e despachado ao `olho` trabalho feito ha 6 dias. Objecao de sensor
funcionando como insumo, que e o desenho da 14-A.

---

## §2 — O conserto estava escrito e parado: PR #393

Aberto **hoje 18:57Z**, ainda `OPEN` quando a ronda comecou. Mesma doenca que a
nota do `#438` nomeou hoje: *conserto parado esperando autorizacao que as regras
da casa dizem que nao existe*. Regra **9-B** ("corrigir bug de codigo -> VOCE
revisa e mergeia") + **14-B** ("o Johnny NAO vai revisar merge"). Sem DDL, logo
sem regra 21. **O merge era meu.**

Conferencias **antes** de mergear — a cicatriz que mais voltou nesta casa
(`onedrive-401`, `fix-image-upload-retry`, as 2 da cura de referencia,
`trava-foto-nova`) e mergear branch STALE por cima de conserto vivo:

- **STALE? NAO.** 13 commits na main desde a base (`8217f536`); **zero** tocam
  `percepcao_travada.cjs` ou seu teste. Nao havia conserto concorrente.
- **Testes no resultado INTEGRADO**, nao no branch solto: merge da main dentro do
  branch, `node --test` -> **29/29**.
- **Rodado ao vivo contra o banco**, que e a prova que importa: 6 -> **1**, com o
  **controle positivo #310 reencontrado**. O patch nao cegou o detector.

O teste trava os 5 casos com o **texto real** da ultima nota de cada cartao
(`#450`, `#406`, `#455`, `#216`, `#438`): se alguem afrouxar o anulador, o teste
quebra com o numero do cartao na cara.

**Prova de que o patch aguenta nota nova:** as declaracoes do Vigia sao das
**22:16Z**, mais de 3h DEPOIS do PR ter sido escrito (18:57Z). O patch as anula
corretamente sem nunca as ter visto.

**Merge `de612997` na main.** Branch deletado no origin.

---

## §3 — O 1 que sobrou nao era percepcao, era decisao

`#214` (zicasantos37@gmail.com) sobrou casando *"PEDIDO DE OLHO HUMANO no grupo"*.
Mas ali **"olho humano" e idioma de DECISAO**: nao existe imagem, audio nem video
pra alguem abrir. Despachar ao `olho` nao produziria nada.

O que de fato esta aberto: **81.730 cr** no profile `405606d7`
(zicasantos08@hotmail.com) cuja unica cobranca (`HP2306675202`, 17 EUR) consta
**REFUNDED** na Hotmart. A regra 9 cobre *"cancelou dentro do trial sem nunca
pagar -> zera"*; **estorno DEPOIS de pagar nao esta escrito em lugar nenhum**.
Pela **9-A**, tirar saldo e sempre do Johnny: **reporto, nao ajo.**

- **Nao reescalei.** O pedido ja saiu ao grupo as 19:31Z por `ask_humans`.
  Repetir hoje seria duplicar. Se 22/09 amanhecer sem resposta, vale repetir UMA vez.
- **A aluna nao esta esperando a casa**: respondida as ~19h35Z (uid 3125), e a
  carta **nao prometeu saldo nem reativacao**, de proposito. Qualquer que seja a
  decisao, nao ha promessa a desfazer.

### ⚠️ Declaracao honesta sobre o 0 do relatorio

O numero final e **0**, mas **parte desse 0 e a nota que EU escrevi** no `#214`
nesta ronda (ela contem "falso positivo", que e anulador). Entao, com todas as
letras:

> **O `#214` continua ABERTO e continua devendo decisao do Johnny.** Ele apenas
> deixou de ser visivel **neste detector**, porque este detector mede
> percepcao e o `#214` nao e percepcao. Ele segue contado na fila normal de
> incidentes (`investigating`) e na escalacao de 19:31Z.

Registro isso porque um 0 que aparece logo depois de o proprio agente escrever
uma nota e exatamente o tipo de numero que esta casa aprendeu a desconfiar.
**0 aqui significa "nenhum cartao espera um par de olhos", nao "nada pendente".**

**Limite do detector, nomeado e NAO consertado hoje:** ele nao distingue
"olho humano" = *ver* de "olho humano" = *decidir*. Nao apertei o padrao porque
o trade ja esta pesado na nota do `#450` de 18/09 (*"falso positivo custa 2
minutos de conferencia, falso negativo custou os 16 dias de silencio que
originaram a ordem"*) e **n=1 nao e classe**. Se aparecer um segundo caso do
idioma, ai vale separar DECISAO de PERCEPCAO no varredor.

---

## §4 — Registro preso em branch `feat/` (handoff item 3)

`fddb5fbc` — a **12a medicao da promessa do Video Clone** (235 linhas) estava
presa em `feat/resumo-diario-grupo-suporte`, invisivel pra todo mundo, inclusive
pra mim na ronda seguinte. Conferi que o commit toca **somente** `_frank/prova/`
(nenhum arquivo de codigo) e fiz **cherry-pick pra main**: `d0334a0f`.

O conteudo, pra quem for pegar o assunto: a faixa de 80-90s que matava foi pisada
13x e sobreviveu (102 jobs, 0 falhas em 68h), **mas** a margem dobrou as 21:30Z de
19/09 e as duas causas levantadas foram derrubadas pelo proprio autor (o rebuild
do worker saiu 2h11 DEPOIS; carga nao explica). **Cura NAO declarada.** A unica
morte rodou com 8 jobs simultaneos contra 1-3 das quase-mortes — aponta o teto
sendo consumido por **FILA**.

---

## §5 — Grupo

**1 mensagem enviada** (`notify-grupo.sh`), e ela existe por um motivo especifico:
**corrige um numero que ja tinha sido transmitido**. A ronda das 20hZ apresentou
`#406` e `#455` ao grupo como os dois travados; eles nao estao. Fato consumado +
numero medido + PR, uma linha, como manda a regra 7.

Nao postei o `#214` (duplicaria a escalacao das 19:31Z) nem progresso parcial.

---

## §6 — Fila: estado

**101 abertos** pelo `idade_dos_abertos.cjs`, **47 com 7d+**. Nao reduzi esse
numero nesta ronda, e digo o passo em que parei: gastei a ronda no **instrumento**
— porque o handoff que eu recebi mandava despachar dois cartoes que ja estavam
resolvidos, e executar aquilo teria produzido trabalho falso e um relatorio falso.
Corrigir a regua veio antes de usar a regua.

**Item serial (`#214`, o mais velho com aluno):** ja tinha sido levado ate o limite
do que e meu na ronda das 19h30Z (aluna respondida, dinheiro NAO tocado, decisao
escalada). O que falta nele e do Johnny, nao meu — e por isso nao e "travado" meu.

## §7 — Para a proxima ronda

1. **`#214`**: se 22/09 amanhecer sem resposta do Johnny sobre saldo de compra
   reembolsada, repetir a escalacao **uma** vez. Nao agir sozinho (9-A).
2. **`hellengrasso@gmail.com`** — 15 dias, 95.375 cr, voz travada em
   `rejected_too_short` com 2 de 7 arquivos. Classe do envio incompleto. **Segue
   intocado; e o candidato natural a item serial da proxima ronda.**
3. **`#517`**: aguardar o detector do `coder` e, com ele, auditar os **fechados**.
   Corrigir o titulo do cartao, que hoje cobra divida ja liquidada.
4. **`#455`**, item tecnico que nao e percepcao: o gate de duas vozes segue sendo
   juiz LLM de TEXTO sobre 2 amostras, nao-determinista e sem registro do veredito.
   **Nao remover a trava** (incidente `5c3f1f8b`/#65: arquivo com duas pessoas
   passou e o clone pegou a voz da entrevistadora). Consertar o METODO.
