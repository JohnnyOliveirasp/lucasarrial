# Ronda das falhas — 31/08/2026, 10h43–10h50 UTC (Frank)

Método serial (regra 8, ordem de 21/08): um incidente por vez, até o fim.
Ordem de 29/08 respeitada: **nada da planilha foi lido, escrito, classificado
ou reprocessado**, e nenhum incidente de causa-planilha foi aberto ou reaberto.

## Placar

- Fila no início: **6 abertos + 2 aguardando_aluno**.
- Fila no fim: **5 abertos + 3 aguardando_aluno**.
- Fechados como `fixed`: **0** — e o motivo de cada um está escrito abaixo.
- Alunos avisados: **1** (Vinicius Lorandi, #202).
- Fix em produção: **0**. Os 4 PRs que destravariam a fila seguem OPEN.

## Caso 1 — #99 Luciano (`6c38c99d`), pego pelo serial

O mais antigo com aluno afetado (23/08). **Não fechei, e não há passo técnico
meu pendente**: o que trava é decisão comercial do Johnny.

**O achado da ronda: 10 rondas leram o prazo errado, e o relógio é 1 dia mais
curto do que está escrito.** Fui ao payload cru (`payment_events`, paginado) e
`payload->data->product->warranty_date` = **`2026-09-02T00:00:00Z`**. Meia-noite
do dia 2 é o instante em que **fecha**, não o fim do dia 2. Logo o último dia
útil é **01/09 — amanhã**. As notas anteriores (minhas inclusive) escreviam
"vence em 02/09", que qualquer um lê como "temos o dia 2 inteiro". Não temos.

Reconferido na fonte, sem herdar nota:

- `pagou_de_verdade.cjs`: **PAGOU DE VERDADE** — R$97 APPROVED 26/08 (+ R$0
  COMPLETE 19/08).
- Conta: acesso ativo até 19/09, 166.035 créditos, voz `ready`, **8 video_clones
  todos `ready`**, zero failed, zero preso. Nada quebrado, nada a estornar.
- Último teste (`8a87c68c`) segue estornado: +630 por `ref_type=video_clone_refund`
  — conferido por `ref_type`, **nunca por `kind`**.
- Caixa: **nenhum e-mail novo dele desde 28/08** (uid 372). Silêncio há 3 dias,
  desde o nosso retorno de 29/08. **Não existe bola com ele.**

**11ª escalação**, com um único fato novo: o prazo é amanhã. Perguntei ao Johnny
de forma binária (devolver / segurar / deixar ele escolher), com recomendação
explícita de **DEVOLVER** — e a pergunta ficou sem resposta também nesta sessão.

Não devolvi dinheiro, não cancelei assinatura, não toquei em crédito/acesso, e
não escrevi de novo pro aluno (ele já tem o caminho desde 29/08; aviso repetido
sem fato novo é ruído). **Se não sair decisão até 01/09, ela fica tomada pelo
silêncio, contra um pagante que anunciou saída.**

Status: segue `investigating`. Fechar com prazo aberto seria o done falso da regra 14.

## Caso 2 — #202 Vinicius (`59a1f024`): respondido, e a pergunta em aberto fechou

Peguei porque era **o único da fila com aluno esperando sem ninguém ter
escrito**: ele falou no chat 30/08 23:47Z, a Fast prometeu retorno, e os
Enviados tinham **zero** e-mail pra ele. **11 horas de silêncio** — o padrão que
estourou com a Viviana.

Duas rondas registraram que "só dá pra achar buscando na Hotmart por CPF, que
nenhum agente aqui consegue fazer". Isso está **parcialmente errado**: não
consulto a Hotmart por CPF, mas consigo varrer os **nossos** registros por
**nome**, e ninguém tinha feito. Fiz, paginando:

- `profiles`: **1.695 varridos → exatamente 1** com "lorandi", a própria conta
  dele. **Não existe segunda conta.**
- `payment_events`: **4.965 varridos → ZERO** com "lorandi". Nenhum pagamento no
  nome dele, em nenhum e-mail.

**Armadilha que peguei no meio:** minha 1ª varredura de `profiles` voltou
"0 varridos, 0 achados" porque a coluna `full_name` **não existe** (é
`display_name`) e o PostgREST devolveu **42703**. Como imprimo o `error` cru
antes de acreditar em zero, o zero falso não virou conclusão. Se eu tivesse
confiado nele, teria escrito ao aluno "procurei e não existe" com a busca
**nunca tendo rodado**.

Estado dele: NUNCA PAGOU, conta criada 30/08 23:40Z (7 min antes da queixa), sem
acesso, 0 créditos, `pending_payment_at` NULL. **Não há defeito de webhook**: não
existe pagamento nosso que tenha deixado de virar crédito.

E-mail enviado 10:46:13Z (Sent **uid 364**), individual (regra 8, decido
sozinho): não existe compra neste e-mail nem nada no nome Lorandi; a causa mais
comum é compra com outro e-mail; pedi código da transação / e-mail da compra /
CPF; e as duas garantias que ele precisa ouvir — se o pagamento existe ele não
perdeu nada, e não houve cobrança dobrada. Não prometi crédito, não liberei
acesso.

**Sem `--bcc suporte@lucasarrial.com`**, de propósito (lição do #201, onde o bcc
foi junto no 550 e derrubou a mensagem para todos). Conferido depois de enviar:
cópia em Enviados uid 364 e **nenhum bounce novo** (os únicos são uid 380/381, os
originais de 30/08). O bounce do #201 voltou em ~2s, então ausência aqui é sinal.

Status: `investigating` → `aguardando_aluno`. Não é `fixed` porque nada foi
consertado (não havia defeito nosso) e não é `ignored` porque ainda pode virar
caso real se ele mandar um código de transação que exista.

## O que trava o resto da fila, e não é investigação

`#192`, `#200`, `#201`, `#203` estão todos com a causa **medida e o conserto
escrito**, parados no mesmo lugar: **merge**. Os 4 PRs seguem OPEN (são 30
abertos no total):

| PR | Incidente | O que destrava |
|---|---|---|
| #132 | #200 | seletor "Ritmo" só ativo com "Ajustar ao meu ritmo" ligado |
| #133 | #201 | e-mail que volta deixa de morrer calado |
| #134 | #203 | "medindo…" eterno vira estado de erro explícito |
| #135 | #192 | guarda de mandato do normalizador (**decisão binária** do Johnny) |

Não mergeei nenhum: merge na main deploya, e isso é ação de produção que precisa
do aval. **PR aberto não é produção (regra 14)** — por isso nenhum desses foi
para `fixed`.

## Precisa de gente (nesta ordem)

1. **#99 Luciano — vence AMANHÃ (01/09), não 02/09.** Devolver ou segurar os
   R$97. Recomendo devolver. 11ª escalação sem resposta.
2. **#135** — decisão binária: ligar a guarda inteira ou só o bucket
   reverte-protegida (recomendo a segunda).
3. **#132 / #133 / #134** — aval de merge; 3 incidentes fecham no mesmo dia.
