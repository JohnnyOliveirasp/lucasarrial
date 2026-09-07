# Ronda das falhas — 07/09, 22h41–23h00Z (19h41 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08.

Repo sincronizado (`main`, `pull --ff-only` — já estava em dia) e
`_frank/ordens/README.md` lido antes de tocar em qualquer coisa. Nada da
planilha foi lido, classificado, aberto ou reaberto (ordem de 29/08). Canal:
ordem de 31/08 — aviso no **GRUPO**, nada no privado. Turno 19h41 BRT,
**dentro** da janela 08h–23h.

---

## 0. A ronda em duas linhas

Peguei o **#296** (Leonice) e o achado principal **não é o vídeo de que ela
reclamou: é um prazo falso que nós mesmos demos a ela hoje de tarde**, e que
antecede 27.436 créditos queimados em 8 horas. Corrigi por e-mail, refutei com
medição a hipótese que me foi passada, conferi o dinheiro lançamento a
lançamento e **fechei 1 incidente** (o irmão duplicado).

De quebra, **respondi a pergunta que o Vigia deixou aberta às 22h** ("um chamado
saiu de `ignored` e eu não consigo dizer qual").

Fila: **34 → 33**. Custo: **zero** (sem GPU, sem whisper).

## 1. Serial: por que o #296, e não os quatro da frente

Varredura: 34 abertos, 12 aguardando aluno, 4 "presos", 0 fechado sem retorno.

Os quatro mais antigos (**#15**, **#222**, **#226**, **#234**) foram
reconferidos **na fonte** há uma hora, pela ronda das 22h, e o veredito não
mudou: os três primeiros estão presos em **decisão do Johnny** e o #234 é caça
à causa que já enterrou seis hipóteses. Não vou re-medir o que foi medido há
60 minutos só para produzir movimento.

Peguei o #296 porque é o único item da fila com **aluno pagante sangrando
dinheiro agora** e com o EXECUTOR tendo escrito explicitamente *"Acionado o
Frank"* + a lista do que faltava medir. A ordem manda: aluno esperando vem
antes da limpeza da fila.

## 2. O achado principal: o prazo era nosso, e era falso

O e-mail que saiu **daqui** às 14:27Z (Enviados uid 1243) dizia à Leonice:
*"o seu acesso está indo até 09/09, ou seja, mais dois dias"*, e recomendava
*"vale regravar hoje ou amanhã (…) antes do prazo"*.

**Está errado.** Fui à Hotmart viva:

| campo | valor |
|---|---|
| assinatura | `HCIA7GIM` |
| status | **ACTIVE** |
| plano | Plano Founder |
| `date_next_charge` | **2026-09-09T12:00Z** |

O 09/09 é a data em que a assinatura **RENOVA**, e bate exatamente com o
`profiles.access_until` (`2026-09-09 12:00+00`). Não é vencimento. Ela não ia
ser trancada e não ia perder crédito nenhum.

**O tamanho da coisa:** o próprio e-mail das 14:27 cita o saldo dela em
**149.049**. Medido agora: **121.613**. São **27.436 créditos** queimados nas
~8h **depois** de a casa ter inventado a pressa.

Não afirmo nexo causal provado — não tenho como provar que ela correu por causa
do e-mail. Afirmo a **sequência** e o **tamanho**, que é o que está medido, e
registro que fomos nós que criamos a urgência.

**Corrigido:** escrevi para ela às 22h5xZ desfazendo o prazo e pedindo
desculpa. Cópia **confirmada** em Enviados, **uid 1285**.

## 3. A hipótese que me passaram está refutada

A nota do EXECUTOR (21:25Z) supunha *"imagem de entrada com pouco detalhe
facial / resolução baixa"* e pedia medir resolução/tier/workflow.

Baixei as duas fotos-base do R2 e medi:

| imagem | dimensão | bytes |
|---|---|---|
| `9d3fc63d` | **1086x1448** | 1.853.026 |
| `68ad5831` | **1086x1448** | 1.921.093 |

São imagens **boas**. "Resolução baixa" não explica nada aqui, e **ninguém deve
pedir foto melhor para ela**.

## 4. O que eu achei olhando as duas fotos lado a lado

As duas imagens-base — **ambas geradas no nosso próprio Gerador de Imagem** —
já são **dois rostos diferentes entre si**: mesmo penteado preso, mesmo terno,
mas formato de rosto, nariz e boca diferentes.

Ou seja: a queixa dela (*"manteve o cabelo e mudou as feições"*) **reproduz
ANTES do Vídeo Clone**, entre duas gerações de imagem. O Gerador de Imagem
**não trava identidade** entre gerações.

Isso explica o laço em que ela entrou, e por que ele não converge por
construção: gera imagem → anima → o rosto não bate → gera outra imagem → repete.
Ela fez **4 gerações de imagem** e **5 Vídeos Clone** só hoje.

Fator **secundário**, esse sim do vídeo: as fotos são plano **aberto** (sentada
à mesa), com o rosto ocupando ~1/4 da altura; no tier 480p sobra da ordem de
**100px de rosto** e o InfiniteTalk re-sintetiza quadro a quadro. Contribui,
mas não é a origem da queixa.

## 5. Dinheiro: limpo, conferido lançamento a lançamento

Dia 07/09 inteiro, na conta `49110dde`:

- **5x** `studio_audio` −550 e **5x** +550 por **`ref_type=studio_audio_refund`**
  → líquido **ZERO**. Conferido por `ref_type`, **não por `kind`** (armadilha
  medida do 20/08).
- **5** `video_clone` (2640 + 3990 + 3360 + 3360 + 4515): **todos `ready`**.
- **1** `image_video` **−9000** ("Animar imagem — Gold", 21:15, ref `68ad5831`):
  `video_status=ready` com `video_path` gravado. **Entregue.**

**Nenhuma cobrança indevida.** Era uma das duas coisas que ela pediu para
conferir, e está respondida com número.

## 6. A pergunta que o Vigia deixou aberta às 22h — respondida

Ele registrou que `ignored` caiu de 46 para 45 e `investigating` subiu 2, com
apenas 1 chamado novo, e escreveu: *"um chamado que estava fechado como
`ignored` voltou pra fila e eu não consigo dizer qual"*.

**É o `#296`.** E o motivo de ele não ter conseguido achar é legítimo:

- a reabertura **limpa os três campos do fechamento** (`resolved_at`,
  `resolved_by`, `resolved_commit`) — é o `limparFechamento()` de
  `_frank/../lib/incidents/closure.ts`, e é **de propósito**. Por isso a sonda
  dele ("aberto com `resolved_at` preenchido") devolveu **0 linhas
  corretamente**;
- e **nenhum** dos dois caminhos que deixam rastro rodou: não há nota `system`
  (`REINCIDÊNCIA`, de `ingest.ts:102-108`) nem nota `carol` (de
  `entregar.ts:110`) no #296.

**A sonda que funciona** — e que fica registrada aqui para as próximas rondas:

```sql
select numero, status, last_seen_at, resolution_note
from incidents
where status in ('open','investigating') and resolution_note is not null;
```

O `resolution_note` é o **único** vestígio de um fechamento anterior que a
reabertura **não apaga**. Ela devolve 5 linhas (#15, #226, #247, #289, #296) e
o #296 é o único cujo `last_seen_at` (21:23:14Z) cai na janela 20h→22h.

**O que aconteceu, na melhor leitura das evidências:** o EXECUTOR reabriu
deliberadamente às ~21:25Z porque a ocorrência 2 **mudou de assunto** (deixou de
ser o `no_speech` que eu já tinha medido e respondido às 14:28 e virou o rosto
do Vídeo Clone) — ele documentou isso na própria nota. Por eliminação, o
caminho é o `set_status` da rota do agente, que troca status e limpa o carimbo
**sem escrever nota automática**. Digo "por eliminação" de propósito: provei
qual incidente e provei que os dois caminhos com rastro não rodaram; não tenho
log de auditoria para cravar a rota.

**Não é corrupção de dado e não houve culpa de ninguém.** O que falta é
auditoria: a tabela `incidents` não tem histórico de mudança de status
(confirmado no `information_schema` pelo Vigia), então uma reabertura legítima
fica indistinguível de uma silenciosa.

## 7. Fechei 1: o `#302`

`ff95507f` era **duplicata de atendimento** do #296 (mesma aluna, mesmo tema,
aberto 25min antes). Fechado como **`ignored`** com nota e `resolution_note`,
1 linha afetada, conferido na releitura.

Fechei como `ignored` e **não `fixed`** de propósito: **não houve conserto de
código**. E a condição de fechamento do `entregar.ts` (*"fica aberto até alguém
responder o aluno"*, decisão do Johnny 29/08 #153) está **cumprida** — ela foi
respondida, com prova (uid 1285).

**O #296 fica ABERTO**, e digo por quê: a parte de atendimento acabou, mas a
**lacuna de produto** (Gerador de Imagem sem trava de identidade entre gerações)
é real e precisa de **decisão**, não de patch meu às 23h. Fechar como `fixed`
seria mentira; fechar como `ignored` esconderia a lacuna.

## 8. Exposição da mesma armadilha do item 2 (medida, não inflada)

`account.ts:259-260` entrega ao agente a string **`"ativo até <data>"`** sem
dizer se a assinatura **renova**. Para assinatura `ACTIVE`, essa data é a
**próxima cobrança** — e qualquer agente que a leia como prazo inventa urgência,
que foi exatamente o que aconteceu hoje.

Medido agora, `access_source='hotmart'`:

| | perfis |
|---|---|
| acesso vivo | 661 |
| `access_until` dentro de **7 dias** | **264** |
| `access_until` dentro de **3 dias** | **123** |

⚠️ **264 é EXPOSIÇÃO, não vítimas.** Mensagem errada de fato eu tenho **1
confirmada** (esta). Registro a distinção de propósito: este é o tipo de número
que já virou achado inflado três vezes neste repositório.

## 9. Triagem dos outros "presos" da varredura

- **`hellengrasso`** (pagante, 95.375 cr, acesso até 12/09) — voz `9bb9fccf`
  em `rejected_too_short`. **Não é defeito vivo:** a mensagem gravada já é a
  **corrigida** pelo PR #52 (diz *"a perda do que não chegou foi nossa"* e dá a
  conta honesta dos 20min). Ela recebeu 2 de 7 arquivos = 415s; mesmo com os 7
  inteiros daria ~19min, abaixo do mínimo de 20. Ou seja: ela **precisa gravar
  mais**, e a tela já disse isso certo. Medi a classe inteira antes de chamar de
  epidemia: **~20 vozes em 2 meses**, nunca mais de 2 num dia. Não é surto.
- **`tania-araujo`** e **`roseneidemaia35`** — já triadas na ronda das 22h
  (`awaiting_training` é "não clicou em treinar"; a segunda ficou `ready`
  sozinha). Confiro e concordo, não re-medi.
- **`marcelopersonalthe32`** e **`luanmarcal`** — sem novidade desde a ronda
  anterior; prazo de reembolso do primeiro vence **11/09** e continua na lista
  de decisão.

## 10. O que eu NÃO fiz

Não gastei GPU, não gastei whisper, não mexi em crédito/acesso/plano, não
estornei, não apliquei migration, não mergeei PR, não abri branch, não escrevi
código de produção, não reabri incidente e não toquei em nada da planilha.
**Não abri incidente novo para a armadilha do item 8**: inserir linha em
`incidents` na mão (numeração + `signature`) é justamente o tipo de escrita
com service-role que já fez estrago aqui — vai como pedido de decisão, não como
`INSERT` meu.

Escritas da ronda: **2 notas** (#296 e #302), **1 fechamento** (#302),
**1 e-mail** (uid 1285), **1 aviso no grupo** e **1 arquivo no git** (este log).
Scripts de uso único ficaram em `_Bugs/` (fora do git):
`2026-09-07_medir_foto_base_leonice.cjs`,
`2026-09-07_status_assinatura_leonice.cjs`.

## 11. Fila

**34 na entrada, 33 na saída** (fechei o #302). `ignored` 45 → 46,
`investigating` 34 → 33, total 291 — a aritmética fecha.
12 aguardando aluno, **6 deles com 7d+** pedindo segunda tentativa
(#47, #99, #172, #206, #207, #214). Nada fechado voltou a disparar.

## 12. Precisa de DECISÃO do Johnny

1. 🔴 **O "pode" dos 8 do #290** — pendente desde 04/09; ~800k créditos parados.
2. 🔴 **`migration 82`** — destrava o #15 (39 dias).
3. 🟠 **NOVO — "ativo até" vira prazo falso** (item 8). Duas saídas possíveis:
   passar o status/renovação da assinatura junto do `access_until` em
   `account.ts`, ou proibir agente de citar a data como prazo. **É código: pede
   card e PR, não patch de madrugada.** Custou 27k créditos de uma aluna hoje.
4. 🟠 **NOVO — Gerador de Imagem sem trava de identidade** (#296). É lacuna de
   produto, não bug. Enquanto não houver decisão, aluno que quer persona
   consistente entra em laço caro. É o mesmo tema dos #216/#245/#302.
5. 🟡 **#254 / Diego** — relógio em **08/09 12:00Z (amanhã)**.
6. 🟡 **#265** — política de garantia parada; código já curado.
7. 🟡 **#226 / #234** — cobrar ou estornar as gerações reprovadas pelo QA.
8. 🟡 **marcelopersonalthe32** — prazo de reembolso vence **11/09**.
9. 🟡 **#222** — o próprio card pede reenquadrar ou fechar.

## 13. Para quem pegar a próxima ronda

- **A sonda de reabertura é `resolution_note`, não `resolved_at`** (item 6).
  `resolved_at` é limpo na reabertura de propósito; `resolution_note` sobrevive.
- **Não peça foto melhor para a Leonice** — as imagens dela são 1086x1448 e a
  hipótese de resolução está refutada com medição (item 3).
- **Antes de dizer a QUALQUER aluno que o acesso dele "vence" numa data**,
  confira o status da assinatura na Hotmart viva. Para `ACTIVE`, aquela data é
  a **próxima cobrança** (item 2). Já custou caro uma vez hoje.
- **A classe "envio incompleto" não é surto**: ~20 vozes em 2 meses (item 9).
  Não gaste ronda nela.
- O `cauda_decepada.jsonl` continua parando em **04/09** (herdado da ronda das
  22h): conclusão sobre voz de 05/09 em diante precisa de `--varrer` antes.
