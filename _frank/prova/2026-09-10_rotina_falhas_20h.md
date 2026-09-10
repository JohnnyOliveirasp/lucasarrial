# Ronda das falhas — 10/09/2026, ~18h20–19h00Z (15h20–16h00 BRT)

Dono da fila (14-A). Backlog **serial**. Repo em `main`, `pull --ff-only` antes
de tocar em nada. Índice de ordens lido primeiro.

Ordem de **29/08** respeitada: nada da planilha lido, escrito, classificado,
avisado ou reprocessado; nenhum chamado de causa-planilha aberto ou reaberto.
O que toquei do SGP é o produto em produção (`/sgp`), não a planilha.
Ordem de canal de **31/08**: o aviso desta ronda foi **no grupo**.

**Fechado: `#342` (`8375f532`) — fix na main, `7d9b617`, PR #233.**
Nenhum aluno recebeu e-mail nesta ronda, e digo no §1 por que isso é decisão.

---

## 0. Por que este cartão, e não o mais antigo

A regra manda o mais antigo **com aluno afetado**. Conferi os dois de cima eu
mesmo, em vez de herdar veredito:

- **`#15`** (30/07, 18 alunos): `last_seen_at` 04/09, **nenhuma ocorrência
  nova**. A condição de fechamento escrita no próprio cartão — próxima falha de
  `executionTimeout` sob a régua nova, ou 30 dias limpos a partir de 10/09 —
  não foi atingida. Não há o que fazer hoje.
- **`#47`** (19/08): a aluna foi avisada **hoje**, cópia confirmada. Pela regra
  8, esperar resposta de aluno não é estar travado — saiu do meu colo.
- **`#99`** (23/08): peguei, medi, **não fechei**, e o §1 diz em que passo trava.
- **`#223`** (01/09): travado na mesma classe do `#99` — falta uma frase do
  Johnny, escalado ontem, urgente. Não re-escalei hoje (§1).

Com os quatro primeiros ou bloqueados ou fora do meu colo, desci para o par
`#341`/`#342`, que é onde **a bola era minha** e onde havia dinheiro em risco.

---

## 1. `#99` e `#223`: onde travam, sem enfeitar

Os dois esperam **decisão comercial do Johnny/Lucas**, não código.

**`#99` (Luciano).** Medido hoje: última mensagem dele **28/08 20h53** (13 dias
de silêncio), acesso ativo até 19/09, 166.035 créditos, parou de produzir em
28/08. A próxima cobrança de **R$ 97 cai em 19/09** — 9 dias.

Não escrevi para ele **de propósito**, e fui ler a caixa antes de decidir: o
nosso e-mail de 05/09 (Enviados uid 1075) já fez a pergunta ("encerro antes de
19/09 ou mantenho?") e já assumiu o compromisso de *"te escrevo de novo perto
de 19/09"*. Faz 5 dias, não 7. Escrever hoje não entrega fato novo — seria a
13ª cópia da mesma escalação, que é o ruído que a regra 7 proíbe, e com este
aluno "em breve" já falhou 4 vezes.

**Correção de uma frase que circula nesta fila:** várias notas dizem que "a
resposta do Johnny e do Lucas nunca saiu". Isso vale para o **reembolso** e só.
Sobre o **mérito** já saiu e está na caixa — Enviados uid 218, 27/08 22h43Z,
assinado Johnny: *"o reel foi feito no HeyGen avatar nível 4; o nosso clone
próprio hoje se assemelha ao nível 3"*. Ele testou depois disso e respondeu
"ficou artificial mais uma vez". Quem ler esta fila não deve repetir que não
houve posicionamento nenhum: houve o técnico, falta o do dinheiro.

**Decisão com data, para a próxima ronda herdar:** se ele seguir em silêncio, o
e-mail prometido sai em **16 ou 17/09**, não antes, e existe para cumprir a
promessa do uid 1075 — não para cobrar resposta.

**`#223` (Alana).** Bloqueio: honrar uma promessa escrita nossa ("mesmo depois
do dia 08") contra a REGRA FINAL DE CRÉDITO, já que ela nunca pagou. Não é
minha alçada, foi escalado ontem marcado urgente. Há urgência técnica real
(IndexedDB morre com limpeza de cache e leva os 20min de gravação dela).
Não re-escalei: repetir sem fato novo mata o canal.

---

## 2. O que eu consertei: o guarda de estorno estava cego (`#342`)

### O defeito

`conferirListaCompleta` só suspeitava de `ref_type` cujo **nome** casasse
`/refund|estorn|devolu/i`. Devolução batizada de outro jeito era invisível
**por construção**: a varredura diária imprimiu `nenhum tipo desconhecido` por
**11 dias** com **67 linhas / 622.425 cr** de `perdao_negativo_onboarding` no
banco.

É a **segunda** falha deste mesmo guarda. Em 29/08 (`#185`) o furo era a
**janela** (`.limit(5000)` rebaixado em silêncio pelo PostgREST). Consertada a
janela, sobrou o **critério**. Um guarda que adivinha pelo nome só pega quem se
comporta; o tipo perigoso é justamente o que ninguém batizou direito.

### O conserto

Critério por **exclusão**, com duas listas explícitas: ou é devolução conhecida
(`REF_TYPES_ESTORNO`), ou é sabidamente-não-devolução (`NAO_SAO_DEVOLUCAO`), ou
**acusa**. Nome não entra na conta. Isso troca o modo de falha: antes tipo novo
nascia invisível e calado; agora nasce acusando, e alguém precisa dizer
conscientemente em qual lista ele entra. O preço é ruído quando aparece tipo
novo legítimo, e é o preço certo.

### O achado que o chamado não tinha, e que é dinheiro

Havia um **rascunho não commitado** deste mesmo conserto no worktree
`/tmp/wt-estornos-guarda` — alguém começou hoje e não terminou. O desenho dele
estava certo, mas ele classificava **`compensation` como cortesia**, por causa
do nome.

Medi antes de aceitar, pelo critério que o próprio arquivo define como prova
(casar `ref_id` com o débito e somar o sinal):

```
ref_id 0c0c08fc…  generation -1996  +  compensation +1996  = 0
ref_id 957d96eb…  generation -1999  +  compensation +1999  = 0
nota das duas: "estorno: eco de referência na voz Ricardo (corrigido 28/07)"
```

É estorno de geração de áudio com outro nome. Como cortesia,
`ehEstorno('compensation')` daria `false`, e quem perguntasse *"essa geração já
foi ressarcida?"* leria **NÃO** — exatamente o falso negativo do `#185`, com
outro nome. **O rascunho ia consertar o bug repetindo-o.** Movido para a lista
de devolução, com a medição anotada no código e um teste travando.

### A prova em produção (antes/depois), rodada nos 16 do `#341`

| | já-pagos detectados | pendente que leria |
|---|---|---|
| lista **ANTIGA** | **0 de 2** | 168.400 |
| lista **NOVA** | 2 de 2 | **147.350** |

Com o guarda cego, quem executasse a devolução do `#341` pagaria **10.525 em
dobro** para `neilamagalhaes79@` e `carlaneavatar@` — **21.050 cr**.

### Também corrigido: o alerta ensinava o erro oposto

A mensagem da varredura mandava somar o tipo em `REF_TYPES_ESTORNO` *"antes de
decidir qualquer devolução"*. Esse conselho erra **pro outro lado**: tipo que
**não** é devolução jogado na lista por via das dúvidas faz aluno que a casa
**deve** ler como já pago e ficar sem receber. Agora ela manda classificar numa
das duas e ensina a prova pelo `ref_id`.

### Verificação (depois de gravar, não antes)

- `7d9b617` está em `origin/main` (`pull --ff-only` feito).
- Rodando **do repo principal**, não do worktree: `perdao_negativo_onboarding`,
  `compensation`, `reparo_falha_operacional` → `true`; `payment_event`,
  `courtesy_grant` → `false`; `classificarDesconhecidos(['abono_qualquer_2027'])`
  **acusa**.
- Testes **10/10** (`node --test`, sem banco e sem rede), com **controle
  negativo** (o critério antigo *tinha* que deixar passar — se esse assert cair,
  o teste virou circular) e **controle positivo** dos 25 `ref_type` medidos hoje.
- Varredura completa rodada de ponta a ponta: **3.071 linhas**, sem erro.

---

## 3. `#341`: protegido, não executado

**Não creditei ninguém.** A devolução passa do teto que eu decido sozinho e
segue aguardando o "pode" do Johnny.

O que fiz foi recontar contra `credit_transactions`, um a um, e gravar no
cartão: **2 já pagos** (`neilamagalhaes79@` 12h51Z, `carlaneavatar@` 14h32Z) e
**14 pendentes = 147.350 cr**. O **título do cartão está vencido** ("16
compradores / 168.400") e já custou duas correções do vigia em 4 horas — a
lista decaiu ~1 pessoa a cada 1,7h de janela útil. Quem executar deve recontar
na hora, não confiar no título.

---

## 4. O que NÃO fiz, de propósito

- Não escrevi para nenhum aluno (§1).
- Não creditei, não estornei, não cancelei assinatura, não mexi em acesso.
- Não gastei GPU.
- Não apliquei migration.
- Não re-escalei ao grupo o que já foi escalado ontem sem fato novo.

## 5. Fim de ronda

- `git log --oneline origin/main..HEAD` → **vazio**.
- Nenhum fix preso em branch: `7d9b617` está na main, conferido por `git log` em
  `origin/main` e pelo comportamento do módulo carregado do repo principal.
- Aviso do fato consumado postado **no grupo** (ordem de 31/08), uma linha por
  fato.

## 6. Fica registrado para quem pegar a próxima

1. **`#15`** só se mexe com ocorrência nova sob a régua nova, ou em 10/10.
2. **`#99`**: e-mail em 16–17/09 se ele seguir em silêncio. Não antes.
3. **`#223`** e **`#341`** dependem de uma frase do Johnny. Nenhum dos dois é
   código.
4. Ao executar o `#341`, **reconte** — o título mente e a lista envelhece rápido.
5. Ficou trabalho não commitado em worktree hoje (`/tmp/wt-estornos-guarda`).
   Vale olhar os outros worktrees antes de abrir frente nova: rascunho parado é
   fix que não chega na main, e este quase entrou com um tipo mal classificado.
