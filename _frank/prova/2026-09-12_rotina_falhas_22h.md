# Ronda das falhas — 12/09/2026, 22hZ

Dono da fila: Frank (regra 14-A). Método serial (regra 8, ordem de 21/08).
Canal: ordem de 31/08 — FastCloner sai **no grupo**, e só no grupo. Este
arquivo é o log técnico; a mensagem do grupo é o resumo dele.

**Item serial desta ronda:** `#362` / `12d4db57` — o próximo nomeado pela ronda
das 21hZ, e o único da fila com pagante parada. **Levado até o fim:** fix em
produção, classe medida, cartão `fixed`.

---

## 1. Antes de mexer no código: o estado atual da aluna

A regra manda conferir se já resolveu sozinho antes de qualquer coisa. Conferi,
e a resposta mudou parte do cartão.

| O que o cartão dizia (01:06Z) | O que eu medi (21:45Z) |
|---|---|
| "não voltou mais ao app desde aquele dia" | **voltou hoje, 14:48Z** (`last_seen_at`) |
| pagante de 05/09 | confirmado: 47,94 GBP + R$ 597,00 **APPROVED**, avulsas |
| 95.375 créditos parados | intactos, **nada cobrado** por este caminho |
| 5 dias parada | 6 dias — voz `9bb9fccf`, recusada 06/09 21:00Z |

**E-mail: conferido na caixa, não na palavra de ninguém.** `Sent` tem **4**
mensagens pra ela; a última é a do caso, uid **1937**, 12/09 01:06:11Z
("Sua voz nao treinou por falha nossa - da pra refazer sem custo"). A caixa de
entrada **não tem resposta dela**. Ou seja: foi avisada, leu ou não leu, voltou
ao app hoje e não escreveu. **Não mandei um quinto e-mail** — seria o quinto em
7 dias sobre o mesmo assunto, e ela já tem o caminho e o meu "responda aqui que
eu trato na mão".

### Um susto que eu conferi antes de gritar

`aluno.cjs` mostra **"SEM ACESSO"**: o `access_until` dela venceu **hoje às
12:00Z** e a recorrência #2 está **OVERDUE** (15 GBP não pagos). Pela regra de
20/08 isso seria pagante trancada — urgência de grupo na hora.

**Não é.** Fui ler o gate em vez de confiar no rótulo: as telas liberam por
**crédito**, não por assinatura (ordem `2026-08-18_gate_por_credito.md`), e ela
tem 95.375. As portas estão abertas. O "SEM ACESSO" do `aluno.cjs` é a data de
cobrança, não a tranca — é exatamente a armadilha da virada das 12:00 que o
cabeçalho do `pagante_trancado.cjs` documenta. **Nada a escalar.**

## 2. A revisão do patch do Vigia (regra 14-B)

`patch_12d4db57`, nascido sobre `786742d`. Conferi que o arquivo alvo **não
andou** desde aquela base (`git diff 786742d..HEAD` vazio nele, mesmo com 25
commits novos na main) e apliquei numa worktree limpa: entra limpo.

**A lógica está certa e eu concordo com ela.** O ponto não óbvio, que é o bom:
o update do resgate filtra por `.eq("status","uploading")`, que é a corrida com
o browser. Quando o browser chega primeiro, o update casa **zero linhas e
devolve `error` NULO do mesmo jeito** — e sem guarda abriríamos chamado em cima
de voz que o próprio aluno já fechou. O patch resolve isso pedindo
`.select("id")` e só abrindo o chamado se a escrita foi nossa. É o mesmo
silêncio do update por id inexistente que já cravou causa errada aqui antes.

### O que eu acrescentei antes de subir

O Vigia registrou, com todas as letras, o que **não** conseguiu verificar: *"não
rodo o cron contra R2/Supabase reais, então NÃO vi chamado nascer"*. E
`rescue-stuck-uploads.ts` é impuro (R2, Supabase, presigned) — por isso **nunca
teve teste**. A regra ficaria valendo por leitura de código.

Tirei a decisão de dentro do `if` e fiz dela uma função pura,
`deveAbrirChamadoEnvioPerdido()`, na `regua-audio.ts` — que é pura e já roda no
`node --test`. Quatro testes, um por modo de errar:

| caso | abre chamado? |
|---|---|
| recusa por envio perdido, escrita nossa | **sim** |
| browser venceu a corrida (0 linhas casadas) | não |
| gravou pouco mesmo (`faltando = 0`) | não |
| voz resgatada pro treino | não |

### Uma correção ao diagnóstico do patch

O patch vende a idempotência pela assinatura como a defesa contra duplicata.
**É cinto e suspensório, não a defesa principal:** depois do update a voz sai de
`uploading` e o cron não a enxerga mais na rodada seguinte — o filtro da query
já impede. Registrado na chave do patch pra não virar folclore.

## 3. Em produção

| etapa | prova |
|---|---|
| commit | `104924b` |
| PR | **#256**, base `main` |
| merge | **`03a7922`**, 21:47:12Z |
| deploy | `Deploy Frontend (production)` run `34720936817` — **SUCCESS**, 21:52Z |
| `tsc --noEmit` | 0 erros novos (o único é pré-existente: `resgate-audio.test.ts` importando vitest) |
| `eslint` nos 3 arquivos | limpo |
| `node --test regua-audio.test.ts` | **38/38** (34 antes + 4 novos) |

**O que NÃO subiu, de propósito:** e-mail automático pro aluno. O cartão pedia
"abrir chamado **E** disparar contato"; subi a metade segura — a visibilidade.
Texto automático em cima de quem acabou de levar uma recusa é o tipo de coisa
que se faz uma vez e se lamenta depois. Está na `resolution_note`, não é
esquecimento.

**O que eu NÃO verifiquei, e digo com todas as letras:** não forcei uma voz real
em `uploading` com slots faltando contra R2/Supabase de produção, então **não vi
um chamado nascer no banco**. O que me deixa subir assim é que o caminho de
escrita (`abrirChamadoReportado`, categoria `tecnico`) é o mesmo que o
`burst-rule` já usa em produção, com 34 chamados gravados por ele. Se alguém
precisar da prova de ponta a ponta, ela ainda não existe.

## 4. A classe inteira, medida — e não sobrou ninguém esperando

Fix novo só vale pra frente. Fui ver quem já está nesse estado:

**20 vozes / 12 alunos** com recusa por envio perdido desde 19/07. Mas **18 são
do backfill de mensagem** de 21 e 25/08 (`updated_at` empilhado no mesmo
segundo — é assinatura de lote, não de falha nova). **Duas** nasceram depois:

- **`iremita`** (02/09) — **resolveu-se sozinha 26 min depois**: segunda voz
  `ready` com 21min, já gerando áudio. A recusa não cobrou nada; o débito de
  treino é da voz que deu certo. Nada a fazer.
- **Hellen** (06/09) — a do cartão, tratada na seção 1.

**Zero aluno esperando resposta minha nesta classe agora.** Essa conta é a que
justifica fechar o cartão em vez de deixar investigating com dívida escondida.

## 5. Fechamento do cartão e da fila de patch

- `#362` / `12d4db57` → **`fixed`**, `resolved_at` 21:51:18Z, `resolution_note`
  de 2.580 chars (concatenada, não sobrescrita), 1 linha afetada **conferida na
  releitura**.
- `agent_state.patch_12d4db57` → **"APLICADO E EM PRODUÇÃO — NÃO REAPLIQUE"**,
  com o que eu mudei e o que sobra. É o que impede outra ronda de gastar uma
  hora reconferindo patch já mergeado — foi assim que o face-gate ficou 60h.
- `agent_state.patches_parados` → `fila_real` de **2 para 1**. E o 1 que sobra é
  o face-gate, **refutado por medição** na ronda das 21hZ. Ou seja: **nenhum
  trabalho do Vigia está parado esperando revisão minha.**

## 6. O que eu NÃO fiz nesta ronda

- **Não mexi em crédito, GPU, acesso, voz, assinatura nem migration.** Este fix
  não toca dinheiro: o caminho não dispara treino e não cobra.
- **Não escrevi pra aluno nenhum** (motivo na seção 1).
- **Nada da planilha** (ordem de 29/08).
- Não peguei um segundo item: a regra 8 manda levar UM até o fim, e este foi.

## 7. Segue em aberto (herdado, não tratado aqui)

- `#313` — decisão comercial (honrar × revogar 15 vitalícios) parada há **4
  dias**, trava o cartão mais antigo da fila. **Quarta cobrança.**
- `6c38c99d` (Luciano) — decisão pedida em 24/08 (**19 dias**); cobrança de
  R$ 97 em **19/09**.
- `#312` — segunda tentativa vence **15/09**.
- `#335` — defeito do face-gate **de pé em produção**, patch refutado.
- 37 PRs abertos, não varridos. 64 recados em `para_frank_*`, o mais velho com
  11,1 dias. `#15`, `#47`, `#52`, `#226`, `#234` como nas rondas anteriores.

---

## Fechamento

**Fila: 77 abertos — o mesmo número da ronda passada, e isso não é maquiagem.**
Eu fechei um (`#362`) e entraram dois pela Fast enquanto eu trabalhava: `#368`
(20:35Z, atendimento) e `#369` (21:40Z, aluno mandou texto pra testarmos a voz
clonada dele). Saldo: −1 meu, +2 de entrada. Quem olhar só o total vai achar que
a ronda não produziu nada; produziu, e a entrada é que foi maior.

O que foi fechado, foi fechado de verdade: fix em produção com deploy
confirmado, classe inteira medida, aluna avisada **antes** e conferida na caixa,
patch do Vigia **revisado e estendido** em vez de carimbado. A fila de patch
esperando revisão minha está em **zero**.

`#369` chegou 20 min antes desta ronda e **não é minha** por ora — nasceu na
Fast, é atendimento, e entra na fila pelo caminho normal.
